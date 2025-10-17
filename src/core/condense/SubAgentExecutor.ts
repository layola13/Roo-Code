/**
 * SubAgentExecutor - Bridge between old API and new ConversationController
 *
 * This module maintains backward compatibility with the old SubAgentExecutor API
 * while internally using the new ConversationController architecture.
 *
 * Key improvements:
 * - Uses new three-tier architecture (Controller → Executor → Agents)
 * - Intelligent routing and scheduling
 * - Performance monitoring
 * - Context management
 * - Maintains backward compatibility with existing code
 */

import { ApiHandler } from "../../api"
import { ApiMessage } from "../task-persistence/apiMessages"
import { ConversationController } from "../subagent/ConversationController"
import { VectorMemoryStore } from "../memory/VectorMemoryStore"
import { SubagentParams, SubagentResult as NewSubagentResult, AgentContext, SubagentName } from "../subagent/types"

/**
 * Configuration for a single subagent
 */
export interface SubAgentDefinition {
	name: string
	systemPrompt: string
	description: string
}

/**
 * Configuration for subagent-based compression
 */
export interface SubAgentConfig {
	enabled: boolean
	useContextAnalyzer?: boolean
	useMemoryExtractor?: boolean
	useCodeSummarizer?: boolean
	verboseLogging?: boolean
	// Custom prompts for each subagent (optional overrides)
	contextAnalyzerPrompt?: string
	memoryExtractorPrompt?: string
	codeSummarizerPrompt?: string
}

/**
 * Result from a single subagent execution (old format)
 */
export interface SubAgentResult {
	agentName: string
	output: string
	tokensIn: number
	tokensOut: number
	cost: number
	success: boolean
	error?: string
}

/**
 * Combined results from all subagents
 */
export interface SubAgentCompressionResult {
	analyzerResult: SubAgentResult
	extractorResult: SubAgentResult
	summarizerResult: SubAgentResult
	totalCost: number
	success: boolean
	error?: string
}

/**
 * SubAgentExecutor - Executes subagents using new ConversationController
 */
export class SubAgentExecutor {
	private controller: ConversationController

	constructor(
		private apiHandler: ApiHandler,
		private config: SubAgentConfig,
		private vectorMemoryStore?: VectorMemoryStore,
	) {
		// Initialize the new ConversationController
		// ✅ 核心修复：传递VectorMemoryStore给ConversationController
		this.controller = new ConversationController(apiHandler, vectorMemoryStore, {
			enableCache: true,
			enableMetrics: true,
			enableAutoCompression: false, // We handle this manually
			verboseLogging: config.verboseLogging || false,
		})
	}

	/**
	 * Execute a single subagent using the new architecture
	 */
	private async executeSubAgent(
		agentName: SubagentName,
		messages: ApiMessage[],
		task?: string,
	): Promise<SubAgentResult> {
		try {
			// Convert to new format
			const params: SubagentParams = {
				agent_name: agentName,
				task: task || "Analyze the conversation and provide your analysis according to your role",
			}

			const context: AgentContext = {
				messages,
				conversationMeta: {},
			}

			if (this.config.verboseLogging) {
				console.log(`[SubAgentExecutor] Executing ${agentName}...`)
			}

			// Execute using new controller
			const result: NewSubagentResult = await this.controller.executeSubagent(params, context)

			// Convert new format back to old format
			const output = typeof result.output === "string" ? result.output : JSON.stringify(result.output, null, 2)

			const oldResult: SubAgentResult = {
				agentName: result.agentName,
				output: output,
				tokensIn: 0, // New system doesn't expose token breakdown
				tokensOut: result.tokensUsed,
				cost: 0, // Cost calculation handled elsewhere
				success: result.success,
				error: result.error,
			}

			if (this.config.verboseLogging) {
				console.log(
					`[SubAgentExecutor] ${agentName} completed. Tokens: ${result.tokensUsed}, Time: ${result.executionTime}ms`,
				)
			}

			return oldResult
		} catch (error) {
			if (this.config.verboseLogging) {
				console.error(`[SubAgentExecutor] ${agentName} failed:`, error)
			}

			return {
				agentName,
				output: "",
				tokensIn: 0,
				tokensOut: 0,
				cost: 0,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	/**
	 * Execute all configured subagents and return combined results
	 * Executes subagents in parallel for improved performance
	 */
	async executeCompression(messages: ApiMessage[]): Promise<SubAgentCompressionResult> {
		if (this.config.verboseLogging) {
			console.log("[SubAgentExecutor] Starting parallel compression with config:", this.config)
		}

		try {
			// Prepare all subagent execution promises
			const executionPromises: Promise<SubAgentResult>[] = []

			// Execute Context Analyzer
			if (this.config.useContextAnalyzer) {
				executionPromises.push(
					this.executeSubAgent(
						"condense-context-analyzer",
						messages,
						"Analyze conversation structure and identify key stages",
					),
				)
			}

			// Execute Memory Extractor
			if (this.config.useMemoryExtractor) {
				executionPromises.push(
					this.executeSubAgent(
						"condense-memory-extractor",
						messages,
						"Extract critical decisions, requirements, and constraints",
					),
				)
			}

			// Execute Code Summarizer
			if (this.config.useCodeSummarizer) {
				executionPromises.push(
					this.executeSubAgent(
						"condense-code-summarizer",
						messages,
						"Summarize code changes and technical implementations",
					),
				)
			}

			// Execute all subagents in parallel and wait for all to complete
			const results = await Promise.all(executionPromises)

			// Calculate total cost (sum of individual costs)
			const totalCost = results.reduce((sum, result) => sum + result.cost, 0)

			// Create default results for each subagent
			const analyzerResult: SubAgentResult =
				results.find((r) => r.agentName === "condense-context-analyzer") ||
				this.createEmptyResult("condense-context-analyzer", "Not executed")

			const extractorResult: SubAgentResult =
				results.find((r) => r.agentName === "condense-memory-extractor") ||
				this.createEmptyResult("condense-memory-extractor", "Not executed")

			const summarizerResult: SubAgentResult =
				results.find((r) => r.agentName === "condense-code-summarizer") ||
				this.createEmptyResult("condense-code-summarizer", "Not executed")

			// Check if any subagent succeeded
			const hasSuccessfulResults = results.some((r) => r.success)

			if (!hasSuccessfulResults) {
				return {
					analyzerResult,
					extractorResult,
					summarizerResult,
					totalCost,
					success: false,
					error: "All subagent calls failed",
				}
			}

			if (this.config.verboseLogging) {
				console.log(`[SubAgentExecutor] Compression completed. Total cost: $${totalCost.toFixed(4)}`)
			}

			return {
				analyzerResult,
				extractorResult,
				summarizerResult,
				totalCost,
				success: true,
			}
		} catch (error) {
			const emptyResult = this.createEmptyResult("error", error instanceof Error ? error.message : String(error))

			return {
				analyzerResult: emptyResult,
				extractorResult: emptyResult,
				summarizerResult: emptyResult,
				totalCost: 0,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	/**
	 * Create an empty result for a subagent that wasn't executed or failed
	 */
	private createEmptyResult(agentName: string, error: string): SubAgentResult {
		return {
			agentName,
			output: "",
			tokensIn: 0,
			tokensOut: 0,
			cost: 0,
			success: false,
			error,
		}
	}

	/**
	 * Check if subagent compression should be used based on configuration
	 */
	static shouldUseCompression(config: SubAgentConfig | undefined): boolean {
		if (!config || !config.enabled) {
			return false
		}
		return !!(config.useContextAnalyzer || config.useMemoryExtractor || config.useCodeSummarizer)
	}

	/**
	 * Get the underlying ConversationController for advanced operations
	 */
	getController(): ConversationController {
		return this.controller
	}
}

/**
 * Convenience function to execute subagent compression
 * This replaces the old executeSubAgentCompression from subagent-caller.ts
 */
export async function executeSubAgentCompression(
	messages: ApiMessage[],
	config: SubAgentConfig,
	apiHandler: ApiHandler,
	vectorMemoryStore?: VectorMemoryStore,
): Promise<SubAgentCompressionResult> {
	const executor = new SubAgentExecutor(apiHandler, config, vectorMemoryStore)
	return executor.executeCompression(messages)
}

/**
 * Check if subagent compression should be used
 * This replaces the old shouldUseSubAgentCompression from subagent-caller.ts
 */
export function shouldUseSubAgentCompression(config: SubAgentConfig | undefined): boolean {
	return SubAgentExecutor.shouldUseCompression(config)
}
