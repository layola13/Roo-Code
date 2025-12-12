/**
 * 文件操作追踪器
 * 实时记录所有文件编辑操作，用于Judge系统验证
 */

import * as fs from "fs/promises"
import * as crypto from "crypto"

/**
 * 文件操作记录
 */
export interface FileOperation {
	/** 操作时间戳 */
	timestamp: number
	/** 文件路径 */
	filePath: string
	/** 使用的工具 */
	toolUsed: string
	/** 操作类型 */
	operationType: "create" | "modify" | "delete" | "read"
	/** 是否成功 */
	success: boolean
	/** 修改的行数 */
	linesChanged?: number
	/** 内容哈希（用于验证实际修改） */
	contentHash?: string
	/** 原始内容哈希（修改前） */
	originalContentHash?: string
	/** 错误信息（如果失败） */
	error?: string
}

/**
 * 文件状态验证结果
 */
export interface FileVerificationResult {
	filePath: string
	claimed: boolean // 是否声称被修改
	verified: boolean // 是否经过验证确实被修改
	exists: boolean // 文件是否存在
	hashMatch: boolean // 哈希是否匹配
	reason?: string // 验证结果原因
}

/**
 * 文件操作追踪器
 * 实时记录所有文件编辑操作，提供验证功能
 */
export class FileOperationTracker {
	private operations: FileOperation[] = []
	private fileHashes: Map<string, string> = new Map() // 存储文件初始哈希
	private maxOperations: number = 100 // 最多保留的操作记录数

	/**
	 * 记录文件操作
	 */
	recordOperation(op: FileOperation): void {
		this.operations.push(op)

		// 更新文件哈希
		if (op.contentHash) {
			this.fileHashes.set(op.filePath, op.contentHash)
		}

		// 限制记录数量
		if (this.operations.length > this.maxOperations) {
			this.operations = this.operations.slice(-this.maxOperations)
		}

		console.log(`[FileOperationTracker] Recorded: ${op.toolUsed} ${op.operationType} ${op.filePath}`)
	}

	/**
	 * 记录文件初始状态（用于后续验证）
	 */
	async captureInitialState(filePath: string): Promise<string | null> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			const hash = this.computeHash(content)
			this.fileHashes.set(filePath, hash)
			return hash
		} catch {
			// 文件不存在是正常情况（新建文件）
			return null
		}
	}

	/**
	 * 获取所有操作记录
	 */
	getOperations(): FileOperation[] {
		return [...this.operations]
	}

	/**
	 * 获取成功修改的文件列表
	 */
	getModifiedFiles(): string[] {
		const files = new Set<string>()
		for (const op of this.operations) {
			if (op.success && (op.operationType === "create" || op.operationType === "modify")) {
				files.add(op.filePath)
			}
		}
		return Array.from(files)
	}

	/**
	 * 获取成功读取的文件列表
	 */
	getReadFiles(): string[] {
		const files = new Set<string>()
		for (const op of this.operations) {
			if (op.success && op.operationType === "read") {
				files.add(op.filePath)
			}
		}
		return Array.from(files)
	}

	/**
	 * 获取按文件分组的操作统计
	 */
	getOperationsByFile(): Map<string, FileOperation[]> {
		const byFile = new Map<string, FileOperation[]>()
		for (const op of this.operations) {
			if (!byFile.has(op.filePath)) {
				byFile.set(op.filePath, [])
			}
			byFile.get(op.filePath)!.push(op)
		}
		return byFile
	}

	/**
	 * 验证文件是否实际被修改
	 * 通过比较当前文件内容与记录的哈希来验证
	 */
	async verifyFileActuallyModified(filePath: string): Promise<FileVerificationResult> {
		const operations = this.operations.filter((op) => op.filePath === filePath && op.success)

		if (operations.length === 0) {
			return {
				filePath,
				claimed: false,
				verified: false,
				exists: false,
				hashMatch: false,
				reason: "No successful operations recorded for this file",
			}
		}

		try {
			// 检查文件是否存在
			await fs.access(filePath)

			// 读取当前内容并计算哈希
			const currentContent = await fs.readFile(filePath, "utf-8")
			const currentHash = this.computeHash(currentContent)

			// 获取记录的最后一次哈希
			const lastOp = operations[operations.length - 1]
			const recordedHash = lastOp.contentHash || this.fileHashes.get(filePath)

			if (!recordedHash) {
				// 没有记录哈希，只能确认文件存在
				return {
					filePath,
					claimed: true,
					verified: true, // 假设存在即被修改
					exists: true,
					hashMatch: true,
					reason: "File exists, but no hash recorded for comparison",
				}
			}

			const hashMatch = currentHash === recordedHash

			return {
				filePath,
				claimed: true,
				verified: hashMatch,
				exists: true,
				hashMatch,
				reason: hashMatch ? "Content hash matches recorded value" : "Content hash differs from recorded value",
			}
		} catch (error) {
			// 文件不存在 - 可能是创建后被删除，或者创建失败
			return {
				filePath,
				claimed: true,
				verified: false,
				exists: false,
				hashMatch: false,
				reason: `File does not exist: ${error instanceof Error ? error.message : String(error)}`,
			}
		}
	}

	/**
	 * 批量验证所有声称修改的文件
	 */
	async verifyAllModifiedFiles(): Promise<FileVerificationResult[]> {
		const modifiedFiles = this.getModifiedFiles()
		const results: FileVerificationResult[] = []

		for (const filePath of modifiedFiles) {
			const result = await this.verifyFileActuallyModified(filePath)
			results.push(result)
		}

		return results
	}

	/**
	 * 获取验证成功的文件列表
	 */
	async getVerifiedFiles(): Promise<string[]> {
		const results = await this.verifyAllModifiedFiles()
		return results.filter((r) => r.verified).map((r) => r.filePath)
	}

	/**
	 * 获取验证失败的文件列表
	 */
	async getUnverifiedFiles(): Promise<string[]> {
		const results = await this.verifyAllModifiedFiles()
		return results.filter((r) => r.claimed && !r.verified).map((r) => r.filePath)
	}

	/**
	 * 清空所有记录
	 */
	clear(): void {
		this.operations = []
		this.fileHashes.clear()
		console.log("[FileOperationTracker] Cleared all records")
	}

	/**
	 * 计算内容哈希
	 */
	private computeHash(content: string): string {
		return crypto.createHash("md5").update(content).digest("hex")
	}

	/**
	 * 计算文件内容哈希（静态方法，供外部使用）
	 */
	static computeContentHash(content: string): string {
		return crypto.createHash("md5").update(content).digest("hex")
	}

	/**
	 * 获取操作统计摘要
	 */
	getSummary(): {
		totalOperations: number
		successfulOperations: number
		failedOperations: number
		uniqueFiles: number
		byTool: Record<string, number>
		byType: Record<string, number>
	} {
		const byTool: Record<string, number> = {}
		const byType: Record<string, number> = {}
		let successful = 0
		let failed = 0
		const files = new Set<string>()

		for (const op of this.operations) {
			byTool[op.toolUsed] = (byTool[op.toolUsed] || 0) + 1
			byType[op.operationType] = (byType[op.operationType] || 0) + 1
			files.add(op.filePath)

			if (op.success) {
				successful++
			} else {
				failed++
			}
		}

		return {
			totalOperations: this.operations.length,
			successfulOperations: successful,
			failedOperations: failed,
			uniqueFiles: files.size,
			byTool,
			byType,
		}
	}

	/**
	 * 格式化操作记录为可读字符串（用于Judge提示词）
	 */
	formatForJudge(): string {
		if (this.operations.length === 0) {
			return "无文件操作记录"
		}

		const lines: string[] = []
		lines.push(`## 文件操作追踪记录 (共 ${this.operations.length} 次操作)\n`)

		const byFile = this.getOperationsByFile()

		for (const [filePath, ops] of byFile) {
			const successCount = ops.filter((o) => o.success).length
			const failCount = ops.length - successCount
			const status = failCount === 0 ? "✅" : "⚠️"

			lines.push(`### ${status} ${filePath}`)
			lines.push(`- 操作次数: ${ops.length} (成功: ${successCount}, 失败: ${failCount})`)

			// 只显示最后3次操作的详情
			const recentOps = ops.slice(-3)
			for (const op of recentOps) {
				const time = new Date(op.timestamp).toISOString()
				const statusIcon = op.success ? "✓" : "✗"
				lines.push(`  - [${statusIcon}] ${time} ${op.toolUsed} (${op.operationType})`)
				if (op.linesChanged) {
					lines.push(`    变更行数: ${op.linesChanged}`)
				}
				if (!op.success && op.error) {
					lines.push(`    错误: ${op.error}`)
				}
			}
			lines.push("")
		}

		return lines.join("\n")
	}
}
