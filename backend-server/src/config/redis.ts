import { Redis } from "ioredis"
import type { RedisOptions } from "ioredis"
import { env } from "./env.js"

/**
 * Redis 配置选项
 */
export const redisOptions: RedisOptions = {
	host: env.REDIS_HOST,
	port: env.REDIS_PORT,
	password: env.REDIS_PASSWORD,
	db: env.REDIS_DB,

	// 连接超时（毫秒）
	connectTimeout: 5000,

	// 重试策略
	retryStrategy(times: number) {
		const delay = Math.min(times * 50, 2000)
		return delay
	},

	// 最大重试次数
	maxRetriesPerRequest: 3,

	// 启用离线队列
	enableOfflineQueue: true,

	// 启用 ready check
	enableReadyCheck: true,

	// 自动重连
	autoResubscribe: true,
	autoResendUnfulfilledCommands: true,

	// Lazy connect
	lazyConnect: false,
}

/**
 * 创建 Redis 客户端实例
 */
export const redis = new Redis(redisOptions)

/**
 * Redis 连接事件监听
 */
redis.on("connect", () => {
	console.log("🔄 Redis 正在连接...")
})

redis.on("ready", () => {
	console.log("✅ Redis 连接成功")
})

redis.on("error", (error: Error) => {
	console.error("❌ Redis 连接错误:", error.message)
})

redis.on("close", () => {
	console.log("🔌 Redis 连接已关闭")
})

redis.on("reconnecting", () => {
	console.log("🔄 Redis 正在重新连接...")
})

/**
 * 初始化 Redis 连接
 */
export async function initializeRedis(): Promise<typeof redis> {
	try {
		// 测试连接
		await redis.ping()
		console.log("✅ Redis 连接测试成功")
		return redis
	} catch (error) {
		console.error("❌ Redis 连接测试失败:", error)
		throw error
	}
}

/**
 * 关闭 Redis 连接
 */
export async function closeRedis(): Promise<void> {
	try {
		await redis.quit()
		console.log("✅ Redis 连接已关闭")
	} catch (error) {
		console.error("❌ 关闭 Redis 连接失败:", error)
		throw error
	}
}

/**
 * 检查 Redis 连接状态
 */
export function isRedisConnected(): boolean {
	return redis.status === "ready"
}

/**
 * 创建 Redis 发布/订阅客户端
 */
export function createRedisPubSubClient(): typeof redis {
	return redis.duplicate()
}
