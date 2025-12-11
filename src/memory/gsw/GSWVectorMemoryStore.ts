/**
 * GSW向量化记忆存储
 * 使用现有的IVectorStore和IEmbedder接口实现语义搜索
 */

import { IEmbedder, EmbeddingResponse } from "../../services/code-index/interfaces/embedder"
import { IVectorStore, PointStruct, VectorStoreSearchResult } from "../../services/code-index/interfaces/vector-store"
import { MemoryType } from "./types/common"

/**
 * 向量化记忆元数据
 */
export interface GSWMemoryPayload {
	id: string // 记忆ID
	type: MemoryType // interaction/reasoning/evolution
	timestamp: string // ISO时间戳
	filePath: string // YAML文件路径
	summary: string // 摘要文本
	keywords?: string[] // 关键词
	mode?: string // code/architect/debug等
	relatedFiles?: string[] // 相关文件
}

/**
 * 记忆搜索选项
 */
export interface GSWMemorySearchOptions {
	types?: MemoryType[] // 限制记忆类型
	mode?: string // 限制特定模式
	startTime?: string // 时间范围起点
	endTime?: string // 时间范围终点
	maxResults?: number // 最多返回结果数
	minScore?: number // 最低相似度分数
}

/**
 * 搜索结果
 */
export interface GSWMemorySearchResult {
	id: string
	type: MemoryType
	timestamp: string
	filePath: string
	summary: string
	score: number // 相似度分数（0-1）
}

/**
 * 记忆统计
 */
export interface GSWMemoryStats {
	totalMemories: number
	byType: Record<MemoryType, number>
	vectorStoreHealthy: boolean
}

/**
 * 向量存储配置
 */
export interface GSWVectorMemoryStoreConfig {
	qdrantUrl: string
	qdrantApiKey?: string
	vectorSize: number
	projectId?: string
	workspacePath: string
}

/**
 * GSW向量化记忆存储类
 * 适配现有的IVectorStore和IEmbedder接口
 */
export class GSWVectorMemoryStore {
	private vectorStore: IVectorStore
	private embedder: IEmbedder
	private vectorSize: number
	private projectId?: string
	private initialized: boolean = false

	constructor(embedder: IEmbedder, vectorStore: IVectorStore, config: GSWVectorMemoryStoreConfig) {
		this.embedder = embedder
		this.vectorStore = vectorStore
		this.vectorSize = config.vectorSize
		this.projectId = config.projectId
	}

	/**
	 * 初始化向量存储
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return
		}

		try {
			// 调用vectorStore的initialize方法
			const created = await this.vectorStore.initialize()

			if (created) {
				console.log("[GSWVectorMemoryStore] Vector store initialized (new collection created)")
			} else {
				console.log("[GSWVectorMemoryStore] Vector store initialized (existing collection)")
			}

			this.initialized = true
		} catch (error) {
			console.error("[GSWVectorMemoryStore] Failed to initialize:", error)
			throw error
		}
	}

	/**
	 * 索引记忆到向量数据库
	 */
	async indexMemories(memories: GSWMemoryPayload[]): Promise<void> {
		if (!this.initialized) {
			throw new Error("GSWVectorMemoryStore not initialized")
		}

		if (memories.length === 0) {
			return
		}

		try {
			// 为每个记忆生成embedding文本
			const embeddingTexts = memories.map((m) => this.buildEmbeddingText(m))

			// 批量生成embeddings
			const embeddingResponse: EmbeddingResponse = await this.embedder.createEmbeddings(embeddingTexts)
			const embeddings = embeddingResponse.embeddings

			// 准备向量点
			const points: PointStruct[] = memories.map((memory, index) => ({
				id: this.generatePointId(memory.id),
				vector: embeddings[index],
				payload: {
					memoryId: memory.id,
					type: memory.type,
					timestamp: memory.timestamp,
					filePath: memory.filePath,
					summary: memory.summary,
					keywords: memory.keywords || [],
					mode: memory.mode || "",
					relatedFiles: memory.relatedFiles || [],
					// 为了兼容IVectorStore的Payload接口，添加必需字段
					codeChunk: memory.summary, // 复用summary作为codeChunk
					startLine: 0,
					endLine: 0,
				},
			}))

			// 批量插入向量
			await this.vectorStore.upsertPoints(points)

			console.log(`[GSWVectorMemoryStore] Indexed ${memories.length} memories`)
		} catch (error) {
			console.error("[GSWVectorMemoryStore] Failed to index memories:", error)
			throw error
		}
	}

	/**
	 * 语义搜索记忆
	 */
	async searchMemories(query: string, options: GSWMemorySearchOptions = {}): Promise<GSWMemorySearchResult[]> {
		if (!this.initialized) {
			throw new Error("GSWVectorMemoryStore not initialized")
		}

		try {
			// 生成查询embedding
			const embeddingResponse: EmbeddingResponse = await this.embedder.createEmbeddings([query])
			const queryVector = embeddingResponse.embeddings[0]

			// 执行向量搜索
			const results: VectorStoreSearchResult[] = await this.vectorStore.search(
				queryVector,
				undefined, // directoryPrefix - GSW记忆不使用目录前缀过滤
				options.minScore || 0.7,
				options.maxResults || 10,
			)

			// 转换结果格式并应用过滤
			const searchResults: GSWMemorySearchResult[] = results
				.filter((r) => r.payload !== null && r.payload !== undefined)
				.map((r) => {
					const payload = r.payload!
					return {
						id: payload.memoryId as string,
						type: payload.type as MemoryType,
						timestamp: payload.timestamp as string,
						filePath: payload.filePath as string,
						summary: payload.summary as string,
						score: r.score,
					}
				})
				.filter((result) => {
					// 应用类型过滤
					if (options.types && options.types.length > 0) {
						if (!options.types.includes(result.type)) {
							return false
						}
					}

					// 应用时间范围过滤
					if (options.startTime && result.timestamp < options.startTime) {
						return false
					}
					if (options.endTime && result.timestamp > options.endTime) {
						return false
					}

					return true
				})

			return searchResults
		} catch (error) {
			console.error("[GSWVectorMemoryStore] Failed to search memories:", error)
			throw error
		}
	}

	/**
	 * 删除记忆
	 */
	async deleteMemories(memoryIds: string[]): Promise<void> {
		if (!this.initialized) {
			throw new Error("GSWVectorMemoryStore not initialized")
		}

		try {
			// IVectorStore接口使用filePath删除，我们需要将memoryId映射到filePath
			// 由于我们在payload中存储了filePath，可以通过搜索获取
			// 但这不是最优方案，暂时使用clearCollection作为fallback
			console.warn(
				"[GSWVectorMemoryStore] Direct deletion by memoryId not fully supported, consider using deletePointsByFilePath",
			)

			// 这里暂时不实现，因为IVectorStore接口不支持按ID删除
			// 实际使用中应该通过filePath删除
		} catch (error) {
			console.error("[GSWVectorMemoryStore] Failed to delete memories:", error)
			throw error
		}
	}

	/**
	 * 按文件路径删除记忆
	 */
	async deleteMemoriesByFilePath(filePath: string): Promise<void> {
		if (!this.initialized) {
			throw new Error("GSWVectorMemoryStore not initialized")
		}

		try {
			await this.vectorStore.deletePointsByFilePath(filePath)
			console.log(`[GSWVectorMemoryStore] Deleted memories for file: ${filePath}`)
		} catch (error) {
			console.error("[GSWVectorMemoryStore] Failed to delete memories by filePath:", error)
			throw error
		}
	}

	/**
	 * 获取统计信息
	 */
	async getMemoryStats(): Promise<GSWMemoryStats> {
		if (!this.initialized) {
			throw new Error("GSWVectorMemoryStore not initialized")
		}

		try {
			// 由于IVectorStore接口没有提供统计API，我们通过搜索获取近似统计
			// 使用零向量搜索获取所有记忆
			const zeroVector = new Array(this.vectorSize).fill(0)
			const allResults = await this.vectorStore.search(
				zeroVector,
				undefined,
				0, // minScore设为0以获取所有结果
				10000, // 设置一个大的limit
			)

			// 统计各类型数量
			const byType: Record<MemoryType, number> = {
				interaction: 0,
				reasoning: 0,
				evolution: 0,
			}

			for (const result of allResults) {
				if (result.payload && result.payload.type) {
					const type = result.payload.type as MemoryType
					if (type in byType) {
						byType[type]++
					}
				}
			}

			return {
				totalMemories: allResults.length,
				byType,
				vectorStoreHealthy: true,
			}
		} catch (error) {
			console.error("[GSWVectorMemoryStore] Failed to get stats:", error)
			return {
				totalMemories: 0,
				byType: { interaction: 0, reasoning: 0, evolution: 0 },
				vectorStoreHealthy: false,
			}
		}
	}

	/**
	 * 健康检查
	 */
	async healthCheck(): Promise<boolean> {
		if (!this.initialized) {
			return false
		}

		try {
			const exists = await this.vectorStore.collectionExists()
			return exists
		} catch (error) {
			console.error("[GSWVectorMemoryStore] Health check failed:", error)
			return false
		}
	}

	/**
	 * 清空所有记忆
	 */
	async clearAllMemories(): Promise<void> {
		if (!this.initialized) {
			throw new Error("GSWVectorMemoryStore not initialized")
		}

		try {
			await this.vectorStore.clearCollection()
			console.log("[GSWVectorMemoryStore] Cleared all memories")
		} catch (error) {
			console.error("[GSWVectorMemoryStore] Failed to clear memories:", error)
			throw error
		}
	}

	/**
	 * 构建embedding文本（组合多字段）
	 */
	private buildEmbeddingText(memory: GSWMemoryPayload): string {
		const parts: string[] = [memory.summary]

		if (memory.keywords && memory.keywords.length > 0) {
			parts.push(`Keywords: ${memory.keywords.join(", ")}`)
		}

		if (memory.mode) {
			parts.push(`Mode: ${memory.mode}`)
		}

		if (memory.relatedFiles && memory.relatedFiles.length > 0) {
			parts.push(`Files: ${memory.relatedFiles.join(", ")}`)
		}

		parts.push(`Type: ${memory.type}`)

		return parts.join(" | ")
	}

	/**
	 * 生成向量点ID（使用简单的字符串ID）
	 */
	private generatePointId(memoryId: string): string {
		// IVectorStore接口的PointStruct使用string类型的id
		return memoryId
	}
}
