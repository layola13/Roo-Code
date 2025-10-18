/**
 * JudgeAgent - 上下文裁判Agent
 *
 * 负责分析用户意图、协调多个专家Agent并行执行、汇总结果做出最终决策
 * 基于 docs/user-requirement-intelligent-context-system.md
 */

import { ApiHandler } from "../../../api"
import { maybeRemoveImageBlocks } from "../../../api/transform/image-cleaning"
import {
	HistoricalMessage,
	AgentSearchResult,
	JudgeDecision,
	JudgeAgentInterface,
	ExpertAgent,
	ContextFilterConfig,
} from "../types-intelligent-context"

/**
 * 裁判Agent配置
 */
export interface JudgeAgentConfig {
	/** 专家Agent超时时间（毫秒） */
	agentTimeout: number
	/** 是否启用并行执行 */
	enableParallel: boolean
	/** Token预算总量 */
	totalTokenBudget: number
	/** 为响应保留的token */
	reserveForResponse: number
	/** 是否启用详细日志 */
	verboseLogging: boolean
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: JudgeAgentConfig = {
	agentTimeout: 3000, // 3秒
	enableParallel: true,
	totalTokenBudget: 120000, // 120K tokens
	reserveForResponse: 20000, // 20K for response
	verboseLogging: false,
}

/**
 * 裁判Agent实现
 */
export class JudgeAgent implements JudgeAgentInterface {
	private expertAgents: Map<string, ExpertAgent> = new Map()
	private config: JudgeAgentConfig

	constructor(
		private apiHandler: ApiHandler,
		config?: Partial<JudgeAgentConfig>,
	) {
		this.config = { ...DEFAULT_CONFIG, ...config }
	}

	/**
	 * 注册专家Agent
	 */
	registerExpertAgent(agent: ExpertAgent): void {
		this.expertAgents.set(agent.name, agent)
		if (this.config.verboseLogging) {
			console.log(`[JudgeAgent] Registered expert: ${agent.name}`)
		}
	}

	/**
	 * 分析用户消息，返回裁判决策
	 */
	async analyze(userMessage: string, context: { messages: HistoricalMessage[] }): Promise<JudgeDecision> {
		const startTime = Date.now()

		// 步骤1: 分析用户意图
		const intentAnalysis = await this.analyzeIntent(userMessage)

		if (this.config.verboseLogging) {
			console.log("[JudgeAgent] Intent analysis:", intentAnalysis)
		}

		// 步骤2: 从候选消息中筛选（这里使用所有历史消息作为候选）
		const candidateMessages = context.messages

		// 步骤3: 并行执行专家Agent
		const agentResults = await this.executeAgentsInParallel(userMessage, candidateMessages)

		if (this.config.verboseLogging) {
			console.log(`[JudgeAgent] Received ${agentResults.length} agent results`)
		}

		// 步骤4: 合并去重
		const mergeResult = this.mergeAndDeduplicate(agentResults)

		// 步骤5: 计算Token分配
		const selectedMessages = candidateMessages.filter((msg) => mergeResult.finalIndices.includes(msg.messageIndex))
		const allocatedTokens = selectedMessages.reduce((sum, msg) => sum + msg.tokens, 0)

		const totalExecutionTime = Date.now() - startTime

		// 构建裁判决策
		const decision: JudgeDecision = {
			intent: intentAnalysis.intent,
			domains: intentAnalysis.domains,
			timeScope: intentAnalysis.timeScope,
			confidence: intentAnalysis.confidence,
			agentResults,
			selectedIndices: mergeResult.finalIndices,
			duplicateIndices: mergeResult.duplicates,
			totalTokenBudget: this.config.totalTokenBudget,
			allocatedTokens,
			reservedForResponse: this.config.reserveForResponse,
			totalExecutionTime,
			timestamp: Date.now(),
		}

		// 检测冲突（如果有）
		if (this.hasConflicts(agentResults)) {
			decision.conflictResolution = this.resolveConflicts(agentResults, mergeResult.finalIndices)
		}

		return decision
	}

	/**
	 * 分析用户意图
	 */
	private async analyzeIntent(userMessage: string): Promise<{
		intent: string
		domains: string[]
		timeScope: string
		confidence: number
	}> {
		try {
			// 使用LLM快速分析用户意图
			const systemPrompt = `You are an intent analyzer. Analyze the user's message and identify:
1. Intent (problem_solving, information_query, continue_conversation, code_modification, etc.)
2. Domains (technical, product, documentation, debugging, etc.)
3. Time scope (recent_7_days, last_session, all_history, current_session)

Respond with a JSON object only.`

			const requestMessages = maybeRemoveImageBlocks(
				[
					{
						role: "user" as const,
						content: `Analyze this message:\n\n${userMessage}\n\nRespond with JSON: {"intent": "...", "domains": ["..."], "timeScope": "...", "confidence": 0.0-1.0}`,
					},
				],
				this.apiHandler,
			).map(({ role, content }) => ({ role, content }))

			const stream = this.apiHandler.createMessage(systemPrompt, requestMessages, {
				mode: "judge-intent-analysis",
				taskId: "judge-intent",
			})

			let output = ""
			for await (const chunk of stream) {
				if (chunk.type === "text") {
					output += chunk.text
				}
			}

			// 解析JSON响应
			const jsonMatch = output.match(/\{[\s\S]*\}/)
			if (jsonMatch) {
				const parsed = JSON.parse(jsonMatch[0])
				return {
					intent: parsed.intent || "general_query",
					domains: Array.isArray(parsed.domains) ? parsed.domains : ["general"],
					timeScope: parsed.timeScope || "recent_7_days",
					confidence: parsed.confidence || 0.7,
				}
			}
		} catch (error) {
			console.warn("[JudgeAgent] Intent analysis failed, using fallback:", error)
		}

		// 降级：使用简单关键词匹配
		return this.fallbackIntentAnalysis(userMessage)
	}

	/**
	 * 降级的意图分析（关键词匹配）
	 */
	private fallbackIntentAnalysis(userMessage: string): {
		intent: string
		domains: string[]
		timeScope: string
		confidence: number
	} {
		const messageLower = userMessage.toLowerCase()
		const domains: string[] = []
		let intent = "general_query"
		let timeScope = "recent_7_days"

		// 检测领域
		if (messageLower.match(/\b(error|bug|issue|problem|fix|debug)\b/)) {
			domains.push("debugging")
			intent = "problem_solving"
		}
		if (messageLower.match(/\b(code|function|class|implement|refactor)\b/)) {
			domains.push("code")
			intent = "code_modification"
		}
		if (messageLower.match(/\b(api|endpoint|request|response|http)\b/)) {
			domains.push("api")
		}
		if (messageLower.match(/\b(database|sql|query|table|migration)\b/)) {
			domains.push("database")
		}
		if (messageLower.match(/\b(how|what|why|explain|show|tell)\b/)) {
			intent = "information_query"
		}

		// 检测时间范围
		if (messageLower.match(/\b(earlier|before|previous|last time)\b/)) {
			timeScope = "last_session"
		}
		if (messageLower.match(/\b(all|entire|whole|complete)\b/)) {
			timeScope = "all_history"
		}

		if (domains.length === 0) {
			domains.push("general")
		}

		return {
			intent,
			domains,
			timeScope,
			confidence: 0.6, // 降级方法置信度较低
		}
	}

	/**
	 * 并行执行多个专家Agent
	 */
	async executeAgentsInParallel(
		userMessage: string,
		candidateMessages: HistoricalMessage[],
	): Promise<AgentSearchResult[]> {
		if (this.expertAgents.size === 0) {
			console.warn("[JudgeAgent] No expert agents registered")
			return []
		}

		const agents = Array.from(this.expertAgents.values())

		if (this.config.enableParallel) {
			// 并行执行所有Agent，使用Promise.allSettled容错
			const promises = agents.map((agent) => this.executeAgentWithTimeout(agent, userMessage, candidateMessages))

			const results = await Promise.allSettled(promises)

			return results
				.filter((result): result is PromiseFulfilledResult<AgentSearchResult> => result.status === "fulfilled")
				.map((result) => result.value)
		} else {
			// 串行执行
			const results: AgentSearchResult[] = []
			for (const agent of agents) {
				try {
					const result = await this.executeAgentWithTimeout(agent, userMessage, candidateMessages)
					results.push(result)
				} catch (error) {
					console.error(`[JudgeAgent] Agent ${agent.name} failed:`, error)
				}
			}
			return results
		}
	}

	/**
	 * 带超时执行单个Agent
	 */
	private async executeAgentWithTimeout(
		agent: ExpertAgent,
		userMessage: string,
		candidates: HistoricalMessage[],
	): Promise<AgentSearchResult> {
		const startTime = Date.now()

		try {
			const timeoutPromise = new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error("Agent timeout")), this.config.agentTimeout),
			)

			const resultPromise = agent.selectRelevantMessages(userMessage, candidates)

			const result = await Promise.race([resultPromise, timeoutPromise])
			const executionTime = Date.now() - startTime

			return {
				...result,
				executionTime,
			}
		} catch (error) {
			const executionTime = Date.now() - startTime
			console.error(`[JudgeAgent] Agent ${agent.name} failed:`, error)

			return {
				agentName: agent.name,
				selectedIndices: [],
				relevanceScores: new Map(),
				reasoning: `Failed: ${error instanceof Error ? error.message : String(error)}`,
				executionTime,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	/**
	 * 合并去重各Agent结果
	 */
	mergeAndDeduplicate(results: AgentSearchResult[]): {
		finalIndices: number[]
		duplicates: Map<number, string[]>
	} {
		const indexToAgents = new Map<number, string[]>()

		// 收集所有索引及其来源Agent
		for (const result of results) {
			if (!result.success) {
				continue
			}

			for (const index of result.selectedIndices) {
				if (!indexToAgents.has(index)) {
					indexToAgents.set(index, [])
				}
				indexToAgents.get(index)!.push(result.agentName)
			}
		}

		// 分离单选和多选
		const finalIndices: number[] = []
		const duplicates = new Map<number, string[]>()

		for (const [index, agents] of indexToAgents.entries()) {
			finalIndices.push(index)
			if (agents.length > 1) {
				duplicates.set(index, agents)
			}
		}

		// 按索引号排序（保持时间顺序）
		finalIndices.sort((a, b) => a - b)

		if (this.config.verboseLogging) {
			console.log(`[JudgeAgent] Merged ${finalIndices.length} unique indices`)
			console.log(`[JudgeAgent] Found ${duplicates.size} duplicates`)
		}

		return { finalIndices, duplicates }
	}

	/**
	 * 检测是否存在冲突
	 */
	private hasConflicts(results: AgentSearchResult[]): boolean {
		// 简单实现：如果某个Agent选择的消息与其他Agent完全不重叠，可能存在冲突
		if (results.length < 2) {
			return false
		}

		const successResults = results.filter((r) => r.success)
		if (successResults.length < 2) {
			return false
		}

		// 检查是否有Agent的选择与其他完全不同
		for (let i = 0; i < successResults.length; i++) {
			const indicesI = new Set(successResults[i].selectedIndices)
			let hasOverlap = false

			for (let j = 0; j < successResults.length; j++) {
				if (i === j) continue

				const indicesJ = new Set(successResults[j].selectedIndices)
				const overlap = [...indicesI].filter((idx) => indicesJ.has(idx))

				if (overlap.length > 0) {
					hasOverlap = true
					break
				}
			}

			if (!hasOverlap && indicesI.size > 0) {
				return true // 发现完全不重叠的Agent
			}
		}

		return false
	}

	/**
	 * 解决冲突
	 */
	private resolveConflicts(
		results: AgentSearchResult[],
		finalIndices: number[],
	): {
		conflictedIndices: number[]
		resolution: string
	} {
		// 识别冲突的索引（被某些Agent选中但不被其他Agent选中）
		const allIndices = new Set<number>()
		const agentSelections: Map<string, Set<number>> = new Map()

		for (const result of results) {
			if (!result.success) continue

			const indices = new Set(result.selectedIndices)
			agentSelections.set(result.agentName, indices)

			for (const idx of indices) {
				allIndices.add(idx)
			}
		}

		const conflictedIndices: number[] = []
		for (const idx of allIndices) {
			let selectedByCount = 0
			for (const indices of agentSelections.values()) {
				if (indices.has(idx)) {
					selectedByCount++
				}
			}

			// 如果只被少数Agent选中，标记为有争议
			if (selectedByCount === 1 && agentSelections.size > 2) {
				conflictedIndices.push(idx)
			}
		}

		const resolution =
			conflictedIndices.length > 0
				? `Detected ${conflictedIndices.length} conflicted messages. Included all based on at least one agent's selection.`
				: "No significant conflicts detected."

		return { conflictedIndices, resolution }
	}

	/**
	 * 获取注册的专家Agent数量
	 */
	getExpertAgentCount(): number {
		return this.expertAgents.size
	}

	/**
	 * 获取所有注册的专家Agent名称
	 */
	getExpertAgentNames(): string[] {
		return Array.from(this.expertAgents.keys())
	}
}
