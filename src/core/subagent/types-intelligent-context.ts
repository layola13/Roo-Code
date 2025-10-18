/**
 * Intelligent Context System Types
 *
 * 定义智能上下文筛选系统的核心数据结构
 * 基于 docs/user-requirement-intelligent-context-system.md
 */

export interface HistoricalMessage {
	// 全局唯一索引号
	messageIndex: number // 例如: 1, 2, 3, ...
	globalId: string // 例如: "msg#1", "msg#2", ...

	// 消息内容
	role: "user" | "assistant"
	content: string | Array<{ type: string; [key: string]: any }>
	timestamp: number

	// 元数据
	conversationId: string
	tokens: number
	summary?: string // 消息摘要（用于快速检索）

	// 向量检索相关
	embeddingId?: string // 向量数据库中的ID
	similarityScore?: number // 语义相似度分数
}

/**
 * Agent检索结果
 * 每个Agent返回它认为相关的消息索引号列表
 */
export interface AgentSearchResult {
	agentName: string // Agent名称
	selectedIndices: number[] // 选中的消息索引号: [5, 12, 18]
	relevanceScores: Map<number, number> // 每个索引的相关性分数
	reasoning: string // 选择理由
	executionTime: number // 执行耗时(ms)
	success: boolean // 是否执行成功
	error?: string // 错误信息（如果失败）
}

/**
 * 裁判分析决策
 * 裁判汇总各Agent结果后做出最终决策
 */
export interface JudgeDecision {
	// 裁判分析
	intent: string // 用户意图: "问题解决", "信息查询", "延续对话"
	domains: string[] // 涉及领域: ["技术", "产品", "账单"]
	timeScope: string // 时间范围: "最近7天", "上次会话", "全部历史"
	confidence: number // 置信度 0-1

	// Agent对比结果
	agentResults: AgentSearchResult[] // 各Agent返回结果

	// 最终决策
	selectedIndices: number[] // 去重后的索引号列表: [5, 12, 18, 20, 25]
	duplicateIndices: Map<number, string[]> // 被多个Agent选中的消息: {12: ['tech-agent', 'product-agent']}
	conflictResolution?: {
		// 冲突处理（如果有）
		conflictedIndices: number[]
		resolution: string
	}

	// Token预算
	totalTokenBudget: number // 总可用token
	allocatedTokens: number // 实际分配token
	reservedForResponse: number // 为回复保留的token

	// 执行统计
	totalExecutionTime: number // 总耗时(ms)
	timestamp: number // 决策时间戳
}

/**
 * 消息索引管理器接口
 */
export interface MessageIndexManager {
	/**
	 * 为新消息分配索引号
	 */
	assignIndex(conversationId: string): number

	/**
	 * 根据索引号获取消息
	 */
	getMessageByIndex(index: number): HistoricalMessage | undefined

	/**
	 * 根据索引号列表批量获取消息
	 */
	getMessagesByIndices(indices: number[]): HistoricalMessage[]

	/**
	 * 获取当前最大索引号
	 */
	getCurrentMaxIndex(): number

	/**
	 * 重置索引计数器（谨慎使用）
	 */
	reset(): void
}

/**
 * 专家Agent统一接口
 */
export interface ExpertAgent {
	name: string

	/**
	 * 从候选消息中选择相关的
	 * @param userMessage 用户当前问题
	 * @param candidates 候选历史消息
	 * @returns 选中的消息索引号 + 相关性分数
	 */
	selectRelevantMessages(userMessage: string, candidates: HistoricalMessage[]): Promise<AgentSearchResult>
}

/**
 * 裁判Agent接口
 */
export interface JudgeAgentInterface {
	/**
	 * 分析用户消息，返回裁判决策
	 */
	analyze(userMessage: string, context: { messages: HistoricalMessage[] }): Promise<JudgeDecision>

	/**
	 * 并行调用多个专家Agent
	 */
	executeAgentsInParallel(userMessage: string, candidateMessages: HistoricalMessage[]): Promise<AgentSearchResult[]>

	/**
	 * 对比合并各Agent结果
	 */
	mergeAndDeduplicate(results: AgentSearchResult[]): {
		finalIndices: number[]
		duplicates: Map<number, string[]> // 哪些消息被多个Agent选中
	}
}

/**
 * 向量检索结果
 */
export interface VectorSearchResult {
	message: HistoricalMessage
	similarityScore: number // 0-1之间的相似度分数
	distance?: number // 向量距离（可选）
}

/**
 * Token预算分配策略
 */
export interface TokenBudgetAllocation {
	agent: string
	allocatedTokens: number
	priority: number // 1-10，优先级
	reasoning: string
}

/**
 * 上下文筛选配置
 */
export interface ContextFilterConfig {
	// 向量检索配置
	vectorSearch: {
		enabled: boolean
		topK: number // 召回候选数量
		similarityThreshold: number // 相似度阈值
	}

	// Agent配置
	agents: {
		enabled: string[] // 启用的Agent列表
		parallel: boolean // 是否并行执行
		timeout: number // 超时时间(ms)
	}

	// Token预算配置
	tokenBudget: {
		total: number // 总预算
		reserveForResponse: number // 为回复保留的token
		minPerMessage: number // 每条消息最小token
	}

	// 去重配置
	deduplication: {
		enabled: boolean
		preferMultipleAgentSelection: boolean // 优先选择被多个Agent选中的消息
	}
}
