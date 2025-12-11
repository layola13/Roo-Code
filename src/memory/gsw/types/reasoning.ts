/**
 * GSW三元记忆系统 - Reasoning Memory类型定义
 * 用于存储LLM推理过程和决策点
 */

import { BaseMemory } from "./common"

/**
 * 工具执行记录（用于裁判验证）
 */
export interface ToolExecutionRecord {
	version: string
	execution_id: string
	timestamp: string
	session_id: string
	tool_name: string
	parameters: Record<string, any>
	result: {
		success: boolean
		filesModified?: string[]
		error?: string
	}
	files_modified: string[]
}

/**
 * 🔥 工作流知识记录（用于CLI工具使用、参数模式等可复用知识）
 */
export interface WorkflowKnowledge {
	tool_or_command: string
	knowledge_type: "cli_usage" | "parameter_pattern" | "error_correction" | "best_practice"
	command?: string
	correctParams?: string[]
	incorrectParams?: string[]
	description: string
	example?: string
	context?: string
	timestamp: string
}

/**
 * Reasoning Memory - LLM推理记忆
 */
export interface ReasoningMemory extends BaseMemory {
	entry_id: string
	timestamp: string
	related_session: string
	source_file: string
	reasoning: string
	decision_points?: string[]
	memory_trigger?: string
	confidence?: number
	related_files?: string[]
	tool_execution?: ToolExecutionRecord // 🔥 工具执行证据（可选）
	workflow_knowledge?: WorkflowKnowledge // 🔥 工作流知识（可选）
}
