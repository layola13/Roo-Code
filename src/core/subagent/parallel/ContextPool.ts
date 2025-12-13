/**
 * ContextPool - Manages a pool of reusable isolated contexts
 *
 * Provides efficient context allocation and reuse to minimize memory overhead
 * and initialization time for parallel subagent executions.
 */

import { IsolatedContext } from "./IsolatedContext"
import { ContextPoolConfig, ContextPoolStats } from "./types"

/**
 * ContextPool class
 * Manages lifecycle of isolated contexts with pooling and TTL
 */
export class ContextPool {
	private pool: Map<string, IsolatedContext> = new Map()
	private config: Required<ContextPoolConfig>
	private stats = {
		hits: 0,
		misses: 0,
		allocations: 0,
		releases: 0,
	}
	private cleanupInterval: NodeJS.Timeout | null = null

	constructor(config: Partial<ContextPoolConfig> = {}) {
		this.config = {
			maxPoolSize: config.maxPoolSize ?? 20, // Pool more than slots for rotation
			contextTokenLimit: config.contextTokenLimit ?? 200_000, // 200K tokens
			contextTTL: config.contextTTL ?? 30 * 60 * 1000, // 30 minutes
		}

		// Start periodic cleanup
		this.startCleanup()
	}

	/**
	 * Acquire a context from the pool
	 * Returns an available context or creates a new one
	 */
	acquire(): IsolatedContext {
		// Try to find an available context
		for (const [id, context] of this.pool.entries()) {
			if (!context.isInUse() && !context.isExpired(this.config.contextTTL)) {
				context.acquire()
				this.stats.hits++
				return context
			}
		}

		// No available context, create new one
		this.stats.misses++
		return this.createContext()
	}

	/**
	 * Release a context back to the pool
	 */
	release(context: IsolatedContext): void {
		context.release()
		this.stats.releases++

		// If pool is at capacity, remove oldest expired context
		if (this.pool.size >= this.config.maxPoolSize) {
			this.removeExpiredContexts()
		}

		// Add to pool if not already there
		const contextId = context.getState().id
		if (!this.pool.has(contextId)) {
			this.pool.set(contextId, context)
		}
	}

	/**
	 * Create a new context
	 */
	private createContext(): IsolatedContext {
		const id = `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		const context = new IsolatedContext(id, this.config.contextTokenLimit)

		this.stats.allocations++

		// Add to pool if there's space
		if (this.pool.size < this.config.maxPoolSize) {
			this.pool.set(id, context)
		}

		context.acquire()
		return context
	}

	/**
	 * Remove expired contexts from pool
	 */
	private removeExpiredContexts(): void {
		const toRemove: string[] = []

		for (const [id, context] of this.pool.entries()) {
			if (!context.isInUse() && context.isExpired(this.config.contextTTL)) {
				toRemove.push(id)
			}
		}

		for (const id of toRemove) {
			const context = this.pool.get(id)
			if (context) {
				context.reset()
				this.pool.delete(id)
			}
		}
	}

	/**
	 * Start periodic cleanup of expired contexts
	 */
	private startCleanup(): void {
		// Run cleanup every 5 minutes
		this.cleanupInterval = setInterval(
			() => {
				this.removeExpiredContexts()
			},
			5 * 60 * 1000,
		)
	}

	/**
	 * Stop periodic cleanup
	 */
	private stopCleanup(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
			this.cleanupInterval = null
		}
	}

	/**
	 * Get pool statistics
	 */
	getStats(): ContextPoolStats {
		let inUseCount = 0
		for (const context of this.pool.values()) {
			if (context.isInUse()) {
				inUseCount++
			}
		}

		const totalRequests = this.stats.hits + this.stats.misses
		const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0

		return {
			totalContexts: this.pool.size,
			inUseContexts: inUseCount,
			availableContexts: this.pool.size - inUseCount,
			hits: this.stats.hits,
			misses: this.stats.misses,
			hitRate,
		}
	}

	/**
	 * Get all contexts in pool
	 */
	getAllContexts(): IsolatedContext[] {
		return Array.from(this.pool.values())
	}

	/**
	 * Get context by ID
	 */
	getContext(id: string): IsolatedContext | undefined {
		return this.pool.get(id)
	}

	/**
	 * Clear all contexts from pool
	 */
	clear(): void {
		for (const context of this.pool.values()) {
			context.reset()
		}
		this.pool.clear()
		this.stats = {
			hits: 0,
			misses: 0,
			allocations: 0,
			releases: 0,
		}
	}

	/**
	 * Dispose of the pool and cleanup resources
	 */
	dispose(): void {
		this.stopCleanup()
		this.clear()
	}

	/**
	 * Get pool configuration
	 */
	getConfig(): Required<ContextPoolConfig> {
		return { ...this.config }
	}

	/**
	 * Update pool configuration
	 */
	updateConfig(config: Partial<ContextPoolConfig>): void {
		this.config = {
			...this.config,
			...config,
		}

		// If max pool size decreased, remove excess contexts
		if (config.maxPoolSize !== undefined && this.pool.size > config.maxPoolSize) {
			this.trimPool(config.maxPoolSize)
		}
	}

	/**
	 * Trim pool to specified size
	 * Removes least recently used contexts
	 */
	private trimPool(targetSize: number): void {
		if (this.pool.size <= targetSize) {
			return
		}

		// Sort contexts by last used time (oldest first)
		const contexts = Array.from(this.pool.entries())
			.filter(([_, ctx]) => !ctx.isInUse()) // Only consider unused contexts
			.sort((a, b) => {
				const aTime = a[1].getState().lastUsed
				const bTime = b[1].getState().lastUsed
				return aTime - bTime
			})

		// Remove oldest contexts until we reach target size
		const toRemove = this.pool.size - targetSize
		for (let i = 0; i < toRemove && i < contexts.length; i++) {
			const [id, context] = contexts[i]
			context.reset()
			this.pool.delete(id)
		}
	}

	/**
	 * Get pool health status
	 */
	getHealth(): {
		healthy: boolean
		issues: string[]
		recommendations: string[]
	} {
		const stats = this.getStats()
		const issues: string[] = []
		const recommendations: string[] = []

		// Check hit rate
		if (stats.hitRate < 0.5 && stats.hits + stats.misses > 10) {
			issues.push("Low context reuse rate")
			recommendations.push("Consider increasing pool size")
		}

		// Check pool utilization
		const utilization = stats.inUseContexts / stats.totalContexts
		if (utilization > 0.9) {
			issues.push("High pool utilization")
			recommendations.push("Pool may be under-sized for current workload")
		}

		// Check for stale contexts
		let expiredCount = 0
		for (const context of this.pool.values()) {
			if (!context.isInUse() && context.isExpired(this.config.contextTTL)) {
				expiredCount++
			}
		}

		if (expiredCount > this.config.maxPoolSize * 0.3) {
			issues.push(`${expiredCount} expired contexts in pool`)
			recommendations.push("Run cleanup to remove expired contexts")
		}

		return {
			healthy: issues.length === 0,
			issues,
			recommendations,
		}
	}

	/**
	 * Force cleanup of expired contexts
	 */
	forceCleanup(): number {
		const beforeSize = this.pool.size
		this.removeExpiredContexts()
		return beforeSize - this.pool.size
	}

	/**
	 * Get debug information
	 */
	getDebugInfo(): string {
		const stats = this.getStats()
		const health = this.getHealth()

		const info = [
			"ContextPool Status:",
			`  Total Contexts: ${stats.totalContexts}`,
			`  In Use: ${stats.inUseContexts}`,
			`  Available: ${stats.availableContexts}`,
			`  Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`,
			`  Hits: ${stats.hits}`,
			`  Misses: ${stats.misses}`,
			`  Health: ${health.healthy ? "✓ Healthy" : "⚠ Issues detected"}`,
		]

		if (health.issues.length > 0) {
			info.push("  Issues:")
			health.issues.forEach((issue) => info.push(`    - ${issue}`))
		}

		if (health.recommendations.length > 0) {
			info.push("  Recommendations:")
			health.recommendations.forEach((rec) => info.push(`    - ${rec}`))
		}

		return info.join("\n")
	}
}
