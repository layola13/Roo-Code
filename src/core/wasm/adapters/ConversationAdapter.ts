/**
 * ConversationAdapter - TypeScript对话系统与Rust WASM Conversation Module之间的适配器
 *
 * 职责：
 * 1. 管理对话历史（ConversationManager）
 * 2. 桥接消息操作（TypeScript ApiMessage ↔ Rust WASM）
 * 3. 提供Fallback机制（WASM失败时降级到TypeScript）
 * 4. 状态持久化（使用safeWriteJson保证原子性）
 * 5. 对话统计和摘要管理
 */

import {
	create_conversation_manager,
	add_message,
	get_messages,
	get_stats,
	find_message_by_timestamp,
	clear_messages,
	get_messages_since_last_summary,
	truncate_conversation,
	calculate_messages_to_keep,
} from "../../../../rust-wasm/wasm-dist/roo_core_wasm"
import { HostInterface } from "../host/HostInterface"
import { safeWriteJson } from "../../../utils/safeWriteJson"
import type { ApiMessage } from "../../task-persistence/apiMessages"

/**
 * ConversationAdapter配置
 */
export interface ConversationAdapterConfig {
	enableWasm: boolean // 是否启用WASM模式
	enableFallback: boolean // 是否启用Fallback
	persistencePath?: string // 状态持久化路径
	maxRetries?: number // 最大重试次数
}

/**
 * 对话统计信息
 */
export interface ConversationStats {
	total_messages: number // 总消息数
	user_messages: number // 用户消息数
	assistant_messages: number // 助手消息数
	summary_messages: number // 摘要消息数
	estimated_tokens: number // 估计token数
}

/**
 * 持久化状态
 */
export interface ConversationState {
	messageCount: number // 消息数量
	stats: ConversationStats // 统计信息
	timestamp: number // 时间戳
	wasmMode: boolean // 是否WASM模式
	errorCount: number // 错误计数
}

/**
 * ConversationAdapter - TypeScript与Rust WASM的桥接层
 */
export class ConversationAdapter {
	private wasmManager: any // WASM ConversationManager对象
	private hostInterface: HostInterface
	private config: ConversationAdapterConfig
	private fallbackMode: boolean = false
	private errorCount: number = 0
	private createdAt: number
	private updatedAt: number
	private fallbackMessages: ApiMessage[] = [] // Fallback模式下的消息存储

	constructor(hostInterface: HostInterface, config: ConversationAdapterConfig) {
		this.hostInterface = hostInterface
		this.config = {
			maxRetries: 3,
			...config,
			enableFallback: config.enableFallback ?? true,
		}
		this.createdAt = Date.now()
		this.updatedAt = Date.now()

		// 初始化WASM管理器（如果启用）
		if (this.config.enableWasm) {
			try {
				this.wasmManager = create_conversation_manager()
				this.hostInterface.log("info", "[ConversationAdapter] WASM manager initialized")
			} catch (error) {
				// 初始化失败时立即切换到Fallback模式
				if (this.config.enableFallback) {
					this.fallbackMode = true
					this.errorCount++
					const errorMessage = error instanceof Error ? error.message : String(error)
					this.hostInterface.log(
						"error",
						`[ConversationAdapter] WASM error during initialization: ${errorMessage} (count: ${this.errorCount})`,
					)
					this.hostInterface.log("warn", "[ConversationAdapter] Using fallback mode for conversations")
				} else {
					throw error
				}
			}
		} else {
			// WASM未启用，直接使用Fallback
			this.fallbackMode = true
			this.hostInterface.log("info", "[ConversationAdapter] WASM disabled, using fallback mode")
		}
	}

	// ==================== 消息管理方法 ====================

	/**
	 * 添加消息到对话历史
	 */
	async addMessage(message: ApiMessage): Promise<void> {
		// 验证消息格式
		if (!message || typeof message !== "object") {
			throw new Error("Invalid message format")
		}

		// 验证role字段
		if (message.role !== "user" && message.role !== "assistant") {
			throw new Error(`Invalid message role: ${message.role}. Must be 'user' or 'assistant'`)
		}

		// 验证content字段
		if (message.content === undefined || message.content === null) {
			throw new Error("Message content is required")
		}

		if (this.fallbackMode) {
			this.fallbackMessages.push(message)
			this.updatedAt = Date.now()
			this.hostInterface.log("info", `[ConversationAdapter] Message added in fallback mode: ${message.role}`)
			await this.syncState()
			return
		}

		try {
			// 转换TypeScript ApiMessage为WASM可接受的格式
			const wasmMessage = this.convertToWasmMessage(message)
			add_message(this.wasmManager, wasmMessage)
			this.updatedAt = Date.now()
			this.hostInterface.log("info", `[ConversationAdapter] Message added: ${message.role}`)
			await this.syncState()
		} catch (error) {
			await this.handleWasmError("addMessage", error)

			if (this.fallbackMode) {
				this.fallbackMessages.push(message)
				this.updatedAt = Date.now()
				this.hostInterface.log("info", `[ConversationAdapter] Message added in fallback mode after error`)
				await this.syncState()
			} else if (!this.config.enableFallback) {
				throw error
			}
		}
	}

	/**
	 * 获取所有消息
	 */
	async getMessages(): Promise<ApiMessage[]> {
		if (this.fallbackMode) {
			return this.fallbackMessages
		}

		try {
			const wasmMessages = get_messages(this.wasmManager)
			return this.convertFromWasmMessages(wasmMessages)
		} catch (error) {
			await this.handleWasmError("getMessages", error)

			if (this.fallbackMode) {
				return this.fallbackMessages
			} else if (!this.config.enableFallback) {
				throw error
			}
			return []
		}
	}

	/**
	 * 获取对话统计信息
	 */
	async getStats(): Promise<ConversationStats> {
		if (this.fallbackMode) {
			return this.calculateFallbackStats()
		}

		try {
			const stats = get_stats(this.wasmManager)
			return stats as ConversationStats
		} catch (error) {
			await this.handleWasmError("getStats", error)

			if (this.fallbackMode) {
				return this.calculateFallbackStats()
			} else if (!this.config.enableFallback) {
				throw error
			}
			return {
				total_messages: 0,
				user_messages: 0,
				assistant_messages: 0,
				summary_messages: 0,
				estimated_tokens: 0,
			}
		}
	}

	/**
	 * 根据时间戳查找消息
	 */
	async findMessageByTimestamp(timestamp: number): Promise<ApiMessage | null> {
		if (this.fallbackMode) {
			const message = this.fallbackMessages.find((msg) => msg.ts === timestamp)
			return message || null
		}

		try {
			// 转换timestamp为bigint（WASM要求）
			const wasmMessage = find_message_by_timestamp(this.wasmManager, BigInt(timestamp))
			if (!wasmMessage) {
				return null
			}
			return this.convertFromWasmMessage(wasmMessage)
		} catch (error) {
			await this.handleWasmError("findMessageByTimestamp", error)

			if (this.fallbackMode) {
				const message = this.fallbackMessages.find((msg) => msg.ts === timestamp)
				return message || null
			} else if (!this.config.enableFallback) {
				throw error
			}
			return null
		}
	}

	/**
	 * 清空所有消息
	 */
	async clearMessages(): Promise<void> {
		if (this.fallbackMode) {
			this.fallbackMessages = []
			this.updatedAt = Date.now()
			this.hostInterface.log("info", "[ConversationAdapter] Messages cleared in fallback mode")
			await this.syncState()
			return
		}

		try {
			clear_messages(this.wasmManager)
			this.updatedAt = Date.now()
			this.hostInterface.log("info", "[ConversationAdapter] Messages cleared")
			await this.syncState()
		} catch (error) {
			await this.handleWasmError("clearMessages", error)

			if (this.fallbackMode) {
				this.fallbackMessages = []
				this.updatedAt = Date.now()
				this.hostInterface.log("info", "[ConversationAdapter] Messages cleared in fallback mode after error")
				await this.syncState()
			} else if (!this.config.enableFallback) {
				throw error
			}
		}
	}

	/**
	 * 获取最后一次摘要后的消息
	 */
	async getMessagesSinceLastSummary(): Promise<ApiMessage[]> {
		if (this.fallbackMode) {
			return this.getMessagesSinceLastSummaryFallback()
		}

		try {
			const wasmMessages = get_messages_since_last_summary(this.wasmManager)
			return this.convertFromWasmMessages(wasmMessages)
		} catch (error) {
			await this.handleWasmError("getMessagesSinceLastSummary", error)

			if (this.fallbackMode) {
				return this.getMessagesSinceLastSummaryFallback()
			} else if (!this.config.enableFallback) {
				throw error
			}
			return []
		}
	}

	/**
	 * 截断对话（保留前N条消息）
	 */
	async truncateConversation(index: number): Promise<void> {
		// 验证索引
		if (index < 0) {
			throw new Error("Truncate index cannot be negative")
		}

		const messageCount = await this.getMessageCount()
		// 允许index等于messageCount的情况（保留所有消息）
		// 允许index为0且messageCount为0的情况（空对话截断）
		if (index > messageCount) {
			throw new Error(`Truncate index ${index} exceeds message count ${messageCount}`)
		}

		if (this.fallbackMode) {
			if (index >= 0 && index < this.fallbackMessages.length) {
				this.fallbackMessages = this.fallbackMessages.slice(0, index + 1)
				this.updatedAt = Date.now()
				this.hostInterface.log("info", `[ConversationAdapter] Conversation truncated at index ${index}`)
				await this.syncState()
			}
			return
		}

		try {
			truncate_conversation(this.wasmManager, index)
			this.updatedAt = Date.now()
			this.hostInterface.log("info", `[ConversationAdapter] Conversation truncated at index ${index}`)
			await this.syncState()
		} catch (error) {
			await this.handleWasmError("truncateConversation", error)

			if (this.fallbackMode) {
				if (index >= 0 && index < this.fallbackMessages.length) {
					this.fallbackMessages = this.fallbackMessages.slice(0, index + 1)
					this.updatedAt = Date.now()
					await this.syncState()
				}
			} else if (!this.config.enableFallback) {
				throw error
			}
		}
	}

	/**
	 * 计算应该保留的消息数量
	 */
	async calculateMessagesToKeep(
		totalMessages: number,
		contextPercentage: number,
		maxContextTokens: number,
	): Promise<number> {
		if (this.fallbackMode) {
			return Math.floor(totalMessages * contextPercentage)
		}

		try {
			// WASM calculate_messages_to_keep只接受2个参数：manager和total_messages
			// contextPercentage和maxContextTokens在fallback模式中使用
			return calculate_messages_to_keep(this.wasmManager, totalMessages)
		} catch (error) {
			await this.handleWasmError("calculateMessagesToKeep", error)

			if (this.fallbackMode) {
				return Math.floor(totalMessages * contextPercentage)
			} else if (!this.config.enableFallback) {
				throw error
			}
			return 0
		}
	}

	// ==================== 类型转换方法 ====================

	/**
	 * 转换TypeScript ApiMessage为WASM格式
	 */
	private convertToWasmMessage(message: ApiMessage): any {
		return {
			role: message.role,
			content: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
			ts: message.ts || Date.now(),
			is_summary: message.isSummary || false,
		}
	}

	/**
	 * 转换WASM消息为TypeScript ApiMessage
	 */
	private convertFromWasmMessage(wasmMessage: any): ApiMessage {
		const message: ApiMessage = {
			role: wasmMessage.role,
			content: wasmMessage.content,
		}

		if (wasmMessage.ts) {
			message.ts = wasmMessage.ts
		}

		if (wasmMessage.is_summary) {
			message.isSummary = wasmMessage.is_summary
		}

		return message
	}

	/**
	 * 批量转换WASM消息
	 */
	private convertFromWasmMessages(wasmMessages: any[]): ApiMessage[] {
		if (!Array.isArray(wasmMessages)) {
			return []
		}
		return wasmMessages.map((msg) => this.convertFromWasmMessage(msg))
	}

	// ==================== Fallback模式辅助方法 ====================

	/**
	 * Fallback模式：计算统计信息
	 */
	private calculateFallbackStats(): ConversationStats {
		const userMessages = this.fallbackMessages.filter((msg) => msg.role === "user").length
		const assistantMessages = this.fallbackMessages.filter((msg) => msg.role === "assistant").length
		const summaryMessages = this.fallbackMessages.filter((msg) => msg.isSummary).length

		// 粗略估算token数（1 token ≈ 4 characters）
		const estimatedTokens = this.fallbackMessages.reduce((total, msg) => {
			const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
			return total + Math.ceil(content.length / 4)
		}, 0)

		return {
			total_messages: this.fallbackMessages.length,
			user_messages: userMessages,
			assistant_messages: assistantMessages,
			summary_messages: summaryMessages,
			estimated_tokens: estimatedTokens,
		}
	}

	/**
	 * Fallback模式：获取最后一次摘要后的消息
	 */
	private getMessagesSinceLastSummaryFallback(): ApiMessage[] {
		// 找到最后一条摘要消息的索引
		let lastSummaryIndex = -1
		for (let i = this.fallbackMessages.length - 1; i >= 0; i--) {
			if (this.fallbackMessages[i].isSummary) {
				lastSummaryIndex = i
				break
			}
		}

		// 如果找到摘要，返回摘要及其后的消息
		if (lastSummaryIndex >= 0) {
			// 保留第一条用户消息用于上下文
			const firstMessage = this.fallbackMessages[0]
			if (firstMessage && firstMessage.role === "user") {
				return [firstMessage, ...this.fallbackMessages.slice(lastSummaryIndex)]
			}
			return this.fallbackMessages.slice(lastSummaryIndex)
		}

		// 没有摘要，返回所有消息
		return this.fallbackMessages
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
			const stats = await this.getStats()

			const state: ConversationState = {
				messageCount: stats.total_messages,
				stats,
				timestamp: this.updatedAt,
				wasmMode: !this.fallbackMode,
				errorCount: this.errorCount,
			}

			const statePath = `${this.config.persistencePath}/conversation-state.json`
			// ⚠️ 强制使用safeWriteJson，不能用JSON.stringify + fs.writeFile
			await safeWriteJson(statePath, state)

			this.hostInterface.log("info", `[ConversationAdapter] State synced: ${stats.total_messages} messages`)
		} catch (error) {
			// 状态同步失败不应该影响主流程
			this.hostInterface.log("error", `[ConversationAdapter] Failed to sync state: ${error}`)
		}
	}

	/**
	 * 从持久化存储加载状态
	 */
	async loadState(): Promise<ConversationState | null> {
		if (!this.config.persistencePath) {
			return null
		}

		try {
			const statePath = `${this.config.persistencePath}/conversation-state.json`
			const exists = await this.hostInterface.fileExists(statePath)

			if (!exists) {
				return null
			}

			const data = await this.hostInterface.readJson(statePath)
			this.hostInterface.log("info", `[ConversationAdapter] State loaded: ${data.messageCount} messages`)
			return data as ConversationState
		} catch (error) {
			this.hostInterface.log("error", `[ConversationAdapter] Failed to load state: ${error}`)
			return null
		}
	}

	/**
	 * 静态方法：加载状态
	 */
	static async loadConversationState(
		persistencePath: string,
		hostInterface: HostInterface,
	): Promise<ConversationState | null> {
		try {
			const statePath = `${persistencePath}/conversation-state.json`
			const exists = await hostInterface.fileExists(statePath)

			if (!exists) {
				return null
			}

			const data = await hostInterface.readJson(statePath)
			return data as ConversationState
		} catch (error) {
			hostInterface.log("error", `[ConversationAdapter] Failed to load state: ${error}`)
			return null
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
			`[ConversationAdapter] WASM error during ${operation}: ${errorMessage} (count: ${this.errorCount})`,
		)

		// 同步错误状态（在切换Fallback之前）
		await this.syncState()

		// 检查是否应该切换到Fallback模式
		if (this.config.enableFallback && !this.fallbackMode && this.errorCount >= (this.config.maxRetries || 3)) {
			this.fallbackMode = true
			this.hostInterface.log("warn", "[ConversationAdapter] Switching to fallback mode")
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

	/**
	 * 获取消息数量
	 */
	async getMessageCount(): Promise<number> {
		const stats = await this.getStats()
		return stats.total_messages
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
			this.fallbackMessages = []
			this.hostInterface.log("info", "[ConversationAdapter] Conversation adapter disposed")
		} catch (error) {
			this.hostInterface.log("error", `[ConversationAdapter] Error disposing adapter: ${error}`)
		}
	}
}
