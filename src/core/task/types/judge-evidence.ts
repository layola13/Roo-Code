/**
 * 裁判证据缓存类型定义
 * Judge Evidence Pre-collection Types
 *
 * 用于在Task生命周期中持续收集裁判所需的证据材料，
 * 优化invokeJudge时的查询性能
 */

/**
 * 裁判证据缓存主结构
 */
export interface JudgeEvidenceCache {
	/** 用户需求历史 */
	userRequirements: UserRequirement[]
	/** 代码变更摘要 */
	codeChanges: CodeChangeSummary[]
	/** 工具调用历史 */
	toolCalls: ToolCallRecord[]
	/** 检查点快照 */
	checkpoints: TaskCheckpoint[]
	/** 最后更新时间戳 */
	lastUpdated: number
}

/**
 * 用户需求记录
 */
export interface UserRequirement {
	/** 时间戳 */
	timestamp: number
	/** 需求内容 */
	requirement: string
	/** 优先级 */
	priority: "high" | "medium" | "low"
	/** 需求来源 */
	source: "user_message" | "feedback" | "context_switch"
}

/**
 * 代码变更摘要
 */
export interface CodeChangeSummary {
	/** 时间戳 */
	timestamp: number
	/** 文件路径 */
	file: string
	/** 变更摘要 */
	summary: string
	/** 变更行数 */
	linesChanged: number
	/** 使用的工具 */
	toolUsed: "apply_diff" | "write_to_file" | "insert_content" | "search_and_replace" | "multi_apply_diff" | string
}

/**
 * 工具调用记录
 */
export interface ToolCallRecord {
	/** 工具名称 */
	tool: string
	/** 时间戳 */
	timestamp: number
	/** 是否成功 */
	success: boolean
	/** 详细信息（可选） */
	details?: string
}

/**
 * 任务检查点
 */
export interface TaskCheckpoint {
	/** 时间戳 */
	timestamp: number
	/** 阶段 */
	stage: "started" | "analysis" | "implementation" | "testing" | "completion"
	/** 描述 */
	description: string
}

/**
 * 创建空的证据缓存
 */
export function createEmptyJudgeEvidenceCache(): JudgeEvidenceCache {
	return {
		userRequirements: [],
		codeChanges: [],
		toolCalls: [],
		checkpoints: [],
		lastUpdated: Date.now(),
	}
}

/**
 * 证据缓存配置
 */
export const JUDGE_EVIDENCE_CONFIG = {
	/** 用户需求最大保留数量 */
	MAX_USER_REQUIREMENTS: 50,
	/** 代码变更最大保留数量 */
	MAX_CODE_CHANGES: 100,
	/** 工具调用最大保留数量 */
	MAX_TOOL_CALLS: 100,
	/** 检查点最大保留数量 */
	MAX_CHECKPOINTS: 20,
} as const
