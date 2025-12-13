/**
 * DynamicScheduler - Dynamic request scheduling with priority queue
 *
 * Manages the queue of pending requests and dynamically schedules them
 * based on priority and available slots.
 */

import { Priority } from "../types"
import {
	ParallelSubagentRequest,
	QueueItem,
	SchedulerConfig,
	SchedulerStats,
	ParallelExecutionError,
	ParallelExecutionException,
} from "./types"

/**
 * Priority levels as numeric values for sorting
 */
const PRIORITY_VALUES: Record<Priority, number> = {
	high: 3,
	medium: 2,
	low: 1,
}

/**
 * DynamicScheduler class
 * Implements priority-based scheduling with dynamic queue management
 */
export class DynamicScheduler {
	private queue: QueueItem[] = []
	private config: Required<SchedulerConfig>
	private stats = {
		totalEnqueued: 0,
		totalDequeued: 0,
		totalQueueTime: 0,
		priorityCounts: {
			high: 0,
			medium: 0,
			low: 0,
		},
	}

	constructor(config: Partial<SchedulerConfig> = {}) {
		this.config = {
			maxConcurrent: config.maxConcurrent ?? 10,
			maxQueueSize: config.maxQueueSize ?? 100,
			enablePriority: config.enablePriority ?? true,
			queueTimeout: config.queueTimeout ?? 60_000, // 60 seconds
		}
	}

	/**
	 * Enqueue a request
	 */
	enqueue(request: ParallelSubagentRequest): void {
		// Check queue size limit
		if (this.queue.length >= this.config.maxQueueSize) {
			throw new ParallelExecutionException(
				ParallelExecutionError.QUEUE_FULL,
				`Queue is full (${this.config.maxQueueSize} items)`,
				request.id,
			)
		}

		// Create queue item
		const item: QueueItem = {
			request,
			queuedAt: Date.now(),
			attempts: 0,
		}

		this.queue.push(item)
		this.stats.totalEnqueued++
		this.stats.priorityCounts[request.priority]++

		// Sort queue by priority if enabled
		if (this.config.enablePriority) {
			this.sortQueue()
		}
	}

	/**
	 * Dequeue the next request
	 * Returns the highest priority request or null if queue is empty
	 */
	dequeue(): ParallelSubagentRequest | null {
		// Remove timed-out requests first
		this.removeTimedOutRequests()

		if (this.queue.length === 0) {
			return null
		}

		// Get first item (highest priority if sorted)
		const item = this.queue.shift()

		if (!item) {
			return null
		}

		// Update stats
		this.stats.totalDequeued++
		const queueTime = Date.now() - item.queuedAt
		this.stats.totalQueueTime += queueTime
		this.stats.priorityCounts[item.request.priority]--

		return item.request
	}

	/**
	 * Peek at the next request without removing it
	 */
	peek(): ParallelSubagentRequest | null {
		if (this.queue.length === 0) {
			return null
		}
		return this.queue[0].request
	}

	/**
	 * Check if queue is empty
	 */
	isEmpty(): boolean {
		return this.queue.length === 0
	}

	/**
	 * Get current queue size
	 */
	size(): number {
		return this.queue.length
	}

	/**
	 * Sort queue by priority (high -> medium -> low) and then by creation time
	 */
	private sortQueue(): void {
		this.queue.sort((a, b) => {
			// First by priority (descending)
			const priorityDiff = PRIORITY_VALUES[b.request.priority] - PRIORITY_VALUES[a.request.priority]
			if (priorityDiff !== 0) {
				return priorityDiff
			}

			// Then by creation time (ascending - older first)
			return a.request.createdAt - b.request.createdAt
		})
	}

	/**
	 * Remove requests that have exceeded the queue timeout
	 */
	private removeTimedOutRequests(): void {
		const now = Date.now()
		const beforeSize = this.queue.length

		this.queue = this.queue.filter((item) => {
			const queueTime = now - item.queuedAt
			if (queueTime > this.config.queueTimeout) {
				// Call error callback if provided
				if (item.request.onError) {
					const error = new ParallelExecutionException(
						ParallelExecutionError.TIMEOUT,
						`Request timed out after ${queueTime}ms in queue`,
						item.request.id,
					)
					try {
						item.request.onError(error)
					} catch (err) {
						console.error(`[DynamicScheduler] Error in timeout callback:`, err)
					}
				}
				return false // Remove from queue
			}
			return true // Keep in queue
		})

		const removedCount = beforeSize - this.queue.length
		if (removedCount > 0) {
			console.warn(`[DynamicScheduler] Removed ${removedCount} timed-out requests from queue`)
		}
	}

	/**
	 * Remove a specific request from the queue
	 */
	remove(requestId: string): boolean {
		const index = this.queue.findIndex((item) => item.request.id === requestId)
		if (index === -1) {
			return false
		}

		const removed = this.queue.splice(index, 1)[0]
		this.stats.priorityCounts[removed.request.priority]--
		return true
	}

	/**
	 * Clear all requests from the queue
	 */
	clear(): void {
		this.queue = []
		this.stats.priorityCounts = { high: 0, medium: 0, low: 0 }
	}

	/**
	 * Get scheduler statistics
	 */
	getStats(): SchedulerStats {
		const avgQueueTime = this.stats.totalDequeued > 0 ? this.stats.totalQueueTime / this.stats.totalDequeued : 0

		return {
			queueSize: this.queue.length,
			totalEnqueued: this.stats.totalEnqueued,
			totalDequeued: this.stats.totalDequeued,
			averageQueueTime: avgQueueTime,
			priorityBreakdown: { ...this.stats.priorityCounts },
		}
	}

	/**
	 * Get all queued requests
	 */
	getQueuedRequests(): ParallelSubagentRequest[] {
		return this.queue.map((item) => item.request)
	}

	/**
	 * Get requests by priority
	 */
	getRequestsByPriority(priority: Priority): ParallelSubagentRequest[] {
		return this.queue.filter((item) => item.request.priority === priority).map((item) => item.request)
	}

	/**
	 * Find request by ID
	 */
	findRequest(requestId: string): ParallelSubagentRequest | null {
		const item = this.queue.find((item) => item.request.id === requestId)
		return item ? item.request : null
	}

	/**
	 * Get queue position for a request
	 */
	getPosition(requestId: string): number {
		const index = this.queue.findIndex((item) => item.request.id === requestId)
		return index === -1 ? -1 : index + 1 // Return 1-based position
	}

	/**
	 * Estimate wait time for a request based on its position
	 */
	estimateWaitTime(requestId: string): number {
		const position = this.getPosition(requestId)
		if (position === -1) {
			return 0
		}

		// Estimate based on average queue time and position
		const stats = this.getStats()
		const avgTime = stats.averageQueueTime || 5000 // Default 5s if no data

		// Requests ahead * average execution time
		return (position - 1) * avgTime
	}

	/**
	 * Update scheduler configuration
	 */
	updateConfig(config: Partial<SchedulerConfig>): void {
		const oldMaxQueue = this.config.maxQueueSize

		this.config = {
			...this.config,
			...config,
		}

		// If max queue size decreased, remove excess items (lowest priority first)
		if (config.maxQueueSize !== undefined && this.queue.length > config.maxQueueSize) {
			this.trimQueue(config.maxQueueSize)
		}

		// If priority was enabled, re-sort queue
		if (config.enablePriority && !this.config.enablePriority) {
			this.sortQueue()
		}
	}

	/**
	 * Trim queue to specified size by removing lowest priority items
	 */
	private trimQueue(targetSize: number): void {
		if (this.queue.length <= targetSize) {
			return
		}

		// Sort by priority (low priority first for removal)
		const sortedForRemoval = [...this.queue].sort((a, b) => {
			const priorityDiff = PRIORITY_VALUES[a.request.priority] - PRIORITY_VALUES[b.request.priority]
			if (priorityDiff !== 0) {
				return priorityDiff
			}
			return b.queuedAt - a.queuedAt // Remove newer items first within same priority
		})

		const toRemove = this.queue.length - targetSize
		const removeIds = new Set(sortedForRemoval.slice(0, toRemove).map((item) => item.request.id))

		// Remove items and notify via error callback
		this.queue = this.queue.filter((item) => {
			if (removeIds.has(item.request.id)) {
				if (item.request.onError) {
					const error = new ParallelExecutionException(
						ParallelExecutionError.QUEUE_FULL,
						"Request removed due to queue size limit",
						item.request.id,
					)
					try {
						item.request.onError(error)
					} catch (err) {
						console.error(`[DynamicScheduler] Error in removal callback:`, err)
					}
				}
				this.stats.priorityCounts[item.request.priority]--
				return false
			}
			return true
		})
	}

	/**
	 * Get configuration
	 */
	getConfig(): Required<SchedulerConfig> {
		return { ...this.config }
	}

	/**
	 * Get debug information
	 */
	getDebugInfo(): string {
		const stats = this.getStats()

		const info = [
			"DynamicScheduler Status:",
			`  Queue Size: ${stats.queueSize}/${this.config.maxQueueSize}`,
			`  Total Enqueued: ${stats.totalEnqueued}`,
			`  Total Dequeued: ${stats.totalDequeued}`,
			`  Average Queue Time: ${Math.round(stats.averageQueueTime)}ms`,
			`  Priority Breakdown:`,
			`    High: ${stats.priorityBreakdown.high}`,
			`    Medium: ${stats.priorityBreakdown.medium}`,
			`    Low: ${stats.priorityBreakdown.low}`,
		]

		if (this.queue.length > 0) {
			info.push(`  Next Request: ${this.queue[0].request.id} (${this.queue[0].request.priority})`)
		}

		return info.join("\n")
	}
}
