/**
 * Type definitions for Parallel Subagent System
 * Supports up to 10 concurrent subagent executions with dynamic scheduling
 */

import { SubagentParams, SubagentResult, AgentContext, Priority } from "../types"

/**
 * Parallel execution request
 */
export interface ParallelSubagentRequest {
	/** Unique request ID */
	id: string
	/** Subagent parameters */
	params: SubagentParams
	/** Execution context */
	context: AgentContext
	/** Request priority */
	priority: Priority
	/** Timestamp when request was created */
	createdAt: number
	/** Optional callback when execution completes */
	onComplete?: (result: SubagentResult) => void
	/** Optional callback when execution fails */
	onError?: (error: Error) => void
}

/**
 * Execution slot status
 */
export type SlotStatus = "idle" | "busy" | "error"

/**
 * Subagent execution slot
 * Represents one of the 10 concurrent execution slots
 */
export interface SubagentSlot {
	/** Slot ID (0-9) */
	id: number
	/** Current status */
	status: SlotStatus
	/** Currently executing request (if busy) */
	currentRequest?: ParallelSubagentRequest
	/** Isolated context for this slot */
	context?: IsolatedContextState
	/** Execution start time */
	startTime?: number
	/** Total executions completed */
	totalExecutions: number
	/** Total execution time (ms) */
	totalExecutionTime: number
}

/**
 * Isolated context state (200K tokens)
 */
export interface IsolatedContextState {
	/** Context ID */
	id: string
	/** Messages in this context */
	messages: any[]
	/** Token count */
	tokenCount: number
	/** Maximum tokens allowed (200K) */
	maxTokens: number
	/** Last used timestamp */
	lastUsed: number
	/** Whether context is currently in use */
	inUse: boolean
}

/**
 * Context pool configuration
 */
export interface ContextPoolConfig {
	/** Maximum contexts to pool */
	maxPoolSize: number
	/** Context token limit (default: 200K) */
	contextTokenLimit: number
	/** Context TTL in ms (default: 30min) */
	contextTTL: number
}

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
	/** Maximum concurrent executions (10) */
	maxConcurrent: number
	/** Maximum queue size */
	maxQueueSize: number
	/** Enable priority scheduling */
	enablePriority: boolean
	/** Queue timeout (ms) */
	queueTimeout: number
}

/**
 * Parallel manager configuration
 */
export interface ParallelManagerConfig {
	/** Number of execution slots (max 10) */
	slotCount: number
	/** Context pool configuration */
	contextPool: ContextPoolConfig
	/** Scheduler configuration */
	scheduler: SchedulerConfig
	/** Enable performance monitoring */
	enableMonitoring: boolean
	/** Verbose logging */
	verboseLogging: boolean
}

/**
 * Execution statistics
 */
export interface ExecutionStats {
	/** Total requests processed */
	totalRequests: number
	/** Currently executing */
	currentExecutions: number
	/** Queued requests */
	queuedRequests: number
	/** Completed successfully */
	successfulExecutions: number
	/** Failed executions */
	failedExecutions: number
	/** Average execution time (ms) */
	averageExecutionTime: number
	/** Peak concurrent executions */
	peakConcurrency: number
	/** Context pool hit rate */
	contextPoolHitRate: number
}

/**
 * Slot metrics
 */
export interface SlotMetrics {
	/** Slot ID */
	slotId: number
	/** Total executions */
	totalExecutions: number
	/** Average execution time */
	averageTime: number
	/** Current status */
	status: SlotStatus
	/** Utilization rate (0-1) */
	utilization: number
}

/**
 * Queue item wrapper
 */
export interface QueueItem {
	/** The request */
	request: ParallelSubagentRequest
	/** Timestamp when queued */
	queuedAt: number
	/** Number of retry attempts */
	attempts: number
}

/**
 * Execution result with metadata
 */
export interface ParallelExecutionResult extends SubagentResult {
	/** Request ID */
	requestId: string
	/** Slot ID that executed this */
	slotId: number
	/** Time spent in queue (ms) */
	queueTime: number
	/** Actual execution time (ms) */
	executionTime: number
	/** Whether context was reused */
	contextReused: boolean
}

/**
 * Context pool statistics
 */
export interface ContextPoolStats {
	/** Total contexts in pool */
	totalContexts: number
	/** Contexts currently in use */
	inUseContexts: number
	/** Available contexts */
	availableContexts: number
	/** Context hits (reuse) */
	hits: number
	/** Context misses (new allocation) */
	misses: number
	/** Hit rate (0-1) */
	hitRate: number
}

/**
 * Scheduler statistics
 */
export interface SchedulerStats {
	/** Current queue size */
	queueSize: number
	/** Total enqueued */
	totalEnqueued: number
	/** Total dequeued */
	totalDequeued: number
	/** Average queue time (ms) */
	averageQueueTime: number
	/** Requests by priority */
	priorityBreakdown: {
		high: number
		medium: number
		low: number
	}
}

/**
 * Error types for parallel execution
 */
export enum ParallelExecutionError {
	QUEUE_FULL = "QUEUE_FULL",
	TIMEOUT = "TIMEOUT",
	SLOT_ERROR = "SLOT_ERROR",
	CONTEXT_ERROR = "CONTEXT_ERROR",
	EXECUTION_ERROR = "EXECUTION_ERROR",
}

/**
 * Parallel execution exception
 */
export class ParallelExecutionException extends Error {
	constructor(
		public readonly errorType: ParallelExecutionError,
		message: string,
		public readonly requestId?: string,
	) {
		super(message)
		this.name = "ParallelExecutionException"
	}
}
