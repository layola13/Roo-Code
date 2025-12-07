import fs from "fs/promises"

/**
 * File size thresholds and limits for read_file operations
 */
export const FILE_SIZE_LIMITS = {
	// Single file limits
	SINGLE_FILE_WARNING_BYTES: 100 * 1024, // 100 KB - show warning
	SINGLE_FILE_MAX_BYTES: 1024 * 1024, // 1 MB - hard limit for single file

	// Batch read limits
	BATCH_TOTAL_WARNING_BYTES: 500 * 1024, // 500 KB - show warning for batch
	BATCH_TOTAL_MAX_BYTES: 2 * 1024 * 1024, // 2 MB - hard limit for batch total

	// Force line_range usage threshold
	FORCE_LINE_RANGE_BYTES: 180 * 1024, // 180 KB - must use line_range for files larger than this

	// Line range limits
	MAX_LINES_PER_READ: 1500, // Maximum lines that can be read in a single line_range

	// Lines per chunk when splitting files
	DEFAULT_LINES_PER_CHUNK: 100, // Default lines per chunk for webpack/minified files

	// Token estimation (rough approximation: 1 token ≈ 4 bytes)
	BYTES_PER_TOKEN: 4,
} as const

/**
 * File size check result
 */
export interface FileSizeCheckResult {
	sizeInBytes: number
	estimatedTokens: number
	shouldWarn: boolean
	shouldBlock: boolean
	warningMessage?: string
	errorMessage?: string
}

/**
 * Batch file size check result
 */
export interface BatchFileSizeCheckResult {
	totalSizeInBytes: number
	totalEstimatedTokens: number
	fileResults: Map<string, FileSizeCheckResult>
	shouldWarn: boolean
	shouldBlock: boolean
	warningMessage?: string
	errorMessage?: string
}

/**
 * Check if a single file's size is within acceptable limits
 * @param filePath - Full path to the file
 * @param skipForceLineRangeCheck - Skip the 180KB force line_range check (used by batch checker)
 * @returns File size check result
 */
export async function checkFileSizeForRead(
	filePath: string,
	skipForceLineRangeCheck: boolean = false,
): Promise<FileSizeCheckResult> {
	const stats = await fs.stat(filePath)
	const sizeInBytes = stats.size
	const estimatedTokens = Math.ceil(sizeInBytes / FILE_SIZE_LIMITS.BYTES_PER_TOKEN)

	// PRIORITY CHECK: Files exceeding 180KB should use line_range or be split
	// This check should happen BEFORE the 1MB hard limit
	// Skip this check in batch validation to let readFileTool handle it properly
	if (!skipForceLineRangeCheck && sizeInBytes > FILE_SIZE_LIMITS.FORCE_LINE_RANGE_BYTES) {
		// Don't block here - let the readFileTool handle this with detailed split instructions
		return {
			sizeInBytes,
			estimatedTokens,
			shouldWarn: false,
			shouldBlock: false, // Let readFileTool handle the error message
			errorMessage: `File requires line_range or splitting (${formatBytes(sizeInBytes)})`,
		}
	}

	// Check if file exceeds hard limit (only applies when line_range is used or file is small)
	if (sizeInBytes > FILE_SIZE_LIMITS.SINGLE_FILE_MAX_BYTES) {
		return {
			sizeInBytes,
			estimatedTokens,
			shouldWarn: false,
			shouldBlock: true,
			errorMessage: `File size (${formatBytes(sizeInBytes)}, ~${estimatedTokens.toLocaleString()} tokens) exceeds maximum allowed size (${formatBytes(FILE_SIZE_LIMITS.SINGLE_FILE_MAX_BYTES)}). Consider using line_range to read specific sections, or use list_code_definition_names to get an overview first.`,
		}
	}

	// Check if file should trigger warning
	if (sizeInBytes > FILE_SIZE_LIMITS.SINGLE_FILE_WARNING_BYTES) {
		return {
			sizeInBytes,
			estimatedTokens,
			shouldWarn: true,
			shouldBlock: false,
			warningMessage: `⚠️ Large file warning: This file is ${formatBytes(sizeInBytes)} (~${estimatedTokens.toLocaleString()} tokens). Reading it will consume significant context. Consider using line_range to read specific sections, or list_code_definition_names to get an overview first.`,
		}
	}

	// File size is acceptable
	return {
		sizeInBytes,
		estimatedTokens,
		shouldWarn: false,
		shouldBlock: false,
	}
}

/**
 * Check batch file read operation for total size limits
 * @param filePaths - Array of full file paths to check
 * @returns Batch file size check result
 */
export async function checkBatchFileSizeForRead(filePaths: string[]): Promise<BatchFileSizeCheckResult> {
	const fileResults = new Map<string, FileSizeCheckResult>()
	let totalSizeInBytes = 0
	let totalEstimatedTokens = 0
	let hasBlockedFile = false
	let hasWarningFile = false

	// Check each file individually - skip the 180KB check here as readFileTool will handle it
	for (const filePath of filePaths) {
		try {
			const result = await checkFileSizeForRead(filePath, true) // Skip force line_range check
			fileResults.set(filePath, result)

			if (result.shouldBlock) {
				hasBlockedFile = true
			}
			if (result.shouldWarn) {
				hasWarningFile = true
			}

			totalSizeInBytes += result.sizeInBytes
			totalEstimatedTokens += result.estimatedTokens
		} catch (error) {
			// Skip files that can't be accessed - they'll error in the normal read flow
			continue
		}
	}

	// If any individual file is blocked (>1MB without line_range), block the entire batch
	if (hasBlockedFile) {
		const blockedFiles = Array.from(fileResults.entries())
			.filter(([, result]) => result.shouldBlock)
			.map(([path]) => path)

		return {
			totalSizeInBytes,
			totalEstimatedTokens,
			fileResults,
			shouldWarn: false,
			shouldBlock: true,
			errorMessage: `Cannot read batch: ${blockedFiles.length} file(s) exceed maximum size limit (1 MB). Files over 180 KB must use line_range, and files over 1 MB cannot be read without line_range.`,
		}
	}

	// Check if batch total exceeds hard limit
	if (totalSizeInBytes > FILE_SIZE_LIMITS.BATCH_TOTAL_MAX_BYTES) {
		return {
			totalSizeInBytes,
			totalEstimatedTokens,
			fileResults,
			shouldWarn: false,
			shouldBlock: true,
			errorMessage: `Total batch size (${formatBytes(totalSizeInBytes)}, ~${totalEstimatedTokens.toLocaleString()} tokens) exceeds maximum allowed batch size (${formatBytes(FILE_SIZE_LIMITS.BATCH_TOTAL_MAX_BYTES)}). Please read fewer files at once, or use line_range to read specific sections.`,
		}
	}

	// Check if batch total should trigger warning
	if (totalSizeInBytes > FILE_SIZE_LIMITS.BATCH_TOTAL_WARNING_BYTES || hasWarningFile) {
		return {
			totalSizeInBytes,
			totalEstimatedTokens,
			fileResults,
			shouldWarn: true,
			shouldBlock: false,
			warningMessage: `⚠️ Large batch warning: Reading ${filePaths.length} files totaling ${formatBytes(totalSizeInBytes)} (~${totalEstimatedTokens.toLocaleString()} tokens) will consume significant context. Consider reading fewer files at once or using line_range for large files.`,
		}
	}

	// Batch size is acceptable
	return {
		totalSizeInBytes,
		totalEstimatedTokens,
		fileResults,
		shouldWarn: false,
		shouldBlock: false,
	}
}

/**
 * Validate line range constraints
 * @param startLine - Starting line number (1-based)
 * @param endLine - Ending line number (1-based, inclusive)
 * @returns Validation result with error message if invalid
 */
export function validateLineRange(
	startLine: number,
	endLine: number,
): {
	isValid: boolean
	errorMessage?: string
} {
	const lineCount = endLine - startLine + 1

	if (lineCount > FILE_SIZE_LIMITS.MAX_LINES_PER_READ) {
		return {
			isValid: false,
			errorMessage: `Line range too large: ${lineCount} lines requested, but maximum is ${FILE_SIZE_LIMITS.MAX_LINES_PER_READ} lines per read. Please split into smaller ranges.`,
		}
	}

	return { isValid: true }
}

/**
 * Format bytes to human-readable string
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B"

	const units = ["B", "KB", "MB", "GB"]
	const k = 1024
	const i = Math.floor(Math.log(bytes) / Math.log(k))

	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
}
