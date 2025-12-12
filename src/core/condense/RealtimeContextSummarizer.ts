/**
 * RealtimeContextSummarizer - 实时上下文压缩器
 *
 * 核心设计思想：
 * 1. 每次对话轮次结束后，在后台异步/并行地生成增量总结
 * 2. 将总结缓存到内存中
 * 3. 当到达临界点（上下文窗口即将满）时，直接使用已缓存的总结
 * 4. 实现"零等待"的压缩体验
 */

import { ApiMessage } from "../task-persistence/apiMessages"
import { ApiHandler } from "../../api"
import { summarizeConversation, SummarizeResponse } from "./index"
import { ConversationMemory } from "../memory/ConversationMemory"
import { VectorMemoryStore } from "../memory/VectorMemoryStore"
import { DirectoryMemorySystem } from "../../memory/gsw/DirectoryMemorySystem"
import { SubAgentConfig } from "./SubAgentExecutor"

export interface CachedSummary {
	/** 缓存的总结内容 */
	summary: string
	/** 总结对应的消息数量（用于验证缓存有效性） */
	messageCount: number
	/** 总结对应的消息的最后时间戳 */
	lastMessageTs: number
	/** 总结生成时间 */
	generatedAt: number
	/** 估算的新上下文token数 */
	newContextTokens: number
	/** 总结成本 */
	cost: number
	/** 总结后的消息历史 */
	compressedMessages: ApiMessage[]
	/** 完整的 SummarizeResponse（包含 GSW 信息） */
	fullResponse: SummarizeResponse
}

export interface RealtimeCompressorConfig {
	/** 启用实时压缩 */
	enabled: boolean
	/** 触发后台总结的消息增量（每增加N条消息触发一次后台总结） */
	messageIncrement: number
	/** 触发后台总结的token增量（每增加N tokens触发一次后台总结） */
	tokenIncrement: number
	/** 缓存有效期（毫秒） */
	cacheValidityMs: number
	/** 临界点阈值（上下文使用率百分比，到达后使用缓存） */
	criticalThresholdPercent: number
	/** 预警阈值（开始更频繁地更新缓存） */
	warningThresholdPercent: number
}

const DEFAULT_CONFIG: RealtimeCompressorConfig = {
	enabled: true,
	messageIncrement: 5, // 每5条消息更新一次缓存
	tokenIncrement: 20000, // 每20k tokens更新一次缓存
	cacheValidityMs: 5 * 60 * 1000, // 5分钟有效期
	criticalThresholdPercent: 85, // 85%时使用缓存
	warningThresholdPercent: 70, // 70%时开始更频繁更新
}

export class RealtimeContextSummarizer {
	private config: RealtimeCompressorConfig
	private cachedSummary: CachedSummary | null = null
	private isGenerating: boolean = false
	private lastTriggerMessageCount: number = 0
	private lastTriggerTokenCount: number = 0
	private pendingPromise: Promise<void> | null = null
	private taskId: string

	constructor(taskId: string, config: Partial<RealtimeCompressorConfig> = {}) {
		this.taskId = taskId
		this.config = { ...DEFAULT_CONFIG, ...config }
	}

	/**
	 * 检查是否应该触发后台总结
	 * 在每次API响应完成后调用
	 */
	shouldTriggerBackgroundSummary(
		currentMessageCount: number,
		currentTokenCount: number,
		contextWindow: number,
	): boolean {
		if (!this.config.enabled || this.isGenerating) {
			return false
		}

		// 计算上下文使用率
		const usagePercent = (currentTokenCount / contextWindow) * 100

		// 如果已经超过临界点，不需要后台总结了（直接用缓存或等待中的结果）
		if (usagePercent >= this.config.criticalThresholdPercent) {
			return false
		}

		// 计算增量
		const messageIncrement = currentMessageCount - this.lastTriggerMessageCount
		const tokenIncrement = currentTokenCount - this.lastTriggerTokenCount

		// 在预警区域时更频繁触发
		const adjustedMessageIncrement =
			usagePercent >= this.config.warningThresholdPercent
				? Math.ceil(this.config.messageIncrement / 2)
				: this.config.messageIncrement

		const adjustedTokenIncrement =
			usagePercent >= this.config.warningThresholdPercent
				? Math.ceil(this.config.tokenIncrement / 2)
				: this.config.tokenIncrement

		// 满足任一增量条件即触发
		return messageIncrement >= adjustedMessageIncrement || tokenIncrement >= adjustedTokenIncrement
	}

	/**
	 * 在后台并行生成总结（不阻塞主流程）
	 */
	triggerBackgroundSummary(
		messages: ApiMessage[],
		apiHandler: ApiHandler,
		options: {
			systemPrompt?: string
			customCondensingPrompt?: string
			condensingApiHandler?: ApiHandler
			conversationMemory?: ConversationMemory
			vectorMemoryStore?: VectorMemoryStore
			gswMemorySystem?: DirectoryMemorySystem
			subAgentConfig?: SubAgentConfig
		} = {},
	): void {
		if (this.isGenerating) {
			console.log(`[RealtimeContextSummarizer#${this.taskId}] 🔄 已有后台总结在进行中，跳过`)
			return
		}

		this.isGenerating = true
		this.lastTriggerMessageCount = messages.length
		// 估算token数
		this.lastTriggerTokenCount = this.estimateTokens(messages)

		console.log(`[RealtimeContextSummarizer#${this.taskId}] 🚀 启动后台实时总结 (消息数: ${messages.length})`)

		// 并行执行，不阻塞
		this.pendingPromise = this.generateSummaryAsync(messages, apiHandler, options)
			.then(() => {
				console.log(`[RealtimeContextSummarizer#${this.taskId}] ✅ 后台总结完成，已缓存`)
			})
			.catch((error) => {
				console.warn(`[RealtimeContextSummarizer#${this.taskId}] ⚠️ 后台总结失败:`, error.message)
			})
			.finally(() => {
				this.isGenerating = false
				this.pendingPromise = null
			})
	}

	/**
	 * 异步生成总结并缓存
	 */
	private async generateSummaryAsync(
		messages: ApiMessage[],
		apiHandler: ApiHandler,
		options: {
			systemPrompt?: string
			customCondensingPrompt?: string
			condensingApiHandler?: ApiHandler
			conversationMemory?: ConversationMemory
			vectorMemoryStore?: VectorMemoryStore
			gswMemorySystem?: DirectoryMemorySystem
			subAgentConfig?: SubAgentConfig
		},
	): Promise<void> {
		const startTime = Date.now()

		// 创建消息副本用于总结
		const messagesToSummarize = [...messages]

		// 获取最后一条消息的时间戳
		const lastMessageTs =
			messagesToSummarize.length > 0
				? messagesToSummarize[messagesToSummarize.length - 1].ts || Date.now()
				: Date.now()

		// 估算当前上下文 token 数（用于压缩后验证）
		const estimatedTokens = this.estimateTokens(messagesToSummarize)

		// 调用总结函数
		// summarizeConversation(messages, apiHandler, systemPrompt, taskId, prevContextTokens, isAutomaticTrigger, ...)
		const result = await summarizeConversation(
			messagesToSummarize,
			apiHandler,
			options.systemPrompt || "", // systemPrompt (required string)
			this.taskId, // taskId
			estimatedTokens, // prevContextTokens
			true, // isAutomaticTrigger
			options.customCondensingPrompt, // customCondensingPrompt
			options.condensingApiHandler, // condensingApiHandler
			options.conversationMemory, // conversationMemory
			true, // useMemoryEnhancement
			options.vectorMemoryStore, // vectorMemoryStore
			options.gswMemorySystem, // gswMemorySystem
			options.subAgentConfig, // subAgentConfig
		)

		if (result.error) {
			throw new Error(result.error)
		}

		// 缓存结果
		this.cachedSummary = {
			summary: result.summary,
			messageCount: messages.length,
			lastMessageTs,
			generatedAt: Date.now(),
			newContextTokens: result.newContextTokens || 0,
			cost: result.cost,
			compressedMessages: result.messages,
			fullResponse: result,
		}

		const duration = Date.now() - startTime
		console.log(
			`[RealtimeContextSummarizer#${this.taskId}] 📊 总结耗时: ${duration}ms, ` +
				`压缩后tokens: ${result.newContextTokens}, 成本: $${result.cost.toFixed(4)}`,
		)
	}

	/**
	 * 检查是否有可用的缓存总结
	 */
	hasCachedSummary(currentMessageCount: number): boolean {
		if (!this.cachedSummary) {
			return false
		}

		// 检查缓存有效期
		const age = Date.now() - this.cachedSummary.generatedAt
		if (age > this.config.cacheValidityMs) {
			console.log(`[RealtimeContextSummarizer#${this.taskId}] ⏰ 缓存已过期 (${Math.round(age / 1000)}s)`)
			return false
		}

		// 缓存基于的消息数不能比当前消息少太多（允许少5条以内）
		const messageDiff = currentMessageCount - this.cachedSummary.messageCount
		if (messageDiff > 5) {
			console.log(`[RealtimeContextSummarizer#${this.taskId}] 📉 缓存消息差异过大 (差${messageDiff}条)`)
			return false
		}

		return true
	}

	/**
	 * 检查是否到达临界点（应该使用缓存）
	 */
	isCriticalPoint(currentTokenCount: number, contextWindow: number): boolean {
		const usagePercent = (currentTokenCount / contextWindow) * 100
		return usagePercent >= this.config.criticalThresholdPercent
	}

	/**
	 * 获取缓存的总结结果
	 * 在临界点时调用，实现"零等待"压缩
	 */
	getCachedSummary(): CachedSummary | null {
		return this.cachedSummary
	}

	/**
	 * 使用缓存的总结并清除缓存
	 */
	consumeCachedSummary(): CachedSummary | null {
		const cached = this.cachedSummary
		this.cachedSummary = null
		this.lastTriggerMessageCount = 0
		this.lastTriggerTokenCount = 0
		return cached
	}

	/**
	 * 等待正在进行的后台总结完成
	 * 用于临界点时如果没有缓存但有正在进行的总结
	 */
	async waitForPendingSummary(): Promise<CachedSummary | null> {
		if (this.pendingPromise) {
			console.log(`[RealtimeContextSummarizer#${this.taskId}] ⏳ 等待进行中的后台总结...`)
			await this.pendingPromise
		}
		return this.cachedSummary
	}

	/**
	 * 估算消息的token数
	 */
	private estimateTokens(messages: ApiMessage[]): number {
		let total = 0
		for (const msg of messages) {
			const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
			// 中文字符更多时使用更低的ratio
			const hasChineseChar = /[\u4e00-\u9fa5]/.test(content)
			const ratio = hasChineseChar ? 2 : 3.5
			total += content.length / ratio
		}
		return Math.floor(total)
	}

	/**
	 * 获取当前状态（用于调试）
	 */
	getStatus(): {
		enabled: boolean
		hasCachedSummary: boolean
		isGenerating: boolean
		cachedMessageCount: number | null
		cacheAge: number | null
	} {
		return {
			enabled: this.config.enabled,
			hasCachedSummary: this.cachedSummary !== null,
			isGenerating: this.isGenerating,
			cachedMessageCount: this.cachedSummary?.messageCount || null,
			cacheAge: this.cachedSummary ? Date.now() - this.cachedSummary.generatedAt : null,
		}
	}

	/**
	 * 更新配置
	 */
	updateConfig(config: Partial<RealtimeCompressorConfig>): void {
		this.config = { ...this.config, ...config }
	}

	/**
	 * 重置状态
	 */
	reset(): void {
		this.cachedSummary = null
		this.lastTriggerMessageCount = 0
		this.lastTriggerTokenCount = 0
		this.isGenerating = false
		this.pendingPromise = null
	}
}
