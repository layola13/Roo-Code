import { TodoItem } from "@roo-code/types"

import { AttemptCompletionToolUse } from "../../../shared/tools"

// Mock the formatResponse module before importing the tool
vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolError: vi.fn((msg: string) => `Error: ${msg}`),
	},
}))

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn(),
		})),
	},
}))

// Mock Package module
vi.mock("../../../shared/package", () => ({
	Package: {
		name: "roo-cline",
	},
}))

import { attemptCompletionTool } from "../attemptCompletionTool"
import { Task } from "../../task/Task"
import * as vscode from "vscode"

describe("attemptCompletionTool", () => {
	let mockTask: Partial<Task>
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockAskApproval: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockRemoveClosingTag: ReturnType<typeof vi.fn>
	let mockToolDescription: ReturnType<typeof vi.fn>
	let mockAskFinishSubTaskApproval: ReturnType<typeof vi.fn>
	let mockGetConfiguration: ReturnType<typeof vi.fn>

	beforeEach(() => {
		mockPushToolResult = vi.fn()
		mockAskApproval = vi.fn()
		mockHandleError = vi.fn()
		mockRemoveClosingTag = vi.fn()
		mockToolDescription = vi.fn()
		mockAskFinishSubTaskApproval = vi.fn()
		mockGetConfiguration = vi.fn(() => ({
			get: vi.fn((key: string, defaultValue: any) => {
				if (key === "preventCompletionWithOpenTodos") {
					return defaultValue // Default to false unless overridden in test
				}
				return defaultValue
			}),
		}))

		// Setup vscode mock
		vi.mocked(vscode.workspace.getConfiguration).mockImplementation(mockGetConfiguration)

		mockTask = {
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			todoList: undefined,
		}
	})

	describe("todo list validation", () => {
		it("should allow completion when there is no todo list", async () => {
			const block: AttemptCompletionToolUse = {
				type: "tool_use",
				name: "attempt_completion",
				params: { result: "Task completed successfully" },
				partial: false,
			}

			mockTask.todoList = undefined

			await attemptCompletionTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
				mockToolDescription,
				mockAskFinishSubTaskApproval,
			)

			// Should not call pushToolResult with an error for empty todo list
			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockTask.recordToolError).not.toHaveBeenCalled()
		})

		it("should allow completion when todo list is empty", async () => {
			const block: AttemptCompletionToolUse = {
				type: "tool_use",
				name: "attempt_completion",
				params: { result: "Task completed successfully" },
				partial: false,
			}

			mockTask.todoList = []

			await attemptCompletionTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
				mockToolDescription,
				mockAskFinishSubTaskApproval,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockTask.recordToolError).not.toHaveBeenCalled()
		})

		it("should allow completion when all todos are completed", async () => {
			const block: AttemptCompletionToolUse = {
				type: "tool_use",
				name: "attempt_completion",
				params: { result: "Task completed successfully" },
				partial: false,
			}

			const completedTodos: TodoItem[] = [
				{ id: "1", content: "First task", status: "completed" },
				{ id: "2", content: "Second task", status: "completed" },
			]

			mockTask.todoList = completedTodos

			await attemptCompletionTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
				mockToolDescription,
				mockAskFinishSubTaskApproval,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockTask.recordToolError).not.toHaveBeenCalled()
		})

		it("should prevent completion when there are pending todos", async () => {
			const block: AttemptCompletionToolUse = {
				type: "tool_use",
				name: "attempt_completion",
				params: { result: "Task completed successfully" },
				partial: false,
			}

			const todosWithPending: TodoItem[] = [
				{ id: "1", content: "First task", status: "completed" },
				{ id: "2", content: "Second task", status: "pending" },
			]

			mockTask.todoList = todosWithPending

			// Enable the setting to prevent completion with open todos
			mockGetConfiguration.mockReturnValue({
				get: vi.fn((key: string, defaultValue: any) => {
					if (key === "preventCompletionWithOpenTodos") {
						return true // Setting is enabled
					}
					return defaultValue
				}),
			})

			await attemptCompletionTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
				mockToolDescription,
				mockAskFinishSubTaskApproval,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("attempt_completion")
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("Cannot complete task while there are incomplete todos"),
			)
		})

		it("should prevent completion when there are in-progress todos", async () => {
			const block: AttemptCompletionToolUse = {
				type: "tool_use",
				name: "attempt_completion",
				params: { result: "Task completed successfully" },
				partial: false,
			}

			const todosWithInProgress: TodoItem[] = [
				{ id: "1", content: "First task", status: "completed" },
				{ id: "2", content: "Second task", status: "in_progress" },
			]

			mockTask.todoList = todosWithInProgress

			// Enable the setting to prevent completion with open todos
			mockGetConfiguration.mockReturnValue({
				get: vi.fn((key: string, defaultValue: any) => {
					if (key === "preventCompletionWithOpenTodos") {
						return true // Setting is enabled
					}
					return defaultValue
				}),
			})

			await attemptCompletionTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
				mockToolDescription,
				mockAskFinishSubTaskApproval,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("attempt_completion")
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("Cannot complete task while there are incomplete todos"),
			)
		})

		it("should prevent completion when there are mixed incomplete todos", async () => {
			const block: AttemptCompletionToolUse = {
				type: "tool_use",
				name: "attempt_completion",
				params: { result: "Task completed successfully" },
				partial: false,
			}

			const mixedTodos: TodoItem[] = [
				{ id: "1", content: "First task", status: "completed" },
				{ id: "2", content: "Second task", status: "pending" },
				{ id: "3", content: "Third task", status: "in_progress" },
			]

			mockTask.todoList = mixedTodos

			// Enable the setting to prevent completion with open todos
			mockGetConfiguration.mockReturnValue({
				get: vi.fn((key: string, defaultValue: any) => {
					if (key === "preventCompletionWithOpenTodos") {
						return true // Setting is enabled
					}
					return defaultValue
				}),
			})

			await attemptCompletionTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
				mockToolDescription,
				mockAskFinishSubTaskApproval,
			)

			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("attempt_completion")
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("Cannot complete task while there are incomplete todos"),
			)
		})

		it("should allow completion when setting is disabled even with incomplete todos", async () => {
			const block: AttemptCompletionToolUse = {
				type: "tool_use",
				name: "attempt_completion",
				params: { result: "Task completed successfully" },
				partial: false,
			}

			const todosWithPending: TodoItem[] = [
				{ id: "1", content: "First task", status: "completed" },
				{ id: "2", content: "Second task", status: "pending" },
			]

			mockTask.todoList = todosWithPending

			// Ensure the setting is disabled (default behavior)
			mockGetConfiguration.mockReturnValue({
				get: vi.fn((key: string, defaultValue: any) => {
					if (key === "preventCompletionWithOpenTodos") {
						return false // Setting is disabled
					}
					return defaultValue
				}),
			})

			await attemptCompletionTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
				mockToolDescription,
				mockAskFinishSubTaskApproval,
			)

			// Should not prevent completion when setting is disabled
			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockTask.recordToolError).not.toHaveBeenCalled()
			expect(mockPushToolResult).not.toHaveBeenCalledWith(
				expect.stringContaining("Cannot complete task while there are incomplete todos"),
			)
		})

		it("should prevent completion when setting is enabled with incomplete todos", async () => {
			const block: AttemptCompletionToolUse = {
				type: "tool_use",
				name: "attempt_completion",
				params: { result: "Task completed successfully" },
				partial: false,
			}

			const todosWithPending: TodoItem[] = [
				{ id: "1", content: "First task", status: "completed" },
				{ id: "2", content: "Second task", status: "pending" },
			]

			mockTask.todoList = todosWithPending

			// Enable the setting
			mockGetConfiguration.mockReturnValue({
				get: vi.fn((key: string, defaultValue: any) => {
					if (key === "preventCompletionWithOpenTodos") {
						return true // Setting is enabled
					}
					return defaultValue
				}),
			})

			await attemptCompletionTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
				mockToolDescription,
				mockAskFinishSubTaskApproval,
			)

			// Should prevent completion when setting is enabled and there are incomplete todos
			expect(mockTask.consecutiveMistakeCount).toBe(1)
			expect(mockTask.recordToolError).toHaveBeenCalledWith("attempt_completion")
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("Cannot complete task while there are incomplete todos"),
			)
		})

		it("should allow completion when setting is enabled but all todos are completed", async () => {
			const block: AttemptCompletionToolUse = {
				type: "tool_use",
				name: "attempt_completion",
				params: { result: "Task completed successfully" },
				partial: false,
			}

			const completedTodos: TodoItem[] = [
				{ id: "1", content: "First task", status: "completed" },
				{ id: "2", content: "Second task", status: "completed" },
			]

			mockTask.todoList = completedTodos

			// Enable the setting
			mockGetConfiguration.mockReturnValue({
				get: vi.fn((key: string, defaultValue: any) => {
					if (key === "preventCompletionWithOpenTodos") {
						return true // Setting is enabled
					}
					return defaultValue
				}),
			})

			await attemptCompletionTool(
				mockTask as Task,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
				mockToolDescription,
				mockAskFinishSubTaskApproval,
			)

			// Should allow completion when setting is enabled but all todos are completed
			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockTask.recordToolError).not.toHaveBeenCalled()
			expect(mockPushToolResult).not.toHaveBeenCalledWith(
				expect.stringContaining("Cannot complete task while there are incomplete todos"),
			)
		})

		describe("judge approval validation", () => {
			beforeEach(() => {
				// Setup task with judge methods
				mockTask.shouldInvokeJudge = vi.fn().mockResolvedValue(true)
				mockTask.invokeJudge = vi.fn()
				mockTask.handleJudgeRejection = vi.fn()
				mockTask.getJudgeConfig = vi.fn().mockResolvedValue({
					enabled: true,
					mode: "always",
					detailLevel: "detailed",
					allowUserOverride: true,
					blockOnCriticalIssues: true,
					modelConfig: { apiModelId: "claude-sonnet-4" },
				})
				mockTask.gswMemorySystem = undefined
				mockTask.judgeEvidenceCache = {
					userRequirements: [],
					codeChanges: [],
					toolCalls: [],
					checkpoints: [],
					lastUpdated: Date.now(),
				}
				mockTask.say = vi.fn().mockResolvedValue(undefined)
				mockTask.ask = vi.fn().mockResolvedValue({ response: "yesButtonClicked" })
				mockTask.clineMessages = []
				mockTask.emit = vi.fn()
				mockTask.getTokenUsage = vi.fn().mockReturnValue({})
				mockTask.toolUsage = {}
				// Use Object.defineProperty to set readonly property
				Object.defineProperty(mockTask, "taskId", {
					value: "test-task-id",
					writable: false,
					configurable: true,
				})
			})

			it("should reject completion when judge returns approved: false", async () => {
				const block: AttemptCompletionToolUse = {
					type: "tool_use",
					name: "attempt_completion",
					params: { result: "Task completed successfully" },
					partial: false,
				}

				// Mock judge rejection
				vi.mocked(mockTask.invokeJudge!).mockResolvedValue({
					approved: false,
					reasoning: "任务完全未完成。存在严重问题需要修复。",
					missingItems: ["缺失测试"],
					suggestions: [],
					hasCriticalIssues: true,
					criticalIssues: ["没有运行测试"],
				})

				// User chooses not to force complete
				vi.mocked(mockTask.handleJudgeRejection!).mockResolvedValue(false)

				await attemptCompletionTool(
					mockTask as Task,
					block,
					mockAskApproval,
					mockHandleError,
					mockPushToolResult,
					mockRemoveClosingTag,
					mockToolDescription,
					mockAskFinishSubTaskApproval,
				)

				// Should reject the completion
				expect(mockTask.invokeJudge).toHaveBeenCalled()
				expect(mockTask.handleJudgeRejection).toHaveBeenCalled()
				expect(mockPushToolResult).toHaveBeenCalledWith(
					expect.stringContaining("Task completion rejected by judge"),
				)
				expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("没有运行测试"))
			})

			it("should NOT show approval message when approved is strictly false", async () => {
				const block: AttemptCompletionToolUse = {
					type: "tool_use",
					name: "attempt_completion",
					params: { result: "Task completed successfully" },
					partial: false,
				}

				// Mock judge with approved: false (the bug scenario)
				vi.mocked(mockTask.invokeJudge!).mockResolvedValue({
					approved: false, // 🔴 This is false
					reasoning: "任务完全未完成。存在严重问题需要修复。",
					missingItems: [],
					suggestions: [],
					hasCriticalIssues: true,
					criticalIssues: ["严重问题"],
				})

				// User chooses not to force complete
				vi.mocked(mockTask.handleJudgeRejection!).mockResolvedValue(false)

				await attemptCompletionTool(
					mockTask as Task,
					block,
					mockAskApproval,
					mockHandleError,
					mockPushToolResult,
					mockRemoveClosingTag,
					mockToolDescription,
					mockAskFinishSubTaskApproval,
				)

				// Should NOT display "✅ Judge Approval" message
				expect(mockTask.say).not.toHaveBeenCalledWith(
					"text",
					expect.stringContaining("✅ Judge Approval"),
					expect.anything(),
					expect.anything(),
					expect.anything(),
					expect.anything(),
					expect.anything(),
				)

				// Should call handleJudgeRejection
				expect(mockTask.handleJudgeRejection).toHaveBeenCalled()
			})

			it("should handle non-boolean approved values as rejection", async () => {
				const block: AttemptCompletionToolUse = {
					type: "tool_use",
					name: "attempt_completion",
					params: { result: "Task completed successfully" },
					partial: false,
				}

				// Mock judge with non-boolean approved value
				vi.mocked(mockTask.invokeJudge!).mockResolvedValue({
					approved: "true" as any, // 🔴 String instead of boolean
					reasoning: "任务完成",
					missingItems: [],
					suggestions: [],
					hasCriticalIssues: false,
				})

				// User chooses not to force complete
				vi.mocked(mockTask.handleJudgeRejection!).mockResolvedValue(false)

				await attemptCompletionTool(
					mockTask as Task,
					block,
					mockAskApproval,
					mockHandleError,
					mockPushToolResult,
					mockRemoveClosingTag,
					mockToolDescription,
					mockAskFinishSubTaskApproval,
				)

				// Should treat non-boolean as rejection
				expect(mockTask.handleJudgeRejection).toHaveBeenCalled()
				expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("rejected"))
			})

			it("should show approval message only when approved is strictly true", async () => {
				const block: AttemptCompletionToolUse = {
					type: "tool_use",
					name: "attempt_completion",
					params: { result: "Task completed successfully" },
					partial: false,
				}

				// Mock judge with approved: true
				vi.mocked(mockTask.invokeJudge!).mockResolvedValue({
					approved: true, // ✅ Strictly true
					reasoning: "任务完成符合要求",
					missingItems: [],
					suggestions: ["建议添加更多测试"],
					hasCriticalIssues: false,
					overallScore: 9,
				})

				await attemptCompletionTool(
					mockTask as Task,
					block,
					mockAskApproval,
					mockHandleError,
					mockPushToolResult,
					mockRemoveClosingTag,
					mockToolDescription,
					mockAskFinishSubTaskApproval,
				)

				// Should display "✅ Judge Approval" message
				expect(mockTask.say).toHaveBeenCalledWith(
					"text",
					expect.stringContaining("✅ Judge Approval"),
					undefined,
					false,
					undefined,
					undefined,
					expect.objectContaining({ isNonInteractive: true }),
				)

				// Should NOT call handleJudgeRejection
				expect(mockTask.handleJudgeRejection).not.toHaveBeenCalled()
			})
		})
	})
})
