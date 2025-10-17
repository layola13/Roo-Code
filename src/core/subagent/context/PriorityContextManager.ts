/**
 * PriorityContextManager - Advanced priority-based context management
 * Based on docs/45-subagent.md (Lines 503-614)
 *
 * Features:
 * - Multi-dimensional scoring algorithm
 * - Time-decay for older messages
 * - Keyword importance weighting
 * - User message prioritization
 * - Intelligent context window management
 */

import { ApiMessage } from "../../task-persistence/apiMessages"

interface ScoredMessage {
	message: ApiMessage
	score: number
	index: number
	timestamp: number
}

interface PriorityConfig {
	/** Weight for recency (0-1) */
	recencyWeight: number
	/** Weight for keyword importance (0-1) */
	keywordWeight: number
	/** Weight for message length (0-1) */
	lengthWeight: number
	/** Weight for code presence (0-1) */
	codeWeight: number
	/** Weight for user messages (0-1) */
	userWeight: number
	/** Time decay factor (hours) */
	timeDecayHours: number
	/** Critical keywords */
	criticalKeywords: string[]
	/** Important keywords */
	importantKeywords: string[]
}

const DEFAULT_CONFIG: PriorityConfig = {
	recencyWeight: 0.3,
	keywordWeight: 0.25,
	lengthWeight: 0.15,
	codeWeight: 0.15,
	userWeight: 0.15,
	timeDecayHours: 24,
	criticalKeywords: [
		"决定",
		"要求",
		"必须",
		"不能",
		"禁止",
		"关键",
		"重要",
		"decision",
		"requirement",
		"must",
		"critical",
		"important",
		"breaking",
		"error",
		"bug",
		"security",
		"deprecated",
	],
	importantKeywords: [
		"设计",
		"架构",
		"实现",
		"优化",
		"性能",
		"测试",
		"design",
		"architecture",
		"implement",
		"optimize",
		"performance",
		"test",
	],
}

/**
 * PriorityContextManager - Manages context with priority-based retention
 */
export class PriorityContextManager {
	private config: PriorityConfig

	constructor(config?: Partial<PriorityConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config }
	}

	/**
	 * Select most important messages within token budget
	 */
	async selectPriorityMessages(
		messages: ApiMessage[],
		maxTokens: number,
		options: {
			preserveRecent?: number
			preserveCritical?: boolean
		} = {},
	): Promise<ApiMessage[]> {
		const { preserveRecent = 5, preserveCritical = true } = options

		// Score all messages
		const scoredMessages = this.scoreMessages(messages)

		// Always preserve recent messages
		const recentMessages = scoredMessages.slice(-preserveRecent)
		const remainingMessages = scoredMessages.slice(0, -preserveRecent)

		// Extract critical messages if enabled
		let criticalMessages: ScoredMessage[] = []
		let nonCriticalMessages = remainingMessages

		if (preserveCritical) {
			const result = this.separateCriticalMessages(remainingMessages)
			criticalMessages = result.critical
			nonCriticalMessages = result.nonCritical
		}

		// Sort non-critical by score (descending)
		nonCriticalMessages.sort((a, b) => b.score - a.score)

		// Build result set within token budget
		const selected: ScoredMessage[] = []
		let currentTokens = 0

		// Add recent messages (highest priority)
		for (const msg of recentMessages) {
			const tokens = this.estimateTokens(msg.message)
			if (currentTokens + tokens <= maxTokens) {
				selected.push(msg)
				currentTokens += tokens
			}
		}

		// Add critical messages
		for (const msg of criticalMessages) {
			const tokens = this.estimateTokens(msg.message)
			if (currentTokens + tokens <= maxTokens) {
				selected.push(msg)
				currentTokens += tokens
			} else {
				break
			}
		}

		// Fill remaining budget with highest-scoring messages
		for (const msg of nonCriticalMessages) {
			const tokens = this.estimateTokens(msg.message)
			if (currentTokens + tokens <= maxTokens) {
				selected.push(msg)
				currentTokens += tokens
			} else {
				break
			}
		}

		// Sort by original index to maintain conversation order
		selected.sort((a, b) => a.index - b.index)

		return selected.map((s) => s.message)
	}

	/**
	 * Score all messages based on multiple criteria
	 */
	private scoreMessages(messages: ApiMessage[]): ScoredMessage[] {
		const now = Date.now()
		const scored: ScoredMessage[] = []

		for (let i = 0; i < messages.length; i++) {
			const message = messages[i]
			const content = this.getMessageContent(message)

			// Calculate individual scores
			const recencyScore = this.calculateRecencyScore(i, messages.length)
			const keywordScore = this.calculateKeywordScore(content)
			const lengthScore = this.calculateLengthScore(content)
			const codeScore = this.calculateCodeScore(content)
			const userScore = message.role === "user" ? 1.0 : 0.0

			// Time decay (if timestamp available)
			let timeDecay = 1.0
			if (message.ts) {
				const ageHours = (now - message.ts) / (1000 * 60 * 60)
				timeDecay = Math.exp(-ageHours / this.config.timeDecayHours)
			}

			// Weighted composite score
			const score =
				timeDecay *
				(this.config.recencyWeight * recencyScore +
					this.config.keywordWeight * keywordScore +
					this.config.lengthWeight * lengthScore +
					this.config.codeWeight * codeScore +
					this.config.userWeight * userScore)

			scored.push({
				message,
				score,
				index: i,
				timestamp: message.ts || now,
			})
		}

		return scored
	}

	/**
	 * Calculate recency score (recent messages score higher)
	 */
	private calculateRecencyScore(index: number, total: number): number {
		// Linear scale: 0.0 for oldest, 1.0 for newest
		return index / Math.max(total - 1, 1)
	}

	/**
	 * Calculate keyword importance score
	 */
	private calculateKeywordScore(content: string): number {
		const lowerContent = content.toLowerCase()
		let score = 0

		// Critical keywords: +0.5 each
		for (const keyword of this.config.criticalKeywords) {
			if (lowerContent.includes(keyword.toLowerCase())) {
				score += 0.5
			}
		}

		// Important keywords: +0.2 each
		for (const keyword of this.config.importantKeywords) {
			if (lowerContent.includes(keyword.toLowerCase())) {
				score += 0.2
			}
		}

		// Cap at 1.0
		return Math.min(score, 1.0)
	}

	/**
	 * Calculate length score (substantial messages score higher)
	 */
	private calculateLengthScore(content: string): number {
		const length = content.length

		// Score based on length thresholds
		if (length < 50) return 0.2
		if (length < 100) return 0.4
		if (length < 200) return 0.6
		if (length < 500) return 0.8
		return 1.0
	}

	/**
	 * Calculate code presence score
	 */
	private calculateCodeScore(content: string): number {
		// Check for code blocks
		const hasCodeBlock = content.includes("```")
		const hasInlineCode = content.includes("`")
		const hasCodeKeywords = /function|class|const|let|var|import|export|async|await/.test(content)

		let score = 0
		if (hasCodeBlock) score += 0.6
		if (hasInlineCode) score += 0.2
		if (hasCodeKeywords) score += 0.2

		return Math.min(score, 1.0)
	}

	/**
	 * Separate critical messages from non-critical
	 */
	private separateCriticalMessages(messages: ScoredMessage[]): {
		critical: ScoredMessage[]
		nonCritical: ScoredMessage[]
	} {
		const critical: ScoredMessage[] = []
		const nonCritical: ScoredMessage[] = []

		for (const msg of messages) {
			const content = this.getMessageContent(msg.message)
			const lowerContent = content.toLowerCase()

			// Check for critical keywords
			const isCritical = this.config.criticalKeywords.some((kw) => lowerContent.includes(kw.toLowerCase()))

			// Check for high score
			const isHighScore = msg.score > 0.7

			if (isCritical || isHighScore) {
				critical.push(msg)
			} else {
				nonCritical.push(msg)
			}
		}

		return { critical, nonCritical }
	}

	/**
	 * Estimate tokens for a message
	 */
	private estimateTokens(message: ApiMessage): number {
		const content = this.getMessageContent(message)

		// Improved estimation
		const hasChineseChar = /[\u4e00-\u9fa5]/.test(content)
		const ratio = hasChineseChar ? 2 : 3.5

		return Math.ceil(content.length / ratio)
	}

	/**
	 * Get message content as string
	 */
	private getMessageContent(message: ApiMessage): string {
		if (typeof message.content === "string") {
			return message.content
		}
		return message.content?.map((block) => (block.type === "text" ? block.text : "")).join("\n") || ""
	}

	/**
	 * Update configuration
	 */
	updateConfig(config: Partial<PriorityConfig>): void {
		this.config = { ...this.config, ...config }
	}

	/**
	 * Get current configuration
	 */
	getConfig(): PriorityConfig {
		return { ...this.config }
	}

	/**
	 * Analyze message distribution by score
	 */
	analyzeMessageDistribution(messages: ApiMessage[]): {
		totalMessages: number
		avgScore: number
		highPriorityCount: number
		mediumPriorityCount: number
		lowPriorityCount: number
		criticalKeywordCount: number
	} {
		const scored = this.scoreMessages(messages)

		let totalScore = 0
		let highCount = 0
		let mediumCount = 0
		let lowCount = 0
		let criticalCount = 0

		for (const msg of scored) {
			totalScore += msg.score

			if (msg.score >= 0.7) {
				highCount++
			} else if (msg.score >= 0.4) {
				mediumCount++
			} else {
				lowCount++
			}

			// Check for critical keywords
			const content = this.getMessageContent(msg.message)
			const lowerContent = content.toLowerCase()
			if (this.config.criticalKeywords.some((kw) => lowerContent.includes(kw.toLowerCase()))) {
				criticalCount++
			}
		}

		return {
			totalMessages: messages.length,
			avgScore: totalScore / messages.length,
			highPriorityCount: highCount,
			mediumPriorityCount: mediumCount,
			lowPriorityCount: lowCount,
			criticalKeywordCount: criticalCount,
		}
	}
}
