/**
 * GSW三元记忆系统 - 文件归档与清理模块
 * 提供自动归档和垃圾回收机制
 */

import * as fs from "fs/promises"
import * as path from "path"
import { fileExistsAtPath } from "../../utils/fs"
import { MemoryType } from "./types/common"
import { RotatorConfig, ArchiveResult, CleanResult } from "./types/config"

export class FileRotator {
	private readonly rootPath: string
	private readonly config: RotatorConfig

	constructor(rootPath: string, config: RotatorConfig) {
		this.rootPath = rootPath
		this.config = config
	}

	/**
	 * 执行归档操作
	 * @returns 归档的文件数量
	 */
	async archive(): Promise<ArchiveResult> {
		const result: ArchiveResult = {
			archivedFiles: 0,
			freedSpaceKB: 0,
			errors: [],
		}

		const types: MemoryType[] = ["interaction", "reasoning", "evolution"]

		for (const type of types) {
			try {
				const typeResult = await this.archiveType(type)
				result.archivedFiles += typeResult.archivedFiles
				result.freedSpaceKB += typeResult.freedSpaceKB
			} catch (error) {
				result.errors.push(`Failed to archive ${type}: ${error}`)
			}
		}

		return result
	}

	/**
	 * 归档特定类型的记忆文件
	 */
	private async archiveType(type: MemoryType): Promise<ArchiveResult> {
		const typeMap = {
			interaction: "interaction_memory/sessions",
			reasoning: "reasoning_memory/decisions",
			evolution: "evolution_memory/files",
		}

		const sourcePath = path.join(this.rootPath, typeMap[type])
		const archivePath = path.join(this.rootPath, `${type}_memory`, "archive")

		const cutoffDate = new Date()
		cutoffDate.setDate(cutoffDate.getDate() - this.config.archiveAfterDays)

		let archivedFiles = 0
		let freedSpaceKB = 0

		// 递归扫描文件
		const files = await this.scanFiles(sourcePath)

		for (const filePath of files) {
			const stats = await fs.stat(filePath)

			// 检查文件最后访问时间
			if (stats.atime < cutoffDate) {
				const fileName = path.basename(filePath)
				const archiveFilePath = path.join(archivePath, fileName)

				// 移动到归档目录
				await fs.rename(filePath, archiveFilePath)

				archivedFiles++
				freedSpaceKB += Math.ceil(stats.size / 1024)
			}
		}

		return {
			archivedFiles,
			freedSpaceKB,
			errors: [],
		}
	}

	/**
	 * 清理归档文件（删除过期归档）
	 */
	async cleanArchive(): Promise<CleanResult> {
		const result: CleanResult = {
			deletedFiles: 0,
			freedSpaceKB: 0,
			errors: [],
		}

		const types: MemoryType[] = ["interaction", "reasoning", "evolution"]
		const cutoffDate = new Date()
		cutoffDate.setDate(cutoffDate.getDate() - this.config.deleteAfterDays)

		for (const type of types) {
			const archivePath = path.join(this.rootPath, `${type}_memory`, "archive")

			if (!(await fileExistsAtPath(archivePath))) {
				continue
			}

			const files = await this.scanFiles(archivePath)

			for (const filePath of files) {
				const stats = await fs.stat(filePath)

				if (stats.mtime < cutoffDate) {
					const sizeKB = Math.ceil(stats.size / 1024)
					await fs.unlink(filePath)

					result.deletedFiles++
					result.freedSpaceKB += sizeKB
				}
			}
		}

		return result
	}

	/**
	 * 获取归档统计信息
	 */
	async getArchiveStats(): Promise<{
		totalArchiveFiles: number
		totalArchiveSizeKB: number
		oldestArchiveDate: string | null
	}> {
		let totalFiles = 0
		let totalSizeKB = 0
		let oldestDate: Date | null = null

		const types: MemoryType[] = ["interaction", "reasoning", "evolution"]

		for (const type of types) {
			const archivePath = path.join(this.rootPath, `${type}_memory`, "archive")

			if (!(await fileExistsAtPath(archivePath))) {
				continue
			}

			const files = await this.scanFiles(archivePath)

			for (const filePath of files) {
				const stats = await fs.stat(filePath)
				totalFiles++
				totalSizeKB += Math.ceil(stats.size / 1024)

				if (!oldestDate || stats.mtime < oldestDate) {
					oldestDate = stats.mtime
				}
			}
		}

		return {
			totalArchiveFiles: totalFiles,
			totalArchiveSizeKB: totalSizeKB,
			oldestArchiveDate: oldestDate ? oldestDate.toISOString() : null,
		}
	}

	/**
	 * 递归扫描目录中的所有文件
	 */
	private async scanFiles(dir: string): Promise<string[]> {
		const files: string[] = []

		try {
			const entries = await fs.readdir(dir, { withFileTypes: true })

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name)

				if (entry.isDirectory()) {
					files.push(...(await this.scanFiles(fullPath)))
				} else if (entry.isFile()) {
					files.push(fullPath)
				}
			}
		} catch (error) {
			console.error(`Failed to scan directory ${dir}:`, error)
		}

		return files
	}
}
