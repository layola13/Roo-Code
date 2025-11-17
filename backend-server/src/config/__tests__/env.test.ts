import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { env, isProduction, isDevelopment, isTest } from "../env.js"

describe("env", () => {
	const originalEnv = process.env

	beforeEach(() => {
		// 重置环境变量
		process.env = { ...originalEnv }
	})

	afterEach(() => {
		// 恢复原始环境变量
		process.env = originalEnv
	})

	it("should have default values", () => {
		expect(env.NODE_ENV).toBeDefined()
		expect(env.PORT).toBeGreaterThan(0)
		expect(env.DB_HOST).toBeDefined()
		expect(env.DB_PORT).toBeGreaterThan(0)
		expect(env.REDIS_HOST).toBeDefined()
		expect(env.REDIS_PORT).toBeGreaterThan(0)
	})

	it("should parse port as number", () => {
		expect(typeof env.PORT).toBe("number")
		expect(typeof env.DB_PORT).toBe("number")
		expect(typeof env.REDIS_PORT).toBe("number")
	})

	it("should have JWT_SECRET defined", () => {
		expect(env.JWT_SECRET).toBeDefined()
		expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(32)
	})

	it("should export helper functions", () => {
		expect(typeof isProduction).toBe("boolean")
		expect(typeof isDevelopment).toBe("boolean")
		expect(typeof isTest).toBe("boolean")

		// 确保只有一个为 true
		const trueCount = [isProduction, isDevelopment, isTest].filter((v) => v).length
		expect(trueCount).toBe(1)
	})
})
