/**
 * ContextManager - Manages context compression strategies
 * Based on docs/45-subagent.md (Lines 323-596)
 *
 * Implements three compression strategies:
 * 1. Rolling Window + Summary
 * 2. Semantic Clustering
 * 3. Priority Queue Management
 */

import { ApiMessage } from "../../task-persistence/apiMessages"
import { ApiHandler } from "../../../api"
import { CompressionStrategy, ManagedContext, Summary, MessageCluster, CompressedContext, Priority } from "../types"
import { SubagentExecutor } from "../executor/SubagentExecutor"
import { SubagentFactory } from "../agents"
import { TokenEstimator } from "../utils/TokenEstimator"

interface MessageWithScore {
	message: ApiMessage
	score: number
	priority: Priority
}

/**
 * ContextManager - Main context compression manager
 */
export class ContextManager {
	private summaries: Summary[] = []
	private tokenEstimator: TokenEstimator

	constructor(
		private apiHandler: ApiHandler,
		private subagentExecutor?: SubagentExecutor,
	) {
		this.tokenEstimator = new TokenEstimator()
	}

	/**
	 * Compress context using the specified strategy
	 */
	async compressContext(
		messages: ApiMessage[],
		strategy: CompressionStrategy = "hybrid",
		options: {
			windowSize?: number
			targetTokens?: number
			minImportanceScore?: number
		} = {},
	): Promise<ManagedContext> {
		switch (strategy) {
			case "rolling-window":
				return this.rollingWindowCompression(messages, options)
			case "semantic-clustering":
				return this.semanticClusteringCompression(messages, options)
			case "priority-queue":
				return this.priorityQueueCompression(messages, options)
			case "hybrid":
				return this.hybridCompression(messages, options)
			default:
				throw new Error(`Unknown compression strategy: ${strategy}`)
		}
	}

	/**
	 * Strategy 1: Rolling Window + Summary
	 * Keep recent N messages, summarize older ones
	 */
	private async rollingWindowCompression(
		messages: ApiMessage[],
		options: { windowSize?: number; targetTokens?: number },
	): Promise<ManagedContext> {
		const windowSize = options.windowSize || 10
		const targetTokens = options.targetTokens || 4000

		// Split into recent and old messages
		const recentMessages = messages.slice(-windowSize)
		const oldMessages = messages.slice(0, -windowSize)

		// Count tokens in recent messages (using local estimator)
		const recentTokens = this.tokenEstimator.estimateMessages(recentMessages)

		// If we need to summarize
		if (oldMessages.length > 0) {
			const summary = await this.generateSummary(oldMessages)
			this.summaries.push(summary)

			const summaryTokens = this.tokenEstimator.estimateText(summary.content)

			return {
				fullMessages: recentMessages,
				summaries: [summary],
				totalOriginalTokens: recentTokens + summaryTokens,
				compressedTokens: recentTokens + summaryTokens,
			}
		}

		return {
			fullMessages: recentMessages,
			summaries: [],
			totalOriginalTokens: recentTokens,
			compressedTokens: recentTokens,
		}
	}

	/**
	 * Strategy 2: Semantic Clustering
	 * Group similar messages and summarize each cluster
	 */
	private async semanticClusteringCompression(
		messages: ApiMessage[],
		options: { targetTokens?: number },
	): Promise<ManagedContext> {
		const targetTokens = options.targetTokens || 4000

		// For now, implement a simple topic-based clustering
		// In production, this would use embeddings
		const clusters = this.clusterMessagesByTopic(messages)

		const summaries: Summary[] = []
		const criticalMessages: ApiMessage[] = []

		for (const cluster of clusters) {
			if (cluster.length > 3) {
				// Summarize large clusters
				const summary = await this.generateSummary(cluster)
				summaries.push(summary)
			} else {
				// Keep small clusters as-is
				criticalMessages.push(...cluster)
			}
		}

		// Calculate tokens (using local estimator)
		let totalTokens = 0
		for (const summary of summaries) {
			totalTokens += this.tokenEstimator.estimateText(summary.content)
		}
		totalTokens += this.tokenEstimator.estimateMessages(criticalMessages)

		return {
			fullMessages: criticalMessages,
			summaries,
			totalOriginalTokens: totalTokens,
			compressedTokens: totalTokens,
		}
	}

	/**
	 * Strategy 3: Priority Queue Management
	 * Score messages by importance, keep high-priority ones
	 */
	private async priorityQueueCompression(
		messages: ApiMessage[],
		options: { minImportanceScore?: number; targetTokens?: number },
	): Promise<ManagedContext> {
		const minScore = options.minImportanceScore || 0.5
		const targetTokens = options.targetTokens || 4000

		// Score all messages
		const scoredMessages = await this.scoreMessages(messages)

		// Sort by priority and score
		scoredMessages.sort((a, b) => {
			if (a.priority !== b.priority) {
				const priorityOrder = { high: 3, medium: 2, low: 1 }
				return priorityOrder[b.priority] - priorityOrder[a.priority]
			}
			return b.score - a.score
		})

		// Select messages that fit in target tokens
		const selected: ApiMessage[] = []
		const toSummarize: ApiMessage[] = []
		let currentTokens = 0

		for (const scored of scoredMessages) {
			const tokens = this.tokenEstimator.estimateMessage(scored.message)

			if (scored.score >= minScore && currentTokens + tokens <= targetTokens) {
				selected.push(scored.message)
				currentTokens += tokens
			} else {
				toSummarize.push(scored.message)
			}
		}

		// Summarize low-priority messages
		const summaries: Summary[] = []
		if (toSummarize.length > 0) {
			const summary = await this.generateSummary(toSummarize)
			summaries.push(summary)

			const summaryTokens = this.tokenEstimator.estimateText(summary.content)
			currentTokens += summaryTokens
		}

		return {
			fullMessages: selected,
			summaries,
			totalOriginalTokens: currentTokens,
			compressedTokens: currentTokens,
		}
	}

	/**
	 * Strategy 4: Hybrid Approach
	 * Combine multiple strategies for best results
	 */
	private async hybridCompression(
		messages: ApiMessage[],
		options: { windowSize?: number; targetTokens?: number },
	): Promise<ManagedContext> {
		const windowSize = options.windowSize || 10
		const targetTokens = options.targetTokens || 4000

		// Step 1: Keep recent messages (rolling window)
		const recentMessages = messages.slice(-windowSize)
		const olderMessages = messages.slice(0, -windowSize)

		// Step 2: Score older messages (priority queue)
		if (olderMessages.length > 0) {
			const scoredOlder = await this.scoreMessages(olderMessages)

			// Keep high-priority older messages
			const highPriorityOlder = scoredOlder
				.filter((s) => s.priority === "high" || s.score > 0.8)
				.map((s) => s.message)

			// Summarize the rest
			const toSummarize = scoredOlder.filter((s) => s.priority !== "high" && s.score <= 0.8).map((s) => s.message)

			const summaries: Summary[] = []
			if (toSummarize.length > 0) {
				const summary = await this.generateSummary(toSummarize)
				summaries.push(summary)
			}

			// Calculate final tokens (using local estimator)
			const finalMessages = [...highPriorityOlder, ...recentMessages]
			let totalTokens = this.tokenEstimator.estimateMessages(finalMessages)

			for (const summary of summaries) {
				totalTokens += this.tokenEstimator.estimateText(summary.content)
			}

			return {
				fullMessages: finalMessages,
				summaries,
				totalOriginalTokens: totalTokens,
				compressedTokens: totalTokens,
			}
		}

		// No compression needed
		const totalTokens = this.tokenEstimator.estimateMessages(recentMessages)

		return {
			fullMessages: recentMessages,
			summaries: [],
			totalOriginalTokens: totalTokens,
			compressedTokens: totalTokens,
		}
	}

	/**
	 * Generate a summary for a set of messages using subagent
	 */
	private async generateSummary(messages: ApiMessage[]): Promise<Summary> {
		if (!this.subagentExecutor) {
			// Fallback: simple concatenation
			return {
				messageRange: [0, messages.length - 1],
				content: "Summary not available (subagent not configured)",
				timestamp: new Date(),
			}
		}

		try {
			// Use context analyzer to generate summary
			const result = await this.subagentExecutor.executeSubagent(
				{
					agent_name: "condense-context-analyzer",
					task: "Provide a concise summary of these messages",
				},
				{ messages },
			)

			const output = typeof result.output === "string" ? result.output : JSON.stringify(result.output, null, 2)

			return {
				messageRange: [0, messages.length - 1],
				content: output || "Summary generation failed",
				timestamp: new Date(),
			}
		} catch (error) {
			return {
				messageRange: [0, messages.length - 1],
				content: `Summary error: ${error}`,
				timestamp: new Date(),
			}
		}
	}

	/**
	 * Score messages by importance
	 */
	private async scoreMessages(messages: ApiMessage[]): Promise<MessageWithScore[]> {
		const scored: MessageWithScore[] = []

		for (const message of messages) {
			const content = this.getMessageContent(message)
			const score = this.calculateImportanceScore(content, message)
			const priority = this.determinePriority(score, message)

			scored.push({ message, score, priority })
		}

		return scored
	}

	/**
	 * Calculate importance score for a message
	 */
	private calculateImportanceScore(content: string, message: ApiMessage): number {
		let score = 0.5 // Base score

		// Boost score for certain keywords
		const importantKeywords = [
			"error",
			"critical",
			"important",
			"必须",
			"错误",
			"关键",
			"requirement",
			"decision",
			"bug",
			"fix",
			"breaking",
		]

		for (const keyword of importantKeywords) {
			if (content.toLowerCase().includes(keyword)) {
				score += 0.1
			}
		}

		// Boost for user messages
		if (message.role === "user") {
			score += 0.2
		}

		// Boost for recent messages
		if (message.ts && Date.now() - message.ts < 5 * 60 * 1000) {
			score += 0.1
		}

		// Cap at 1.0
		return Math.min(score, 1.0)
	}

	/**
	 * Determine priority based on score and message properties
	 */
	private determinePriority(score: number, message: ApiMessage): Priority {
		if (score >= 0.8) return "high"
		if (score >= 0.5) return "medium"
		return "low"
	}

	/**
	 * Cluster messages by topic (simple implementation)
	 */
	private clusterMessagesByTopic(messages: ApiMessage[]): ApiMessage[][] {
		// Simple topic detection based on keywords
		const clusters: ApiMessage[][] = []
		const topics = new Map<string, ApiMessage[]>()

		for (const message of messages) {
			const content = this.getMessageContent(message)
			const topic = this.detectTopic(content)

			if (!topics.has(topic)) {
				topics.set(topic, [])
			}
			topics.get(topic)!.push(message)
		}

		return Array.from(topics.values())
	}

	/**
	 * Detect topic from message content
	 */
	private detectTopic(content: string): string {
		const topics = {
			code: ["function", "class", "import", "const", "let", "var", "代码", "函数"],
			error: ["error", "bug", "fix", "issue", "错误", "问题"],
			config: ["config", "setting", "option", "配置", "设置"],
			docs: ["documentation", "readme", "comment", "文档", "注释"],
			test: ["test", "spec", "测试"],
		}

		const lowerContent = content.toLowerCase()

		for (const [topic, keywords] of Object.entries(topics)) {
			for (const keyword of keywords) {
				if (lowerContent.includes(keyword)) {
					return topic
				}
			}
		}

		return "general"
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
	 * Get all summaries
	 */
	getSummaries(): Summary[] {
		return this.summaries
	}

	/**
	 * Clear summaries
	 */
	clearSummaries(): void {
		this.summaries = []
	}

	/**
	 * Clear all state
	 */
	clear(): void {
		this.summaries = []
	}
}
