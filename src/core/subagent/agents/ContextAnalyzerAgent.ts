/**
 * Context Analyzer Subagent
 * Analyzes conversation flow and identifies key stages
 */

import { SubagentInterface } from "../executor/SubagentInterface"
import { AgentContext, SubagentResult, AnalyzerOutput, AnalysisDepth } from "../types"
import { ApiHandler } from "../../../api"
import { maybeRemoveImageBlocks } from "../../../api/transform/image-cleaning"
import { DEFAULT_SUBAGENT_PROMPTS } from "../../../shared/subagent-prompts"

export class ContextAnalyzerAgent implements SubagentInterface {
	readonly name = "condense-context-analyzer"
	readonly defaultTask = "Analyze conversation flow and identify key stages"

	constructor(private apiHandler: ApiHandler) {}

	async run(params: {
		context: AgentContext
		task: string
		userContext?: string
		options?: Record<string, any>
	}): Promise<SubagentResult> {
		const startTime = Date.now()
		const { context, task, userContext, options } = params

		try {
			// Prepare analysis depth
			const depth: AnalysisDepth = options?.depth || "quick"

			// Format messages for analysis
			const messageContext = this.formatMessages(context.messages)

			// Build the user message
			let userMessage = task || this.defaultTask
			userMessage += `\n\nAnalysis Depth: ${depth}`
			userMessage += `\n\n${messageContext}`

			if (userContext) {
				userMessage += `\n\nAdditional Context: ${userContext}`
			}

			// Prepare API request
			const requestMessages = maybeRemoveImageBlocks(
				[
					{
						role: "user" as const,
						content: userMessage,
					},
				],
				this.apiHandler,
			).map(({ role, content }) => ({ role, content }))

			// Call API
			const stream = this.apiHandler.createMessage(DEFAULT_SUBAGENT_PROMPTS.contextAnalyzer, requestMessages, {
				mode: this.name,
				taskId: "subagent-context-analysis",
			})

			let output = ""
			let inputTokens = 0
			let outputTokens = 0

			// Process stream
			for await (const chunk of stream) {
				if (chunk.type === "text") {
					output += chunk.text
				} else if (chunk.type === "usage") {
					inputTokens += chunk.inputTokens || 0
					outputTokens += chunk.outputTokens || 0
				}
			}

			const executionTime = Date.now() - startTime

			return {
				agentName: this.name,
				output: output.trim(),
				tokensUsed: inputTokens + outputTokens,
				executionTime,
				success: output.trim().length > 0,
			}
		} catch (error) {
			return {
				agentName: this.name,
				output: "",
				tokensUsed: 0,
				executionTime: Date.now() - startTime,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	/**
	 * Format messages for analysis
	 */
	private formatMessages(messages: any[]): string {
		const formatted = messages
			.map((msg, index) => {
				const role = msg.role === "user" ? "User" : "Assistant"
				const content =
					typeof msg.content === "string"
						? msg.content
						: msg.content
								?.map((block: any) => (block.type === "text" ? block.text : "[non-text content]"))
								.join("\n")

				return `[Message ${index + 1}] ${role}:\n${content}`
			})
			.join("\n\n---\n\n")

		return `Conversation Messages:\n\n${formatted}`
	}
}
