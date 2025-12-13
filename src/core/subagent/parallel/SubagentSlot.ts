/**
 * SubagentSlot - Represents a single execution slot for parallel subagent execution
 *
 * Each slot can execute one subagent at a time with its own isolated context.
 * Provides lifecycle management, error handling, and metrics tracking.
 */

import { SubagentExecutor } from "../executor/SubagentExecutor"
import { IsolatedContext } from "./IsolatedContext"
import {
	SubagentSlot as ISubagentSlot,
	SlotStatus,
	ParallelSubagentRequest,
	ParallelExecutionResult,
	ParallelExecutionError,
	ParallelExecutionException,
} from "./types"

/**
 * SubagentSlot class
 * Manages the execution lifecycle of a single subagent slot
 */
export class SubagentSlot {
	private state: ISubagentSlot
	private executor: SubagentExecutor
	private context: IsolatedContext | null = null
	private abortController: AbortController | null = null

	constructor(id: number, executor: SubagentExecutor) {
		this.executor = executor
		this.state = {
			id,
			status: "idle",
			totalExecutions: 0,
			totalExecutionTime: 0,
		}
	}

	/**
	 * Get slot ID
	 */
	getId(): number {
		return this.state.id
	}

	/**
	 * Get current status
	 */
	getStatus(): SlotStatus {
		return this.state.status
	}

	/**
	 * Check if slot is available for execution
	 */
	isAvailable(): boolean {
		return this.state.status === "idle"
	}

	/**
	 * Get current request being executed
	 */
	getCurrentRequest(): ParallelSubagentRequest | undefined {
		return this.state.currentRequest
	}

	/**
	 * Assign a context to this slot
	 */
	assignContext(context: IsolatedContext): void {
		this.context = context
		this.state.context = context.getState()
	}

	/**
	 * Execute a request in this slot
	 */
	async execute(request: ParallelSubagentRequest): Promise<ParallelExecutionResult> {
		if (!this.isAvailable()) {
			throw new ParallelExecutionException(
				ParallelExecutionError.SLOT_ERROR,
				`Slot ${this.state.id} is not available`,
				request.id,
			)
		}

		if (!this.context) {
			throw new ParallelExecutionException(
				ParallelExecutionError.CONTEXT_ERROR,
				`No context assigned to slot ${this.state.id}`,
				request.id,
			)
		}

		// Mark slot as busy
		this.state.status = "busy"
		this.state.currentRequest = request
		this.state.startTime = Date.now()
		this.abortController = new AbortController()

		const queueTime = Date.now() - request.createdAt

		try {
			// Initialize context with request context
			this.context.initialize(request.context)

			// Execute the subagent
			const result = await this.executor.executeSubagent(request.params, this.context.getContext())

			// Calculate metrics
			const executionTime = Date.now() - this.state.startTime
			this.state.totalExecutions++
			this.state.totalExecutionTime += executionTime

			// Mark as idle
			this.state.status = "idle"
			this.state.currentRequest = undefined
			this.state.startTime = undefined
			this.abortController = null

			// Build result
			const parallelResult: ParallelExecutionResult = {
				...result,
				requestId: request.id,
				slotId: this.state.id,
				queueTime,
				executionTime,
				contextReused: this.context.getTokenCount() > 0,
			}

			// Call completion callback if provided
			if (request.onComplete) {
				try {
					request.onComplete(result)
				} catch (err) {
					console.error(`[SubagentSlot] Error in onComplete callback:`, err)
				}
			}

			return parallelResult
		} catch (error) {
			// Mark as error
			this.state.status = "error"
			const executionTime = Date.now() - (this.state.startTime || Date.now())

			// Call error callback if provided
			if (request.onError) {
				try {
					request.onError(error instanceof Error ? error : new Error(String(error)))
				} catch (err) {
					console.error(`[SubagentSlot] Error in onError callback:`, err)
				}
			}

			// Reset to idle after error
			setTimeout(() => {
				if (this.state.status === "error") {
					this.state.status = "idle"
					this.state.currentRequest = undefined
					this.state.startTime = undefined
				}
			}, 1000)

			throw new ParallelExecutionException(
				ParallelExecutionError.EXECUTION_ERROR,
				error instanceof Error ? error.message : String(error),
				request.id,
			)
		}
	}

	/**
	 * Abort current execution
	 */
	abort(): void {
		if (this.abortController) {
			this.abortController.abort()
			this.abortController = null
		}

		this.state.status = "idle"
		this.state.currentRequest = undefined
		this.state.startTime = undefined
	}

	/**
	 * Reset slot to idle state
	 */
	reset(): void {
		this.abort()
		if (this.context) {
			this.context.reset()
			this.context = null
		}
		this.state.context = undefined
	}

	/**
	 * Get slot metrics
	 */
	getMetrics(): {
		slotId: number
		status: SlotStatus
		totalExecutions: number
		averageTime: number
		currentExecutionTime: number | null
		utilization: number
	} {
		const currentExecutionTime = this.state.startTime ? Date.now() - this.state.startTime : null

		const averageTime =
			this.state.totalExecutions > 0 ? this.state.totalExecutionTime / this.state.totalExecutions : 0

		return {
			slotId: this.state.id,
			status: this.state.status,
			totalExecutions: this.state.totalExecutions,
			averageTime,
			currentExecutionTime,
			utilization: this.calculateUtilization(),
		}
	}

	/**
	 * Calculate slot utilization
	 * Returns value between 0 and 1 representing how busy the slot is
	 */
	private calculateUtilization(): number {
		// Simple utilization: busy = 1.0, idle = 0.0, error = 0.5
		switch (this.state.status) {
			case "busy":
				return 1.0
			case "idle":
				return 0.0
			case "error":
				return 0.5
			default:
				return 0.0
		}
	}

	/**
	 * Get slot state
	 */
	getState(): ISubagentSlot {
		return {
			...this.state,
			context: this.context ? this.context.getState() : undefined,
		}
	}

	/**
	 * Get context if assigned
	 */
	getContext(): IsolatedContext | null {
		return this.context
	}

	/**
	 * Release context from slot
	 */
	releaseContext(): IsolatedContext | null {
		const ctx = this.context
		this.context = null
		this.state.context = undefined
		return ctx
	}

	/**
	 * Check if slot has been idle for a certain duration
	 */
	isIdleFor(durationMs: number): boolean {
		if (this.state.status !== "idle") {
			return false
		}

		if (!this.state.startTime) {
			return true // Never executed, considered idle
		}

		return Date.now() - this.state.startTime > durationMs
	}

	/**
	 * Get slot information for debugging
	 */
	getDebugInfo(): string {
		const info = [
			`Slot ${this.state.id}:`,
			`  Status: ${this.state.status}`,
			`  Total Executions: ${this.state.totalExecutions}`,
			`  Avg Execution Time: ${this.state.totalExecutions > 0 ? Math.round(this.state.totalExecutionTime / this.state.totalExecutions) : 0}ms`,
		]

		if (this.state.currentRequest) {
			info.push(`  Current Request: ${this.state.currentRequest.id}`)
			info.push(`  Agent: ${this.state.currentRequest.params.agent_name}`)
			info.push(`  Priority: ${this.state.currentRequest.priority}`)
		}

		if (this.context) {
			const meta = this.context.getMetadata()
			info.push(`  Context: ${meta.id}`)
			info.push(`  Messages: ${meta.messageCount}`)
			info.push(`  Tokens: ${meta.tokenCount}/${meta.tokenCount}`)
		}

		return info.join("\n")
	}
}
