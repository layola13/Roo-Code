/**
 * GSW三元记忆系统 - 配置类型定义
 */

/**
 * 记忆系统配置
 */
export interface MemorySystemConfig {
	rootPath: string
	maxFileSizeKB: number
	archiveAfterDays: number
	enableAutoRotation: boolean
	compressionEnabled: boolean
	yamlLibrary: "js-yaml" | "fast-yaml"
	lockTimeout: number
	retryAttempts: number
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: MemorySystemConfig = {
	rootPath: "./project",
	maxFileSizeKB: 50,
	archiveAfterDays: 30,
	enableAutoRotation: true,
	compressionEnabled: false,
	yamlLibrary: "js-yaml",
	lockTimeout: 5000,
	retryAttempts: 3,
}

/**
 * 文件归档配置
 */
export interface RotatorConfig {
	archiveAfterDays: number
	deleteAfterDays: number
	maxArchiveSizeMB: number
}

/**
 * 归档结果
 */
export interface ArchiveResult {
	archivedFiles: number
	freedSpaceKB: number
	errors: string[]
}

/**
 * 清理结果
 */
export interface CleanResult {
	deletedFiles: number
	freedSpaceKB: number
	errors: string[]
}
