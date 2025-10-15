/**
 * SubAgentExecutor - Independent SubAgent Execution System
 *
 * This module provides a standalone execution system for subagents that doesn't
 * depend on the Task.startSubtask() infrastructure. It allows subagents to be
 * executed independently for context compression without coupling to the main
 * task lifecycle or judge system.
 *
 * Key improvements over the original subagent-caller.ts:
 * - No dependency on Task.startSubtask/waitForSubtask/completeSubtask
 * - Direct API handler invocation for better performance
 * - Cleaner separation of concerns
 * - Easier to test and maintain
 */

import { ApiHandler } from "../../api"
import { ApiMessage } from "../task-persistence/apiMessages"
import { maybeRemoveImageBlocks } from "../../api/transform/image-cleaning"
import { DEFAULT_SUBAGENT_PROMPTS } from "../../shared/subagent-prompts"

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
 * Result from a single subagent execution
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
 * Default system prompts for each subagent
 * Now imported from shared module to ensure consistency between backend and frontend
 */
const DEFAULT_PROMPTS = DEFAULT_SUBAGENT_PROMPTS

/**
 * SubAgentExecutor - Executes subagents independently without Task dependency
 */
export class SubAgentExecutor {
	constructor(
		private apiHandler: ApiHandler,
		private config: SubAgentConfig,
	) {}

	/**
	 * Execute a single subagent to analyze messages
	 */
	private async executeSubAgent(
		agentName: string,
		systemPrompt: string,
		messages: ApiMessage[],
	): Promise<SubAgentResult> {
		const result: SubAgentResult = {
			agentName,
			output: "",
			tokensIn: 0,
			tokensOut: 0,
			cost: 0,
			success: false,
		}

		try {
			// Format messages for subagent consumption
			const messageContext = this.formatMessagesForSubAgent(messages)

			// Create the user request message
			const userMessage = `Analyze the following conversation and provide your analysis according to your role.

${messageContext}`

			// Prepare the request (single user message)
			const requestMessages = maybeRemoveImageBlocks(
				[
					{
						role: "user" as const,
						content: userMessage,
					},
				],
				this.apiHandler,
			).map(({ role, content }) => ({ role, content }))

			if (this.config.verboseLogging) {
				console.log(`[SubAgentExecutor] Executing ${agentName}...`)
			}

			// Execute the API request
			// Pass mode metadata so getApiMetrics() can identify this as a subagent call
			const stream = this.apiHandler.createMessage(systemPrompt, requestMessages, {
				mode: `condense-${agentName.toLowerCase().replace(/\s+/g, "-")}`,
				taskId: "subagent-compression",
			})

			let output = ""
			let inputTokens = 0
			let outputTokens = 0
			let totalCost = 0

			// Process the stream
			for await (const chunk of stream) {
				if (chunk.type === "text") {
					output += chunk.text
				} else if (chunk.type === "usage") {
					inputTokens += chunk.inputTokens || 0
					outputTokens += chunk.outputTokens || 0
					totalCost = chunk.totalCost || 0
				}
			}

			result.output = output.trim()
			result.tokensIn = inputTokens
			result.tokensOut = outputTokens
			result.cost = totalCost
			result.success = result.output.length > 0

			if (this.config.verboseLogging) {
				console.log(
					`[SubAgentExecutor] ${agentName} completed. Tokens: ${inputTokens}/${outputTokens}, Cost: $${totalCost.toFixed(4)}`,
				)
			}
		} catch (error) {
			result.success = false
			result.error = error instanceof Error ? error.message : String(error)

			if (this.config.verboseLogging) {
				console.error(`[SubAgentExecutor] ${agentName} failed:`, error)
			}
		}

		return result
	}

	/**
	 * Format messages for subagent analysis
	 */
	private formatMessagesForSubAgent(messages: ApiMessage[]): string {
		const formattedMessages = messages
			.map((msg, index) => {
				const role = msg.role === "user" ? "User" : "Assistant"
				const content =
					typeof msg.content === "string"
						? msg.content
						: msg.content
								.map((block) => (block.type === "text" ? block.text : "[non-text content]"))
								.join("\n")

				return `[Message ${index + 1}] ${role}:\n${content}`
			})
			.join("\n\n---\n\n")

		return `Conversation Messages:\n\n${formattedMessages}`
	}

	/**
	 * Execute all configured subagents and return combined results
	 */
	async executeCompression(messages: ApiMessage[]): Promise<SubAgentCompressionResult> {
		const results: SubAgentResult[] = []
		let totalCost = 0

		if (this.config.verboseLogging) {
			console.log("[SubAgentExecutor] Starting compression with config:", this.config)
		}

		try {
			// Execute Context Analyzer
			if (this.config.useContextAnalyzer) {
				const prompt = this.config.contextAnalyzerPrompt || DEFAULT_PROMPTS.contextAnalyzer
				const result = await this.executeSubAgent("Context Analyzer", prompt, messages)
				results.push(result)
				totalCost += result.cost
			}

			// Execute Memory Extractor
			if (this.config.useMemoryExtractor) {
				const prompt = this.config.memoryExtractorPrompt || DEFAULT_PROMPTS.memoryExtractor
				const result = await this.executeSubAgent("Memory Extractor", prompt, messages)
				results.push(result)
				totalCost += result.cost
			}

			// Execute Code Summarizer
			if (this.config.useCodeSummarizer) {
				const prompt = this.config.codeSummarizerPrompt || DEFAULT_PROMPTS.codeSummarizer
				const result = await this.executeSubAgent("Code Summarizer", prompt, messages)
				results.push(result)
				totalCost += result.cost
			}

			// Create default results for each subagent
			const analyzerResult: SubAgentResult =
				results.find((r) => r.agentName === "Context Analyzer") ||
				this.createEmptyResult("Context Analyzer", "Not executed")

			const extractorResult: SubAgentResult =
				results.find((r) => r.agentName === "Memory Extractor") ||
				this.createEmptyResult("Memory Extractor", "Not executed")

			const summarizerResult: SubAgentResult =
				results.find((r) => r.agentName === "Code Summarizer") ||
				this.createEmptyResult("Code Summarizer", "Not executed")

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
				totalCost,
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
}

/**
 * Convenience function to execute subagent compression
 * This replaces the old executeSubAgentCompression from subagent-caller.ts
 */
export async function executeSubAgentCompression(
	messages: ApiMessage[],
	config: SubAgentConfig,
	apiHandler: ApiHandler,
): Promise<SubAgentCompressionResult> {
	const executor = new SubAgentExecutor(apiHandler, config)
	return executor.executeCompression(messages)
}

/**
 * Check if subagent compression should be used
 * This replaces the old shouldUseSubAgentCompression from subagent-caller.ts
 */
export function shouldUseSubAgentCompression(config: SubAgentConfig | undefined): boolean {
	return SubAgentExecutor.shouldUseCompression(config)
}
