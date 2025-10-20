/**
 * 消息窗口管理器
 *
 * 实现消息窗口机制，限制内存中消息数量到指定阈值，防止内存溢出
 */

import type { ClineMessage } from "@roo-code/types"

/**
 * 消息窗口配置
 */
export const MESSAGE_WINDOW_CONFIG = {
	// 🔴 最大消息数量限制（必须实施）
	MAX_MESSAGES: 1000,

	// 保留最新的消息数量
	KEEP_RECENT_MESSAGES: 800,

	// 是否启用消息窗口机制
	ENABLED: true,
} as const

/**
 * 消息窗口管理器
 *
 * 负责限制内存中的消息数量，防止无限增长导致的内存溢出
 */
export class MessageWindowManager {
	/**
	 * 应用消息窗口策略
	 *
	 * 如果消息数量超过阈值，保留最新的消息，移除旧消息
	 *
	 * @param messages - 原始消息数组
	 * @returns 应用窗口策略后的消息数组
	 */
	static applyWindow(messages: ClineMessage[]): ClineMessage[] {
		if (!MESSAGE_WINDOW_CONFIG.ENABLED) {
			return messages
		}

		const messageCount = messages.length

		// 如果消息数量未超过阈值，直接返回
		if (messageCount <= MESSAGE_WINDOW_CONFIG.MAX_MESSAGES) {
			return messages
		}

		// 超过阈值，保留最新的消息
		const keepCount = MESSAGE_WINDOW_CONFIG.KEEP_RECENT_MESSAGES
		const removeCount = messageCount - keepCount

		console.log(
			`[MessageWindow] 消息数量 ${messageCount} 超过阈值 ${MESSAGE_WINDOW_CONFIG.MAX_MESSAGES}，` +
				`移除 ${removeCount} 条旧消息，保留最新 ${keepCount} 条`,
		)

		// 保留第一条消息（通常是 task 消息）+ 最新的消息
		const firstMessage = messages[0]
		const recentMessages = messages.slice(-keepCount + 1) // -1 是因为要加上第一条消息

		return [firstMessage, ...recentMessages]
	}

	/**
	 * 估算消息数组的内存占用（字节）
	 *
	 * 这是一个粗略估算，用于监控和日志记录
	 *
	 * @param messages - 消息数组
	 * @returns 估算的内存占用（字节）
	 */
	static estimateMemoryUsage(messages: ClineMessage[]): number {
		let totalSize = 0

		for (const message of messages) {
			// 估算每个消息的大小
			totalSize += JSON.stringify(message).length * 2 // * 2 因为 JavaScript 使用 UTF-16
		}

		return totalSize
	}

	/**
	 * 格式化内存大小为可读字符串
	 *
	 * @param bytes - 字节数
	 * @returns 格式化的字符串（如 "1.5 MB"）
	 */
	static formatMemorySize(bytes: number): string {
		if (bytes < 1024) {
			return `${bytes} B`
		} else if (bytes < 1024 * 1024) {
			return `${(bytes / 1024).toFixed(2)} KB`
		} else {
			return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
		}
	}

	/**
	 * 获取消息窗口统计信息
	 *
	 * @param messages - 消息数组
	 * @returns 统计信息对象
	 */
	static getStats(messages: ClineMessage[]): {
		messageCount: number
		estimatedMemory: string
		isOverLimit: boolean
		utilizationPercent: number
	} {
		const messageCount = messages.length
		const estimatedMemory = this.estimateMemoryUsage(messages)
		const isOverLimit = messageCount > MESSAGE_WINDOW_CONFIG.MAX_MESSAGES
		const utilizationPercent = (messageCount / MESSAGE_WINDOW_CONFIG.MAX_MESSAGES) * 100

		return {
			messageCount,
			estimatedMemory: this.formatMemorySize(estimatedMemory),
			isOverLimit,
			utilizationPercent: Math.round(utilizationPercent),
		}
	}
}
