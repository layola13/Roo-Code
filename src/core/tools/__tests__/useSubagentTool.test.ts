import { describe, it, expect, vi, beforeEach } from "vitest"
import { useSubagentTool } from "../useSubagentTool"
import type { UseSubagentToolUse } from "../../../shared/tools"
import type { Task } from "../../task/Task"

describe("useSubagentTool", () => {
	let mockTask: Partial<Task>
	let mockAskApproval: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockRemoveClosingTag: ReturnType<typeof vi.fn>

	beforeEach(() => {
		// Create async generator mock for API stream
		const createMockStream = () => {
			async function* mockStream() {
				yield { type: "text" as const, text: "Mock subagent analysis result" }
				yield {
					type: "usage" as const,
					inputTokens: 100,
					outputTokens: 50,
					totalCost: 0.0015,
				}
			}
			return mockStream()
		}

		// Mock Task with API conversation history
		mockTask = {
			apiConversationHistory: [
				{
					role: "user",
					content: "Hello, I need help with my code",
				},
				{
					role: "assistant",
					content: "I can help you with that. What's the issue?",
				},
			],
			api: {
				createMessage: vi.fn().mockImplementation(() => createMockStream()),
			},
			recordSubAgentInvocation: vi.fn().mockResolvedValue(undefined),
		} as any

		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn((tag, content) => content || "")
	})

	it("should successfully execute condense-context-analyzer", async () => {
		const toolUse: UseSubagentToolUse = {
			type: "tool_use",
			name: "use_subagent",
			params: {
				agent_name: "condense-context-analyzer",
				task: "Analyze the conversation structure",
			},
			partial: false,
		}

		await useSubagentTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify approval was requested
		expect(mockAskApproval).toHaveBeenCalledWith("tool", undefined, undefined, true)

		// Verify result was pushed
		expect(mockPushToolResult).toHaveBeenCalled()
		const resultArg = mockPushToolResult.mock.calls[0][0]
		expect(resultArg).toContain("condense-context-analyzer")
		expect(resultArg).toContain("Success")
	})

	it("should successfully execute condense-memory-extractor", async () => {
		const toolUse: UseSubagentToolUse = {
			type: "tool_use",
			name: "use_subagent",
			params: {
				agent_name: "condense-memory-extractor",
				task: "Extract critical information",
				context: "Focus on architectural decisions",
			},
			partial: false,
		}

		await useSubagentTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockAskApproval).toHaveBeenCalled()
		expect(mockPushToolResult).toHaveBeenCalled()
		const resultArg = mockPushToolResult.mock.calls[0][0]
		expect(resultArg).toContain("condense-memory-extractor")
	})

	it("should successfully execute condense-code-summarizer", async () => {
		const toolUse: UseSubagentToolUse = {
			type: "tool_use",
			name: "use_subagent",
			params: {
				agent_name: "condense-code-summarizer",
			},
			partial: false,
		}

		await useSubagentTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockAskApproval).toHaveBeenCalled()
		expect(mockPushToolResult).toHaveBeenCalled()
		const resultArg = mockPushToolResult.mock.calls[0][0]
		expect(resultArg).toContain("condense-code-summarizer")
	})

	it("should reject invalid agent_name", async () => {
		const toolUse: UseSubagentToolUse = {
			type: "tool_use",
			name: "use_subagent",
			params: {
				agent_name: "invalid-agent",
			},
			partial: false,
		}

		await useSubagentTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Invalid agent_name"))
	})

	it("should reject missing agent_name", async () => {
		const toolUse: UseSubagentToolUse = {
			type: "tool_use",
			name: "use_subagent",
			params: {},
			partial: false,
		}

		await useSubagentTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("agent_name parameter is required"))
	})

	it("should handle user cancellation", async () => {
		mockAskApproval.mockResolvedValue(false)

		const toolUse: UseSubagentToolUse = {
			type: "tool_use",
			name: "use_subagent",
			params: {
				agent_name: "condense-context-analyzer",
			},
			partial: false,
		}

		await useSubagentTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("cancelled by user"))
	})

	it("should handle execution errors gracefully", async () => {
		const mockError = new Error("API failure")
		// Create a failing async generator
		const createFailingStream = () => {
			const failingStream = async function* () {
				throw mockError
			}
			return failingStream()
		}

		mockTask.api = {
			createMessage: vi.fn().mockImplementation(() => createFailingStream()),
		} as any

		const toolUse: UseSubagentToolUse = {
			type: "tool_use",
			name: "use_subagent",
			params: {
				agent_name: "condense-context-analyzer",
			},
			partial: false,
		}

		await useSubagentTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// When SubAgentExecutor catches the error, it returns a failed result
		// rather than throwing, so handleError is NOT called in this case.
		// Instead, we should verify that the error is properly communicated through the result.
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("execution failed"))
	})

	it("should include task and context in subagent execution", async () => {
		const toolUse: UseSubagentToolUse = {
			type: "tool_use",
			name: "use_subagent",
			params: {
				agent_name: "condense-context-analyzer",
				task: "Custom analysis task",
				context: "Additional context information",
			},
			partial: false,
		}

		await useSubagentTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify API was called
		expect(mockTask.api?.createMessage).toHaveBeenCalled()

		// Verify task result contains expected data
		expect(mockPushToolResult).toHaveBeenCalled()
		const resultArg = mockPushToolResult.mock.calls[0][0]
		expect(resultArg).toContain("Success")
	})

	it("should record subagent invocation with tool_call trigger type", async () => {
		const toolUse: UseSubagentToolUse = {
			type: "tool_use",
			name: "use_subagent",
			params: {
				agent_name: "condense-context-analyzer",
				task: "Analyze conversation flow",
			},
			partial: false,
		}

		await useSubagentTool(
			mockTask as Task,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify recordSubAgentInvocation was called with correct parameters
		expect(mockTask.recordSubAgentInvocation).toHaveBeenCalledWith(
			expect.objectContaining({
				agentName: "condense-context-analyzer",
				triggerType: "tool_call",
				tokensIn: expect.any(Number),
				tokensOut: expect.any(Number),
				cost: expect.any(Number),
				success: true,
				timestamp: expect.any(Number),
			}),
		)
	})
})
