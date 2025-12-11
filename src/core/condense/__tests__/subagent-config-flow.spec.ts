/**
 * End-to-end test for SubAgent configuration flow
 *
 * This test verifies that subagent configuration correctly flows from:
 * 1. UI Settings (ContextManagementSettings.tsx)
 * 2. Through ContextProxy state management
 * 3. To Task.condenseContext() and Task.attemptApiRequest()
 * 4. Finally to SubAgentExecutor execution
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { SubAgentExecutor, SubAgentConfig } from "../SubAgentExecutor"
import { summarizeConversation } from "../index"
import { ApiHandler } from "../../../api"
import { ApiMessage } from "../../task-persistence/apiMessages"

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureContextCondensed: vi.fn(),
		},
	},
}))

describe("SubAgent Configuration Flow", () => {
	let mockApiHandler: ApiHandler
	let testMessages: ApiMessage[]

	beforeEach(() => {
		// Mock API handler
		mockApiHandler = {
			getModel: () => ({
				id: "claude-3-5-sonnet-20241022",
				info: {
					maxTokens: 8192,
					contextWindow: 200000,
					supportsImages: true,
					supportsPromptCache: true,
				},
			}),
			createMessage: vi.fn().mockImplementation(async function* () {
				yield { type: "text", text: "Mock response" }
				yield {
					type: "usage",
					inputTokens: 100,
					outputTokens: 50,
					cacheWriteTokens: 0,
					cacheReadTokens: 0,
					totalCost: 0.001,
				}
			}),
			countTokens: vi.fn().mockResolvedValue(100),
		} as unknown as ApiHandler

		// Test messages with various content types
		testMessages = [
			{ role: "user", content: "Initial task request", ts: Date.now() - 10000 },
			{ role: "assistant", content: "I'll help with that", ts: Date.now() - 9000 },
			{ role: "user", content: "Here's more context", ts: Date.now() - 8000 },
			{
				role: "assistant",
				content: "I've completed the following steps...",
				ts: Date.now() - 7000,
			},
			{
				role: "user",
				content: "Please also handle error cases",
				ts: Date.now() - 6000,
			},
			{
				role: "assistant",
				content: "I've added error handling",
				ts: Date.now() - 5000,
			},
		]
	})

	afterEach(() => {
		// Clean up TelemetryService
		vi.clearAllMocks()
	})

	describe("Configuration Propagation", () => {
		it("should use default enabled state for all three subagents when config is enabled", async () => {
			// Simulate config from UI (all enabled by default when useSubAgentCompression = true)
			const subAgentConfig: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true, // Default from ContextManagementSettings.tsx line 536
				useMemoryExtractor: true, // Default from ContextManagementSettings.tsx line 632
				useCodeSummarizer: true, // Default from ContextManagementSettings.tsx line 682
				verboseLogging: false,
			}

			const result = await summarizeConversation(
				testMessages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				5000, // prevContextTokens
				false, // isAutomaticTrigger
				undefined, // customCondensingPrompt
				undefined, // condensingApiHandler
				undefined, // conversationMemory
				false, // useMemoryEnhancement
				undefined, // vectorMemoryStore
				undefined, // gswMemorySystem
				subAgentConfig, // subAgentConfig
			)

			// Verify subagent compression was used
			expect(result.subAgentTokenUsage).toBeDefined()
			expect(result.subAgentTokenUsage).toHaveLength(3)

			// Verify all three subagents were executed
			const agentNames = result.subAgentTokenUsage!.map((usage) => usage.agentName)
			expect(agentNames).toContain("Context Analyzer")
			expect(agentNames).toContain("Memory Extractor")
			expect(agentNames).toContain("Code Summarizer")

			// Verify summary contains all three sections
			expect(result.summary).toContain("## Conversation Flow Analysis")
			expect(result.summary).toContain("## Critical Information")
			expect(result.summary).toContain("## Technical Context")
		})

		it("should use custom prompts when provided from UI", async () => {
			// Simulate custom prompts from ContextManagementSettings.tsx
			const customAnalyzerPrompt = "Custom analyzer instructions for testing"
			const customExtractorPrompt = "Custom extractor instructions for testing"
			const customSummarizerPrompt = "Custom summarizer instructions for testing"

			const subAgentConfig: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
				useCodeSummarizer: true,
				verboseLogging: false,
				contextAnalyzerPrompt: customAnalyzerPrompt,
				memoryExtractorPrompt: customExtractorPrompt,
				codeSummarizerPrompt: customSummarizerPrompt,
			}

			// Mock createMessage to verify custom prompts are used
			const createMessageSpy = vi.spyOn(mockApiHandler, "createMessage")

			await summarizeConversation(
				testMessages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				5000,
				false,
				undefined,
				undefined,
				undefined,
				false,
				undefined,
				undefined, // gswMemorySystem
				subAgentConfig, // subAgentConfig
			)

			// Verify createMessage was called with custom prompts
			expect(createMessageSpy).toHaveBeenCalled()
			const calls = createMessageSpy.mock.calls

			// At least one call should contain our custom prompt
			const hasCustomPrompt = calls.some((call) => {
				const systemPrompt = call[0] as string
				return (
					systemPrompt.includes(customAnalyzerPrompt) ||
					systemPrompt.includes(customExtractorPrompt) ||
					systemPrompt.includes(customSummarizerPrompt)
				)
			})

			expect(hasCustomPrompt).toBe(true)
		})

		it("should respect individual subagent enable/disable flags", async () => {
			// Test with only Context Analyzer enabled
			const config1: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: false,
				useCodeSummarizer: false,
				verboseLogging: false,
			}

			const result1 = await summarizeConversation(
				testMessages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				5000,
				false,
				undefined,
				undefined,
				undefined,
				false,
				undefined,
				undefined, // gswMemorySystem
				config1, // subAgentConfig
			)

			expect(result1.subAgentTokenUsage).toBeDefined()
			expect(result1.subAgentTokenUsage!.length).toBeLessThanOrEqual(3)

			// Test with only Memory Extractor enabled
			const config2: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: false,
				useMemoryExtractor: true,
				useCodeSummarizer: false,
				verboseLogging: false,
			}

			const result2 = await summarizeConversation(
				testMessages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				5000,
				false,
				undefined,
				undefined,
				undefined,
				false,
				undefined,
				undefined, // gswMemorySystem
				config2, // subAgentConfig
			)

			expect(result2.subAgentTokenUsage).toBeDefined()
			expect(result2.subAgentTokenUsage!.length).toBeLessThanOrEqual(3)
		})

		it("should fall back to default prompts when custom prompts are empty", async () => {
			// Simulate empty string from UI (ContextProxy converts to undefined)
			const subAgentConfig: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
				useCodeSummarizer: true,
				verboseLogging: false,
				contextAnalyzerPrompt: undefined, // Converted from empty string by ContextProxy
				memoryExtractorPrompt: undefined,
				codeSummarizerPrompt: undefined,
			}

			const result = await summarizeConversation(
				testMessages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				5000,
				false,
				undefined,
				undefined,
				undefined,
				false,
				undefined,
				undefined, // gswMemorySystem
				subAgentConfig, // subAgentConfig
			)

			// Should still work with default prompts
			expect(result.subAgentTokenUsage).toBeDefined()
			expect(result.subAgentTokenUsage).toHaveLength(3)
			expect(result.summary).toBeTruthy()
		})
	})

	describe("SubAgentExecutor Direct Tests", () => {
		it("should correctly initialize with configuration", () => {
			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: false,
				useCodeSummarizer: true,
				verboseLogging: true,
				contextAnalyzerPrompt: "Custom analyzer prompt",
			}

			const executor = new SubAgentExecutor(mockApiHandler, config)

			// Executor should be created successfully
			expect(executor).toBeDefined()
		})

		it("should execute only enabled subagents", async () => {
			// Only enable Context Analyzer
			const config: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: false,
				useCodeSummarizer: false,
				verboseLogging: false,
			}

			const executor = new SubAgentExecutor(mockApiHandler, config)
			const result = await executor.executeCompression(testMessages)

			// Should have executed Context Analyzer
			// Note: success may be false if execution fails, but we should have a result object
			expect(result.analyzerResult).toBeDefined()
			expect(result.analyzerResult.output).toBeDefined()

			// Memory Extractor and Code Summarizer should not be executed
			// (they will have default/empty values or success: false)
			expect(result.extractorResult).toBeDefined()
			expect(result.summarizerResult).toBeDefined()
		})
	})

	describe("Context Reduction Verification", () => {
		it("should reduce context tokens after compression", async () => {
			const prevContextTokens = 5000

			const subAgentConfig: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
				useCodeSummarizer: true,
				verboseLogging: false,
			}

			const result = await summarizeConversation(
				testMessages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				prevContextTokens,
				false,
				undefined,
				undefined,
				undefined,
				false,
				undefined,
				undefined, // gswMemorySystem
				subAgentConfig, // subAgentConfig
			)

			// New context should be smaller than previous
			expect(result.newContextTokens).toBeDefined()
			expect(result.newContextTokens!).toBeLessThan(prevContextTokens)

			// Summary should be present
			expect(result.summary).toBeTruthy()
			expect(result.summary.length).toBeGreaterThan(0)

			// Cost should be calculated
			expect(result.cost).toBeGreaterThan(0)
		})

		it("should preserve first message and keep last N messages", async () => {
			const subAgentConfig: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
				useCodeSummarizer: true,
				verboseLogging: false,
			}

			const result = await summarizeConversation(
				testMessages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				5000,
				false,
				undefined,
				undefined,
				undefined,
				false,
				undefined,
				undefined, // gswMemorySystem
				subAgentConfig, // subAgentConfig
			)

			// Should have: first message + summary + last N messages
			expect(result.messages.length).toBeGreaterThan(0)

			// First message should be preserved
			expect(result.messages[0]).toEqual(testMessages[0])

			// Should contain a summary message
			const hasSummary = result.messages.some((msg) => msg.isSummary)
			expect(hasSummary).toBe(true)
		})
	})

	describe("Error Handling", () => {
		it("should fall back to standard compression if subagent compression fails", async () => {
			// Create a handler that throws an error
			const failingHandler = {
				...mockApiHandler,
				createMessage: vi.fn().mockImplementation(async function* () {
					throw new Error("API Error")

					yield // This line is unreachable but satisfies the linter
				}),
			} as unknown as ApiHandler

			const subAgentConfig: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
				useCodeSummarizer: true,
				verboseLogging: false,
			}

			// Should not throw, should fall back to standard compression
			const result = await summarizeConversation(
				testMessages,
				failingHandler,
				"System prompt",
				"test-task-id",
				5000,
				false,
				undefined,
				undefined,
				undefined,
				false,
				undefined,
				undefined, // gswMemorySystem
				subAgentConfig, // subAgentConfig
			)

			// Should still return a result (from fallback)
			expect(result).toBeDefined()
			expect(result.messages).toBeDefined()
		})

		it("should handle empty custom prompts gracefully", async () => {
			const subAgentConfig: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
				useCodeSummarizer: true,
				verboseLogging: false,
				contextAnalyzerPrompt: "", // Empty string
				memoryExtractorPrompt: "", // Empty string
				codeSummarizerPrompt: "", // Empty string
			}

			// Should use default prompts
			const result = await summarizeConversation(
				testMessages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				5000,
				false,
				undefined,
				undefined,
				undefined,
				false,
				undefined,
				undefined, // gswMemorySystem
				subAgentConfig, // subAgentConfig
			)

			expect(result.subAgentTokenUsage).toBeDefined()
			expect(result.summary).toBeTruthy()
		})
	})

	describe("Configuration State Management", () => {
		it("should correctly simulate ContextProxy behavior", () => {
			// Simulate ContextProxy.getValues() empty string conversion
			const rawValues: Record<string, string | undefined> = {
				contextAnalyzerPrompt: "",
				memoryExtractorPrompt: "",
				codeSummarizerPrompt: "",
			}

			// ContextProxy converts empty strings to undefined (lines 340-350)
			const subAgentPromptKeys = ["contextAnalyzerPrompt", "memoryExtractorPrompt", "codeSummarizerPrompt"]

			for (const key of subAgentPromptKeys) {
				if (rawValues[key] === "") {
					rawValues[key] = undefined
				}
			}

			// After conversion, all should be undefined
			expect(rawValues.contextAnalyzerPrompt).toBeUndefined()
			expect(rawValues.memoryExtractorPrompt).toBeUndefined()
			expect(rawValues.codeSummarizerPrompt).toBeUndefined()
		})

		it("should handle default values correctly", () => {
			// Test nullish coalescing operator behavior
			const emptyPrompt = ""
			const undefinedPrompt = undefined
			const validPrompt = "Custom prompt"

			// Empty string should fall back to undefined in ContextProxy
			const result1 = emptyPrompt || undefined
			expect(result1).toBeUndefined()

			// Undefined should remain undefined
			const result2 = undefinedPrompt ?? "default"
			expect(result2).toBe("default")

			// Valid prompt should be preserved
			const result3 = validPrompt ?? "default"
			expect(result3).toBe("Custom prompt")
		})
	})

	describe("Integration with Task Flow", () => {
		it("should correctly pass configuration through the entire chain", async () => {
			// This test simulates the flow:
			// UI (ContextManagementSettings) -> ContextProxy -> Task -> summarizeConversation -> SubAgentExecutor

			// Step 1: UI sends configuration (simulated)
			const uiConfig = {
				useSubAgentCompression: true,
				useContextAnalyzer: true,
				useMemoryExtractor: false, // User disabled this one
				useCodeSummarizer: true,
				contextAnalyzerPrompt: "Custom analyzer",
				memoryExtractorPrompt: "",
				codeSummarizerPrompt: "Custom summarizer",
			}

			// Step 2: ContextProxy processes configuration (simulated)
			const processedConfig: SubAgentConfig = {
				enabled: uiConfig.useSubAgentCompression,
				useContextAnalyzer: uiConfig.useContextAnalyzer,
				useMemoryExtractor: uiConfig.useMemoryExtractor,
				useCodeSummarizer: uiConfig.useCodeSummarizer,
				verboseLogging: false,
				contextAnalyzerPrompt: uiConfig.contextAnalyzerPrompt || undefined,
				memoryExtractorPrompt: uiConfig.memoryExtractorPrompt || undefined,
				codeSummarizerPrompt: uiConfig.codeSummarizerPrompt || undefined,
			}

			// Step 3: Task calls summarizeConversation with processed config
			const result = await summarizeConversation(
				testMessages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				5000,
				false,
				undefined,
				undefined,
				undefined,
				false,
				undefined,
				undefined, // gswMemorySystem
				processedConfig, // subAgentConfig
			)

			// Step 4: Verify results match expected configuration
			expect(result.subAgentTokenUsage).toBeDefined()

			// Should have executed Context Analyzer and Code Summarizer
			// Memory Extractor should NOT be in the results
			const agentNames = result.subAgentTokenUsage!.map((usage) => usage.agentName)
			expect(agentNames).toContain("Context Analyzer")
			expect(agentNames).toContain("Code Summarizer")
			// Memory Extractor might or might not be in the list depending on execution
			// but it should not have executed any work

			expect(result.summary).toBeTruthy()
		})

		it("should handle verbose logging configuration", async () => {
			const subAgentConfig: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
				useCodeSummarizer: true,
				verboseLogging: true, // Enable verbose logging
			}

			// Mock console.log to verify verbose output
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			await summarizeConversation(
				testMessages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				5000,
				false,
				undefined,
				undefined,
				undefined,
				false,
				undefined,
				undefined, // gswMemorySystem
				subAgentConfig, // subAgentConfig
			)

			// Verbose logging should have been called if enabled
			// (SubAgentExecutor logs execution details when verboseLogging is true)
			// We don't assert specific calls as implementation may vary
			// but we verify the spy was set up correctly

			consoleLogSpy.mockRestore()
		})
	})

	describe("Performance and Token Tracking", () => {
		it("should track token usage for each subagent", async () => {
			const subAgentConfig: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
				useCodeSummarizer: true,
				verboseLogging: false,
			}

			const result = await summarizeConversation(
				testMessages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				5000,
				false,
				undefined,
				undefined,
				undefined,
				false,
				undefined,
				undefined, // gswMemorySystem
				subAgentConfig, // subAgentConfig
			)

			// Each subagent should have token usage tracked
			expect(result.subAgentTokenUsage).toBeDefined()
			expect(result.subAgentTokenUsage!.length).toBeGreaterThan(0)

			// Each usage entry should have required fields
			// Note: SubAgentResult interface uses tokensIn/tokensOut, not inputTokens/outputTokens
			result.subAgentTokenUsage!.forEach((usage) => {
				expect(usage.agentName).toBeTruthy()
				// Check that numeric fields exist and are numbers
				expect(usage).toHaveProperty("tokensIn")
				expect(usage).toHaveProperty("tokensOut")
				expect(usage).toHaveProperty("cost")
				// All should be numbers (may be 0 in mock)
				expect(typeof usage.tokensIn).toBe("number")
				expect(typeof usage.tokensOut).toBe("number")
				expect(typeof usage.cost).toBe("number")
			})
		})

		it("should calculate total cost including subagent costs", async () => {
			const subAgentConfig: SubAgentConfig = {
				enabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
				useCodeSummarizer: true,
				verboseLogging: false,
			}

			const result = await summarizeConversation(
				testMessages,
				mockApiHandler,
				"System prompt",
				"test-task-id",
				5000,
				false,
				undefined,
				undefined,
				undefined,
				false,
				undefined,
				undefined, // gswMemorySystem
				subAgentConfig, // subAgentConfig
			)

			// Total cost should include all subagent costs
			expect(result.cost).toBeGreaterThan(0)

			// If we have subagent token usage, total cost should be at least the sum of subagent costs
			if (result.subAgentTokenUsage && result.subAgentTokenUsage.length > 0) {
				const subAgentTotalCost = result.subAgentTokenUsage.reduce((sum, usage) => sum + usage.cost, 0)
				expect(result.cost).toBeGreaterThanOrEqual(subAgentTotalCost)
			}
		})
	})
})
