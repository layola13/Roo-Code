/**
 * GSW三元记忆系统 - Index类型定义
 * 用于索引管理和快速查询
 */

import { MemoryType } from "./common"

/**
 * 索引条目
 */
export interface IndexEntry {
	id: string
	file_path: string
	timestamp: string
	summary: string
	keywords?: string[]
	mode?: string
	related_files?: string[]
	size_kb?: number
	context_switches?: number
}

/**
 * 索引元数据
 */
export interface IndexMetadata {
	total_entries: number
	total_size_kb: number
	oldest_entry: string | null
	index_size_kb: number
}

/**
 * 记忆索引
 */
export interface MemoryIndex {
	version: string
	type: MemoryType
	last_updated: string
	entries: IndexEntry[]
	metadata: IndexMetadata
}

/**
 * 索引查询过滤器
 */
export interface IndexQueryFilter {
	startTime?: string
	endTime?: string
	keywords?: string[]
	mode?: string
	relatedFiles?: string[]
	sortBy?: "timestamp" | "size"
	sortOrder?: "asc" | "desc"
	limit?: number
	offset?: number
}
