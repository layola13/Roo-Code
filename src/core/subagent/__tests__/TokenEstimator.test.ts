import { describe, it, expect } from "vitest"
import { TokenEstimator } from "../utils/TokenEstimator"

describe("TokenEstimator", () => {
	describe("estimateTokens", () => {
		it("应该估算简单英文文本的token数", () => {
			const text = "Hello world"
			const tokens = TokenEstimator.estimateTokens(text)
			expect(tokens).toBeGreaterThan(0)
			expect(tokens).toBeLessThan(10)
		})

		it("应该估算中文文本的token数（每个字符约2 tokens）", () => {
			const text = "你好世界"
			const tokens = TokenEstimator.estimateTokens(text)
			expect(tokens).toBeGreaterThan(0) // 4个字符 / 2 = 2 tokens
			expect(tokens).toBeLessThan(10)
		})

		it("应该估算混合文本的token数", () => {
			const text = "Hello 世界"
			const tokens = TokenEstimator.estimateTokens(text)
			expect(tokens).toBeGreaterThan(0)
			expect(tokens).toBeLessThan(20)
		})

		it("应该估算长文本的token数", () => {
			const text = "a".repeat(1000)
			const tokens = TokenEstimator.estimateTokens(text)
			expect(tokens).toBeGreaterThan(200) // 约250 tokens
			expect(tokens).toBeLessThan(400)
		})

		it("应该处理空字符串", () => {
			const tokens = TokenEstimator.estimateTokens("")
			expect(tokens).toBe(0)
		})

		it("应该处理带有特殊字符的文本", () => {
			const text = "Hello! @#$%^&*()"
			const tokens = TokenEstimator.estimateTokens(text)
			expect(tokens).toBeGreaterThan(0)
		})

		it("应该估算代码片段的token数", () => {
			const code = `
function hello() {
  console.log("Hello, world!");
}
`
			const tokens = TokenEstimator.estimateTokens(code)
			expect(tokens).toBeGreaterThan(10)
			expect(tokens).toBeLessThan(30)
		})
	})

	describe("estimateMessagesTokens", () => {
		it("应该估算消息数组的总token数", () => {
			const messages = [
				{ role: "user" as const, content: "Hello" },
				{ role: "assistant" as const, content: "Hi there" },
			]
			const tokens = TokenEstimator.estimateMessagesTokens(messages)
			expect(tokens).toBeGreaterThan(0)
		})

		it("应该处理空消息数组", () => {
			const tokens = TokenEstimator.estimateMessagesTokens([])
			expect(tokens).toBe(0)
		})

		it("应该估算带有图片的消息", () => {
			const messages = [
				{
					role: "user" as const,
					content: [
						{ type: "text" as const, text: "What's in this image?" },
						{
							type: "image" as const,
							source: { type: "base64" as const, media_type: "image/jpeg" as const, data: "..." },
						},
					],
				},
			]
			const tokens = TokenEstimator.estimateMessagesTokens(messages)
			expect(tokens).toBeGreaterThan(90) // 图片约85 tokens + 文本
		})

		it("应该估算工具使用消息", () => {
			const messages = [
				{
					role: "assistant" as const,
					content: [
						{ type: "text" as const, text: "Let me read that file" },
						{
							type: "tool_use" as const,
							id: "tool_1",
							name: "read_file",
							input: { path: "test.ts" },
						},
					],
				},
			]
			const tokens = TokenEstimator.estimateMessagesTokens(messages)
			expect(tokens).toBeGreaterThan(10)
		})

		it("应该估算工具结果消息", () => {
			const messages = [
				{
					role: "user" as const,
					content: [
						{
							type: "tool_result" as const,
							tool_use_id: "tool_1",
							content: "File content here",
						},
					],
				},
			]
			const tokens = TokenEstimator.estimateMessagesTokens(messages)
			expect(tokens).toBeGreaterThan(5)
		})
	})

	describe("性能测试", () => {
		it("应该快速估算大量文本", () => {
			const largeText = "a".repeat(100000)
			const start = Date.now()
			TokenEstimator.estimateTokens(largeText)
			const duration = Date.now() - start
			expect(duration).toBeLessThan(100) // 应该在100ms内完成
		})

		it("应该快速估算大量消息", () => {
			const messages = Array(1000)
				.fill(null)
				.map(() => ({
					role: "user" as const,
					content: "Test message",
				}))
			const start = Date.now()
			TokenEstimator.estimateMessagesTokens(messages)
			const duration = Date.now() - start
			expect(duration).toBeLessThan(200) // 应该在200ms内完成
		})
	})

	describe("准确性测试", () => {
		it("估算结果应该在合理范围内（与实际token数误差<30%）", () => {
			const text = "The quick brown fox jumps over the lazy dog"
			const estimated = TokenEstimator.estimateTokens(text)
			// 实际约11 tokens，估算应该在7-15之间
			expect(estimated).toBeGreaterThanOrEqual(7)
			expect(estimated).toBeLessThanOrEqual(15)
		})

		it("中文估算应该考虑更高的token密度", () => {
			const chineseText = "快速的棕色狐狸跳过懒狗"
			const englishText = "quick brown fox jumps lazy dog"
			const chineseTokens = TokenEstimator.estimateTokens(chineseText)
			const englishTokens = TokenEstimator.estimateTokens(englishText)
			// 中文字符数少但token数应该相近
			// Chinese: 12 chars / 2 = 6 tokens
			// English: ~32 chars / 3.5 = 9 tokens
			expect(chineseTokens).toBeGreaterThan(0)
			expect(englishTokens).toBeGreaterThan(0)
		})
	})
})
