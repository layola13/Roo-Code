/**
 * MessageIndexManager - 消息索引管理器
 *
 * 负责为历史消息分配全局唯一索引号，支持消息的存储、检索和管理
 * 基于 docs/user-requirement-intelligent-context-system.md
 */

import { HistoricalMessage } from "./types-intelligent-context"
import { ApiMessage } from "../task-persistence/apiMessages"
import { safeWriteJson } from "../../utils/safeWriteJson"
import * as fs from "fs"
import * as path from "path"

/**
 * 索引存储配置
 */
export interface IndexStorageConfig {
	/** 存储目录路径 */
	storagePath: string
	/** 是否启用持久化 */
	enablePersistence: boolean
	/** 自动保存间隔（毫秒） */
	autoSaveInterval?: number
}

/**
 * 索引统计信息
 */
export interface IndexStats {
	/** 总消息数 */
	totalMessages: number
	/** 当前最大索引号 */
	maxIndex: number
	/** 按对话ID分组的统计 */
	byConversation: Record<string, number>
	/** 最早消息时间戳 */
	earliestTimestamp?: number
	/** 最新消息时间戳 */
	latestTimestamp?: number
}

/**
 * 消息索引管理器实现
 */
export class MessageIndexManager {
	private currentMaxIndex: number = 0
	private messageStore: Map<number, HistoricalMessage> = new Map()
	private conversationIndices: Map<string, number[]> = new Map()
	private config: Required<IndexStorageConfig>
	private autoSaveTimer?: NodeJS.Timeout
	private isDirty: boolean = false

	constructor(config: IndexStorageConfig) {
		this.config = {
			storagePath: config.storagePath,
			enablePersistence: config.enablePersistence,
			autoSaveInterval: config.autoSaveInterval || 30000, // 默认30秒
		}

		// 加载已有索引
		if (this.config.enablePersistence) {
			this.loadFromDisk()
			this.startAutoSave()
		}
	}

	/**
	 * 为新消息分配索引号
	 * @param conversationId 对话ID
	 * @returns 分配的索引号
	 */
	assignIndex(conversationId: string): number {
		this.currentMaxIndex++

		// 记录对话关联
		if (!this.conversationIndices.has(conversationId)) {
			this.conversationIndices.set(conversationId, [])
		}
		this.conversationIndices.get(conversationId)!.push(this.currentMaxIndex)

		this.isDirty = true
		return this.currentMaxIndex
	}

	/**
	 * 存储消息到索引
	 * @param message API消息
	 * @param conversationId 对话ID
	 * @returns 分配的索引号和全局ID
	 */
	storeMessage(message: ApiMessage, conversationId: string): { messageIndex: number; globalId: string } {
		const messageIndex = this.assignIndex(conversationId)
		const globalId = `msg#${messageIndex}`

		// 计算消息token数（简单估算）
		const content =
			typeof message.content === "string"
				? message.content
				: message.content.map((block) => (block.type === "text" ? block.text : "")).join(" ")

		const tokens = Math.ceil(content.length / 4) // 粗略估算

		const historicalMessage: HistoricalMessage = {
			messageIndex,
			globalId,
			role: message.role,
			content: message.content,
			timestamp: Date.now(),
			conversationId,
			tokens,
		}

		this.messageStore.set(messageIndex, historicalMessage)
		this.isDirty = true

		return { messageIndex, globalId }
	}

	/**
	 * 批量存储消息
	 * @param messages API消息数组
	 * @param conversationId 对话ID
	 * @returns 存储结果数组
	 */
	storeMessages(messages: ApiMessage[], conversationId: string): Array<{ messageIndex: number; globalId: string }> {
		return messages.map((message) => this.storeMessage(message, conversationId))
	}

	/**
	 * 根据索引号获取消息
	 * @param index 消息索引号
	 * @returns 历史消息（如果存在）
	 */
	getMessageByIndex(index: number): HistoricalMessage | undefined {
		return this.messageStore.get(index)
	}

	/**
	 * 根据索引号列表批量获取消息
	 * @param indices 索引号数组
	 * @returns 历史消息数组
	 */
	getMessagesByIndices(indices: number[]): HistoricalMessage[] {
		const messages: HistoricalMessage[] = []
		for (const index of indices) {
			const message = this.messageStore.get(index)
			if (message) {
				messages.push(message)
			}
		}
		return messages
	}

	/**
	 * 根据对话ID获取所有消息
	 * @param conversationId 对话ID
	 * @returns 历史消息数组
	 */
	getMessagesByConversation(conversationId: string): HistoricalMessage[] {
		const indices = this.conversationIndices.get(conversationId) || []
		return this.getMessagesByIndices(indices)
	}

	/**
	 * 获取当前最大索引号
	 */
	getCurrentMaxIndex(): number {
		return this.currentMaxIndex
	}

	/**
	 * 获取所有消息（用于向量检索等场景）
	 */
	getAllMessages(): HistoricalMessage[] {
		return Array.from(this.messageStore.values())
	}

	/**
	 * 根据时间范围获取消息
	 * @param startTime 开始时间戳
	 * @param endTime 结束时间戳
	 * @returns 历史消息数组
	 */
	getMessagesByTimeRange(startTime: number, endTime: number): HistoricalMessage[] {
		return this.getAllMessages().filter((msg) => msg.timestamp >= startTime && msg.timestamp <= endTime)
	}

	/**
	 * 获取最近N条消息
	 * @param count 消息数量
	 * @param conversationId 可选的对话ID过滤
	 * @returns 历史消息数组
	 */
	getRecentMessages(count: number, conversationId?: string): HistoricalMessage[] {
		let messages: HistoricalMessage[]

		if (conversationId) {
			messages = this.getMessagesByConversation(conversationId)
		} else {
			messages = this.getAllMessages()
		}

		// 按时间戳降序排序
		return messages.sort((a, b) => b.timestamp - a.timestamp).slice(0, count)
	}

	/**
	 * 搜索消息内容
	 * @param query 搜索关键词
	 * @param options 搜索选项
	 * @returns 匹配的历史消息数组
	 */
	searchMessages(
		query: string,
		options?: {
			conversationId?: string
			role?: "user" | "assistant"
			limit?: number
		},
	): HistoricalMessage[] {
		const queryLower = query.toLowerCase()
		let messages = this.getAllMessages()

		// 应用过滤条件
		if (options?.conversationId) {
			messages = this.getMessagesByConversation(options.conversationId)
		}

		if (options?.role) {
			messages = messages.filter((msg) => msg.role === options.role)
		}

		// 内容匹配
		const matched = messages.filter((msg) => {
			const content =
				typeof msg.content === "string"
					? msg.content
					: msg.content.map((block) => (block.type === "text" ? block.text : "")).join(" ")

			return content.toLowerCase().includes(queryLower)
		})

		// 限制返回数量
		if (options?.limit && options.limit > 0) {
			return matched.slice(0, options.limit)
		}

		return matched
	}

	/**
	 * 获取索引统计信息
	 */
	getStats(): IndexStats {
		const messages = this.getAllMessages()
		const byConversation: Record<string, number> = {}

		for (const [conversationId, indices] of this.conversationIndices.entries()) {
			byConversation[conversationId] = indices.length
		}

		const timestamps = messages.map((m) => m.timestamp).filter((t) => t > 0)

		return {
			totalMessages: messages.length,
			maxIndex: this.currentMaxIndex,
			byConversation,
			earliestTimestamp: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
			latestTimestamp: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
		}
	}

	/**
	 * 重置索引计数器（谨慎使用）
	 */
	reset(): void {
		this.currentMaxIndex = 0
		this.messageStore.clear()
		this.conversationIndices.clear()
		this.isDirty = true

		if (this.config.enablePersistence) {
			this.saveToDisk()
		}
	}

	/**
	 * 删除指定对话的所有消息
	 * @param conversationId 对话ID
	 */
	deleteConversation(conversationId: string): void {
		const indices = this.conversationIndices.get(conversationId) || []

		for (const index of indices) {
			this.messageStore.delete(index)
		}

		this.conversationIndices.delete(conversationId)
		this.isDirty = true
	}

	/**
	 * 从磁盘加载索引
	 */
	private loadFromDisk(): void {
		try {
			const indexFilePath = path.join(this.config.storagePath, "message-index.json")

			if (!fs.existsSync(indexFilePath)) {
				return
			}

			const data = JSON.parse(fs.readFileSync(indexFilePath, "utf-8"))

			this.currentMaxIndex = data.currentMaxIndex || 0

			// 恢复消息存储
			if (data.messages && Array.isArray(data.messages)) {
				for (const msg of data.messages) {
					this.messageStore.set(msg.messageIndex, msg)
				}
			}

			// 恢复对话索引
			if (data.conversationIndices) {
				for (const [conversationId, indices] of Object.entries(data.conversationIndices)) {
					this.conversationIndices.set(conversationId, indices as number[])
				}
			}

			console.log(`[MessageIndexManager] Loaded ${this.messageStore.size} messages from disk`)
		} catch (error) {
			console.error("[MessageIndexManager] Failed to load from disk:", error)
		}
	}

	/**
	 * 保存索引到磁盘
	 */
	async saveToDisk(): Promise<void> {
		if (!this.config.enablePersistence || !this.isDirty) {
			return
		}

		try {
			const indexFilePath = path.join(this.config.storagePath, "message-index.json")

			// 确保目录存在
			if (!fs.existsSync(this.config.storagePath)) {
				fs.mkdirSync(this.config.storagePath, { recursive: true })
			}

			const data = {
				currentMaxIndex: this.currentMaxIndex,
				messages: Array.from(this.messageStore.values()),
				conversationIndices: Object.fromEntries(this.conversationIndices),
				savedAt: new Date().toISOString(),
			}

			await safeWriteJson(indexFilePath, data)
			this.isDirty = false

			console.log(`[MessageIndexManager] Saved ${this.messageStore.size} messages to disk`)
		} catch (error) {
			console.error("[MessageIndexManager] Failed to save to disk:", error)
			throw error
		}
	}

	/**
	 * 启动自动保存定时器
	 */
	private startAutoSave(): void {
		if (this.autoSaveTimer) {
			return
		}

		this.autoSaveTimer = setInterval(() => {
			if (this.isDirty) {
				this.saveToDisk().catch((err) => {
					console.error("[MessageIndexManager] Auto-save failed:", err)
				})
			}
		}, this.config.autoSaveInterval)
	}

	/**
	 * 停止自动保存
	 */
	stopAutoSave(): void {
		if (this.autoSaveTimer) {
			clearInterval(this.autoSaveTimer)
			this.autoSaveTimer = undefined
		}
	}

	/**
	 * 清理资源
	 */
	async dispose(): Promise<void> {
		this.stopAutoSave()

		// 最后一次保存
		if (this.config.enablePersistence && this.isDirty) {
			await this.saveToDisk()
		}
	}
}
