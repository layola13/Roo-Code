import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { TieredStorageManager } from "../storage/TieredStorageManager"
import type { Anthropic } from "@anthropic-ai/sdk"

describe("TieredStorageManager", () => {
	let storage: TieredStorageManager
	let mockRedisClient: any
	let mockQdrantClient: any

	beforeEach(() => {
		// Mock Redis client
		mockRedisClient = {
			get: vi.fn(),
			set: vi.fn(),
			del: vi.fn(),
			keys: vi.fn(),
			ttl: vi.fn(),
			expire: vi.fn(),
			quit: vi.fn(),
			isOpen: true,
		}

		// Mock Qdrant client
		mockQdrantClient = {
			search: vi.fn(),
			upsert: vi.fn(),
			delete: vi.fn(),
		}

		storage = new TieredStorageManager({
			redisUrl: "redis://localhost:6379",
			qdrantUrl: "http://localhost:6333",
			collectionName: "test_collection",
		})

		// Inject mock clients
		;(storage as any).redisClient = mockRedisClient
		;(storage as any).qdrantClient = mockQdrantClient
	})

	afterEach(async () => {
		await storage.cleanup()
	})

	describe("storeContext", () => {
		it("应该存储上下文到Redis（热数据）", async () => {
			const contextId = "test_context_1"
			const messages: Anthropic.MessageParam[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi" },
			]

			mockRedisClient.set.mockResolvedValue("OK")

			await storage.storeContext(contextId, messages, {
				tier: "hot",
				ttl: 3600,
			})

			expect(mockRedisClient.set).toHaveBeenCalled()
			const setCall = mockRedisClient.set.mock.calls[0]
			expect(setCall[0]).toContain(contextId)
			expect(setCall[2]).toEqual({ EX: 3600 })
		})

		it("应该存储上下文到Vector DB（冷数据）", async () => {
			const contextId = "test_context_2"
			const messages: Anthropic.MessageParam[] = [{ role: "user", content: "Long term memory" }]

			mockQdrantClient.upsert.mockResolvedValue({ status: "completed" })

			await storage.storeContext(contextId, messages, {
				tier: "cold",
			})

			expect(mockQdrantClient.upsert).toHaveBeenCalled()
		})

		it("应该处理空消息数组", async () => {
			await storage.storeContext("empty_context", [], {
				tier: "hot",
			})

			expect(mockRedisClient.set).toHaveBeenCalled()
		})

		it("应该使用默认TTL（1小时）", async () => {
			mockRedisClient.set.mockResolvedValue("OK")

			await storage.storeContext("default_ttl_context", [{ role: "user", content: "Test" }], {
				tier: "hot",
			})

			const setCall = mockRedisClient.set.mock.calls[0]
			expect(setCall[2]).toEqual({ EX: 3600 }) // 默认1小时
		})
	})

	describe("retrieveContext", () => {
		it("应该从Redis检索热数据", async () => {
			const contextId = "hot_context"
			const storedData = JSON.stringify({
				messages: [{ role: "user", content: "Cached" }],
				metadata: { tier: "hot" },
			})

			mockRedisClient.get.mockResolvedValue(storedData)

			const result = await storage.retrieveContext(contextId)

			expect(mockRedisClient.get).toHaveBeenCalledWith(expect.stringContaining(contextId))
			expect(result).toBeDefined()
			expect(result?.messages).toHaveLength(1)
			expect(result?.metadata.tier).toBe("hot")
		})

		it("应该从Vector DB检索冷数据", async () => {
			const contextId = "cold_context"

			mockRedisClient.get.mockResolvedValue(null) // Redis中不存在
			mockQdrantClient.search.mockResolvedValue([
				{
					id: contextId,
					score: 0.95,
					payload: {
						messages: [{ role: "user", content: "Archived" }],
						metadata: { tier: "cold" },
					},
				},
			])

			const result = await storage.retrieveContext(contextId)

			expect(mockRedisClient.get).toHaveBeenCalled()
			expect(mockQdrantClient.search).toHaveBeenCalled()
			expect(result).toBeDefined()
			expect(result?.messages).toHaveLength(1)
		})

		it("应该返回null如果上下文不存在", async () => {
			mockRedisClient.get.mockResolvedValue(null)
			mockQdrantClient.search.mockResolvedValue([])

			const result = await storage.retrieveContext("nonexistent")

			expect(result).toBeNull()
		})

		it("应该处理Redis解析错误", async () => {
			mockRedisClient.get.mockResolvedValue("invalid json")

			const result = await storage.retrieveContext("invalid_context")

			expect(result).toBeNull()
		})
	})

	describe("deleteContext", () => {
		it("应该从Redis删除上下文", async () => {
			const contextId = "to_delete"

			mockRedisClient.del.mockResolvedValue(1)
			mockQdrantClient.delete.mockResolvedValue({ status: "completed" })

			await storage.deleteContext(contextId)

			expect(mockRedisClient.del).toHaveBeenCalledWith(expect.stringContaining(contextId))
			expect(mockQdrantClient.delete).toHaveBeenCalled()
		})

		it("应该处理删除不存在的上下文", async () => {
			mockRedisClient.del.mockResolvedValue(0) // 没有删除任何key
			mockQdrantClient.delete.mockResolvedValue({ status: "completed" })

			await expect(storage.deleteContext("nonexistent")).resolves.not.toThrow()
		})
	})

	describe("promoteToHot", () => {
		it("应该将冷数据提升到热存储", async () => {
			const contextId = "promote_context"

			// 模拟从cold检索
			mockRedisClient.get.mockResolvedValue(null)
			mockQdrantClient.search.mockResolvedValue([
				{
					id: contextId,
					payload: {
						messages: [{ role: "user", content: "Promote me" }],
						metadata: { tier: "cold" },
					},
				},
			])

			mockRedisClient.set.mockResolvedValue("OK")

			await storage.promoteToHot(contextId, 7200)

			expect(mockRedisClient.set).toHaveBeenCalled()
			const setCall = mockRedisClient.set.mock.calls[0]
			expect(setCall[2]).toEqual({ EX: 7200 })
		})

		it("应该处理上下文不存在的情况", async () => {
			mockRedisClient.get.mockResolvedValue(null)
			mockQdrantClient.search.mockResolvedValue([])

			await expect(storage.promoteToHot("nonexistent")).resolves.not.toThrow()
		})
	})

	describe("demoteToCold", () => {
		it("应该将热数据降级到冷存储", async () => {
			const contextId = "demote_context"
			const messages: Anthropic.MessageParam[] = [{ role: "user", content: "Demote me" }]

			// 先存储到热存储
			mockRedisClient.set.mockResolvedValue("OK")
			await storage.storeContext(contextId, messages, { tier: "hot" })

			// 然后降级
			mockQdrantClient.upsert.mockResolvedValue({ status: "completed" })
			mockRedisClient.del.mockResolvedValue(1)

			await storage.demoteToCold(contextId)

			expect(mockQdrantClient.upsert).toHaveBeenCalled()
			expect(mockRedisClient.del).toHaveBeenCalledWith(expect.stringContaining(contextId))
		})

		it("应该处理上下文不存在的情况", async () => {
			await expect(storage.demoteToCold("nonexistent")).resolves.not.toThrow()
		})
	})

	describe("listContexts", () => {
		it("应该列出指定层级的所有上下文", async () => {
			mockRedisClient.keys.mockResolvedValue(["context:hot:1", "context:hot:2", "context:hot:3"])

			const contexts = await storage.listContexts("hot")

			expect(mockRedisClient.keys).toHaveBeenCalledWith("context:hot:*")
			expect(contexts).toHaveLength(3)
			expect(contexts[0]).toBe("1")
		})

		it("应该处理没有上下文的情况", async () => {
			mockRedisClient.keys.mockResolvedValue([])

			const contexts = await storage.listContexts("hot")

			expect(contexts).toEqual([])
		})
	})

	describe("getStats", () => {
		it("应该返回存储统计信息", async () => {
			mockRedisClient.keys.mockResolvedValue(["context:hot:1", "context:hot:2"])

			const stats = await storage.getStats()

			expect(stats).toBeDefined()
			expect(stats.hotCount).toBeGreaterThanOrEqual(0)
			expect(stats.coldCount).toBeGreaterThanOrEqual(0)
		})
	})

	describe("性能测试", () => {
		it("应该快速存储大量上下文", async () => {
			mockRedisClient.set.mockResolvedValue("OK")

			const contexts = Array(100)
				.fill(null)
				.map((_, i) => ({
					id: `context_${i}`,
					messages: [{ role: "user" as const, content: `Message ${i}` }],
				}))

			const start = Date.now()
			await Promise.all(
				contexts.map((ctx) =>
					storage.storeContext(ctx.id, ctx.messages, {
						tier: "hot",
					}),
				),
			)
			const duration = Date.now() - start

			expect(duration).toBeLessThan(2000) // 应该在2秒内完成
		})

		it("应该快速检索大量上下文", async () => {
			mockRedisClient.get.mockResolvedValue(
				JSON.stringify({
					messages: [{ role: "user", content: "Test" }],
					metadata: { tier: "hot" },
				}),
			)

			const contextIds = Array(100)
				.fill(null)
				.map((_, i) => `context_${i}`)

			const start = Date.now()
			await Promise.all(contextIds.map((id) => storage.retrieveContext(id)))
			const duration = Date.now() - start

			expect(duration).toBeLessThan(2000) // 应该在2秒内完成
		})
	})

	describe("错误处理", () => {
		it("应该处理Redis连接错误", async () => {
			mockRedisClient.set.mockRejectedValue(new Error("Connection failed"))

			await expect(
				storage.storeContext("test", [{ role: "user", content: "Test" }], {
					tier: "hot",
				}),
			).rejects.toThrow()
		})

		it("应该处理Qdrant连接错误", async () => {
			mockQdrantClient.upsert.mockRejectedValue(new Error("Connection failed"))

			await expect(
				storage.storeContext("test", [{ role: "user", content: "Test" }], {
					tier: "cold",
				}),
			).rejects.toThrow()
		})

		it("应该处理检索时的网络错误", async () => {
			mockRedisClient.get.mockRejectedValue(new Error("Network error"))

			await expect(storage.retrieveContext("test")).rejects.toThrow()
		})
	})

	describe("清理功能", () => {
		it("应该正确清理资源", async () => {
			mockRedisClient.quit.mockResolvedValue("OK")

			await storage.cleanup()

			expect(mockRedisClient.quit).toHaveBeenCalled()
		})

		it("应该处理清理时的错误", async () => {
			mockRedisClient.quit.mockRejectedValue(new Error("Cleanup failed"))

			await expect(storage.cleanup()).resolves.not.toThrow()
		})
	})

	describe("边界条件测试", () => {
		it("应该处理极长的上下文ID", async () => {
			const longId = "a".repeat(1000)
			mockRedisClient.set.mockResolvedValue("OK")

			await expect(
				storage.storeContext(longId, [{ role: "user", content: "Test" }], {
					tier: "hot",
				}),
			).resolves.not.toThrow()
		})

		it("应该处理包含特殊字符的上下文ID", async () => {
			const specialId = "context:with:colons"
			mockRedisClient.set.mockResolvedValue("OK")

			await expect(
				storage.storeContext(specialId, [{ role: "user", content: "Test" }], {
					tier: "hot",
				}),
			).resolves.not.toThrow()
		})

		it("应该处理非常大的消息数组", async () => {
			const largeMessages: Anthropic.MessageParam[] = Array(1000)
				.fill(null)
				.map((_, i) => ({
					role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
					content: `Message ${i}`,
				}))

			mockRedisClient.set.mockResolvedValue("OK")

			await expect(
				storage.storeContext("large_context", largeMessages, {
					tier: "hot",
				}),
			).resolves.not.toThrow()
		})
	})
})
