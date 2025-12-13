/**
 * spawn_parallel_tasks Tool Implementation
 *
 * Allows LLM to spawn multiple parallel subagent tasks for concurrent execution.
 * Integrates with ParallelSubagentManager for dynamic scheduling and execution.
 *
 * Key Features:
 * - Up to 10 concurrent subagent executions
 * - Dynamic scheduling with priority queue
 * - Multiple execution modes (auto, wait_all, stream_results)
 * - Real-time progress feedback to UI
 * - Error handling and recovery
 */

import type { SpawnParallelTasksToolUse } from "../../shared/tools"
import type { Task } from "../task/Task"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { SubagentParams, AgentContext, Priority } from "../subagent/types"

/**
 * Individual task definition for parallel execution
 */
export interface ParallelTaskDefinition {
	id: string
	description: string
	context?: string
	target_files?: string[]
	priority?: Priority
	model?: string
	tools?: string[]
}

/**
 * Execution modes for parallel tasks
 */
export type ExecutionMode = "auto" | "wait_all" | "stream_results"

/**
 * Execute spawn_parallel_tasks tool
 *
 * This tool enables the LLM to spawn multiple independent tasks that will be
 * executed in parallel using the ParallelSubagentManager.
 */
export async function spawnParallelTasksTool(
	cline: Task,
	block: SpawnParallelTasksToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	const { tasks: tasksParam, execution_mode = "auto", max_concurrent = 10 } = block.params

	// Parse tasks parameter (it comes as JSON string from LLM)
	let tasks: ParallelTaskDefinition[]
	try {
		if (!tasksParam) {
			await pushToolResult("Error: 'tasks' parameter is required")
			return
		}

		// Parse JSON if it's a string
		tasks = typeof tasksParam === "string" ? JSON.parse(tasksParam) : tasksParam

		if (!Array.isArray(tasks)) {
			await pushToolResult("Error: 'tasks' must be an array")
			return
		}

		if (tasks.length === 0) {
			await pushToolResult("Error: At least one task is required")
			return
		}
	} catch (error) {
		await pushToolResult(`Error: Invalid tasks JSON: ${error instanceof Error ? error.message : String(error)}`)
		return
	}

	// Validate task structure
	for (const task of tasks) {
		if (!task.id) {
			await pushToolResult(`Error: Each task must have 'id' field. Invalid task: ${JSON.stringify(task)}`)
			return
		}
		if (!task.description) {
			await pushToolResult(
				`Error: Each task must have 'description' field. Invalid task: ${JSON.stringify(task)}`,
			)
			return
		}
	}

	// Validate execution mode
	const validModes: ExecutionMode[] = ["auto", "wait_all", "stream_results"]
	if (execution_mode && !validModes.includes(execution_mode as ExecutionMode)) {
		await pushToolResult(
			`Error: Invalid execution_mode '${execution_mode}'. Must be one of: ${validModes.join(", ")}`,
		)
		return
	}

	// Validate max_concurrent
	const maxConcurrentNum = typeof max_concurrent === "string" ? parseInt(max_concurrent, 10) : max_concurrent
	if (maxConcurrentNum && (maxConcurrentNum < 1 || maxConcurrentNum > 10)) {
		await pushToolResult("Error: max_concurrent cannot exceed 10")
		return
	}

	try {
		// Ask for approval
		const approvalMessage = `Execute ${tasks.length} parallel tasks with mode: ${execution_mode}`
		const approved = await askApproval("tool", approvalMessage, undefined, true)
		if (!approved) {
			await pushToolResult("Parallel tasks execution cancelled by user.")
			return
		}

		// Check if parallel manager is initialized
		if (!cline.parallelManager) {
			await pushToolResult(
				"Error: Parallel subagent manager not initialized. Please ensure the system is properly configured.",
			)
			return
		}

		// Execute tasks based on execution mode
		const startTime = Date.now()
		const results: Array<{ taskId: string; success: boolean; output: string; error?: string }> = []

		if (execution_mode === "stream_results") {
			// Stream results as they complete
			for (let i = 0; i < tasks.length; i++) {
				const task = tasks[i]

				// Progress updates are handled internally by parallel manager

				try {
					const result = await cline.runParallelSubagent({
						id: task.id,
						description: task.description,
						context: task.context,
						targetFiles: task.target_files,
						priority: task.priority || "medium",
						model: task.model,
						tools: task.tools,
					})

					results.push({
						taskId: task.id,
						success: result.success,
						output: typeof result.output === "string" ? result.output : JSON.stringify(result.output),
					})

					// Stream this result immediately
					await pushToolResult(
						`[Task ${task.id}] Completed:\n${typeof result.output === "string" ? result.output : JSON.stringify(result.output, null, 2)}`,
					)
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					results.push({
						taskId: task.id,
						success: false,
						output: "",
						error: errorMessage,
					})

					await pushToolResult(`[Task ${task.id}] Failed: ${errorMessage}`)
				}
			}
		} else {
			// wait_all or auto mode: execute all in parallel
			const taskPromises = tasks.map(async (task) => {
				try {
					const result = await cline.runParallelSubagent({
						id: task.id,
						description: task.description,
						context: task.context,
						targetFiles: task.target_files,
						priority: task.priority || "medium",
						model: task.model,
						tools: task.tools,
					})

					return {
						taskId: task.id,
						success: result.success,
						output: typeof result.output === "string" ? result.output : JSON.stringify(result.output),
					}
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					return {
						taskId: task.id,
						success: false,
						output: "",
						error: errorMessage,
					}
				}
			})

			// Wait for all tasks to complete
			const taskResults = await Promise.all(taskPromises)
			results.push(...taskResults)
		}

		const executionTime = Date.now() - startTime
		const successCount = results.filter((r) => r.success).length
		const failureCount = results.filter((r) => !r.success).length

		// Format results for output
		const resultText = [
			`<parallel_execution_results>`,
			`Mode: ${execution_mode}`,
			`Total Tasks: ${tasks.length}`,
			`Successful: ${successCount}`,
			`Failed: ${failureCount}`,
			`Execution Time: ${executionTime}ms`,
			``,
			`--- Task Results ---`,
		]

		for (const result of results) {
			resultText.push(``)
			resultText.push(`[Task ${result.taskId}]`)
			resultText.push(`Status: ${result.success ? "✓ Success" : "✗ Failed"}`)
			if (result.error) {
				resultText.push(`Error: ${result.error}`)
			} else {
				resultText.push(`Output:`)
				resultText.push(result.output)
			}
		}

		resultText.push(`</parallel_execution_results>`)

		await pushToolResult(resultText.join("\n"))
	} catch (error) {
		await handleError("spawn_parallel_tasks", error as Error)
		const errorMessage = error instanceof Error ? error.message : String(error)
		await pushToolResult(`Error executing parallel tasks: ${errorMessage}`)
	}
}
