/**
 * GSW三元记忆系统 - 目录化文件管理核心类
 * 提供高性能的三元记忆存储和检索功能
 */

import * as fs from "fs/promises"
import * as path from "path"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { fileExistsAtPath } from "../../utils/fs"
import { YAMLHandler } from "./utils/YAMLHandler"
import { PathGenerator } from "./utils/PathGenerator"
import { IndexManager } from "./IndexManager"
import { FileRotator } from "./FileRotator"
import { MemoryScheduler } from "./MemoryScheduler"
import { GSWVectorMemoryStore, GSWMemoryPayload, GSWVectorMemoryStoreConfig } from "./GSWVectorMemoryStore"
import { IEmbedder } from "../../services/code-index/interfaces/embedder"
import { IVectorStore } from "../../services/code-index/interfaces/vector-store"
import { MemoryType, MemoryFilter, MemoryStats, HealthReport, HealthIssue } from "./types/common"
import { InteractionMemory } from "./types/interaction"
import { ReasoningMemory } from "./types/reasoning"
import { EvolutionMemory } from "./types/evolution"
import { MemoryIndex, IndexEntry } from "./types/index"
import { MemorySystemConfig, DEFAULT_CONFIG, RotatorConfig } from "./types/config"
import { SessionSummary } from "./types/summary"

/**
 * 记忆数据联合类型
 */
type MemoryData = InteractionMemory | ReasoningMemory | EvolutionMemory

export class DirectoryMemorySystem {
	private readonly rootPath: string
	private readonly config: MemorySystemConfig
	private readonly pathGenerator: PathGenerator
	private readonly indexManagers: Map<MemoryType, IndexManager>
	private readonly fileRotator: FileRotator
	private scheduler?: MemoryScheduler
	private vectorStore?: GSWVectorMemoryStore
	private enableVectorSearch: boolean = false
	private sessionSummaries: Map<string, SessionSummary> = new Map()

	constructor(
		rootPath: string,
		config?: Partial<MemorySystemConfig>,
		embedder?: IEmbedder,
		vectorStore?: IVectorStore,
		vectorConfig?: {
			vectorSize: number
			projectId?: string
		},
	) {
		this.rootPath = rootPath
		this.config = { ...DEFAULT_CONFIG, ...config, rootPath }
		this.pathGenerator = new PathGenerator(rootPath)
		this.indexManagers = new Map()

		// 初始化索引管理器
		const types: MemoryType[] = ["interaction", "reasoning", "evolution"]
		for (const type of types) {
			const indexPath = this.pathGenerator.getIndexPath(type)
			this.indexManagers.set(type, new IndexManager(indexPath, type))
		}

		// 初始化文件归档器
		const rotatorConfig: RotatorConfig = {
			archiveAfterDays: this.config.archiveAfterDays,
			deleteAfterDays: this.config.archiveAfterDays * 3, // 归档后再保留3倍时间
			maxArchiveSizeMB: 1000, // 默认1GB
		}
		this.fileRotator = new FileRotator(rootPath, rotatorConfig)

		// 初始化向量化存储（如果提供了embedder和vectorStore）
		if (embedder && vectorStore && vectorConfig) {
			const gswVectorConfig: GSWVectorMemoryStoreConfig = {
				qdrantUrl: "", // vectorStore已经初始化，不需要URL
				vectorSize: vectorConfig.vectorSize,
				projectId: vectorConfig.projectId,
				workspacePath: rootPath,
			}
			this.vectorStore = new GSWVectorMemoryStore(embedder, vectorStore, gswVectorConfig)
			this.enableVectorSearch = true
		}
	}

	/**
	 * 初始化系统（创建目录结构）
	 */
	async initialize(): Promise<void> {
		const directories = [
			path.join(this.rootPath, "interaction"),
			path.join(this.rootPath, "interaction", "archive"),
			path.join(this.rootPath, "reasoning"),
			path.join(this.rootPath, "reasoning", "archive"),
			path.join(this.rootPath, "evolution"),
			path.join(this.rootPath, "evolution", "archive"),
			path.join(this.rootPath, "summaries"),
			path.join(this.rootPath, "system", "locks"),
		]

		// 并行创建所有目录
		await Promise.all(
			directories.map((dir) =>
				fs.mkdir(dir, { recursive: true }).catch((err) => {
					console.error(`Failed to create directory ${dir}:`, err)
					throw err
				}),
			),
		)

		// 初始化配置文件
		await this.initializeConfig()

		// 初始化索引文件
		await this.initializeIndices()

		// 初始化统计数据
		await this.initializeStats()

		// 初始化向量存储（如果启用）
		if (this.vectorStore) {
			try {
				await this.vectorStore.initialize()
				console.log("[DirectoryMemorySystem] Vector search enabled")
			} catch (error) {
				console.warn("[DirectoryMemorySystem] Failed to initialize vector store:", error)
				this.vectorStore = undefined
				this.enableVectorSearch = false
			}
		}

		// 🔥 启动MemoryScheduler定时维护
		try {
			this.scheduler = new MemoryScheduler(this, {
				archiveIntervalMs: 24 * 60 * 60 * 1000, // 24小时
				indexRebuildIntervalMs: 12 * 60 * 60 * 1000, // 12小时
				cleanupIntervalMs: 7 * 24 * 60 * 60 * 1000, // 7天
				archiveThreshold: 100, // 超过100个活跃会话触发归档
				cleanupThresholdDays: 90, // 90天前的归档文件会被清理
			})
			this.scheduler.start()
			console.log("[DirectoryMemorySystem] MemoryScheduler started")
		} catch (error) {
			console.warn("[DirectoryMemorySystem] Failed to start MemoryScheduler:", error)
			// 非关键功能，失败不影响主系统
		}
	}

	/**
	 * 停止调度器并清理资源
	 */
	dispose(): void {
		if (this.scheduler) {
			this.scheduler.stop()
			this.scheduler = undefined
			console.log("[DirectoryMemorySystem] MemoryScheduler stopped")
		}
	}

	/**
	 * 获取调度器状态（用于调试和监控）
	 */
	getSchedulerStatus() {
		return this.scheduler?.getStatus()
	}

	/**
	 * 写入记忆（自动处理分片和索引更新）
	 */
	async writeMemory(type: MemoryType, data: MemoryData): Promise<string> {
		// 生成文件路径
		const id = this.extractId(data, type)
		const filePath = this.generateFilePath(type, id, data)

		// 确保目录存在
		const dir = path.dirname(filePath)
		await fs.mkdir(dir, { recursive: true })

		// 写入YAML文件
		await YAMLHandler.write(filePath, data)

		// 更新索引
		const stats = await fs.stat(filePath)
		const indexEntry: IndexEntry = {
			id,
			file_path: path.relative(process.cwd(), filePath),
			timestamp: data.timestamp || new Date().toISOString(),
			summary: this.generateSummary(data, type),
			keywords: this.extractKeywords(data),
			mode: this.extractMode(data),
			related_files: this.extractRelatedFiles(data),
			size_kb: Math.ceil(stats.size / 1024),
		}

		const indexManager = this.indexManagers.get(type)
		if (indexManager) {
			await indexManager.addEntry(indexEntry)
		}

		// 同步更新向量存储（如果启用）
		if (this.vectorStore) {
			try {
				const vectorPayload: GSWMemoryPayload = {
					id,
					type,
					timestamp: indexEntry.timestamp,
					filePath: indexEntry.file_path,
					summary: indexEntry.summary,
					keywords: indexEntry.keywords,
					mode: indexEntry.mode,
					relatedFiles: indexEntry.related_files,
				}
				await this.vectorStore.indexMemories([vectorPayload])
			} catch (error) {
				console.warn(`[DirectoryMemorySystem] Failed to index memory to vector store:`, error)
				// 不抛出错误，因为YAML已成功写入
			}
		}

		return id
	}

	/**
	 * 读取记忆（支持ID或文件路径）
	 */
	async readMemory(type: MemoryType, id: string): Promise<MemoryData | null> {
		// 通过索引查找文件路径
		const indexManager = this.indexManagers.get(type)
		if (!indexManager) {
			return null
		}

		const results = await indexManager.query({ limit: 1 })
		const entry = results.find((e) => e.id === id)

		if (!entry) {
			return null
		}

		const filePath = path.resolve(entry.file_path)

		if (!(await fileExistsAtPath(filePath))) {
			return null
		}

		return await YAMLHandler.read<MemoryData>(filePath)
	}

	/**
	 * 批量读取（基于过滤条件）
	 */
	async readMemories(type: MemoryType, filter: MemoryFilter): Promise<MemoryData[]> {
		const indexManager = this.indexManagers.get(type)
		if (!indexManager) {
			return []
		}

		// 查询索引
		const entries = await indexManager.query({
			startTime: filter.startTime,
			endTime: filter.endTime,
			keywords: filter.keywords,
			mode: filter.mode,
			relatedFiles: filter.relatedFiles,
			limit: filter.limit,
			offset: filter.offset,
		})

		// 批量读取文件
		const filePaths = entries.map((e) => path.resolve(e.file_path))
		return await YAMLHandler.readBatch<MemoryData>(filePaths)
	}

	/**
	 * 删除记忆（软删除，移至归档）
	 */
	async archiveMemory(type: MemoryType, id: string): Promise<void> {
		const indexManager = this.indexManagers.get(type)
		if (!indexManager) {
			return
		}

		const results = await indexManager.query({ limit: 1 })
		const entry = results.find((e) => e.id === id)

		if (!entry) {
			return
		}

		const sourcePath = path.resolve(entry.file_path)
		if (!(await fileExistsAtPath(sourcePath))) {
			return
		}

		// 移动到归档目录
		const archivePath = this.pathGenerator.getArchivePath(type)
		const fileName = path.basename(sourcePath)
		const destPath = path.join(archivePath, fileName)

		await fs.rename(sourcePath, destPath)

		// 从索引中删除
		await indexManager.removeEntry(id)
	}

	/**
	 * 获取统计信息
	 */
	async getStats(): Promise<MemoryStats> {
		const stats: MemoryStats = {
			totalEntries: 0,
			totalSizeKB: 0,
			oldestEntry: null,
			newestEntry: null,
			byType: {
				interaction: 0,
				reasoning: 0,
				evolution: 0,
			},
		}

		const types: MemoryType[] = ["interaction", "reasoning", "evolution"]

		for (const type of types) {
			const indexManager = this.indexManagers.get(type)
			if (indexManager) {
				const metadata = await indexManager.getStats()
				stats.totalEntries += metadata.total_entries
				stats.totalSizeKB += metadata.total_size_kb
				stats.byType[type] = metadata.total_entries

				if (metadata.oldest_entry && (!stats.oldestEntry || metadata.oldest_entry < stats.oldestEntry)) {
					stats.oldestEntry = metadata.oldest_entry
				}
			}
		}

		return stats
	}

	/**
	 * 健康检查（检测损坏文件、孤立索引等）
	 */
	async healthCheck(): Promise<HealthReport> {
		const issues: HealthIssue[] = []
		let totalFiles = 0
		let corruptedFiles = 0
		let orphanedIndexEntries = 0
		let missingIndexEntries = 0

		const types: MemoryType[] = ["interaction", "reasoning", "evolution"]

		for (const type of types) {
			const indexManager = this.indexManagers.get(type)
			if (!indexManager) {
				continue
			}

			const entries = await indexManager.query({})
			totalFiles += entries.length

			for (const entry of entries) {
				const filePath = path.resolve(entry.file_path)

				// 检查文件是否存在
				if (!(await fileExistsAtPath(filePath))) {
					orphanedIndexEntries++
					issues.push({
						type: "orphaned_index",
						severity: "medium",
						filePath: entry.file_path,
						message: `Index entry exists but file is missing`,
					})
					continue
				}

				// 检查文件是否损坏
				try {
					await YAMLHandler.read(filePath)
				} catch (error) {
					corruptedFiles++
					issues.push({
						type: "corrupted_file",
						severity: "high",
						filePath: entry.file_path,
						message: `File exists but cannot be parsed: ${error}`,
					})
				}
			}
		}

		return {
			healthy: issues.length === 0,
			issues,
			summary: {
				totalFiles,
				corruptedFiles,
				orphanedIndexEntries,
				missingIndexEntries,
			},
		}
	}

	/**
	 * 🔥 智能记忆查询（高层API）
	 * 支持跨三种记忆类型的智能搜索，用于System Prompt注入
	 * 🚀 优先使用向量化搜索（如果启用），fallback到YAML扫描
	 * 🆕 支持总结模式（GSW增强功能1）
	 */
	async queryMemory(options: {
		query?: string // 自然语言查询
		types?: MemoryType[] // 限制记忆类型
		limit?: number // 最多返回多少条
		recentDays?: number // 只查询最近N天的记忆
		mode?: string // 限制特定模式
		relatedFiles?: string[] // 限制相关文件
		useVectorSearch?: boolean // 强制使用/不使用向量搜索（默认自动）
		useSummaries?: boolean // 使用会话总结模式（默认true）
	}): Promise<{
		memories: Array<{
			type: MemoryType
			id: string
			timestamp: string
			summary: string
			content: MemoryData
		}>
		totalFound: number
		summaries?: SessionSummary[] // 会话总结（如果启用）
	}> {
		// 🔥 优先返回会话总结（如果启用）
		if (options.useSummaries !== false) {
			try {
				const summaries = await this.querySessionSummaries(options)
				if (summaries.length > 0) {
					// 返回总结 + 少量完整记忆（fallback）
					const fullMemories = await this.queryMemoryWithYAML({
						...options,
						limit: Math.min(options.limit || 3, 3), // 最多3条完整记忆
					})

					return {
						memories: fullMemories.memories,
						totalFound: summaries.length + fullMemories.totalFound,
						summaries,
					}
				}
			} catch (error) {
				console.warn("[DirectoryMemorySystem] Summary query failed, falling back to full memories:", error)
			}
		}

		// 🚀 优先尝试向量化搜索（如果有query且向量存储可用）
		if (options.query && this.vectorStore && options.useVectorSearch !== false) {
			try {
				return await this.queryMemoryWithVector(options)
			} catch (error) {
				console.warn("[DirectoryMemorySystem] Vector search failed, falling back to YAML scan:", error)
				// Fallback到传统YAML扫描
			}
		}

		// Fallback: 传统YAML扫描查询
		return await this.queryMemoryWithYAML(options)
	}

	/**
	 * 🔥 查询会话总结（GSW增强功能1）
	 */
	private async querySessionSummaries(options: { recentDays?: number; limit?: number }): Promise<SessionSummary[]> {
		const summariesDir = path.join(this.rootPath, "summaries")

		// 检查目录是否存在
		if (!(await fileExistsAtPath(summariesDir))) {
			return []
		}

		// 读取所有总结文件
		const files = await fs.readdir(summariesDir)
		const summaryFiles = files.filter((f) => f.endsWith(".json"))

		const summaries: SessionSummary[] = []

		for (const file of summaryFiles) {
			try {
				const filePath = path.join(summariesDir, file)
				const content = await fs.readFile(filePath, "utf-8")
				const summary = JSON.parse(content) as SessionSummary

				// 时间过滤
				if (options.recentDays) {
					const cutoffDate = new Date()
					cutoffDate.setDate(cutoffDate.getDate() - options.recentDays)
					const summaryDate = new Date(summary.last_updated)

					if (summaryDate < cutoffDate) {
						continue
					}
				}

				summaries.push(summary)
			} catch (error) {
				console.warn(`[DirectoryMemorySystem] Failed to read summary file ${file}:`, error)
			}
		}

		// 按时间倒序排序
		summaries.sort((a, b) => b.last_updated.localeCompare(a.last_updated))

		// 返回限制数量
		return summaries.slice(0, options.limit || 5)
	}

	/**
	 * 🚀 向量化语义搜索（快速）
	 */
	private async queryMemoryWithVector(options: {
		query?: string
		types?: MemoryType[]
		limit?: number
		recentDays?: number
		mode?: string
		relatedFiles?: string[]
	}): Promise<{
		memories: Array<{
			type: MemoryType
			id: string
			timestamp: string
			summary: string
			content: MemoryData
		}>
		totalFound: number
	}> {
		if (!this.vectorStore || !options.query) {
			throw new Error("Vector store not available or no query provided")
		}

		const { query, types = ["interaction", "reasoning", "evolution"], limit = 5, recentDays, mode } = options

		// 计算时间范围
		let startTime: string | undefined
		if (recentDays) {
			const cutoffDate = new Date()
			cutoffDate.setDate(cutoffDate.getDate() - recentDays)
			startTime = cutoffDate.toISOString()
		}

		// 执行向量搜索
		const vectorResults = await this.vectorStore.searchMemories(query, {
			types,
			mode,
			startTime,
			maxResults: limit * 2, // 多取一些，后面再过滤
			minScore: 0.7,
		})

		// 加载完整记忆内容
		const memories: Array<{
			type: MemoryType
			id: string
			timestamp: string
			summary: string
			content: MemoryData
		}> = []

		for (const result of vectorResults.slice(0, limit)) {
			try {
				const filePath = path.resolve(result.filePath)
				if (await fileExistsAtPath(filePath)) {
					const content = await YAMLHandler.read<MemoryData>(filePath)
					memories.push({
						type: result.type,
						id: result.id,
						timestamp: result.timestamp,
						summary: result.summary,
						content,
					})
				}
			} catch (error) {
				console.warn(`[DirectoryMemorySystem] Failed to load memory ${result.id}:`, error)
			}
		}

		console.log(`[DirectoryMemorySystem] Vector search found ${memories.length} memories`)

		return {
			memories,
			totalFound: vectorResults.length,
		}
	}

	/**
	 * 📁 传统YAML扫描查询（Fallback）
	 */
	private async queryMemoryWithYAML(options: {
		query?: string
		types?: MemoryType[]
		limit?: number
		recentDays?: number
		mode?: string
		relatedFiles?: string[]
	}): Promise<{
		memories: Array<{
			type: MemoryType
			id: string
			timestamp: string
			summary: string
			content: MemoryData
		}>
		totalFound: number
	}> {
		const {
			query,
			types = ["interaction", "reasoning", "evolution"],
			limit = 5,
			recentDays,
			mode,
			relatedFiles,
		} = options

		const allMemories: Array<{
			type: MemoryType
			id: string
			timestamp: string
			summary: string
			content: MemoryData
		}> = []

		// 计算时间范围
		let startTime: string | undefined
		if (recentDays) {
			const cutoffDate = new Date()
			cutoffDate.setDate(cutoffDate.getDate() - recentDays)
			startTime = cutoffDate.toISOString()
		}

		// 提取查询关键词（简单分词）
		const queryKeywords = query
			? query
					.toLowerCase()
					.split(/[\s,，。！？、]+/)
					.filter((w) => w.length > 1)
			: undefined

		// 查询每种类型的记忆
		for (const type of types) {
			try {
				const filter: MemoryFilter = {
					startTime,
					keywords: queryKeywords,
					mode,
					relatedFiles,
					limit: limit * 2, // 先取2倍，后面再筛选排序
				}

				const memories = await this.readMemories(type, filter)

				for (const memory of memories) {
					const id = this.extractId(memory, type)
					const timestamp = memory.timestamp || (memory as any).start_time || new Date().toISOString()
					const summary = this.generateSummary(memory, type)

					allMemories.push({
						type,
						id,
						timestamp,
						summary,
						content: memory,
					})
				}
			} catch (error) {
				console.warn(`Failed to query ${type} memories:`, error)
				// 继续查询其他类型
			}
		}

		// 按时间倒序排序（最新的在前）
		allMemories.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

		// 如果有查询关键词，进行相关性评分
		if (queryKeywords && queryKeywords.length > 0) {
			// 🔥 增强版相关性评分
			const scored = allMemories.map((m) => {
				const contentText = JSON.stringify(m.content).toLowerCase()
				let score = 0

				// 基础分数：关键词匹配
				score += queryKeywords.filter((kw) => contentText.includes(kw)).length

				// 🔥 工作流知识加分：工作流知识记忆优先级更高
				const reasoning = m.content as any
				if (reasoning.memory_trigger === "workflow_knowledge") {
					score += 5 // 工作流知识大幅加分
				}
				if (reasoning.workflow_knowledge) {
					// 检查命令名匹配
					const toolName = reasoning.workflow_knowledge.tool_or_command?.toLowerCase() || ""
					if (queryKeywords.some((kw) => toolName.includes(kw) || kw.includes(toolName))) {
						score += 3 // 命令名匹配加分
					}
				}

				// 🔥 工具执行记录加分
				if (reasoning.tool_execution) {
					const toolName = reasoning.tool_execution.tool_name?.toLowerCase() || ""
					if (queryKeywords.some((kw) => toolName.includes(kw) || kw.includes(toolName))) {
						score += 2 // 工具名匹配加分
					}
				}

				// 时间衰减：更近的记忆稍微加分
				const ageHours = (Date.now() - new Date(m.timestamp).getTime()) / (1000 * 60 * 60)
				if (ageHours < 24) score += 1 // 24小时内的记忆加分

				return { memory: m, score }
			})

			// 按相关性排序
			scored.sort((a, b) => b.score - a.score)

			// 取评分最高的
			const topResults = scored.slice(0, limit).map((s) => s.memory)

			return {
				memories: topResults,
				totalFound: allMemories.length,
			}
		}

		// 没有查询词，直接返回最新的N条
		return {
			memories: allMemories.slice(0, limit),
			totalFound: allMemories.length,
		}
	}

	/**
	 * 🔥 保存会话总结（GSW增强功能1）
	 */
	async saveSessionSummary(summary: SessionSummary): Promise<void> {
		// 缓存到内存
		this.sessionSummaries.set(summary.session_id, summary)

		// 持久化到文件系统
		const summaryPath = path.join(this.rootPath, "summaries", `${summary.session_id}.json`)

		try {
			await safeWriteJson(summaryPath, summary)
		} catch (error) {
			console.error("[DirectoryMemorySystem] Failed to save session summary:", error)
			throw error
		}
	}

	/**
	 * 🔥 获取会话总结（GSW增强功能1）
	 */
	async getSessionSummary(sessionId: string): Promise<SessionSummary | null> {
		// 先查内存缓存
		const cached = this.sessionSummaries.get(sessionId)
		if (cached) {
			return cached
		}

		// 从文件系统读取
		const summaryPath = path.join(this.rootPath, "summaries", `${sessionId}.json`)

		try {
			if (await fileExistsAtPath(summaryPath)) {
				const content = await fs.readFile(summaryPath, "utf-8")
				const summary = JSON.parse(content) as SessionSummary

				// 缓存到内存
				this.sessionSummaries.set(sessionId, summary)

				return summary
			}
		} catch (error) {
			console.warn(`[DirectoryMemorySystem] Failed to read session summary ${sessionId}:`, error)
		}

		return null
	}

	/**
	 * 🔥 格式化记忆为System Prompt文本
	 * 将查询到的记忆转换为LLM可读的格式
	 */
	formatMemoriesForPrompt(
		memories: Array<{
			type: MemoryType
			id: string
			timestamp: string
			summary: string
			content: MemoryData
		}>,
	): string {
		if (memories.length === 0) {
			return ""
		}

		const sections: string[] = []

		// 按类型分组
		const byType: Record<MemoryType, typeof memories> = {
			interaction: [],
			reasoning: [],
			evolution: [],
		}

		for (const m of memories) {
			byType[m.type].push(m)
		}

		// 用户交互记忆
		if (byType.interaction.length > 0) {
			sections.push("### 📝 Recent User Interactions & Goals")
			for (const m of byType.interaction.slice(0, 3)) {
				const interaction = m.content as InteractionMemory
				const latestGoal = interaction.user_goals[interaction.user_goals.length - 1]
				sections.push(`- ${this.formatTimestamp(m.timestamp)}: ${latestGoal.goal}`)
				if (latestGoal.mandatory_instructions && latestGoal.mandatory_instructions.length > 0) {
					sections.push(`  **Mandatory:** ${latestGoal.mandatory_instructions.join("; ")}`)
				}
			}
			sections.push("")
		}

		// 推理记忆
		if (byType.reasoning.length > 0) {
			sections.push("### 🧠 Previous Reasoning & Decisions")
			for (const m of byType.reasoning.slice(0, 2)) {
				const reasoning = m.content as ReasoningMemory
				sections.push(`- ${this.formatTimestamp(m.timestamp)}: ${reasoning.reasoning.substring(0, 150)}...`)
				if (reasoning.decision_points && reasoning.decision_points.length > 0) {
					sections.push(`  **Key Decisions:** ${reasoning.decision_points.join("; ")}`)
				}
			}
			sections.push("")
		}

		// 代码演进记忆
		if (byType.evolution.length > 0) {
			sections.push("### 🔄 Recent Code Evolution")
			for (const m of byType.evolution.slice(0, 2)) {
				const evolution = m.content as EvolutionMemory
				sections.push(`- ${this.formatTimestamp(m.timestamp)}: ${evolution.file_path}`)
				sections.push(`  ${evolution.diff_summary}`)
				if (evolution.benefits && evolution.benefits.length > 0) {
					sections.push(`  **Benefits:** ${evolution.benefits.join(", ")}`)
				}
			}
			sections.push("")
		}

		return sections.join("\n")
	}

	/**
	 * 格式化时间戳为可读格式
	 */
	private formatTimestamp(timestamp: string): string {
		const date = new Date(timestamp)
		const now = new Date()
		const diffMs = now.getTime() - date.getTime()
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

		if (diffDays === 0) {
			return "Today"
		} else if (diffDays === 1) {
			return "Yesterday"
		} else if (diffDays < 7) {
			return `${diffDays} days ago`
		} else {
			return date.toLocaleDateString()
		}
	}

	/**
	 * 执行归档操作
	 */
	async performArchive() {
		return await this.fileRotator.archive()
	}

	/**
	 * 清理归档文件
	 */
	async cleanArchive() {
		return await this.fileRotator.cleanArchive()
	}

	/**
	 * 初始化配置文件
	 */
	private async initializeConfig(): Promise<void> {
		const configPath = path.join(this.rootPath, "system", "config.yaml")

		if (!(await fileExistsAtPath(configPath))) {
			await YAMLHandler.write(configPath, {
				version: "1.0",
				created_at: new Date().toISOString(),
				config: this.config,
			})
		}
	}

	/**
	 * 初始化索引文件
	 */
	private async initializeIndices(): Promise<void> {
		const types: MemoryType[] = ["interaction", "reasoning", "evolution"]

		for (const type of types) {
			const indexPath = this.pathGenerator.getIndexPath(type)

			if (!(await fileExistsAtPath(indexPath))) {
				const emptyIndex: MemoryIndex = {
					version: "1.0",
					type,
					last_updated: new Date().toISOString(),
					entries: [],
					metadata: {
						total_entries: 0,
						total_size_kb: 0,
						oldest_entry: null,
						index_size_kb: 0,
					},
				}

				// 使用safeWriteJson确保原子写入
				await safeWriteJson(indexPath, emptyIndex)
			}
		}
	}

	/**
	 * 初始化统计数据
	 */
	private async initializeStats(): Promise<void> {
		const statsPath = path.join(this.rootPath, "system", "stats.json")

		if (!(await fileExistsAtPath(statsPath))) {
			const initialStats = {
				version: "1.0",
				created_at: new Date().toISOString(),
				last_updated: new Date().toISOString(),
				total_memories: 0,
				total_size_kb: 0,
			}

			await safeWriteJson(statsPath, initialStats)
		}
	}

	/**
	 * 从数据中提取ID
	 */
	private extractId(data: MemoryData, type: MemoryType): string {
		if ("session_id" in data) {
			return data.session_id
		} else if ("entry_id" in data) {
			return data.entry_id
		} else if ("evolution_id" in data) {
			return data.evolution_id
		}
		return `${type}_${Date.now()}`
	}

	/**
	 * 生成文件路径
	 */
	private generateFilePath(type: MemoryType, id: string, data: MemoryData): string {
		switch (type) {
			case "interaction":
				return this.pathGenerator.generateInteractionPath(id)
			case "reasoning":
				return this.pathGenerator.generateReasoningPath(id)
			case "evolution": {
				const filePath = "file_path" in data ? (data.file_path as string) : "unknown"
				return this.pathGenerator.generateEvolutionPath(filePath, id)
			}
			default:
				throw new Error(`Unknown memory type: ${type}`)
		}
	}

	/**
	 * 生成摘要
	 */
	private generateSummary(data: MemoryData, type: MemoryType): string {
		if (type === "interaction" && "user_goals" in data) {
			return data.user_goals
				.map((g) => g.goal)
				.join(", ")
				.substring(0, 200)
		} else if (type === "reasoning" && "reasoning" in data) {
			return data.reasoning.substring(0, 200)
		} else if (type === "evolution" && "diff_summary" in data) {
			return data.diff_summary.substring(0, 200)
		}
		return "无摘要"
	}

	/**
	 * 提取关键词
	 */
	private extractKeywords(data: MemoryData): string[] {
		const text = JSON.stringify(data).toLowerCase()
		const keywords = new Set<string>()

		const commonKeywords = [
			"优化",
			"重构",
			"修复",
			"bug",
			"性能",
			"安全",
			"jwt",
			"redis",
			"认证",
			"缓存",
			"数据库",
			"api",
		]

		for (const keyword of commonKeywords) {
			if (text.includes(keyword)) {
				keywords.add(keyword)
			}
		}

		return Array.from(keywords)
	}

	/**
	 * 提取模式
	 */
	private extractMode(data: MemoryData): string | undefined {
		if ("mode" in data) {
			return data.mode as string
		}
		return undefined
	}

	/**
	 * 提取相关文件
	 */
	private extractRelatedFiles(data: MemoryData): string[] | undefined {
		if ("related_files" in data) {
			return data.related_files as string[]
		}
		if ("file_path" in data) {
			return [data.file_path as string]
		}
		return undefined
	}
}
