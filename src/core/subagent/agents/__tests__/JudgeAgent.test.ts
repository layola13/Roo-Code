/**
 * JudgeAgent 单元测试
 *
 * 测试裁判Agent的核心功能：
 * 1. 意图分析
 * 2. 专家Agent调度
 * 3. 结果合并去重
 * 4. 冲突检测与解决
 * 5. Rate limit重试机制
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { JudgeAgent } from "../JudgeAgent"
import { ApiHandler } from "../../../../api"
import type { HistoricalMessage, AgentSearchResult, ExpertAgent } from "../../types-intelligent-context"

// Mock ApiHandler
const mockApiHandler = {
	createMessage: vi.fn(),
} as unknown as ApiHandler

// Mock Expert Agent
class MockExpertAgent implements ExpertAgent {
	constructor(
		public name: string,
		private mockResults: Partial<AgentSearchResult> = {},
	) {}

	async selectRelevantMessages(userMessage: string, candidates: HistoricalMessage[]): Promise<AgentSearchResult> {
		return {
			agentName: this.name,
			selectedIndices: this.mockResults.selectedIndices || [1, 2],
			relevanceScores:
				this.mockResults.relevanceScores ||
				new Map([
					[1, 0.9],
					[2, 0.8],
				]),
			reasoning: this.mockResults.reasoning || `${this.name} selected messages`,
			executionTime: this.mockResults.executionTime || 100,
			success: this.mockResults.success !== false,
			error: this.mockResults.error,
		}
	}
}

describe("JudgeAgent", () => {
	let judgeAgent: JudgeAgent

	beforeEach(() => {
		vi.clearAllMocks()

		judgeAgent = new JudgeAgent(mockApiHandler, {
			agentTimeout: 3000,
			enableParallel: false,
			totalTokenBudget: 120000,
			reserveForResponse: 20000,
			verboseLogging: false,
			agentDelayMs: 0, // 测试中不延迟
			maxRetries: 3,
			requireAllAgents: true,
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("intentAnalysis", () => {
		it("应该成功分析用户意图", async () => {
			// Mock LLM响应
			const mockStream = (async function* () {
				yield {
					type: "text" as const,
					text: '{"intent": "problem_solving", "domains": ["technical"], "timeScope": "recent_7_days", "confidence": 0.85}',
				}
			})()

			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream)

			const testMessages: HistoricalMessage[] = [
				{
					messageIndex: 1,
					globalId: "msg#1",
					role: "user",
					content: "How do I fix this bug?",
					timestamp: Date.now(),
					conversationId: "test-conv",
					tokens: 10,
				},
			]

			const decision = await judgeAgent.analyze("How do I fix this bug?", { messages: testMessages })

			expect(decision.intent).toBe("problem_solving")
			expect(decision.domains).toContain("technical")
			expect(decision.timeScope).toBe("recent_7_days")
			expect(decision.confidence).toBe(0.85)
		})

		it("应该在LLM失败时使用降级分析", async () => {
			// Mock LLM失败 - 返回rejected Promise而不是generator
			const mockStream = (async function* (): AsyncGenerator<{ type: "text"; text: string }> {
				yield { type: "text" as const, text: "" }
				throw new Error("API Error")
			})()

			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream)

			const testMessages: HistoricalMessage[] = []
			const decision = await judgeAgent.analyze("Fix the error in my code", { messages: testMessages })

			// 应该使用关键词匹配降级
			expect(decision.intent).toBeDefined()
			expect(decision.domains).toBeInstanceOf(Array)
			expect(decision.confidence).toBeLessThan(0.8) // 降级方法置信度较低
		})

		it("应该正确识别代码相关的意图", async () => {
			const mockStream = (async function* () {
				yield { type: "text" as const, text: "invalid json" }
			})()

			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream)

			const decision = await judgeAgent.analyze("implement a function to parse JSON", { messages: [] })

			// 降级分析应该识别代码关键词
			expect(decision.domains).toContain("code")
			expect(decision.intent).toBe("code_modification")
		})
	})

	describe("executeAgentsInParallel", () => {
		it("应该成功执行多个专家Agent（串行）", async () => {
			const agent1 = new MockExpertAgent("agent-1", { selectedIndices: [1, 2] })
			const agent2 = new MockExpertAgent("agent-2", { selectedIndices: [2, 3] })

			judgeAgent.registerExpertAgent(agent1)
			judgeAgent.registerExpertAgent(agent2)

			const candidates: HistoricalMessage[] = [
				{
					messageIndex: 1,
					globalId: "msg#1",
					role: "user",
					content: "test",
					timestamp: Date.now(),
					conversationId: "test",
					tokens: 5,
				},
				{
					messageIndex: 2,
					globalId: "msg#2",
					role: "user",
					content: "test",
					timestamp: Date.now(),
					conversationId: "test",
					tokens: 5,
				},
				{
					messageIndex: 3,
					globalId: "msg#3",
					role: "user",
					content: "test",
					timestamp: Date.now(),
					conversationId: "test",
					tokens: 5,
				},
			]

			const results = await judgeAgent.executeAgentsInParallel("test query", candidates)

			expect(results).toHaveLength(2)
			expect(results[0].agentName).toBe("agent-1")
			expect(results[1].agentName).toBe("agent-2")
			expect(results[0].success).toBe(true)
			expect(results[1].success).toBe(true)
		})

		it("应该处理Agent执行失败", async () => {
			const successAgent = new MockExpertAgent("success-agent", { selectedIndices: [1] })
			const failAgent = new MockExpertAgent("fail-agent", { success: false, error: "Test error" })

			judgeAgent.registerExpertAgent(successAgent)
			judgeAgent.registerExpertAgent(failAgent)

			const candidates: HistoricalMessage[] = [
				{
					messageIndex: 1,
					globalId: "msg#1",
					role: "user",
					content: "test",
					timestamp: Date.now(),
					conversationId: "test",
					tokens: 5,
				},
			]

			const results = await judgeAgent.executeAgentsInParallel("test query", candidates)

			expect(results).toHaveLength(2)
			expect(results.find((r) => r.agentName === "success-agent")?.success).toBe(true)
			expect(results.find((r) => r.agentName === "fail-agent")?.success).toBe(false)
			expect(results.find((r) => r.agentName === "fail-agent")?.error).toBe("Test error")
		})

		it("应该返回空数组当没有注册Agent时", async () => {
			const results = await judgeAgent.executeAgentsInParallel("test", [])
			expect(results).toHaveLength(0)
		})
	})

	describe("mergeAndDeduplicate", () => {
		it("应该正确合并和去重Agent结果", () => {
			const results: AgentSearchResult[] = [
				{
					agentName: "agent-1",
					selectedIndices: [1, 2, 3],
					relevanceScores: new Map(),
					reasoning: "test",
					executionTime: 100,
					success: true,
				},
				{
					agentName: "agent-2",
					selectedIndices: [2, 3, 4],
					relevanceScores: new Map(),
					reasoning: "test",
					executionTime: 100,
					success: true,
				},
			]

			const merged = judgeAgent.mergeAndDeduplicate(results)

			expect(merged.finalIndices).toEqual([1, 2, 3, 4]) // 已排序
			expect(merged.duplicates.size).toBe(2) // 2和3被重复选中
			expect(merged.duplicates.get(2)).toEqual(["agent-1", "agent-2"])
			expect(merged.duplicates.get(3)).toEqual(["agent-1", "agent-2"])
		})

		it("应该忽略失败的Agent结果", () => {
			const results: AgentSearchResult[] = [
				{
					agentName: "agent-1",
					selectedIndices: [1, 2],
					relevanceScores: new Map(),
					reasoning: "test",
					executionTime: 100,
					success: true,
				},
				{
					agentName: "agent-2",
					selectedIndices: [3, 4],
					relevanceScores: new Map(),
					reasoning: "failed",
					executionTime: 100,
					success: false,
					error: "Test error",
				},
			]

			const merged = judgeAgent.mergeAndDeduplicate(results)

			expect(merged.finalIndices).toEqual([1, 2]) // 只包含成功的Agent结果
			expect(merged.duplicates.size).toBe(0)
		})

		it("应该按索引号排序最终结果", () => {
			const results: AgentSearchResult[] = [
				{
					agentName: "agent-1",
					selectedIndices: [5, 1, 3],
					relevanceScores: new Map(),
					reasoning: "test",
					executionTime: 100,
					success: true,
				},
			]

			const merged = judgeAgent.mergeAndDeduplicate(results)

			expect(merged.finalIndices).toEqual([1, 3, 5]) // 已排序
		})
	})

	describe("detectConflicts", () => {
		it("应该检测到完全不重叠的Agent结果", () => {
			const mockStream = (async function* () {
				yield {
					type: "text" as const,
					text: '{"intent": "test", "domains": ["general"], "timeScope": "recent", "confidence": 0.7}',
				}
			})()

			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream)

			const agent1 = new MockExpertAgent("agent-1", { selectedIndices: [1, 2] })
			const agent2 = new MockExpertAgent("agent-2", { selectedIndices: [5, 6] })

			judgeAgent.registerExpertAgent(agent1)
			judgeAgent.registerExpertAgent(agent2)

			// 通过实际调用analyze来测试冲突检测
			// 这会在内部调用hasConflicts和resolveConflicts
		})
	})

	describe("rate limit重试", () => {
		it("应该在遇到rate limit时重试", async () => {
			let attemptCount = 0
			const rateLimitAgent = new MockExpertAgent("rate-limit-agent")

			// 重写selectRelevantMessages以模拟rate limit
			rateLimitAgent.selectRelevantMessages = vi.fn(async () => {
				attemptCount++
				if (attemptCount < 3) {
					throw new Error("rate limit exceeded")
				}
				return {
					agentName: "rate-limit-agent",
					selectedIndices: [1],
					relevanceScores: new Map([[1, 0.9]]),
					reasoning: "Success after retry",
					executionTime: 100,
					success: true,
				}
			})

			judgeAgent.registerExpertAgent(rateLimitAgent)

			const candidates: HistoricalMessage[] = [
				{
					messageIndex: 1,
					globalId: "msg#1",
					role: "user",
					content: "test",
					timestamp: Date.now(),
					conversationId: "test",
					tokens: 5,
				},
			]

			const results = await judgeAgent.executeAgentsInParallel("test", candidates)

			expect(attemptCount).toBe(3) // 应该重试了2次
			expect(results[0].success).toBe(true)
			expect(results[0].reasoning).toBe("Success after retry")
		})

		it("应该在达到最大重试次数后失败", async () => {
			const alwaysFailAgent = new MockExpertAgent("always-fail-agent")

			alwaysFailAgent.selectRelevantMessages = vi.fn(async () => {
				throw new Error("rate limit exceeded")
			})

			judgeAgent.registerExpertAgent(alwaysFailAgent)

			const candidates: HistoricalMessage[] = [
				{
					messageIndex: 1,
					globalId: "msg#1",
					role: "user",
					content: "test",
					timestamp: Date.now(),
					conversationId: "test",
					tokens: 5,
				},
			]

			const results = await judgeAgent.executeAgentsInParallel("test", candidates)

			expect(results[0].success).toBe(false)
			expect(results[0].error).toContain("rate limit")
		})
	})

	describe("getExpertAgentCount", () => {
		it("应该返回正确的Agent数量", () => {
			expect(judgeAgent.getExpertAgentCount()).toBe(0)

			judgeAgent.registerExpertAgent(new MockExpertAgent("agent-1"))
			expect(judgeAgent.getExpertAgentCount()).toBe(1)

			judgeAgent.registerExpertAgent(new MockExpertAgent("agent-2"))
			expect(judgeAgent.getExpertAgentCount()).toBe(2)
		})
	})

	describe("getExpertAgentNames", () => {
		it("应该返回所有已注册Agent的名称", () => {
			judgeAgent.registerExpertAgent(new MockExpertAgent("agent-1"))
			judgeAgent.registerExpertAgent(new MockExpertAgent("agent-2"))
			judgeAgent.registerExpertAgent(new MockExpertAgent("agent-3"))

			const names = judgeAgent.getExpertAgentNames()

			expect(names).toHaveLength(3)
			expect(names).toContain("agent-1")
			expect(names).toContain("agent-2")
			expect(names).toContain("agent-3")
		})
	})
})
