/**
 * MemoryExtractorAgent 单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { MemoryExtractorAgent } from "../MemoryExtractorAgent"
import { ApiHandler } from "../../../../api"
import type { HistoricalMessage } from "../../types-intelligent-context"

const mockApiHandler = {
	createMessage: vi.fn(),
} as unknown as ApiHandler

describe("MemoryExtractorAgent", () => {
	let agent: MemoryExtractorAgent

	beforeEach(() => {
		vi.clearAllMocks()
		agent = new MemoryExtractorAgent(mockApiHandler)
	})

	describe("基本属性", () => {
		it("应该有正确的名称", () => {
			expect(agent.name).toBe("condense-memory-extractor")
		})
	})

	describe("selectRelevantMessages", () => {
		it("应该选择包含决策和需求的消息", async () => {
			const candidates: HistoricalMessage[] = [
				{
					messageIndex: 1,
					globalId: "msg#1",
					role: "user",
					content: "We decided to use TypeScript for this project",
					timestamp: Date.now(),
					conversationId: "test",
					tokens: 10,
				},
				{
					messageIndex: 2,
					globalId: "msg#2",
					role: "user",
					content: "Random chat",
					timestamp: Date.now(),
					conversationId: "test",
					tokens: 5,
				},
			]

			const result = await agent.selectRelevantMessages("test", candidates)

			expect(result.success).toBe(true)
			expect(result.agentName).toBe("condense-memory-extractor")
		})

		it("应该处理空候选列表", async () => {
			const result = await agent.selectRelevantMessages("test", [])

			expect(result.success).toBe(true)
			expect(result.selectedIndices).toHaveLength(0)
		})
	})

	describe("run方法", () => {
		it("应该成功执行", async () => {
			const mockStream = (async function* () {
				yield { type: "text" as const, text: "Memory extracted" }
			})()

			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream)

			const result = await agent.run({
				context: { messages: [] },
				task: "Extract memories",
			})

			expect(result.success).toBe(true)
		})
	})
})
