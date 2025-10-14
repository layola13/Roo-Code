/**
 * Roo-Code WASM API
 *
 * 为Rust WASM模块提供高级TypeScript接口
 */

import { WasmLoader } from "./WasmLoader"
import { HostInterface } from "./host/HostInterface"
import {
	Task,
	TaskStatus,
	MemoryManager,
	MemoryPriority,
	MemoryType,
	create_conversation_manager,
	add_message,
	get_messages,
	get_stats,
	create_tool_registry,
	get_available_tools,
	register_tool,
	unregister_tool,
} from "../../../rust-wasm/wasm-dist/roo_core_wasm"

/**
 * 任务API
 */
export class TaskAPI {
	private wasmLoader: WasmLoader
	private hostInterface: HostInterface

	constructor(wasmLoader: WasmLoader, hostInterface: HostInterface) {
		this.wasmLoader = wasmLoader
		this.hostInterface = hostInterface
	}

	/**
	 * 创建新任务
	 */
	createTask(taskMode: string, parentTaskId?: string): Task {
		if (!this.wasmLoader.isInitialized()) {
			throw new Error("WASM module not initialized")
		}
		return new Task(taskMode, parentTaskId)
	}

	/**
	 * 启动任务
	 */
	async startTask(task: Task, initialMessage: string): Promise<void> {
		await task.start(initialMessage)
		this.hostInterface.log("info", `Task started: ${task.task_id}`)
	}

	/**
	 * 暂停任务
	 */
	async pauseTask(task: Task): Promise<void> {
		await task.pause()
		this.hostInterface.log("info", `Task paused: ${task.task_id}`)
	}

	/**
	 * 恢复任务
	 */
	async resumeTask(task: Task): Promise<void> {
		await task.resume()
		this.hostInterface.log("info", `Task resumed: ${task.task_id}`)
	}

	/**
	 * 中止任务
	 */
	async abortTask(task: Task, reason: string): Promise<void> {
		await task.abort(reason)
		this.hostInterface.log("warn", `Task aborted: ${task.task_id}, reason: ${reason}`)
	}

	/**
	 * 完成任务
	 */
	async completeTask(task: Task): Promise<void> {
		await task.complete()
		this.hostInterface.log("info", `Task completed: ${task.task_id}`)
	}
}

/**
 * 对话API
 */
export class ConversationAPI {
	private wasmLoader: WasmLoader
	private hostInterface: HostInterface

	constructor(wasmLoader: WasmLoader, hostInterface: HostInterface) {
		this.wasmLoader = wasmLoader
		this.hostInterface = hostInterface
	}

	/**
	 * 创建对话管理器
	 */
	createManager(): any {
		if (!this.wasmLoader.isInitialized()) {
			throw new Error("WASM module not initialized")
		}
		return create_conversation_manager()
	}

	/**
	 * 添加消息
	 */
	addMessage(manager: any, message: any): any {
		return add_message(manager, message)
	}

	/**
	 * 获取所有消息
	 */
	getMessages(manager: any): any {
		return get_messages(manager)
	}

	/**
	 * 获取统计信息
	 */
	getStats(manager: any): any {
		return get_stats(manager)
	}
}

/**
 * 记忆API
 */
export class MemoryAPI {
	private wasmLoader: WasmLoader
	private hostInterface: HostInterface

	constructor(wasmLoader: WasmLoader, hostInterface: HostInterface) {
		this.wasmLoader = wasmLoader
		this.hostInterface = hostInterface
	}

	/**
	 * 创建记忆管理器
	 */
	createManager(taskId: string, config: any): MemoryManager {
		if (!this.wasmLoader.isInitialized()) {
			throw new Error("WASM module not initialized")
		}
		return new MemoryManager(taskId, config)
	}

	/**
	 * 提取记忆
	 */
	extractMemories(manager: MemoryManager, messages: any, timestamp: number): any {
		return manager.extractMemories(messages, timestamp)
	}

	/**
	 * 获取所有记忆
	 */
	getAllMemories(manager: MemoryManager): any {
		return manager.getAllMemories()
	}

	/**
	 * 获取关键记忆
	 */
	getCriticalMemories(manager: MemoryManager): any {
		return manager.getCriticalMemories()
	}

	/**
	 * 按优先级获取记忆
	 */
	getMemoriesByPriority(manager: MemoryManager, priority: MemoryPriority): any {
		return manager.getMemoriesByPriority(this.priorityToString(priority))
	}

	/**
	 * 按类型获取记忆
	 */
	getMemoriesByType(manager: MemoryManager, type: MemoryType): any {
		return manager.getMemoriesByType(this.typeToString(type))
	}

	/**
	 * 生成记忆摘要
	 */
	generateSummary(manager: MemoryManager, timestamp: number): string {
		return manager.generateMemorySummary(timestamp)
	}

	/**
	 * 应用记忆老化
	 */
	applyAging(manager: MemoryManager, currentTime: number): void {
		manager.applyMemoryAging(currentTime)
	}

	/**
	 * 清理低优先级记忆
	 */
	pruneLowPriority(manager: MemoryManager, maxCount: number, currentTime: number): void {
		manager.pruneLowPriorityMemories(maxCount, currentTime)
	}

	/**
	 * 获取记忆统计
	 */
	getStats(manager: MemoryManager, currentTime: number): any {
		return manager.getMemoryStats(currentTime)
	}

	/**
	 * 序列化记忆管理器
	 */
	serialize(manager: MemoryManager): string {
		return manager.serialize()
	}

	/**
	 * 反序列化记忆管理器
	 */
	deserialize(data: string): MemoryManager {
		return MemoryManager.deserialize(data)
	}

	// 辅助方法
	private priorityToString(priority: MemoryPriority): string {
		const map: Record<MemoryPriority, string> = {
			[MemoryPriority.Low]: "low",
			[MemoryPriority.Medium]: "medium",
			[MemoryPriority.High]: "high",
			[MemoryPriority.Critical]: "critical",
		}
		return map[priority]
	}

	private typeToString(type: MemoryType): string {
		const map: Record<MemoryType, string> = {
			[MemoryType.UserInstruction]: "user_instruction",
			[MemoryType.TechnicalDecision]: "technical_decision",
			[MemoryType.Configuration]: "configuration",
			[MemoryType.ImportantError]: "important_error",
			[MemoryType.ProjectContext]: "project_context",
			[MemoryType.WorkflowPattern]: "workflow_pattern",
		}
		return map[type]
	}
}

/**
 * 工具API
 */
export class ToolsAPI {
	private wasmLoader: WasmLoader
	private hostInterface: HostInterface

	constructor(wasmLoader: WasmLoader, hostInterface: HostInterface) {
		this.wasmLoader = wasmLoader
		this.hostInterface = hostInterface
	}

	/**
	 * 创建工具注册表
	 */
	createRegistry(): any {
		if (!this.wasmLoader.isInitialized()) {
			throw new Error("WASM module not initialized")
		}
		return create_tool_registry()
	}

	/**
	 * 获取可用工具
	 */
	getAvailableTools(registry: any): any {
		return get_available_tools(registry)
	}

	/**
	 * 注册工具
	 */
	registerTool(registry: any, toolName: string): any {
		return register_tool(registry, toolName)
	}

	/**
	 * 注销工具
	 */
	unregisterTool(registry: any, toolName: string): any {
		return unregister_tool(registry, toolName)
	}
}

/**
 * 统一的Roo-Code WASM API
 */
export class RooWasmAPI {
	private wasmLoader: WasmLoader
	private hostInterface: HostInterface

	public readonly task: TaskAPI
	public readonly conversation: ConversationAPI
	public readonly memory: MemoryAPI
	public readonly tools: ToolsAPI

	constructor(wasmLoader: WasmLoader, hostInterface: HostInterface) {
		this.wasmLoader = wasmLoader
		this.hostInterface = hostInterface

		this.task = new TaskAPI(wasmLoader, hostInterface)
		this.conversation = new ConversationAPI(wasmLoader, hostInterface)
		this.memory = new MemoryAPI(wasmLoader, hostInterface)
		this.tools = new ToolsAPI(wasmLoader, hostInterface)
	}

	/**
	 * 获取模块信息
	 */
	getModuleInfo(): any {
		return this.wasmLoader.getModuleInfo()
	}

	/**
	 * 健康检查
	 */
	healthCheck(): boolean {
		return this.wasmLoader.healthCheck()
	}

	/**
	 * 获取Host Interface
	 */
	getHost(): HostInterface {
		return this.hostInterface
	}
}

/**
 * 创建Roo-Code WASM API实例
 */
export async function createRooWasmAPI(hostInterface: HostInterface): Promise<RooWasmAPI> {
	const wasmLoader = WasmLoader.getInstance()

	// 确保WASM模块已初始化
	if (!wasmLoader.isInitialized()) {
		await wasmLoader.initialize()
	}

	return new RooWasmAPI(wasmLoader, hostInterface)
}
