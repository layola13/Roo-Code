import path from "path"
import fs from "fs/promises"
import { createReadStream } from "fs"
import { createInterface } from "readline"
import { FILE_SIZE_LIMITS } from "./fileSizeHelpers"

/**
 * File splitter configuration
 */
export interface FileSplitterConfig {
	/** Maximum lines per chunk file (default: 1500) */
	maxLinesPerChunk?: number
	/** Base directory for temporary split files (default: workspace root) */
	baseDir?: string
}

/**
 * Result of file splitting operation
 */
export interface FileSplitResult {
	/** Whether the file was split */
	wasSplit: boolean
	/** Path to the temporary directory containing split files */
	splitDir?: string
	/** Array of split file paths relative to splitDir */
	chunkFiles?: string[]
	/** Total number of lines in the original file */
	totalLines?: number
	/** Number of chunks created */
	chunkCount?: number
	/** Error message if split failed */
	error?: string
}

/**
 * Check if a file should be split based on size threshold
 * @param filePath - Full path to the file
 * @returns True if file should be split
 */
export async function shouldSplitFile(filePath: string): Promise<boolean> {
	try {
		const stats = await fs.stat(filePath)
		// Split files larger than 180KB
		return stats.size > FILE_SIZE_LIMITS.FORCE_LINE_RANGE_BYTES
	} catch (error) {
		return false
	}
}

/**
 * Split a large file into smaller chunks in a temporary directory
 * @param filePath - Full path to the file to split
 * @param config - Configuration options
 * @returns Result of split operation
 */
export async function splitLargeFile(filePath: string, config: FileSplitterConfig = {}): Promise<FileSplitResult> {
	const { maxLinesPerChunk = FILE_SIZE_LIMITS.MAX_LINES_PER_READ, baseDir = path.dirname(filePath) } = config

	try {
		const fileName = path.basename(filePath)
		const fileExt = path.extname(fileName)
		const fileBaseName = path.basename(fileName, fileExt)

		// Create temporary directory with pattern: tmp_<filename>
		const splitDir = path.join(baseDir, `tmp_${fileBaseName}`)

		// Clean up existing split directory if it exists
		try {
			await fs.rm(splitDir, { recursive: true, force: true })
		} catch (error) {
			// Ignore errors if directory doesn't exist
		}

		// Create the split directory
		await fs.mkdir(splitDir, { recursive: true })

		// Split the file into chunks
		const chunkFiles: string[] = []
		let currentChunk: string[] = []
		let chunkIndex = 0
		let totalLines = 0

		// Create readline interface for streaming read
		const fileStream = createReadStream(filePath, { encoding: "utf-8" })
		const rl = createInterface({
			input: fileStream,
			crlfDelay: Infinity,
		})

		// Process file line by line
		for await (const line of rl) {
			currentChunk.push(line)
			totalLines++

			if (currentChunk.length >= maxLinesPerChunk) {
				const chunkFileName = await writeChunk(splitDir, fileBaseName, fileExt, chunkIndex, currentChunk)
				chunkFiles.push(chunkFileName)
				currentChunk = []
				chunkIndex++
			}
		}

		// Write remaining lines if any
		if (currentChunk.length > 0) {
			const chunkFileName = await writeChunk(splitDir, fileBaseName, fileExt, chunkIndex, currentChunk)
			chunkFiles.push(chunkFileName)
			chunkIndex++
		}

		// Create a metadata file with split information
		const metadata = {
			originalFile: filePath,
			originalFileName: fileName,
			totalLines,
			chunkCount: chunkFiles.length,
			maxLinesPerChunk,
			chunks: chunkFiles.map((file, idx) => ({
				file,
				startLine: idx * maxLinesPerChunk + 1,
				endLine: Math.min((idx + 1) * maxLinesPerChunk, totalLines),
			})),
			createdAt: new Date().toISOString(),
		}

		await fs.writeFile(path.join(splitDir, "split_metadata.json"), JSON.stringify(metadata, null, 2), "utf-8")

		// Create a README file explaining the structure
		const readmeContent = `# Split File Directory

This directory contains the split chunks of the original file: ${fileName}

## Original File
- Path: ${filePath}
- Total Lines: ${totalLines}
- Split into: ${chunkFiles.length} chunks
- Max lines per chunk: ${maxLinesPerChunk}

## Chunk Files
${chunkFiles
	.map((file, idx) => {
		const startLine = idx * maxLinesPerChunk + 1
		const endLine = Math.min((idx + 1) * maxLinesPerChunk, totalLines)
		return `- ${file}: Lines ${startLine}-${endLine}`
	})
	.join("\n")}

## Usage
You can now use search_files, list_files, or read_file on individual chunks within this directory.
Each chunk is a standard text file that can be read normally.

## Cleanup
This is a temporary directory. It can be safely deleted when no longer needed.
`

		await fs.writeFile(path.join(splitDir, "README.md"), readmeContent, "utf-8")

		return {
			wasSplit: true,
			splitDir,
			chunkFiles,
			totalLines,
			chunkCount: chunkFiles.length,
		}
	} catch (error) {
		return {
			wasSplit: false,
			error: `Failed to split file: ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}

/**
 * Write a chunk of lines to a file
 * @param splitDir - Directory to write chunk to
 * @param baseName - Base name of original file
 * @param ext - File extension
 * @param chunkIndex - Index of this chunk
 * @param lines - Lines to write
 * @returns Name of the created chunk file
 */
async function writeChunk(
	splitDir: string,
	baseName: string,
	ext: string,
	chunkIndex: number,
	lines: string[],
): Promise<string> {
	const chunkFileName = `${baseName}_chunk_${String(chunkIndex + 1).padStart(4, "0")}${ext}`
	const chunkFilePath = path.join(splitDir, chunkFileName)
	await fs.writeFile(chunkFilePath, lines.join("\n"), "utf-8")
	return chunkFileName
}

/**
 * Clean up split directory for a file
 * @param filePath - Original file path
 * @param baseDir - Base directory where split directory was created
 */
export async function cleanupSplitFiles(filePath: string, baseDir?: string): Promise<void> {
	const fileName = path.basename(filePath)
	const fileExt = path.extname(fileName)
	const fileBaseName = path.basename(fileName, fileExt)
	const splitDir = path.join(baseDir || path.dirname(filePath), `tmp_${fileBaseName}`)

	try {
		await fs.rm(splitDir, { recursive: true, force: true })
	} catch (error) {
		// Ignore errors - directory may not exist
	}
}

/**
 * Check if a split directory exists for a file
 * @param filePath - Original file path
 * @param baseDir - Base directory to check
 * @returns True if split directory exists
 */
export async function hasSplitDirectory(filePath: string, baseDir?: string): Promise<boolean> {
	const fileName = path.basename(filePath)
	const fileExt = path.extname(fileName)
	const fileBaseName = path.basename(fileName, fileExt)
	const splitDir = path.join(baseDir || path.dirname(filePath), `tmp_${fileBaseName}`)

	try {
		const stats = await fs.stat(splitDir)
		return stats.isDirectory()
	} catch (error) {
		return false
	}
}

/**
 * Get split directory path for a file
 * @param filePath - Original file path
 * @param baseDir - Base directory
 * @returns Path to split directory
 */
export function getSplitDirectoryPath(filePath: string, baseDir?: string): string {
	const fileName = path.basename(filePath)
	const fileExt = path.extname(fileName)
	const fileBaseName = path.basename(fileName, fileExt)
	return path.join(baseDir || path.dirname(filePath), `tmp_${fileBaseName}`)
}
