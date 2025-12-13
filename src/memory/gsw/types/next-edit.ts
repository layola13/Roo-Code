/**
 * NextEdit Memory Type - GSW Integration
 * 编辑链和编辑步骤的记忆存储类型
 */

import { BaseMemory } from "./common"

/**
 * 编辑类型
 */
export type EditType = "insert" | "replace" | "delete" | "refactor"

/**
 * 编辑步骤状态
 */
export type EditStepStatus = "pending" | "accepted" | "rejected" | "modified"

/**
 * 编辑链状态
 */
export type EditChainStatus = "planning" | "active" | "completed" | "paused" | "abandoned"

/**
 * 执行模式
 */
export type ExecutionMode = "sequential" | "parallel"

/**
 * 单个编辑步骤
 */
export interface EditStep {
	/** 步骤序号 */
	index: number
	/** 步骤唯一ID */
	stepId: string

	/** 目标文件路径 */
	filePath: string
	/** 起始行 */
	startLine: number
	/** 结束行 */
	endLine: number

	/** 原始代码 */
	originalCode: string
	/** 建议的代码 */
	suggestedCode: string
	/** 编辑描述 */
	description: string

	/** 编辑类型 */
	editType: EditType

	/** 依赖的步骤ID（可选）*/
	dependsOn?: string[]

	/** 状态 */
	status: EditStepStatus
	/** 置信度 0-1 */
	confidence: number

	/** 用户修改后的代码（如果用户修改了建议）*/
	userModifiedCode?: string
	/** 拒绝原因 */
	rejectionReason?: string
}

/**
 * 编辑链 - 关联的步骤序列
 */
export interface EditChain {
	/** 链ID */
	chainId: string
	/** 所属会话ID */
	sessionId: string

	/** 任务描述 */
	taskDescription: string
	/** 任务意图（用于向量搜索）*/
	taskIntent: string

	/** 编辑步骤列表 */
	steps: EditStep[]
	/** 当前进度 */
	currentIndex: number

	/** 涉及的文件 */
	affectedFiles: string[]

	/** 创建时间 */
	createdAt: string
	/** 最后更新时间 */
	updatedAt: string
	/** 完成时间（如果已完成）*/
	completedAt?: string

	/** 状态 */
	status: EditChainStatus

	/** 执行模式 */
	executionMode: ExecutionMode
	/** 并行会话ID（如果是并行执行）*/
	parallelSessionId?: string
}

/**
 * 编辑模式 - 从成功链中提取的可复用知识
 */
export interface EditPattern {
	/** 模式ID */
	patternId: string

	/** 匹配条件 - 任务描述正则 */
	taskPatterns: string[]
	/** 匹配条件 - 文件名模式 (e.g., "*Service.ts") */
	filePatterns: string[]

	/** 步骤模板 */
	stepTemplates: Array<{
		editType: EditType
		descriptionTemplate: string
		codeTransform?: string
	}>

	/** 统计信息 */
	usageCount: number
	successRate: number
	lastUsedAt: string
}

/**
 * Next Edit 记忆类型 (extends GSW reasoning memory)
 */
export interface NextEditMemory extends BaseMemory {
	version: "1.0"
	entry_id: string
	timestamp: string
	session_id: string

	/** 编辑链数据 */
	edit_chain: EditChain

	/** 语义索引用：任务意图摘要 */
	task_intent: string

	/** 关键词：用于YAML fallback搜索 */
	keywords: string[]

	/** 相关文件 */
	related_files: string[]

	/** 相关会话（兼容BaseMemory，使用session_id） */
	related_session: string

	/** 源文件（兼容BaseMemory，必需） */
	source_file: string

	/** 推理过程（兼容BaseMemory，必需） */
	reasoning: string

	/** 编辑模式标签 (e.g., "refactor", "add-feature", "fix-bug") */
	pattern_tags: string[]

	/** 成功率统计 */
	success_stats: {
		totalSteps: number
		acceptedSteps: number
		modifiedSteps: number
		rejectedSteps: number
	}
}

/**
 * 并行会话记忆类型
 */
export interface ParallelSessionMemory extends BaseMemory {
	version: "1.0"
	entry_id: string
	timestamp: string
	session_id: string

	/** 并行会话ID */
	parallel_session_id: string

	/** 任务描述 */
	task_description: string

	/** 编辑链ID列表 */
	edit_chain_ids: string[]

	/** 并发槽位数 */
	slot_count: number

	/** 完成状态 */
	completed_count: number
	failed_count: number

	/** 总执行时间（毫秒）*/
	total_execution_time: number

	/** 创建时间 */
	created_at: string
	/** 完成时间 */
	completed_at?: string
}
