import path from "path"

import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { getReadablePath } from "../../utils/path"
import { splitLargeFile, getSplitDirectoryPath, FileSplitResult } from "./helpers/fileSplitter"
import { FILE_SIZE_LIMITS } from "./helpers/fileSizeHelpers"

export function getSplitFileToolDescription(blockName: string, blockParams: any): string {
	const filePath = blockParams.path
	if (filePath) {
		return `[${blockName} for '${filePath}']`
	}
	return `[${blockName}]`
}

export async function splitFileTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	_removeClosingTag: RemoveClosingTag,
) {
	const filePath: string | undefined = block.params.path
	const linesPerChunk: number = block.params.lines_per_chunk ? parseInt(block.params.lines_per_chunk, 10) : 1500 // Default to 1500 lines for webpack/minified files

	// Handle partial message
	if (block.partial) {
		const fullPath = filePath ? path.resolve(cline.cwd, filePath) : ""
		const sharedMessageProps: ClineSayTool = {
			tool: "splitFile",
			path: getReadablePath(cline.cwd, filePath || ""),
			isOutsideWorkspace: filePath ? isPathOutsideWorkspace(fullPath) : false,
		}
		const partialMessage = JSON.stringify(sharedMessageProps)
		await cline.ask("tool", partialMessage, block.partial).catch(() => {})
		return
	}

	// Validate required parameters
	if (!filePath) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("split_file")
		const errorMsg = await cline.sayAndCreateMissingParamError("split_file", "path")
		pushToolResult(`<split_result><error>${errorMsg}</error></split_result>`)
		return
	}

	const fullPath = path.resolve(cline.cwd, filePath)
	const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

	// 🔑 检查 alwaysAllowSplitFile 设置
	const { alwaysAllowSplitFile = false } = (await cline.providerRef.deref()?.getState()) ?? {}

	// Ask for approval (skip if alwaysAllowSplitFile is enabled)
	const completeMessage = JSON.stringify({
		tool: "splitFile",
		path: getReadablePath(cline.cwd, filePath),
		isOutsideWorkspace,
		content: `Split file into chunks of ${linesPerChunk} lines`,
	} satisfies ClineSayTool)

	let userText: string | undefined
	let userImages: string[] | undefined

	if (!alwaysAllowSplitFile) {
		// 需要用户批准
		const { response, text, images } = await cline.ask("tool", completeMessage, false)

		if (response !== "yesButtonClicked") {
			if (text) {
				await cline.say("user_feedback", text, images)
			}
			cline.didRejectTool = true
			const deniedMessage = text ? formatResponse.toolDeniedWithFeedback(text) : formatResponse.toolDenied()
			pushToolResult(`<split_result><status>Denied by user</status></split_result>`)
			return
		}
		userText = text
		userImages = images
	} else {
		// 自动批准 - 不需要显示消息或等待用户响应，直接继续执行
		// 注意：在自动批准模式下，我们跳过用户交互，直接进行文件分割操作
	}

	if (userText) {
		await cline.say("user_feedback", userText, userImages)
	}

	// Perform the split operation
	try {
		const result: FileSplitResult = await splitLargeFile(fullPath, {
			maxLinesPerChunk: linesPerChunk,
			baseDir: cline.cwd,
		})

		if (result.wasSplit) {
			const relativeSplitDir = path.relative(cline.cwd, result.splitDir!)
			const successMessage = `<split_result>
<success>true</success>
<original_file>${filePath}</original_file>
<total_lines>${result.totalLines}</total_lines>
<chunk_count>${result.chunkCount}</chunk_count>
<lines_per_chunk>${linesPerChunk}</lines_per_chunk>
<split_directory>${relativeSplitDir}</split_directory>
<chunks>${result.chunkFiles?.join(", ")}</chunks>
<message>File successfully split into ${result.chunkCount} chunks. You can now use list_files, search_files, or read_file on individual chunks in ${relativeSplitDir}/</message>
</split_result>`

			pushToolResult(successMessage)
		} else {
			const errorMsg = result.error || "Unknown error occurred during file split"
			await handleError(`splitting file ${filePath}`, new Error(errorMsg))
			pushToolResult(`<split_result><error>${errorMsg}</error></split_result>`)
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error)
		await handleError(`splitting file ${filePath}`, error instanceof Error ? error : new Error(errorMsg))
		pushToolResult(`<split_result><error>${errorMsg}</error></split_result>`)
	}
}
