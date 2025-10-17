/**
 * SubagentExecutor Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { SubagentExecutor } from "../executor/SubagentExecutor"
import { ContextAnalyzerAgent } from "../agents/ContextAnalyzerAgent"
import { MemoryExtractorAgent } from "../agents/MemoryExtractorAgent"
import { CodeSummarizerAgent } from "../agents/CodeSummarizerAgent"
import { ApiHandler } from "../../../api"
import { AgentContext, SubagentParams } from "../types"

// Mock ApiHandler
const createMockApiHandler = (): ApiHandler => {
	return {
		createMessage: vi.fn().mockImplementation(async function* () {
			yield { type: "text", text: "Test response from subagent" }
			yield { type: "usage", inputTokens: 100, outputTokens: 50, totalCost: 0.01 }
		}),
		countTokens: vi.fn().mockResolvedValue(100),
	} as any
}

describe("SubagentExecutor", () => {
	let apiHandler: ApiHandler
	let executor: SubagentExecutor

	beforeEach(() => {
		apiHandler = createMockApiHandler()
		executor = new SubagentExecutor(apiHandler, {
			enableCache: true,
			enableMetrics: true,
			verboseLogging: false,
		})
	})

	it("should create SubagentExecutor instance", () => {
		expect(executor).toBeDefined()
		expect(executor).toBeInstanceOf(SubagentExecutor)
	})

	it("should register subagents", () => {
		const analyzer = new ContextAnalyzerAgent(apiHandler)
		executor.registerSubagent(analyzer)

		// No direct way to test this, but it shouldn't throw
		expect(() => executor.registerSubagent(analyzer)).not.toThrow()
	})

	it("should execute a subagent successfully", async () => {
		const analyzer = new ContextAnalyzerAgent(apiHandler)
		executor.registerSubagent(analyzer)

		const params: SubagentParams = {
			agent_name: "condense-context-analyzer",
			task: "Analyze this conversation",
		}

		const context: AgentContext = {
			messages: [
				{ role: "user", content: "Hello", ts: Date.now() },
				{ role: "assistant", content: "Hi there!", ts: Date.now() },
			],
		}

		const result = await executor.executeSubagent(params, context)

		expect(result).toBeDefined()
		expect(result.success).toBe(true)
		expect(result.agentName).toBe("condense-context-analyzer")
		expect(result.output).toBe("Test response from subagent")
		expect(result.tokensUsed).toBe(150) // 100 input + 50 output
	})

	it("should return error for unregistered subagent", async () => {
		const params: SubagentParams = {
			agent_name: "condense-context-analyzer",
			task: "Analyze this conversation",
		}

		const context: AgentContext = {
			messages: [{ role: "user", content: "Hello", ts: Date.now() }],
		}

		const result = await executor.executeSubagent(params, context)

		expect(result.success).toBe(false)
		expect(result.error).toContain("not registered")
	})

	it("should use cache for duplicate requests", async () => {
		const analyzer = new ContextAnalyzerAgent(apiHandler)
		executor.registerSubagent(analyzer)

		const params: SubagentParams = {
			agent_name: "condense-context-analyzer",
			task: "Analyze this",
		}

		const context: AgentContext = {
			messages: [{ role: "user", content: "Test message", ts: Date.now() }],
		}

		// First call
		const result1 = await executor.executeSubagent(params, context)
		expect(result1.cachedResult).toBeUndefined()

		// Second call (should be cached)
		const result2 = await executor.executeSubagent(params, context)
		expect(result2.cachedResult).toBe(true)
	})

	it("should execute multiple subagents in parallel", async () => {
		const analyzer = new ContextAnalyzerAgent(apiHandler)
		const extractor = new MemoryExtractorAgent(apiHandler)

		executor.registerSubagent(analyzer)
		executor.registerSubagent(extractor)

		const context: AgentContext = {
			messages: [
				{ role: "user", content: "Hello", ts: Date.now() },
				{ role: "assistant", content: "Hi!", ts: Date.now() },
			],
		}

		const requests = [
			{
				params: { agent_name: "condense-context-analyzer" as const, task: "Analyze" },
				context,
			},
			{
				params: { agent_name: "condense-memory-extractor" as const, task: "Extract" },
				context,
			},
		]

		const results = await executor.executeMultiple(requests)

		expect(results).toHaveLength(2)
		expect(results[0].success).toBe(true)
		expect(results[1].success).toBe(true)
	})

	it("should clear cache", () => {
		executor.clearCache()
		const stats = executor.getCacheStats()
		expect(stats.cacheSize).toBe(0)
	})

	it("should get cache statistics", () => {
		const stats = executor.getCacheStats()
		expect(stats).toHaveProperty("cacheSize")
		expect(stats).toHaveProperty("cacheKeys")
		expect(Array.isArray(stats.cacheKeys)).toBe(true)
	})
})

describe("ContextAnalyzerAgent", () => {
	let apiHandler: ApiHandler
	let agent: ContextAnalyzerAgent

	beforeEach(() => {
		apiHandler = createMockApiHandler()
		agent = new ContextAnalyzerAgent(apiHandler)
	})

	it("should create ContextAnalyzerAgent instance", () => {
		expect(agent).toBeDefined()
		expect(agent.name).toBe("condense-context-analyzer")
		expect(agent.defaultTask).toBeTruthy()
	})

	it("should run analysis successfully", async () => {
		const context: AgentContext = {
			messages: [
				{ role: "user", content: "Test message 1", ts: Date.now() },
				{ role: "assistant", content: "Response 1", ts: Date.now() },
			],
		}

		const result = await agent.run({
			context,
			task: "Analyze conversation flow",
		})

		expect(result.success).toBe(true)
		expect(result.output).toBe("Test response from subagent")
		expect(result.agentName).toBe("condense-context-analyzer")
	})
})

describe("MemoryExtractorAgent", () => {
	let apiHandler: ApiHandler
	let agent: MemoryExtractorAgent

	beforeEach(() => {
		apiHandler = createMockApiHandler()
		agent = new MemoryExtractorAgent(apiHandler)
	})

	it("should create MemoryExtractorAgent instance", () => {
		expect(agent).toBeDefined()
		expect(agent.name).toBe("condense-memory-extractor")
		expect(agent.defaultTask).toBeTruthy()
	})

	it("should extract memories successfully", async () => {
		const context: AgentContext = {
			messages: [
				{ role: "user", content: "Remember to use PostgreSQL", ts: Date.now() },
				{ role: "assistant", content: "I'll use PostgreSQL", ts: Date.now() },
			],
		}

		const result = await agent.run({
			context,
			task: "Extract critical information",
		})

		expect(result.success).toBe(true)
		expect(result.output).toBeTruthy()
	})
})

describe("CodeSummarizerAgent", () => {
	let apiHandler: ApiHandler
	let agent: CodeSummarizerAgent

	beforeEach(() => {
		apiHandler = createMockApiHandler()
		agent = new CodeSummarizerAgent(apiHandler)
	})

	it("should create CodeSummarizerAgent instance", () => {
		expect(agent).toBeDefined()
		expect(agent.name).toBe("condense-code-summarizer")
		expect(agent.defaultTask).toBeTruthy()
	})

	it("should summarize code changes successfully", async () => {
		const context: AgentContext = {
			messages: [
				{ role: "user", content: "Modified src/app.ts and src/utils.ts", ts: Date.now() },
				{ role: "assistant", content: "Changes applied", ts: Date.now() },
			],
		}

		const result = await agent.run({
			context,
			task: "Summarize code changes",
		})

		expect(result.success).toBe(true)
		expect(result.output).toBeTruthy()
	})
})
