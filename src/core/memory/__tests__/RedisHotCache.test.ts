import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { RedisHotCache } from "../RedisHotCache"

// Mock ioredis
vi.mock("ioredis", () => {
	const mockPipeline = {
		set: vi.fn().mockReturnThis(),
		exec: vi.fn().mockResolvedValue([]),
	}

	const mockRedisInstance = {
		get: vi.fn(),
		set: vi.fn(),
		del: vi.fn(),
		keys: vi.fn(),
		flushdb: vi.fn(),
		quit: vi.fn(),
		on: vi.fn(),
		ping: vi.fn(),
		pipeline: vi.fn(() => mockPipeline),
	}

	return {
		default: vi.fn(() => mockRedisInstance),
	}
})

describe("RedisHotCache", () => {
	let cache: RedisHotCache
	let mockRedis: any

	beforeEach(async () => {
		// 导入mock的Redis
		const Redis = (await import("ioredis")).default
		mockRedis = new Redis()

		// 创建cache实例
		cache = new RedisHotCache({
			redisUrl: "redis://localhost:6379",
			ttl: 3600,
			prefix: "test:",
		})

		// 重置所有mock
		vi.clearAllMocks()

		// 模拟成功连接
		mockRedis.ping.mockResolvedValue("PONG")
	})

	afterEach(async () => {
		if (cache) {
			await cache.disconnect()
		}
	})

	describe("构造和连接", () => {
		it("应该正确创建RedisHotCache实例", () => {
			expect(cache).toBeDefined()
		})

		it("应该成功连接到Redis", async () => {
			mockRedis.ping.mockResolvedValue("PONG")
			await cache.connect()
			expect(mockRedis.ping).toHaveBeenCalled()
		})

		it("应该处理连接失败", async () => {
			mockRedis.ping.mockRejectedValue(new Error("Connection failed"))

			await expect(cache.connect()).rejects.toThrow("Connection failed")
		})
	})

	describe("基本缓存操作", () => {
		beforeEach(async () => {
			mockRedis.ping.mockResolvedValue("PONG")
			await cache.connect()
		})

		it("应该能够设置字符串值", async () => {
			mockRedis.set.mockResolvedValue("OK")

			await cache.set("key1", "value1")

			expect(mockRedis.set).toHaveBeenCalledWith("test:key1", '"value1"', "EX", 3600)
		})

		it("应该能够设置对象值", async () => {
			mockRedis.set.mockResolvedValue("OK")

			const obj = { name: "test", value: 123 }
			await cache.set("key2", obj)

			expect(mockRedis.set).toHaveBeenCalledWith("test:key2", JSON.stringify(obj), "EX", 3600)
		})

		it("应该能够获取字符串值", async () => {
			mockRedis.get.mockResolvedValue('"cached_value"')

			const result = await cache.get<string>("key1")

			expect(mockRedis.get).toHaveBeenCalledWith("test:key1")
			expect(result).toBe("cached_value")
		})

		it("应该能够获取对象值", async () => {
			const obj = { name: "test", value: 123 }
			mockRedis.get.mockResolvedValue(JSON.stringify(obj))

			const result = await cache.get<typeof obj>("key2")

			expect(mockRedis.get).toHaveBeenCalledWith("test:key2")
			expect(result).toEqual(obj)
		})

		it("应该在键不存在时返回null", async () => {
			mockRedis.get.mockResolvedValue(null)

			const result = await cache.get<string>("nonexistent")

			expect(result).toBeNull()
		})

		it("应该能够删除键", async () => {
			mockRedis.del.mockResolvedValue(1)

			await cache.delete("key1")

			expect(mockRedis.del).toHaveBeenCalledWith("test:key1")
		})

		it("应该能够删除多个键", async () => {
			mockRedis.del.mockResolvedValue(2)

			await cache.delete(["key1", "key2"])

			expect(mockRedis.del).toHaveBeenCalledWith("test:key1", "test:key2")
		})
	})

	describe("TTL和过期管理", () => {
		beforeEach(async () => {
			mockRedis.ping.mockResolvedValue("PONG")
			await cache.connect()
		})

		it("应该使用默认TTL", async () => {
			mockRedis.set.mockResolvedValue("OK")

			await cache.set("key1", "value1")

			expect(mockRedis.set).toHaveBeenCalledWith("test:key1", '"value1"', "EX", 3600)
		})

		it("应该支持自定义TTL", async () => {
			mockRedis.set.mockResolvedValue("OK")

			await cache.set("key1", "value1", 7200)

			expect(mockRedis.set).toHaveBeenCalledWith("test:key1", '"value1"', "EX", 7200)
		})

		it("应该支持永不过期（TTL=0）", async () => {
			mockRedis.set.mockResolvedValue("OK")

			await cache.set("key1", "value1", 0)

			expect(mockRedis.set).toHaveBeenCalledWith("test:key1", '"value1"')
		})
	})

	describe("批量操作", () => {
		beforeEach(async () => {
			mockRedis.ping.mockResolvedValue("PONG")
			await cache.connect()
		})

		it("应该能够批量设置多个键值对", async () => {
			const mockPipeline = mockRedis.pipeline()
			mockPipeline.set.mockReturnThis()
			mockPipeline.exec.mockResolvedValue([])

			const entries: Record<string, any> = {
				key1: "value1",
				key2: { data: "value2" },
				key3: 123,
			}

			await cache.mset(entries)

			expect(mockRedis.pipeline).toHaveBeenCalled()
			expect(mockPipeline.set).toHaveBeenCalledTimes(3)
			expect(mockPipeline.set).toHaveBeenCalledWith("test:key1", '"value1"', "EX", 3600)
			expect(mockPipeline.set).toHaveBeenCalledWith("test:key2", JSON.stringify({ data: "value2" }), "EX", 3600)
			expect(mockPipeline.set).toHaveBeenCalledWith("test:key3", "123", "EX", 3600)
			expect(mockPipeline.exec).toHaveBeenCalled()
		})

		it("应该能够批量获取多个键", async () => {
			mockRedis.get.mockImplementation((key: string) => {
				if (key === "test:key1") return Promise.resolve('"value1"')
				if (key === "test:key2") return Promise.resolve(JSON.stringify({ data: "value2" }))
				if (key === "test:key3") return Promise.resolve("123")
				return Promise.resolve(null)
			})

			const result = await cache.mget(["key1", "key2", "key3"])

			expect(mockRedis.get).toHaveBeenCalledTimes(3)
			expect(result).toEqual({
				key1: "value1",
				key2: { data: "value2" },
				key3: 123,
			})
		})

		it("批量获取应该跳过不存在的键", async () => {
			mockRedis.get.mockImplementation((key: string) => {
				if (key === "test:key1") return Promise.resolve('"value1"')
				return Promise.resolve(null)
			})

			const result = await cache.mget(["key1", "key2", "key3"])

			expect(result).toEqual({
				key1: "value1",
			})
		})
	})

	describe("模式匹配操作", () => {
		beforeEach(async () => {
			mockRedis.ping.mockResolvedValue("PONG")
			await cache.connect()
		})

		it("应该能够按模式查找键", async () => {
			mockRedis.keys.mockResolvedValue(["test:user:1", "test:user:2", "test:user:3"])

			const keys = await cache.keys("user:*")

			expect(mockRedis.keys).toHaveBeenCalledWith("test:user:*")
			expect(keys).toEqual(["user:1", "user:2", "user:3"])
		})

		it("应该能够按模式删除键", async () => {
			mockRedis.keys.mockResolvedValue(["test:temp:1", "test:temp:2"])
			mockRedis.del.mockResolvedValue(2)

			const count = await cache.deleteByPattern("temp:*")

			expect(mockRedis.keys).toHaveBeenCalledWith("test:temp:*")
			expect(mockRedis.del).toHaveBeenCalledWith("test:temp:1", "test:temp:2")
			expect(count).toBe(2)
		})

		it("按模式删除时没有匹配键应返回0", async () => {
			mockRedis.keys.mockResolvedValue([])

			const count = await cache.deleteByPattern("nonexistent:*")

			expect(count).toBe(0)
			expect(mockRedis.del).not.toHaveBeenCalled()
		})
	})

	describe("清空操作", () => {
		beforeEach(async () => {
			mockRedis.ping.mockResolvedValue("PONG")
			await cache.connect()
		})

		it("应该能够清空所有带前缀的键", async () => {
			mockRedis.keys.mockResolvedValue(["test:key1", "test:key2", "test:key3"])
			mockRedis.del.mockResolvedValue(3)

			await cache.clearAll()

			expect(mockRedis.keys).toHaveBeenCalledWith("test:*")
			expect(mockRedis.del).toHaveBeenCalledWith("test:key1", "test:key2", "test:key3")
		})

		it("清空时没有键应该不调用删除", async () => {
			mockRedis.keys.mockResolvedValue([])

			await cache.clearAll()

			expect(mockRedis.del).not.toHaveBeenCalled()
		})
	})

	describe("错误处理", () => {
		beforeEach(async () => {
			mockRedis.ping.mockResolvedValue("PONG")
			await cache.connect()
		})

		it("应该处理get操作中的JSON解析错误", async () => {
			mockRedis.get.mockResolvedValue("invalid json{")

			const result = await cache.get<any>("key1")

			// 解析失败时应该返回null
			expect(result).toBeNull()
		})

		it("应该处理set操作失败", async () => {
			mockRedis.set.mockRejectedValue(new Error("Redis error"))

			await expect(cache.set("key1", "value1")).rejects.toThrow("Redis error")
		})

		it("应该处理delete操作失败", async () => {
			mockRedis.del.mockRejectedValue(new Error("Redis error"))

			await expect(cache.delete("key1")).rejects.toThrow("Redis error")
		})

		it("应该处理keys操作失败", async () => {
			mockRedis.keys.mockRejectedValue(new Error("Redis error"))

			await expect(cache.keys("*")).rejects.toThrow("Redis error")
		})
	})

	describe("前缀管理", () => {
		it("应该正确添加前缀", async () => {
			mockRedis.ping.mockResolvedValue("PONG")
			await cache.connect()

			mockRedis.set.mockResolvedValue("OK")
			await cache.set("mykey", "value")

			expect(mockRedis.set).toHaveBeenCalledWith("test:mykey", '"value"', "EX", 3600)
		})

		it("应该支持空前缀", async () => {
			const noPrefixCache = new RedisHotCache({
				redisUrl: "redis://localhost:6379",
				ttl: 3600,
				prefix: "",
			})

			mockRedis.ping.mockResolvedValue("PONG")
			await noPrefixCache.connect()

			mockRedis.set.mockResolvedValue("OK")
			await noPrefixCache.set("mykey", "value")

			expect(mockRedis.set).toHaveBeenCalledWith("mykey", '"value"', "EX", 3600)

			await noPrefixCache.disconnect()
		})
	})

	describe("连接管理", () => {
		it("应该能够断开连接", async () => {
			mockRedis.ping.mockResolvedValue("PONG")
			mockRedis.quit.mockResolvedValue("OK")

			await cache.connect()
			await cache.disconnect()

			expect(mockRedis.quit).toHaveBeenCalled()
		})

		it("多次断开连接应该是安全的", async () => {
			mockRedis.ping.mockResolvedValue("PONG")
			mockRedis.quit.mockResolvedValue("OK")

			await cache.connect()
			await cache.disconnect()
			await cache.disconnect() // 第二次断开应该不会出错

			expect(mockRedis.quit).toHaveBeenCalledTimes(1)
		})
	})

	describe("统计信息", () => {
		beforeEach(async () => {
			mockRedis.ping.mockResolvedValue("PONG")
			await cache.connect()
		})

		it("应该跟踪命中次数", async () => {
			mockRedis.get.mockResolvedValue('"cached"')

			await cache.get("key1")
			const stats = cache.getStats()

			expect(stats.hits).toBe(1)
			expect(stats.misses).toBe(0)
		})

		it("应该跟踪未命中次数", async () => {
			mockRedis.get.mockResolvedValue(null)

			await cache.get("nonexistent")
			const stats = cache.getStats()

			expect(stats.hits).toBe(0)
			expect(stats.misses).toBe(1)
		})

		it("应该正确计算命中率", async () => {
			mockRedis.get
				.mockResolvedValueOnce('"value1"') // hit
				.mockResolvedValueOnce(null) // miss
				.mockResolvedValueOnce('"value2"') // hit
				.mockResolvedValueOnce(null) // miss

			await cache.get("key1")
			await cache.get("key2")
			await cache.get("key3")
			await cache.get("key4")

			const stats = cache.getStats()

			expect(stats.hits).toBe(2)
			expect(stats.misses).toBe(2)
			expect(stats.hitRate).toBe(0.5)
		})

		it("零次访问时命中率应该为0", () => {
			const stats = cache.getStats()

			expect(stats.hitRate).toBe(0)
		})

		it("应该能够重置统计信息", async () => {
			mockRedis.get.mockResolvedValue('"value"')

			await cache.get("key1")
			let stats = cache.getStats()
			expect(stats.hits).toBe(1)

			cache.resetStats()
			stats = cache.getStats()

			expect(stats.hits).toBe(0)
			expect(stats.misses).toBe(0)
			expect(stats.hitRate).toBe(0)
		})
	})

	describe("复杂数据类型", () => {
		beforeEach(async () => {
			mockRedis.ping.mockResolvedValue("PONG")
			await cache.connect()
		})

		it("应该能够缓存数组", async () => {
			const arr = [1, 2, 3, { name: "test" }]
			mockRedis.set.mockResolvedValue("OK")
			mockRedis.get.mockResolvedValue(JSON.stringify(arr))

			await cache.set("array", arr)
			const result = await cache.get<typeof arr>("array")

			expect(result).toEqual(arr)
		})

		it("应该能够缓存嵌套对象", async () => {
			const obj = {
				user: {
					name: "John",
					profile: {
						age: 30,
						tags: ["developer", "tester"],
					},
				},
			}
			mockRedis.set.mockResolvedValue("OK")
			mockRedis.get.mockResolvedValue(JSON.stringify(obj))

			await cache.set("nested", obj)
			const result = await cache.get<typeof obj>("nested")

			expect(result).toEqual(obj)
		})

		it("应该能够缓存null值", async () => {
			mockRedis.set.mockResolvedValue("OK")
			mockRedis.get.mockResolvedValue("null")

			await cache.set("null_value", null)
			const result = await cache.get("null_value")

			expect(result).toBeNull()
		})

		it("应该能够缓存布尔值", async () => {
			mockRedis.set.mockResolvedValue("OK")
			mockRedis.get.mockResolvedValue("true")

			await cache.set("bool", true)
			const result = await cache.get<boolean>("bool")

			expect(result).toBe(true)
		})

		it("应该能够缓存数字", async () => {
			mockRedis.set.mockResolvedValue("OK")
			mockRedis.get.mockResolvedValue("42")

			await cache.set("number", 42)
			const result = await cache.get<number>("number")

			expect(result).toBe(42)
		})
	})
})
