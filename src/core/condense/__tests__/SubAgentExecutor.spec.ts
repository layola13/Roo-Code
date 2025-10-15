import { describe, it, expect, vi, beforeEach } from "vitest"
import {
	SubAgentExecutor,
	executeSubAgentCompression,
	shouldUseSubAgentCompression,
	SubAgentConfig,
} from "../SubAgentExecutor"
import { ApiMessage } from "../../task-persistence/apiMessages"
import { ApiHandler } from "../../../api/index"

// Mock ApiHandler
const createMockApiHandler = (responseText: string = "Mock subagent output") => {
	const mockStream = {
		on: vi.fn((event: string, handler: (...args: any[]) => void) => {
			if (event === "text") {
				handler(responseText)
			} else if (event === "usage") {
				handler({
					inputTokens: 100,
					outputTokens: 50,
					totalCost: 0.005,
				})
			} else if (event === "end") {
				setTimeout(() => handler(), 0)
			}
			return mockStream
		}),
	}

	const mockApiHandler = {
		createMessage: vi.fn().mockResolvedValue(mockStream),
		getModel: vi.fn().mockReturnValue({
			id: "test-model",
			info: { maxTokens: 100000 },
		}),
	} as unknown as ApiHandler

	return { mockApiHandler, mockStream }
}

describe("SubAgentExecutor", () => {
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

	describe("SubAgentExecutor", () => {
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
			const { mockApiHandler } = createMockApiHandler("Context analysis result")
			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
			}

			const executor = new SubAgentExecutor(mockApiHandler, config)
			const result = await executor.executeCompression(testMessages)

			expect(result.success).toBe(true)
			expect(result.analyzerResult.success).toBe(true)
			expect(result.analyzerResult.output).toBe("Context analysis result")
			expect(result.analyzerResult.tokensIn).toBe(100)
			expect(result.analyzerResult.tokensOut).toBe(50)
			expect(result.analyzerResult.cost).toBe(0.005)
			expect(mockApiHandler.createMessage).toHaveBeenCalledTimes(1)
		})

		it("should execute memory extractor when enabled", async () => {
			const { mockApiHandler } = createMockApiHandler("Memory extraction result")
			const config: SubAgentConfig = {
				enabled: true,
				useMemoryExtractor: true,
			}

			const executor = new SubAgentExecutor(mockApiHandler, config)
			const result = await executor.executeCompression(testMessages)

			expect(result.success).toBe(true)
			expect(result.extractorResult.success).toBe(true)
			expect(result.extractorResult.output).toBe("Memory extraction result")
			expect(mockApiHandler.createMessage).toHaveBeenCalledTimes(1)
		})

		it("should execute code summarizer when enabled", async () => {
			const { mockApiHandler } = createMockApiHandler("Code summary result")
			const config: SubAgentConfig = {
				enabled: true,
				useCodeSummarizer: true,
			}

			const executor = new SubAgentExecutor(mockApiHandler, config)
			const result = await executor.executeCompression(testMessages)

			expect(result.success).toBe(true)
			expect(result.summarizerResult.success).toBe(true)
			expect(result.summarizerResult.output).toBe("Code summary result")
			expect(mockApiHandler.createMessage).toHaveBeenCalledTimes(1)
		})

		it("should execute multiple subagents sequentially", async () => {
			const { mockApiHandler } = createMockApiHandler("Subagent output")
			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
				useCodeSummarizer: true,
			}

			const executor = new SubAgentExecutor(mockApiHandler, config)
			const result = await executor.executeCompression(testMessages)

			expect(result.success).toBe(true)
			expect(result.analyzerResult.success).toBe(true)
			expect(result.extractorResult.success).toBe(true)
			expect(result.summarizerResult.success).toBe(true)
			expect(mockApiHandler.createMessage).toHaveBeenCalledTimes(3)
		})

		it("should calculate total cost correctly", async () => {
			let callCount = 0
			const mockStream = {
				on: vi.fn((event: string, handler: (...args: any[]) => void) => {
					if (event === "text") {
						handler("Output")
					} else if (event === "usage") {
						callCount++
						handler({
							inputTokens: 100,
							outputTokens: 50,
							totalCost: 0.01,
						})
					} else if (event === "end") {
						setTimeout(() => handler(), 0)
					}
					return mockStream
				}),
			}

			const mockApiHandler = {
				createMessage: vi.fn().mockResolvedValue(mockStream),
				getModel: vi.fn().mockReturnValue({
					id: "test-model",
					info: { maxTokens: 100000 },
				}),
			} as unknown as ApiHandler

			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
			}

			const executor = new SubAgentExecutor(mockApiHandler, config)
			const result = await executor.executeCompression(testMessages)

			expect(result.totalCost).toBe(0.02) // 0.01 * 2 subagents
		})

		it("should handle API call failure", async () => {
			const mockApiHandler = {
				createMessage: vi.fn().mockRejectedValue(new Error("Network error")),
				getModel: vi.fn().mockReturnValue({
					id: "test-model",
					info: { maxTokens: 100000 },
				}),
			} as unknown as ApiHandler

			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
			}

			const executor = new SubAgentExecutor(mockApiHandler, config)
			const result = await executor.executeCompression(testMessages)

			expect(result.success).toBe(false)
			expect(result.analyzerResult.success).toBe(false)
			expect(result.analyzerResult.error).toContain("Network error")
		})

		it("should handle stream with no text output", async () => {
			const mockStream = {
				on: vi.fn((event: string, handler: (...args: any[]) => void) => {
					if (event === "usage") {
						handler({
							inputTokens: 0,
							outputTokens: 0,
							totalCost: 0,
						})
					} else if (event === "end") {
						setTimeout(() => handler(), 0)
					}
					return mockStream
				}),
			}

			const mockApiHandler = {
				createMessage: vi.fn().mockResolvedValue(mockStream),
				getModel: vi.fn().mockReturnValue({
					id: "test-model",
					info: { maxTokens: 100000 },
				}),
			} as unknown as ApiHandler

			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
			}

			const executor = new SubAgentExecutor(mockApiHandler, config)
			const result = await executor.executeCompression(testMessages)

			expect(result.success).toBe(false)
			expect(result.analyzerResult.success).toBe(false)
			expect(result.analyzerResult.error).toContain("No valid output")
		})

		it("should log verbose output when enabled", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
			const { mockApiHandler } = createMockApiHandler("Output")

			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				verboseLogging: true,
			}

			const executor = new SubAgentExecutor(mockApiHandler, config)
			await executor.executeCompression(testMessages)

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("[SubAgent Compression]"),
				expect.anything(),
			)

			consoleSpy.mockRestore()
		})

		it("should handle messages with array content", async () => {
			const { mockApiHandler } = createMockApiHandler("Array content result")
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

			const executor = new SubAgentExecutor(mockApiHandler, config)
			const result = await executor.executeCompression(messagesWithArrayContent)

			expect(result.success).toBe(true)
			expect(mockApiHandler.createMessage).toHaveBeenCalled()
		})

		it("should return error when no subagents are executed", async () => {
			const { mockApiHandler } = createMockApiHandler()
			const config: SubAgentConfig = {
				enabled: true,
				// All subagents disabled
			}

			const executor = new SubAgentExecutor(mockApiHandler, config)
			const result = await executor.executeCompression(testMessages)

			expect(result.success).toBe(false)
			expect(result.error).toBe("All subagent calls failed")
			expect(result.analyzerResult.error).toBe("Not executed")
			expect(result.extractorResult.error).toBe("Not executed")
			expect(result.summarizerResult.error).toBe("Not executed")
		})

		it("should track token usage for each subagent separately", async () => {
			let callCount = 0
			const mockStream = {
				on: vi.fn((event: string, handler: (...args: any[]) => void) => {
					if (event === "text") {
						handler("Output")
					} else if (event === "usage") {
						callCount++
						handler({
							inputTokens: callCount * 100,
							outputTokens: callCount * 50,
							totalCost: callCount * 0.01,
						})
					} else if (event === "end") {
						setTimeout(() => handler(), 0)
					}
					return mockStream
				}),
			}

			const mockApiHandler = {
				createMessage: vi.fn().mockResolvedValue(mockStream),
				getModel: vi.fn().mockReturnValue({
					id: "test-model",
					info: { maxTokens: 100000 },
				}),
			} as unknown as ApiHandler

			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
			}

			const executor = new SubAgentExecutor(mockApiHandler, config)
			const result = await executor.executeCompression(testMessages)

			expect(result.analyzerResult.tokensIn).toBe(100)
			expect(result.analyzerResult.tokensOut).toBe(50)
			expect(result.extractorResult.tokensIn).toBe(200)
			expect(result.extractorResult.tokensOut).toBe(100)
		})
	})

	describe("executeSubAgentCompression (convenience function)", () => {
		const testMessages: ApiMessage[] = [
			{
				role: "user",
				content: "Test message",
				ts: Date.now(),
			},
		]

		it("should work as a convenience wrapper", async () => {
			const { mockApiHandler } = createMockApiHandler("Test output")
			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
			}

			const result = await executeSubAgentCompression(testMessages, config, mockApiHandler)

			expect(result.success).toBe(true)
			expect(result.analyzerResult.output).toBe("Test output")
		})
	})
})
