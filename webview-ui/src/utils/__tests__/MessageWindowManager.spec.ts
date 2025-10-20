/**
 * MessageWindowManager 测试
 */

import { describe, it, expect, beforeEach } from "vitest"
import { MessageWindowManager, MESSAGE_WINDOW_CONFIG } from "../MessageWindowManager"
import type { ClineMessage } from "@roo-code/types"

describe("MessageWindowManager", () => {
	let testMessages: ClineMessage[]

	beforeEach(() => {
		// 创建测试消息
		testMessages = []
		for (let i = 0; i < 1500; i++) {
			testMessages.push({
				ts: Date.now() + i,
				type: "say",
				say: "text",
				text: `Test message ${i}`,
			})
		}
	})

	describe("applyWindow", () => {
		it("应该在消息数量未超过阈值时返回原数组", () => {
			const messages = testMessages.slice(0, 500)
			const result = MessageWindowManager.applyWindow(messages)

			expect(result).toHaveLength(500)
			expect(result).toEqual(messages)
		})

		it("应该在消息数量超过阈值时移除旧消息", () => {
			const result = MessageWindowManager.applyWindow(testMessages)

			expect(result.length).toBeLessThanOrEqual(MESSAGE_WINDOW_CONFIG.KEEP_RECENT_MESSAGES)
			// 应该保留第一条消息（task 消息）
			expect(result[0]).toEqual(testMessages[0])
		})

		it("应该保留最新的消息", () => {
			const result = MessageWindowManager.applyWindow(testMessages)

			// 检查最后几条消息是否被保留
			const lastMessage = result[result.length - 1]
			const originalLastMessage = testMessages[testMessages.length - 1]
			expect(lastMessage.ts).toBe(originalLastMessage.ts)
		})

		it("应该在禁用时返回原数组", () => {
			// 暂时修改配置
			const originalEnabled = MESSAGE_WINDOW_CONFIG.ENABLED
			;(MESSAGE_WINDOW_CONFIG as any).ENABLED = false

			const result = MessageWindowManager.applyWindow(testMessages)

			expect(result).toEqual(testMessages)

			// 恢复配置
			;(MESSAGE_WINDOW_CONFIG as any).ENABLED = originalEnabled
		})
	})

	describe("estimateMemoryUsage", () => {
		it("应该返回正数", () => {
			const messages = testMessages.slice(0, 100)
			const usage = MessageWindowManager.estimateMemoryUsage(messages)

			expect(usage).toBeGreaterThan(0)
		})

		it("应该随消息数量增加而增加", () => {
			const messages100 = testMessages.slice(0, 100)
			const messages200 = testMessages.slice(0, 200)

			const usage100 = MessageWindowManager.estimateMemoryUsage(messages100)
			const usage200 = MessageWindowManager.estimateMemoryUsage(messages200)

			expect(usage200).toBeGreaterThan(usage100)
		})
	})

	describe("formatMemorySize", () => {
		it("应该正确格式化字节", () => {
			expect(MessageWindowManager.formatMemorySize(500)).toBe("500 B")
		})

		it("应该正确格式化KB", () => {
			const result = MessageWindowManager.formatMemorySize(1024 * 10)
			expect(result).toContain("KB")
		})

		it("应该正确格式化MB", () => {
			const result = MessageWindowManager.formatMemorySize(1024 * 1024 * 10)
			expect(result).toContain("MB")
		})
	})

	describe("getStats", () => {
		it("应该返回正确的统计信息", () => {
			const messages = testMessages.slice(0, 500)
			const stats = MessageWindowManager.getStats(messages)

			expect(stats.messageCount).toBe(500)
			expect(stats.estimatedMemory).toBeDefined()
			expect(stats.isOverLimit).toBe(false)
			expect(stats.utilizationPercent).toBeGreaterThan(0)
		})

		it("应该检测超过限制的情况", () => {
			const stats = MessageWindowManager.getStats(testMessages)

			expect(stats.isOverLimit).toBe(true)
			expect(stats.utilizationPercent).toBeGreaterThan(100)
		})
	})
})
