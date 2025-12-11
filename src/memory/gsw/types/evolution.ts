/**
 * GSW三元记忆系统 - Evolution Memory类型定义
 * 用于存储代码演进历史和变更反思
 */

import { BaseMemory } from "./common"

/**
 * 修改上下文
 */
export interface ModificationContext {
	reason: string
	related_session: string
	related_reasoning?: string[]
}

/**
 * Evolution Memory - 代码演进记忆
 */
export interface EvolutionMemory extends BaseMemory {
	evolution_id: string
	timestamp: string
	file_path: string
	git_commit: string
	diff_summary: string
	modification_context: ModificationContext
	benefits?: string[]
	potential_issues?: string[]
	future_applications?: string[]
	code_snippet?: string
}
