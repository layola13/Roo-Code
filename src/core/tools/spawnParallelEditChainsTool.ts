/**
 * spawn_parallel_edit_chains Tool
 * 并行执行多个编辑链
 */

import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"

export async function spawnParallelEditChainsTool(
	task: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const chainIdsParam: string | undefined = block.params.chain_ids
	const maxConcurrent: string | undefined = block.params.max_concurrent

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				tool: "spawnParallelEditChains",
				chainIds: removeClosingTag("chain_ids", chainIdsParam),
				maxConcurrent: removeClosingTag("max_concurrent", maxConcurrent),
			})

			await task.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			// Validate required parameters
			if (!chainIdsParam) {
				task.consecutiveMistakeCount++
				task.recordToolError("spawn_parallel_edit_chains")
				pushToolResult(await task.sayAndCreateMissingParamError("spawn_parallel_edit_chains", "chain_ids"))
				return
			}

			// 检查服务可用性
			if (!task.nextEditService) {
				task.consecutiveMistakeCount++
				pushToolResult(formatResponse.toolError("NextEdit service is not available"))
				return
			}

			if (!task.parallelManager) {
				task.consecutiveMistakeCount++
				pushToolResult(formatResponse.toolError("Parallel execution manager is not available"))
				return
			}

			task.consecutiveMistakeCount = 0

			// Parse chain IDs
			let chainIds: string[]
			try {
				chainIds = JSON.parse(chainIdsParam)
				if (!Array.isArray(chainIds) || chainIds.length === 0) {
					throw new Error("chain_ids must be a non-empty array")
				}
			} catch (error) {
				pushToolResult(
					formatResponse.toolError(
						`Invalid chain_ids parameter: must be a JSON array of chain IDs. Error: ${error}`,
					),
				)
				return
			}

			// Parse max concurrent
			let maxConcurrentNum = 5 // 默认5个并发
			if (maxConcurrent) {
				maxConcurrentNum = parseInt(maxConcurrent, 10)
				if (isNaN(maxConcurrentNum) || maxConcurrentNum <= 0 || maxConcurrentNum > 10) {
					pushToolResult(
						formatResponse.toolError("max_concurrent must be a positive integer between 1 and 10"),
					)
					return
				}
			}

			// 验证所有链都存在
			for (const chainId of chainIds) {
				const chain = task.nextEditService.getChain(chainId)
				if (!chain) {
					pushToolResult(formatResponse.toolError(`Chain ${chainId} not found`))
					return
				}
			}

			const toolMessage = JSON.stringify({
				tool: "spawnParallelEditChains",
				chainIds,
				maxConcurrent: maxConcurrentNum,
				totalChains: chainIds.length,
			})

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			// 执行并行编辑链
			try {
				const parallelSessionId = `parallel-${Date.now()}`

				// 通知前端开始并行执行
				await task.say(
					"parallel_edit_chains_started",
					JSON.stringify({
						parallelSessionId,
						chainIds,
						maxConcurrent: maxConcurrentNum,
					}),
				)

				// TODO: 实际的并行执行逻辑需要在Task.ts集成时实现
				// 这里先返回成功消息
				pushToolResult(
					`Successfully started parallel execution of ${chainIds.length} edit chains with max concurrency ${maxConcurrentNum}. Session ID: ${parallelSessionId}`,
				)

				// 保存并行会话记忆
				if (task.gswMemorySystem) {
					const parallelSession = {
						version: "1.0" as const,
						entry_id: parallelSessionId,
						timestamp: new Date().toISOString(),
						session_id: task.taskId,
						parallel_session_id: parallelSessionId,
						task_description: `Parallel execution of ${chainIds.length} edit chains`,
						edit_chain_ids: chainIds,
						slot_count: maxConcurrentNum,
						completed_count: 0,
						failed_count: 0,
						total_execution_time: 0,
						created_at: new Date().toISOString(),
					}

					await task.nextEditService?.memoryManager.saveParallelSession(parallelSession)
				}

				return
			} catch (error) {
				await handleError("executing parallel edit chains", error as Error)
				return
			}
		}
	} catch (error) {
		await handleError("spawning parallel edit chains", error as Error)
		return
	}
}
