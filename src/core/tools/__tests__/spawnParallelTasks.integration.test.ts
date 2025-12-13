/**
 * Integration tests for spawn_parallel_tasks tool
 * Tests the complete end-to-end flow of parallel subagent execution
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { spawnParallelTasksTool } from "../spawnParallelTasksTool"
import type { Task } from "../../task/Task"
import type { SpawnParallelTasksToolUse } from "../../../shared/tools"

describe("spawnParallelTasksTool - Integration Tests", () => {
	let mockTask: Partial<Task>
	let mockAskApproval: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockRemoveClosingTag: ReturnType<typeof vi.fn>
	let mockPostMessageToWebview: ReturnType<typeof vi.fn>
	let messagesSent: any[]

	beforeEach(() => {
		messagesSent = []
		mockPostMessageToWebview = vi.fn((message) => {
			messagesSent.push(message)
			return Promise.resolve()
		})

		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn()

		// Mock Task with parallel manager
		mockTask = {
			parallelManager: {
				execute: vi.fn().mockResolvedValue({
					agentName: "test-agent",
					output: "Test output",
					tokensUsed: 100,
					executionTime: 1000,
					success: true,
				}),
			} as any,
			runParallelSubagent: vi.fn(async ({ id, description }) => {
				// Simulate backend message sending
				await mockPostMessageToWebview({
					type: "parallelSubagentStarted",
					parallelSubagent: {
						id,
						name: description.substring(0, 50),
						status: "queued",
						progress: 0,
						model: "claude-3.5-sonnet",
					},
				})

				await mockPostMessageToWebview({
					type: "parallelSubagentProgress",
					parallelSubagent: {
						id,
						status: "running",
						progress: 50,
					},
				})

				// Simulate execution
				await new Promise((resolve) => setTimeout(resolve, 10))

				await mockPostMessageToWebview({
					type: "parallelSubagentCompleted",
					parallelSubagent: {
						id,
						status: "completed",
						progress: 100,
						result: "Task completed successfully",
					},
				})

				return {
					agentName: id,
					output: "Test output",
					tokensUsed: 100,
					executionTime: 1000,
					success: true,
				}
			}),
		}
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Complete Flow Tests", () => {
		it("should execute multiple parallel tasks successfully", async () => {
			const toolUse: SpawnParallelTasksToolUse = {
				type: "tool_use",
				name: "spawn_parallel_tasks",
				partial: false,
				params: {
					tasks: JSON.stringify([
						{ id: "task-1", description: "Analyze file A", priority: "high" },
						{ id: "task-2", description: "Analyze file B", priority: "medium" },
						{ id: "task-3", description: "Analyze file C", priority: "low" },
					]),
					execution_mode: "wait_all",
					max_concurrent: "10",
				},
			}

			await spawnParallelTasksTool(
				mockTask as Task,
				toolUse,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Verify approval was requested
			expect(mockAskApproval).toHaveBeenCalledWith(
				"tool",
				expect.stringContaining("3 parallel tasks"),
				undefined,
				true,
			)

			// Verify all tasks were executed
			expect(mockTask.runParallelSubagent).toHaveBeenCalledTimes(3)

			// Verify UI messages were sent (3 tasks * 3 messages each = 9)
			expect(messagesSent.length).toBe(9)

			// Verify started messages
			const startedMessages = messagesSent.filter((m) => m.type === "parallelSubagentStarted")
			expect(startedMessages).toHaveLength(3)
			expect(startedMessages[0].parallelSubagent.id).toBe("task-1")
			expect(startedMessages[1].parallelSubagent.id).toBe("task-2")
			expect(startedMessages[2].parallelSubagent.id).toBe("task-3")

			// Verify progress messages
			const progressMessages = messagesSent.filter((m) => m.type === "parallelSubagentProgress")
			expect(progressMessages).toHaveLength(3)

			// Verify completed messages
			const completedMessages = messagesSent.filter((m) => m.type === "parallelSubagentCompleted")
			expect(completedMessages).toHaveLength(3)

			// Verify results were pushed
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("parallel_execution_results"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Successful: 3"))
		})

		it("should handle stream_results execution mode", async () => {
			const toolUse: SpawnParallelTasksToolUse = {
				type: "tool_use",
				name: "spawn_parallel_tasks",
				partial: false,
				params: {
					tasks: JSON.stringify([
						{ id: "task-1", description: "Task 1" },
						{ id: "task-2", description: "Task 2" },
					]),
					execution_mode: "stream_results",
				},
			}

			await spawnParallelTasksTool(
				mockTask as Task,
				toolUse,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Results should be streamed immediately
			expect(mockPushToolResult).toHaveBeenCalledTimes(3) // 2 streamed + 1 final
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("[Task task-1]"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("[Task task-2]"))
		})

		it("should handle task failures gracefully", async () => {
			// Mock one failed task
			mockTask.runParallelSubagent = vi
				.fn()
				.mockResolvedValueOnce({
					agentName: "task-1",
					output: "Success",
					success: true,
					tokensUsed: 100,
					executionTime: 1000,
				})
				.mockRejectedValueOnce(new Error("Task failed"))

			const toolUse: SpawnParallelTasksToolUse = {
				type: "tool_use",
				name: "spawn_parallel_tasks",
				partial: false,
				params: {
					tasks: JSON.stringify([
						{ id: "task-1", description: "Success task" },
						{ id: "task-2", description: "Failing task" },
					]),
					execution_mode: "wait_all",
				},
			}

			await spawnParallelTasksTool(
				mockTask as Task,
				toolUse,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should complete with partial success
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Successful: 1"))
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Failed: 1"))
		})
	})

	describe("Validation Tests", () => {
		it("should reject missing tasks parameter", async () => {
			const toolUse: SpawnParallelTasksToolUse = {
				type: "tool_use",
				name: "spawn_parallel_tasks",
				partial: false,
				params: {
					tasks: undefined as any,
				},
			}

			await spawnParallelTasksTool(
				mockTask as Task,
				toolUse,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("'tasks' parameter is required"))
		})

		it("should reject invalid JSON in tasks", async () => {
			const toolUse: SpawnParallelTasksToolUse = {
				type: "tool_use",
				name: "spawn_parallel_tasks",
				partial: false,
				params: {
					tasks: "invalid json{",
				},
			}

			await spawnParallelTasksTool(
				mockTask as Task,
				toolUse,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Invalid tasks JSON"))
		})

		it("should reject tasks without id", async () => {
			const toolUse: SpawnParallelTasksToolUse = {
				type: "tool_use",
				name: "spawn_parallel_tasks",
				partial: false,
				params: {
					tasks: JSON.stringify([{ description: "Missing ID task" }]),
				},
			}

			await spawnParallelTasksTool(
				mockTask as Task,
				toolUse,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("must have 'id' field"))
		})

		it("should reject tasks without description", async () => {
			const toolUse: SpawnParallelTasksToolUse = {
				type: "tool_use",
				name: "spawn_parallel_tasks",
				partial: false,
				params: {
					tasks: JSON.stringify([{ id: "task-1" }]),
				},
			}

			await spawnParallelTasksTool(
				mockTask as Task,
				toolUse,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("must have 'description' field"))
		})

		it("should enforce max_concurrent limit of 10", async () => {
			const toolUse: SpawnParallelTasksToolUse = {
				type: "tool_use",
				name: "spawn_parallel_tasks",
				partial: false,
				params: {
					tasks: JSON.stringify([{ id: "task-1", description: "Test" }]),
					max_concurrent: "15",
				},
			}

			await spawnParallelTasksTool(
				mockTask as Task,
				toolUse,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("cannot exceed 10"))
		})
	})

	describe("UI Sync Tests", () => {
		it("should send correct message sequence for each task", async () => {
			const toolUse: SpawnParallelTasksToolUse = {
				type: "tool_use",
				name: "spawn_parallel_tasks",
				partial: false,
				params: {
					tasks: JSON.stringify([{ id: "test-task", description: "Test Task" }]),
					execution_mode: "wait_all",
				},
			}

			await spawnParallelTasksTool(
				mockTask as Task,
				toolUse,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Verify message sequence: started -> progress -> completed
			expect(messagesSent[0].type).toBe("parallelSubagentStarted")
			expect(messagesSent[0].parallelSubagent.status).toBe("queued")

			expect(messagesSent[1].type).toBe("parallelSubagentProgress")
			expect(messagesSent[1].parallelSubagent.status).toBe("running")

			expect(messagesSent[2].type).toBe("parallelSubagentCompleted")
			expect(messagesSent[2].parallelSubagent.status).toBe("completed")
			expect(messagesSent[2].parallelSubagent.progress).toBe(100)
		})

		it("should handle user cancellation", async () => {
			mockAskApproval.mockResolvedValue(false)

			const toolUse: SpawnParallelTasksToolUse = {
				type: "tool_use",
				name: "spawn_parallel_tasks",
				partial: false,
				params: {
					tasks: JSON.stringify([{ id: "task-1", description: "Test" }]),
				},
			}

			await spawnParallelTasksTool(
				mockTask as Task,
				toolUse,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockTask.runParallelSubagent).not.toHaveBeenCalled()
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("cancelled"))
		})
	})

	describe("Error Handling Tests", () => {
		it("should handle uninitialized parallel manager", async () => {
			const taskWithoutManager = {
				parallelManager: undefined,
			} as Task

			const toolUse: SpawnParallelTasksToolUse = {
				type: "tool_use",
				name: "spawn_parallel_tasks",
				partial: false,
				params: {
					tasks: JSON.stringify([{ id: "task-1", description: "Test" }]),
				},
			}

			await spawnParallelTasksTool(
				taskWithoutManager,
				toolUse,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("Parallel subagent manager not initialized"),
			)
		})

		it("should handle execution errors", async () => {
			mockTask.runParallelSubagent = vi.fn().mockRejectedValue(new Error("Execution failed"))

			const toolUse: SpawnParallelTasksToolUse = {
				type: "tool_use",
				name: "spawn_parallel_tasks",
				partial: false,
				params: {
					tasks: JSON.stringify([{ id: "task-1", description: "Test" }]),
					execution_mode: "wait_all",
				},
			}

			await spawnParallelTasksTool(
				mockTask as Task,
				toolUse,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should complete with failure report
			expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Failed: 1"))
		})
	})
})
