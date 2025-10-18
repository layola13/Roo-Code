/**
 * Memory Extractor Subagent
 * Extracts and preserves critical information, decisions, and requirements
 */

import { SubagentInterface } from "../executor/SubagentInterface"
import { AgentContext, SubagentResult, MemoryCategory } from "../types"
import { ApiHandler } from "../../../api"
import { maybeRemoveImageBlocks } from "../../../api/transform/image-cleaning"
import { DEFAULT_SUBAGENT_PROMPTS } from "../../../shared/subagent-prompts"
import { VectorMemoryStore } from "../../memory/VectorMemoryStore"
import { MemoryEntry, MemoryType, MemoryPriority } from "../../memory/ConversationMemory"
import { HistoricalMessage, AgentSearchResult, ExpertAgent } from "../types-intelligent-context"

export class MemoryExtractorAgent implements SubagentInterface, ExpertAgent {
	readonly name = "condense-memory-extractor"
	readonly defaultTask = "Extract critical information, decisions, and requirements from the conversation"

	constructor(
		private apiHandler: ApiHandler,
		private vectorMemoryStore?: VectorMemoryStore,
	) {}

	async run(params: {
		context: AgentContext
		task: string
		userContext?: string
		options?: Record<string, any>
	}): Promise<SubagentResult> {
		const startTime = Date.now()
		const { context, task, userContext, options } = params

		try {
			// Get focus categories if specified
			const focusCategories: MemoryCategory[] = options?.categories || [
				"decision",
				"requirement",
				"technical",
				"constraint",
			]

			// Format messages for extraction
			const messageContext = this.formatMessages(context.messages)

			// Build the user message
			let userMessage = task || this.defaultTask
			userMessage += `\n\nFocus Categories: ${focusCategories.join(", ")}`
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
			const stream = this.apiHandler.createMessage(DEFAULT_SUBAGENT_PROMPTS.memoryExtractor, requestMessages, {
				mode: this.name,
				taskId: "subagent-memory-extraction",
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

			// ✅ 核心修复：解析LLM输出并存储到VectorMemoryStore
			if (this.vectorMemoryStore && output.trim().length > 0) {
				try {
					const memories = this.parseMemoriesFromOutput(output)
					if (memories.length > 0) {
						// 传递taskId以便跨对话记忆管理
						const taskId = (context as any).taskId || undefined
						await this.vectorMemoryStore.storeMemories(memories, taskId)

						if (options?.verboseLogging) {
							console.log(`[MemoryExtractorAgent] Stored ${memories.length} memories to vector database`)
						}
					}
				} catch (error) {
					// 记录错误但不影响agent执行结果
					console.error("[MemoryExtractorAgent] Failed to store memories:", error)
				}
			}

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
	 * Format messages for extraction
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
	 * Parse LLM output into structured MemoryEntry objects
	 * Expected format from LLM:
	 * ```json
	 * {
	 *   "critical_items": [
	 *     {"category": "decision", "content": "...", "importance": "high", "context": "..."},
	 *     ...
	 *   ]
	 * }
	 * ```
	 */
	private parseMemoriesFromOutput(output: string): MemoryEntry[] {
		const memories: MemoryEntry[] = []
		const now = Date.now()

		try {
			// Try to extract JSON from markdown code blocks
			const jsonMatch = output.match(/```(?:json)?\s*\n([\s\S]*?)\n```/)
			const jsonStr = jsonMatch ? jsonMatch[1] : output

			const parsed = JSON.parse(jsonStr)

			if (parsed.critical_items && Array.isArray(parsed.critical_items)) {
				for (const item of parsed.critical_items) {
					// Map category to MemoryType
					const type = this.mapCategoryToType(item.category)
					// Map importance to MemoryPriority
					const priority = this.mapImportanceToPriority(item.importance)

					const memory: MemoryEntry = {
						id: `memory-${now}-${Math.random().toString(36).substr(2, 9)}`,
						type,
						priority,
						content: item.content || "",
						createdAt: now,
						lastAccessedAt: now,
						accessCount: 0,
						tags: item.tags || [],
					}

					// Add context as additional metadata if available
					if (item.context) {
						memory.relatedFiles = this.extractFilePathsFromContext(item.context)
						memory.relatedTech = this.extractTechStackFromContext(item.context)
					}

					memories.push(memory)
				}
			}
		} catch (error) {
			// Fallback: treat entire output as a single memory
			console.warn("[MemoryExtractorAgent] Failed to parse structured output, using fallback:", error)

			memories.push({
				id: `memory-${now}-${Math.random().toString(36).substr(2, 9)}`,
				type: MemoryType.PROJECT_CONTEXT,
				priority: MemoryPriority.MEDIUM,
				content: output.substring(0, 500), // Limit to 500 chars
				createdAt: now,
				lastAccessedAt: now,
				accessCount: 0,
			})
		}

		return memories
	}

	/**
	 * Map LLM category to MemoryType
	 */
	private mapCategoryToType(category: string): MemoryType {
		const categoryLower = (category || "").toLowerCase()

		if (categoryLower.includes("decision")) return MemoryType.TECHNICAL_DECISION
		if (categoryLower.includes("requirement")) return MemoryType.USER_INSTRUCTION
		if (categoryLower.includes("technical")) return MemoryType.TECHNICAL_DECISION
		if (categoryLower.includes("constraint")) return MemoryType.CONFIGURATION
		if (categoryLower.includes("error") || categoryLower.includes("issue")) return MemoryType.IMPORTANT_ERROR
		if (categoryLower.includes("workflow") || categoryLower.includes("pattern")) return MemoryType.WORKFLOW_PATTERN

		return MemoryType.PROJECT_CONTEXT
	}

	/**
	 * Map importance level to MemoryPriority
	 */
	private mapImportanceToPriority(importance: string): MemoryPriority {
		const importanceLower = (importance || "").toLowerCase()

		if (importanceLower === "critical") return MemoryPriority.CRITICAL
		if (importanceLower === "high") return MemoryPriority.HIGH
		if (importanceLower === "medium") return MemoryPriority.MEDIUM
		if (importanceLower === "low") return MemoryPriority.LOW

		return MemoryPriority.MEDIUM
	}

	/**
	 * Extract file paths from context string
	 */
	private extractFilePathsFromContext(context: string): string[] {
		const filePattern = /(?:\.?\.?\/)?[\w\-\/\\\.]+\.\w+/g
		const matches = context.match(filePattern)
		return matches ? [...new Set(matches)] : []
	}

	/**
	 * Extract tech stack from context string
	 */
	private extractTechStackFromContext(context: string): string[] {
		const techPattern =
			/\b(react|vue|angular|express|fastapi|django|postgresql|mongodb|redis|jwt|oauth|graphql|rest|typescript|javascript|python|java|go|rust|docker|kubernetes)\b/gi
		const matches = context.match(techPattern)
		return matches ? [...new Set(matches.map((m) => m.toLowerCase()))] : []
	}

	/**
	 * 实现ExpertAgent接口：从候选消息中选择相关的
	 * 记忆提取器关注包含决策、需求和关键信息的消息
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

			// 检测决策和需求相关的关键词
			const decisionKeywords = [
				"decide",
				"decision",
				"require",
				"must",
				"should",
				"need",
				"important",
				"critical",
				"remember",
				"note",
				"configure",
				"决定",
				"需求",
				"必须",
				"应该",
				"重要",
				"关键",
				"记住",
				"注意",
				"配置",
			]

			const userLower = userMessage.toLowerCase()
			const userHasDecisionContext = decisionKeywords.some((kw) => userLower.includes(kw))

			for (const candidate of candidates) {
				const content =
					typeof candidate.content === "string"
						? candidate.content
						: candidate.content.map((block: any) => (block.type === "text" ? block.text : "")).join(" ")

				const contentLower = content.toLowerCase()
				let score = 0

				// 1. 用户消息包含关键词
				if (candidate.role === "user") {
					for (const keyword of decisionKeywords) {
						if (contentLower.includes(keyword)) {
							score += 0.3
							break
						}
					}
				}

				// 2. 包含配置信息
				if (contentLower.match(/\b(config|setup|install|port|url|api[_\s]?key)\b/)) {
					score += 0.2
				}

				// 3. 包含技术决策
				if (contentLower.match(/\b(use|using|implement|adopt|choose|select)\b/)) {
					score += 0.15
				}

				// 4. 包含错误或问题（重要上下文）
				if (contentLower.match(/\b(error|issue|problem|bug|fail)\b/)) {
					score += 0.15
				}

				// 5. 简短的用户指令（通常很重要）
				if (candidate.role === "user" && content.length < 200 && content.length > 20) {
					score += 0.1
				}

				// 6. 如果用户当前消息有决策上下文，优先选择助手的相关回复
				if (userHasDecisionContext && candidate.role === "assistant") {
					score += 0.1
				}

				// 如果分数足够高，选中这条消息
				if (score >= 0.3) {
					selectedIndices.push(candidate.messageIndex)
					relevanceScores.set(candidate.messageIndex, Math.min(score, 1.0))
				}
			}

			// 如果选中的消息太少，添加最近的几条
			if (selectedIndices.length < 3) {
				const recentMessages = candidates.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5)

				for (const msg of recentMessages) {
					if (!selectedIndices.includes(msg.messageIndex)) {
						selectedIndices.push(msg.messageIndex)
						relevanceScores.set(msg.messageIndex, 0.5)
					}
				}
			}

			// 限制最多20条消息
			const finalIndices = selectedIndices.slice(0, 20)
			const finalScores = new Map<number, number>()
			for (const idx of finalIndices) {
				finalScores.set(idx, relevanceScores.get(idx) || 0.5)
			}

			return {
				agentName: this.name,
				selectedIndices: finalIndices,
				relevanceScores: finalScores,
				reasoning: `Selected ${finalIndices.length} messages containing decisions, requirements, and critical information`,
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
}
