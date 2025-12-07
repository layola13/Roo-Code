import { ToolArgs } from "./types"

export function getSplitFileDescription(args: ToolArgs): string {
	return `## split_file
Description: Request to split a large file into multiple smaller chunk files. This tool is designed specifically for handling large files (especially webpack-compressed/minified JavaScript files over 180 KB) that cannot be read in a single operation.

**IMPORTANT: For webpack/minified files, you MUST use this tool instead of manual PowerShell/bash commands.**

Parameters:
- path: (required) The path of the large file to split (relative to the current workspace directory)
- lines_per_chunk: (optional) Number of lines per chunk file. Defaults to 1500. Recommended values: 1000-1500 for webpack/minified files, 500-1000 for regular code.

Usage:
<split_file>
<path>File path here</path>
<lines_per_chunk>Number of lines per chunk (optional, default: 1500)</lines_per_chunk>
</split_file>

Example: Splitting a webpack chunk file with default settings
<split_file>
<path>js/chunk-5ccb90cc.59e0567b.js</path>
</split_file>

Example: Custom chunk size for very large files
<split_file>
<path>dist/bundle.min.js</path>
<lines_per_chunk>1000</lines_per_chunk>
</split_file>

**After splitting, use list_files to see the chunks, then read_file on individual chunks.**`
}
