import * as fs from "fs/promises"
import * as path from "path"
import { listFiles } from "../glob/list-files"
import { LanguageParser, loadRequiredLanguageParsers } from "./languageParser"
import { fileExistsAtPath } from "../../utils/fs"
import { parseMarkdown } from "./markdownParser"
import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import { QueryCapture } from "web-tree-sitter"
import { FILE_SIZE_LIMITS } from "../../core/tools/helpers/fileSizeHelpers"

// Size limits for output (in KB)
const OUTPUT_SIZE_LIMITS = {
	MIN_TARGET_KB: 180, // Minimum target size
	MAX_SAFE_KB: 190, // Maximum safe size before truncation
	MAX_LINES_IF_OVERSIZED: 1500, // Max lines to return if depth 1 is too large
}

// Private constant
const DEFAULT_MIN_COMPONENT_LINES_VALUE = 4

// Getter function for MIN_COMPONENT_LINES (for easier testing)
let currentMinComponentLines = DEFAULT_MIN_COMPONENT_LINES_VALUE

/**
 * Get the current minimum number of lines for a component to be included
 */
export function getMinComponentLines(): number {
	return currentMinComponentLines
}

/**
 * Set the minimum number of lines for a component (for testing)
 */
export function setMinComponentLines(value: number): void {
	currentMinComponentLines = value
}

const extensions = [
	"tla",
	"js",
	"jsx",
	"ts",
	"vue",
	"tsx",
	"py",
	// Rust
	"rs",
	"go",
	// C
	"c",
	"h",
	// C++
	"cpp",
	"hpp",
	// C#
	"cs",
	// Ruby
	"rb",
	"java",
	"php",
	"swift",
	// Solidity
	"sol",
	// Kotlin
	"kt",
	"kts",
	// Elixir
	"ex",
	"exs",
	// Elisp
	"el",
	// HTML
	"html",
	"htm",
	// Markdown
	"md",
	"markdown",
	// JSON
	"json",
	// CSS
	"css",
	// SystemRDL
	"rdl",
	// OCaml
	"ml",
	"mli",
	// Lua
	"lua",
	// Scala
	"scala",
	// TOML
	"toml",
	// Zig
	"zig",
	// Elm
	"elm",
	// Embedded Template
	"ejs",
	"erb",
	// Visual Basic .NET
	"vb",
].map((e) => `.${e}`)

export { extensions }

export async function parseSourceCodeDefinitionsForFile(
	filePath: string,
	rooIgnoreController?: RooIgnoreController,
): Promise<string | undefined> {
	// check if the file exists
	const fileExists = await fileExistsAtPath(path.resolve(filePath))
	if (!fileExists) {
		return "This file does not exist or you do not have permission to access it."
	}

	// Check file size before reading
	try {
		const stats = await fs.stat(filePath)
		if (stats.size > FILE_SIZE_LIMITS.FORCE_LINE_RANGE_BYTES) {
			const sizeInKB = Math.round(stats.size / 1024)
			const ext = path.extname(filePath).toLowerCase()

			// Special message for JavaScript files (likely webpack/minified)
			if (ext === ".js" || ext === ".jsx") {
				return `[⚠️ Large JavaScript file detected: ${sizeInKB} KB. This appears to be a webpack bundle or minified file.

**Recommended approach:**
This file can be automatically split into multiple smaller files (1500 lines each) for easier processing.
The system has a file splitter utility that will:
1. Split the file into manageable chunks (e.g., filename_chunk_0001.js, filename_chunk_0002.js, etc.)
2. Create a temporary directory (tmp_filename/) containing all chunks
3. Generate a README and metadata file explaining the split structure

Once split, you can:
- Use list_files on the split directory to see all chunks
- Use read_file on individual chunks
- Use search_files across all chunks

Alternatively, use search_files directly on this large file to find specific content.]`
			}

			// Standard message for other file types
			return `[File too large: ${sizeInKB} KB. This tool cannot process large files. Instead, use search_files or codebase_search to find specific content, or use read_file with line_range to read targeted sections.]`
		}
	} catch (error) {
		// If we can't stat the file, continue anyway - it will fail later with a better error
	}

	// Get file extension to determine parser
	const ext = path.extname(filePath).toLowerCase()
	// Check if the file extension is supported
	if (!extensions.includes(ext)) {
		return undefined
	}

	// Special case for markdown files
	if (ext === ".md" || ext === ".markdown") {
		// Check if we have permission to access this file
		if (rooIgnoreController && !rooIgnoreController.validateAccess(filePath)) {
			return undefined
		}

		// Check file size before reading markdown
		try {
			const stats = await fs.stat(filePath)
			if (stats.size > FILE_SIZE_LIMITS.FORCE_LINE_RANGE_BYTES) {
				const sizeInKB = Math.round(stats.size / 1024)
				return `[File too large: ${sizeInKB} KB. Use search_files to find content, or read_file with line_range for targeted reading.]`
			}
		} catch (error) {
			// Continue if stat fails
		}

		// Read file content
		const fileContent = await fs.readFile(filePath, "utf8")

		// Split the file content into individual lines
		const lines = fileContent.split("\n")

		// Parse markdown content to get captures
		const markdownCaptures = parseMarkdown(fileContent)

		// Process the captures
		const markdownDefinitions = processCaptures(markdownCaptures, lines, "markdown")

		if (markdownDefinitions) {
			return `# ${path.basename(filePath)}\n${markdownDefinitions}`
		}
		return undefined
	}

	// For other file types, load parser and use tree-sitter
	const languageParsers = await loadRequiredLanguageParsers([filePath])

	// First try standard parsing
	let definitions = await parseFile(filePath, languageParsers, rooIgnoreController, false)

	// If output is too large, retry with adaptive depth
	if (definitions) {
		const sizeInKB = getStringSizeInKB(definitions)
		console.log(`[FILE] ${path.basename(filePath)} initial size: ${sizeInKB.toFixed(2)}KB`)

		if (sizeInKB > OUTPUT_SIZE_LIMITS.MAX_SAFE_KB) {
			console.log(`[FILE] Size exceeds ${OUTPUT_SIZE_LIMITS.MAX_SAFE_KB}KB, retrying with adaptive depth...`)
			// Retry with adaptive depth parsing
			definitions = await parseFile(filePath, languageParsers, rooIgnoreController, true)

			// If still too large after adaptive parsing, force truncate
			if (definitions) {
				const newSize = getStringSizeInKB(definitions)
				if (newSize > OUTPUT_SIZE_LIMITS.MAX_SAFE_KB) {
					console.log(
						`[FILE] Still too large (${newSize.toFixed(2)}KB) after adaptive parsing, truncating...`,
					)
					const ext = path.extname(filePath).toLowerCase()
					const lines = definitions.split("\n")
					const truncated = lines.slice(0, OUTPUT_SIZE_LIMITS.MAX_LINES_IF_OVERSIZED)

					// Add file-specific suggestion for JavaScript files
					let suggestion = ""
					if (ext === ".js" || ext === ".jsx") {
						suggestion = `\n\n💡 **Tip**: This appears to be a webpack bundle or minified JavaScript file. Consider using the file splitter utility to break it into manageable 1500-line chunks for easier processing.`
					}

					definitions =
						truncated.join("\n") +
						`\n\n[⚠️ OUTPUT TRUNCATED: File parsing exceeded ${OUTPUT_SIZE_LIMITS.MAX_SAFE_KB}KB limit (${newSize.toFixed(2)}KB). Showing ${truncated.length} of ${lines.length} lines. This may be a minified/bundled file.]${suggestion}`
				}
			}
		}
	}

	// CRITICAL: Final safety check before returning - ensure we NEVER exceed MIN_TARGET_KB (180KB)
	if (definitions) {
		const header = `# ${path.basename(filePath)}\n`
		const fullOutput = header + definitions
		const finalSize = getStringSizeInKB(fullOutput)

		// If the full output (with header) exceeds 180KB, force truncate
		if (finalSize > OUTPUT_SIZE_LIMITS.MIN_TARGET_KB) {
			console.log(
				`[FILE FINAL CHECK] Output ${finalSize.toFixed(2)}KB exceeds ${OUTPUT_SIZE_LIMITS.MIN_TARGET_KB}KB limit, force truncating...`,
			)
			const lines = definitions.split("\n")
			// Calculate safe line count: aim for 175KB to leave margin
			const targetKB = OUTPUT_SIZE_LIMITS.MIN_TARGET_KB * 0.97 // 97% of limit for safety margin
			const targetLines = Math.floor((targetKB / finalSize) * lines.length)
			const safeTruncated = lines.slice(
				0,
				Math.max(100, Math.min(targetLines, OUTPUT_SIZE_LIMITS.MAX_LINES_IF_OVERSIZED)),
			)

			const ext = path.extname(filePath).toLowerCase()
			let suggestion = ""
			if (ext === ".js" || ext === ".jsx") {
				suggestion = `\n\n💡 **Tip**: This appears to be a webpack bundle or minified JavaScript file. Consider using the file splitter utility to break it into manageable 1500-line chunks for easier processing.`
			}

			definitions =
				safeTruncated.join("\n") +
				`\n\n[⚠️ FINAL OUTPUT TRUNCATED: Total output ${finalSize.toFixed(2)}KB exceeded ${OUTPUT_SIZE_LIMITS.MIN_TARGET_KB}KB limit. Showing ${safeTruncated.length} of ${lines.length} lines.]${suggestion}`
			console.log(
				`[FILE FINAL CHECK] Truncated to ${safeTruncated.length} lines, new size: ${getStringSizeInKB(header + definitions).toFixed(2)}KB`,
			)
		}

		return header + definitions
	}

	return undefined
}

// TODO: implement caching behavior to avoid having to keep analyzing project for new tasks.
export async function parseSourceCodeForDefinitionsTopLevel(
	dirPath: string,
	rooIgnoreController?: RooIgnoreController,
): Promise<string> {
	// check if the path exists
	const dirExists = await fileExistsAtPath(path.resolve(dirPath))
	if (!dirExists) {
		return "This directory does not exist or you do not have permission to access it."
	}

	// Get all files at top level (not gitignored)
	const [allFiles, _] = await listFiles(dirPath, false, 200)

	let result = ""
	let currentSizeKB = 0

	// Separate files to parse and remaining files
	const { filesToParse } = separateFiles(allFiles)

	// Filter filepaths for access if controller is provided
	const allowedFilesToParse = rooIgnoreController ? rooIgnoreController.filterPaths(filesToParse) : filesToParse

	// Separate markdown files from other files
	const markdownFiles: string[] = []
	const otherFiles: string[] = []

	for (const file of allowedFilesToParse) {
		const ext = path.extname(file).toLowerCase()
		if (ext === ".md" || ext === ".markdown") {
			markdownFiles.push(file)
		} else {
			otherFiles.push(file)
		}
	}

	// Load language parsers only for non-markdown files
	const languageParsers = await loadRequiredLanguageParsers(otherFiles)

	// Process markdown files
	for (const file of markdownFiles) {
		// Check if we have permission to access this file
		if (rooIgnoreController && !rooIgnoreController.validateAccess(file)) {
			continue
		}

		try {
			// Check file size before reading
			const stats = await fs.stat(file)
			if (stats.size > FILE_SIZE_LIMITS.FORCE_LINE_RANGE_BYTES) {
				const sizeInKB = Math.round(stats.size / 1024)
				result += `# ${path.relative(dirPath, file).toPosix()}\n[File too large: ${sizeInKB} KB. Use search_files or read_file with line_range for this file.]\n`
				continue
			}

			// Read file content
			const fileContent = await fs.readFile(file, "utf8")

			// Split the file content into individual lines
			const lines = fileContent.split("\n")

			// Parse markdown content to get captures
			const markdownCaptures = parseMarkdown(fileContent)

			// Process the captures
			const markdownDefinitions = processCaptures(markdownCaptures, lines, "markdown")

			if (markdownDefinitions) {
				result += `# ${path.relative(dirPath, file).toPosix()}\n${markdownDefinitions}\n`
			}
		} catch (error) {
			console.log(`Error parsing markdown file: ${error}\n`)
		}
	}

	// Process other files using tree-sitter
	for (const file of otherFiles) {
		// CRITICAL: Check cumulative size BEFORE processing next file
		const currentSize = getStringSizeInKB(result)
		if (currentSize > OUTPUT_SIZE_LIMITS.MIN_TARGET_KB) {
			console.log(
				`[DIR] Cumulative size ${currentSize.toFixed(2)}KB exceeds ${OUTPUT_SIZE_LIMITS.MIN_TARGET_KB}KB limit, stopping file processing`,
			)
			const remainingCount = otherFiles.length - otherFiles.indexOf(file)
			result += `\n[⚠️ Processing stopped: Output size exceeded ${OUTPUT_SIZE_LIMITS.MIN_TARGET_KB}KB limit. ${remainingCount} files not processed. Use list_code_definition_names on individual files for complete output.]\n`
			break
		}

		// First try standard parsing
		let definitions = await parseFile(file, languageParsers, rooIgnoreController, false)

		// If output is too large, retry with adaptive depth
		if (definitions) {
			const sizeInKB = getStringSizeInKB(definitions)

			if (sizeInKB > OUTPUT_SIZE_LIMITS.MAX_SAFE_KB) {
				console.log(
					`[DIR] File ${path.basename(file)} size ${sizeInKB.toFixed(2)}KB exceeds limit, retrying with adaptive depth`,
				)
				// Retry with adaptive depth parsing
				definitions = await parseFile(file, languageParsers, rooIgnoreController, true)

				// If still too large, truncate
				if (definitions) {
					const newSize = getStringSizeInKB(definitions)
					if (newSize > OUTPUT_SIZE_LIMITS.MAX_SAFE_KB) {
						console.log(`[DIR] Still too large (${newSize.toFixed(2)}KB), truncating`)
						const lines = definitions.split("\n")
						const truncated = lines.slice(0, OUTPUT_SIZE_LIMITS.MAX_LINES_IF_OVERSIZED)
						definitions = truncated.join("\n") + `\n[⚠️ OUTPUT TRUNCATED for this file]\n`
					}
				}
			}

			// CRITICAL: Check if adding this file would exceed cumulative limit
			if (definitions) {
				const fileHeader = `# ${path.relative(dirPath, file).toPosix()}\n`
				const fileOutput = fileHeader + definitions + "\n"
				const projectedSize = getStringSizeInKB(result + fileOutput)

				// If adding this file would exceed limit, stop here
				if (projectedSize > OUTPUT_SIZE_LIMITS.MIN_TARGET_KB) {
					console.log(
						`[DIR] Adding file ${path.basename(file)} would exceed limit (${projectedSize.toFixed(2)}KB > ${OUTPUT_SIZE_LIMITS.MIN_TARGET_KB}KB), stopping`,
					)
					const remainingCount = otherFiles.length - otherFiles.indexOf(file)
					result += `\n[⚠️ Processing stopped: Adding next file would exceed ${OUTPUT_SIZE_LIMITS.MIN_TARGET_KB}KB limit. ${remainingCount} files not processed. Use list_code_definition_names on individual files for complete output.]\n`
					break
				}

				result += fileOutput
			}
		}
	}

	// CRITICAL FINAL SAFETY CHECK: Force truncate if result exceeds limit
	// This is the last line of defense to ensure we never return >180KB
	if (result) {
		const finalSizeKB = getStringSizeInKB(result)
		console.log(`[FINAL CHECK] Total output size: ${finalSizeKB.toFixed(2)}KB`)

		if (finalSizeKB > OUTPUT_SIZE_LIMITS.MIN_TARGET_KB) {
			console.log(
				`[FINAL CHECK] EXCEEDED ${OUTPUT_SIZE_LIMITS.MIN_TARGET_KB}KB LIMIT! Truncating from ${finalSizeKB.toFixed(2)}KB...`,
			)
			// Calculate how many lines to keep to stay under limit
			const lines = result.split("\n")
			const targetLines = Math.floor((OUTPUT_SIZE_LIMITS.MIN_TARGET_KB / finalSizeKB) * lines.length * 0.95) // 95% safety margin
			const truncatedLines = lines.slice(
				0,
				Math.max(100, Math.min(targetLines, OUTPUT_SIZE_LIMITS.MAX_LINES_IF_OVERSIZED)),
			)
			result =
				truncatedLines.join("\n") +
				`\n\n[⚠️ OUTPUT TRUNCATED: Original size ${finalSizeKB.toFixed(2)}KB exceeded ${OUTPUT_SIZE_LIMITS.MIN_TARGET_KB}KB limit. Showing ${truncatedLines.length} of ${lines.length} lines. Use list_code_definition_names on individual files for complete output.]`
			console.log(
				`[FINAL CHECK] Truncated to ${truncatedLines.length} lines, new size: ${getStringSizeInKB(result).toFixed(2)}KB`,
			)
		}
	}

	return result ? result : "No source code definitions found."
}

function separateFiles(allFiles: string[]): { filesToParse: string[]; remainingFiles: string[] } {
	const filesToParse = allFiles.filter((file) => extensions.includes(path.extname(file))).slice(0, 50) // 50 files max
	const remainingFiles = allFiles.filter((file) => !filesToParse.includes(file))
	return { filesToParse, remainingFiles }
}

/*
Parsing files using tree-sitter

1. Parse the file content into an AST (Abstract Syntax Tree) using the appropriate language grammar (set of rules that define how the components of a language like keywords, expressions, and statements can be combined to create valid programs).
2. Create a query using a language-specific query string, and run it against the AST's root node to capture specific syntax elements.
    - We use tag queries to identify named entities in a program, and then use a syntax capture to label the entity and its name. A notable example of this is GitHub's search-based code navigation.
	- Our custom tag queries are based on tree-sitter's default tag queries, but modified to only capture definitions.
3. Sort the captures by their position in the file, output the name of the definition, and format by i.e. adding "|----\n" for gaps between captured sections.

This approach allows us to focus on the most relevant parts of the code (defined by our language-specific queries) and provides a concise yet informative view of the file's structure and key elements.

- https://github.com/tree-sitter/node-tree-sitter/blob/master/test/query_test.js
- https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/test/query-test.js
- https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/test/helper.js
- https://tree-sitter.github.io/tree-sitter/code-navigation-systems
*/
/**
 * Parse a file and extract code definitions using tree-sitter
 *
 * @param filePath - Path to the file to parse
 * @param languageParsers - Map of language parsers
 * @param rooIgnoreController - Optional controller to check file access permissions
 * @returns A formatted string with code definitions or null if no definitions found
 */

/**
 * Calculate the approximate size of a string in KB
 */
function getStringSizeInKB(str: string): number {
	// Calculate actual size in bytes using Buffer (more accurate than estimation)
	const bytes = Buffer.byteLength(str, "utf8")
	const kb = bytes / 1024
	console.log(`[SIZE CHECK] String length: ${str.length} chars, Bytes: ${bytes}, KB: ${kb.toFixed(2)}`)
	return kb
}

/**
 * Format AST with adaptive depth control to manage output size
 * Starts with depth 1 and increases until reaching optimal size or max depth
 *
 * @param filePath - Path to the file to parse
 * @param languageParsers - Map of language parsers
 * @param maxDepthLimit - Maximum depth to try (default: 10)
 * @returns Formatted AST string with appropriate depth
 */
async function parseFileWithAdaptiveDepth(
	filePath: string,
	languageParsers: LanguageParser,
	maxDepthLimit: number = 10,
): Promise<string | null> {
	try {
		// Read file content
		const fileContent = await fs.readFile(filePath, "utf8")
		const extLang = path.extname(filePath).toLowerCase().slice(1)

		// Check if we have a parser for this file type
		const { parser } = languageParsers[extLang] || {}
		if (!parser) {
			return null
		}

		// Parse the file content into an AST
		const tree = parser.parse(fileContent)
		if (!tree) {
			return null
		}

		const lines = fileContent.split("\n")
		let currentDepth = 1
		let bestResult: string | null = null
		let bestSize = 0

		// Try increasing depths until we reach optimal size or max depth
		while (currentDepth <= maxDepthLimit) {
			// Format AST at current depth
			const astOutput = formatAstTreeForDefinitions(tree.rootNode, 0, currentDepth, lines)
			const sizeInKB = getStringSizeInKB(astOutput)

			// If depth 1 already exceeds max safe size, truncate to max lines
			if (currentDepth === 1 && sizeInKB > OUTPUT_SIZE_LIMITS.MAX_SAFE_KB) {
				const truncatedLines = astOutput.split("\n").slice(0, OUTPUT_SIZE_LIMITS.MAX_LINES_IF_OVERSIZED)
				return (
					truncatedLines.join("\n") +
					`\n\n[Output truncated: depth 1 exceeded ${OUTPUT_SIZE_LIMITS.MAX_SAFE_KB}KB. Showing first ${OUTPUT_SIZE_LIMITS.MAX_LINES_IF_OVERSIZED} lines only]`
				)
			}

			// Store this result
			bestResult = astOutput
			bestSize = sizeInKB

			// If we've exceeded max safe size, return previous best result
			if (sizeInKB > OUTPUT_SIZE_LIMITS.MAX_SAFE_KB) {
				// Return the result from previous depth if available
				if (currentDepth > 1) {
					return bestResult
				}
				break
			}

			// If we've reached target size, we can continue to next depth
			// to see if we can get more detail without exceeding max
			if (sizeInKB >= OUTPUT_SIZE_LIMITS.MIN_TARGET_KB) {
				// Try one more depth to see if it still fits
				currentDepth++
				if (currentDepth > maxDepthLimit) {
					break
				}
				const nextAstOutput = formatAstTreeForDefinitions(tree.rootNode, 0, currentDepth, lines)
				const nextSize = getStringSizeInKB(nextAstOutput)

				if (nextSize <= OUTPUT_SIZE_LIMITS.MAX_SAFE_KB) {
					bestResult = nextAstOutput
					bestSize = nextSize
				}
				break
			}

			currentDepth++
		}

		return bestResult
	} catch (error) {
		console.log(`Error in adaptive depth parsing: ${error}`)
		return null
	}
}

/**
 * Format AST node as a simplified definition structure
 * Optimized for code definitions rather than full AST tree
 */
function formatAstTreeForDefinitions(node: any, depth: number, maxDepth: number, lines: string[]): string {
	if (depth > maxDepth) {
		return ""
	}

	let result = ""
	const nodeType = node.type

	// Focus on definition nodes and important structural nodes
	const isDefinitionNode =
		nodeType.includes("declaration") ||
		nodeType.includes("definition") ||
		nodeType.includes("statement") ||
		nodeType.includes("class") ||
		nodeType.includes("function") ||
		nodeType.includes("method") ||
		nodeType.includes("interface") ||
		nodeType.includes("struct") ||
		nodeType.includes("enum") ||
		nodeType.includes("module") ||
		nodeType.includes("import") ||
		nodeType.includes("export")

	if (isDefinitionNode || depth === 0) {
		const startLine = node.startPosition.row
		const endLine = node.endPosition.row
		const indent = "  ".repeat(depth)

		// Get the first line of code for this node
		const firstLineText = lines[startLine] ? lines[startLine].trim() : ""

		if (firstLineText) {
			result += `${indent}${startLine + 1}--${endLine + 1} | ${nodeType}: ${firstLineText}\n`
		}
	}

	// Recursively process children
	for (let i = 0; i < node.childCount; i++) {
		const child = node.child(i)
		if (child) {
			result += formatAstTreeForDefinitions(child, depth + 1, maxDepth, lines)
		}
	}

	return result
}

/**
 * Process captures from tree-sitter or markdown parser
 *
 * @param captures - The captures to process
 * @param lines - The lines of the file
 * @param language - The language of the file
 * @returns A formatted string with definitions
 */
function processCaptures(captures: QueryCapture[], lines: string[], language: string): string | null {
	// Determine if HTML filtering is needed for this language
	const needsHtmlFiltering = ["jsx", "tsx"].includes(language)

	// Filter function to exclude HTML elements if needed
	const isNotHtmlElement = (line: string): boolean => {
		if (!needsHtmlFiltering) return true
		// Common HTML elements pattern
		const HTML_ELEMENTS = /^[^A-Z]*<\/?(?:div|span|button|input|h[1-6]|p|a|img|ul|li|form)\b/
		const trimmedLine = line.trim()
		return !HTML_ELEMENTS.test(trimmedLine)
	}

	// No definitions found
	if (captures.length === 0) {
		return null
	}

	let formattedOutput = ""

	// Sort captures by their start position
	captures.sort((a, b) => a.node.startPosition.row - b.node.startPosition.row)

	// Track already processed lines to avoid duplicates
	const processedLines = new Set<string>()

	// First pass - categorize captures by type
	captures.forEach((capture) => {
		const { node, name } = capture

		// Skip captures that don't represent definitions
		if (!name.includes("definition") && !name.includes("name")) {
			return
		}

		// Get the parent node that contains the full definition
		const definitionNode = name.includes("name") ? node.parent : node
		if (!definitionNode) return

		// Get the start and end lines of the full definition
		const startLine = definitionNode.startPosition.row
		const endLine = definitionNode.endPosition.row
		const lineCount = endLine - startLine + 1

		// Skip components that don't span enough lines
		if (lineCount < getMinComponentLines()) {
			return
		}

		// Create unique key for this definition based on line range
		// This ensures we don't output the same line range multiple times
		const lineKey = `${startLine}-${endLine}`

		// Skip already processed lines
		if (processedLines.has(lineKey)) {
			return
		}

		// Check if this is a valid component definition (not an HTML element)
		const startLineContent = lines[startLine].trim()

		// Special handling for component name definitions
		if (name.includes("name.definition")) {
			// Extract component name
			const componentName = node.text

			// Add component name to output regardless of HTML filtering
			if (!processedLines.has(lineKey) && componentName) {
				formattedOutput += `${startLine + 1}--${endLine + 1} | ${lines[startLine]}\n`
				processedLines.add(lineKey)
			}
		}
		// For other component definitions
		else if (isNotHtmlElement(startLineContent)) {
			formattedOutput += `${startLine + 1}--${endLine + 1} | ${lines[startLine]}\n`
			processedLines.add(lineKey)

			// If this is part of a larger definition, include its non-HTML context
			if (node.parent && node.parent.lastChild) {
				const contextEnd = node.parent.lastChild.endPosition.row
				const contextSpan = contextEnd - node.parent.startPosition.row + 1

				// Only include context if it spans multiple lines
				if (contextSpan >= getMinComponentLines()) {
					// Add the full range first
					const rangeKey = `${node.parent.startPosition.row}-${contextEnd}`
					if (!processedLines.has(rangeKey)) {
						formattedOutput += `${node.parent.startPosition.row + 1}--${contextEnd + 1} | ${lines[node.parent.startPosition.row]}\n`
						processedLines.add(rangeKey)
					}
				}
			}
		}
	})

	if (formattedOutput.length > 0) {
		return formattedOutput
	}

	return null
}

/**
 * Parse a file and extract code definitions using tree-sitter
 *
 * @param filePath - Path to the file to parse
 * @param languageParsers - Map of language parsers
 * @param rooIgnoreController - Optional controller to check file access permissions
 * @param useAdaptiveDepth - Whether to use adaptive depth parsing for large outputs
 * @returns A formatted string with code definitions or null if no definitions found
 */
async function parseFile(
	filePath: string,
	languageParsers: LanguageParser,
	rooIgnoreController?: RooIgnoreController,
	useAdaptiveDepth: boolean = false,
): Promise<string | null> {
	// Check if we have permission to access this file
	if (rooIgnoreController && !rooIgnoreController.validateAccess(filePath)) {
		return null
	}

	// Check file size before reading
	try {
		const stats = await fs.stat(filePath)
		if (stats.size > FILE_SIZE_LIMITS.FORCE_LINE_RANGE_BYTES) {
			const sizeInKB = Math.round(stats.size / 1024)
			return `[File too large: ${sizeInKB} KB. Use search_files to find content in this file.]`
		}
	} catch (error) {
		// If we can't stat the file, continue anyway - it will fail later
	}

	// If adaptive depth is requested, use the new parsing method
	if (useAdaptiveDepth) {
		return await parseFileWithAdaptiveDepth(filePath, languageParsers)
	}

	// Read file content
	const fileContent = await fs.readFile(filePath, "utf8")
	const extLang = path.extname(filePath).toLowerCase().slice(1)

	// Check if we have a parser for this file type
	const { parser, query } = languageParsers[extLang] || {}
	if (!parser || !query) {
		return `Unsupported file type: ${filePath}`
	}

	try {
		// Parse the file content into an Abstract Syntax Tree (AST)
		const tree = parser.parse(fileContent)

		// Apply the query to the AST and get the captures
		const captures = tree ? query.captures(tree.rootNode) : []

		// Split the file content into individual lines
		const lines = fileContent.split("\n")

		// Process the captures
		return processCaptures(captures, lines, extLang)
	} catch (error) {
		console.log(`Error parsing file: ${error}\n`)
		// Return null on parsing error to avoid showing error messages in the output
		return null
	}
}
