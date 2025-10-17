import { describe, it, expect, beforeEach, vi } from "vitest"
import { SemanticCompressor } from "../compression/SemanticCompressor"
import type { Anthropic } from "@anthropic-ai/sdk"

describe("SemanticCompressor", () => {
	let compressor: SemanticCompressor
	let mockQdrantClient: any

	beforeEach(() => {
		// Mock Qdrant client
		mockQdrantClient = {
			search: vi.fn().mockResolvedValue([
				{ id: "msg_1", score: 0.95, payload: { content: "Similar message 1" } },
				{ id: "msg_2", score: 0.85, payload: { content: "Similar message 2" } },
			]),
			upsert: vi.fn().mockResolvedValue({ status: "completed" }),
		}

		compressor = new SemanticCompressor({
			qdrantUrl: "http://localhost:6333",
			collectionName: "test_collection",
		})

		// Inject mock client
		;(compressor as any).qdrantClient = mockQdrantClient
	})

	describe("compress", () => {
		it("应该压缩相似的消息", async () => {
			const messages: Anthropic.MessageParam[] = [
				{ role: "user", content: "Hello world" },
				{ role: "assistant", content: "Hi there" },
				{ role: "user", content: "Hello world again" },
				{ role: "assistant", content: "Hi again" },
			]

			const result = await compressor.compress(messages, {
				targetTokens: 50,
				minSimilarity: 0.8,
			})

			expect(result.compressed).toBeDefined()
			expect(Array.isArray(result.compressed)).toBe(true)
			expect(result.originalTokens).toBeGreaterThan(0)
			expect(result.compressedTokens).toBeLessThanOrEqual(result.originalTokens)
		})

		it("应该处理空消息数组", async () => {
			const result = await compressor.compress([], {
				targetTokens: 100,
			})

			expect(result.compressed).toEqual([])
			expect(result.originalTokens).toBe(0)
			expect(result.compressedTokens).toBe(0)
			expect(result.compressionRatio).toBe(0)
		})

		it("应该保留重要消息（不压缩已经很少的内容）", async () => {
			const messages: Anthropic.MessageParam[] = [
				{ role: "user", content: "Short" },
				{ role: "assistant", content: "OK" },
			]

			const result = await compressor.compress(messages, {
				targetTokens: 100, // 目标大于当前
			})

			expect(result.compressed.length).toBe(messages.length)
		})

		it("应该计算正确的压缩比率", async () => {
			const messages: Anthropic.MessageParam[] = [
				{ role: "user", content: "a".repeat(1000) },
				{ role: "assistant", content: "b".repeat(1000) },
			]

			const result = await compressor.compress(messages, {
				targetTokens: 50,
			})

			expect(result.compressionRatio).toBeGreaterThan(0)
			expect(result.compressionRatio).toBeLessThanOrEqual(1)
			expect(result.compressionRatio).toBe(result.compressedTokens / result.originalTokens)
		})

		it("应该处理复杂内容类型的消息", async () => {
			const messages: Anthropic.MessageParam[] = [
				{
					role: "user",
					content: [
						{ type: "text", text: "Look at this" },
						{
							type: "image",
							source: {
								type: "base64",
								media_type: "image/jpeg",
								data: "fake_image_data",
							},
						},
					],
				},
				{
					role: "assistant",
					content: [
						{ type: "text", text: "I see" },
						{
							type: "tool_use",
							id: "tool_1",
							name: "analyze_image",
							input: {},
						},
					],
				},
			]

			const result = await compressor.compress(messages, {
				targetTokens: 50,
			})

			expect(result.compressed).toBeDefined()
			expect(result.originalTokens).toBeGreaterThan(0)
		})
	})

	// Note: findSimilarClusters and mergeSimilarMessages are internal implementation details
	// not exposed in the simplified version. These tests are skipped.
	describe.skip("findSimilarClusters", () => {
		it("应该找到相似的消息簇", async () => {
			// Skipped - internal implementation detail
		})
	})

	describe.skip("mergeSimilarMessages", () => {
		it("应该合并相似的消息", () => {
			// Skipped - internal implementation detail
		})

		it("应该处理assistant角色的消息", () => {
			// Skipped - internal implementation detail
		})
	})

	describe("性能测试", () => {
		it("应该在合理时间内压缩大量消息", async () => {
			const messages: Anthropic.MessageParam[] = Array(100)
				.fill(null)
				.map((_, i) => ({
					role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
					content: `Message ${i}`,
				}))

			const start = Date.now()
			await compressor.compress(messages, { targetTokens: 500 })
			const duration = Date.now() - start

			expect(duration).toBeLessThan(5000) // 应该在5秒内完成
		})
	})

	describe("边界条件测试", () => {
		it("应该处理只有一条消息的情况", async () => {
			const messages: Anthropic.MessageParam[] = [{ role: "user", content: "Single message" }]

			const result = await compressor.compress(messages, {
				targetTokens: 10,
			})

			expect(result.compressed.length).toBeGreaterThan(0)
		})

		it("应该处理极小的targetTokens", async () => {
			const messages: Anthropic.MessageParam[] = [
				{ role: "user", content: "a".repeat(1000) },
				{ role: "assistant", content: "b".repeat(1000) },
			]

			const result = await compressor.compress(messages, {
				targetTokens: 10, // 极小的目标
			})

			expect(result.compressedTokens).toBeLessThanOrEqual(result.originalTokens)
			expect(result.compressed.length).toBeGreaterThan(0) // 至少保留一些内容
		})

		it("应该处理minSimilarity为0的情况（聚类所有消息）", async () => {
			const messages: Anthropic.MessageParam[] = [
				{ role: "user", content: "A" },
				{ role: "user", content: "B" },
				{ role: "user", content: "C" },
			]

			const result = await compressor.compress(messages, {
				targetTokens: 50,
				minSimilarity: 0, // 0相似度
			})

			expect(result.compressed).toBeDefined()
		})

		it("应该处理minSimilarity为1的情况（只聚类完全相同的）", async () => {
			const messages: Anthropic.MessageParam[] = [
				{ role: "user", content: "Same" },
				{ role: "user", content: "Same" },
				{ role: "user", content: "Different" },
			]

			const result = await compressor.compress(messages, {
				targetTokens: 50,
				minSimilarity: 1, // 完全相同
			})

			expect(result.compressed).toBeDefined()
		})
	})

	describe("错误处理", () => {
		it("应该处理Qdrant连接失败", async () => {
			mockQdrantClient.search.mockRejectedValue(new Error("Connection failed"))

			const messages: Anthropic.MessageParam[] = [{ role: "user", content: "Test" }]

			// 应该降级到简单压缩，不抛出错误
			await expect(
				compressor.compress(messages, {
					targetTokens: 10,
				}),
			).resolves.toBeDefined()
		})

		it("应该处理无效的消息内容", async () => {
			const messages: any[] = [
				{ role: "user", content: null }, // 无效内容
				{ role: "assistant", content: undefined }, // 无效内容
			]

			const result = await compressor.compress(messages, {
				targetTokens: 50,
			})

			expect(result.compressed).toBeDefined()
		})
	})
})
