// npx vitest run src/shared/__tests__/getApiMetrics.spec.ts

import type { ClineMessage } from "@roo-code/types"

import { getApiMetrics } from "../getApiMetrics"

describe("getApiMetrics", () => {
	// Helper function to create a basic api_req_started message
	const createApiReqStartedMessage = (
		text: string = '{"tokensIn":10,"tokensOut":20}',
		ts: number = 1000,
	): ClineMessage => ({
		type: "say",
		say: "api_req_started",
		text,
		ts,
	})

	// Helper function to create a condense_context message
	const createCondenseContextMessage = (
		cost: number = 0.002,
		newContextTokens: number = 500,
		prevContextTokens: number = 1000,
		ts: number = 2000,
	): ClineMessage => ({
		type: "say",
		say: "condense_context",
		contextCondense: {
			cost,
			newContextTokens,
			prevContextTokens,
			summary: "Context was condensed",
		},
		ts,
	})

	// Helper function to create a non-API message
	const createOtherMessage = (
		say: "text" | "error" | "reasoning" | "completion_result" = "text",
		text: string = "Hello world",
		ts: number = 999,
	): ClineMessage => ({
		type: "say",
		say,
		text,
		ts,
	})

	describe("Basic functionality", () => {
		it("should calculate metrics from a single api_req_started message", () => {
			const messages: ClineMessage[] = [
				createApiReqStartedMessage(
					'{"tokensIn":100,"tokensOut":200,"cacheWrites":5,"cacheReads":10,"cost":0.005}',
				),
			]

			const result = getApiMetrics(messages)

			expect(result.totalTokensIn).toBe(100)
			expect(result.totalTokensOut).toBe(200)
			expect(result.totalCacheWrites).toBe(5)
			expect(result.totalCacheReads).toBe(10)
			expect(result.totalCost).toBe(0.005)
			expect(result.contextTokens).toBe(300) // 100 + 200 (OpenAI default, no cache tokens)
		})

		it("should calculate metrics from multiple api_req_started messages", () => {
			const messages: ClineMessage[] = [
				createApiReqStartedMessage(
					'{"tokensIn":100,"tokensOut":200,"cacheWrites":5,"cacheReads":10,"cost":0.005}',
					1000,
				),
				createApiReqStartedMessage(
					'{"tokensIn":50,"tokensOut":150,"cacheWrites":3,"cacheReads":7,"cost":0.003}',
					2000,
				),
			]

			const result = getApiMetrics(messages)

			expect(result.totalTokensIn).toBe(150) // 100 + 50
			expect(result.totalTokensOut).toBe(350) // 200 + 150
			expect(result.totalCacheWrites).toBe(8) // 5 + 3
			expect(result.totalCacheReads).toBe(17) // 10 + 7
			expect(result.totalCost).toBe(0.008) // 0.005 + 0.003
			expect(result.contextTokens).toBe(200) // 50 + 150 (OpenAI default, no cache tokens)
		})

		it("should calculate metrics from condense_context messages", () => {
			const messages: ClineMessage[] = [
				createCondenseContextMessage(0.002, 500, 1000, 1000),
				createCondenseContextMessage(0.003, 400, 800, 2000),
			]

			const result = getApiMetrics(messages)

			expect(result.totalTokensIn).toBe(0)
			expect(result.totalTokensOut).toBe(0)
			expect(result.totalCacheWrites).toBeUndefined()
			expect(result.totalCacheReads).toBeUndefined()
			expect(result.totalCost).toBe(0.005) // 0.002 + 0.003
			expect(result.contextTokens).toBe(400) // newContextTokens from the last condense_context message
		})

		it("should calculate metrics from mixed message types", () => {
			const messages: ClineMessage[] = [
				createApiReqStartedMessage(
					'{"tokensIn":100,"tokensOut":200,"cacheWrites":5,"cacheReads":10,"cost":0.005}',
					1000,
				),
				createOtherMessage("text", "Some text", 1500),
				createCondenseContextMessage(0.002, 500, 1000, 2000),
				createApiReqStartedMessage(
					'{"tokensIn":50,"tokensOut":150,"cacheWrites":3,"cacheReads":7,"cost":0.003}',
					3000,
				),
			]

			const result = getApiMetrics(messages)

			expect(result.totalTokensIn).toBe(150) // 100 + 50
			expect(result.totalTokensOut).toBe(350) // 200 + 150
			expect(result.totalCacheWrites).toBe(8) // 5 + 3
			expect(result.totalCacheReads).toBe(17) // 10 + 7
			expect(result.totalCost).toBe(0.01) // 0.005 + 0.002 + 0.003
			expect(result.contextTokens).toBe(200) // 50 + 150 (OpenAI default, no cache tokens)
		})
	})

	describe("Edge cases", () => {
		it("should handle empty messages array", () => {
			const result = getApiMetrics([])

			expect(result.totalTokensIn).toBe(0)
			expect(result.totalTokensOut).toBe(0)
			expect(result.totalCacheWrites).toBeUndefined()
			expect(result.totalCacheReads).toBeUndefined()
			expect(result.totalCost).toBe(0)
			expect(result.contextTokens).toBe(0)
		})

		it("should handle messages with no API metrics", () => {
			const messages: ClineMessage[] = [
				createOtherMessage("text", "Message 1", 1000),
				createOtherMessage("error", "Error message", 2000),
			]

			const result = getApiMetrics(messages)

			expect(result.totalTokensIn).toBe(0)
			expect(result.totalTokensOut).toBe(0)
			expect(result.totalCacheWrites).toBeUndefined()
			expect(result.totalCacheReads).toBeUndefined()
			expect(result.totalCost).toBe(0)
			expect(result.contextTokens).toBe(0)
		})

		it("should handle invalid JSON in api_req_started message", () => {
			// We need to mock console.error to avoid polluting test output
			const originalConsoleError = console.error
			console.error = vi.fn()

			const messages: ClineMessage[] = [
				{
					type: "say",
					say: "api_req_started",
					text: "This is not valid JSON",
					ts: 1000,
				},
			]

			const result = getApiMetrics(messages)

			// Should not throw and should return default values
			expect(result.totalTokensIn).toBe(0)
			expect(result.totalTokensOut).toBe(0)
			expect(result.totalCacheWrites).toBeUndefined()
			expect(result.totalCacheReads).toBeUndefined()
			expect(result.totalCost).toBe(0)
			expect(result.contextTokens).toBe(0)

			// Restore console.error
			console.error = originalConsoleError
		})

		it("should handle missing text field in api_req_started message", () => {
			const messages: ClineMessage[] = [
				{
					type: "say",
					say: "api_req_started",
					ts: 1000,
					// text field is missing
				},
			]

			const result = getApiMetrics(messages)

			// Should not throw and should return default values
			expect(result.totalTokensIn).toBe(0)
			expect(result.totalTokensOut).toBe(0)
			expect(result.totalCacheWrites).toBeUndefined()
			expect(result.totalCacheReads).toBeUndefined()
			expect(result.totalCost).toBe(0)
			expect(result.contextTokens).toBe(0)
		})

		it("should handle missing contextCondense field in condense_context message", () => {
			const messages: ClineMessage[] = [
				{
					type: "say",
					say: "condense_context",
					ts: 1000,
					// contextCondense field is missing
				},
			]

			const result = getApiMetrics(messages)

			// Should not throw and should return default values
			expect(result.totalTokensIn).toBe(0)
			expect(result.totalTokensOut).toBe(0)
			expect(result.totalCacheWrites).toBeUndefined()
			expect(result.totalCacheReads).toBeUndefined()
			expect(result.totalCost).toBe(0)
			expect(result.contextTokens).toBe(0)
		})

		it("should handle partial metrics in api_req_started message", () => {
			const messages: ClineMessage[] = [
				createApiReqStartedMessage('{"tokensIn":100}', 1000), // Only tokensIn
				createApiReqStartedMessage('{"tokensOut":200}', 2000), // Only tokensOut
				createApiReqStartedMessage('{"cacheWrites":5}', 3000), // Only cacheWrites
				createApiReqStartedMessage('{"cacheReads":10}', 4000), // Only cacheReads
				createApiReqStartedMessage('{"cost":0.005}', 5000), // Only cost
			]

			const result = getApiMetrics(messages)

			expect(result.totalTokensIn).toBe(100)
			expect(result.totalTokensOut).toBe(200)
			expect(result.totalCacheWrites).toBe(5)
			expect(result.totalCacheReads).toBe(10)
			expect(result.totalCost).toBe(0.005)

			// The implementation will use the last message that has any tokens
			// In this case, it's the message with tokensOut:200 (since the last few messages have no tokensIn/Out)
			expect(result.contextTokens).toBe(200) // 0 + 200 (from the tokensOut message)
		})

		it("should handle non-number values in api_req_started message", () => {
			const messages: ClineMessage[] = [
				// Use string values that can be parsed as JSON but aren't valid numbers for the metrics
				createApiReqStartedMessage(
					'{"tokensIn":"not-a-number","tokensOut":"not-a-number","cacheWrites":"not-a-number","cacheReads":"not-a-number","cost":"not-a-number"}',
				),
			]

			const result = getApiMetrics(messages)

			// Non-number values should be ignored
			expect(result.totalTokensIn).toBe(0)
			expect(result.totalTokensOut).toBe(0)
			expect(result.totalCacheWrites).toBeUndefined()
			expect(result.totalCacheReads).toBeUndefined()
			expect(result.totalCost).toBe(0)

			// The implementation concatenates all token values including cache tokens
			expect(result.contextTokens).toBe("not-a-numbernot-a-number") // tokensIn + tokensOut (OpenAI default)
		})
	})

	describe("Context tokens calculation", () => {
		it("should calculate contextTokens from the last api_req_started message", () => {
			const messages: ClineMessage[] = [
				createApiReqStartedMessage('{"tokensIn":100,"tokensOut":200,"cacheWrites":5,"cacheReads":10}', 1000),
				createApiReqStartedMessage('{"tokensIn":50,"tokensOut":150,"cacheWrites":3,"cacheReads":7}', 2000),
			]

			const result = getApiMetrics(messages)

			// Should use the values from the last api_req_started message
			expect(result.contextTokens).toBe(200) // 50 + 150 (OpenAI default, no cache tokens)
		})

		it("should calculate contextTokens from the last condense_context message", () => {
			const messages: ClineMessage[] = [
				createApiReqStartedMessage('{"tokensIn":100,"tokensOut":200,"cacheWrites":5,"cacheReads":10}', 1000),
				createCondenseContextMessage(0.002, 500, 1000, 2000),
			]

			const result = getApiMetrics(messages)

			// Should use newContextTokens from the last condense_context message
			expect(result.contextTokens).toBe(500)
		})

		it("should prioritize the last message for contextTokens calculation", () => {
			const messages: ClineMessage[] = [
				createCondenseContextMessage(0.002, 500, 1000, 1000),
				createApiReqStartedMessage('{"tokensIn":100,"tokensOut":200,"cacheWrites":5,"cacheReads":10}', 2000),
				createCondenseContextMessage(0.003, 400, 800, 3000),
				createApiReqStartedMessage('{"tokensIn":50,"tokensOut":150,"cacheWrites":3,"cacheReads":7}', 4000),
			]

			const result = getApiMetrics(messages)

			// Should use the values from the last api_req_started message
			expect(result.contextTokens).toBe(200) // 50 + 150 (OpenAI default, no cache tokens)
		})

		it("should handle missing values when calculating contextTokens", () => {
			// We need to mock console.error to avoid polluting test output
			const originalConsoleError = console.error
			console.error = vi.fn()

			const messages: ClineMessage[] = [
				createApiReqStartedMessage('{"tokensIn":null,"cacheWrites":5,"cacheReads":10}', 1000),
			]

			const result = getApiMetrics(messages)

			// Should handle missing or invalid values
			expect(result.contextTokens).toBe(0) // 0 + 0 (OpenAI default, no cache tokens)

			// Restore console.error
			console.error = originalConsoleError
		})
	})

	describe("Sub-agent token usage aggregation", () => {
		it("should aggregate sub-agent token usage from condense_context messages", () => {
			const messages: ClineMessage[] = [
				{
					type: "say",
					say: "condense_context",
					contextCondense: {
						cost: 0.002,
						newContextTokens: 500,
						prevContextTokens: 1000,
						summary: "Context was condensed",
						subAgentTokenUsage: [
							{ agentName: "Context Analyzer", tokensIn: 100, tokensOut: 50, cost: 0.001 },
							{ agentName: "Memory Extractor", tokensIn: 150, tokensOut: 75, cost: 0.0015 },
						],
					},
					ts: 1000,
				},
			]

			const result = getApiMetrics(messages)

			expect(result.subAgentTokenUsage).toBeDefined()
			expect(result.subAgentTokenUsage).toHaveLength(2)
			expect(result.subAgentTokenUsage?.[0]).toEqual({
				agentName: "Context Analyzer",
				tokensIn: 100,
				tokensOut: 50,
				cost: 0.001,
			})
			expect(result.subAgentTokenUsage?.[1]).toEqual({
				agentName: "Memory Extractor",
				tokensIn: 150,
				tokensOut: 75,
				cost: 0.0015,
			})
		})

		it("should accumulate sub-agent token usage across multiple condense operations", () => {
			const messages: ClineMessage[] = [
				{
					type: "say",
					say: "condense_context",
					contextCondense: {
						cost: 0.002,
						newContextTokens: 500,
						prevContextTokens: 1000,
						summary: "First condense",
						subAgentTokenUsage: [
							{ agentName: "Context Analyzer", tokensIn: 100, tokensOut: 50, cost: 0.001 },
							{ agentName: "Memory Extractor", tokensIn: 150, tokensOut: 75, cost: 0.0015 },
						],
					},
					ts: 1000,
				},
				{
					type: "say",
					say: "condense_context",
					contextCondense: {
						cost: 0.003,
						newContextTokens: 400,
						prevContextTokens: 800,
						summary: "Second condense",
						subAgentTokenUsage: [
							{ agentName: "Context Analyzer", tokensIn: 120, tokensOut: 60, cost: 0.0012 },
							{ agentName: "Code Summarizer", tokensIn: 200, tokensOut: 100, cost: 0.002 },
						],
					},
					ts: 2000,
				},
			]

			const result = getApiMetrics(messages)

			expect(result.subAgentTokenUsage).toBeDefined()
			expect(result.subAgentTokenUsage).toHaveLength(3)

			// Context Analyzer should be accumulated
			const contextAnalyzer = result.subAgentTokenUsage?.find((a) => a.agentName === "Context Analyzer")
			expect(contextAnalyzer?.agentName).toBe("Context Analyzer")
			expect(contextAnalyzer?.tokensIn).toBe(220) // 100 + 120
			expect(contextAnalyzer?.tokensOut).toBe(110) // 50 + 60
			expect(contextAnalyzer?.cost).toBeCloseTo(0.0022, 5) // 0.001 + 0.0012, handle floating point precision

			// Memory Extractor only in first operation
			const memoryExtractor = result.subAgentTokenUsage?.find((a) => a.agentName === "Memory Extractor")
			expect(memoryExtractor).toEqual({
				agentName: "Memory Extractor",
				tokensIn: 150,
				tokensOut: 75,
				cost: 0.0015,
			})

			// Code Summarizer only in second operation
			const codeSummarizer = result.subAgentTokenUsage?.find((a) => a.agentName === "Code Summarizer")
			expect(codeSummarizer).toEqual({
				agentName: "Code Summarizer",
				tokensIn: 200,
				tokensOut: 100,
				cost: 0.002,
			})
		})

		it("should handle condense_context messages without subAgentTokenUsage", () => {
			const messages: ClineMessage[] = [
				{
					type: "say",
					say: "condense_context",
					contextCondense: {
						cost: 0.002,
						newContextTokens: 500,
						prevContextTokens: 1000,
						summary: "Context was condensed",
						// No subAgentTokenUsage
					},
					ts: 1000,
				},
			]

			const result = getApiMetrics(messages)

			expect(result.subAgentTokenUsage).toEqual([])
			expect(result.totalCost).toBe(0.002)
		})

		it("should handle empty subAgentTokenUsage array", () => {
			const messages: ClineMessage[] = [
				{
					type: "say",
					say: "condense_context",
					contextCondense: {
						cost: 0.002,
						newContextTokens: 500,
						prevContextTokens: 1000,
						summary: "Context was condensed",
						subAgentTokenUsage: [],
					},
					ts: 1000,
				},
			]

			const result = getApiMetrics(messages)

			expect(result.subAgentTokenUsage).toEqual([])
		})

		it("should include total cost from both API requests and sub-agents", () => {
			const messages: ClineMessage[] = [
				createApiReqStartedMessage(
					'{"tokensIn":100,"tokensOut":200,"cacheWrites":5,"cacheReads":10,"cost":0.005}',
					1000,
				),
				{
					type: "say",
					say: "condense_context",
					contextCondense: {
						cost: 0.003,
						newContextTokens: 500,
						prevContextTokens: 1000,
						summary: "Context was condensed",
						subAgentTokenUsage: [
							{ agentName: "Context Analyzer", tokensIn: 100, tokensOut: 50, cost: 0.001 },
							{ agentName: "Memory Extractor", tokensIn: 150, tokensOut: 75, cost: 0.002 },
						],
					},
					ts: 2000,
				},
			]

			const result = getApiMetrics(messages)

			// Total cost should include API request cost + condense cost (not sub-agent costs separately as they're included in condense cost)
			expect(result.totalCost).toBe(0.008) // 0.005 + 0.003
			expect(result.subAgentTokenUsage).toHaveLength(2)
		})
	})
})
