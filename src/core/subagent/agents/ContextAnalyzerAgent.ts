/**
 * Context Analyzer Subagent
 * Analyzes conversation flow and identifies key stages
 */

import { SubagentInterface } from "../executor/SubagentInterface"
import { AgentContext, SubagentResult, AnalyzerOutput, AnalysisDepth } from "../types"
import { ApiHandler } from "../../../api"
import { maybeRemoveImageBlocks } from "../../../api/transform/image-cleaning"
import { DEFAULT_SUBAGENT_PROMPTS } from "../../../shared/subagent-prompts"
import { HistoricalMessage, AgentSearchResult, ExpertAgent } from "../types-intelligent-context"

export class ContextAnalyzerAgent implements SubagentInterface, ExpertAgent {
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

	/**
	 * 实现ExpertAgent接口：从候选消息中选择相关的
	 * 上下文分析器关注会话流程的转折点和重要阶段
	 */
	async selectRelevantMessages(userMessage: string, candidates: HistoricalMessage[]): Promise<AgentSearchResult> {
		const startTime = Date.now()

		try {
			// 分析用户消息的上下文需求
			const needsHistoricalContext = this.checkHistoricalContextNeed(userMessage)

			if (!needsHistoricalContext || candidates.length === 0) {
				return {
					agentName: this.name,
					selectedIndices: [],
					relevanceScores: new Map(),
					reasoning: "No historical context needed for this query",
					executionTime: Date.now() - startTime,
					success: true,
				}
			}

			// 简单策略：选择最近的消息和包含关键上下文的消息
			const selectedIndices: number[] = []
			const relevanceScores = new Map<number, number>()

			// 1. 选择最近5条消息（保持对话连贯性）
			const recentMessages = candidates.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5)

			for (const msg of recentMessages) {
				selectedIndices.push(msg.messageIndex)
				relevanceScores.set(msg.messageIndex, 0.8) // 最近消息相关性高
			}

			// 2. 选择包含关键词的历史消息
			const keywords = this.extractKeywords(userMessage)
			if (keywords.length > 0) {
				for (const candidate of candidates) {
					if (selectedIndices.includes(candidate.messageIndex)) {
						continue // 已选中
					}

					const content =
						typeof candidate.content === "string"
							? candidate.content
							: candidate.content.map((block: any) => (block.type === "text" ? block.text : "")).join(" ")

					const contentLower = content.toLowerCase()
					let matchScore = 0

					for (const keyword of keywords) {
						if (contentLower.includes(keyword.toLowerCase())) {
							matchScore += 0.2
						}
					}

					if (matchScore > 0.3) {
						selectedIndices.push(candidate.messageIndex)
						relevanceScores.set(candidate.messageIndex, matchScore)
					}
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
				reasoning: `Selected ${finalIndices.length} messages based on recency and keyword matching`,
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
	 * 检查是否需要历史上下文
	 */
	private checkHistoricalContextNeed(userMessage: string): boolean {
		const messageLower = userMessage.toLowerCase()

		// 包含引用过去的关键词
		const referenceKeywords = [
			"earlier",
			"before",
			"previous",
			"last time",
			"remember",
			"mentioned",
			"之前",
			"刚才",
			"上次",
			"记得",
			"提到过",
			"说过",
		]

		return referenceKeywords.some((keyword) => messageLower.includes(keyword))
	}

	/**
	 * 提取关键词
	 */
	private extractKeywords(text: string): string[] {
		// 简单实现：提取长度>3的单词
		const words = text.toLowerCase().match(/\b\w{4,}\b/g) || []

		// 过滤常见停用词
		const stopWords = new Set([
			"this",
			"that",
			"with",
			"from",
			"have",
			"been",
			"were",
			"what",
			"when",
			"where",
			"which",
			"could",
			"would",
			"should",
			"about",
			"there",
			"their",
		])

		return words.filter((word) => !stopWords.has(word)).slice(0, 10)
	}
}
