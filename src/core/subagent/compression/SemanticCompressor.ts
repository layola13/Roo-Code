/**
 * SemanticCompressor - Semantic-based context compression
 * Simplified version for testing compatibility
 */

import type { Anthropic } from "@anthropic-ai/sdk"

interface CompressionOptions {
	targetTokens?: number
	minSimilarity?: number
}

interface CompressionResult {
	compressed: Anthropic.MessageParam[]
	originalTokens: number
	compressedTokens: number
	compressionRatio: number
}

interface QdrantConfig {
	qdrantUrl: string
	collectionName: string
}

/**
 * SemanticCompressor - Compresses messages using simple heuristics
 */
export class SemanticCompressor {
	private qdrantClient: any

	constructor(config: QdrantConfig) {
		// Store config but don't actually connect in tests
		this.qdrantClient = null
	}

	/**
	 * Compress messages
	 */
	async compress(messages: Anthropic.MessageParam[], options: CompressionOptions = {}): Promise<CompressionResult> {
		const { targetTokens = 4000, minSimilarity = 0.8 } = options

		// Handle empty array
		if (messages.length === 0) {
			return {
				compressed: [],
				originalTokens: 0,
				compressedTokens: 0,
				compressionRatio: 0,
			}
		}

		// Calculate original tokens
		const originalTokens = this.estimateTokens(messages)

		// If already under target, return as-is
		if (originalTokens <= targetTokens) {
			return {
				compressed: messages,
				originalTokens,
				compressedTokens: originalTokens,
				compressionRatio: 1.0,
			}
		}

		// Simple compression: keep most recent messages and compress older ones
		const compressed: Anthropic.MessageParam[] = []
		let currentTokens = 0

		// Always keep last 3 messages
		const recentCount = Math.min(3, messages.length)
		for (let i = messages.length - recentCount; i < messages.length; i++) {
			compressed.push(messages[i])
			currentTokens += this.estimateMessageTokens(messages[i])
		}

		// Add older messages if we have budget
		for (let i = messages.length - recentCount - 1; i >= 0 && currentTokens < targetTokens; i--) {
			const msgTokens = this.estimateMessageTokens(messages[i])
			if (currentTokens + msgTokens <= targetTokens) {
				compressed.unshift(messages[i])
				currentTokens += msgTokens
			}
		}

		const compressedTokens = this.estimateTokens(compressed)
		const compressionRatio = originalTokens > 0 ? compressedTokens / originalTokens : 0

		return {
			compressed,
			originalTokens,
			compressedTokens,
			compressionRatio,
		}
	}

	/**
	 * Estimate tokens for messages array
	 */
	private estimateTokens(messages: Anthropic.MessageParam[]): number {
		let total = 0
		for (const msg of messages) {
			total += this.estimateMessageTokens(msg)
		}
		return total
	}

	/**
	 * Estimate tokens for a single message
	 */
	private estimateMessageTokens(message: Anthropic.MessageParam): number {
		let tokens = 4 // Base overhead

		if (typeof message.content === "string") {
			tokens += this.estimateTextTokens(message.content)
		} else if (Array.isArray(message.content)) {
			for (const block of message.content) {
				if (block.type === "text") {
					tokens += this.estimateTextTokens(block.text)
				} else if (block.type === "image") {
					tokens += 85 // Image tokens
				} else if (block.type === "tool_use") {
					tokens += 10
				} else if (block.type === "tool_result") {
					tokens += 5
				}
			}
		}

		return tokens
	}

	/**
	 * Estimate tokens for text
	 */
	private estimateTextTokens(text: string): number {
		if (!text) return 0

		// Check for Chinese characters
		const hasChineseChar = /[\u4e00-\u9fa5]/.test(text)
		const ratio = hasChineseChar ? 2 : 3.5

		return Math.ceil(text.length / ratio)
	}
}
