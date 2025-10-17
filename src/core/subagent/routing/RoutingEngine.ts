/**
 * RoutingEngine - Intelligent routing for subagent selection
 *
 * Based on docs/45-subagent.md requirements:
 * - Analyze user intent and conversation context
 * - Route to appropriate subagent automatically
 * - Support multi-agent orchestration
 */

import { SubagentName, AgentContext, SubagentParams } from "../types"

export interface RoutingDecision {
	primaryAgent: SubagentName
	additionalAgents?: SubagentName[]
	confidence: number
	reasoning: string
}

export interface RoutingRule {
	pattern: RegExp | string
	agent: SubagentName
	priority: number
	contextRequired?: number // minimum messages needed
}

/**
 * RoutingEngine - Routes requests to appropriate subagents
 */
export class RoutingEngine {
	private rules: RoutingRule[] = []

	constructor() {
		this.initializeDefaultRules()
	}

	/**
	 * Initialize default routing rules
	 */
	private initializeDefaultRules(): void {
		// Context analysis triggers
		this.addRule({
			pattern: /summarize|recap|what (have|did) we/i,
			agent: "condense-context-analyzer",
			priority: 10,
		})

		this.addRule({
			pattern: /conversation (flow|structure|stages)/i,
			agent: "condense-context-analyzer",
			priority: 9,
		})

		// Memory extraction triggers
		this.addRule({
			pattern: /remember|important|decision|requirement/i,
			agent: "condense-memory-extractor",
			priority: 8,
		})

		this.addRule({
			pattern: /what (did|have) (i|we) (decide|agree)/i,
			agent: "condense-memory-extractor",
			priority: 9,
		})

		// Code summarization triggers
		this.addRule({
			pattern: /code (change|modification|refactor)/i,
			agent: "condense-code-summarizer",
			priority: 8,
		})

		this.addRule({
			pattern: /what (file|function|class)/i,
			agent: "condense-code-summarizer",
			priority: 7,
		})
	}

	/**
	 * Add a custom routing rule
	 */
	addRule(rule: RoutingRule): void {
		this.rules.push(rule)
		// Sort by priority (descending)
		this.rules.sort((a, b) => b.priority - a.priority)
	}

	/**
	 * Route a request to the appropriate subagent(s)
	 */
	route(userMessage: string, context: AgentContext): RoutingDecision {
		// Check context length requirements
		const messageCount = context.messages.length

		// Try pattern matching
		for (const rule of this.rules) {
			if (rule.contextRequired && messageCount < rule.contextRequired) {
				continue
			}

			const matches = this.matchesPattern(userMessage, rule.pattern)
			if (matches) {
				return {
					primaryAgent: rule.agent,
					confidence: this.calculateConfidence(rule, userMessage),
					reasoning: `Matched pattern: ${rule.pattern}`,
				}
			}
		}

		// Default routing based on context size
		return this.defaultRouting(context)
	}

	/**
	 * Auto-detect need for compression based on context
	 */
	detectCompressionNeeded(context: AgentContext): {
		needed: boolean
		suggestedAgents: SubagentName[]
		reason: string
	} {
		const messageCount = context.messages.length
		const totalTokens = this.estimateTokens(context)

		// Compression thresholds (lowered to trigger earlier)
		const TOKEN_THRESHOLD = 84000 // 70% of typical 120k window (proactive compression)
		const MESSAGE_THRESHOLD = 20

		if (totalTokens > TOKEN_THRESHOLD) {
			return {
				needed: true,
				suggestedAgents: ["condense-memory-extractor", "condense-context-analyzer"],
				reason: `Token count (${totalTokens}) exceeds threshold`,
			}
		}

		if (messageCount > MESSAGE_THRESHOLD) {
			return {
				needed: true,
				suggestedAgents: ["condense-context-analyzer"],
				reason: `Message count (${messageCount}) exceeds threshold`,
			}
		}

		return {
			needed: false,
			suggestedAgents: [],
			reason: "Context within normal limits",
		}
	}

	/**
	 * Suggest multi-agent workflow
	 */
	suggestWorkflow(userMessage: string, context: AgentContext): { agents: SubagentName[]; rationale: string } {
		const decisions = this.rules
			.filter((rule) => this.matchesPattern(userMessage, rule.pattern))
			.map((rule) => rule.agent)

		// Remove duplicates
		const uniqueAgents = Array.from(new Set(decisions))

		if (uniqueAgents.length === 0) {
			return {
				agents: [],
				rationale: "No specific agents matched",
			}
		}

		return {
			agents: uniqueAgents as SubagentName[],
			rationale: `Matched ${uniqueAgents.length} agent(s) based on message content`,
		}
	}

	/**
	 * Check if message matches pattern
	 */
	private matchesPattern(message: string, pattern: RegExp | string): boolean {
		if (pattern instanceof RegExp) {
			return pattern.test(message)
		}
		return message.toLowerCase().includes(pattern.toLowerCase())
	}

	/**
	 * Calculate confidence score
	 */
	private calculateConfidence(rule: RoutingRule, message: string): number {
		// Base confidence from priority
		let confidence = rule.priority / 10

		// Adjust based on message length (longer = more context = higher confidence)
		const wordCount = message.split(/\s+/).length
		if (wordCount > 50) confidence += 0.1
		if (wordCount > 100) confidence += 0.1

		return Math.min(confidence, 1.0)
	}

	/**
	 * Default routing when no rules match
	 */
	private defaultRouting(context: AgentContext): RoutingDecision {
		const messageCount = context.messages.length

		if (messageCount > 20) {
			return {
				primaryAgent: "condense-context-analyzer",
				confidence: 0.6,
				reasoning: "High message count, suggesting context analysis",
			}
		}

		if (messageCount > 10) {
			return {
				primaryAgent: "condense-memory-extractor",
				confidence: 0.5,
				reasoning: "Moderate message count, suggesting memory extraction",
			}
		}

		return {
			primaryAgent: "condense-context-analyzer",
			confidence: 0.4,
			reasoning: "Default routing to context analyzer",
		}
	}

	/**
	 * Estimate token count (improved accuracy)
	 * Uses language-aware estimation for better precision
	 */
	private estimateTokens(context: AgentContext): number {
		let total = 0
		for (const msg of context.messages) {
			const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)

			// Improved estimation:
			// - Chinese characters: ~2 chars/token
			// - English/code: ~3.5 chars/token
			const hasChineseChar = /[\u4e00-\u9fa5]/.test(content)
			const ratio = hasChineseChar ? 2 : 3.5

			total += content.length / ratio
		}
		return Math.floor(total)
	}

	/**
	 * Get all registered rules
	 */
	getRules(): RoutingRule[] {
		return [...this.rules]
	}

	/**
	 * Clear all rules
	 */
	clearRules(): void {
		this.rules = []
	}
}
