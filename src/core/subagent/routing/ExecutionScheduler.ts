/**
 * ExecutionScheduler - Manages concurrent subagent execution
 *
 * Features:
 * - Priority queue for task scheduling
 * - Concurrent execution with limits
 * - Dependency management
 * - Resource throttling
 */

import { SubagentParams, AgentContext, SubagentResult, SubagentName } from "../types"
import { SubagentExecutor } from "../executor/SubagentExecutor"

export interface ScheduledTask {
	id: string
	params: SubagentParams
	context: AgentContext
	priority: number
	dependencies?: string[] // IDs of tasks that must complete first
	createdAt: number
	startedAt?: number
	completedAt?: number
	status: "pending" | "running" | "completed" | "failed"
	result?: SubagentResult
	error?: string
}

export interface SchedulerOptions {
	maxConcurrent?: number
	priorityLevels?: number
	enableThrottling?: boolean
	throttleMs?: number
}

/**
 * ExecutionScheduler - Manages execution of multiple subagents
 */
export class ExecutionScheduler {
	private tasks: Map<string, ScheduledTask> = new Map()
	private taskQueue: ScheduledTask[] = []
	private runningTasks: Set<string> = new Set()
	private completedTasks: Set<string> = new Set()

	private readonly maxConcurrent: number
	private readonly throttleMs: number
	private lastExecutionTime: number = 0

	constructor(
		private executor: SubagentExecutor,
		options: SchedulerOptions = {},
	) {
		this.maxConcurrent = options.maxConcurrent || 3
		this.throttleMs = options.throttleMs || 100
	}

	/**
	 * Schedule a task for execution
	 */
	scheduleTask(
		params: SubagentParams,
		context: AgentContext,
		options: {
			priority?: number
			dependencies?: string[]
		} = {},
	): string {
		const taskId = this.generateTaskId()
		const task: ScheduledTask = {
			id: taskId,
			params,
			context,
			priority: options.priority || 5,
			dependencies: options.dependencies,
			createdAt: Date.now(),
			status: "pending",
		}

		this.tasks.set(taskId, task)
		this.taskQueue.push(task)
		this.sortQueue()

		return taskId
	}

	/**
	 * Execute all pending tasks
	 */
	async executeAll(): Promise<Map<string, SubagentResult>> {
		while (this.taskQueue.length > 0 || this.runningTasks.size > 0) {
			await this.processQueue()
			await this.sleep(50) // Small delay between iterations
		}

		const results = new Map<string, SubagentResult>()
		for (const [id, task] of this.tasks.entries()) {
			if (task.result) {
				results.set(id, task.result)
			}
		}

		return results
	}

	/**
	 * Execute a single batch of tasks
	 */
	async executeBatch(taskIds: string[]): Promise<Map<string, SubagentResult>> {
		const tasks = taskIds.map((id) => this.tasks.get(id)).filter(Boolean) as ScheduledTask[]

		const results = new Map<string, SubagentResult>()
		for (const task of tasks) {
			if (this.canExecute(task)) {
				const result = await this.executeTask(task)
				results.set(task.id, result)
			}
		}

		return results
	}

	/**
	 * Process the task queue
	 */
	private async processQueue(): Promise<void> {
		// Find tasks that can be executed
		const availableSlots = this.maxConcurrent - this.runningTasks.size
		if (availableSlots <= 0) {
			return
		}

		const executableTasks = this.taskQueue.filter((task) => this.canExecute(task)).slice(0, availableSlots)

		// Execute tasks
		const promises = executableTasks.map((task) => this.executeTask(task))
		await Promise.all(promises)
	}

	/**
	 * Check if a task can be executed
	 */
	private canExecute(task: ScheduledTask): boolean {
		// Check status
		if (task.status !== "pending") {
			return false
		}

		// Check dependencies
		if (task.dependencies && task.dependencies.length > 0) {
			for (const depId of task.dependencies) {
				if (!this.completedTasks.has(depId)) {
					return false
				}
			}
		}

		// Check throttling
		const now = Date.now()
		if (now - this.lastExecutionTime < this.throttleMs) {
			return false
		}

		return true
	}

	/**
	 * Execute a single task
	 */
	private async executeTask(task: ScheduledTask): Promise<SubagentResult> {
		// Mark as running
		task.status = "running"
		task.startedAt = Date.now()
		this.runningTasks.add(task.id)
		this.removeFromQueue(task.id)
		this.lastExecutionTime = Date.now()

		try {
			const result = await this.executor.executeSubagent(task.params, task.context)

			// Mark as completed
			task.status = "completed"
			task.completedAt = Date.now()
			task.result = result
			this.runningTasks.delete(task.id)
			this.completedTasks.add(task.id)

			return result
		} catch (error) {
			// Mark as failed
			task.status = "failed"
			task.completedAt = Date.now()
			task.error = error instanceof Error ? error.message : String(error)
			this.runningTasks.delete(task.id)

			const errorResult: SubagentResult = {
				agentName: task.params.agent_name,
				output: "",
				tokensUsed: 0,
				executionTime: Date.now() - task.startedAt!,
				success: false,
				error: task.error,
			}

			task.result = errorResult
			return errorResult
		}
	}

	/**
	 * Sort queue by priority (descending)
	 */
	private sortQueue(): void {
		this.taskQueue.sort((a, b) => b.priority - a.priority)
	}

	/**
	 * Remove task from queue
	 */
	private removeFromQueue(taskId: string): void {
		const index = this.taskQueue.findIndex((t) => t.id === taskId)
		if (index !== -1) {
			this.taskQueue.splice(index, 1)
		}
	}

	/**
	 * Generate unique task ID
	 */
	private generateTaskId(): string {
		return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Sleep utility
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	/**
	 * Get task by ID
	 */
	getTask(taskId: string): ScheduledTask | undefined {
		return this.tasks.get(taskId)
	}

	/**
	 * Get all tasks with a specific status
	 */
	getTasksByStatus(status: ScheduledTask["status"]): ScheduledTask[] {
		return Array.from(this.tasks.values()).filter((t) => t.status === status)
	}

	/**
	 * Get scheduler statistics
	 */
	getStats(): {
		total: number
		pending: number
		running: number
		completed: number
		failed: number
		queueSize: number
	} {
		const tasks = Array.from(this.tasks.values())
		return {
			total: tasks.length,
			pending: tasks.filter((t) => t.status === "pending").length,
			running: tasks.filter((t) => t.status === "running").length,
			completed: tasks.filter((t) => t.status === "completed").length,
			failed: tasks.filter((t) => t.status === "failed").length,
			queueSize: this.taskQueue.length,
		}
	}

	/**
	 * Clear all tasks
	 */
	clear(): void {
		this.tasks.clear()
		this.taskQueue = []
		this.runningTasks.clear()
		this.completedTasks.clear()
	}

	/**
	 * Cancel a pending task
	 */
	cancelTask(taskId: string): boolean {
		const task = this.tasks.get(taskId)
		if (!task || task.status !== "pending") {
			return false
		}

		task.status = "failed"
		task.error = "Cancelled by user"
		this.removeFromQueue(taskId)
		return true
	}
}
