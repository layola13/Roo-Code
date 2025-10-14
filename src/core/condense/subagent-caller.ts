/**
 * Subagent Caller for Context Compression
 *
 * This module provides functionality to call specialized subagents for context compression.
 * Each subagent operates in an isolated context to analyze different aspects of the conversation,
 * then returns a condensed summary that can be used to build the final compressed context.
 *
 * Architecture:
 * - Uses the existing Task.startSubtask() infrastructure
 * - Each subagent runs with minimal tools (haiku model recommended)
 * - Results are parsed from the subagent's completion message
 * - Token usage is tracked per subagent for cost analysis
 */

import { ApiMessage } from "../task-persistence/apiMessages"
import { Task } from "../task/Task"
import { TodoItem } from "@roo-code/types"

/**
 * Configuration for subagent-based compression
 */
export interface SubAgentConfig {
	enabled: boolean
	useContextAnalyzer?: boolean
	useMemoryExtractor?: boolean
	useCodeSummarizer?: boolean
	verboseLogging?: boolean
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
 * Subagent definitions mapping to .roo/agents/ configurations
 */
const SUBAGENT_CONFIGS = {
	contextAnalyzer: {
		name: "condense-context-analyzer",
		mode: "ask", // Use ask mode for analysis tasks
		description: "Analyzes conversation flow and extracts dialogue stages",
	},
	memoryExtractor: {
		name: "condense-memory-extractor",
		mode: "ask",
		description: "Extracts critical user instructions and requirements",
	},
	codeSummarizer: {
		name: "condense-code-summarizer",
		mode: "ask",
		description: "Summarizes technical context and code changes",
	},
}

/**
 * Call a single subagent to process messages
 *
 * NOTE: This is a placeholder implementation. The actual implementation requires
 * access to a Task instance to call startSubtask(). In the real integration,
 * this will need to be called from within a Task context or we'll need to
 * refactor to pass the Task instance.
 *
 * @param agentName - Name of the subagent to call
 * @param messages - Conversation messages to analyze
 * @param task - Parent task instance (needed for startSubtask)
 * @returns SubAgentResult with the analysis output
 */
async function callSubAgent(agentName: string, messages: ApiMessage[], task: Task): Promise<SubAgentResult> {
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
		const messageContext = formatMessagesForSubAgent(messages, agentName)

		// Create subagent task message
		const subagentMessage = `Analyze the following conversation and provide a condensed summary according to your role as ${agentName}.\n\n${messageContext}`

		// Empty todos for analysis tasks
		const todos: TodoItem[] = []

		// Determine mode based on agent config
		const agentConfig = Object.values(SUBAGENT_CONFIGS).find((cfg) => cfg.name === agentName)
		const mode = agentConfig?.mode || "ask"

		// Start the subagent task
		const subTask = await task.startSubtask(subagentMessage, todos, mode)

		if (!subTask) {
			throw new Error(`Failed to create subtask for ${agentName}`)
		}

		// Wait for subagent to complete
		await task.waitForSubtask()

		// Extract the result from the completed subagent
		// The result should be in the last message from the subagent
		const lastMessage = subTask.clineMessages[subTask.clineMessages.length - 1]

		if (lastMessage && lastMessage.type === "say" && lastMessage.text) {
			result.output = lastMessage.text
			result.success = true

			// Extract token usage from subagent
			const tokenUsage = subTask.getTokenUsage()
			result.tokensIn = tokenUsage.totalTokensIn || 0
			result.tokensOut = tokenUsage.totalTokensOut || 0
			result.cost = tokenUsage.totalCost || 0
		} else {
			throw new Error(`No valid output received from ${agentName}`)
		}

		// Complete the subagent task
		await task.completeSubtask(result.output)
	} catch (error) {
		result.success = false
		result.error = error instanceof Error ? error.message : String(error)
	}

	return result
}

/**
 * Format messages for subagent analysis
 * Different subagents need different message formats
 */
function formatMessagesForSubAgent(messages: ApiMessage[], agentName: string): string {
	// Convert messages to readable text format
	const formattedMessages = messages
		.map((msg, index) => {
			const role = msg.role === "user" ? "User" : "Assistant"
			const content =
				typeof msg.content === "string"
					? msg.content
					: msg.content.map((block) => (block.type === "text" ? block.text : "[non-text content]")).join("\n")

			return `[Message ${index + 1}] ${role}:\n${content}\n`
		})
		.join("\n---\n\n")

	// Add agent-specific instructions
	let instructions = ""
	switch (agentName) {
		case SUBAGENT_CONFIGS.contextAnalyzer.name:
			instructions =
				"Focus on: conversation stages, state transitions, current work status, and overall flow.\n\n"
			break
		case SUBAGENT_CONFIGS.memoryExtractor.name:
			instructions =
				"Focus on: user instructions (verbatim quotes), configuration requirements, technical decisions, and critical constraints.\n\n"
			break
		case SUBAGENT_CONFIGS.codeSummarizer.name:
			instructions =
				"Focus on: modified files, technical concepts, code patterns, dependencies, and technology stack.\n\n"
			break
	}

	return `${instructions}Conversation Messages:\n\n${formattedMessages}`
}

/**
 * Merge results from multiple subagents into a cohesive summary
 */
function mergeSubAgentResults(results: SubAgentResult[]): string {
	const sections: string[] = []

	// Add header
	sections.push("# Conversation Summary (Generated by Subagents)\n")

	// Process each subagent result
	for (const result of results) {
		if (result.success && result.output) {
			// Add agent section with clear separator
			sections.push(`## ${result.agentName}\n`)
			sections.push(result.output)
			sections.push("") // Empty line for separation
		}
	}

	// Add metadata footer
	const totalTokensIn = results.reduce((sum, r) => sum + r.tokensIn, 0)
	const totalTokensOut = results.reduce((sum, r) => sum + r.tokensOut, 0)
	const totalCost = results.reduce((sum, r) => sum + r.cost, 0)

	sections.push("---\n")
	sections.push("## Compression Metadata\n")
	sections.push(`- Total Input Tokens: ${totalTokensIn}`)
	sections.push(`- Total Output Tokens: ${totalTokensOut}`)
	sections.push(`- Total Cost: $${totalCost.toFixed(4)}`)
	sections.push(`- Subagents Used: ${results.filter((r) => r.success).length}/${results.length}`)

	return sections.join("\n")
}

/**
 * Execute subagent-based compression
 *
 * This is the main entry point for subagent compression. It orchestrates
 * calling multiple subagents in sequence and merging their results.
 *
 * @param messages - Conversation messages to compress
 * @param config - Subagent configuration
 * @param task - Parent task instance (needed for subagent creation)
 * @returns Combined compression result
 */
export async function executeSubAgentCompression(
	messages: ApiMessage[],
	config: SubAgentConfig,
	task: Task,
): Promise<SubAgentCompressionResult> {
	const results: SubAgentResult[] = []
	let totalCost = 0

	if (config.verboseLogging) {
		console.log("[SubAgent Compression] Starting compression with config:", config)
	}

	try {
		// Call context analyzer if enabled
		if (config.useContextAnalyzer) {
			if (config.verboseLogging) {
				console.log("[SubAgent Compression] Calling context analyzer...")
			}
			const result = await callSubAgent(SUBAGENT_CONFIGS.contextAnalyzer.name, messages, task)
			results.push(result)
			totalCost += result.cost
		}

		// Call memory extractor if enabled
		if (config.useMemoryExtractor) {
			if (config.verboseLogging) {
				console.log("[SubAgent Compression] Calling memory extractor...")
			}
			const result = await callSubAgent(SUBAGENT_CONFIGS.memoryExtractor.name, messages, task)
			results.push(result)
			totalCost += result.cost
		}

		// Call code summarizer if enabled
		if (config.useCodeSummarizer) {
			if (config.verboseLogging) {
				console.log("[SubAgent Compression] Calling code summarizer...")
			}
			const result = await callSubAgent(SUBAGENT_CONFIGS.codeSummarizer.name, messages, task)
			results.push(result)
			totalCost += result.cost
		}

		// Initialize default results for each subagent
		const analyzerResult: SubAgentResult = results.find(
			(r) => r.agentName === SUBAGENT_CONFIGS.contextAnalyzer.name,
		) || {
			agentName: SUBAGENT_CONFIGS.contextAnalyzer.name,
			output: "",
			tokensIn: 0,
			tokensOut: 0,
			cost: 0,
			success: false,
			error: "Not executed",
		}

		const extractorResult: SubAgentResult = results.find(
			(r) => r.agentName === SUBAGENT_CONFIGS.memoryExtractor.name,
		) || {
			agentName: SUBAGENT_CONFIGS.memoryExtractor.name,
			output: "",
			tokensIn: 0,
			tokensOut: 0,
			cost: 0,
			success: false,
			error: "Not executed",
		}

		const summarizerResult: SubAgentResult = results.find(
			(r) => r.agentName === SUBAGENT_CONFIGS.codeSummarizer.name,
		) || {
			agentName: SUBAGENT_CONFIGS.codeSummarizer.name,
			output: "",
			tokensIn: 0,
			tokensOut: 0,
			cost: 0,
			success: false,
			error: "Not executed",
		}

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

		if (config.verboseLogging) {
			console.log(`[SubAgent Compression] Completed. Total cost: $${totalCost.toFixed(4)}`)
		}

		return {
			analyzerResult,
			extractorResult,
			summarizerResult,
			totalCost,
			success: true,
		}
	} catch (error) {
		const emptyResult: SubAgentResult = {
			agentName: "error",
			output: "",
			tokensIn: 0,
			tokensOut: 0,
			cost: 0,
			success: false,
			error: error instanceof Error ? error.message : String(error),
		}
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
 * Check if subagent compression should be used based on configuration
 */
export function shouldUseSubAgentCompression(config: SubAgentConfig | undefined): boolean {
	if (!config || !config.enabled) {
		return false
	}
	return !!(config.useContextAnalyzer || config.useMemoryExtractor || config.useCodeSummarizer)
}
