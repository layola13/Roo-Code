/**
 * CompressionQueue - Lightweight background compression queue
 *
 * Optimized for VSCode extension environment (no external dependencies like Redis/Bull)
 * Provides:
 * - Priority-based task processing (high/medium/low)
 * - Asynchronous non-blocking execution
 * - Retry mechanism for failed tasks
 * - Queue status monitoring
 */

import { SubagentExecutor } from "../executor/SubagentExecutor"
import { CompressionTask, CompressionResult, Priority, SubagentParams, AgentContext } from "../types"

/**
 * Queue task wrapper with status tracking
 */
interface QueuedTask {
	task: CompressionTask
	status: "pending" | "processing" | "completed" | "failed"
	attempts: number
	maxAttempts: number
	error?: string
	result?: CompressionResult
	addedAt: number
	startedAt?: number
	completedAt?: number
}

/**
 * Queue configuration options
 */
export interface CompressionQueueOptions {
	/** Maximum number of concurrent tasks */
	concurrency?: number
	/** Maximum retry attempts for failed tasks */
	maxRetries?: number
	/** Enable verbose logging */
	verboseLogging?: boolean
	/** Maximum queue size (prevent memory overflow) */
	maxQueueSize?: number
}

/**
 * Queue statistics
 */
export interface QueueStats {
	pending: number
	processing: number
	completed: number
	failed: number
	totalProcessed: number
	averageProcessingTime: number
	queueSize: number
}

/**
 * CompressionQueue - Manages background compression tasks
 */
export class CompressionQueue {
	private queue: QueuedTask[] = []
	private executor: SubagentExecutor
	private options: Required<CompressionQueueOptions>
	private processing: Set<string> = new Set()
	private isProcessing = false
	private stats = {
		totalProcessed: 0,
		totalTime: 0,
		completed: 0,
		failed: 0,
	}

	constructor(executor: SubagentExecutor, options: CompressionQueueOptions = {}) {
		this.executor = executor
		this.options = {
			concurrency: 2, // Max 2 concurrent compressions
			maxRetries: 3,
			verboseLogging: false,
			maxQueueSize: 50, // Prevent memory overflow
			...options,
		}
	}

	/**
	 * Enqueue a compression task
	 */
	async enqueue(task: CompressionTask): Promise<void> {
		// Check queue size limit
		if (this.queue.length >= this.options.maxQueueSize) {
			if (this.options.verboseLogging) {
				console.warn(
					`[CompressionQueue] Queue full (${this.options.maxQueueSize}), removing oldest low-priority task`,
				)
			}
			// Remove oldest low-priority task
			this.removeLowestPriorityTask()
		}

		const queuedTask: QueuedTask = {
			task,
			status: "pending",
			attempts: 0,
			maxAttempts: this.options.maxRetries,
			addedAt: Date.now(),
		}

		this.queue.push(queuedTask)

		// Sort by priority (high -> medium -> low) and creation time
		this.sortQueue()

		if (this.options.verboseLogging) {
			console.log(
				`[CompressionQueue] Task ${task.id} enqueued (priority: ${task.priority}, queue size: ${this.queue.length})`,
			)
		}

		// Start processing if not already running
		this.startProcessing()
	}

	/**
	 * Sort queue by priority and time
	 */
	private sortQueue(): void {
		const priorityValues: Record<Priority, number> = {
			high: 3,
			medium: 2,
			low: 1,
		}

		this.queue.sort((a, b) => {
			// First by priority (descending)
			const priorityDiff = priorityValues[b.task.priority] - priorityValues[a.task.priority]
			if (priorityDiff !== 0) return priorityDiff

			// Then by creation time (ascending - older first)
			return a.addedAt - b.addedAt
		})
	}

	/**
	 * Remove lowest priority task from queue
	 */
	private removeLowestPriorityTask(): void {
		// Find and remove the oldest low-priority pending task
		const lowPriorityIndex = this.queue.findIndex((t) => t.status === "pending" && t.task.priority === "low")

		if (lowPriorityIndex !== -1) {
			this.queue.splice(lowPriorityIndex, 1)
			return
		}

		// If no low priority, remove oldest medium priority
		const mediumPriorityIndex = this.queue.findIndex((t) => t.status === "pending" && t.task.priority === "medium")

		if (mediumPriorityIndex !== -1) {
			this.queue.splice(mediumPriorityIndex, 1)
		}
	}

	/**
	 * Start processing queue
	 */
	private startProcessing(): void {
		if (this.isProcessing) return

		this.isProcessing = true
		this.processQueue().catch((err) => {
			console.error("[CompressionQueue] Processing error:", err)
			this.isProcessing = false
		})
	}

	/**
	 * Process queue tasks
	 */
	private async processQueue(): Promise<void> {
		while (true) {
			// Get pending tasks
			const pendingTasks = this.queue.filter((t) => t.status === "pending")

			if (pendingTasks.length === 0) {
				// No more pending tasks
				this.isProcessing = false
				break
			}

			// Check if we can process more tasks
			if (this.processing.size >= this.options.concurrency) {
				// Wait a bit before checking again
				await this.sleep(100)
				continue
			}

			// Take next task
			const queuedTask = pendingTasks[0]
			this.processing.add(queuedTask.task.id)
			queuedTask.status = "processing"
			queuedTask.startedAt = Date.now()

			// Process in background (don't await)
			this.processTask(queuedTask)
				.then(() => {
					this.processing.delete(queuedTask.task.id)
				})
				.catch((err) => {
					console.error(`[CompressionQueue] Task ${queuedTask.task.id} failed:`, err)
					this.processing.delete(queuedTask.task.id)
				})

			// Small delay before picking next task
			await this.sleep(10)
		}
	}

	/**
	 * Process a single task
	 */
	private async processTask(queuedTask: QueuedTask): Promise<void> {
		const { task } = queuedTask
		queuedTask.attempts++

		if (this.options.verboseLogging) {
			console.log(
				`[CompressionQueue] Processing task ${task.id} (attempt ${queuedTask.attempts}/${queuedTask.maxAttempts})`,
			)
		}

		const startTime = Date.now()

		try {
			// Execute compression strategy steps
			const results: any[] = []

			for (const step of task.strategy.steps) {
				const params: SubagentParams = {
					agent_name: step.agent,
					task: `Compress messages ${task.messageRange[0]} to ${task.messageRange[1]}`,
					options: step.options || {},
				}

				// Create agent context (simplified - in real usage, get from conversation state)
				const context: AgentContext = {
					messages: [], // Should be populated from conversation
					conversationMeta: { messageRange: task.messageRange },
				}

				const result = await this.executor.executeSubagent(params, context)

				results.push({
					agent: step.agent,
					output: result.output,
					weight: step.weight,
					tokensUsed: result.tokensUsed,
				})
			}

			// Merge results
			const compressedContext = this.mergeResults(results)
			const tokensReduced = this.calculateTokenReduction(results)

			// Mark as completed
			queuedTask.status = "completed"
			queuedTask.completedAt = Date.now()
			queuedTask.result = {
				taskId: task.id,
				success: true,
				compressedContext,
				tokensReduced,
			}

			// Update stats
			this.stats.totalProcessed++
			this.stats.completed++
			this.stats.totalTime += Date.now() - startTime

			if (this.options.verboseLogging) {
				console.log(
					`[CompressionQueue] Task ${task.id} completed (${Date.now() - startTime}ms, ${tokensReduced} tokens saved)`,
				)
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			queuedTask.error = errorMessage

			// Retry if attempts remaining
			if (queuedTask.attempts < queuedTask.maxAttempts) {
				queuedTask.status = "pending"

				if (this.options.verboseLogging) {
					console.log(
						`[CompressionQueue] Task ${task.id} failed, will retry (${queuedTask.attempts}/${queuedTask.maxAttempts})`,
					)
				}

				// Re-sort queue (task goes back to pending)
				this.sortQueue()
			} else {
				// Max attempts reached
				queuedTask.status = "failed"
				queuedTask.completedAt = Date.now()
				this.stats.totalProcessed++
				this.stats.failed++

				console.error(
					`[CompressionQueue] Task ${task.id} failed after ${queuedTask.maxAttempts} attempts:`,
					errorMessage,
				)
			}
		}
	}

	/**
	 * Merge subagent results into compressed context
	 */
	private mergeResults(results: any[]): string {
		let merged = "# Compressed Context\n\n"

		results.forEach(({ agent, output, weight }) => {
			merged += `## ${agent} (weight: ${weight})\n`

			if (typeof output === "string") {
				merged += output + "\n\n"
			} else {
				merged += JSON.stringify(output, null, 2) + "\n\n"
			}
		})

		return merged
	}

	/**
	 * Calculate token reduction from results
	 */
	private calculateTokenReduction(results: any[]): number {
		// Simplified calculation
		return results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0)
	}

	/**
	 * Get queue statistics
	 */
	getStats(): QueueStats {
		const pending = this.queue.filter((t) => t.status === "pending").length
		const processing = this.queue.filter((t) => t.status === "processing").length
		const completed = this.queue.filter((t) => t.status === "completed").length
		const failed = this.queue.filter((t) => t.status === "failed").length

		return {
			pending,
			processing,
			completed,
			failed,
			totalProcessed: this.stats.totalProcessed,
			averageProcessingTime: this.stats.totalProcessed > 0 ? this.stats.totalTime / this.stats.totalProcessed : 0,
			queueSize: this.queue.length,
		}
	}

	/**
	 * Get task status by ID
	 */
	getTaskStatus(taskId: string): QueuedTask | undefined {
		return this.queue.find((t) => t.task.id === taskId)
	}

	/**
	 * Clear completed and failed tasks from queue
	 */
	cleanup(): void {
		const before = this.queue.length
		this.queue = this.queue.filter((t) => t.status === "pending" || t.status === "processing")

		if (this.options.verboseLogging) {
			console.log(`[CompressionQueue] Cleaned up ${before - this.queue.length} finished tasks`)
		}
	}

	/**
	 * Clear all tasks and reset queue
	 */
	clear(): void {
		this.queue = []
		this.processing.clear()
		this.isProcessing = false

		if (this.options.verboseLogging) {
			console.log("[CompressionQueue] Queue cleared")
		}
	}

	/**
	 * Check if queue is empty
	 */
	isEmpty(): boolean {
		return this.queue.filter((t) => t.status === "pending" || t.status === "processing").length === 0
	}

	/**
	 * Wait for all tasks to complete
	 */
	async waitForCompletion(timeoutMs: number = 30000): Promise<void> {
		const startTime = Date.now()

		while (!this.isEmpty()) {
			if (Date.now() - startTime > timeoutMs) {
				throw new Error(`Queue processing timeout after ${timeoutMs}ms`)
			}
			await this.sleep(100)
		}
	}

	/**
	 * Sleep utility
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}
}
