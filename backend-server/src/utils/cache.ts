import { redis } from "../config/redis.js"
import { logger } from "./logger.js"

/**
 * 缓存工具类
 */
export class Cache {
	/**
	 * 获取缓存值
	 */
	async get<T = any>(key: string): Promise<T | null> {
		try {
			const value = await redis.get(key)
			if (value === null) {
				return null
			}
			return JSON.parse(value) as T
		} catch (error) {
			logger.error("Cache get error", { key, error })
			return null
		}
	}

	/**
	 * 设置缓存值
	 */
	async set(key: string, value: any, ttl?: number): Promise<boolean> {
		try {
			const serialized = JSON.stringify(value)
			if (ttl) {
				await redis.setex(key, ttl, serialized)
			} else {
				await redis.set(key, serialized)
			}
			return true
		} catch (error) {
			logger.error("Cache set error", { key, error })
			return false
		}
	}

	/**
	 * 删除缓存
	 */
	async del(key: string): Promise<boolean> {
		try {
			await redis.del(key)
			return true
		} catch (error) {
			logger.error("Cache del error", { key, error })
			return false
		}
	}

	/**
	 * 批量删除缓存（支持模式匹配）
	 */
	async delPattern(pattern: string): Promise<number> {
		try {
			const keys = await redis.keys(pattern)
			if (keys.length === 0) {
				return 0
			}
			return await redis.del(...keys)
		} catch (error) {
			logger.error("Cache delPattern error", { pattern, error })
			return 0
		}
	}

	/**
	 * 检查键是否存在
	 */
	async exists(key: string): Promise<boolean> {
		try {
			const result = await redis.exists(key)
			return result === 1
		} catch (error) {
			logger.error("Cache exists error", { key, error })
			return false
		}
	}

	/**
	 * 设置键的过期时间（秒）
	 */
	async expire(key: string, ttl: number): Promise<boolean> {
		try {
			const result = await redis.expire(key, ttl)
			return result === 1
		} catch (error) {
			logger.error("Cache expire error", { key, ttl, error })
			return false
		}
	}

	/**
	 * 获取键的剩余生存时间（秒）
	 */
	async ttl(key: string): Promise<number> {
		try {
			return await redis.ttl(key)
		} catch (error) {
			logger.error("Cache ttl error", { key, error })
			return -1
		}
	}

	/**
	 * 原子递增
	 */
	async incr(key: string): Promise<number> {
		try {
			return await redis.incr(key)
		} catch (error) {
			logger.error("Cache incr error", { key, error })
			return 0
		}
	}

	/**
	 * 原子递减
	 */
	async decr(key: string): Promise<number> {
		try {
			return await redis.decr(key)
		} catch (error) {
			logger.error("Cache decr error", { key, error })
			return 0
		}
	}

	/**
	 * 添加到集合
	 */
	async sadd(key: string, ...members: string[]): Promise<number> {
		try {
			return await redis.sadd(key, ...members)
		} catch (error) {
			logger.error("Cache sadd error", { key, members, error })
			return 0
		}
	}

	/**
	 * 从集合中移除
	 */
	async srem(key: string, ...members: string[]): Promise<number> {
		try {
			return await redis.srem(key, ...members)
		} catch (error) {
			logger.error("Cache srem error", { key, members, error })
			return 0
		}
	}

	/**
	 * 获取集合成员
	 */
	async smembers(key: string): Promise<string[]> {
		try {
			return await redis.smembers(key)
		} catch (error) {
			logger.error("Cache smembers error", { key, error })
			return []
		}
	}

	/**
	 * 检查是否为集合成员
	 */
	async sismember(key: string, member: string): Promise<boolean> {
		try {
			const result = await redis.sismember(key, member)
			return result === 1
		} catch (error) {
			logger.error("Cache sismember error", { key, member, error })
			return false
		}
	}

	/**
	 * 获取集合大小
	 */
	async scard(key: string): Promise<number> {
		try {
			return await redis.scard(key)
		} catch (error) {
			logger.error("Cache scard error", { key, error })
			return 0
		}
	}

	/**
	 * 添加到哈希表
	 */
	async hset(key: string, field: string, value: any): Promise<boolean> {
		try {
			const serialized = JSON.stringify(value)
			await redis.hset(key, field, serialized)
			return true
		} catch (error) {
			logger.error("Cache hset error", { key, field, error })
			return false
		}
	}

	/**
	 * 从哈希表获取
	 */
	async hget<T = any>(key: string, field: string): Promise<T | null> {
		try {
			const value = await redis.hget(key, field)
			if (value === null) {
				return null
			}
			return JSON.parse(value) as T
		} catch (error) {
			logger.error("Cache hget error", { key, field, error })
			return null
		}
	}

	/**
	 * 从哈希表删除
	 */
	async hdel(key: string, ...fields: string[]): Promise<number> {
		try {
			return await redis.hdel(key, ...fields)
		} catch (error) {
			logger.error("Cache hdel error", { key, fields, error })
			return 0
		}
	}

	/**
	 * 获取哈希表所有字段
	 */
	async hgetall<T = any>(key: string): Promise<Record<string, T>> {
		try {
			const data = await redis.hgetall(key)
			const result: Record<string, T> = {}
			for (const [field, value] of Object.entries(data)) {
				if (typeof value === "string") {
					result[field] = JSON.parse(value) as T
				}
			}
			return result
		} catch (error) {
			logger.error("Cache hgetall error", { key, error })
			return {}
		}
	}

	/**
	 * Pipeline 批量操作
	 */
	pipeline() {
		return redis.pipeline()
	}

	/**
	 * 清空当前数据库
	 */
	async flushdb(): Promise<boolean> {
		try {
			await redis.flushdb()
			return true
		} catch (error) {
			logger.error("Cache flushdb error", { error })
			return false
		}
	}
}

/**
 * 导出缓存实例
 */
export const cache = new Cache()

/**
 * 缓存键生成器
 */
export const CacheKeys = {
	// 会话缓存
	session: (token: string) => `session:${token}`,

	// 刷新令牌
	refreshToken: (token: string) => `refresh:${token}`,

	// 用户设置
	userSettings: (userId: string) => `user:settings:${userId}`,

	// 组织设置
	orgSettings: (orgId: string) => `org:settings:${orgId}`,

	// 任务缓存
	task: (taskId: string) => `task:${taskId}`,

	// 在线用户
	online: (userId: string) => `online:${userId}`,

	// Socket 连接映射
	socketUser: (userId: string) => `socket:user:${userId}`,

	// 扩展实例
	instance: (instanceId: string) => `instance:${instanceId}`,

	// 统计缓存
	stats: (type: string, date: string) => `stats:${type}:${date}`,

	// SSE 连接
	sseTask: (taskId: string) => `sse:task:${taskId}`,
}
