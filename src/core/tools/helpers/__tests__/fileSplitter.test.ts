import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "fs/promises"
import path from "path"
import os from "os"
import {
	shouldSplitFile,
	splitLargeFile,
	cleanupSplitFiles,
	hasSplitDirectory,
	getSplitDirectoryPath,
} from "../fileSplitter"
import { FILE_SIZE_LIMITS } from "../fileSizeHelpers"

describe("fileSplitter", () => {
	let testDir: string
	let testFilePath: string

	beforeEach(async () => {
		// Create a temporary test directory
		testDir = path.join(os.tmpdir(), `file-splitter-test-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })
		testFilePath = path.join(testDir, "test-file.txt")
	})

	afterEach(async () => {
		// Clean up test directory
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch (error) {
			// Ignore cleanup errors
		}
	})

	describe("shouldSplitFile", () => {
		it("should return true for files larger than 180KB", async () => {
			// Create a file larger than 180KB
			const largeContent = "x".repeat(FILE_SIZE_LIMITS.FORCE_LINE_RANGE_BYTES + 1000)
			await fs.writeFile(testFilePath, largeContent, "utf-8")

			const result = await shouldSplitFile(testFilePath)
			expect(result).toBe(true)
		})

		it("should return false for files smaller than 180KB", async () => {
			// Create a small file
			const smallContent = "Hello, world!"
			await fs.writeFile(testFilePath, smallContent, "utf-8")

			const result = await shouldSplitFile(testFilePath)
			expect(result).toBe(false)
		})

		it("should return false for non-existent files", async () => {
			const result = await shouldSplitFile(path.join(testDir, "non-existent.txt"))
			expect(result).toBe(false)
		})
	})

	describe("splitLargeFile", () => {
		it("should split a large file into multiple chunks", async () => {
			// Create a file with 3000 lines (should split into 2 chunks of 1500 lines each)
			const lines = Array.from({ length: 3000 }, (_, i) => `Line ${i + 1}`)
			await fs.writeFile(testFilePath, lines.join("\n"), "utf-8")

			const result = await splitLargeFile(testFilePath, { baseDir: testDir })

			expect(result.wasSplit).toBe(true)
			expect(result.totalLines).toBe(3000)
			expect(result.chunkCount).toBe(2)
			expect(result.chunkFiles).toHaveLength(2)
			expect(result.splitDir).toBeDefined()

			// Verify chunk files exist
			for (const chunkFile of result.chunkFiles!) {
				const chunkPath = path.join(result.splitDir!, chunkFile)
				const exists = await fs
					.access(chunkPath)
					.then(() => true)
					.catch(() => false)
				expect(exists).toBe(true)
			}

			// Verify metadata file exists
			const metadataPath = path.join(result.splitDir!, "split_metadata.json")
			const metadataExists = await fs
				.access(metadataPath)
				.then(() => true)
				.catch(() => false)
			expect(metadataExists).toBe(true)

			// Verify README file exists
			const readmePath = path.join(result.splitDir!, "README.md")
			const readmeExists = await fs
				.access(readmePath)
				.then(() => true)
				.catch(() => false)
			expect(readmeExists).toBe(true)
		})

		it("should handle files with less than maxLinesPerChunk lines", async () => {
			// Create a file with 500 lines (should result in 1 chunk)
			const lines = Array.from({ length: 500 }, (_, i) => `Line ${i + 1}`)
			await fs.writeFile(testFilePath, lines.join("\n"), "utf-8")

			const result = await splitLargeFile(testFilePath, { baseDir: testDir })

			expect(result.wasSplit).toBe(true)
			expect(result.totalLines).toBe(500)
			expect(result.chunkCount).toBe(1)
			expect(result.chunkFiles).toHaveLength(1)
		})

		it("should handle custom maxLinesPerChunk", async () => {
			// Create a file with 200 lines and set maxLinesPerChunk to 100
			const lines = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}`)
			await fs.writeFile(testFilePath, lines.join("\n"), "utf-8")

			const result = await splitLargeFile(testFilePath, { baseDir: testDir, maxLinesPerChunk: 100 })

			expect(result.wasSplit).toBe(true)
			expect(result.totalLines).toBe(200)
			expect(result.chunkCount).toBe(2)
			expect(result.chunkFiles).toHaveLength(2)
		})

		it("should clean up existing split directory before creating new one", async () => {
			const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`)
			await fs.writeFile(testFilePath, lines.join("\n"), "utf-8")

			// First split
			const result1 = await splitLargeFile(testFilePath, { baseDir: testDir })
			expect(result1.wasSplit).toBe(true)

			// Modify the file and split again
			const newLines = Array.from({ length: 200 }, (_, i) => `New Line ${i + 1}`)
			await fs.writeFile(testFilePath, newLines.join("\n"), "utf-8")

			const result2 = await splitLargeFile(testFilePath, { baseDir: testDir })
			expect(result2.wasSplit).toBe(true)
			expect(result2.totalLines).toBe(200)
		})

		it("should return error for non-existent file", async () => {
			const result = await splitLargeFile(path.join(testDir, "non-existent.txt"), { baseDir: testDir })

			expect(result.wasSplit).toBe(false)
			expect(result.error).toBeDefined()
		})

		it("should preserve file extension in chunk files", async () => {
			const tsFilePath = path.join(testDir, "test.ts")
			const lines = Array.from({ length: 100 }, (_, i) => `const line${i + 1} = ${i + 1};`)
			await fs.writeFile(tsFilePath, lines.join("\n"), "utf-8")

			const result = await splitLargeFile(tsFilePath, { baseDir: testDir })

			expect(result.wasSplit).toBe(true)
			expect(result.chunkFiles![0]).toMatch(/\.ts$/)
		})
	})

	describe("cleanupSplitFiles", () => {
		it("should remove split directory", async () => {
			// Create and split a file
			const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`)
			await fs.writeFile(testFilePath, lines.join("\n"), "utf-8")

			const result = await splitLargeFile(testFilePath, { baseDir: testDir })
			expect(result.wasSplit).toBe(true)

			// Clean up
			await cleanupSplitFiles(testFilePath, testDir)

			// Verify directory is removed
			const exists = await fs
				.access(result.splitDir!)
				.then(() => true)
				.catch(() => false)
			expect(exists).toBe(false)
		})

		it("should not throw error if directory does not exist", async () => {
			await expect(cleanupSplitFiles(testFilePath, testDir)).resolves.not.toThrow()
		})
	})

	describe("hasSplitDirectory", () => {
		it("should return true if split directory exists", async () => {
			// Create and split a file
			const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`)
			await fs.writeFile(testFilePath, lines.join("\n"), "utf-8")

			const result = await splitLargeFile(testFilePath, { baseDir: testDir })
			expect(result.wasSplit).toBe(true)

			const hasDir = await hasSplitDirectory(testFilePath, testDir)
			expect(hasDir).toBe(true)
		})

		it("should return false if split directory does not exist", async () => {
			const hasDir = await hasSplitDirectory(testFilePath, testDir)
			expect(hasDir).toBe(false)
		})
	})

	describe("getSplitDirectoryPath", () => {
		it("should return correct split directory path", () => {
			const filePath = path.join(testDir, "myfile.txt")
			const expectedPath = path.join(testDir, "tmp_myfile")

			const splitPath = getSplitDirectoryPath(filePath, testDir)
			expect(splitPath).toBe(expectedPath)
		})

		it("should handle files with multiple extensions", () => {
			const filePath = path.join(testDir, "myfile.spec.ts")
			const expectedPath = path.join(testDir, "tmp_myfile.spec")

			const splitPath = getSplitDirectoryPath(filePath, testDir)
			expect(splitPath).toBe(expectedPath)
		})

		it("should use file directory as baseDir if not provided", () => {
			const filePath = path.join(testDir, "myfile.txt")
			const expectedPath = path.join(testDir, "tmp_myfile")

			const splitPath = getSplitDirectoryPath(filePath)
			expect(splitPath).toBe(expectedPath)
		})
	})

	describe("integration tests", () => {
		it("should correctly split and read chunks", async () => {
			// Create a file with known content
			const lines = Array.from({ length: 2500 }, (_, i) => `Line number ${i + 1}`)
			await fs.writeFile(testFilePath, lines.join("\n"), "utf-8")

			// Split the file
			const result = await splitLargeFile(testFilePath, { baseDir: testDir, maxLinesPerChunk: 1000 })

			expect(result.wasSplit).toBe(true)
			expect(result.chunkCount).toBe(3) // 1000 + 1000 + 500

			// Read and verify first chunk
			const chunk1Path = path.join(result.splitDir!, result.chunkFiles![0])
			const chunk1Content = await fs.readFile(chunk1Path, "utf-8")
			const chunk1Lines = chunk1Content.split("\n")
			expect(chunk1Lines).toHaveLength(1000)
			expect(chunk1Lines[0]).toBe("Line number 1")
			expect(chunk1Lines[999]).toBe("Line number 1000")

			// Read and verify last chunk
			const chunk3Path = path.join(result.splitDir!, result.chunkFiles![2])
			const chunk3Content = await fs.readFile(chunk3Path, "utf-8")
			const chunk3Lines = chunk3Content.split("\n")
			expect(chunk3Lines).toHaveLength(500)
			expect(chunk3Lines[0]).toBe("Line number 2001")
			expect(chunk3Lines[499]).toBe("Line number 2500")
		})
	})
})
