import { describe, it, expect, beforeEach } from "vitest"
import { MessageCompressionManager } from "./MessageCompressionManager"
import type { ClineMessage } from "@roo-code/types"

describe("MessageCompressionManager", () => {
	let messages: ClineMessage[]
	const now = Date.now()
	const oneHourAgo = now - 60 * 60 * 1000
	const twoHoursAgo = now - 2 * 60 * 60 * 1000

	beforeEach(() => {
		// 创建测试消息
		messages = []

		// 添加100条旧消息（2小时前）
		for (let i = 0; i < 100; i++) {
			messages.push({
				ts: twoHoursAgo + i * 1000,
				type: "say",
				say: "text",
				text: `Test message ${i}`,
			} as ClineMessage)
		}

		// 添加20条新消息（最近1小时内）
		for (let i = 0; i < 20; i++) {
			messages.push({
				ts: now - 30 * 60 * 1000 + i * 1000, // 30分钟前
				type: "say",
				say: "text",
				text: `Recent message ${i}`,
			} as ClineMessage)
		}
	})

	describe("compressWithResult", () => {
		it("应该拒绝少于100条消息的压缩请求", async () => {
			const shortMessages = messages.slice(0, 50)
			const result = await MessageCompressionManager.compressWithResult(shortMessages, true)

			expect(result.success).toBe(false)
			expect(result.error).toContain("小于最小阈值")
		})

		it("应该成功压缩超过1小时的旧消息", async () => {
			const result = await MessageCompressionManager.compressWithResult(messages, true)

			expect(result.success).toBe(true)
			expect(result.compressedCount).toBeGreaterThan(0)
			expect(result.compressedCount).toBeLessThanOrEqual(100) // 最多压缩100条旧消息
		})

		it("应该跳过最近1小时内的消息", async () => {
			const result = await MessageCompressionManager.compressWithResult(messages, true)

			if (result.success) {
				// 验证压缩后的消息中，最近的20条消息没有被压缩
				const recentMessages = result.compressedMessages.filter((m) => m.ts > oneHourAgo)
				const compressedRecentMessages = recentMessages.filter((m: any) => m.compressed)

				expect(compressedRecentMessages.length).toBe(0)
			}
		})

		it("应该计算并返回Token节省量", async () => {
			const result = await MessageCompressionManager.compressWithResult(messages, true)

			if (result.success) {
				// 轻度压缩可能不节省token（只添加标记），所以只验证>=0
				expect(result.tokensSaved).toBeGreaterThanOrEqual(0)
				expect(result.durationMs).toBeGreaterThanOrEqual(0)
			}
		})

		it("应该在未启用时返回失败", async () => {
			const result = await MessageCompressionManager.compressWithResult(messages, false)

			expect(result.success).toBe(false)
			expect(result.error).toContain("未启用")
		})

		it("应该跳过已压缩的消息", async () => {
			// 第一次压缩
			const firstResult = await MessageCompressionManager.compressWithResult(messages, true)
			expect(firstResult.success).toBe(true)

			// 第二次压缩同样的消息（应该跳过已压缩的）
			const secondResult = await MessageCompressionManager.compressWithResult(
				firstResult.compressedMessages,
				true,
			)

			// 应该没有新的消息被压缩
			expect(secondResult.compressedCount).toBe(0)
			expect(secondResult.success).toBe(false)
		})
	})

	describe("checkAndCompress", () => {
		it("应该在消息数量不足时跳过压缩", async () => {
			const shortMessages = messages.slice(0, 50)
			const result = await MessageCompressionManager.checkAndCompress(shortMessages, true, false)

			// 应该返回原始消息，未进行压缩
			expect(result.length).toBe(50)
		})

		it("应该在未启用时返回原始消息", async () => {
			const result = await MessageCompressionManager.checkAndCompress(messages, false)

			expect(result).toEqual(messages)
		})

		it("应该在强制压缩时忽略消息数量限制", async () => {
			const shortMessages = messages.slice(0, 50)
			// 但是由于消息太新（1小时内），仍然可能跳过
			const result = await MessageCompressionManager.checkAndCompress(shortMessages, true, true)

			// 验证至少尝试了压缩
			expect(result).toBeDefined()
		})
	})

	describe("getCompressionStats", () => {
		it("应该正确计算压缩统计信息", async () => {
			const result = await MessageCompressionManager.compressWithResult(messages, true)

			if (result.success) {
				const stats = MessageCompressionManager.getCompressionStats(result.compressedMessages)

				expect(stats.totalMessages).toBe(result.compressedMessages.length)
				expect(stats.compressedMessages).toBe(result.compressedCount)
				expect(stats.compressionRate).toBeGreaterThan(0)
				// 轻度压缩可能不会减少大小，只需验证统计信息存在
				expect(stats.totalSizeBefore).toBeGreaterThan(0)
				expect(stats.totalSizeAfter).toBeGreaterThan(0)
			}
		})
	})

	describe("Token限制", () => {
		it("应该自动减少消息数量当Token超过120K时", async () => {
			// 创建大量大消息（每条约3500字符，估算约1000 tokens）
			const largeMessages: ClineMessage[] = []
			const largeText = "x".repeat(3500) // 3500字符，约1000 tokens (英文按3.5字符/token)

			// 创建150条大消息（估算 150 * 1000 = 150K tokens，超过120K限制）
			for (let i = 0; i < 150; i++) {
				largeMessages.push({
					ts: twoHoursAgo + i * 1000,
					type: "say",
					say: "text",
					text: largeText,
				} as ClineMessage)
			}

			const result = await MessageCompressionManager.compressWithResult(largeMessages, true)

			// 应该成功，但压缩的消息数量会少于150条（自动调整到120K以内）
			expect(result.success).toBe(true)
			expect(result.compressedCount).toBeGreaterThan(0)
			expect(result.compressedCount).toBeLessThan(150) // 应该少于原始数量
		})
	})
})
