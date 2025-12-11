/**
 * GSW三元记忆系统 - 文件路径生成器
 * 提供智能的文件路径生成和管理
 */

import * as path from "path"
import { MemoryType } from "../types/common"

export class PathGenerator {
	private readonly rootPath: string

	constructor(rootPath: string) {
		this.rootPath = rootPath
	}

	/**
	 * 生成会话记忆文件路径
	 * @param sessionId 会话ID
	 * @returns 完整文件路径
	 */
	generateInteractionPath(sessionId: string): string {
		const timestamp = this.formatTimestamp(new Date())
		const fileName = `${timestamp}_${sessionId}.yaml`
		return path.join(this.rootPath, "interaction", fileName)
	}

	/**
	 * 生成推理记忆文件路径
	 * @param reasonId 推理ID
	 * @returns 完整文件路径
	 */
	generateReasoningPath(reasonId: string): string {
		const timestamp = this.formatTimestamp(new Date())
		const fileName = `${timestamp}_${reasonId}.yaml`
		return path.join(this.rootPath, "reasoning", fileName)
	}

	/**
	 * 生成代码演进记忆文件路径（按文件路径分组）
	 * @param filePath 源代码文件路径
	 * @param evolId 演进ID
	 * @returns 完整文件路径
	 */
	generateEvolutionPath(filePath: string, evolId: string): string {
		const timestamp = this.formatTimestamp(new Date())
		// 将文件路径转换为安全的目录名
		const safePath = this.sanitizeFilePath(filePath)
		const fileName = `${timestamp}_${evolId}.yaml`
		return path.join(this.rootPath, "evolution", safePath, fileName)
	}

	/**
	 * 获取索引文件路径
	 * @param type 记忆类型
	 * @returns 索引文件路径
	 */
	getIndexPath(type: MemoryType): string {
		return path.join(this.rootPath, type, "index.json")
	}

	/**
	 * 获取归档目录路径
	 * @param type 记忆类型
	 * @returns 归档目录路径
	 */
	getArchivePath(type: MemoryType): string {
		return path.join(this.rootPath, type, "archive")
	}

	/**
	 * 获取记忆类型的主目录路径
	 * @param type 记忆类型
	 * @returns 主目录路径
	 */
	getMemoryTypePath(type: MemoryType): string {
		return path.join(this.rootPath, type)
	}

	/**
	 * 格式化时间戳为文件名友好格式
	 * @param date 日期对象
	 * @returns 格式化字符串 (YYYY-MM-DD_HH-MM-SS)
	 */
	private formatTimestamp(date: Date): string {
		return date.toISOString().replace(/T/, "_").replace(/:/g, "-").replace(/\..+/, "")
	}

	/**
	 * 将文件路径转换为安全的目录名
	 * @param filePath 原始文件路径
	 * @returns 安全的目录名
	 */
	private sanitizeFilePath(filePath: string): string {
		return filePath
			.replace(/^\//, "") // 移除开头的斜杠
			.replace(/\\/g, "/") // 统一为正斜杠
			.replace(/\.\./g, "__") // 替换..
			.replace(/:/g, "_") // 替换冒号（Windows）
	}
}
