/**
 * Code Summarizer Subagent
 * Summarizes code changes and technical implementations
 */

import { SubagentInterface } from "../executor/SubagentInterface"
import { AgentContext, SubagentResult } from "../types"
import { ApiHandler } from "../../../api"
import { maybeRemoveImageBlocks } from "../../../api/transform/image-cleaning"
import { DEFAULT_SUBAGENT_PROMPTS } from "../../../shared/subagent-prompts"

export class CodeSummarizerAgent implements SubagentInterface {
	readonly name = "condense-code-summarizer"
	readonly defaultTask = "Summarize code changes and technical implementations"

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
			// Get focus area if specified
			const focusArea = options?.focusArea || "general"

			// Format messages for summarization
			const messageContext = this.formatMessages(context.messages)

			// Extract code changes if available
			const codeChanges = this.extractCodeChanges(context.messages)

			// Build the user message
			let userMessage = task || this.defaultTask
			userMessage += `\n\nFocus Area: ${focusArea}`

			if (codeChanges.length > 0) {
				userMessage += `\n\nCode Changes Detected: ${codeChanges.length} files`
			}

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
			const stream = this.apiHandler.createMessage(DEFAULT_SUBAGENT_PROMPTS.codeSummarizer, requestMessages, {
				mode: this.name,
				taskId: "subagent-code-summarization",
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
	 * Format messages for summarization
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

	/**
	 * Extract code-related changes from messages
	 */
	private extractCodeChanges(messages: any[]): string[] {
		const codeFiles: string[] = []

		for (const msg of messages) {
			const content = typeof msg.content === "string" ? msg.content : ""

			// Look for file paths or code blocks
			const filePathRegex = /(?:file|path|src).*?\.(?:ts|js|tsx|jsx|py|java|cpp|go|rs)/gi
			const matches = content.match(filePathRegex)

			if (matches) {
				codeFiles.push(...matches)
			}
		}

		return [...new Set(codeFiles)] // Remove duplicates
	}
}
