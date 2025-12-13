/**
 * NextEdit Core Types
 * 编辑链核心类型定义
 */

import {
	EditStep,
	EditChain,
	EditPattern,
	EditStepStatus,
	EditChainStatus,
	ExecutionMode,
} from "../../memory/gsw/types/next-edit"

/**
 * 编辑链创建选项
 */
export interface CreateEditChainOptions {
	/** 任务描述 */
	taskDescription: string
	/** 任务意图（用于模式匹配和向量搜索）*/
	taskIntent?: string
	/** 初始文件列表 */
	files?: string[]
	/** 执行模式 */
	executionMode?: ExecutionMode
	/** 最大步骤数 */
	maxSteps?: number
}

/**
 * 步骤生成上下文
 */
export interface StepGenerationContext {
	/** 任务描述 */
	taskDescription: string
	/** 已经存在的步骤 */
	existingSteps: EditStep[]
	/** 文件内容快照 */
	fileContents: Map<string, string>
	/** 代码库上下文 */
	codebaseContext?: string
	/** 历史编辑链（用于模式学习）*/
	similarChains?: EditChain[]
}

/**
 * 步骤验证结果
 */
export interface StepValidationResult {
	valid: boolean
	errors: string[]
	warnings: string[]
	confidence: number
}

/**
 * 编辑链执行结果
 */
export interface EditChainExecutionResult {
	chainId: string
	status: EditChainStatus
	completedSteps: number
	totalSteps: number
	acceptedSteps: number
	modifiedSteps: number
	rejectedSteps: number
	executionTime: number
	errors: string[]
}

/**
 * 模式学习配置
 */
export interface PatternLearningConfig {
	/** 最小成功率阈值 */
	minSuccessRate: number
	/** 最小使用次数 */
	minUsageCount: number
	/** 是否自动更新模式 */
	autoUpdate: boolean
}

/**
 * 模式匹配结果
 */
export interface PatternMatchResult {
	pattern: EditPattern
	score: number
	matches: {
		taskPattern: boolean
		filePattern: boolean
	}
}

/**
 * 预测式生成配置
 */
export interface PredictiveGenerationConfig {
	/** 是否启用预取 */
	enablePrefetch: boolean
	/** 预取缓冲区大小（预测多少步）*/
	prefetchBuffer: number
	/** 缓存时间（毫秒）*/
	cacheTimeout: number
}

/**
 * 步骤反馈
 */
export interface StepFeedback {
	stepId: string
	action: "accept" | "reject" | "modify"
	modifiedCode?: string
	rejectionReason?: string
	timestamp: string
}

/**
 * 编辑链统计
 */
export interface EditChainStats {
	totalChains: number
	activeChains: number
	completedChains: number
	averageSteps: number
	averageAcceptanceRate: number
	totalExecutionTime: number
}

/**
 * 并行执行配置
 */
export interface ParallelExecutionConfig {
	/** 最大并发数 */
	maxConcurrency: number
	/** 槽位超时（毫秒）*/
	slotTimeout: number
	/** 失败重试次数 */
	retryAttempts: number
}

/**
 * 并行会话状态
 */
export interface ParallelSessionState {
	sessionId: string
	parallelSessionId: string
	chains: Array<{
		chainId: string
		slotId: number
		status: EditChainStatus
		progress: number
	}>
	totalChains: number
	completedChains: number
	failedChains: number
	startTime: number
	estimatedCompletion?: number
}

/**
 * NextEdit服务配置
 */
export interface NextEditServiceConfig {
	/** 启用NextEdit */
	enabled: boolean
	/** 最大并发编辑链 */
	maxConcurrentChains: number
	/** 步骤验证模式 */
	validationMode: "strict" | "relaxed" | "none"
	/** 模式学习配置 */
	patternLearning: PatternLearningConfig
	/** 预测式生成配置 */
	predictiveGeneration: PredictiveGenerationConfig
	/** 并行执行配置 */
	parallelExecution: ParallelExecutionConfig
}

/**
 * 默认配置
 */
export const DEFAULT_NEXT_EDIT_CONFIG: NextEditServiceConfig = {
	enabled: false, // 需要显式启用
	maxConcurrentChains: 3,
	validationMode: "strict",
	patternLearning: {
		minSuccessRate: 0.7,
		minUsageCount: 3,
		autoUpdate: true,
	},
	predictiveGeneration: {
		enablePrefetch: true,
		prefetchBuffer: 2,
		cacheTimeout: 60000, // 1分钟
	},
	parallelExecution: {
		maxConcurrency: 5, // 最多5条并行链
		slotTimeout: 300000, // 5分钟
		retryAttempts: 2,
	},
}

/**
 * 编辑链事件类型
 */
export type EditChainEventType =
	| "chain_created"
	| "chain_started"
	| "step_generated"
	| "step_accepted"
	| "step_rejected"
	| "step_modified"
	| "chain_paused"
	| "chain_resumed"
	| "chain_completed"
	| "chain_abandoned"
	| "pattern_learned"

/**
 * 编辑链事件
 */
export interface EditChainEvent {
	type: EditChainEventType
	chainId: string
	stepId?: string
	timestamp: string
	data?: any
}

/**
 * 编辑链监听器
 */
export type EditChainListener = (event: EditChainEvent) => void | Promise<void>
