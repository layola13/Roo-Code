/**
 * GSW三元记忆系统 - 通用类型定义
 */

/**
 * 记忆类型枚举
 */
export type MemoryType = "interaction" | "reasoning" | "evolution"

/**
 * 记忆数据的基础接口
 */
export interface BaseMemory {
	version: string
	timestamp?: string
}

/**
 * 记忆过滤器
 */
export interface MemoryFilter {
	startTime?: string
	endTime?: string
	keywords?: string[]
	mode?: string
	relatedFiles?: string[]
	limit?: number
	offset?: number
}

/**
 * 记忆统计信息
 */
export interface MemoryStats {
	totalEntries: number
	totalSizeKB: number
	oldestEntry: string | null
	newestEntry: string | null
	byType: {
		interaction: number
		reasoning: number
		evolution: number
	}
}

/**
 * 健康检查报告
 */
export interface HealthReport {
	healthy: boolean
	issues: HealthIssue[]
	summary: {
		totalFiles: number
		corruptedFiles: number
		orphanedIndexEntries: number
		missingIndexEntries: number
	}
}

/**
 * 健康问题
 */
export interface HealthIssue {
	type: "corrupted_file" | "orphaned_index" | "missing_index" | "invalid_schema"
	severity: "low" | "medium" | "high"
	filePath: string
	message: string
}
