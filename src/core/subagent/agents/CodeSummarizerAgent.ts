/**
 * Code Summarizer Subagent
 * Summarizes code changes and technical implementations
 */

import { SubagentInterface } from "../executor/SubagentInterface"
import { AgentContext, SubagentResult } from "../types"
import { ApiHandler } from "../../../api"
import { maybeRemoveImageBlocks } from "../../../api/transform/image-cleaning"
import { DEFAULT_SUBAGENT_PROMPTS } from "../../../shared/subagent-prompts"
import { HistoricalMessage, AgentSearchResult, ExpertAgent } from "../types-intelligent-context"

export class CodeSummarizerAgent implements SubagentInterface, ExpertAgent {
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

	/**
	 * 实现ExpertAgent接口：从候选消息中选择相关的
	 * 代码总结器关注包含代码变更、技术实现和文件操作的消息
	 */
	async selectRelevantMessages(userMessage: string, candidates: HistoricalMessage[]): Promise<AgentSearchResult> {
		const startTime = Date.now()

		try {
			const selectedIndices: number[] = []
			const relevanceScores = new Map<number, number>()

			if (candidates.length === 0) {
				return {
					agentName: this.name,
					selectedIndices: [],
					relevanceScores: new Map(),
					reasoning: "No candidate messages available",
					executionTime: Date.now() - startTime,
					success: true,
				}
			}

			// 检查用户消息是否与代码相关
			const userHasCodeContext = this.hasCodeContext(userMessage)

			for (const candidate of candidates) {
				const content =
					typeof candidate.content === "string"
						? candidate.content
						: candidate.content.map((block: any) => (block.type === "text" ? block.text : "")).join(" ")

				const contentLower = content.toLowerCase()
				let score = 0

				// 1. 包含文件路径或代码块
				if (content.match(/```/) || content.match(/`[^`]+`/)) {
					score += 0.4 // 代码块权重高
				}

				// 2. 包含文件路径
				const filePathPattern = /(?:\.?\.?\/)?[\w\-\/\\\.]+\.(ts|js|tsx|jsx|py|java|cpp|go|rs|json|yaml|yml)/gi
				if (content.match(filePathPattern)) {
					score += 0.3
				}

				// 3. 包含技术术语
				const techTerms = [
					"function",
					"class",
					"interface",
					"component",
					"module",
					"import",
					"export",
					"async",
					"await",
					"promise",
					"api",
					"endpoint",
					"route",
					"controller",
					"service",
					"database",
					"query",
					"schema",
					"migration",
					"test",
					"mock",
					"assert",
					"expect",
				]
				let techTermCount = 0
				for (const term of techTerms) {
					if (contentLower.includes(term)) {
						techTermCount++
					}
				}
				score += Math.min(techTermCount * 0.05, 0.2)

				// 4. 包含代码操作动词
				const codeActions = [
					"implement",
					"refactor",
					"fix",
					"create",
					"update",
					"delete",
					"add",
					"remove",
					"modify",
					"change",
					"improve",
				]
				for (const action of codeActions) {
					if (contentLower.includes(action)) {
						score += 0.1
						break
					}
				}

				// 5. 助手回复中的代码说明
				if (candidate.role === "assistant" && content.length > 200) {
					if (content.includes("```") || content.match(/\b(here|this|that)\s+(is|are)\s+the/i)) {
						score += 0.15
					}
				}

				// 6. 如果用户当前问题与代码相关，优先选择包含代码的历史
				if (userHasCodeContext && (content.includes("```") || content.match(filePathPattern))) {
					score += 0.15
				}

				// 如果分数足够高，选中这条消息
				if (score >= 0.3) {
					selectedIndices.push(candidate.messageIndex)
					relevanceScores.set(candidate.messageIndex, Math.min(score, 1.0))
				}
			}

			// 如果没有选中任何消息，但用户问题与代码相关，选择最近的几条
			if (selectedIndices.length === 0 && userHasCodeContext) {
				const recentMessages = candidates.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5)

				for (const msg of recentMessages) {
					selectedIndices.push(msg.messageIndex)
					relevanceScores.set(msg.messageIndex, 0.4)
				}
			}

			// 限制最多15条消息
			const finalIndices = selectedIndices.slice(0, 15)
			const finalScores = new Map<number, number>()
			for (const idx of finalIndices) {
				finalScores.set(idx, relevanceScores.get(idx) || 0.5)
			}

			return {
				agentName: this.name,
				selectedIndices: finalIndices,
				relevanceScores: finalScores,
				reasoning: `Selected ${finalIndices.length} messages containing code changes and technical implementations`,
				executionTime: Date.now() - startTime,
				success: true,
			}
		} catch (error) {
			return {
				agentName: this.name,
				selectedIndices: [],
				relevanceScores: new Map(),
				reasoning: `Error: ${error instanceof Error ? error.message : String(error)}`,
				executionTime: Date.now() - startTime,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	/**
	 * 检查消息是否包含代码上下文
	 */
	private hasCodeContext(message: string): boolean {
		const codeIndicators = [
			"code",
			"function",
			"class",
			"implement",
			"refactor",
			"bug",
			"error",
			"file",
			"component",
			"module",
			"api",
			"代码",
			"函数",
			"类",
			"实现",
			"文件",
		]

		const messageLower = message.toLowerCase()
		return codeIndicators.some((indicator) => messageLower.includes(indicator))
	}
}
