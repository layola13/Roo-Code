/**
 * Subagent Factory
 * Manages and provides access to all subagents
 */

import { ApiHandler } from "../../../api"
import { SubagentInterface } from "../executor/SubagentInterface"
import { ContextAnalyzerAgent } from "./ContextAnalyzerAgent"
import { MemoryExtractorAgent } from "./MemoryExtractorAgent"
import { CodeSummarizerAgent } from "./CodeSummarizerAgent"
import { SubagentName } from "../types"

export class SubagentFactory {
	private static agents: Map<SubagentName, SubagentInterface> = new Map()

	/**
	 * Initialize all subagents
	 */
	static initialize(apiHandler: ApiHandler): void {
		this.agents.clear()

		// Register all subagents
		const contextAnalyzer = new ContextAnalyzerAgent(apiHandler)
		const memoryExtractor = new MemoryExtractorAgent(apiHandler)
		const codeSummarizer = new CodeSummarizerAgent(apiHandler)

		this.agents.set("condense-context-analyzer", contextAnalyzer)
		this.agents.set("condense-memory-extractor", memoryExtractor)
		this.agents.set("condense-code-summarizer", codeSummarizer)
	}

	/**
	 * Get a subagent by name
	 */
	static getAgent(name: SubagentName): SubagentInterface | undefined {
		return this.agents.get(name)
	}

	/**
	 * Get all registered subagents
	 */
	static getAllAgents(): Map<SubagentName, SubagentInterface> {
		return this.agents
	}

	/**
	 * Check if a subagent is registered
	 */
	static hasAgent(name: SubagentName): boolean {
		return this.agents.has(name)
	}
}

// Export agent classes
export { ContextAnalyzerAgent } from "./ContextAnalyzerAgent"
export { MemoryExtractorAgent } from "./MemoryExtractorAgent"
export { CodeSummarizerAgent } from "./CodeSummarizerAgent"
