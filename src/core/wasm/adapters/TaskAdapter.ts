/**
 * TaskAdapter - TypeScript Task与Rust WASM Task Engine之间的适配器
 *
 * 职责：
 * 1. 将TypeScript Task状态映射到Rust Task状态
 * 2. 处理Task生命周期事件（start, pause, resume, abort, complete）
 * 3. 提供Fallback机制（WASM失败时回退到TypeScript实现）
 * 4. 管理Task持久化（使用safeWriteJson）
 */

import { Task as WasmTask, TaskStatus as WasmTaskStatus } from "../../../../rust-wasm/wasm-dist/roo_core_wasm"
import { HostInterface } from "../host/HostInterface"
import { TaskStatus } from "@roo-code/types"
import { safeWriteJson } from "../../../utils/safeWriteJson"

/**
 * TaskAdapter配置
 */
export interface TaskAdapterConfig {
	enableWasm: boolean // 是否启用WASM模式
	enableFallback: boolean // 是否启用Fallback
	persistencePath?: string // 任务持久化路径
	maxRetries?: number // 最大重试次数
}

/**
 * Task状态同步数据
 */
export interface TaskStateSync {
	taskId: string
	status: TaskStatus
	mode: string
	parentTaskId?: string
	metadata: {
		createdAt: number
		updatedAt: number
		errorCount: number
		lastError?: string
	}
}

/**
 * TaskAdapter - TypeScript与Rust WASM的桥接层
 */
export class TaskAdapter {
	private wasmTask?: WasmTask
	private hostInterface: HostInterface
	private config: TaskAdapterConfig
	private taskId: string
	private currentStatus: TaskStatus
	private fallbackMode: boolean = false
	private errorCount: number = 0
	private createdAt: number
	private updatedAt: number

	constructor(
		taskId: string,
		mode: string,
		hostInterface: HostInterface,
		config: TaskAdapterConfig,
		parentTaskId?: string,
	) {
		this.taskId = taskId
		this.hostInterface = hostInterface
		this.config = {
			maxRetries: 3,
			...config,
			enableFallback: config.enableFallback ?? true,
		}
		this.currentStatus = TaskStatus.Idle
		this.createdAt = Date.now()
		this.updatedAt = Date.now()

		// 初始化WASM Task（如果启用）
		if (this.config.enableWasm) {
			try {
				this.wasmTask = new WasmTask(mode, parentTaskId)
				this.hostInterface.log("info", `[TaskAdapter] WASM Task initialized: ${this.taskId}`)
			} catch (error) {
				// 初始化失败时立即切换到Fallback模式
				if (this.config.enableFallback) {
					this.fallbackMode = true
					this.errorCount++
					const errorMessage = error instanceof Error ? error.message : String(error)
					this.hostInterface.log(
						"error",
						`[TaskAdapter] WASM error during initialization: ${errorMessage} (count: ${this.errorCount})`,
					)
					this.hostInterface.log("warn", `[TaskAdapter] Using fallback mode for task: ${this.taskId}`)
				}
			}
		}
	}

	/**
	 * 启动任务
	 */
	async start(initialMessage: string): Promise<void> {
		if (this.fallbackMode) {
			// Fallback模式：使用TypeScript实现
			this.hostInterface.log("info", `[TaskAdapter] Starting task in fallback mode: ${this.taskId}`)
			this.currentStatus = TaskStatus.Running
			this.updatedAt = Date.now()
			await this.syncState()
			return
		}

		try {
			if (!this.wasmTask) {
				throw new Error("WASM Task not initialized")
			}

			await this.wasmTask.start(initialMessage)
			this.currentStatus = TaskStatus.Running
			this.updatedAt = Date.now()
			this.hostInterface.log("info", `[TaskAdapter] Task started: ${this.taskId}`)
			await this.syncState()
		} catch (error) {
			await this.handleWasmError("start", error)

			if (this.fallbackMode) {
				// 已切换到Fallback模式，继续执行
				this.currentStatus = TaskStatus.Running
				this.updatedAt = Date.now()
				await this.syncState()
			} else if (!this.config.enableFallback) {
				throw error
			}
		}
	}

	/**
	 * 暂停任务
	 */
	async pause(): Promise<void> {
		if (this.fallbackMode) {
			this.currentStatus = TaskStatus.Idle
			await this.syncState()
			return
		}

		try {
			if (!this.wasmTask) {
				throw new Error("WASM Task not initialized")
			}

			await this.wasmTask.pause()
			this.currentStatus = TaskStatus.Idle
			this.updatedAt = Date.now()
			this.hostInterface.log("info", `[TaskAdapter] Task paused: ${this.taskId}`)
			await this.syncState()
		} catch (error) {
			await this.handleWasmError("pause", error)

			if (this.fallbackMode) {
				this.currentStatus = TaskStatus.Idle
				this.updatedAt = Date.now()
				await this.syncState()
			} else if (!this.config.enableFallback) {
				throw error
			}
		}
	}

	/**
	 * 恢复任务
	 */
	async resume(): Promise<void> {
		if (this.fallbackMode) {
			this.currentStatus = TaskStatus.Running
			await this.syncState()
			return
		}

		try {
			if (!this.wasmTask) {
				throw new Error("WASM Task not initialized")
			}

			await this.wasmTask.resume()
			this.currentStatus = TaskStatus.Running
			this.updatedAt = Date.now()
			this.hostInterface.log("info", `[TaskAdapter] Task resumed: ${this.taskId}`)
			await this.syncState()
		} catch (error) {
			await this.handleWasmError("resume", error)

			if (this.fallbackMode) {
				this.currentStatus = TaskStatus.Running
				this.updatedAt = Date.now()
				await this.syncState()
			} else if (!this.config.enableFallback) {
				throw error
			}
		}
	}

	/**
	 * 中止任务
	 */
	async abort(reason: string): Promise<void> {
		if (this.fallbackMode) {
			this.currentStatus = TaskStatus.Idle
			await this.syncState()
			return
		}

		try {
			if (!this.wasmTask) {
				throw new Error("WASM Task not initialized")
			}

			await this.wasmTask.abort(reason)
			this.currentStatus = TaskStatus.Idle
			this.updatedAt = Date.now()
			this.hostInterface.log("warn", `[TaskAdapter] Task aborted: ${this.taskId}, reason: ${reason}`)
			await this.syncState()
		} catch (error) {
			await this.handleWasmError("abort", error)

			if (this.fallbackMode) {
				this.currentStatus = TaskStatus.Idle
				this.updatedAt = Date.now()
				await this.syncState()
			} else if (!this.config.enableFallback) {
				throw error
			}
		}
	}

	/**
	 * 完成任务
	 */
	async complete(): Promise<void> {
		if (this.fallbackMode) {
			this.currentStatus = TaskStatus.Idle
			await this.syncState()
			return
		}

		try {
			if (!this.wasmTask) {
				throw new Error("WASM Task not initialized")
			}

			await this.wasmTask.complete()
			this.currentStatus = TaskStatus.Idle
			this.updatedAt = Date.now()
			this.hostInterface.log("info", `[TaskAdapter] Task completed: ${this.taskId}`)
			await this.syncState()
		} catch (error) {
			await this.handleWasmError("complete", error)

			if (this.fallbackMode) {
				this.currentStatus = TaskStatus.Idle
				this.updatedAt = Date.now()
				await this.syncState()
			} else if (!this.config.enableFallback) {
				throw error
			}
		}
	}

	/**
	 * 获取当前任务状态
	 */
	getStatus(): TaskStatus {
		// 始终返回currentStatus，因为它在每个操作中都会同步更新
		// WASM对象的status可能不会立即反映状态变化
		return this.currentStatus
	}

	/**
	 * 检查是否处于Fallback模式
	 */
	isFallbackMode(): boolean {
		return this.fallbackMode
	}

	/**
	 * 获取错误计数
	 */
	getErrorCount(): number {
		return this.errorCount
	}

	/**
	 * 重置错误计数
	 */
	resetErrorCount(): void {
		this.errorCount = 0
	}

	/**
	 * 清理资源
	 */
	dispose(): void {
		try {
			if (this.wasmTask) {
				// Rust WASM对象会自动清理
				this.wasmTask = undefined
			}
			this.hostInterface.log("info", `[TaskAdapter] Task disposed: ${this.taskId}`)
		} catch (error) {
			this.hostInterface.log("error", `[TaskAdapter] Error disposing task: ${error}`)
		}
	}

	// ==================== 私有方法 ====================

	/**
	 * 处理WASM错误
	 */
	private async handleWasmError(operation: string, error: any): Promise<void> {
		this.errorCount++
		this.updatedAt = Date.now()
		const errorMessage = error instanceof Error ? error.message : String(error)

		this.hostInterface.log(
			"error",
			`[TaskAdapter] WASM error during ${operation}: ${errorMessage} (count: ${this.errorCount})`,
		)

		// 同步错误状态（在切换Fallback之前）
		await this.syncState(errorMessage)

		// 检查是否应该切换到Fallback模式
		if (this.config.enableFallback && !this.fallbackMode && this.errorCount >= (this.config.maxRetries || 3)) {
			this.fallbackMode = true
			this.hostInterface.log("warn", `[TaskAdapter] Switching to fallback mode for task: ${this.taskId}`)
		}
	}

	/**
	 * 映射WASM状态到TypeScript状态
	 */
	private mapWasmStatusToTaskStatus(wasmStatus: WasmTaskStatus): TaskStatus {
		switch (wasmStatus) {
			case WasmTaskStatus.Idle:
				return TaskStatus.Idle
			case WasmTaskStatus.Running:
				return TaskStatus.Running
			case WasmTaskStatus.Paused:
				return TaskStatus.Idle
			case WasmTaskStatus.Completed:
				return TaskStatus.Idle
			case WasmTaskStatus.Aborted:
				return TaskStatus.Idle
			default:
				return TaskStatus.Idle
		}
	}

	/**
	 * 同步状态到持久化存储
	 * 使用safeWriteJson确保原子性写入
	 */
	private async syncState(lastError?: string): Promise<void> {
		if (!this.config.persistencePath) {
			return
		}

		try {
			const stateData: TaskStateSync = {
				taskId: this.taskId,
				status: this.currentStatus,
				mode: this.fallbackMode ? "fallback" : "wasm",
				metadata: {
					createdAt: this.createdAt,
					updatedAt: this.updatedAt,
					errorCount: this.errorCount,
					lastError,
				},
			}

			const statePath = `${this.config.persistencePath}/${this.taskId}-state.json`
			await safeWriteJson(statePath, stateData)
		} catch (error) {
			// 状态同步失败不应该影响主流程
			this.hostInterface.log("error", `[TaskAdapter] Failed to sync state: ${error}`)
		}
	}

	/**
	 * 从持久化存储加载状态
	 */
	static async loadState(
		taskId: string,
		persistencePath: string,
		hostInterface: HostInterface,
	): Promise<TaskStateSync | null> {
		try {
			const statePath = `${persistencePath}/${taskId}-state.json`
			const exists = await hostInterface.fileExists(statePath)

			if (!exists) {
				return null
			}

			const data = await hostInterface.readJson(statePath)
			return data as TaskStateSync
		} catch (error) {
			hostInterface.log("error", `[TaskAdapter] Failed to load state: ${error}`)
			return null
		}
	}
}
