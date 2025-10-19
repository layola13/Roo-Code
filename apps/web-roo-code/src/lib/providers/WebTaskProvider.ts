/**
 * Web 版本的 TaskProvider
 *
 * 设计原则：
 * 1. 实现与 ClineProvider 相同的接口
 * 2. 使用 API Routes 代替 VSCode Extension API
 * 3. 通过 CloudService 实现配置同步
 */

import { EventEmitter } from "events"
import type {
	TaskProviderLike,
	TaskProviderEvents,
	CreateTaskOptions,
	RooCodeSettings,
	ProviderSettings,
	TaskLike,
	StaticAppProperties,
	GitProperties,
	TelemetryProperties,
} from "@roo-code/types"
import { RooCodeEventName } from "@roo-code/types"

export interface WebProviderConfig {
	apiConfiguration: ProviderSettings
	cloudService?: unknown
	fileProxyEndpoint: string
	userId: string
}

export interface WebTask {
	taskId: string
	instanceId: string
	status: "running" | "completed" | "failed" | "cancelled"
	messages: unknown[]
	createdAt: number
	updatedAt: number
}

/**
 * Web 版本的 TaskProvider
 * 实现与 ClineProvider 相同的接口，但使用 Web API 代替 VSCode API
 */
export class WebTaskProvider extends EventEmitter implements TaskProviderLike {
	private currentTask?: WebTask
	private taskHistory: Map<string, WebTask> = new Map()
	private config: WebProviderConfig

	// 实现 TaskProviderLike 接口的只读属性
	readonly appProperties: StaticAppProperties = {
		appName: "Roo Code Web",
		appVersion: "1.0.0",
		vscodeVersion: "web",
		platform: "web",
		editorName: "web",
	}

	readonly gitProperties: GitProperties | undefined = undefined

	readonly cwd = "/"

	constructor(config: WebProviderConfig) {
		super()
		this.config = config

		// 初始化时从服务器加载任务历史
		this.loadTaskHistory().catch((error) => {
			console.error("[WebTaskProvider] Failed to load task history:", error)
		})
	}

	/**
	 * 从服务器加载任务历史
	 */
	private async loadTaskHistory(): Promise<void> {
		try {
			const response = await fetch("/api/tasks", {
				method: "GET",
				credentials: "include",
			})

			if (!response.ok) {
				throw new Error(`Failed to load task history: ${response.statusText}`)
			}

			const tasks: WebTask[] = await response.json()

			for (const task of tasks) {
				this.taskHistory.set(task.taskId, task)
			}
		} catch (error) {
			console.error("[WebTaskProvider] Error loading task history:", error)
		}
	}

	/**
	 * 创建新任务
	 */
	async createTask(
		text?: string,
		images?: string[],
		parentTask?: TaskLike,
		_options: CreateTaskOptions = {},
		_configuration?: RooCodeSettings,
	): Promise<TaskLike> {
		const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		const instanceId = `instance-${Date.now()}`

		const task: WebTask = {
			taskId,
			instanceId,
			status: "running",
			messages: text ? [{ role: "user", content: text, images }] : [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		}

		// 保存到服务器
		try {
			const response = await fetch("/api/tasks", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({
					taskId: task.taskId,
					instanceId: task.instanceId,
					messages: task.messages,
					configuration: this.config.apiConfiguration,
					userId: this.config.userId,
				}),
			})

			if (!response.ok) {
				throw new Error(`Failed to create task: ${response.statusText}`)
			}

			// 更新本地状态
			this.currentTask = task
			this.taskHistory.set(taskId, task)

			// 触发事件
			this.emit(RooCodeEventName.TaskCreated, task as unknown as TaskLike)
			this.emit(RooCodeEventName.TaskStarted, taskId)

			return task as unknown as TaskLike
		} catch (error) {
			console.error("[WebTaskProvider] Failed to create task:", error)
			throw error
		}
	}

	/**
	 * 取消当前任务
	 */
	async cancelTask(): Promise<void> {
		if (!this.currentTask) {
			return
		}

		const taskId = this.currentTask.taskId

		try {
			const response = await fetch(`/api/tasks/${taskId}/cancel`, {
				method: "POST",
				credentials: "include",
			})

			if (!response.ok) {
				throw new Error(`Failed to cancel task: ${response.statusText}`)
			}

			// 更新本地状态
			if (this.currentTask) {
				this.currentTask.status = "cancelled"
				this.currentTask.updatedAt = Date.now()
			}

			// 触发事件
			this.emit(RooCodeEventName.TaskAborted, taskId)

			this.currentTask = undefined
		} catch (error) {
			console.error("[WebTaskProvider] Failed to cancel task:", error)
			throw error
		}
	}

	/**
	 * 获取当前任务
	 */
	getCurrentTask(): TaskLike | undefined {
		return this.currentTask as unknown as TaskLike
	}

	/**
	 * 恢复任务
	 */
	async resumeTask(taskId: string): Promise<void> {
		const task = this.taskHistory.get(taskId)

		if (!task) {
			throw new Error(`Task not found: ${taskId}`)
		}

		try {
			const response = await fetch(`/api/tasks/${taskId}`, {
				method: "GET",
				credentials: "include",
			})

			if (!response.ok) {
				throw new Error(`Failed to resume task: ${response.statusText}`)
			}

			const taskData = await response.json()

			// 更新本地任务数据
			task.messages = taskData.messages || task.messages
			task.status = taskData.status || task.status
			task.updatedAt = Date.now()

			this.currentTask = task

			// 触发事件
			this.emit(RooCodeEventName.TaskFocused, taskId)
		} catch (error) {
			console.error("[WebTaskProvider] Failed to resume task:", error)
			throw error
		}
	}

	/**
	 * 获取任务历史
	 */
	getTaskHistory(): WebTask[] {
		return Array.from(this.taskHistory.values())
	}

	/**
	 * 删除任务
	 */
	async deleteTask(taskId: string): Promise<void> {
		try {
			const response = await fetch(`/api/tasks/${taskId}`, {
				method: "DELETE",
				credentials: "include",
			})

			if (!response.ok) {
				throw new Error(`Failed to delete task: ${response.statusText}`)
			}

			// 更新本地状态
			this.taskHistory.delete(taskId)

			if (this.currentTask?.taskId === taskId) {
				this.currentTask = undefined
			}
		} catch (error) {
			console.error("[WebTaskProvider] Failed to delete task:", error)
			throw error
		}
	}

	/**
	 * 更新任务消息
	 */
	async updateTaskMessages(taskId: string, messages: unknown[]): Promise<void> {
		const task = this.taskHistory.get(taskId)

		if (!task) {
			throw new Error(`Task not found: ${taskId}`)
		}

		try {
			const response = await fetch(`/api/tasks/${taskId}/messages`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ messages }),
			})

			if (!response.ok) {
				throw new Error(`Failed to update task messages: ${response.statusText}`)
			}

			// 更新本地状态
			task.messages = messages
			task.updatedAt = Date.now()
		} catch (error) {
			console.error("[WebTaskProvider] Failed to update task messages:", error)
			throw error
		}
	}

	/**
	 * 获取最近任务列表
	 */
	getRecentTasks(): string[] {
		return Array.from(this.taskHistory.keys()).slice(-10)
	}

	/**
	 * 清除当前任务
	 */
	async clearTask(): Promise<void> {
		if (this.currentTask) {
			this.currentTask.status = "completed"
			this.currentTask.updatedAt = Date.now()
			this.emit(RooCodeEventName.TaskCompleted, this.currentTask.taskId, undefined, undefined)
		}
		this.currentTask = undefined
	}

	/**
	 * 获取可用模式列表
	 */
	async getModes(): Promise<{ slug: string; name: string }[]> {
		return [
			{ slug: "code", name: "Code" },
			{ slug: "architect", name: "Architect" },
		]
	}

	/**
	 * 获取当前模式
	 */
	async getMode(): Promise<string> {
		return "code"
	}

	/**
	 * 设置模式
	 */
	async setMode(mode: string): Promise<void> {
		this.emit(RooCodeEventName.ModeChanged, mode)
	}

	/**
	 * 获取可用提供商配置列表
	 */
	async getProviderProfiles(): Promise<{ name: string; provider?: string }[]> {
		return [{ name: "default", provider: "anthropic" }]
	}

	/**
	 * 获取当前提供商配置
	 */
	async getProviderProfile(): Promise<string> {
		return "default"
	}

	/**
	 * 设置提供商配置
	 */
	async setProviderProfile(providerProfile: string): Promise<void> {
		this.emit(RooCodeEventName.ProviderProfileChanged, { name: providerProfile })
	}

	/**
	 * 获取遥测属性
	 */
	async getTelemetryProperties(): Promise<TelemetryProperties> {
		return {
			appName: this.appProperties.appName,
			appVersion: this.appProperties.appVersion,
			vscodeVersion: this.appProperties.vscodeVersion,
			platform: this.appProperties.platform,
			editorName: this.appProperties.editorName,
			mode: "code",
			language: "en",
		}
	}

	/**
	 * 发送状态到 WebView
	 */
	async postStateToWebview(): Promise<void> {
		// Web 版本不需要此方法
	}

	/**
	 * 实现 TaskProviderLike 接口所需的方法
	 */
	on<K extends keyof TaskProviderEvents>(
		event: K,
		listener: (...args: TaskProviderEvents[K]) => void | Promise<void>,
	): this {
		return super.on(event, listener as (...args: unknown[]) => void | Promise<void>)
	}

	off<K extends keyof TaskProviderEvents>(
		event: K,
		listener: (...args: TaskProviderEvents[K]) => void | Promise<void>,
	): this {
		return super.off(event, listener as (...args: unknown[]) => void | Promise<void>)
	}

	/**
	 * 清理资源
	 */
	async dispose(): Promise<void> {
		// 清理所有事件监听器
		this.removeAllListeners()

		// 清空任务历史
		this.taskHistory.clear()
		this.currentTask = undefined
	}
}
