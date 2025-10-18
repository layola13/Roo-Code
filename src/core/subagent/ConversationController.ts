/**
 * ConversationController - Main orchestrator for subagent system
 *
 * This is the central controller that integrates:
 * - SubagentExecutor for execution
 * - RoutingEngine for intelligent routing
 * - ExecutionScheduler for task management
 * - PerformanceMonitor for metrics
 * - ContextManager for context compression
 * - VectorMemoryStore for semantic memory (from core/memory)
 * - TieredStorageManager for tiered storage
 */

import { ApiHandler } from "../../api"
import { SubagentExecutor } from "./executor/SubagentExecutor"
import { RoutingEngine } from "./routing/RoutingEngine"
import { ExecutionScheduler } from "./routing/ExecutionScheduler"
import { PerformanceMonitor } from "./monitoring/PerformanceMonitor"
import { ContextManager } from "./context/ContextManager"
import { CompressionQueue } from "./queue/CompressionQueue"
import { VectorMemoryStore } from "../memory/VectorMemoryStore"
import { TieredStorageManager } from "./storage/TieredStorageManager"
import { SubagentParams, SubagentResult, AgentContext, SubagentName, CompressionTask } from "./types"

// Import agents
import { ContextAnalyzerAgent } from "./agents/ContextAnalyzerAgent"
import { MemoryExtractorAgent } from "./agents/MemoryExtractorAgent"
import { CodeSummarizerAgent } from "./agents/CodeSummarizerAgent"

// Import intelligent context system
import { MessageIndexManager } from "./MessageIndexManager"
import { JudgeAgent } from "./agents/JudgeAgent"
import { JudgeDecision, HistoricalMessage } from "./types-intelligent-context"

export interface ControllerOptions {
	enableCache?: boolean
	enableMetrics?: boolean
	enableAutoCompression?: boolean
	compressionThreshold?: number // percentage (e.g., 75 for 75%)
	verboseLogging?: boolean
	// Intelligent context filtering options
	enableIntelligentContext?: boolean
	messageIndexStoragePath?: string
	contextFilterConfig?: {
		minHistoryMessages?: number // minimum messages to trigger filtering
		maxSelectedMessages?: number // maximum messages to select
		defaultTokenBudget?: number
	}
}

/**
 * ConversationController - Main entry point for subagent operations
 */
export class ConversationController {
	private executor: SubagentExecutor
	private router: RoutingEngine
	private scheduler: ExecutionScheduler
	private monitor: PerformanceMonitor
	private contextManager: ContextManager
	private compressionQueue: CompressionQueue

	// Intelligent context system components
	private messageIndexManager?: MessageIndexManager
	private judgeAgent?: JudgeAgent

	private options: Required<ControllerOptions>

	constructor(
		private apiHandler: ApiHandler,
		private vectorMemoryStore?: VectorMemoryStore,
		options: ControllerOptions = {},
	) {
		// Set defaults
		this.options = {
			enableCache: true,
			enableMetrics: true,
			enableAutoCompression: true,
			compressionThreshold: 75,
			verboseLogging: false,
			enableIntelligentContext: true,
			messageIndexStoragePath: "./.roo/message-index",
			contextFilterConfig: {
				minHistoryMessages: 10,
				maxSelectedMessages: 25,
				defaultTokenBudget: 120000,
			},
			...options,
		}

		// Initialize components
		this.executor = new SubagentExecutor(apiHandler, {
			enableCache: this.options.enableCache,
			enableMetrics: this.options.enableMetrics,
			verboseLogging: this.options.verboseLogging,
		})

		this.router = new RoutingEngine()
		this.scheduler = new ExecutionScheduler(this.executor)
		this.monitor = new PerformanceMonitor()
		this.contextManager = new ContextManager(apiHandler, this.executor)
		this.compressionQueue = new CompressionQueue(this.executor, {
			concurrency: 2,
			maxRetries: 3,
			verboseLogging: this.options.verboseLogging,
			maxQueueSize: 50,
		})

		// Register agents
		this.registerAgents()

		// Initialize intelligent context system if enabled
		if (this.options.enableIntelligentContext) {
			this.initializeIntelligentContext()
		}
	}

	/**
	 * Register all subagents
	 */
	private registerAgents(): void {
		const contextAnalyzer = new ContextAnalyzerAgent(this.apiHandler)
		// ✅ 核心修复：传递VectorMemoryStore给MemoryExtractorAgent
		const memoryExtractor = new MemoryExtractorAgent(this.apiHandler, this.vectorMemoryStore)
		const codeSummarizer = new CodeSummarizerAgent(this.apiHandler)

		this.executor.registerSubagent(contextAnalyzer)
		this.executor.registerSubagent(memoryExtractor)
		this.executor.registerSubagent(codeSummarizer)
	}

	/**
	 * Initialize intelligent context filtering system
	 */
	private initializeIntelligentContext(): void {
		try {
			// Initialize MessageIndexManager
			this.messageIndexManager = new MessageIndexManager({
				storagePath: this.options.messageIndexStoragePath!,
				enablePersistence: true,
			})

			// Initialize JudgeAgent
			this.judgeAgent = new JudgeAgent(this.apiHandler, {
				agentTimeout: 3000,
				enableParallel: true,
				totalTokenBudget: this.options.contextFilterConfig!.defaultTokenBudget!,
				reserveForResponse: 20000,
				verboseLogging: this.options.verboseLogging,
			})

			// Register expert agents to JudgeAgent
			const contextAnalyzer = new ContextAnalyzerAgent(this.apiHandler)
			const memoryExtractor = new MemoryExtractorAgent(this.apiHandler, this.vectorMemoryStore)
			const codeSummarizer = new CodeSummarizerAgent(this.apiHandler)

			this.judgeAgent.registerExpertAgent(contextAnalyzer)
			this.judgeAgent.registerExpertAgent(memoryExtractor)
			this.judgeAgent.registerExpertAgent(codeSummarizer)

			if (this.options.verboseLogging) {
				console.log("[Controller] Intelligent context system initialized")
			}
		} catch (error) {
			console.error("[Controller] Failed to initialize intelligent context system:", error)
			this.options.enableIntelligentContext = false
		}
	}

	/**
	 * Execute a subagent with full orchestration
	 */
	async executeSubagent(params: SubagentParams, context: AgentContext): Promise<SubagentResult> {
		// Check if auto-compression is needed
		if (this.options.enableAutoCompression) {
			const compressionCheck = this.router.detectCompressionNeeded(context)
			if (compressionCheck.needed) {
				if (this.options.verboseLogging) {
					console.log("[Controller] Auto-compression triggered:", compressionCheck.reason)
				}
				// Enqueue compression task (non-blocking)
				await this.enqueueCompression(context, compressionCheck.suggestedAgents)
			}
		}

		// Execute the subagent
		const result = await this.executor.executeSubagent(params, context)

		// Record metrics
		if (this.options.enableMetrics) {
			this.monitor.recordExecution(result)
		}

		return result
	}

	/**
	 * Smart routing: automatically select and execute appropriate subagent
	 */
	async smartRoute(
		userMessage: string,
		context: AgentContext,
		options?: {
			task?: string
			userContext?: string
		},
	): Promise<SubagentResult> {
		const decision = this.router.route(userMessage, context)

		if (this.options.verboseLogging) {
			console.log(`[Controller] Routing to ${decision.primaryAgent} (confidence: ${decision.confidence})`)
			console.log(`[Controller] Reasoning: ${decision.reasoning}`)
		}

		const params: SubagentParams = {
			agent_name: decision.primaryAgent,
			task: options?.task,
			context: options?.userContext,
		}

		return this.executeSubagent(params, context)
	}

	/**
	 * Execute multiple subagents in parallel
	 */
	async executeMultiple(
		requests: Array<{ params: SubagentParams; context: AgentContext }>,
	): Promise<SubagentResult[]> {
		// Schedule all tasks
		const taskIds = requests.map(({ params, context }) => this.scheduler.scheduleTask(params, context))

		// Execute all
		const results = await this.scheduler.executeBatch(taskIds)

		// Record metrics
		if (this.options.enableMetrics) {
			results.forEach((result) => this.monitor.recordExecution(result))
		}

		return Array.from(results.values())
	}

	/**
	 * Enqueue compression task (non-blocking)
	 */
	private async enqueueCompression(context: AgentContext, suggestedAgents: SubagentName[]): Promise<void> {
		// Create compression task
		const task: CompressionTask = {
			id: `compress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			conversationId: (context as any).conversationId || "unknown",
			trigger: "auto-compression",
			priority: context.messages.length > 50 ? "high" : "medium",
			messageRange: [Math.max(0, context.messages.length - 20), context.messages.length - 1],
			strategy: {
				steps: suggestedAgents.map((agent) => ({
					agent,
					weight: 1,
				})),
			},
			createdAt: Date.now(),
		}

		// Enqueue for background processing
		await this.compressionQueue.enqueue(task)

		if (this.options.verboseLogging) {
			console.log(`[Controller] Compression task ${task.id} enqueued (priority: ${task.priority})`)
		}
	}

	/**
	 * Get comprehensive status
	 */
	getStatus(): {
		executor: { cacheSize: number; cacheKeys: string[] }
		scheduler: ReturnType<ExecutionScheduler["getStats"]>
		monitor: ReturnType<PerformanceMonitor["getSummary"]>
		health: ReturnType<PerformanceMonitor["getHealthStatus"]>
		compressionQueue: ReturnType<CompressionQueue["getStats"]>
	} {
		return {
			executor: this.executor.getCacheStats(),
			scheduler: this.scheduler.getStats(),
			monitor: this.monitor.getSummary(),
			health: this.monitor.getHealthStatus(),
			compressionQueue: this.compressionQueue.getStats(),
		}
	}

	/**
	 * Get performance metrics
	 */
	getMetrics(agentName?: SubagentName) {
		if (agentName) {
			return this.monitor.getMetrics(agentName)
		}
		return this.monitor.getAllMetrics()
	}

	/**
	 * Get routing suggestions
	 */
	getRoutingSuggestions(userMessage: string, context: AgentContext) {
		return this.router.suggestWorkflow(userMessage, context)
	}

	/**
	 * Check if compression is needed
	 */
	checkCompressionNeeded(context: AgentContext) {
		return this.router.detectCompressionNeeded(context)
	}

	/**
	 * Manually trigger compression
	 */
	async compress(
		context: AgentContext,
		strategy: "memory" | "context" | "code" | "all" = "all",
	): Promise<Map<SubagentName, SubagentResult>> {
		const agents: SubagentName[] = []

		switch (strategy) {
			case "memory":
				agents.push("condense-memory-extractor")
				break
			case "context":
				agents.push("condense-context-analyzer")
				break
			case "code":
				agents.push("condense-code-summarizer")
				break
			case "all":
				agents.push("condense-memory-extractor", "condense-context-analyzer", "condense-code-summarizer")
				break
		}

		const results = new Map<SubagentName, SubagentResult>()

		for (const agentName of agents) {
			const params: SubagentParams = {
				agent_name: agentName,
				task: "Compress conversation context",
			}

			const result = await this.executeSubagent(params, context)
			results.set(agentName, result)
		}

		return results
	}

	/**
	 * Execute intelligent context filtering (complete 6-step workflow)
	 * @param userMessage 用户新消息
	 * @param conversationId 对话ID
	 * @param allMessages 所有历史消息（包括新消息）
	 * @returns 精选的上下文消息列表和裁判决策
	 */
	async executeIntelligentContextFilter(
		userMessage: string,
		conversationId: string,
		allMessages: any[],
	): Promise<{
		selectedMessages: HistoricalMessage[]
		judgeDecision: JudgeDecision
		originalMessageCount: number
		selectedMessageCount: number
		tokenSavings: number
	}> {
		if (!this.options.enableIntelligentContext || !this.judgeAgent || !this.messageIndexManager) {
			throw new Error("Intelligent context system not initialized")
		}

		const startTime = Date.now()
		if (this.options.verboseLogging) {
			console.log(`[Controller] Starting intelligent context filtering for conversation: ${conversationId}`)
		}

		// 步骤1-2: 为历史消息分配索引号并存储
		const historicalMessages = this.messageIndexManager.storeMessages(allMessages.slice(0, -1), conversationId)

		// 步骤3-5: 执行裁判分析和专家Agent并行筛选
		const judgeDecision = await this.judgeAgent.analyze(userMessage, {
			messages: this.messageIndexManager.getMessagesByConversation(conversationId),
		})

		// 步骤6: 获取精选的上下文消息
		const selectedMessages = this.messageIndexManager.getMessagesByIndices(judgeDecision.selectedIndices)

		// 计算统计信息
		const originalMessageCount = allMessages.length - 1
		const selectedMessageCount = selectedMessages.length
		const originalTokens = allMessages.slice(0, -1).reduce((sum, msg) => sum + this.estimateTokens(msg), 0)
		const selectedTokens = selectedMessages.reduce((sum, msg) => sum + msg.tokens, 0)
		const tokenSavings = Math.max(0, originalTokens - selectedTokens)

		const executionTime = Date.now() - startTime
		if (this.options.verboseLogging) {
			console.log(`[Controller] Intelligent context filtering completed in ${executionTime}ms`)
			console.log(
				`[Controller] Selected ${selectedMessageCount}/${originalMessageCount} messages, saved ${tokenSavings} tokens`,
			)
		}

		return {
			selectedMessages,
			judgeDecision,
			originalMessageCount,
			selectedMessageCount,
			tokenSavings,
		}
	}

	/**
	 * Check if intelligent context filtering should be applied
	 * @param messageCount 历史消息数量
	 * @param userMessage 用户消息
	 */
	shouldApplyIntelligentContext(messageCount: number, userMessage?: string): boolean {
		if (!this.options.enableIntelligentContext) {
			return false
		}

		if (messageCount < this.options.contextFilterConfig!.minHistoryMessages!) {
			return false
		}

		return true
	}

	/**
	 * Estimate tokens for a message (simple approximation)
	 */
	private estimateTokens(message: any): number {
		const content =
			typeof message.content === "string"
				? message.content
				: message.content?.map((block: any) => (block.type === "text" ? block.text : "")).join("") || ""
		return Math.ceil(content.length / 4)
	}

	/**
	 * Clear all caches and reset state
	 */
	reset(): void {
		this.executor.clearCache()
		this.scheduler.clear()
		this.monitor.clear()
		this.contextManager.clear()
		this.compressionQueue.clear()

		// Reset message index manager
		if (this.messageIndexManager) {
			this.messageIndexManager.reset()
		}

		if (this.options.verboseLogging) {
			console.log("[Controller] Reset complete")
		}
	}

	/**
	 * Dispose resources including intelligent context system
	 */
	async dispose(): Promise<void> {
		if (this.messageIndexManager) {
			await this.messageIndexManager.dispose()
		}

		this.reset()

		if (this.options.verboseLogging) {
			console.log("[Controller] Disposed all resources")
		}
	}

	/**
	 * Export diagnostics
	 */
	exportDiagnostics(): {
		metrics: string
		status: ReturnType<ConversationController["getStatus"]>
		timestamp: number
	} {
		return {
			metrics: this.monitor.exportMetrics(),
			status: this.getStatus(),
			timestamp: Date.now(),
		}
	}

	/**
	 * Add custom routing rule
	 */
	addRoutingRule(rule: { pattern: RegExp | string; agent: SubagentName; priority: number }): void {
		this.router.addRule(rule)
	}

	/**
	 * Get context manager for advanced operations
	 */
	getContextManager(): ContextManager {
		return this.contextManager
	}

	/**
	 * Get compression queue for advanced operations
	 */
	getCompressionQueue(): CompressionQueue {
		return this.compressionQueue
	}

	/**
	 * Enable/disable features at runtime
	 */
	configure(options: Partial<ControllerOptions>): void {
		const oldIntelligentContextEnabled = this.options.enableIntelligentContext
		Object.assign(this.options, options)

		// Re-initialize intelligent context system if enabled state changed
		if (
			options.enableIntelligentContext !== undefined &&
			options.enableIntelligentContext !== oldIntelligentContextEnabled
		) {
			if (options.enableIntelligentContext) {
				this.initializeIntelligentContext()
			} else {
				this.judgeAgent = undefined
				this.messageIndexManager = undefined
			}
		}

		if (this.options.verboseLogging) {
			console.log("[Controller] Configuration updated:", this.options)
		}
	}

	/**
	 * Get intelligent context system status
	 */
	getIntelligentContextStatus(): {
		enabled: boolean
		initialized: boolean
		messageIndexStats?: any
		expertAgentCount?: number
	} {
		return {
			enabled: this.options.enableIntelligentContext || false,
			initialized: !!(this.judgeAgent && this.messageIndexManager),
			messageIndexStats: this.messageIndexManager?.getStats(),
			expertAgentCount: this.judgeAgent?.getExpertAgentCount(),
		}
	}

	/**
	 * Get message index manager for advanced operations
	 */
	getMessageIndexManager(): MessageIndexManager | undefined {
		return this.messageIndexManager
	}

	/**
	 * Get judge agent for advanced operations
	 */
	getJudgeAgent(): JudgeAgent | undefined {
		return this.judgeAgent
	}
}
