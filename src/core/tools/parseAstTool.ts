import path from "path"
import fs from "fs/promises"

import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { loadRequiredLanguageParsers } from "../../services/tree-sitter/languageParser"
import { fileExistsAtPath } from "../../utils/fs"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"

/**
 * Format AST node as a tree structure
 */
function formatAstTree(node: any, depth: number = 0, maxDepth?: number): string {
	if (maxDepth !== undefined && depth > maxDepth) {
		return ""
	}

	const indent = "  ".repeat(depth)
	const position = `[${node.startPosition.row}:${node.startPosition.column}-${node.endPosition.row}:${node.endPosition.column}]`
	let result = `${indent}${node.type} ${position}`

	// Add field name if available
	if (node.parent) {
		const fieldName = node.parent.fieldNameForChild(node.childIndex)
		if (fieldName) {
			result = `${indent}${fieldName}: ${node.type} ${position}`
		}
	}

	// Add text content for leaf nodes or small nodes
	if (node.childCount === 0 || node.text.length < 50) {
		const text = node.text.replace(/\n/g, "\\n").replace(/\t/g, "\\t")
		if (text.length < 100) {
			result += ` "${text}"`
		}
	}

	result += "\n"

	// Recursively format children
	for (let i = 0; i < node.childCount; i++) {
		const child = node.child(i)
		if (child) {
			result += formatAstTree(child, depth + 1, maxDepth)
		}
	}

	return result
}

/**
 * Convert AST node to JSON structure
 */
function astNodeToJson(node: any, depth: number = 0, maxDepth?: number): any {
	if (maxDepth !== undefined && depth > maxDepth) {
		return {
			type: node.type,
			truncated: true,
		}
	}

	const nodeData: any = {
		type: node.type,
		startPosition: {
			row: node.startPosition.row,
			column: node.startPosition.column,
		},
		endPosition: {
			row: node.endPosition.row,
			column: node.endPosition.column,
		},
	}

	// Add field name if available
	if (node.parent) {
		const fieldName = node.parent.fieldNameForChild(node.childIndex)
		if (fieldName) {
			nodeData.fieldName = fieldName
		}
	}

	// Add text for leaf nodes or small nodes
	if (node.childCount === 0 || node.text.length < 50) {
		nodeData.text = node.text
	}

	// Add children
	if (node.childCount > 0) {
		nodeData.children = []
		for (let i = 0; i < node.childCount; i++) {
			const child = node.child(i)
			if (child) {
				nodeData.children.push(astNodeToJson(child, depth + 1, maxDepth))
			}
		}
	}

	return nodeData
}

export async function parseAstTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relPath: string | undefined = block.params.path
	const format: string | undefined = block.params.format || "tree"
	const maxDepthStr: string | undefined = block.params.max_depth
	const maxDepth: number | undefined = maxDepthStr ? parseInt(maxDepthStr, 10) : undefined

	// Calculate if the path is outside workspace
	const absolutePath = relPath ? path.resolve(cline.cwd, relPath) : cline.cwd
	const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

	const sharedMessageProps: ClineSayTool = {
		tool: "parseAst",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relPath)),
		format: removeClosingTag("format", format),
		maxDepth: maxDepthStr ? removeClosingTag("max_depth", maxDepthStr) : undefined,
		isOutsideWorkspace,
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies ClineSayTool)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!relPath) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("parse_ast")
				pushToolResult(await cline.sayAndCreateMissingParamError("parse_ast", "path"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Check if file exists
			const fileExists = await fileExistsAtPath(absolutePath)
			if (!fileExists) {
				const errorMsg = "This file does not exist or you do not have permission to access it."
				const completeMessage = JSON.stringify({
					...sharedMessageProps,
					content: errorMsg,
				} satisfies ClineSayTool)
				const didApprove = await askApproval("tool", completeMessage)
				if (!didApprove) {
					return
				}
				pushToolResult(errorMsg)
				return
			}

			// Check if we have permission to access this file
			if (cline.rooIgnoreController && !cline.rooIgnoreController.validateAccess(absolutePath)) {
				const errorMsg = "Access to this file is restricted by .rooignore rules."
				const completeMessage = JSON.stringify({
					...sharedMessageProps,
					content: errorMsg,
				} satisfies ClineSayTool)
				const didApprove = await askApproval("tool", completeMessage)
				if (!didApprove) {
					return
				}
				pushToolResult(errorMsg)
				return
			}

			// Get file extension
			const ext = path.extname(absolutePath).toLowerCase()

			// Check if file extension is supported
			const supportedExtensions = [
				".js",
				".jsx",
				".ts",
				".tsx",
				".py",
				".rs",
				".go",
				".c",
				".h",
				".cpp",
				".hpp",
				".cs",
				".rb",
				".java",
				".php",
				".swift",
				".kt",
				".kts",
				".sol",
				".ex",
				".exs",
				".el",
				".html",
				".htm",
				".json",
				".css",
				".rdl",
				".ml",
				".mli",
				".lua",
				".scala",
				".toml",
				".zig",
				".ejs",
				".erb",
				".vb",
				".vue",
				".tla",
			]

			if (!supportedExtensions.includes(ext)) {
				const errorMsg = `Unsupported file type: ${ext}. Supported types: ${supportedExtensions.join(", ")}`
				const completeMessage = JSON.stringify({
					...sharedMessageProps,
					content: errorMsg,
				} satisfies ClineSayTool)
				const didApprove = await askApproval("tool", completeMessage)
				if (!didApprove) {
					return
				}
				pushToolResult(errorMsg)
				return
			}

			// Read file content
			const fileContent = await fs.readFile(absolutePath, "utf8")

			// Load language parser
			const languageParsers = await loadRequiredLanguageParsers([absolutePath])
			const extLang = ext.slice(1) // Remove the dot
			const { parser } = languageParsers[extLang] || {}

			if (!parser) {
				const errorMsg = `No parser available for file type: ${ext}`
				const completeMessage = JSON.stringify({
					...sharedMessageProps,
					content: errorMsg,
				} satisfies ClineSayTool)
				const didApprove = await askApproval("tool", completeMessage)
				if (!didApprove) {
					return
				}
				pushToolResult(errorMsg)
				return
			}

			// Parse the file to get AST
			const tree = parser.parse(fileContent)

			if (!tree) {
				const errorMsg = "Failed to parse file into AST"
				const completeMessage = JSON.stringify({
					...sharedMessageProps,
					content: errorMsg,
				} satisfies ClineSayTool)
				const didApprove = await askApproval("tool", completeMessage)
				if (!didApprove) {
					return
				}
				pushToolResult(errorMsg)
				return
			}

			// Format AST based on requested format
			let result: string
			if (format === "json") {
				const astJson = astNodeToJson(tree.rootNode, 0, maxDepth)
				result = JSON.stringify(astJson, null, 2)
			} else {
				// Default to tree format
				result = `AST for ${path.basename(absolutePath)}:\n\n${formatAstTree(tree.rootNode, 0, maxDepth)}`
			}

			// Truncate if result is too large (> 50000 characters)
			if (result.length > 50000) {
				result =
					result.substring(0, 50000) +
					"\n\n... (AST output truncated due to size. Consider using max_depth parameter to limit output)"
			}

			// Check if parse_ast is auto-approved
			const { alwaysAllowParseAst = false } = (await cline.providerRef.deref()?.getState()) ?? {}

			if (!alwaysAllowParseAst) {
				const completeMessage = JSON.stringify({
					...sharedMessageProps,
					content: result,
				} satisfies ClineSayTool)
				const didApprove = await askApproval("tool", completeMessage)

				if (!didApprove) {
					return
				}
			}

			// Track file context
			if (relPath) {
				await cline.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)
			}

			pushToolResult(result)
			return
		}
	} catch (error) {
		await handleError("parsing AST", error)
		return
	}
}
