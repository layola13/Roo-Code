/**
 * RedisHotCache - L1 热缓存层
 *
 * 基于Redis实现的通用键值缓存
 * 提供快速的读写访问和自动过期管理
 *
 * 特性：
 * - 支持任意JSON可序列化的数据
 * - 自动TTL管理
 * - 统计信息追踪
 * - 连接失败降级处理
 */

// Redis类型将在运行时动态导入
type Redis = any

/**
 * Redis热缓存配置
 */
export interface RedisHotCacheConfig {
	/** Redis连接URL，默认 redis://localhost:6379 */
	redisUrl?: string
	/** 缓存过期时间（秒），默认3600秒（1小时） */
	ttl?: number
	/** 键前缀，用于命名空间隔离 */
	prefix?: string
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
	hits: number
	misses: number
	hitRate: number
}

/**
 * RedisHotCache - L1热缓存实现
 */
export class RedisHotCache {
	private redis: Redis | null = null
	private redisUrl: string
	private ttl: number
	private prefix: string
	private connected: boolean = false
	private stats = { hits: 0, misses: 0 }

	constructor(config: RedisHotCacheConfig) {
		this.redisUrl = config.redisUrl || "redis://localhost:6379"
		this.ttl = config.ttl ?? 3600
		this.prefix = config.prefix ?? ""
	}

	/**
	 * 连接到Redis
	 */
	async connect(): Promise<void> {
		if (this.connected && this.redis) {
			return
		}

		try {
			// @ts-ignore - 动态导入ioredis，在运行时解析
			const Redis = (await import("ioredis")).default
			this.redis = new Redis(this.redisUrl)
			await this.redis.ping()
			this.connected = true
		} catch (error) {
			this.redis = null
			this.connected = false
			throw error
		}
	}

	/**
	 * 断开连接
	 */
	async disconnect(): Promise<void> {
		if (this.redis && this.connected) {
			await this.redis.quit()
			this.redis = null
			this.connected = false
		}
	}

	/**
	 * 生成完整的缓存键
	 */
	private getFullKey(key: string): string {
		return this.prefix + key
	}

	/**
	 * 移除前缀获取原始键
	 */
	private stripPrefix(fullKey: string): string {
		return fullKey.startsWith(this.prefix) ? fullKey.slice(this.prefix.length) : fullKey
	}

	/**
	 * 设置缓存值
	 */
	async set<T>(key: string, value: T, ttl?: number): Promise<void> {
		if (!this.redis) {
			throw new Error("Redis not connected")
		}

		const fullKey = this.getFullKey(key)
		const serialized = JSON.stringify(value)
		const effectiveTtl = ttl ?? this.ttl

		if (effectiveTtl > 0) {
			await this.redis.set(fullKey, serialized, "EX", effectiveTtl)
		} else {
			await this.redis.set(fullKey, serialized)
		}
	}

	/**
	 * 获取缓存值
	 */
	async get<T>(key: string): Promise<T | null> {
		if (!this.redis) {
			throw new Error("Redis not connected")
		}

		const fullKey = this.getFullKey(key)
		const value = await this.redis.get(fullKey)

		if (value === null) {
			this.stats.misses++
			return null
		}

		this.stats.hits++
		try {
			return JSON.parse(value) as T
		} catch (error) {
			console.error("[RedisHotCache] JSON parse error:", error)
			return null
		}
	}

	/**
	 * 删除缓存值
	 */
	async delete(keys: string | string[]): Promise<void> {
		if (!this.redis) {
			throw new Error("Redis not connected")
		}

		const keyArray = Array.isArray(keys) ? keys : [keys]
		const fullKeys = keyArray.map((k) => this.getFullKey(k))

		if (fullKeys.length > 0) {
			await this.redis.del(...fullKeys)
		}
	}

	/**
	 * 批量设置缓存
	 */
	async mset(entries: Record<string, any>, ttl?: number): Promise<void> {
		if (!this.redis) {
			throw new Error("Redis not connected")
		}

		const pipeline = this.redis.pipeline()
		const effectiveTtl = ttl ?? this.ttl

		for (const [key, value] of Object.entries(entries)) {
			const fullKey = this.getFullKey(key)
			const serialized = JSON.stringify(value)

			if (effectiveTtl > 0) {
				pipeline.set(fullKey, serialized, "EX", effectiveTtl)
			} else {
				pipeline.set(fullKey, serialized)
			}
		}

		await pipeline.exec()
	}

	/**
	 * 批量获取缓存
	 */
	async mget(keys: string[]): Promise<Record<string, any>> {
		if (!this.redis) {
			throw new Error("Redis not connected")
		}

		const result: Record<string, any> = {}

		for (const key of keys) {
			const value = await this.get(key)
			if (value !== null) {
				result[key] = value
			}
		}

		return result
	}

	/**
	 * 按模式查找键
	 */
	async keys(pattern: string): Promise<string[]> {
		if (!this.redis) {
			throw new Error("Redis not connected")
		}

		const fullPattern = this.getFullKey(pattern)
		const fullKeys = await this.redis.keys(fullPattern)
		return fullKeys.map((k: string) => this.stripPrefix(k))
	}

	/**
	 * 按模式删除键
	 */
	async deleteByPattern(pattern: string): Promise<number> {
		if (!this.redis) {
			throw new Error("Redis not connected")
		}

		const fullPattern = this.getFullKey(pattern)
		const keys = await this.redis.keys(fullPattern)

		if (keys.length === 0) {
			return 0
		}

		await this.redis.del(...keys)
		return keys.length
	}

	/**
	 * 清空所有带前缀的键
	 */
	async clearAll(): Promise<void> {
		if (!this.redis) {
			throw new Error("Redis not connected")
		}

		const pattern = this.prefix + "*"
		const keys = await this.redis.keys(pattern)

		if (keys.length > 0) {
			await this.redis.del(...keys)
		}
	}

	/**
	 * 获取统计信息
	 */
	getStats(): CacheStats {
		const total = this.stats.hits + this.stats.misses
		const hitRate = total > 0 ? this.stats.hits / total : 0

		return {
			hits: this.stats.hits,
			misses: this.stats.misses,
			hitRate,
		}
	}

	/**
	 * 重置统计信息
	 */
	resetStats(): void {
		this.stats.hits = 0
		this.stats.misses = 0
	}
}
