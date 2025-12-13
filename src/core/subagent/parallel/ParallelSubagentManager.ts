/**
 * ParallelSubagentManager - Main orchestrator for parallel subagent execution
 *
 * Manages up to 10 concurrent subagent executions with:
 * - Dynamic scheduling and queue management
 * - Context pooling and isolation
 * - Automatic slot assignment
 * - Performance monitoring
 * - Error handling and recovery
 */

import { SubagentExecutor } from "../executor/SubagentExecutor"
import { SubagentSlot } from "./SubagentSlot"
import { ContextPool } from "./ContextPool"
import { DynamicScheduler } from "./DynamicScheduler"
import {
	ParallelManagerConfig,
	ParallelSubagentRequest,
	ParallelExecutionResult,
	ExecutionStats,
	SlotMetrics,
	ParallelExecutionError,
	ParallelExecutionException,
} from "./types"
import { SubagentParams, AgentContext, Priority } from "../types"

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ParallelManagerConfig = {
	slotCount: 10,
	contextPool: {
		maxPoolSize: 20,
		contextTokenLimit: 200_000,
		contextTTL: 30 * 60 * 1000, // 30 minutes
	},
	scheduler: {
		maxConcurrent: 10,
		maxQueueSize: 100,
		enablePriority: true,
		queueTimeout: 60_000, // 60 seconds
	},
	enableMonitoring: true,
	verboseLogging: false,
}

/**
 * ParallelSubagentManager class
 * Core orchestrator for parallel subagent execution
 */
export class ParallelSubagentManager {
	private slots: SubagentSlot[]
	private contextPool: ContextPool
	private scheduler: DynamicScheduler
	private executor: SubagentExecutor
	private config: ParallelManagerConfig
	private isProcessing = false
	private stats = {
		totalRequests: 0,
		successfulExecutions: 0,
		failedExecutions: 0,
		totalExecutionTime: 0,
		peakConcurrency: 0,
	}

	constructor(executor: SubagentExecutor, config: Partial<ParallelManagerConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config }
		this.executor = executor

		// Initialize context pool
		this.contextPool = new ContextPool(this.config.contextPool)

		// Initialize scheduler
		this.scheduler = new DynamicScheduler(this.config.scheduler)

		// Initialize slots
		this.slots = []
		for (let i = 0; i < this.config.slotCount; i++) {
			this.slots.push(new SubagentSlot(i, executor))
		}

		// Start background processing
		this.startProcessing()
	}

	/**
	 * Submit a subagent execution request
	 * Returns a promise that resolves when execution completes
	 */
	async execute(
		params: SubagentParams,
		context: AgentContext,
		priority: Priority = "medium",
	): Promise<ParallelExecutionResult> {
		const requestId = this.generateRequestId()

		return new Promise((resolve, reject) => {
			const request: ParallelSubagentRequest = {
				id: requestId,
				params,
				context,
				priority,
				createdAt: Date.now(),
				onComplete: (result) => {
					const executionResult: ParallelExecutionResult = {
						...result,
						requestId,
						slotId: -1, // Will be set by slot
						queueTime: 0, // Will be set by slot
						executionTime: result.executionTime,
						contextReused: false, // Will be set by slot
					}
					resolve(executionResult)
				},
				onError: (error) => {
					reject(error)
				},
			}

			this.stats.totalRequests++

			try {
				// Try immediate execution if slot available
				const availableSlot = this.findAvailableSlot()
				if (availableSlot) {
					this.executeInSlot(availableSlot, request).catch(reject)
				} else {
					// Queue for later execution
					this.scheduler.enqueue(request)

					if (this.config.verboseLogging) {
						console.log(
							`[ParallelSubagentManager] Request ${requestId} queued (priority: ${priority}, queue size: ${this.scheduler.size()})`,
						)
					}
				}
			} catch (error) {
				reject(error)
			}
		})
	}

	/**
	 * Execute multiple requests in parallel
	 */
	async executeMultiple(
		requests: Array<{ params: SubagentParams; context: AgentContext; priority?: Priority }>,
	): Promise<ParallelExecutionResult[]> {
		const promises = requests.map(({ params, context, priority }) => this.execute(params, context, priority))

		return Promise.all(promises)
	}

	/**
	 * Find an available slot
	 */
	private findAvailableSlot(): SubagentSlot | null {
		return this.slots.find((slot) => slot.isAvailable()) || null
	}

	/**
	 * Execute request in a specific slot
	 */
	private async executeInSlot(slot: SubagentSlot, request: ParallelSubagentRequest): Promise<void> {
		try {
			// Assign context to slot
			const context = this.contextPool.acquire()
			slot.assignContext(context)

			if (this.config.verboseLogging) {
				console.log(`[ParallelSubagentManager] Executing request ${request.id} in slot ${slot.getId()}`)
			}

			// Execute
			const startTime = Date.now()
			const result = await slot.execute(request)
			const executionTime = Date.now() - startTime

			// Update stats
			this.stats.successfulExecutions++
			this.stats.totalExecutionTime += executionTime

			// Release context back to pool
			const slotContext = slot.releaseContext()
			if (slotContext) {
				this.contextPool.release(slotContext)
			}

			// Update peak concurrency
			const currentConcurrency = this.getCurrentConcurrency()
			if (currentConcurrency > this.stats.peakConcurrency) {
				this.stats.peakConcurrency = currentConcurrency
			}
		} catch (error) {
			this.stats.failedExecutions++

			// Release context on error
			const slotContext = slot.releaseContext()
			if (slotContext) {
				this.contextPool.release(slotContext)
			}

			throw error
		}
	}

	/**
	 * Start background processing loop
	 */
	private startProcessing(): void {
		if (this.isProcessing) {
			return
		}

		this.isProcessing = true
		this.processQueue().catch((err) => {
			console.error("[ParallelSubagentManager] Processing error:", err)
			this.isProcessing = false
		})
	}

	/**
	 * Background queue processing loop
	 */
	private async processQueue(): Promise<void> {
		while (this.isProcessing) {
			try {
				// Check if we have queued requests and available slots
				if (!this.scheduler.isEmpty()) {
					const availableSlot = this.findAvailableSlot()

					if (availableSlot) {
						const request = this.scheduler.dequeue()

						if (request) {
							// Execute in background (don't await)
							this.executeInSlot(availableSlot, request).catch((err) => {
								console.error(
									`[ParallelSubagentManager] Execution failed for request ${request.id}:`,
									err,
								)
								if (request.onError) {
									request.onError(err instanceof Error ? err : new Error(String(err)))
								}
							})
						}
					}
				}

				// Small delay before next iteration
				await this.sleep(100)
			} catch (error) {
				console.error("[ParallelSubagentManager] Error in processing loop:", error)
				await this.sleep(1000) // Wait longer on error
			}
		}
	}

	/**
	 * Stop background processing
	 */
	stopProcessing(): void {
		this.isProcessing = false
	}

	/**
	 * Get current concurrency (number of busy slots)
	 */
	private getCurrentConcurrency(): number {
		return this.slots.filter((slot) => !slot.isAvailable()).length
	}

	/**
	 * Get execution statistics
	 */
	getStats(): ExecutionStats {
		const currentConcurrency = this.getCurrentConcurrency()
		const avgExecutionTime =
			this.stats.successfulExecutions > 0 ? this.stats.totalExecutionTime / this.stats.successfulExecutions : 0

		const contextPoolStats = this.contextPool.getStats()
		const schedulerStats = this.scheduler.getStats()

		return {
			totalRequests: this.stats.totalRequests,
			currentExecutions: currentConcurrency,
			queuedRequests: schedulerStats.queueSize,
			successfulExecutions: this.stats.successfulExecutions,
			failedExecutions: this.stats.failedExecutions,
			averageExecutionTime: avgExecutionTime,
			peakConcurrency: this.stats.peakConcurrency,
			contextPoolHitRate: contextPoolStats.hitRate,
		}
	}

	/**
	 * Get slot metrics
	 */
	getSlotMetrics(): SlotMetrics[] {
		return this.slots.map((slot) => slot.getMetrics())
	}

	/**
	 * Get scheduler stats
	 */
	getSchedulerStats() {
		return this.scheduler.getStats()
	}

	/**
	 * Get context pool stats
	 */
	getContextPoolStats() {
		return this.contextPool.getStats()
	}

	/**
	 * Get all slot states
	 */
	getAllSlots() {
		return this.slots.map((slot) => slot.getState())
	}

	/**
	 * Get health status
	 */
	getHealth(): {
		healthy: boolean
		issues: string[]
		recommendations: string[]
	} {
		const issues: string[] = []
		const recommendations: string[] = []

		// Check queue size
		const schedulerStats = this.scheduler.getStats()
		if (schedulerStats.queueSize > this.config.scheduler.maxQueueSize * 0.8) {
			issues.push("Queue approaching capacity")
			recommendations.push("Consider increasing max queue size or slot count")
		}

		// Check slot utilization
		const utilization = this.getCurrentConcurrency() / this.config.slotCount
		if (utilization > 0.9) {
			issues.push("High slot utilization")
			recommendations.push("System may be overloaded, consider adding more slots")
		}

		// Check error rate
		const totalCompleted = this.stats.successfulExecutions + this.stats.failedExecutions
		const errorRate = totalCompleted > 0 ? this.stats.failedExecutions / totalCompleted : 0
		if (errorRate > 0.1 && totalCompleted > 10) {
			issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`)
			recommendations.push("Investigate execution failures")
		}

		// Check context pool health
		const poolHealth = this.contextPool.getHealth()
		if (!poolHealth.healthy) {
			issues.push(...poolHealth.issues.map((i) => `Context Pool: ${i}`))
			recommendations.push(...poolHealth.recommendations)
		}

		return {
			healthy: issues.length === 0,
			issues,
			recommendations,
		}
	}

	/**
	 * Dispose and cleanup resources
	 */
	dispose(): void {
		this.stopProcessing()

		// Reset all slots
		for (const slot of this.slots) {
			slot.reset()
		}

		// Clear scheduler
		this.scheduler.clear()

		// Dispose context pool
		this.contextPool.dispose()
	}

	/**
	 * Generate unique request ID
	 */
	private generateRequestId(): string {
		return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Sleep utility
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	/**
	 * Get debug information
	 */
	getDebugInfo(): string {
		const stats = this.getStats()
		const health = this.getHealth()

		const info = [
			"=== ParallelSubagentManager Status ===",
			"",
			"Execution Stats:",
			`  Total Requests: ${stats.totalRequests}`,
			`  Current Executions: ${stats.currentExecutions}/${this.config.slotCount}`,
			`  Queued: ${stats.queuedRequests}`,
			`  Successful: ${stats.successfulExecutions}`,
			`  Failed: ${stats.failedExecutions}`,
			`  Avg Execution Time: ${Math.round(stats.averageExecutionTime)}ms`,
			`  Peak Concurrency: ${stats.peakConcurrency}`,
			`  Context Pool Hit Rate: ${(stats.contextPoolHitRate * 100).toFixed(1)}%`,
			"",
			"Health Status:",
			`  ${health.healthy ? "✓ Healthy" : "⚠ Issues Detected"}`,
		]

		if (health.issues.length > 0) {
			info.push("  Issues:")
			health.issues.forEach((issue) => info.push(`    - ${issue}`))
		}

		if (health.recommendations.length > 0) {
			info.push("  Recommendations:")
			health.recommendations.forEach((rec) => info.push(`    - ${rec}`))
		}

		info.push("")
		info.push(this.scheduler.getDebugInfo())
		info.push("")
		info.push(this.contextPool.getDebugInfo())

		return info.join("\n")
	}
}
