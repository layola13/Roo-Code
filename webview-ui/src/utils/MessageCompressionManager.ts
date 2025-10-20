/**
 * 消息压缩管理器
 *
 * 实现智能消息压缩策略，利用现有的 condense-code-summarizer subagent 压缩历史消息
 */

import type { ClineMessage } from "@roo-code/types"
import { MESSAGE_COMPRESSION_CONFIG, COMPRESSION_STRATEGIES, type CompressionLevel } from "../config/messageCompression"

/**
 * Token估算工具（简化版）
 * 基于经验公式：英文/代码 ~3.5字符/token，中文 ~2字符/token
 */
class TokenEstimator {
	private static readonly ENGLISH_RATIO = 3.5
	private static readonly CHINESE_RATIO = 2.0

	static estimateTokens(text: string): number {
		if (!text) return 0

		const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
		const totalChars = text.length

		// 如果超过30%是中文，使用中文比例
		if (chineseChars / totalChars > 0.3) {
			return Math.ceil(totalChars / TokenEstimator.CHINESE_RATIO)
		}

		return Math.ceil(totalChars / TokenEstimator.ENGLISH_RATIO)
	}

	static estimateMessage(message: ClineMessage): number {
		let total = 4 // 消息结构开销

		// 估算文本内容
		if (message.text) {
			total += TokenEstimator.estimateTokens(message.text)
		}

		// 估算图片
		if (message.images && message.images.length > 0) {
			total += message.images.length * 85 // 每张图片约85 tokens
		}

		return total
	}

	static estimateMessages(messages: ClineMessage[]): number {
		return messages.reduce((sum, msg) => sum + TokenEstimator.estimateMessage(msg), 0)
	}
}

/**
 * 压缩后的消息接口
 */
export interface CompressedMessage extends ClineMessage {
	compressed: true
	compressionLevel: CompressionLevel
	originalSize: number
	compressedSize: number
	compressionRatio: number
	compressedAt: number
}

/**
 * 压缩结果接口
 */
export interface CompressionResult {
	success: boolean
	originalCount: number
	compressedCount: number
	compressedMessages: ClineMessage[]
	tokensSaved: number
	durationMs: number
	error?: string
}

/**
 * 消息压缩管理器
 *
 * 负责智能压缩历史消息，减少内存占用
 */
export class MessageCompressionManager {
	private static lastCheckCount = 0
	private static compressionInProgress = false

	/**
	 * 渐进式压缩检查
	 *
	 * 每100条消息调用一次，检查是否需要压缩
	 *
	 * @param messages - 消息数组
	 * @param enabled - 是否启用压缩（从全局设置获取）
	 * @returns 压缩后的消息数组
	 */
	static async checkAndCompress(
		messages: ClineMessage[],
		enabled: boolean = MESSAGE_COMPRESSION_CONFIG.ENABLED,
		forceCompress: boolean = false,
	): Promise<ClineMessage[]> {
		if (!enabled) {
			return messages
		}

		const currentCount = messages.length

		// 🔴 问题5：添加压缩条件检查 - 消息不足100条不压缩
		if (currentCount < MESSAGE_COMPRESSION_CONFIG.CHECK_INTERVAL && !forceCompress) {
			console.log(
				`[Compression] 消息数量 ${currentCount} 小于阈值 ${MESSAGE_COMPRESSION_CONFIG.CHECK_INTERVAL}，跳过压缩`,
			)
			return messages
		}

		// 检查是否达到检查间隔（除非强制压缩）
		if (!forceCompress && currentCount - this.lastCheckCount < MESSAGE_COMPRESSION_CONFIG.CHECK_INTERVAL) {
			return messages
		}

		// 防止并发压缩
		if (this.compressionInProgress) {
			return messages
		}

		this.lastCheckCount = currentCount

		try {
			this.compressionInProgress = true
			return await this.incrementalCompress(messages)
		} finally {
			this.compressionInProgress = false
		}
	}

	/**
	 * 执行压缩并返回详细结果（用于UI显示）
	 */
	static async compressWithResult(
		messages: ClineMessage[],
		enabled: boolean = MESSAGE_COMPRESSION_CONFIG.ENABLED,
	): Promise<CompressionResult> {
		const startTime = Date.now()
		const originalCount = messages.length

		try {
			if (!enabled) {
				return {
					success: false,
					originalCount,
					compressedCount: 0,
					compressedMessages: messages,
					tokensSaved: 0,
					durationMs: 0,
					error: "压缩功能未启用",
				}
			}

			// 检查消息数量条件
			if (originalCount < MESSAGE_COMPRESSION_CONFIG.CHECK_INTERVAL) {
				return {
					success: false,
					originalCount,
					compressedCount: 0,
					compressedMessages: messages,
					tokensSaved: 0,
					durationMs: Date.now() - startTime,
					error: `消息数量 ${originalCount} 小于最小阈值 ${MESSAGE_COMPRESSION_CONFIG.CHECK_INTERVAL}`,
				}
			}

			// 🆕 检查Token限制（120K上限）- 向后兼容：如果超过限制，减少消息数量
			const now = Date.now()
			const boundary = now - MESSAGE_COMPRESSION_CONFIG.TIME_WINDOW_MS
			let compressibleMessages = messages.filter(
				(msg) => msg.ts < boundary && !(msg as any).compressed && this.shouldCompress(msg),
			)

			if (compressibleMessages.length === 0) {
				return {
					success: false,
					originalCount,
					compressedCount: 0,
					compressedMessages: messages,
					tokensSaved: 0,
					durationMs: Date.now() - startTime,
					error: "没有找到可压缩的消息（消息需要超过1小时且未被压缩）",
				}
			}

			// 估算待压缩消息的Token数量
			const MAX_TOKENS = 120000 // 120K token限制
			let estimatedTokens = TokenEstimator.estimateMessages(compressibleMessages)

			// 🔑 向后兼容逻辑：如果Token超过120K，从最旧的消息开始减少
			if (estimatedTokens > MAX_TOKENS) {
				console.log(
					`[Compression] 待压缩消息Token数 (${estimatedTokens}) 超过限制 (${MAX_TOKENS})，开始减少消息数量...`,
				)

				// 按时间戳排序（从旧到新）
				const sortedMessages = [...compressibleMessages].sort((a, b) => a.ts - b.ts)
				const reducedMessages: ClineMessage[] = []
				let currentTokens = 0

				// 从最旧的消息开始累加，直到达到120K限制
				for (const msg of sortedMessages) {
					const msgTokens = TokenEstimator.estimateMessage(msg)
					if (currentTokens + msgTokens <= MAX_TOKENS) {
						reducedMessages.push(msg)
						currentTokens += msgTokens
					} else {
						// 达到限制，停止添加
						break
					}
				}

				compressibleMessages = reducedMessages
				estimatedTokens = currentTokens

				console.log(
					`[Compression] 已减少至 ${compressibleMessages.length} 条消息，` +
						`估算Token: ${estimatedTokens} (节省了 ${sortedMessages.length - compressibleMessages.length} 条消息)`,
				)
			}

			// 如果减少后仍然没有可压缩的消息，返回错误
			if (compressibleMessages.length === 0) {
				return {
					success: false,
					originalCount,
					compressedCount: 0,
					compressedMessages: messages,
					tokensSaved: 0,
					durationMs: Date.now() - startTime,
					error: `Token限制导致无法压缩任何消息`,
				}
			}

			console.log(`[Compression] 待压缩消息: ${compressibleMessages.length} 条，估算Token: ${estimatedTokens}`)

			// 防止并发压缩
			if (this.compressionInProgress) {
				return {
					success: false,
					originalCount,
					compressedCount: 0,
					compressedMessages: messages,
					tokensSaved: 0,
					durationMs: 0,
					error: "压缩操作正在进行中",
				}
			}

			this.compressionInProgress = true

			// 执行压缩
			const compressedMessages = await this.incrementalCompress(messages)

			// 计算实际被压缩的消息数量（新增compressed标记的）
			const compressedCount = compressedMessages.filter((m) => (m as CompressedMessage).compressed).length

			// 如果没有消息被压缩，返回失败
			if (compressedCount === 0) {
				return {
					success: false,
					originalCount,
					compressedCount: 0,
					compressedMessages: messages,
					tokensSaved: 0,
					durationMs: Date.now() - startTime,
					error: "没有找到可压缩的消息（消息需要超过1小时且未被压缩）",
				}
			}

			// 计算压缩前后的Token差异
			const stats = this.getCompressionStats(compressedMessages)
			const tokensSaved = Math.floor((stats.totalSizeBefore - stats.totalSizeAfter) / 2)

			const durationMs = Date.now() - startTime

			return {
				success: true,
				originalCount,
				compressedCount,
				compressedMessages,
				tokensSaved: Math.max(0, tokensSaved), // 确保不为负数
				durationMs,
			}
		} catch (error) {
			return {
				success: false,
				originalCount,
				compressedCount: 0,
				compressedMessages: messages,
				tokensSaved: 0,
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			}
		} finally {
			this.compressionInProgress = false
		}
	}

	/**
	 * 增量压缩
	 *
	 * 压缩所有符合条件的历史消息（1小时前 + 未压缩 + 应该压缩）
	 *
	 * @param messages - 消息数组
	 * @returns 压缩后的消息数组
	 */
	private static async incrementalCompress(messages: ClineMessage[]): Promise<ClineMessage[]> {
		const now = Date.now()
		const boundary = now - MESSAGE_COMPRESSION_CONFIG.TIME_WINDOW_MS
		const MAX_TOKENS = 120000 // 120K token限制

		// 找出所有可压缩的消息（1小时前 + 未压缩 + 应该压缩）
		const compressibleCandidates: Array<{ index: number; message: ClineMessage }> = []
		let oldestMessageTime: number | undefined
		let newestOldMessageTime: number | undefined

		for (let i = 0; i < messages.length; i++) {
			const msg = messages[i]
			const isOld = msg.ts < boundary
			const isNotCompressed = !(msg as CompressedMessage).compressed
			const shouldCompress = this.shouldCompress(msg)

			// 记录最老的消息时间和最新的"旧消息"时间，用于日志
			if (!oldestMessageTime) {
				oldestMessageTime = msg.ts
			}
			if (isOld && (!newestOldMessageTime || msg.ts > newestOldMessageTime)) {
				newestOldMessageTime = msg.ts
			}

			// 收集所有符合条件的消息
			if (isOld && isNotCompressed && shouldCompress) {
				compressibleCandidates.push({ index: i, message: msg })
			}
		}

		// 🔴 问题5：添加时间检查 - 如果所有消息都在1小时内，不压缩
		if (compressibleCandidates.length === 0) {
			const timeWindow = MESSAGE_COMPRESSION_CONFIG.TIME_WINDOW_MS / 1000 / 60 // 转换为分钟
			if (oldestMessageTime && now - oldestMessageTime < MESSAGE_COMPRESSION_CONFIG.TIME_WINDOW_MS) {
				console.log(
					`[Compression] 所有消息都在最近 ${timeWindow} 分钟内，跳过压缩。` +
						`最老消息: ${Math.floor((now - oldestMessageTime) / 1000 / 60)} 分钟前`,
				)
			} else {
				console.log(`[Compression] 没有找到可压缩的消息`)
			}
			return messages
		}

		// 🔑 向后兼容逻辑：检查Token限制，如果超过120K，从最旧的消息开始减少
		const compressibleMessages = compressibleCandidates.map((c) => c.message)
		let estimatedTokens = TokenEstimator.estimateMessages(compressibleMessages)

		if (estimatedTokens > MAX_TOKENS) {
			console.log(
				`[Compression] 待压缩消息Token数 (${estimatedTokens}) 超过限制 (${MAX_TOKENS})，开始减少消息数量...`,
			)

			// 按时间戳排序（从旧到新）
			const sortedCandidates = [...compressibleCandidates].sort((a, b) => a.message.ts - b.message.ts)
			const reducedCandidates: typeof compressibleCandidates = []
			let currentTokens = 0

			// 从最旧的消息开始累加，直到达到120K限制
			for (const candidate of sortedCandidates) {
				const msgTokens = TokenEstimator.estimateMessage(candidate.message)
				if (currentTokens + msgTokens <= MAX_TOKENS) {
					reducedCandidates.push(candidate)
					currentTokens += msgTokens
				} else {
					// 达到限制，停止添加
					break
				}
			}

			compressibleCandidates.length = 0
			compressibleCandidates.push(...reducedCandidates)
			estimatedTokens = currentTokens

			console.log(
				`[Compression] 已减少至 ${compressibleCandidates.length} 条消息，` +
					`估算Token: ${estimatedTokens} (跳过了 ${sortedCandidates.length - compressibleCandidates.length} 条消息)`,
			)
		}

		if (compressibleCandidates.length === 0) {
			console.log(`[Compression] Token限制导致无法压缩任何消息`)
			return messages
		}

		console.log(
			`[Compression] 找到 ${compressibleCandidates.length} 条可压缩消息，估算Token: ${estimatedTokens}` +
				` (1小时前的消息，未压缩且可压缩)`,
		)

		// 批量压缩所有符合条件的消息
		const compressed = [...messages]
		for (const { index, message } of compressibleCandidates) {
			compressed[index] = await this.compressMessage(message)
		}

		console.log(`[Compression] 成功压缩 ${compressibleCandidates.length} 条消息`)

		return compressed
	}

	/**
	 * 判断消息是否应该被压缩
	 *
	 * @param message - 消息对象
	 * @returns 是否应该压缩
	 */
	private static shouldCompress(message: ClineMessage): boolean {
		// 永不压缩的消息类型
		if (message.say && MESSAGE_COMPRESSION_CONFIG.NEVER_COMPRESS_TYPES.includes(message.say)) {
			return false
		}

		// 永不压缩的 ask 类型
		if (message.ask && MESSAGE_COMPRESSION_CONFIG.NEVER_COMPRESS_ASK_TYPES.includes(message.ask as any)) {
			return false
		}

		// Task 消息不压缩
		if (message.type === "ask" && !message.ask) {
			return false
		}

		return true
	}

	/**
	 * 获取消息的工具类型
	 *
	 * @param message - 消息对象
	 * @returns 工具类型字符串
	 */
	private static getToolType(message: ClineMessage): string {
		if (message.say) {
			return message.say
		}

		// 尝试从 text 中解析工具类型
		if (message.text) {
			try {
				const parsed = JSON.parse(message.text)
				if (parsed.tool) {
					return parsed.tool
				}
			} catch {
				// 解析失败，忽略
			}
		}

		return "unknown"
	}

	/**
	 * 压缩单条消息
	 *
	 * @param message - 原始消息
	 * @returns 压缩后的消息
	 */
	private static async compressMessage(message: ClineMessage): Promise<CompressedMessage> {
		const tool = this.getToolType(message)
		const level = (MESSAGE_COMPRESSION_CONFIG.COMPRESSION_RULES[tool] as CompressionLevel) || "light"

		const originalSize = this.estimateSize(message)
		const compressed = await this.performCompression(message, level)
		const compressedSize = this.estimateSize(compressed)

		return {
			...compressed,
			compressed: true,
			compressionLevel: level,
			originalSize,
			compressedSize,
			compressionRatio: compressedSize / originalSize,
			compressedAt: Date.now(),
		} as CompressedMessage
	}

	/**
	 * 执行压缩
	 *
	 * @param message - 原始消息
	 * @param level - 压缩级别
	 * @returns 压缩后的消息
	 */
	private static async performCompression(message: ClineMessage, level: CompressionLevel): Promise<ClineMessage> {
		switch (level) {
			case "light":
				return this.lightCompress(message)
			case "medium":
				return await this.mediumCompress(message)
			case "heavy":
				return this.heavyCompress(message)
			default:
				return message
		}
	}

	/**
	 * 轻度压缩
	 *
	 * 只添加压缩标记，保留完整内容
	 *
	 * @param message - 原始消息
	 * @returns 压缩后的消息
	 */
	private static lightCompress(message: ClineMessage): ClineMessage {
		// 轻度压缩：保留完整内容，只添加标记
		return {
			...message,
			// 保留所有内容
		}
	}

	/**
	 * 中度压缩
	 *
	 * 保留关键信息，移除冗余内容，可选使用 subagent 生成摘要
	 *
	 * @param message - 原始消息
	 * @returns 压缩后的消息
	 */
	private static async mediumCompress(message: ClineMessage): Promise<ClineMessage> {
		const strategy = COMPRESSION_STRATEGIES.medium

		// 如果文本内容超过限制，进行截断
		if (message.text && message.text.length > strategy.maxContentLength) {
			return {
				...message,
				text: message.text.substring(0, strategy.maxContentLength) + "... [已压缩]",
				images: undefined, // 移除图片引用以节省内存
			}
		}

		return message
	}

	/**
	 * 重度压缩
	 *
	 * 只保留元数据，移除详细内容
	 *
	 * @param message - 原始消息
	 * @returns 压缩后的消息
	 */
	private static heavyCompress(message: ClineMessage): ClineMessage {
		const strategy = COMPRESSION_STRATEGIES.heavy

		// 生成简短摘要
		let summary = ""
		if (message.say) {
			summary = `[${message.say}]`
		} else if (message.ask) {
			summary = `[${message.ask}]`
		}

		// 如果有文本，保留前100个字符
		if (message.text && message.text.length > 0) {
			const preview = message.text.substring(0, strategy.maxContentLength)
			summary += ` ${preview}...`
		}

		return {
			ts: message.ts,
			type: message.type,
			say: message.say,
			ask: message.ask,
			text: summary,
			partial: message.partial,
			// 移除所有大内容字段
			images: undefined,
			imageIds: undefined,
			reasoning: undefined,
		}
	}

	/**
	 * 估算消息的大小（字节）
	 *
	 * @param message - 消息对象
	 * @returns 估算的大小（字节）
	 */
	private static estimateSize(message: ClineMessage): number {
		return JSON.stringify(message).length * 2 // * 2 因为 JavaScript 使用 UTF-16
	}

	/**
	 * 获取压缩统计信息
	 *
	 * @param messages - 消息数组
	 * @returns 统计信息对象
	 */
	static getCompressionStats(messages: ClineMessage[]): {
		totalMessages: number
		compressedMessages: number
		compressionRate: number
		totalSizeBefore: number
		totalSizeAfter: number
		memorySaved: string
	} {
		const totalMessages = messages.length
		let compressedMessages = 0
		let totalSizeBefore = 0
		let totalSizeAfter = 0

		for (const message of messages) {
			const currentSize = this.estimateSize(message)
			totalSizeAfter += currentSize

			if ((message as CompressedMessage).compressed) {
				compressedMessages++
				totalSizeBefore += (message as CompressedMessage).originalSize
			} else {
				totalSizeBefore += currentSize
			}
		}

		const memorySaved = totalSizeBefore - totalSizeAfter

		return {
			totalMessages,
			compressedMessages,
			compressionRate: totalMessages > 0 ? Math.round((compressedMessages / totalMessages) * 100) : 0,
			totalSizeBefore,
			totalSizeAfter,
			memorySaved: this.formatMemorySize(memorySaved),
		}
	}

	/**
	 * 格式化内存大小为可读字符串
	 *
	 * @param bytes - 字节数
	 * @returns 格式化的字符串
	 */
	private static formatMemorySize(bytes: number): string {
		if (bytes < 1024) {
			return `${bytes} B`
		} else if (bytes < 1024 * 1024) {
			return `${(bytes / 1024).toFixed(2)} KB`
		} else {
			return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
		}
	}
}
