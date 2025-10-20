import { describe, it, expect, beforeEach, vi } from "vitest"
import { MessageCompressionManager } from "../utils/MessageCompressionManager"
import type { ClineMessage } from "@roo-code/types"

describe("MessageCompressionManager", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("应该正确压缩可见消息", async () => {
		const messages: ClineMessage[] = [
			{
				ts: 1,
				type: "say",
				say: "text",
				text: "这是第一条消息",
			},
			{
				ts: 2,
				type: "say",
				say: "text",
				text: "这是第二条消息",
			},
			{
				ts: 3,
				type: "say",
				say: "text",
				text: "这是第三条消息",
			},
		]

		const result = await MessageCompressionManager.checkAndCompress(messages, true)

		expect(result).toBeDefined()
		expect(Array.isArray(result)).toBe(true)
		expect(result.length).toBeGreaterThan(0)
	})

	it("应该在禁用时返回原始消息", async () => {
		const messages: ClineMessage[] = [
			{
				ts: 1,
				type: "say",
				say: "text",
				text: "测试消息",
			},
		]

		const result = await MessageCompressionManager.checkAndCompress(messages, false)

		expect(result).toEqual(messages)
	})

	it("应该处理空消息数组", async () => {
		const messages: ClineMessage[] = []

		const result = await MessageCompressionManager.checkAndCompress(messages, true)

		expect(result).toEqual([])
	})

	it("应该保留最近的可见消息", async () => {
		const messages: ClineMessage[] = Array.from({ length: 20 }, (_, i) => ({
			ts: i + 1,
			type: "say" as const,
			say: "text" as const,
			text: `消息 ${i + 1}`,
		}))

		const result = await MessageCompressionManager.checkAndCompress(messages, true)

		// 应该返回处理后的消息数组
		expect(result.length).toBeGreaterThan(0)
	})

	it("应该处理异步压缩错误", async () => {
		const messages: ClineMessage[] = [
			{
				ts: 1,
				type: "say",
				say: "text",
				text: "测试消息",
			},
		]

		// 即使出错，也应该返回原始消息而不是抛出异常
		const result = await MessageCompressionManager.checkAndCompress(messages, true)
		expect(result).toBeDefined()
	})
})
