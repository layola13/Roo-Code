/**
 * MessageVectorStore - 消息向量存储
 *
 * 为智能上下文筛选系统提供语义搜索能力
 * 基于 Qdrant 向量数据库实现
 */

import { IEmbedder, EmbeddingResponse } from "../../services/code-index/interfaces/embedder"
import { IVectorStore, PointStruct, VectorStoreSearchResult } from "../../services/code-index/interfaces/vector-store"
import { QdrantVectorStore } from "../../services/code-index/vector-store/qdrant-client"
import { HistoricalMessage } from "./types-intelligent-context"
import { createHash } from "crypto"

/**
 * 消息向量化的Payload结构
 */
export interface MessageVectorPayload {
	/** 消息索引号 */
	messageIndex: number
	/** 全局ID */
	globalId: string
	/** 角色 */
	role: "user" | "assistant"
	/** 消息内容（存储为字符串） */
	contentString: string
	/** 时间戳 */
	timestamp: number
	/** 对话ID */
	conversationId: string
	/** Token数 */
	tokens: number
	/** 摘要（可选） */
	summary?: string
}

/**
 * 消息搜索结果
 */
export interface MessageSearchResult {
	/** 历史消息 */
	message: HistoricalMessage
	/** 相似度分数 (0-1) */
	similarityScore: number
}

/**
 * MessageVectorStore配置
 */
export interface MessageVectorStoreConfig {
	/** Qdrant服务器URL */
	qdrantUrl: string
	/** Qdrant API Key（可选） */
	qdrantApiKey?: string
	/** 向量维度（由embedder决定） */
	vectorSize: number
	/** 工作空间路径 */
	workspacePath: string
	/** 项目ID（用于跨对话存储） */
	projectId?: string
}

/**
 * 消息向量存储实现
 */
export class MessageVectorStore {
	private vectorStore: IVectorStore
	private embedder: IEmbedder
	private collectionName: string = "roo-messages"
	private projectId?: string

	/**
	 * 创建MessageVectorStore实例
	 * @param embedder 嵌入模型服务
	 * @param config 配置选项
	 */
	constructor(embedder: IEmbedder, config: MessageVectorStoreConfig) {
		this.embedder = embedder
		this.projectId = config.projectId

		// 为消息创建独立的Qdrant collection
		// 使用项目级别的collection名称以支持跨对话检索
		if (config.projectId) {
			const hash = createHash("sha256").update(config.projectId).digest("hex")
			this.collectionName = `roo-messages-${hash.substring(0, 16)}`
		}

		// 使用QdrantVectorStore
		this.vectorStore = new QdrantVectorStore(
			config.workspacePath,
			config.qdrantUrl,
			config.vectorSize,
			config.qdrantApiKey,
		)
	}

	/**
	 * 初始化向量存储
	 */
	async initialize(): Promise<void> {
		await this.vectorStore.initialize()
	}

	/**
	 * 存储消息到向量数据库
	 * @param messages 要存储的历史消息数组
	 */
	async storeMessages(messages: HistoricalMessage[]): Promise<void> {
		if (messages.length === 0) {
			return
		}

		// 1. 提取消息内容用于嵌入
		const texts = messages.map((m) => this.prepareMessageTextForEmbedding(m))

		// 2. 创建嵌入向量
		const embeddingResponse: EmbeddingResponse = await this.embedder.createEmbeddings(texts)

		// 3. 构建向量点
		const points: PointStruct[] = messages.map((message, index) => {
			const payload: MessageVectorPayload = {
				messageIndex: message.messageIndex,
				globalId: message.globalId,
				role: message.role,
				contentString: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
				timestamp: message.timestamp,
				conversationId: message.conversationId,
				tokens: message.tokens,
				summary: message.summary,
			}

			return {
				id: message.globalId,
				vector: embeddingResponse.embeddings[index],
				payload: payload as Record<string, any>,
			}
		})

		// 4. 存储到向量数据库
		await this.vectorStore.upsertPoints(points)
	}

	/**
	 * 准备消息文本用于嵌入
	 * 组合多个字段以提高语义搜索质量
	 */
	private prepareMessageTextForEmbedding(message: HistoricalMessage): string {
		const parts: string[] = []

		// 角色标识
		parts.push(`[${message.role}]`)

		// 主要内容（确保是字符串）
		const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content)
		parts.push(content)

		// 添加摘要（如果有）
		if (message.summary) {
			parts.push(`[Summary: ${message.summary}]`)
		}

		return parts.join(" ")
	}

	/**
	 * 语义搜索相关消息
	 * @param query 查询文本（用户当前消息）
	 * @param options 搜索选项
	 * @returns 相关消息列表
	 */
	async semanticSearch(
		query: string,
		options?: {
			/** 最小相似度分数 (0-1) */
			minScore?: number
			/** 最大返回结果数 (top-K) */
			maxResults?: number
			/** 按对话ID过滤 */
			conversationId?: string
			/** 按角色过滤 */
			role?: "user" | "assistant"
		},
	): Promise<MessageSearchResult[]> {
		// 1. 为查询创建嵌入向量
		const embeddingResponse = await this.embedder.createEmbeddings([query])
		const queryVector = embeddingResponse.embeddings[0]

		// 2. 执行向量搜索
		const searchResults: VectorStoreSearchResult[] = await this.vectorStore.search(
			queryVector,
			undefined, // 不使用目录前缀过滤
			options?.minScore ?? 0.6, // 默认最小分数0.6
			options?.maxResults ?? 50, // 默认返回50条（设计要求top-50）
		)

		// 3. 转换结果并应用过滤
		const messageResults: MessageSearchResult[] = []

		for (const result of searchResults) {
			const payload = result.payload as unknown as MessageVectorPayload
			if (!payload) continue

			// 应用对话ID过滤
			if (options?.conversationId && payload.conversationId !== options.conversationId) {
				continue
			}

			// 应用角色过滤
			if (options?.role && payload.role !== options.role) {
				continue
			}

			// 转换为HistoricalMessage
			const message: HistoricalMessage = {
				messageIndex: payload.messageIndex,
				globalId: payload.globalId,
				role: payload.role,
				content: payload.contentString,
				timestamp: payload.timestamp,
				conversationId: payload.conversationId,
				tokens: payload.tokens,
				summary: payload.summary,
			}

			messageResults.push({
				message,
				similarityScore: result.score,
			})
		}

		return messageResults
	}

	/**
	 * 根据消息索引号列表批量获取消息
	 * @param indices 消息索引号数组
	 * @returns 历史消息数组
	 */
	async getMessagesByIndices(indices: number[]): Promise<HistoricalMessage[]> {
		if (indices.length === 0) {
			return []
		}

		try {
			// 使用Qdrant的scroll API获取特定索引的消息
			const client = (this.vectorStore as any).client
			if (!client) {
				throw new Error("Qdrant client not available")
			}

			const messages: HistoricalMessage[] = []

			// 使用filter按messageIndex检索
			const scrollResult = await client.scroll(this.collectionName, {
				filter: {
					should: indices.map((index) => ({
						key: "messageIndex",
						match: { value: index },
					})),
				},
				limit: indices.length,
				with_payload: true,
				with_vector: false,
			})

			if (scrollResult && scrollResult.points) {
				for (const point of scrollResult.points) {
					const payload = point.payload as unknown as MessageVectorPayload
					if (payload) {
						messages.push({
							messageIndex: payload.messageIndex,
							globalId: payload.globalId,
							role: payload.role,
							content: payload.contentString,
							timestamp: payload.timestamp,
							conversationId: payload.conversationId,
							tokens: payload.tokens,
							summary: payload.summary,
						})
					}
				}
			}

			return messages
		} catch (error) {
			console.error("[MessageVectorStore] Failed to get messages by indices:", error)
			return []
		}
	}

	/**
	 * 删除特定对话的所有消息
	 * @param conversationId 对话ID
	 */
	async deleteConversationMessages(conversationId: string): Promise<void> {
		try {
			const client = (this.vectorStore as any).client
			if (!client) {
				throw new Error("Qdrant client not available")
			}

			await client.delete(this.collectionName, {
				filter: {
					must: [
						{
							key: "conversationId",
							match: { value: conversationId },
						},
					],
				},
				wait: true,
			})
		} catch (error) {
			console.error("[MessageVectorStore] Failed to delete conversation messages:", error)
			throw error
		}
	}

	/**
	 * 清除所有消息
	 */
	async clearAllMessages(): Promise<void> {
		await this.vectorStore.clearCollection()
	}

	/**
	 * 获取消息统计信息
	 */
	async getMessageStats(): Promise<{
		totalMessages: number
		byConversation: Record<string, number>
		byRole: Record<string, number>
	}> {
		try {
			const client = (this.vectorStore as any).client
			if (!client) {
				throw new Error("Qdrant client not available")
			}

			const stats = {
				totalMessages: 0,
				byConversation: {} as Record<string, number>,
				byRole: {
					user: 0,
					assistant: 0,
				} as Record<string, number>,
			}

			// 使用scroll API获取所有消息统计
			const scrollResult = await client.scroll(this.collectionName, {
				limit: 1000,
				with_payload: true,
				with_vector: false,
			})

			if (!scrollResult || !scrollResult.points) {
				return stats
			}

			// 统计第一批
			for (const point of scrollResult.points) {
				const payload = point.payload as unknown as MessageVectorPayload
				if (payload) {
					stats.totalMessages++
					stats.byConversation[payload.conversationId] =
						(stats.byConversation[payload.conversationId] || 0) + 1
					stats.byRole[payload.role] = (stats.byRole[payload.role] || 0) + 1
				}
			}

			// 如果有更多数据，继续滚动获取
			let nextPageOffset = scrollResult.next_page_offset
			while (nextPageOffset) {
				const nextScroll = await client.scroll(this.collectionName, {
					offset: nextPageOffset,
					limit: 1000,
					with_payload: true,
					with_vector: false,
				})

				if (!nextScroll || !nextScroll.points) {
					break
				}

				for (const point of nextScroll.points) {
					const payload = point.payload as unknown as MessageVectorPayload
					if (payload) {
						stats.totalMessages++
						stats.byConversation[payload.conversationId] =
							(stats.byConversation[payload.conversationId] || 0) + 1
						stats.byRole[payload.role] = (stats.byRole[payload.role] || 0) + 1
					}
				}

				nextPageOffset = nextScroll.next_page_offset
			}

			return stats
		} catch (error) {
			console.error("[MessageVectorStore] Failed to get message stats:", error)
			return {
				totalMessages: 0,
				byConversation: {},
				byRole: { user: 0, assistant: 0 },
			}
		}
	}

	/**
	 * 生成文本的嵌入向量
	 * @param text 要嵌入的文本
	 * @returns 嵌入向量
	 */
	async generateEmbedding(text: string): Promise<number[]> {
		const response = await this.embedder.createEmbeddings([text])
		return response.embeddings[0]
	}
}
