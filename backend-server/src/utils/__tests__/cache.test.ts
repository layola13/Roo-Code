import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { Cache, CacheKeys } from "../cache.js"
import { redis } from "../../config/redis.js"

describe("Cache", () => {
	const cache = new Cache()
	const testKey = "test:key"

	beforeAll(async () => {
		// 确保 Redis 连接
		await redis.ping()
	})

	beforeEach(async () => {
		// 清理测试键
		await redis.del(testKey)
	})

	afterAll(async () => {
		// 清理并关闭连接
		await redis.del(testKey)
	})

	describe("get and set", () => {
		it("should set and get a value", async () => {
			const value = { foo: "bar", num: 123 }
			await cache.set(testKey, value)

			const result = await cache.get(testKey)
			expect(result).toEqual(value)
		})

		it("should return null for non-existent key", async () => {
			const result = await cache.get("non:existent:key")
			expect(result).toBeNull()
		})

		it("should set value with TTL", async () => {
			await cache.set(testKey, "test", 1)

			const ttl = await cache.ttl(testKey)
			expect(ttl).toBeGreaterThan(0)
			expect(ttl).toBeLessThanOrEqual(1)
		})
	})

	describe("del", () => {
		it("should delete a key", async () => {
			await cache.set(testKey, "value")
			await cache.del(testKey)

			const result = await cache.get(testKey)
			expect(result).toBeNull()
		})
	})

	describe("exists", () => {
		it("should check if key exists", async () => {
			await cache.set(testKey, "value")

			const exists = await cache.exists(testKey)
			expect(exists).toBe(true)

			await cache.del(testKey)
			const notExists = await cache.exists(testKey)
			expect(notExists).toBe(false)
		})
	})

	describe("incr and decr", () => {
		it("should increment counter", async () => {
			const count1 = await cache.incr(testKey)
			const count2 = await cache.incr(testKey)

			expect(count1).toBe(1)
			expect(count2).toBe(2)
		})

		it("should decrement counter", async () => {
			await cache.set(testKey, 10)
			const count = await cache.decr(testKey)

			expect(count).toBe(9)
		})
	})

	describe("set operations", () => {
		it("should add and remove set members", async () => {
			await cache.sadd(testKey, "member1", "member2")

			const members = await cache.smembers(testKey)
			expect(members).toContain("member1")
			expect(members).toContain("member2")

			const isMember = await cache.sismember(testKey, "member1")
			expect(isMember).toBe(true)

			await cache.srem(testKey, "member1")
			const remainingMembers = await cache.smembers(testKey)
			expect(remainingMembers).not.toContain("member1")
		})

		it("should get set cardinality", async () => {
			await cache.sadd(testKey, "a", "b", "c")

			const size = await cache.scard(testKey)
			expect(size).toBe(3)
		})
	})

	describe("hash operations", () => {
		it("should set and get hash field", async () => {
			const value = { test: "data" }
			await cache.hset(testKey, "field1", value)

			const result = await cache.hget(testKey, "field1")
			expect(result).toEqual(value)
		})

		it("should get all hash fields", async () => {
			await cache.hset(testKey, "field1", { a: 1 })
			await cache.hset(testKey, "field2", { b: 2 })

			const all = await cache.hgetall(testKey)
			expect(all.field1).toEqual({ a: 1 })
			expect(all.field2).toEqual({ b: 2 })
		})

		it("should delete hash field", async () => {
			await cache.hset(testKey, "field1", "value")
			await cache.hdel(testKey, "field1")

			const result = await cache.hget(testKey, "field1")
			expect(result).toBeNull()
		})
	})

	describe("CacheKeys", () => {
		it("should generate correct cache keys", () => {
			expect(CacheKeys.session("token123")).toBe("session:token123")
			expect(CacheKeys.userSettings("user1")).toBe("user:settings:user1")
			expect(CacheKeys.task("task1")).toBe("task:task1")
			expect(CacheKeys.online("user1")).toBe("online:user1")
		})
	})
})
