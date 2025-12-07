// npx vitest services/tree-sitter/__tests__/parseSourceCodeDefinitions.filesize.spec.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { parseSourceCodeDefinitionsForFile, parseSourceCodeForDefinitionsTopLevel } from "../index"
import { FILE_SIZE_LIMITS } from "../../../core/tools/helpers/fileSizeHelpers"

// Mock modules
vi.mock("fs/promises", () => ({
	default: {
		stat: vi.fn(),
		readFile: vi.fn(),
	},
	stat: vi.fn(),
	readFile: vi.fn(),
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn(),
}))

vi.mock("../../glob/list-files", () => ({
	listFiles: vi.fn(),
}))

vi.mock("../languageParser", () => ({
	loadRequiredLanguageParsers: vi.fn().mockResolvedValue({}),
}))

describe("parseSourceCodeDefinitions with file size limits", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("parseSourceCodeDefinitionsForFile", () => {
		it("should skip files larger than 180KB", async () => {
			const largeFileSize = FILE_SIZE_LIMITS.FORCE_LINE_RANGE_BYTES + 1024 // 181KB
			const testFilePath = "/test/large-file.ts"

			// Import mocked modules
			const { fileExistsAtPath } = await import("../../../utils/fs")
			const fs = await import("fs/promises")

			// Setup mocks
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.stat).mockResolvedValue({
				size: largeFileSize,
				isFile: () => true,
				isDirectory: () => false,
			} as any)

			const result = await parseSourceCodeDefinitionsForFile(testFilePath)

			expect(result).toContain("File too large")
			expect(result).toContain(`${Math.round(largeFileSize / 1024)} KB`)
			expect(result).toContain("line_range")

			// Verify that fs.readFile was NOT called
			expect(fs.readFile).not.toHaveBeenCalled()
		})

		it("should process files smaller than 180KB normally", async () => {
			const smallFileSize = FILE_SIZE_LIMITS.FORCE_LINE_RANGE_BYTES - 1024 // 179KB
			const testFilePath = "/test/small-file.ts"
			const fileContent = "function test() { return 42; }"

			// Import mocked modules
			const { fileExistsAtPath } = await import("../../../utils/fs")
			const { loadRequiredLanguageParsers } = await import("../languageParser")
			const fs = await import("fs/promises")

			// Setup parser mocks
			const mockParser = {
				parse: vi.fn().mockReturnValue({
					rootNode: "mockNode",
				}),
			}
			const mockQuery = {
				captures: vi.fn().mockReturnValue([
					{
						node: {
							startPosition: { row: 0 },
							endPosition: { row: 3 },
							parent: {
								startPosition: { row: 0 },
								endPosition: { row: 3 },
							},
							text: () => "function test()",
						},
						name: "name.definition.function",
					},
				]),
			}

			// Setup mocks
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.stat).mockResolvedValue({
				size: smallFileSize,
				isFile: () => true,
				isDirectory: () => false,
			} as any)
			vi.mocked(fs.readFile).mockResolvedValue(fileContent)
			vi.mocked(loadRequiredLanguageParsers).mockResolvedValue({
				ts: { parser: mockParser, query: mockQuery } as any,
			})

			const result = await parseSourceCodeDefinitionsForFile(testFilePath)

			// Should not contain file too large error
			expect(result).not.toContain("File too large")

			// Verify that fs.stat was called to check file size
			expect(fs.stat).toHaveBeenCalled()
			// Verify that fs.readFile was called since file is small enough
			expect(fs.readFile).toHaveBeenCalled()
		})

		it("should handle markdown files with size check", async () => {
			const largeFileSize = FILE_SIZE_LIMITS.FORCE_LINE_RANGE_BYTES + 1024
			const testFilePath = "/test/large-file.md"

			// Import mocked modules
			const { fileExistsAtPath } = await import("../../../utils/fs")
			const fs = await import("fs/promises")

			// Setup mocks
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fs.stat).mockResolvedValue({
				size: largeFileSize,
				isFile: () => true,
				isDirectory: () => false,
			} as any)

			const result = await parseSourceCodeDefinitionsForFile(testFilePath)

			expect(result).toContain("File too large")
			expect(result).toContain("line_range")

			// Verify that fs.readFile was NOT called for large markdown
			expect(fs.readFile).not.toHaveBeenCalled()
		})
	})

	describe("parseSourceCodeForDefinitionsTopLevel", () => {
		it("should skip large files when processing directory", async () => {
			const testDirPath = "/test/dir"
			const smallFileSize = 1024 // 1KB
			const largeFileSize = FILE_SIZE_LIMITS.FORCE_LINE_RANGE_BYTES + 1024 // 181KB

			// Import mocked modules
			const { fileExistsAtPath } = await import("../../../utils/fs")
			const { listFiles } = await import("../../glob/list-files")
			const { loadRequiredLanguageParsers } = await import("../languageParser")
			const fs = await import("fs/promises")

			// Setup parser mocks
			const mockParser = {
				parse: vi.fn().mockReturnValue({
					rootNode: "mockNode",
				}),
			}
			const mockQuery = {
				captures: vi.fn().mockReturnValue([]),
			}

			// Setup mocks
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(listFiles).mockResolvedValue([
				["/test/dir/small-file.ts", "/test/dir/large-file.ts", "/test/dir/large-file.md"],
				[],
			] as any)
			vi.mocked(loadRequiredLanguageParsers).mockResolvedValue({
				ts: { parser: mockParser, query: mockQuery } as any,
			})

			vi.mocked(fs.stat).mockImplementation((path) => {
				if (path.toString().includes("large-file")) {
					return Promise.resolve({
						size: largeFileSize,
						isFile: () => true,
						isDirectory: () => false,
					} as any)
				}
				return Promise.resolve({
					size: smallFileSize,
					isFile: () => true,
					isDirectory: () => false,
				} as any)
			})

			vi.mocked(fs.readFile).mockImplementation((path) => {
				if (path.toString().includes("small-file")) {
					return Promise.resolve("function test() {}")
				}
				// Should not be called for large files
				throw new Error("Should not read large files")
			})

			const result = await parseSourceCodeForDefinitionsTopLevel(testDirPath)

			// Result should contain skip messages for large files
			expect(result).toContain("File too large")
			expect(result).toContain("large-file.ts")
			expect(result).toContain("large-file.md")

			// Verify fs.readFile was only called for small file
			const readFileCalls = vi.mocked(fs.readFile).mock.calls
			const largeFileCalls = readFileCalls.filter((call) => call[0].toString().includes("large-file"))
			expect(largeFileCalls.length).toBe(0)
		})

		// Note: Testing webpack/minified file truncation requires real tree-sitter parsing
		// which is difficult to mock accurately. The truncation logic is implemented in
		// parseSourceCodeDefinitionsForFile() and will trigger when actual AST parsing
		// produces output exceeding 190KB. This is verified through integration testing.
	})
})
