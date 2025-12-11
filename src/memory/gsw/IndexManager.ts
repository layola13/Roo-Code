/**
 * GSW三元记忆系统 - 索引管理器
 * 提供高效的索引创建、更新和查询功能
 */

import * as fs from "fs/promises"
import * as path from "path"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { fileExistsAtPath } from "../../utils/fs"
import { MemoryIndex, IndexEntry, IndexQueryFilter, IndexMetadata } from "./types/index"
import { MemoryType } from "./types/common"
import { YAMLHandler } from "./utils/YAMLHandler"

export class IndexManager {
	private readonly indexPath: string
	private readonly type: MemoryType
	private cache: MemoryIndex | null = null
	private cacheTimestamp = 0
	private readonly cacheTTL = 5000 // 5秒缓存

	constructor(indexPath: string, type: MemoryType) {
		this.indexPath = indexPath
		this.type = type
	}

	/**
	 * 加载索引（带缓存）
	 */
	async load(): Promise<MemoryIndex> {
		const now = Date.now()

		// 检查缓存是否有效
		if (this.cache && now - this.cacheTimestamp < this.cacheTTL) {
			return this.cache
		}

		if (!(await fileExistsAtPath(this.indexPath))) {
			throw new Error(`Index file not found: ${this.indexPath}`)
		}

		const content = await fs.readFile(this.indexPath, "utf-8")
		const index = JSON.parse(content) as MemoryIndex

		// 更新缓存
		this.cache = index
		this.cacheTimestamp = now

		return index
	}

	/**
	 * 添加索引条目
	 */
	async addEntry(entry: IndexEntry): Promise<void> {
		const index = await this.load()

		// 检查是否已存在
		const existingIndex = index.entries.findIndex((e) => e.id === entry.id)
		if (existingIndex !== -1) {
			// 更新现有条目
			index.entries[existingIndex] = entry
		} else {
			// 添加新条目
			index.entries.push(entry)
		}

		// 更新元数据
		index.last_updated = new Date().toISOString()
		index.metadata.total_entries = index.entries.length
		index.metadata.total_size_kb += entry.size_kb || 0

		if (!index.metadata.oldest_entry || entry.timestamp < index.metadata.oldest_entry) {
			index.metadata.oldest_entry = entry.timestamp
		}

		// 原子写入
		await this.save(index)
	}

	/**
	 * 批量添加索引条目（优化性能）
	 */
	async addEntries(entries: IndexEntry[]): Promise<void> {
		const index = await this.load()

		for (const entry of entries) {
			const existingIndex = index.entries.findIndex((e) => e.id === entry.id)
			if (existingIndex !== -1) {
				index.entries[existingIndex] = entry
			} else {
				index.entries.push(entry)
				index.metadata.total_size_kb += entry.size_kb || 0
			}
		}

		index.last_updated = new Date().toISOString()
		index.metadata.total_entries = index.entries.length

		await this.save(index)
	}

	/**
	 * 删除索引条目
	 */
	async removeEntry(id: string): Promise<void> {
		const index = await this.load()

		const entryIndex = index.entries.findIndex((e) => e.id === id)
		if (entryIndex === -1) {
			return // 条目不存在，直接返回
		}

		const entry = index.entries[entryIndex]
		index.entries.splice(entryIndex, 1)

		// 更新元数据
		index.last_updated = new Date().toISOString()
		index.metadata.total_entries = index.entries.length
		index.metadata.total_size_kb -= entry.size_kb || 0

		await this.save(index)
	}

	/**
	 * 查询索引条目
	 */
	async query(filter: IndexQueryFilter): Promise<IndexEntry[]> {
		const index = await this.load()
		let results = index.entries

		// 按时间范围过滤
		if (filter.startTime) {
			results = results.filter((e) => e.timestamp >= filter.startTime!)
		}
		if (filter.endTime) {
			results = results.filter((e) => e.timestamp <= filter.endTime!)
		}

		// 按关键词过滤
		if (filter.keywords && filter.keywords.length > 0) {
			results = results.filter((e) => e.keywords?.some((k) => filter.keywords!.includes(k)))
		}

		// 按模式过滤
		if (filter.mode) {
			results = results.filter((e) => e.mode === filter.mode)
		}

		// 按文件路径过滤
		if (filter.relatedFiles && filter.relatedFiles.length > 0) {
			results = results.filter((e) => e.related_files?.some((f) => filter.relatedFiles!.includes(f)))
		}

		// 排序
		if (filter.sortBy === "timestamp") {
			results.sort((a, b) => {
				const order = filter.sortOrder === "desc" ? -1 : 1
				return order * a.timestamp.localeCompare(b.timestamp)
			})
		}

		// 分页
		if (filter.limit) {
			const offset = filter.offset || 0
			results = results.slice(offset, offset + filter.limit)
		}

		return results
	}

	/**
	 * 获取统计信息
	 */
	async getStats(): Promise<IndexMetadata> {
		const index = await this.load()
		return index.metadata
	}

	/**
	 * 压缩索引（删除过期条目）
	 */
	async compact(retentionDays: number): Promise<number> {
		const index = await this.load()
		const cutoffDate = new Date()
		cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
		const cutoffISO = cutoffDate.toISOString()

		const originalCount = index.entries.length
		index.entries = index.entries.filter((e) => e.timestamp >= cutoffISO)
		const removedCount = originalCount - index.entries.length

		if (removedCount > 0) {
			// 重新计算元数据
			index.metadata.total_entries = index.entries.length
			index.metadata.total_size_kb = index.entries.reduce((sum, e) => sum + (e.size_kb || 0), 0)

			if (index.entries.length > 0) {
				index.metadata.oldest_entry = index.entries.map((e) => e.timestamp).sort()[0]
			} else {
				index.metadata.oldest_entry = null
			}

			await this.save(index)
		}

		return removedCount
	}

	/**
	 * 重建索引（从文件系统扫描）
	 */
	async rebuild(memoryDirectory: string): Promise<void> {
		const entries: IndexEntry[] = []

		// 扫描目录中的所有YAML文件
		const files = await this.scanDirectory(memoryDirectory)

		for (const filePath of files) {
			try {
				// 读取文件内容
				const content = await YAMLHandler.read<Record<string, unknown>>(filePath)

				// 提取索引信息
				const entry: IndexEntry = {
					id:
						(content.session_id as string) ||
						(content.entry_id as string) ||
						(content.evolution_id as string),
					file_path: path.relative(process.cwd(), filePath),
					timestamp: (content.timestamp as string) || (content.start_time as string),
					summary: this.generateSummary(content),
					keywords: this.extractKeywords(content),
					mode: content.mode as string,
					related_files: (content.related_files as string[]) || [],
					size_kb: Math.ceil((await fs.stat(filePath)).size / 1024),
				}

				entries.push(entry)
			} catch (error) {
				console.error(`Failed to process ${filePath}:`, error)
			}
		}

		// 创建新索引
		const newIndex: MemoryIndex = {
			version: "1.0",
			type: this.type,
			last_updated: new Date().toISOString(),
			entries,
			metadata: {
				total_entries: entries.length,
				total_size_kb: entries.reduce((sum, e) => sum + (e.size_kb || 0), 0),
				oldest_entry: entries.length > 0 ? entries.map((e) => e.timestamp).sort()[0] : null,
				index_size_kb: 0, // 将在save中计算
			},
		}

		await this.save(newIndex)
	}

	/**
	 * 清除缓存
	 */
	clearCache(): void {
		this.cache = null
		this.cacheTimestamp = 0
	}

	/**
	 * 保存索引（使用safeWriteJson）
	 */
	private async save(index: MemoryIndex): Promise<void> {
		// 计算索引文件大小
		const content = JSON.stringify(index)
		index.metadata.index_size_kb = Math.ceil(content.length / 1024)

		// 使用safeWriteJson确保原子写入
		await safeWriteJson(this.indexPath, index)

		// 更新缓存
		this.cache = index
		this.cacheTimestamp = Date.now()
	}

	/**
	 * 扫描目录中的所有YAML文件
	 */
	private async scanDirectory(dir: string): Promise<string[]> {
		const files: string[] = []

		try {
			const entries = await fs.readdir(dir, { withFileTypes: true })

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name)

				if (entry.isDirectory()) {
					files.push(...(await this.scanDirectory(fullPath)))
				} else if (entry.isFile() && entry.name.endsWith(".yaml")) {
					files.push(fullPath)
				}
			}
		} catch (error) {
			console.error(`Failed to scan directory ${dir}:`, error)
		}

		return files
	}

	/**
	 * 生成摘要
	 */
	private generateSummary(content: Record<string, unknown>): string {
		// 根据不同类型生成摘要
		if (content.user_goals) {
			const goals = content.user_goals as Array<{ goal: string }>
			return goals
				.map((g) => g.goal)
				.join(", ")
				.substring(0, 200)
		} else if (content.reasoning) {
			return (content.reasoning as string).substring(0, 200)
		} else if (content.diff_summary) {
			return (content.diff_summary as string).substring(0, 200)
		}
		return "无摘要"
	}

	/**
	 * 提取关键词
	 */
	private extractKeywords(content: Record<string, unknown>): string[] {
		const keywords = new Set<string>()
		const text = JSON.stringify(content).toLowerCase()

		// 简单的关键词提取
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
}
