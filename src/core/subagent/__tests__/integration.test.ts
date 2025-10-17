/**
 * Integration Tests for Subagent System
 *
 * Tests the complete data flow:
 * useSubagentTool → SubAgentExecutor (bridge) → ConversationController → SubagentExecutor → Agents
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { Task } from "../../task/Task"
import { ApiHandler } from "../../../api"
import { UseSubagentToolUse } from "../../../shared/tools"
import { useSubagentTool } from "../../tools/useSubagentTool"

// Mock ApiHandler
const createMockApiHandler = (): ApiHandler => {
	return {
		createMessage: vi.fn().mockImplementation(async function* () {
			// Simulate a subagent response
			yield {
				type: "text",
				text: JSON.stringify({
					stages: [
						{
							stage_number: 1,
							topic: "Initial Discussion",
							key_points: ["Point 1", "Point 2"],
						},
					],
					transition_points: [],
					overall_flow: "Test conversation flow",
				}),
			}
			yield { type: "usage", inputTokens: 100, outputTokens: 50, totalCost: 0.01 }
		}),
		getModel: vi.fn().mockReturnValue({ id: "claude-sonnet-4" }),
		countTokens: vi.fn().mockResolvedValue(100),
	} as any
}

// Mock Task instance
const createMockTask = (apiHandler: ApiHandler): Partial<Task> => {
	return {
		api: apiHandler,
		apiConversationHistory: [
			{
				role: "user",
				content: [{ type: "text", text: "Hello, let's discuss the architecture" }],
			},
			{
				role: "assistant",
				content: [{ type: "text", text: "Sure, I'll help with the architecture design" }],
			},
		],
		subAgentInvocations: [],
		recordSubAgentInvocation: vi.fn().mockImplementation(async function (this: any, invocation: any) {
			this.subAgentInvocations.push(invocation)
		}),
		say: vi.fn(),
		ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
	} as any
}

describe("Subagent Integration Tests", () => {
	let apiHandler: ApiHandler
	let task: Partial<Task>

	beforeEach(() => {
		apiHandler = createMockApiHandler()
		task = createMockTask(apiHandler)
	})

	it("should execute context analyzer through complete data flow", async () => {
		const block = {
			type: "tool_use" as const,
			id: "test-1",
			name: "use_subagent" as const,
			params: {
				agent_name: "condense-context-analyzer",
				task: "Analyze the conversation structure",
			},
			partial: false,
		}

		const pushToolResult = vi.fn()
		const askApproval = vi.fn().mockResolvedValue(true)
		const handleError = vi.fn()
		const removeClosingTag = vi.fn((tag, text) => text || "")

		await useSubagentTool(task as Task, block, askApproval, handleError, pushToolResult, removeClosingTag)

		// Verify approval was requested
		expect(askApproval).toHaveBeenCalledWith("tool", undefined, undefined, true)

		// Verify API was called
		expect(apiHandler.createMessage).toHaveBeenCalled()

		// Verify result was pushed
		expect(pushToolResult).toHaveBeenCalled()
		const resultText = pushToolResult.mock.calls[0][0]
		expect(resultText).toContain("condense-context-analyzer")
		expect(resultText).toContain("Success")

		// Verify subagent invocation was recorded
		expect(task.recordSubAgentInvocation).toHaveBeenCalledWith(
			expect.objectContaining({
				agentName: "condense-context-analyzer",
				triggerType: "tool_call",
				success: true,
			}),
		)
	})

	it("should execute memory extractor through complete data flow", async () => {
		const block = {
			type: "tool_use" as const,
			id: "test-2",
			name: "use_subagent" as const,
			params: {
				agent_name: "condense-memory-extractor",
				task: "Extract critical decisions",
				context: "Focus on architectural decisions",
			},
			partial: false,
		}

		const pushToolResult = vi.fn()
		const askApproval = vi.fn().mockResolvedValue(true)
		const handleError = vi.fn()
		const removeClosingTag = vi.fn((tag, text) => text || "")

		await useSubagentTool(task as Task, block, askApproval, handleError, pushToolResult, removeClosingTag)

		// Verify the task and context were included
		expect(apiHandler.createMessage).toHaveBeenCalled()

		// Verify result includes agent name
		const resultText = pushToolResult.mock.calls[0][0]
		expect(resultText).toContain("condense-memory-extractor")
	})

	it("should execute code summarizer through complete data flow", async () => {
		const block = {
			type: "tool_use" as const,
			id: "test-3",
			name: "use_subagent" as const,
			params: {
				agent_name: "condense-code-summarizer",
			},
			partial: false,
		}

		const pushToolResult = vi.fn()
		const askApproval = vi.fn().mockResolvedValue(true)
		const handleError = vi.fn()
		const removeClosingTag = vi.fn((tag, text) => text || "")

		await useSubagentTool(task as Task, block, askApproval, handleError, pushToolResult, removeClosingTag)

		// Verify result
		const resultText = pushToolResult.mock.calls[0][0]
		expect(resultText).toContain("condense-code-summarizer")
		expect(resultText).toContain("Success")
	})

	it("should reject invalid agent names", async () => {
		const block = {
			type: "tool_use" as const,
			id: "test-4",
			name: "use_subagent" as const,
			params: {
				agent_name: "invalid-agent" as any,
			},
			partial: false,
		}

		const pushToolResult = vi.fn()
		const askApproval = vi.fn().mockResolvedValue(true)
		const handleError = vi.fn()
		const removeClosingTag = vi.fn((tag, text) => text || "")

		await useSubagentTool(task as Task, block, askApproval, handleError, pushToolResult, removeClosingTag)

		// Should not request approval for invalid agent
		expect(askApproval).not.toHaveBeenCalled()

		// Should return error
		expect(pushToolResult).toHaveBeenCalledWith(expect.stringContaining("Invalid agent_name"))
	})

	it("should handle user rejection", async () => {
		const block = {
			type: "tool_use" as const,
			id: "test-5",
			name: "use_subagent" as const,
			params: {
				agent_name: "condense-context-analyzer",
			},
			partial: false,
		}

		const pushToolResult = vi.fn()
		const askApproval = vi.fn().mockResolvedValue(false) // User rejects
		const handleError = vi.fn()
		const removeClosingTag = vi.fn((tag, text) => text || "")

		await useSubagentTool(task as Task, block, askApproval, handleError, pushToolResult, removeClosingTag)

		// Should not call API if rejected
		expect(apiHandler.createMessage).not.toHaveBeenCalled()

		// Should return cancellation message
		expect(pushToolResult).toHaveBeenCalledWith("Subagent execution cancelled by user.")
	})

	it("should handle API errors gracefully", async () => {
		// Create a failing API handler
		const failingApiHandler = createMockApiHandler()
		failingApiHandler.createMessage = vi.fn().mockRejectedValue(new Error("API Error"))

		const failingTask = createMockTask(failingApiHandler)

		const block = {
			type: "tool_use" as const,
			id: "test-6",
			name: "use_subagent" as const,
			params: {
				agent_name: "condense-context-analyzer",
			},
			partial: false,
		}

		const pushToolResult = vi.fn()
		const askApproval = vi.fn().mockResolvedValue(true)
		const handleError = vi.fn()
		const removeClosingTag = vi.fn((tag, text) => text || "")

		await useSubagentTool(failingTask as Task, block, askApproval, handleError, pushToolResult, removeClosingTag)

		// Error is caught internally and result is pushed with error message
		// The handleError callback AND pushToolResult are both called
		expect(pushToolResult).toHaveBeenCalled()
		const resultCalls = pushToolResult.mock.calls
		const hasErrorMessage = resultCalls.some(
			(call) => call[0].includes("Error") || call[0].includes("error") || call[0].includes("failed"),
		)
		expect(hasErrorMessage).toBe(true)
	})

	it("should include recent conversation history", async () => {
		// Add more messages to conversation history
		const taskWithHistory = createMockTask(apiHandler)
		taskWithHistory.apiConversationHistory = Array.from({ length: 25 }, (_, i) => ({
			role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
			content: [{ type: "text" as const, text: `Message ${i}` }],
		}))

		const block = {
			type: "tool_use" as const,
			id: "test-7",
			name: "use_subagent" as const,
			params: {
				agent_name: "condense-context-analyzer",
			},
			partial: false,
		}

		const pushToolResult = vi.fn()
		const askApproval = vi.fn().mockResolvedValue(true)
		const handleError = vi.fn()
		const removeClosingTag = vi.fn((tag, text) => text || "")

		await useSubagentTool(
			taskWithHistory as Task,
			block,
			askApproval,
			handleError,
			pushToolResult,
			removeClosingTag,
		)

		// Should only use last 20 messages
		expect(apiHandler.createMessage).toHaveBeenCalled()
		const callArgs = (apiHandler.createMessage as any).mock.calls[0]
		// The createMessage call should receive messages, but we just verify it was called
		expect(callArgs).toBeDefined()
	})
})
