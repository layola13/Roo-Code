/**
 * Type definitions for the new Subagent System
 * Based on docs/45-subagent.md specification
 */

import { ApiMessage } from "../task-persistence/apiMessages"

/**
 * Subagent names
 */
export type SubagentName = "condense-context-analyzer" | "condense-memory-extractor" | "condense-code-summarizer"

/**
 * Analysis depth for subagent execution
 */
export type AnalysisDepth = "quick" | "deep"

/**
 * Compression strategy types
 */
export type CompressionStrategy = "rolling-window" | "semantic-clustering" | "hybrid" | "priority-queue"

/**
 * Priority levels
 */
export type Priority = "high" | "medium" | "low"

/**
 * Memory categories
 */
export type MemoryCategory = "decision" | "requirement" | "technical" | "constraint"

/**
 * Change types for code analysis
 */
export type ChangeType = "create" | "modify" | "delete" | "refactor"

/**
 * Risk levels
 */
export type RiskLevel = "low" | "medium" | "high"

/**
 * Execution action types
 */
export type ActionType = "subagent" | "memory-search" | "store" | "respond"

// ============================================================================
// Subagent Input/Output Types
// ============================================================================

/**
 * Context Analyzer Output
 */
export interface AnalyzerOutput {
	stages: Array<{
		stageNumber: number
		topic: string
		messageRange: [number, number]
		keyPoints: string[]
		importance: "critical" | "normal" | "low"
	}>
	transitionPoints: number[]
	overallFlow: string
	recommendation: "compress" | "preserve" | "archive"
}

/**
 * Memory Extractor Output
 */
export interface ExtractorOutput {
	criticalItems: Array<{
		id: string
		category: MemoryCategory
		content: string
		context: string
		importance: number // 1-10
		timestamp: Date
		relatedMessageIds: string[]
	}>
	summary: string
	keyEntities: Array<{
		name: string
		type: "person" | "system" | "concept"
		mentions: number
	}>
}

/**
 * Code Summarizer Output
 */
export interface CodeSummarizerOutput {
	changes: Array<{
		file: string
		changeType: string
		summary: string
		linesChanged: number
		impactScore: number // 1-10
	}>
	overallImpact: string
	riskLevel: RiskLevel
	dependencies: string[]
	recommendations: string[]
}

// ============================================================================
// Subagent Execution Types
// ============================================================================

/**
 * Subagent execution parameters
 */
export interface SubagentParams {
	agent_name: SubagentName
	task?: string
	context?: string
	options?: {
		depth?: AnalysisDepth
		messageRange?: [number, number]
		categories?: MemoryCategory[]
		focusArea?: string
	}
}

/**
 * Subagent execution result
 */
export interface SubagentResult {
	agentName: SubagentName | string
	output: string | AnalyzerOutput | ExtractorOutput | CodeSummarizerOutput
	tokensUsed: number
	executionTime: number
	success: boolean
	error?: string
	cachedResult?: boolean
}

/**
 * Agent context for execution
 */
export interface AgentContext {
	messages: ApiMessage[]
	conversationMeta?: Record<string, any>
	existingMemories?: any[]
	codeChanges?: any[]
	[key: string]: any
}

// ============================================================================
// Context Management Types
// ============================================================================

/**
 * Managed context result
 */
export interface ManagedContext {
	fullMessages: ApiMessage[]
	summaries: Summary[]
	totalOriginalTokens: number
	compressedTokens: number
}

/**
 * Summary structure
 */
export interface Summary {
	messageRange: [number, number]
	content: string
	timestamp: Date
}

/**
 * Message cluster for semantic compression
 */
export interface MessageCluster {
	messages: ApiMessage[]
	centroid: number[]
	updateCentroid(embedding: number[]): void
}

/**
 * Compressed context result
 */
export interface CompressedContext {
	summaries: string[]
	criticalMessages: ApiMessage[]
	compressionRatio: number
}

// ============================================================================
// Routing and Execution Types
// ============================================================================

/**
 * User request structure
 */
export interface UserRequest {
	conversationId: string
	userId: string
	content: string
	conversationState?: ConversationState
}

/**
 * Context analysis result
 */
export interface ContextAnalysis {
	tokenCount: number
	messageCount: number
	recentMessages: ApiMessage[]
	requiresHistoricalKnowledge: boolean
	isComplexTask: boolean
	hasCodeChanges: boolean
	currentTopic: string
}

/**
 * Execution plan
 */
export interface ExecutionPlan {
	strategy: string
	actions: ExecutionAction[]
}

/**
 * Execution action
 */
export interface ExecutionAction {
	type: ActionType
	agent?: SubagentName
	task?: string
	context?: any
	output?: string
	dependsOn?: string
	withContext?: any
	instructions?: string
	query?: string
	topK?: number
	filter?: Record<string, any>
	target?: string
	data?: string
	fallback?: any
}

/**
 * Execution result
 */
export interface ExecutionResult {
	success: boolean
	outputs: Record<string, any>
	timings: Record<string, number>
	totalTime: number
}

// ============================================================================
// Memory System Types
// ============================================================================

/**
 * Memory item structure
 */
export interface MemoryItem {
	id: string
	conversationId: string
	userId: string
	content: string
	category: MemoryCategory
	importance: number
	timestamp: Date
	relatedMessageIds: string[]
	tags: string[]
	metadata?: Record<string, any>
}

/**
 * Memory search options
 */
export interface SearchOptions {
	topK?: number
	filter?: Record<string, any>
	minScore?: number
}

/**
 * Retrieval context
 */
export interface RetrievalContext {
	conversationId: string
	userId: string
}

// ============================================================================
// Monitoring Types
// ============================================================================

/**
 * Conversation metrics
 */
export interface ConversationMetrics {
	tokenUsage: {
		input: number
		output: number
		total: number
		trend: number[]
	}
	compressionMetrics: {
		originalTokens: number
		compressedTokens: number
		ratio: number
		timeSaved: number
	}
	memoryOperations: {
		stores: number
		retrievals: number
		cacheHitRate: number
	}
	subagentCalls: {
		analyzer: number
		extractor: number
		summarizer: number
		totalTime: number
	}
	qualityScores: {
		coherence: number
		completeness: number
		userSatisfaction: number
	}
}

/**
 * Anomaly detection result
 */
export interface Anomaly {
	type: string
	severity: "high" | "medium" | "low"
	message: string
	recommendation: string
}

/**
 * Optimization plan
 */
export interface OptimizationPlan {
	actions: Array<{
		type: string
		params: Record<string, any>
	}>
}

// ============================================================================
// Compression Trigger Types
// ============================================================================

/**
 * Conversation state
 */
export interface ConversationState {
	conversationId: string
	messages: ApiMessage[]
	compressedContext?: any
	metadata: Record<string, any>
	experimentConfig?: any
}

/**
 * Trigger check result
 */
export interface TriggerCheck {
	shouldTrigger: boolean
	reason: string
	priority: Priority
}

/**
 * Compression task
 */
export interface CompressionTask {
	id: string
	conversationId: string
	trigger: string
	priority: Priority
	messageRange: [number, number]
	strategy: CompressionStrategyConfig
	createdAt: number
}

/**
 * Compression strategy configuration
 */
export interface CompressionStrategyConfig {
	steps: Array<{
		agent: SubagentName
		weight: number
		options?: Record<string, any>
	}>
}

/**
 * Compression result
 */
export interface CompressionResult {
	taskId: string
	success: boolean
	compressedContext: string
	tokensReduced: number
}

// ============================================================================
// Experiment Types
// ============================================================================

/**
 * Experiment configuration
 */
export interface ExperimentConfig {
	name: string
	variants: ExperimentVariant[]
	allocation?: Record<string, number>
}

/**
 * Experiment variant
 */
export interface ExperimentVariant {
	name: string
	description: string
	config: Record<string, any>
}

/**
 * Experiment structure
 */
export interface Experiment {
	id: string
	name: string
	variants: ExperimentVariant[]
	allocation: Record<string, number>
	metrics: MetricRecord[]
	startDate: Date
	status: "active" | "paused" | "completed"
}

/**
 * Metric record
 */
export interface MetricRecord {
	variant: string
	timestamp: Date
	tokensSaved?: number
	compressionRatio?: number
	responseTime?: number
	qualityScore?: number
	userSatisfaction?: number
}

/**
 * Experiment results
 */
export interface ExperimentResults {
	experimentId: string
	variants: Record<string, VariantResult>
	recommendation?: string
}

/**
 * Variant result
 */
export interface VariantResult {
	sampleSize: number
	metrics: {
		avgTokensSaved: number
		avgCompressionRatio: number
		avgResponseTime: number
		qualityScore: number
		userSatisfaction: number
	}
	statisticalSignificance: {
		pValue: number
	}
}
