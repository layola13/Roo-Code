/**
 * spawn_edit_chain Tool
 * 创建NextEdit编辑链
 */

import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"

export async function spawnEditChainTool(
	task: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const taskDescription: string | undefined = block.params.task_description
	const filesParam: string | undefined = block.params.files
	const executionMode: string | undefined = block.params.execution_mode
	const maxSteps: string | undefined = block.params.max_steps

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				tool: "spawnEditChain",
				taskDescription: removeClosingTag("task_description", taskDescription),
				files: removeClosingTag("files", filesParam),
				executionMode: removeClosingTag("execution_mode", executionMode),
				maxSteps: removeClosingTag("max_steps", maxSteps),
			})

			await task.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			// Validate required parameters
			if (!taskDescription) {
				task.consecutiveMistakeCount++
				task.recordToolError("spawn_edit_chain")
				pushToolResult(await task.sayAndCreateMissingParamError("spawn_edit_chain", "task_description"))
				return
			}

			// 检查 NextEdit 服务是否可用
			if (!task.nextEditService) {
				task.consecutiveMistakeCount++
				pushToolResult(
					formatResponse.toolError(
						"NextEdit service is not available. Please ensure NextEdit is enabled in configuration.",
					),
				)
				return
			}

			task.consecutiveMistakeCount = 0

			// Parse files
			let files: string[] = []
			if (filesParam) {
				try {
					files = JSON.parse(filesParam)
					if (!Array.isArray(files)) {
						throw new Error("files must be an array")
					}
				} catch (error) {
					pushToolResult(
						formatResponse.toolError(
							`Invalid files parameter: must be a JSON array of file paths. Error: ${error}`,
						),
					)
					return
				}
			}

			// Parse max steps
			let maxStepsNum: number | undefined
			if (maxSteps) {
				maxStepsNum = parseInt(maxSteps, 10)
				if (isNaN(maxStepsNum) || maxStepsNum <= 0) {
					pushToolResult(formatResponse.toolError("max_steps must be a positive integer"))
					return
				}
			}

			// Validate execution mode
			const validExecutionModes = ["sequential", "parallel"]
			const mode = executionMode || "sequential"
			if (!validExecutionModes.includes(mode)) {
				pushToolResult(
					formatResponse.toolError(
						`Invalid execution_mode: ${mode}. Must be one of: ${validExecutionModes.join(", ")}`,
					),
				)
				return
			}

			const toolMessage = JSON.stringify({
				tool: "spawnEditChain",
				taskDescription,
				files: files.length > 0 ? files : "auto-detect",
				executionMode: mode,
				maxSteps: maxStepsNum || "auto",
			})

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			// 创建编辑链
			try {
				const chain = await task.nextEditService.createEditChain(task.taskId, {
					taskDescription,
					files,
					executionMode: mode as "sequential" | "parallel",
					maxSteps: maxStepsNum,
				})

				// 生成初始步骤
				const fileContents = new Map<string, string>()

				// 如果指定了文件，读取内容
				if (files.length > 0) {
					for (const file of files) {
						try {
							const content = await task.readFile(file)
							fileContents.set(file, content)
						} catch (error) {
							console.warn(`[spawnEditChainTool] Failed to read file ${file}:`, error)
						}
					}
				}

				// 生成步骤
				const steps = await task.nextEditService.generateSteps(chain.chainId, {
					taskDescription,
					existingSteps: [],
					fileContents,
					codebaseContext: task.cwd,
				})

				// 启动编辑链
				await task.nextEditService.startChain(chain.chainId)

				// 通知前端
				await task.say(
					"edit_chain_created",
					JSON.stringify({
						chainId: chain.chainId,
						taskDescription,
						totalSteps: steps.length,
						executionMode: mode,
						files: chain.affectedFiles,
					}),
				)

				pushToolResult(
					`Successfully created edit chain ${chain.chainId} with ${steps.length} steps in ${mode} mode. Files: ${chain.affectedFiles.join(", ")}`,
				)

				return
			} catch (error) {
				await handleError("creating edit chain", error as Error)
				return
			}
		}
	} catch (error) {
		await handleError("spawning edit chain", error as Error)
		return
	}
}
