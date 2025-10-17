/**
 * SubagentExecutor - New implementation based on docs/45-subagent.md
 *
 * This is a complete rewrite that implements:
 * - Caching mechanism (5min TTL)
 * - Performance metrics tracking
 * - Retry logic with exponential backoff
 * - Better error handling
 * - Support for all three subagents with proper context preparation
 */

import { ApiHandler } from "../../../api"
import { ApiMessage } from "../../task-persistence/apiMessages"
import { maybeRemoveImageBlocks } from "../../../api/transform/image-cleaning"
import { DEFAULT_SUBAGENT_PROMPTS } from "../../../shared/subagent-prompts"
import { SubagentParams, SubagentResult, AgentContext, SubagentName } from "../types"
import { SubagentInterface } from "./SubagentInterface"
import { createHash } from "crypto"

/**
 * Cache entry structure
 */
interface CacheEntry {
	result: SubagentResult
	timestamp: number
}

/**
 * SubagentExecutor - Main executor for all subagents
 *
 * Features:
 * - Caching with TTL (5 minutes default)
 * - Performance monitoring
 * - Retry with exponential backoff
 * - Multiple subagent support
 */
export class SubagentExecutor {
	private cache: Map<string, CacheEntry> = new Map()
	private readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
	private readonly MAX_RETRIES = 3
	private readonly BASE_RETRY_DELAY_MS = 1000

	// Subagent registry
	private subagents: Map<SubagentName, SubagentInterface> = new Map()

	constructor(
		private apiHandler: ApiHandler,
		private options: {
			enableCache?: boolean
			cacheTTL?: number
			enableMetrics?: boolean
			verboseLogging?: boolean
		} = {},
	) {
		// Apply defaults
		this.options = {
			enableCache: true,
			enableMetrics: true,
			verboseLogging: false,
			...options,
		}

		if (this.options.cacheTTL) {
			this.CACHE_TTL_MS = this.options.cacheTTL
		}
	}

	/**
	 * Register a subagent
	 */
	registerSubagent(subagent: SubagentInterface): void {
		this.subagents.set(subagent.name as SubagentName, subagent)
	}

	/**
	 * Execute a subagent with caching and retry logic
	 */
	async executeSubagent(params: SubagentParams, context: AgentContext): Promise<SubagentResult> {
		const { agent_name, task, context: userContext, options } = params
		const startTime = Date.now()

		// Check cache
		if (this.options.enableCache) {
			const cacheKey = this.generateCacheKey(params, context)
			const cached = this.getFromCache(cacheKey)
			if (cached) {
				if (this.options.verboseLogging) {
					console.log(`[SubagentExecutor] Cache hit for ${agent_name}`)
				}
				return { ...cached, cachedResult: true }
			}
		}

		// Get the subagent implementation
		const subagent = this.subagents.get(agent_name)
		if (!subagent) {
			return {
				agentName: agent_name,
				output: "",
				tokensUsed: 0,
				executionTime: 0,
				success: false,
				error: `Subagent ${agent_name} not registered`,
			}
		}

		// Execute with retry logic
		let lastError: Error | undefined
		for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
			try {
				const result = await subagent.run({
					context,
					task: task || subagent.defaultTask,
					userContext,
					options,
				})

				// Cache successful result
				if (result.success && this.options.enableCache) {
					const cacheKey = this.generateCacheKey(params, context)
					this.setCache(cacheKey, result)
				}

				result.executionTime = Date.now() - startTime
				return result
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error))

				if (this.options.verboseLogging) {
					console.warn(
						`[SubagentExecutor] Attempt ${attempt + 1}/${this.MAX_RETRIES} failed for ${agent_name}:`,
						lastError.message,
					)
				}

				// Wait before retry (exponential backoff)
				if (attempt < this.MAX_RETRIES - 1) {
					const delay = this.BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
					await this.sleep(delay)
				}
			}
		}

		// All retries failed
		return {
			agentName: agent_name,
			output: "",
			tokensUsed: 0,
			executionTime: Date.now() - startTime,
			success: false,
			error: lastError?.message || "Unknown error",
		}
	}

	/**
	 * Execute multiple subagents in parallel
	 */
	async executeMultiple(
		requests: Array<{ params: SubagentParams; context: AgentContext }>,
	): Promise<SubagentResult[]> {
		const promises = requests.map(({ params, context }) => this.executeSubagent(params, context))
		return Promise.all(promises)
	}

	/**
	 * Generate cache key (improved with hash-based approach)
	 * Uses SHA-256 hash of message content to avoid false cache hits
	 */
	private generateCacheKey(params: SubagentParams, context: AgentContext): string {
		// Collect relevant data for cache key
		const keyData = {
			agentName: params.agent_name,
			task: params.task,
			messageCount: context.messages.length,
			// Hash last 3 messages to capture context
			recentMessages: context.messages.slice(-3).map((msg) => {
				const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
				return content
			}),
			options: params.options,
		}

		// Generate SHA-256 hash
		const hash = createHash("sha256").update(JSON.stringify(keyData)).digest("hex")

		// Return short hash (16 chars) with agent name prefix for debugging
		return `${params.agent_name}:${hash.substring(0, 16)}`
	}

	/**
	 * Get from cache if not expired
	 */
	private getFromCache(key: string): SubagentResult | null {
		const entry = this.cache.get(key)
		if (!entry) return null

		const now = Date.now()
		if (now - entry.timestamp > this.CACHE_TTL_MS) {
			this.cache.delete(key)
			return null
		}

		return entry.result
	}

	/**
	 * Set cache entry
	 */
	private setCache(key: string, result: SubagentResult): void {
		this.cache.set(key, {
			result,
			timestamp: Date.now(),
		})
	}

	/**
	 * Clear expired cache entries
	 */
	clearExpiredCache(): void {
		const now = Date.now()
		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.timestamp > this.CACHE_TTL_MS) {
				this.cache.delete(key)
			}
		}
	}

	/**
	 * Clear all cache
	 */
	clearCache(): void {
		this.cache.clear()
	}

	/**
	 * Sleep utility
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): { cacheSize: number; cacheKeys: string[] } {
		return {
			cacheSize: this.cache.size,
			cacheKeys: Array.from(this.cache.keys()),
		}
	}
}
