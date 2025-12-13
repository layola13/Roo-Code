import { describe, it, expect, vi, beforeEach } from "vitest"
import { spawnParallelTasksTool } from "../spawnParallelTasksTool"
import type { SpawnParallelTasksToolUse } from "../../../shared/tools"
import type { Task } from "../../task/Task"

describe("spawnParallelTasksTool", () => {
	let mockTask: Partial<Task>
	let mockAskApproval: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockRemoveClosingTag: ReturnType<typeof vi.fn>

	beforeEach(() => {
		// Mock ParallelSubagentManager
		const mockParallelManager = {
			executeTasks: vi.fn().mockResolvedValue({
				success: true,
				results: [
					{
						taskId: "task-1",
						success: true,
						result: "Task 1 completed successfully",
					},
					{
						taskId: "task-2",
						success: true,
						result: "Task 2 completed successfully",
					},
				],
			}),
		}

		// Mock Task
		mockTask = {
			parallelManager: mockParallelManager as any,
			say: vi.fn().mockResolvedValue(undefined),
			runParallelSubagent: vi.fn().mockResolvedValue({
				success: true,
				output: "Mock task completed",
			}),
			providerRef: {
				deref: () => ({
					getState: vi.fn().mockResolvedValue({
						apiConfiguration: {
							apiKey: "test-key",
						},
					}),
					postStateToWebview: vi.fn(),
				}),
			} as any,
		} as any

		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn((tag, content) => content || "")
	})

	it("should successfully execute parallel tasks with valid parameters", async () => {
		const toolUse: SpawnParallelTasksToolUse = {
			type: "tool_use",
			name: "spawn_parallel_tasks",
			params: {
				tasks: JSON.stringify([
					{
						id: "task-1",
						description: "Analyze file A",
						context: "Security review",
					},
					{
						id: "task-2",
						description: "Analyze file B",
						context: "Performance review",
					},
				]),
				execution_mode: "wait_all",
				max_concurrent: "5",
			},
			partial: false,
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
		expect(mockAskApproval).toHaveBeenCalledWith("tool", expect.any(String), undefined, true)

		// Verify runParallelSubagent was called for each task
		expect(mockTask.runParallelSubagent).toHaveBeenCalledTimes(2)

		// Verify result was pushed
		expect(mockPushToolResult).toHaveBeenCalled()
		const resultArg = mockPushToolResult.mock.calls[0][0]
		expect(resultArg).toContain("parallel_execution_results")
		expect(resultArg).toContain("Successful: 2")
	})

	it("should handle auto execution mode", async () => {
		const toolUse: SpawnParallelTasksToolUse = {
			type: "tool_use",
			name: "spawn_parallel_tasks",
			params: {
				tasks: JSON.stringify([
					{
						id: "task-1",
						description: "Quick task",
					},
				]),
				execution_mode: "auto",
			},
			partial: false,
		}

		await spawnParallelTasksTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockAskApproval).toHaveBeenCalled()
		expect(mockTask.runParallelSubagent).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "task-1",
				description: "Quick task",
			}),
		)
	})

	it("should handle stream_results execution mode", async () => {
		const toolUse: SpawnParallelTasksToolUse = {
			type: "tool_use",
			name: "spawn_parallel_tasks",
			params: {
				tasks: JSON.stringify([
					{
						id: "task-1",
						description: "Streaming task",
					},
				]),
				execution_mode: "stream_results",
			},
			partial: false,
		}

		await spawnParallelTasksTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockTask.runParallelSubagent).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "task-1",
				description: "Streaming task",
			}),
		)
	})

	it("should reject when tasks parameter is missing", async () => {
		const toolUse: SpawnParallelTasksToolUse = {
			type: "tool_use",
			name: "spawn_parallel_tasks",
			params: {},
			partial: false,
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

	it("should reject when tasks parameter is not valid JSON", async () => {
		const toolUse: SpawnParallelTasksToolUse = {
			type: "tool_use",
			name: "spawn_parallel_tasks",
			params: {
				tasks: "invalid json {",
			},
			partial: false,
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

	it("should reject when tasks is not an array", async () => {
		const toolUse: SpawnParallelTasksToolUse = {
			type: "tool_use",
			name: "spawn_parallel_tasks",
			params: {
				tasks: JSON.stringify({ not: "an array" }),
			},
			partial: false,
		}

		await spawnParallelTasksTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("must be an array"))
	})

	it("should reject when tasks array is empty", async () => {
		const toolUse: SpawnParallelTasksToolUse = {
			type: "tool_use",
			name: "spawn_parallel_tasks",
			params: {
				tasks: JSON.stringify([]),
			},
			partial: false,
		}

		await spawnParallelTasksTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("At least one task is required"))
	})

	it("should reject when task is missing id", async () => {
		const toolUse: SpawnParallelTasksToolUse = {
			type: "tool_use",
			name: "spawn_parallel_tasks",
			params: {
				tasks: JSON.stringify([
					{
						description: "Task without id",
					},
				]),
			},
			partial: false,
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

	it("should reject when task is missing description", async () => {
		const toolUse: SpawnParallelTasksToolUse = {
			type: "tool_use",
			name: "spawn_parallel_tasks",
			params: {
				tasks: JSON.stringify([
					{
						id: "task-1",
					},
				]),
			},
			partial: false,
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

	it("should reject when max_concurrent exceeds limit", async () => {
		const toolUse: SpawnParallelTasksToolUse = {
			type: "tool_use",
			name: "spawn_parallel_tasks",
			params: {
				tasks: JSON.stringify([
					{
						id: "task-1",
						description: "Test task",
					},
				]),
				max_concurrent: "50",
			},
			partial: false,
		}

		await spawnParallelTasksTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("max_concurrent cannot exceed 10"))
	})

	it("should reject when execution_mode is invalid", async () => {
		const toolUse: SpawnParallelTasksToolUse = {
			type: "tool_use",
			name: "spawn_parallel_tasks",
			params: {
				tasks: JSON.stringify([
					{
						id: "task-1",
						description: "Test task",
					},
				]),
				execution_mode: "invalid_mode" as any,
			},
			partial: false,
		}

		await spawnParallelTasksTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Invalid execution_mode"))
	})

	it("should handle user cancellation", async () => {
		mockAskApproval.mockResolvedValue(false)

		const toolUse: SpawnParallelTasksToolUse = {
			type: "tool_use",
			name: "spawn_parallel_tasks",
			params: {
				tasks: JSON.stringify([
					{
						id: "task-1",
						description: "Test task",
					},
				]),
			},
			partial: false,
		}

		await spawnParallelTasksTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify runParallelSubagent was NOT called
		expect(mockTask.runParallelSubagent).not.toHaveBeenCalled()
	})

	it("should handle partial failures in parallel execution", async () => {
		// Mock runParallelSubagent to return failure for task-2
		mockTask.runParallelSubagent = vi
			.fn()
			.mockResolvedValueOnce({
				success: true,
				output: "Task 1 completed",
			})
			.mockResolvedValueOnce({
				success: false,
				output: "Task 2 failed",
			})

		const toolUse: SpawnParallelTasksToolUse = {
			type: "tool_use",
			name: "spawn_parallel_tasks",
			params: {
				tasks: JSON.stringify([
					{
						id: "task-1",
						description: "Task 1",
					},
					{
						id: "task-2",
						description: "Task 2",
					},
				]),
			},
			partial: false,
		}

		await spawnParallelTasksTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockPushToolResult).toHaveBeenCalled()
		const resultArg = mockPushToolResult.mock.calls[0][0]
		expect(resultArg).toContain("Failed: 1")
		expect(resultArg).toContain("Successful: 1")
	})

	it("should handle execution errors gracefully", async () => {
		const mockError = new Error("Parallel execution failed")
		const mockParallelManager = {
			executeTasks: vi.fn().mockRejectedValue(mockError),
		}

		mockTask.parallelManager = mockParallelManager as any

		const toolUse: SpawnParallelTasksToolUse = {
			type: "tool_use",
			name: "spawn_parallel_tasks",
			params: {
				tasks: JSON.stringify([
					{
						id: "task-1",
						description: "Test task",
					},
				]),
			},
			partial: false,
		}

		await spawnParallelTasksTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockPushToolResult).toHaveBeenCalled()
		const resultArg = mockPushToolResult.mock.calls[0][0]
		// Tool catches errors internally and reports them in results
		expect(resultArg).toContain("parallel_execution_results")
	})

	it("should pass optional task parameters correctly", async () => {
		const toolUse: SpawnParallelTasksToolUse = {
			type: "tool_use",
			name: "spawn_parallel_tasks",
			params: {
				tasks: JSON.stringify([
					{
						id: "task-1",
						description: "Complex task",
						context: "Additional context",
						target_files: ["file1.ts", "file2.ts"],
						priority: "high",
						model: "claude-3-5-sonnet-20241022",
						tools: ["read_file", "write_to_file"],
					},
				]),
			},
			partial: false,
		}

		await spawnParallelTasksTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockTask.runParallelSubagent).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "task-1",
				description: "Complex task",
				context: "Additional context",
				targetFiles: ["file1.ts", "file2.ts"],
				priority: "high",
				model: "claude-3-5-sonnet-20241022",
				tools: ["read_file", "write_to_file"],
			}),
		)
	})
})
