/**
 * MemoryAdapter - TypeScript记忆系统与Rust WASM Memory Module之间的适配器
 *
 * 职责：
 * 1. 管理对话记忆（ConversationMemory）
 * 2. 桥接记忆操作（TypeScript ↔ Rust WASM）
 * 3. 提供Fallback机制（WASM失败时降级到TypeScript）
 * 4. 状态持久化（使用safeWriteJson保证原子性）
 * 5. 记忆提取、分类和摘要生成
 */

import { HostInterface } from "../host/HostInterface"
import { safeWriteJson } from "../../../utils/safeWriteJson"

/**
 * MemoryAdapter配置
 */
export interface MemoryAdapterConfig {
	taskId: string // 任务ID
	hostInterface: HostInterface // Host接口（用于日志和错误报告）
	enableWasm?: boolean // 是否启用WASM模式
	enableFallback?: boolean // 是否启用Fallback
	persistencePath?: string // 状态持久化路径
	maxRetries?: number // 最大重试次数
}

/**
 * 记忆类型枚举
 */
export enum MemoryType {
	UserInstruction = "user_instruction",
	TechnicalDecision = "technical_decision",
	Configuration = "configuration",
	ImportantError = "important_error",
	ProjectContext = "project_context",
	WorkflowPattern = "workflow_pattern",
}

/**
 * 记忆优先级枚举
 */
export enum MemoryPriority {
	Low = "low",
	Medium = "medium",
	High = "high",
	Critical = "critical",
}

/**
 * 记忆条目
 */
export interface MemoryEntry {
	id: string
	type: MemoryType
	priority: MemoryPriority
	content: string
	created_at: number
	last_accessed_at: number
	access_count: number
	message_index?: number
	related_files?: string[]
	related_tech?: string[]
	tags?: string[]
}

/**
 * 记忆统计信息
 */
export interface MemoryStats {
	total_memories: number
	by_type: Record<string, number>
	by_priority: Record<string, number>
	pending_memories: number
	persisted_memories: number
}

/**
 * 记忆提取结果
 */
export interface MemoryExtractionResult {
	memories: MemoryEntry[]
	scanned_messages: number
	new_memories_count: number
}

/**
 * 消息内容（用于提取）
 */
export interface MessageContent {
	role: string
	content: string
	ts?: number
}

/**
 * MemoryAdapter - TypeScript与Rust WASM的桥接层
 */
export class MemoryAdapter {
	private wasmManager: any // WASM MemoryManager对象
	private hostInterface: HostInterface
	private config: MemoryAdapterConfig
	private fallbackMode: boolean = false
	private errorCount: number = 0
	private createdAt: number
	private updatedAt: number
	private fallbackMemories: Map<string, MemoryEntry> = new Map() // Fallback模式下的记忆存储

	constructor(config: MemoryAdapterConfig) {
		this.hostInterface = config.hostInterface
		this.config = {
			...config,
			maxRetries: config.maxRetries ?? 3,
			enableFallback: config.enableFallback ?? true,
		}
		this.createdAt = Date.now()
		this.updatedAt = Date.now()

		// 初始化WASM管理器（如果启用）
		if (this.config.enableWasm) {
			this.initializeWasm()
		} else {
			// WASM未启用，直接使用Fallback
			this.fallbackMode = true
			this.hostInterface.log("info", "[MemoryAdapter] WASM disabled, using fallback mode")
		}
	}

	/**
	 * 初始化WASM记忆管理器
	 */
	private initializeWasm(): void {
		try {
			// 动态导入WASM模块
			const wasmModule = require("../../../../rust-wasm/wasm-dist/roo_core_wasm")

			// 创建MemoryManager实例
			this.wasmManager = new wasmModule.MemoryManager(this.config.taskId, null)
			this.hostInterface.log("info", "[MemoryAdapter] WASM manager initialized")
		} catch (error) {
			// 初始化失败时立即切换到Fallback模式
			if (this.config.enableFallback) {
				this.fallbackMode = true
				this.errorCount++
				const errorMessage = error instanceof Error ? error.message : String(error)
				this.hostInterface.log(
					"error",
					`[MemoryAdapter] WASM error during initialization: ${errorMessage} (count: ${this.errorCount})`,
				)
				this.hostInterface.log("warn", "[MemoryAdapter] Using fallback mode for memory")
			} else {
				throw error
			}
		}
	}

	// ==================== 记忆管理方法 ====================

	/**
	 * 从消息中提取记忆
	 */
	async extractMemories(messages: MessageContent[], timestamp?: number): Promise<MemoryExtractionResult> {
		const ts = timestamp || Date.now()

		if (this.fallbackMode) {
			return this.fallbackExtractMemories(messages, ts)
		}

		try {
			const result = this.wasmManager.extractMemories(messages, ts)
			this.updatedAt = Date.now()
			this.hostInterface.log("info", `[MemoryAdapter] Extracted ${result.new_memories_count} memories`)
			await this.syncState()
			return result as MemoryExtractionResult
		} catch (error) {
			await this.handleWasmError("extractMemories", error)

			if (this.fallbackMode) {
				return this.fallbackExtractMemories(messages, ts)
			} else if (!this.config.enableFallback) {
				throw error
			}
			return { memories: [], scanned_messages: 0, new_memories_count: 0 }
		}
	}

	/**
	 * 获取所有记忆
	 */
	async getAllMemories(): Promise<MemoryEntry[]> {
		if (this.fallbackMode) {
			return Array.from(this.fallbackMemories.values())
		}

		try {
			const memories = this.wasmManager.getAllMemories()
			return memories as MemoryEntry[]
		} catch (error) {
			await this.handleWasmError("getAllMemories", error)

			if (this.fallbackMode) {
				return Array.from(this.fallbackMemories.values())
			} else if (!this.config.enableFallback) {
				throw error
			}
			return []
		}
	}

	/**
	 * 获取关键记忆
	 */
	async getCriticalMemories(): Promise<MemoryEntry[]> {
		if (this.fallbackMode) {
			return Array.from(this.fallbackMemories.values()).filter((m) => m.priority === MemoryPriority.Critical)
		}

		try {
			const memories = this.wasmManager.getCriticalMemories()
			return memories as MemoryEntry[]
		} catch (error) {
			await this.handleWasmError("getCriticalMemories", error)

			if (this.fallbackMode) {
				return Array.from(this.fallbackMemories.values()).filter((m) => m.priority === MemoryPriority.Critical)
			} else if (!this.config.enableFallback) {
				throw error
			}
			return []
		}
	}

	/**
	 * 按优先级获取记忆
	 */
	async getMemoriesByPriority(priority: MemoryPriority): Promise<MemoryEntry[]> {
		if (this.fallbackMode) {
			return Array.from(this.fallbackMemories.values()).filter((m) => m.priority === priority)
		}

		try {
			const memories = this.wasmManager.getMemoriesByPriority(priority)
			return memories as MemoryEntry[]
		} catch (error) {
			await this.handleWasmError("getMemoriesByPriority", error)

			if (this.fallbackMode) {
				return Array.from(this.fallbackMemories.values()).filter((m) => m.priority === priority)
			} else if (!this.config.enableFallback) {
				throw error
			}
			return []
		}
	}

	/**
	 * 按类型获取记忆
	 */
	async getMemoriesByType(type: MemoryType): Promise<MemoryEntry[]> {
		if (this.fallbackMode) {
			return Array.from(this.fallbackMemories.values()).filter((m) => m.type === type)
		}

		try {
			const memories = this.wasmManager.getMemoriesByType(type)
			return memories as MemoryEntry[]
		} catch (error) {
			await this.handleWasmError("getMemoriesByType", error)

			if (this.fallbackMode) {
				return Array.from(this.fallbackMemories.values()).filter((m) => m.type === type)
			} else if (!this.config.enableFallback) {
				throw error
			}
			return []
		}
	}

	/**
	 * 记录记忆访问
	 */
	async recordMemoryAccess(memoryId: string, timestamp?: number): Promise<void> {
		const ts = timestamp || Date.now()

		if (this.fallbackMode) {
			const memory = this.fallbackMemories.get(memoryId)
			if (memory) {
				memory.last_accessed_at = ts
				memory.access_count++
				this.updatedAt = Date.now()
				await this.syncState()
			}
			return
		}

		try {
			this.wasmManager.recordMemoryAccess(memoryId, ts)
			this.updatedAt = Date.now()
			this.hostInterface.log("info", `[MemoryAdapter] Recorded access for memory: ${memoryId}`)
			await this.syncState()
		} catch (error) {
			await this.handleWasmError("recordMemoryAccess", error)

			if (this.fallbackMode) {
				const memory = this.fallbackMemories.get(memoryId)
				if (memory) {
					memory.last_accessed_at = ts
					memory.access_count++
					this.updatedAt = Date.now()
					await this.syncState()
				}
			} else if (!this.config.enableFallback) {
				throw error
			}
		}
	}

	/**
	 * 生成记忆摘要（用于prompt）
	 */
	async generateMemorySummary(timestamp?: number): Promise<string> {
		const ts = timestamp || Date.now()

		if (this.fallbackMode) {
			return this.fallbackGenerateMemorySummary(ts)
		}

		try {
			const summary = this.wasmManager.generateMemorySummary(ts)
			return summary as string
		} catch (error) {
			await this.handleWasmError("generateMemorySummary", error)

			if (this.fallbackMode) {
				return this.fallbackGenerateMemorySummary(ts)
			} else if (!this.config.enableFallback) {
				throw error
			}
			return ""
		}
	}

	/**
	 * 应用记忆老化机制
	 */
	async applyMemoryAging(currentTime?: number): Promise<void> {
		const ts = currentTime || Date.now()

		if (this.fallbackMode) {
			// Fallback模式下的简单老化：移除超过30天未访问的低优先级记忆
			const thirtyDaysAgo = ts - 30 * 24 * 60 * 60 * 1000
			for (const [id, memory] of this.fallbackMemories.entries()) {
				if (memory.priority === MemoryPriority.Low && memory.last_accessed_at < thirtyDaysAgo) {
					this.fallbackMemories.delete(id)
				}
			}
			this.updatedAt = Date.now()
			await this.syncState()
			return
		}

		try {
			this.wasmManager.applyMemoryAging(ts)
			this.updatedAt = Date.now()
			this.hostInterface.log("info", "[MemoryAdapter] Memory aging applied")
			await this.syncState()
		} catch (error) {
			await this.handleWasmError("applyMemoryAging", error)

			if (this.fallbackMode) {
				const thirtyDaysAgo = ts - 30 * 24 * 60 * 60 * 1000
				for (const [id, memory] of this.fallbackMemories.entries()) {
					if (memory.priority === MemoryPriority.Low && memory.last_accessed_at < thirtyDaysAgo) {
						this.fallbackMemories.delete(id)
					}
				}
				this.updatedAt = Date.now()
				await this.syncState()
			} else if (!this.config.enableFallback) {
				throw error
			}
		}
	}

	/**
	 * 清理低优先级记忆
	 */
	async pruneLowPriorityMemories(maxCount: number, currentTime?: number): Promise<void> {
		const ts = currentTime || Date.now()

		if (this.fallbackMode) {
			const lowPriorityMemories = Array.from(this.fallbackMemories.values())
				.filter((m) => m.priority === MemoryPriority.Low)
				.sort((a, b) => a.last_accessed_at - b.last_accessed_at)

			if (lowPriorityMemories.length > maxCount) {
				const toDelete = lowPriorityMemories.slice(0, lowPriorityMemories.length - maxCount)
				for (const memory of toDelete) {
					this.fallbackMemories.delete(memory.id)
				}
				this.updatedAt = Date.now()
				await this.syncState()
			}
			return
		}

		try {
			this.wasmManager.pruneLowPriorityMemories(maxCount, ts)
			this.updatedAt = Date.now()
			this.hostInterface.log("info", `[MemoryAdapter] Pruned low priority memories to ${maxCount}`)
			await this.syncState()
		} catch (error) {
			await this.handleWasmError("pruneLowPriorityMemories", error)

			if (this.fallbackMode) {
				const lowPriorityMemories = Array.from(this.fallbackMemories.values())
					.filter((m) => m.priority === MemoryPriority.Low)
					.sort((a, b) => a.last_accessed_at - b.last_accessed_at)

				if (lowPriorityMemories.length > maxCount) {
					const toDelete = lowPriorityMemories.slice(0, lowPriorityMemories.length - maxCount)
					for (const memory of toDelete) {
						this.fallbackMemories.delete(memory.id)
					}
					this.updatedAt = Date.now()
					await this.syncState()
				}
			} else if (!this.config.enableFallback) {
				throw error
			}
		}
	}

	/**
	 * 获取记忆统计信息
	 */
	async getMemoryStats(currentTime?: number): Promise<MemoryStats> {
		const ts = currentTime || Date.now()

		if (this.fallbackMode) {
			return this.calculateFallbackStats()
		}

		try {
			const stats = this.wasmManager.getMemoryStats(ts)
			return stats as MemoryStats
		} catch (error) {
			await this.handleWasmError("getMemoryStats", error)

			if (this.fallbackMode) {
				return this.calculateFallbackStats()
			} else if (!this.config.enableFallback) {
				throw error
			}
			return {
				total_memories: 0,
				by_type: {},
				by_priority: {},
				pending_memories: 0,
				persisted_memories: 0,
			}
		}
	}

	// ==================== Fallback模式辅助方法 ====================

	/**
	 * Fallback模式：提取记忆
	 */
	private fallbackExtractMemories(messages: MessageContent[], timestamp: number): MemoryExtractionResult {
		const newMemories: MemoryEntry[] = []
		let scannedCount = 0

		for (const message of messages) {
			scannedCount++

			// 简单的关键词提取逻辑
			const content = message.content.toLowerCase()

			// 检测用户指令
			if (
				message.role === "user" &&
				(content.includes("must") ||
					content.includes("should") ||
					content.includes("require") ||
					content.includes("need to"))
			) {
				const memory: MemoryEntry = {
					id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
					type: MemoryType.UserInstruction,
					priority: MemoryPriority.High,
					content: message.content,
					created_at: timestamp,
					last_accessed_at: timestamp,
					access_count: 0,
				}
				this.fallbackMemories.set(memory.id, memory)
				newMemories.push(memory)
			}

			// 检测错误
			if (content.includes("error") || content.includes("failed") || content.includes("exception")) {
				const memory: MemoryEntry = {
					id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
					type: MemoryType.ImportantError,
					priority: MemoryPriority.Medium,
					content: message.content,
					created_at: timestamp,
					last_accessed_at: timestamp,
					access_count: 0,
				}
				this.fallbackMemories.set(memory.id, memory)
				newMemories.push(memory)
			}
		}

		return {
			memories: Array.from(this.fallbackMemories.values()),
			scanned_messages: scannedCount,
			new_memories_count: newMemories.length,
		}
	}

	/**
	 * Fallback模式：生成记忆摘要
	 */
	private fallbackGenerateMemorySummary(currentTime: number): string {
		const memories = Array.from(this.fallbackMemories.values())
		if (memories.length === 0) {
			return ""
		}

		// 按优先级和最近访问时间排序
		const sortedMemories = memories.sort((a, b) => {
			const priorityOrder = {
				[MemoryPriority.Critical]: 4,
				[MemoryPriority.High]: 3,
				[MemoryPriority.Medium]: 2,
				[MemoryPriority.Low]: 1,
			}
			const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
			if (priorityDiff !== 0) return priorityDiff
			return b.last_accessed_at - a.last_accessed_at
		})

		// 生成摘要
		const lines: string[] = ["## Important Memories"]
		for (const memory of sortedMemories.slice(0, 10)) {
			// 最多10条
			lines.push(`- [${memory.priority}] ${memory.content.slice(0, 100)}`)
		}

		return lines.join("\n")
	}

	/**
	 * Fallback模式：计算统计信息
	 */
	private calculateFallbackStats(): MemoryStats {
		const memories = Array.from(this.fallbackMemories.values())

		const by_type: Record<string, number> = {
			user_instruction: 0,
			technical_decision: 0,
			configuration: 0,
			important_error: 0,
			project_context: 0,
			workflow_pattern: 0,
		}

		const by_priority: Record<string, number> = {
			low: 0,
			medium: 0,
			high: 0,
			critical: 0,
		}

		for (const memory of memories) {
			by_type[memory.type]++
			by_priority[memory.priority]++
		}

		return {
			total_memories: memories.length,
			by_type,
			by_priority,
			pending_memories: 0,
			persisted_memories: memories.length,
		}
	}

	// ==================== 状态管理方法 ====================

	/**
	 * 同步状态到持久化存储
	 * ⚠️ 关键：必须使用safeWriteJson确保原子性写入
	 */
	private async syncState(): Promise<void> {
		if (!this.config.persistencePath) {
			return
		}

		try {
			const stats = await this.getMemoryStats()
			const memories = await this.getAllMemories()

			const state = {
				taskId: this.config.taskId,
				memoryCount: stats.total_memories,
				stats,
				memories: memories.slice(0, 50), // 只保存前50条记忆概览
				timestamp: this.updatedAt,
				wasmMode: !this.fallbackMode,
				errorCount: this.errorCount,
			}

			const statePath = `${this.config.persistencePath}/memory-state.json`
			// ⚠️ 强制使用safeWriteJson，不能用JSON.stringify + fs.writeFile
			await safeWriteJson(statePath, state)

			this.hostInterface.log("info", `[MemoryAdapter] State synced: ${stats.total_memories} memories`)
		} catch (error) {
			// 状态同步失败不应该影响主流程
			this.hostInterface.log("error", `[MemoryAdapter] Failed to sync state: ${error}`)
		}
	}

	// ==================== 错误处理与Fallback ====================

	/**
	 * 处理WASM错误
	 */
	private async handleWasmError(operation: string, error: any): Promise<void> {
		this.errorCount++
		this.updatedAt = Date.now()
		const errorMessage = error instanceof Error ? error.message : String(error)

		this.hostInterface.log(
			"error",
			`[MemoryAdapter] WASM error during ${operation}: ${errorMessage} (count: ${this.errorCount})`,
		)

		// 检查是否应该切换到Fallback模式
		if (this.config.enableFallback && !this.fallbackMode && this.errorCount >= (this.config.maxRetries || 3)) {
			this.fallbackMode = true
			this.hostInterface.log("warn", "[MemoryAdapter] Switching to fallback mode")
		}
	}

	// ==================== 状态查询方法 ====================

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
	 * 获取创建时间
	 */
	getCreatedAt(): number {
		return this.createdAt
	}

	/**
	 * 获取最后更新时间
	 */
	getUpdatedAt(): number {
		return this.updatedAt
	}

	// ==================== 资源清理 ====================

	/**
	 * 清理资源
	 */
	dispose(): void {
		try {
			if (this.wasmManager) {
				// Rust WASM对象会自动清理
				this.wasmManager = undefined
			}
			this.fallbackMemories.clear()
			this.hostInterface.log("info", "[MemoryAdapter] Memory adapter disposed")
		} catch (error) {
			this.hostInterface.log("error", `[MemoryAdapter] Error disposing adapter: ${error}`)
		}
	}
}
