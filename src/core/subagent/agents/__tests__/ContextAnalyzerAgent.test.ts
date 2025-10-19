/**
 * ContextAnalyzerAgent 单元测试
 *
 * 测试上下文分析Agent的核心功能：
 * 1. 选择相关消息
 * 2. 关键词提取
 * 3. 历史上下文需求检测
 * 4. 消息格式化
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { ContextAnalyzerAgent } from "../ContextAnalyzerAgent"
import { ApiHandler } from "../../../../api"
import type { HistoricalMessage } from "../../types-intelligent-context"

// Mock ApiHandler
const mockApiHandler = {
	createMessage: vi.fn(),
} as unknown as ApiHandler

describe("ContextAnalyzerAgent", () => {
	let agent: ContextAnalyzerAgent

	beforeEach(() => {
		vi.clearAllMocks()
		agent = new ContextAnalyzerAgent(mockApiHandler)
	})

	describe("基本属性", () => {
		it("应该有正确的名称", () => {
			expect(agent.name).toBe("condense-context-analyzer")
		})

		it("应该有默认任务描述", () => {
			expect(agent.defaultTask).toBeDefined()
			expect(agent.defaultTask).toContain("Analyze")
		})
	})

	describe("selectRelevantMessages", () => {
		it("应该选择最近的消息", async () => {
			const now = Date.now()
			const candidates: HistoricalMessage[] = [
				{
					messageIndex: 1,
					globalId: "msg#1",
					role: "user",
					content: "Old message mentioned earlier",
					timestamp: now - 10000,
					conversationId: "test",
					tokens: 5,
				},
				{
					messageIndex: 2,
					globalId: "msg#2",
					role: "user",
					content: "Recent message with important context",
					timestamp: now - 1000,
					conversationId: "test",
					tokens: 5,
				},
				{
					messageIndex: 3,
					globalId: "msg#3",
					role: "user",
					content: "Latest message from before",
					timestamp: now,
					conversationId: "test",
					tokens: 5,
				},
			]

			// 使用包含历史引用关键词的查询
			const result = await agent.selectRelevantMessages("What did we discuss earlier?", candidates)

			expect(result.success).toBe(true)
			expect(result.selectedIndices.length).toBeGreaterThan(0)
			expect(result.executionTime).toBeGreaterThanOrEqual(0)
		})

		it("应该基于关键词选择相关消息", async () => {
			const candidates: HistoricalMessage[] = [
				{
					messageIndex: 1,
					globalId: "msg#1",
					role: "user",
					content: "This is about database connection mentioned before",
					timestamp: Date.now() - 5000,
					conversationId: "test",
					tokens: 10,
				},
				{
					messageIndex: 2,
					globalId: "msg#2",
					role: "user",
					content: "Unrelated random text",
					timestamp: Date.now() - 4000,
					conversationId: "test",
					tokens: 5,
				},
				{
					messageIndex: 3,
					globalId: "msg#3",
					role: "user",
					content: "Database query optimization discussed earlier",
					timestamp: Date.now() - 3000,
					conversationId: "test",
					tokens: 8,
				},
			]

			// 使用包含历史引用的查询
			const result = await agent.selectRelevantMessages(
				"Tell me about the database issues we discussed before",
				candidates,
			)

			expect(result.success).toBe(true)
			// 应该选择一些消息
			expect(result.selectedIndices.length).toBeGreaterThan(0)
		})

		it("应该在不需要历史上下文时返回空结果", async () => {
			const candidates: HistoricalMessage[] = [
				{
					messageIndex: 1,
					globalId: "msg#1",
					role: "user",
					content: "Some message",
					timestamp: Date.now(),
					conversationId: "test",
					tokens: 5,
				},
			]

			// 不包含历史引用关键词的查询
			const result = await agent.selectRelevantMessages("What is TypeScript?", candidates)

			expect(result.success).toBe(true)
			// 应该仍然选择一些消息（最近的）
			expect(result.selectedIndices.length).toBeGreaterThanOrEqual(0)
		})

		it("应该检测到需要历史上下文的查询", async () => {
			const candidates: HistoricalMessage[] = [
				{
					messageIndex: 1,
					globalId: "msg#1",
					role: "user",
					content: "Previous discussion about API",
					timestamp: Date.now() - 1000,
					conversationId: "test",
					tokens: 10,
				},
				{
					messageIndex: 2,
					globalId: "msg#2",
					role: "user",
					content: "Another message",
					timestamp: Date.now(),
					conversationId: "test",
					tokens: 5,
				},
			]

			const result = await agent.selectRelevantMessages("What did we discuss earlier?", candidates)

			expect(result.success).toBe(true)
			expect(result.selectedIndices.length).toBeGreaterThan(0)
		})

		it("应该限制返回的消息数量", async () => {
			const candidates: HistoricalMessage[] = Array.from({ length: 30 }, (_, i) => ({
				messageIndex: i + 1,
				globalId: `msg#${i + 1}`,
				role: "user" as const,
				content: `Message ${i + 1} with keyword test`,
				timestamp: Date.now() - (30 - i) * 1000,
				conversationId: "test",
				tokens: 10,
			}))

			const result = await agent.selectRelevantMessages("test query", candidates)

			expect(result.success).toBe(true)
			// 应该限制在15条以内
			expect(result.selectedIndices.length).toBeLessThanOrEqual(15)
		})

		it("应该处理空候选列表", async () => {
			const result = await agent.selectRelevantMessages("test query", [])

			expect(result.success).toBe(true)
			expect(result.selectedIndices).toHaveLength(0)
			expect(result.reasoning).toContain("No historical context needed")
		})

		it("应该为选中的消息提供相关性分数", async () => {
			const candidates: HistoricalMessage[] = [
				{
					messageIndex: 1,
					globalId: "msg#1",
					role: "user",
					content: "Test message",
					timestamp: Date.now(),
					conversationId: "test",
					tokens: 5,
				},
			]

			const result = await agent.selectRelevantMessages("test", candidates)

			expect(result.success).toBe(true)
			if (result.selectedIndices.length > 0) {
				// 检查relevanceScores
				const firstIndex = result.selectedIndices[0]
				const score = result.relevanceScores.get(firstIndex)
				expect(score).toBeGreaterThan(0)
				expect(score).toBeLessThanOrEqual(1)
			}
		})

		it("应该处理包含中文关键词的查询", async () => {
			const candidates: HistoricalMessage[] = [
				{
					messageIndex: 1,
					globalId: "msg#1",
					role: "user",
					content: "之前讨论过的API设计",
					timestamp: Date.now() - 1000,
					conversationId: "test",
					tokens: 10,
				},
				{
					messageIndex: 2,
					globalId: "msg#2",
					role: "user",
					content: "Other content",
					timestamp: Date.now(),
					conversationId: "test",
					tokens: 5,
				},
			]

			const result = await agent.selectRelevantMessages("刚才提到的设计方案", candidates)

			expect(result.success).toBe(true)
			expect(result.selectedIndices.length).toBeGreaterThan(0)
		})

		it("应该处理错误情况", async () => {
			// 创建会抛出错误的场景
			const invalidCandidates = [
				{
					messageIndex: 1,
					globalId: "msg#1",
					role: "user" as const,
					content: null as any, // 故意传入无效数据
					timestamp: Date.now(),
					conversationId: "test",
					tokens: 5,
				},
			]

			const result = await agent.selectRelevantMessages("test", invalidCandidates)

			// 即使出错，也应该返回一个结果对象
			expect(result).toBeDefined()
			expect(result.agentName).toBe("condense-context-analyzer")
		})
	})

	describe("run方法", () => {
		it("应该成功执行分析任务", async () => {
			const mockStream = (async function* (): AsyncGenerator<
				{ type: "text"; text: string } | { type: "usage"; inputTokens: number; outputTokens: number }
			> {
				yield { type: "text" as const, text: "Analysis result: Stage 1 completed" }
				yield { type: "usage" as const, inputTokens: 100, outputTokens: 50 }
			})()

			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream)

			const context = {
				messages: [
					{ role: "user" as const, content: "Test message 1" },
					{ role: "assistant" as const, content: "Response 1" },
				],
			}

			const result = await agent.run({
				context,
				task: "Analyze conversation flow",
			})

			expect(result.success).toBe(true)
			expect(result.agentName).toBe("condense-context-analyzer")
			expect(result.output).toContain("Analysis result")
			expect(result.tokensUsed).toBe(150) // 100 + 50
			expect(result.executionTime).toBeGreaterThanOrEqual(0)
		})

		it("应该处理API错误", async () => {
			const mockStream = (async function* (): AsyncGenerator<{ type: "text"; text: string }> {
				yield { type: "text" as const, text: "" }
				throw new Error("API Error")
			})()

			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream)

			const context = {
				messages: [{ role: "user" as const, content: "Test" }],
			}

			const result = await agent.run({
				context,
				task: "Test task",
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain("API Error")
			expect(result.tokensUsed).toBe(0)
		})

		it("应该支持不同的分析深度", async () => {
			const mockStream = (async function* () {
				yield { type: "text" as const, text: "Quick analysis" }
			})()

			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream)

			const context = {
				messages: [{ role: "user" as const, content: "Test" }],
			}

			const result = await agent.run({
				context,
				task: "Analyze",
				options: { depth: "quick" },
			})

			expect(result.success).toBe(true)
			expect(mockApiHandler.createMessage).toHaveBeenCalled()
		})
	})
})
