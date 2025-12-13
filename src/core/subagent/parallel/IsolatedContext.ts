/**
 * IsolatedContext - Manages isolated 200K token context for parallel subagent execution
 *
 * Each execution slot gets its own isolated context to prevent interference
 * between concurrent subagent executions.
 */

import { IsolatedContextState } from "./types"
import { AgentContext } from "../types"

/**
 * Token estimation utility
 * Rough estimation: 1 token ≈ 4 characters for English text
 */
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4)
}

/**
 * IsolatedContext class
 * Provides a 200K token isolated context for subagent execution
 */
export class IsolatedContext {
	private state: IsolatedContextState
	private readonly MAX_TOKENS: number

	constructor(id: string, maxTokens: number = 200_000) {
		this.MAX_TOKENS = maxTokens
		this.state = {
			id,
			messages: [],
			tokenCount: 0,
			maxTokens,
			lastUsed: Date.now(),
			inUse: false,
		}
	}

	/**
	 * Initialize context with base context
	 */
	initialize(baseContext: AgentContext): void {
		this.state.messages = [...baseContext.messages]
		this.state.tokenCount = this.calculateTokenCount()
		this.state.lastUsed = Date.now()
		this.state.inUse = true
	}

	/**
	 * Add messages to context
	 */
	addMessages(messages: any[]): void {
		// Check if adding these messages would exceed limit
		const additionalTokens = this.estimateMessagesTokens(messages)

		if (this.state.tokenCount + additionalTokens > this.MAX_TOKENS) {
			// Compress or remove old messages
			this.compressContext(additionalTokens)
		}

		this.state.messages.push(...messages)
		this.state.tokenCount = this.calculateTokenCount()
		this.state.lastUsed = Date.now()
	}

	/**
	 * Get current context
	 */
	getContext(): AgentContext {
		this.state.lastUsed = Date.now()
		return {
			messages: this.state.messages,
			conversationMeta: {
				contextId: this.state.id,
				tokenCount: this.state.tokenCount,
			},
		}
	}

	/**
	 * Get context state
	 */
	getState(): IsolatedContextState {
		return { ...this.state }
	}

	/**
	 * Clear context
	 */
	clear(): void {
		this.state.messages = []
		this.state.tokenCount = 0
		this.state.lastUsed = Date.now()
	}

	/**
	 * Reset context
	 */
	reset(): void {
		this.clear()
		this.state.inUse = false
	}

	/**
	 * Mark context as in use
	 */
	acquire(): void {
		this.state.inUse = true
		this.state.lastUsed = Date.now()
	}

	/**
	 * Mark context as available
	 */
	release(): void {
		this.state.inUse = false
		this.state.lastUsed = Date.now()
	}

	/**
	 * Check if context is in use
	 */
	isInUse(): boolean {
		return this.state.inUse
	}

	/**
	 * Check if context is expired (based on TTL)
	 */
	isExpired(ttlMs: number): boolean {
		return Date.now() - this.state.lastUsed > ttlMs
	}

	/**
	 * Get current token count
	 */
	getTokenCount(): number {
		return this.state.tokenCount
	}

	/**
	 * Get available token capacity
	 */
	getAvailableTokens(): number {
		return this.MAX_TOKENS - this.state.tokenCount
	}

	/**
	 * Check if context has capacity for additional tokens
	 */
	hasCapacity(requiredTokens: number): boolean {
		return this.state.tokenCount + requiredTokens <= this.MAX_TOKENS
	}

	/**
	 * Calculate total token count for current messages
	 */
	private calculateTokenCount(): number {
		let total = 0

		for (const message of this.state.messages) {
			if (typeof message.content === "string") {
				total += estimateTokens(message.content)
			} else if (Array.isArray(message.content)) {
				// Handle content blocks
				for (const block of message.content) {
					if (block.type === "text" && typeof block.text === "string") {
						total += estimateTokens(block.text)
					} else if (block.type === "tool_use") {
						total += estimateTokens(JSON.stringify(block))
					} else if (block.type === "tool_result") {
						total += estimateTokens(JSON.stringify(block))
					}
				}
			}
		}

		return total
	}

	/**
	 * Estimate tokens for a list of messages
	 */
	private estimateMessagesTokens(messages: any[]): number {
		let total = 0

		for (const message of messages) {
			if (typeof message.content === "string") {
				total += estimateTokens(message.content)
			} else if (Array.isArray(message.content)) {
				for (const block of message.content) {
					if (block.type === "text" && typeof block.text === "string") {
						total += estimateTokens(block.text)
					} else if (block.type === "tool_use") {
						total += estimateTokens(JSON.stringify(block))
					} else if (block.type === "tool_result") {
						total += estimateTokens(JSON.stringify(block))
					}
				}
			}
		}

		return total
	}

	/**
	 * Compress context to make room for new messages
	 * Removes oldest messages while keeping most recent ones
	 */
	private compressContext(requiredTokens: number): void {
		const targetTokens = this.MAX_TOKENS - requiredTokens - 10_000 // Keep 10K buffer

		// Always keep the last 5 messages (most recent context)
		const keepMessages = 5
		let currentTokens = this.state.tokenCount

		// Remove messages from the beginning (oldest first)
		while (currentTokens > targetTokens && this.state.messages.length > keepMessages) {
			const removed = this.state.messages.shift()
			if (removed) {
				const removedTokens = this.estimateMessagesTokens([removed])
				currentTokens -= removedTokens
			}
		}

		// Recalculate token count
		this.state.tokenCount = this.calculateTokenCount()
	}

	/**
	 * Get context metadata
	 */
	getMetadata(): {
		id: string
		messageCount: number
		tokenCount: number
		utilization: number
		lastUsed: Date
		inUse: boolean
	} {
		return {
			id: this.state.id,
			messageCount: this.state.messages.length,
			tokenCount: this.state.tokenCount,
			utilization: this.state.tokenCount / this.MAX_TOKENS,
			lastUsed: new Date(this.state.lastUsed),
			inUse: this.state.inUse,
		}
	}

	/**
	 * Clone context (for forking)
	 */
	clone(newId: string): IsolatedContext {
		const cloned = new IsolatedContext(newId, this.MAX_TOKENS)
		cloned.state = {
			...this.state,
			id: newId,
			messages: [...this.state.messages],
			inUse: false,
			lastUsed: Date.now(),
		}
		return cloned
	}
}
