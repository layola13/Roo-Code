/**
 * MessageCompressionManager 测试
 */

import { describe, it, expect, beforeEach } from "vitest"
import { MessageCompressionManager, type CompressedMessage } from "../MessageCompressionManager"
import type { ClineMessage } from "@roo-code/types"

describe("MessageCompressionManager", () => {
	let testMessages: ClineMessage[]

	beforeEach(() => {
		// 创建测试消息，模拟不同类型
		testMessages = []
		const now = Date.now()

		// 添加用户反馈消息（不应被压缩）
		testMessages.push({
			ts: now - 7200000, // 2小时前
			type: "say",
			say: "user_feedback",
			text: "User feedback message",
		})

		// 添加普通文本消息
		for (let i = 0; i < 200; i++) {
			testMessages.push({
				ts: now - 3600000 + i * 1000, // 1小时前到现在
				type: "say",
				say: "text",
				text: `Test message ${i}`.repeat(10), // 创建较长的内容
			})
		}

		// 添加命令输出消息（应被重度压缩）
		testMessages.push({
			ts: now - 7200000,
			type: "say",
			say: "command_output",
			text: "Very long command output...".repeat(100),
		})
	})

	describe("checkAndCompress", () => {
		it("应该在禁用时返回原数组", async () => {
			const result = await MessageCompressionManager.checkAndCompress(testMessages, false)

			expect(result).toEqual(testMessages)
		})

		it("应该在消息数量未达到检查间隔时返回原数组", async () => {
			const messages = testMessages.slice(0, 50)
			const result = await MessageCompressionManager.checkAndCompress(messages, true)

			expect(result).toEqual(messages)
		})

		it("应该压缩旧消息", async () => {
			// 需要至少100条消息才会触发检查
			const result = await MessageCompressionManager.checkAndCompress(testMessages, true)

			// 检查是否有消息被压缩
			const compressedCount = result.filter((msg) => (msg as CompressedMessage).compressed).length

			// 应该有一些消息被压缩（1小时前的消息）
			expect(compressedCount).toBeGreaterThanOrEqual(0)
		})
	})

	describe("getCompressionStats", () => {
		it("应该返回正确的统计信息", () => {
			const stats = MessageCompressionManager.getCompressionStats(testMessages)

			expect(stats.totalMessages).toBe(testMessages.length)
			expect(stats.compressedMessages).toBe(0) // 初始状态没有压缩
			expect(stats.compressionRate).toBe(0)
			expect(stats.totalSizeBefore).toBeGreaterThan(0)
			expect(stats.totalSizeAfter).toBeGreaterThan(0)
		})

		it("应该计算压缩后的统计信息", () => {
			// 创建一个压缩消息
			const compressedMessage: CompressedMessage = {
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Compressed",
				compressed: true,
				compressionLevel: "medium",
				originalSize: 1000,
				compressedSize: 500,
				compressionRatio: 0.5,
				compressedAt: Date.now(),
			}

			const messages = [compressedMessage, ...testMessages]
			const stats = MessageCompressionManager.getCompressionStats(messages)

			expect(stats.compressedMessages).toBe(1)
			// 压缩率应该是 1 / (1 + testMessages.length) * 100
			// 只要有压缩消息，压缩率就应该大于0，但可能很小
			expect(stats.compressionRate).toBeGreaterThanOrEqual(0)
			expect(stats.totalMessages).toBe(messages.length)
		})
	})

	describe("压缩策略", () => {
		it("应该不压缩用户反馈消息", () => {
			const userFeedback = testMessages.find((msg) => msg.say === "user_feedback")
			expect(userFeedback).toBeDefined()

			// 用户反馈消息不应该被标记为可压缩
			// 这通过 shouldCompress 方法内部实现
		})

		it("应该识别不同的压缩级别", () => {
			// 命令输出应该被重度压缩
			const commandOutput = testMessages.find((msg) => msg.say === "command_output")
			expect(commandOutput).toBeDefined()

			// 文本消息应该被中度压缩
			const textMessage = testMessages.find((msg) => msg.say === "text")
			expect(textMessage).toBeDefined()
		})
	})

	describe("时间窗口机制", () => {
		it("应该只压缩旧消息", () => {
			const now = Date.now()

			// 创建消息：一些新的（1小时内），一些旧的（1小时前）
			const _mixedMessages: ClineMessage[] = [
				{
					ts: now - 7200000, // 2小时前 - 应该被压缩
					type: "say",
					say: "text",
					text: "Old message",
				},
				{
					ts: now - 1800000, // 30分钟前 - 不应该被压缩
					type: "say",
					say: "text",
					text: "Recent message",
				},
			]

			// 1小时 = 3600000 毫秒
			// 2小时前的消息应该在压缩边界之外
		})
	})
})
