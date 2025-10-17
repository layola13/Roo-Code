/**
 * TokenEstimator - Local token estimation utility
 * Avoids expensive API calls for token counting
 *
 * Based on empirical analysis:
 * - English/Code: ~3.5 characters per token
 * - Chinese: ~2 characters per token
 * - Mixed content: adaptive estimation
 */

import { ApiMessage } from "../../task-persistence/apiMessages"

export class TokenEstimator {
	private static readonly ENGLISH_RATIO = 3.5
	private static readonly CHINESE_RATIO = 2.0
	private static readonly CODE_RATIO = 3.5

	/**
	 * Estimate tokens for plain text (static method compatible with Anthropic.MessageParam)
	 */
	static estimateTokens(text: string): number {
		if (!text) return 0

		// Check if text contains code blocks
		const hasCodeBlock = text.includes("```")
		if (hasCodeBlock) {
			return TokenEstimator.estimateCodeText(text)
		}

		// Check language composition
		const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
		const totalChars = text.length

		// If more than 30% Chinese, use Chinese ratio
		if (chineseChars / totalChars > 0.3) {
			return Math.ceil(totalChars / TokenEstimator.CHINESE_RATIO)
		}

		// Otherwise use English/code ratio
		return Math.ceil(totalChars / TokenEstimator.ENGLISH_RATIO)
	}

	/**
	 * Estimate tokens for messages array (static method compatible with Anthropic.MessageParam[])
	 */
	static estimateMessagesTokens(messages: Array<{ role: string; content: any }>): number {
		let total = 0
		for (const msg of messages) {
			const content = TokenEstimator.getMessageContent(msg)
			total += TokenEstimator.estimateTokens(content)

			// Add overhead for role and structure (~4 tokens per message)
			total += 4

			// Handle special content types
			if (Array.isArray(msg.content)) {
				for (const block of msg.content) {
					if (block.type === "image") {
						total += 85 // Approximate tokens for image
					} else if (block.type === "tool_use") {
						total += 10 // Overhead for tool use
					} else if (block.type === "tool_result") {
						total += 5 // Overhead for tool result
					}
				}
			}
		}
		return total
	}

	/**
	 * Estimate tokens for code-heavy text
	 */
	private static estimateCodeText(text: string): number {
		// Split by code blocks
		const codeBlockPattern = /```[\s\S]*?```/g
		const codeBlocks = text.match(codeBlockPattern) || []
		const textWithoutCode = text.replace(codeBlockPattern, "")

		// Estimate code blocks (typically more dense)
		let codeTokens = 0
		for (const block of codeBlocks) {
			codeTokens += Math.ceil(block.length / TokenEstimator.CODE_RATIO)
		}

		// Estimate remaining text
		const textTokens = TokenEstimator.estimateTokens(textWithoutCode)

		return codeTokens + textTokens
	}

	/**
	 * Get message content as string (static method)
	 */
	private static getMessageContent(message: any): string {
		if (typeof message.content === "string") {
			return message.content
		}
		return message.content?.map((block: any) => (block.type === "text" ? block.text : "")).join("\n") || ""
	}

	// Keep instance methods for backward compatibility
	estimateMessage(message: ApiMessage): number {
		const content = TokenEstimator.getMessageContent(message)
		return TokenEstimator.estimateTokens(content)
	}

	estimateMessages(messages: ApiMessage[]): number {
		return TokenEstimator.estimateMessagesTokens(messages)
	}

	estimateText(text: string): number {
		return TokenEstimator.estimateTokens(text)
	}
}
