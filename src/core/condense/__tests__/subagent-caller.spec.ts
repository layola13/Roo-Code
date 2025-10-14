import { describe, it, expect, vi, beforeEach } from "vitest"
import {
	executeSubAgentCompression,
	shouldUseSubAgentCompression,
	SubAgentConfig,
	SubAgentResult,
} from "../subagent-caller"
import { ApiMessage } from "../../task-persistence/apiMessages"
import { Task } from "../../task/Task"

// Mock Task class
const createMockTask = (completionText: string = "Mock subagent output") => {
	const mockSubTask = {
		clineMessages: [
			{
				type: "say",
				text: completionText,
				ts: Date.now(),
			},
		],
		getTokenUsage: vi.fn().mockReturnValue({
			totalTokensIn: 100,
			totalTokensOut: 50,
			totalCost: 0.005,
		}),
	}

	const mockTask = {
		startSubtask: vi.fn().mockResolvedValue(mockSubTask),
		waitForSubtask: vi.fn().mockResolvedValue(undefined),
		completeSubtask: vi.fn().mockResolvedValue(undefined),
	} as unknown as Task

	return { mockTask, mockSubTask }
}

describe("Subagent Caller", () => {
	describe("shouldUseSubAgentCompression", () => {
		it("should return false when config is undefined", () => {
			expect(shouldUseSubAgentCompression(undefined)).toBe(false)
		})

		it("should return false when config.enabled is false", () => {
			const config: SubAgentConfig = {
				enabled: false,
				useContextAnalyzer: true,
			}
			expect(shouldUseSubAgentCompression(config)).toBe(false)
		})

		it("should return false when no subagents are enabled", () => {
			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: false,
				useMemoryExtractor: false,
				useCodeSummarizer: false,
			}
			expect(shouldUseSubAgentCompression(config)).toBe(false)
		})

		it("should return true when context analyzer is enabled", () => {
			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
			}
			expect(shouldUseSubAgentCompression(config)).toBe(true)
		})

		it("should return true when memory extractor is enabled", () => {
			const config: SubAgentConfig = {
				enabled: true,
				useMemoryExtractor: true,
			}
			expect(shouldUseSubAgentCompression(config)).toBe(true)
		})

		it("should return true when code summarizer is enabled", () => {
			const config: SubAgentConfig = {
				enabled: true,
				useCodeSummarizer: true,
			}
			expect(shouldUseSubAgentCompression(config)).toBe(true)
		})

		it("should return true when multiple subagents are enabled", () => {
			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
				useCodeSummarizer: true,
			}
			expect(shouldUseSubAgentCompression(config)).toBe(true)
		})
	})

	describe("executeSubAgentCompression", () => {
		const testMessages: ApiMessage[] = [
			{
				role: "user",
				content: "Create a blog application",
				ts: Date.now(),
			},
			{
				role: "assistant",
				content: "I'll create a blog application for you.",
				ts: Date.now(),
			},
			{
				role: "user",
				content: "Use MongoDB database",
				ts: Date.now(),
			},
		]

		beforeEach(() => {
			vi.clearAllMocks()
		})

		it("should execute context analyzer when enabled", async () => {
			const { mockTask } = createMockTask("Context analysis result")
			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
			}

			const result = await executeSubAgentCompression(testMessages, config, mockTask)

			expect(result.success).toBe(true)
			expect(result.analyzerResult.success).toBe(true)
			expect(result.analyzerResult.output).toBe("Context analysis result")
			expect(result.analyzerResult.tokensIn).toBe(100)
			expect(result.analyzerResult.tokensOut).toBe(50)
			expect(result.analyzerResult.cost).toBe(0.005)
			expect(mockTask.startSubtask).toHaveBeenCalledTimes(1)
		})

		it("should execute memory extractor when enabled", async () => {
			const { mockTask } = createMockTask("Memory extraction result")
			const config: SubAgentConfig = {
				enabled: true,
				useMemoryExtractor: true,
			}

			const result = await executeSubAgentCompression(testMessages, config, mockTask)

			expect(result.success).toBe(true)
			expect(result.extractorResult.success).toBe(true)
			expect(result.extractorResult.output).toBe("Memory extraction result")
			expect(mockTask.startSubtask).toHaveBeenCalledTimes(1)
		})

		it("should execute code summarizer when enabled", async () => {
			const { mockTask } = createMockTask("Code summary result")
			const config: SubAgentConfig = {
				enabled: true,
				useCodeSummarizer: true,
			}

			const result = await executeSubAgentCompression(testMessages, config, mockTask)

			expect(result.success).toBe(true)
			expect(result.summarizerResult.success).toBe(true)
			expect(result.summarizerResult.output).toBe("Code summary result")
			expect(mockTask.startSubtask).toHaveBeenCalledTimes(1)
		})

		it("should execute multiple subagents sequentially", async () => {
			const { mockTask } = createMockTask("Subagent output")
			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
				useCodeSummarizer: true,
			}

			const result = await executeSubAgentCompression(testMessages, config, mockTask)

			expect(result.success).toBe(true)
			expect(result.analyzerResult.success).toBe(true)
			expect(result.extractorResult.success).toBe(true)
			expect(result.summarizerResult.success).toBe(true)
			expect(mockTask.startSubtask).toHaveBeenCalledTimes(3)
			expect(mockTask.waitForSubtask).toHaveBeenCalledTimes(3)
			expect(mockTask.completeSubtask).toHaveBeenCalledTimes(3)
		})

		it("should calculate total cost correctly", async () => {
			const mockSubTask = {
				clineMessages: [
					{
						type: "say",
						text: "Output",
						ts: Date.now(),
					},
				],
				getTokenUsage: vi.fn().mockReturnValue({
					totalTokensIn: 100,
					totalTokensOut: 50,
					totalCost: 0.01,
				}),
			}

			const mockTask = {
				startSubtask: vi.fn().mockResolvedValue(mockSubTask),
				waitForSubtask: vi.fn().mockResolvedValue(undefined),
				completeSubtask: vi.fn().mockResolvedValue(undefined),
			} as unknown as Task

			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
			}

			const result = await executeSubAgentCompression(testMessages, config, mockTask)

			expect(result.totalCost).toBe(0.02) // 0.01 * 2 subagents
		})

		it("should handle subagent task creation failure", async () => {
			const mockTask = {
				startSubtask: vi.fn().mockResolvedValue(null),
				waitForSubtask: vi.fn(),
				completeSubtask: vi.fn(),
			} as unknown as Task

			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
			}

			const result = await executeSubAgentCompression(testMessages, config, mockTask)

			expect(result.success).toBe(false)
			expect(result.analyzerResult.success).toBe(false)
			expect(result.analyzerResult.error).toContain("Failed to create subtask")
		})

		it("should handle subagent with no output", async () => {
			const mockSubTask = {
				clineMessages: [],
				getTokenUsage: vi.fn().mockReturnValue({
					totalTokensIn: 0,
					totalTokensOut: 0,
					totalCost: 0,
				}),
			}

			const mockTask = {
				startSubtask: vi.fn().mockResolvedValue(mockSubTask),
				waitForSubtask: vi.fn().mockResolvedValue(undefined),
				completeSubtask: vi.fn().mockResolvedValue(undefined),
			} as unknown as Task

			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
			}

			const result = await executeSubAgentCompression(testMessages, config, mockTask)

			expect(result.success).toBe(false)
			expect(result.analyzerResult.success).toBe(false)
			expect(result.analyzerResult.error).toContain("No valid output")
		})

		it("should handle exceptions during execution", async () => {
			const mockTask = {
				startSubtask: vi.fn().mockRejectedValue(new Error("Network error")),
				waitForSubtask: vi.fn(),
				completeSubtask: vi.fn(),
			} as unknown as Task

			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
			}

			const result = await executeSubAgentCompression(testMessages, config, mockTask)

			expect(result.success).toBe(false)
			// When a subagent fails, the error is stored in the individual result
			expect(result.analyzerResult.error).toContain("Network error")
		})

		it("should log verbose output when enabled", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
			const { mockTask } = createMockTask("Output")

			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				verboseLogging: true,
			}

			await executeSubAgentCompression(testMessages, config, mockTask)

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("[SubAgent Compression]"),
				expect.anything(),
			)

			consoleSpy.mockRestore()
		})

		it("should handle messages with array content", async () => {
			const { mockTask } = createMockTask("Array content result")
			const messagesWithArrayContent: ApiMessage[] = [
				{
					role: "user",
					content: [
						{ type: "text", text: "Check this code" },
						{ type: "text", text: "and fix errors" },
					],
					ts: Date.now(),
				},
			]

			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
			}

			const result = await executeSubAgentCompression(messagesWithArrayContent, config, mockTask)

			expect(result.success).toBe(true)
			expect(mockTask.startSubtask).toHaveBeenCalledWith(
				expect.stringContaining("Check this code"),
				expect.anything(),
				expect.anything(),
			)
		})

		it("should return default results when no subagents are executed", async () => {
			const { mockTask } = createMockTask()
			const config: SubAgentConfig = {
				enabled: true,
				// All subagents disabled
			}

			const result = await executeSubAgentCompression(testMessages, config, mockTask)

			expect(result.success).toBe(false)
			expect(result.error).toBe("All subagent calls failed")
			expect(result.analyzerResult.error).toBe("Not executed")
			expect(result.extractorResult.error).toBe("Not executed")
			expect(result.summarizerResult.error).toBe("Not executed")
		})

		it("should track token usage for each subagent separately", async () => {
			let callCount = 0
			const mockSubTask = {
				clineMessages: [
					{
						type: "say",
						text: "Output",
						ts: Date.now(),
					},
				],
				getTokenUsage: vi.fn(() => {
					callCount++
					return {
						totalTokensIn: callCount * 100,
						totalTokensOut: callCount * 50,
						totalCost: callCount * 0.01,
					}
				}),
			}

			const mockTask = {
				startSubtask: vi.fn().mockResolvedValue(mockSubTask),
				waitForSubtask: vi.fn().mockResolvedValue(undefined),
				completeSubtask: vi.fn().mockResolvedValue(undefined),
			} as unknown as Task

			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
			}

			const result = await executeSubAgentCompression(testMessages, config, mockTask)

			expect(result.analyzerResult.tokensIn).toBe(100)
			expect(result.analyzerResult.tokensOut).toBe(50)
			expect(result.extractorResult.tokensIn).toBe(200)
			expect(result.extractorResult.tokensOut).toBe(100)
		})
	})
})
