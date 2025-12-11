/**
 * GSW增强功能1：实时上下文总结
 * 会话总结类型定义
 */

/**
 * 会话总结接口
 * 用于优化System Prompt注入时的查询性能
 */
export interface SessionSummary {
	/** 会话ID */
	session_id: string

	/** 最后更新时间（ISO 8601格式） */
	last_updated: string

	/** 关键要点（3-5条） */
	key_points: string[]

	/** 用户意图（一句话概括） */
	user_intent: string

	/** 当前状态（一句话描述） */
	current_status: string

	/** 下一步计划（2-3条） */
	next_steps: string[]

	/** 强制性需求（可选） */
	mandatory_requirements?: string[]

	/** 涉及的文件列表（可选） */
	files_involved?: string[]
}
