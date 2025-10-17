/**
 * AutoCompressionTrigger - Automatic compression trigger mechanism
 * Based on docs/45-subagent.md (Lines 1126-1227)
 *
 * Features:
 * - Token count threshold detection
 * - Message count threshold detection
 * - Time-based triggers
 * - Compression task generation
 * - Strategy selection based on priority
 */

import { AgentContext, SubagentName, CompressionStrategy } from "../types"

export interface CompressionThresholds {
	messageCount: number // Trigger after N messages
	tokenCount: number // Trigger after N tokens
	timeSinceLastCompression: number // Trigger after N milliseconds
	contextUsagePercentage: number // Trigger at % of context window
}

export interface TriggerCheck {
	shouldTrigger: boolean
	reason: string
	priority: "low" | "medium" | "high"
	triggeredBy: "message_count" | "token_count" | "time_elapsed" | "context_usage"
}

export interface CompressionTask {
	id: string
	conversationId: string
	trigger: string
	priority: "low" | "medium" | "high"
	messageRange: [number, number]
	strategy: CompressionStrategyConfig
	createdAt: number
}

export interface CompressionStrategyConfig {
	steps: Array<{
		agent: SubagentName
		weight: number
		options?: Record<string, any>
	}>
}

/**
 * AutoCompressionTrigger - Detects when compression is needed
 */
export class AutoCompressionTrigger {
	private thresholds: CompressionThresholds
	private lastCompressionTime: number = Date.now()
	private lastCompressionMessageCount: number = 0

	constructor(options: Partial<CompressionThresholds> = {}) {
		this.thresholds = {
			messageCount: 20, // Every 20 messages
			tokenCount: 90000, // At 90k tokens (75% of 120k)
			timeSinceLastCompression: 3600000, // 1 hour
			contextUsagePercentage: 75, // 75% of context window
			...options,
		}
	}

	/**
	 * Check if compression should be triggered
	 */
	async checkAndTrigger(context: AgentContext): Promise<CompressionTask | null> {
		const checks = [
			this.checkMessageCount(context),
			this.checkTokenCount(context),
			this.checkTimeElapsed(context),
			this.checkContextUsage(context),
		]

		// Find the highest priority trigger
		const triggeredCheck = checks
			.filter((check) => check.shouldTrigger)
			.sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority))[0]

		if (triggeredCheck) {
			return this.createCompressionTask(triggeredCheck, context)
		}

		return null
	}

	/**
	 * Check message count threshold
	 */
	private checkMessageCount(context: AgentContext): TriggerCheck {
		const currentCount = context.messages.length
		const messagesSinceLastCompression = currentCount - this.lastCompressionMessageCount

		return {
			shouldTrigger: messagesSinceLastCompression >= this.thresholds.messageCount,
			reason: `Message count (${messagesSinceLastCompression} new messages) exceeded threshold (${this.thresholds.messageCount})`,
			priority: "medium",
			triggeredBy: "message_count",
		}
	}

	/**
	 * Check token count threshold
	 */
	private checkTokenCount(context: AgentContext): TriggerCheck {
		const tokens = this.estimateTokens(context)

		return {
			shouldTrigger: tokens >= this.thresholds.tokenCount,
			reason: `Token count (${tokens}) exceeded threshold (${this.thresholds.tokenCount})`,
			priority: "high",
			triggeredBy: "token_count",
		}
	}

	/**
	 * Check time elapsed since last compression
	 */
	private checkTimeElapsed(context: AgentContext): TriggerCheck {
		const elapsed = Date.now() - this.lastCompressionTime
		const hasEnoughMessages = context.messages.length > 10

		return {
			shouldTrigger: elapsed >= this.thresholds.timeSinceLastCompression && hasEnoughMessages,
			reason: `Time elapsed (${Math.round(elapsed / 60000)}min) since last compression`,
			priority: "low",
			triggeredBy: "time_elapsed",
		}
	}

	/**
	 * Check context window usage percentage
	 */
	private checkContextUsage(context: AgentContext): TriggerCheck {
		const tokens = this.estimateTokens(context)
		const maxContextTokens = 120000 // Typical context window
		const usagePercentage = (tokens / maxContextTokens) * 100

		return {
			shouldTrigger: usagePercentage >= this.thresholds.contextUsagePercentage,
			reason: `Context usage (${usagePercentage.toFixed(1)}%) exceeded threshold (${this.thresholds.contextUsagePercentage}%)`,
			priority: "high",
			triggeredBy: "context_usage",
		}
	}

	/**
	 * Create a compression task based on trigger
	 */
	private createCompressionTask(check: TriggerCheck, context: AgentContext): CompressionTask {
		const strategy = this.selectStrategy(check)
		const messageRange = this.determineMessageRange(context, check)

		return {
			id: this.generateTaskId(),
			conversationId: context.conversationMeta?.conversationId || "unknown",
			trigger: check.reason,
			priority: check.priority,
			messageRange,
			strategy,
			createdAt: Date.now(),
		}
	}

	/**
	 * Select compression strategy based on priority
	 */
	private selectStrategy(check: TriggerCheck): CompressionStrategyConfig {
		switch (check.priority) {
			case "high":
				// High priority: Full compression (all three agents)
				return {
					steps: [
						{ agent: "condense-context-analyzer", weight: 1 },
						{ agent: "condense-memory-extractor", weight: 1 },
						{ agent: "condense-code-summarizer", weight: 0.5 },
					],
				}

			case "medium":
				// Medium priority: Quick compression (memory extraction only)
				return {
					steps: [{ agent: "condense-memory-extractor", weight: 1 }],
				}

			case "low":
				// Low priority: Minimal compression (quick context analysis)
				return {
					steps: [
						{
							agent: "condense-context-analyzer",
							weight: 1,
							options: { depth: "quick" },
						},
					],
				}

			default:
				return {
					steps: [{ agent: "condense-context-analyzer", weight: 1 }],
				}
		}
	}

	/**
	 * Determine which message range to compress
	 */
	private determineMessageRange(context: AgentContext, check: TriggerCheck): [number, number] {
		const totalMessages = context.messages.length

		switch (check.triggeredBy) {
			case "token_count":
			case "context_usage":
				// Aggressive: compress all but recent 5 messages
				return [0, Math.max(0, totalMessages - 5)]

			case "message_count":
				// Moderate: compress all but recent 10 messages
				return [0, Math.max(0, totalMessages - 10)]

			case "time_elapsed":
				// Conservative: compress all but recent 15 messages
				return [0, Math.max(0, totalMessages - 15)]

			default:
				return [0, Math.max(0, totalMessages - 10)]
		}
	}

	/**
	 * Estimate token count (rough approximation)
	 */
	private estimateTokens(context: AgentContext): number {
		let total = 0
		for (const msg of context.messages) {
			const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
			// Rough estimate: 1 token ≈ 4 characters
			total += content.length / 4
		}
		return Math.floor(total)
	}

	/**
	 * Get numeric priority value
	 */
	private getPriorityValue(priority: string): number {
		const map: Record<string, number> = { high: 3, medium: 2, low: 1 }
		return map[priority] || 1
	}

	/**
	 * Generate unique task ID
	 */
	private generateTaskId(): string {
		return `compress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Update thresholds at runtime
	 */
	updateThresholds(updates: Partial<CompressionThresholds>): void {
		this.thresholds = { ...this.thresholds, ...updates }
	}

	/**
	 * Mark compression as completed
	 */
	markCompressionCompleted(messageCount: number): void {
		this.lastCompressionTime = Date.now()
		this.lastCompressionMessageCount = messageCount
	}

	/**
	 * Get current thresholds
	 */
	getThresholds(): CompressionThresholds {
		return { ...this.thresholds }
	}

	/**
	 * Get time since last compression
	 */
	getTimeSinceLastCompression(): number {
		return Date.now() - this.lastCompressionTime
	}

	/**
	 * Reset trigger state
	 */
	reset(): void {
		this.lastCompressionTime = Date.now()
		this.lastCompressionMessageCount = 0
	}
}
