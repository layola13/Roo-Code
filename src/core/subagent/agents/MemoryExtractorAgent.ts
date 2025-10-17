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

export class MemoryExtractorAgent implements SubagentInterface {
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
}
