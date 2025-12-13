/**
 * NextEditMemoryManager - GSW记忆系统集成层
 * 负责编辑链和模式的持久化存储与检索
 */

import { DirectoryMemorySystem } from "../../memory/gsw/DirectoryMemorySystem"
import { EditChain, EditPattern, NextEditMemory, ParallelSessionMemory } from "../../memory/gsw/types/next-edit"
import { PatternMatchResult } from "./types"

/**
 * NextEditMemoryManager
 * 管理编辑链和模式的GSW存储
 */
export class NextEditMemoryManager {
	private gswSystem: DirectoryMemorySystem
	private patternCache: Map<string, EditPattern> = new Map()

	constructor(gswSystem: DirectoryMemorySystem) {
		this.gswSystem = gswSystem
	}

	/**
	 * 保存编辑链到GSW记忆系统
	 */
	async saveEditChain(chain: EditChain): Promise<void> {
		// 计算成功统计
		const totalSteps = chain.steps.length
		const acceptedSteps = chain.steps.filter((s) => s.status === "accepted").length
		const modifiedSteps = chain.steps.filter((s) => s.status === "modified").length
		const rejectedSteps = chain.steps.filter((s) => s.status === "rejected").length

		// 提取关键词
		const keywords = this.extractKeywords(chain)

		// 提取模式标签
		const patternTags = this.extractPatternTags(chain)

		// 构建NextEditMemory
		const memory: NextEditMemory = {
			version: "1.0",
			entry_id: chain.chainId,
			timestamp: chain.updatedAt,
			session_id: chain.sessionId,
			related_session: chain.sessionId, // 必需字段
			source_file: chain.affectedFiles[0] || "unknown", // 必需字段
			reasoning: chain.taskDescription, // 必需字段
			edit_chain: chain,
			task_intent: chain.taskIntent,
			keywords,
			related_files: chain.affectedFiles,
			pattern_tags: patternTags,
			success_stats: {
				totalSteps,
				acceptedSteps,
				modifiedSteps,
				rejectedSteps,
			},
		}

		// 写入reasoning类型记忆（NextEdit是推理/决策过程）
		await this.gswSystem.writeMemory("reasoning", memory)

		console.log(`[NextEditMemoryManager] Saved edit chain ${chain.chainId} to GSW`)
	}

	/**
	 * 加载编辑链
	 */
	async loadEditChain(chainId: string): Promise<EditChain | null> {
		const memory = await this.gswSystem.readMemory("reasoning", chainId)
		if (!memory) {
			return null
		}

		const nextEditMemory = memory as unknown as NextEditMemory
		return nextEditMemory.edit_chain
	}

	/**
	 * 搜索相似编辑链（用于模式学习）
	 */
	async searchSimilarChains(taskIntent: string, limit: number = 5): Promise<EditChain[]> {
		const result = await this.gswSystem.queryMemory({
			query: taskIntent,
			types: ["reasoning"],
			limit,
			useVectorSearch: true,
		})

		const chains: EditChain[] = []

		for (const memory of result.memories) {
			try {
				const nextEditMemory = memory.content as unknown as NextEditMemory
				if (nextEditMemory.edit_chain) {
					chains.push(nextEditMemory.edit_chain)
				}
			} catch (error) {
				console.warn("[NextEditMemoryManager] Failed to parse memory:", error)
			}
		}

		return chains
	}

	/**
	 * 获取已完成的编辑链
	 */
	async getCompletedChains(sessionId?: string, limit: number = 20): Promise<EditChain[]> {
		const result = await this.gswSystem.queryMemory({
			types: ["reasoning"],
			limit,
			mode: sessionId,
		})

		const chains: EditChain[] = []

		for (const memory of result.memories) {
			try {
				const nextEditMemory = memory.content as unknown as NextEditMemory
				if (nextEditMemory.edit_chain && nextEditMemory.edit_chain.status === "completed") {
					if (!sessionId || nextEditMemory.edit_chain.sessionId === sessionId) {
						chains.push(nextEditMemory.edit_chain)
					}
				}
			} catch (error) {
				console.warn("[NextEditMemoryManager] Failed to parse memory:", error)
			}
		}

		return chains
	}

	/**
	 * 保存编辑模式
	 */
	async savePattern(pattern: EditPattern): Promise<void> {
		// 缓存到内存
		this.patternCache.set(pattern.patternId, pattern)

		// 持久化到evolution类型（模式是代码演进知识）
		const memory = {
			version: "1.0",
			evolution_id: pattern.patternId,
			timestamp: new Date().toISOString(),
			file_path: "pattern",
			change_type: "pattern_learning",
			diff_summary: `Learned pattern from ${pattern.usageCount} successful edits`,
			benefits: [`Success rate: ${(pattern.successRate * 100).toFixed(1)}%`],
			risks: [],
			mode: "code",
			pattern_data: pattern,
		}

		await this.gswSystem.writeMemory("evolution", memory as any)

		console.log(`[NextEditMemoryManager] Saved pattern ${pattern.patternId}`)
	}

	/**
	 * 加载编辑模式
	 */
	async loadPattern(patternId: string): Promise<EditPattern | null> {
		// 先查缓存
		if (this.patternCache.has(patternId)) {
			return this.patternCache.get(patternId)!
		}

		// 从GSW读取
		const memory = await this.gswSystem.readMemory("evolution", patternId)
		if (!memory) {
			return null
		}

		const patternMemory = memory as any
		const pattern = patternMemory.pattern_data as EditPattern

		// 缓存
		if (pattern) {
			this.patternCache.set(patternId, pattern)
		}

		return pattern
	}

	/**
	 * 搜索匹配的模式
	 */
	async searchPatterns(taskDescription: string, files: string[]): Promise<PatternMatchResult[]> {
		// 从GSW查询相关模式
		const result = await this.gswSystem.queryMemory({
			query: taskDescription,
			types: ["evolution"],
			limit: 10,
		})

		const matches: PatternMatchResult[] = []

		for (const memory of result.memories) {
			try {
				const patternMemory = memory.content as any
				const pattern = patternMemory.pattern_data as EditPattern

				if (!pattern) continue

				// 计算匹配分数
				const score = this.calculatePatternMatchScore(pattern, taskDescription, files)

				if (score > 0.5) {
					matches.push({
						pattern,
						score,
						matches: {
							taskPattern: this.matchesTaskPattern(pattern, taskDescription),
							filePattern: this.matchesFilePattern(pattern, files),
						},
					})
				}
			} catch (error) {
				console.warn("[NextEditMemoryManager] Failed to parse pattern:", error)
			}
		}

		// 按分数排序
		matches.sort((a, b) => b.score - a.score)

		return matches
	}

	/**
	 * 保存并行会话记忆
	 */
	async saveParallelSession(session: ParallelSessionMemory): Promise<void> {
		await this.gswSystem.writeMemory("reasoning", session as any)
		console.log(`[NextEditMemoryManager] Saved parallel session ${session.parallel_session_id}`)
	}

	/**
	 * 加载并行会话记忆
	 */
	async loadParallelSession(sessionId: string): Promise<ParallelSessionMemory | null> {
		const memory = await this.gswSystem.readMemory("reasoning", sessionId)
		if (!memory) {
			return null
		}

		return memory as unknown as ParallelSessionMemory
	}

	/**
	 * 提取关键词
	 */
	private extractKeywords(chain: EditChain): string[] {
		const keywords = new Set<string>()

		// 从任务描述提取
		const words = chain.taskDescription
			.toLowerCase()
			.split(/[\s,，。！？、]+/)
			.filter((w) => w.length > 2)

		words.forEach((w) => keywords.add(w))

		// 从文件路径提取
		chain.affectedFiles.forEach((file) => {
			const parts = file.split("/")
			const fileName = parts[parts.length - 1]
			const baseName = fileName.split(".")[0]
			keywords.add(baseName.toLowerCase())
		})

		// 从步骤描述提取
		chain.steps.slice(0, 3).forEach((step) => {
			const stepWords = step.description
				.toLowerCase()
				.split(/[\s,，。！？、]+/)
				.filter((w) => w.length > 2)
			stepWords.forEach((w) => keywords.add(w))
		})

		return Array.from(keywords).slice(0, 10) // 限制数量
	}

	/**
	 * 提取模式标签
	 */
	private extractPatternTags(chain: EditChain): string[] {
		const tags = new Set<string>()

		// 根据编辑类型分类
		const editTypes = chain.steps.map((s) => s.editType)
		if (editTypes.every((t) => t === "refactor")) tags.add("refactor")
		if (editTypes.some((t) => t === "insert")) tags.add("add-feature")
		if (editTypes.some((t) => t === "replace")) tags.add("modify")
		if (editTypes.some((t) => t === "delete")) tags.add("cleanup")

		// 根据任务描述分类
		const desc = chain.taskDescription.toLowerCase()
		if (desc.includes("fix") || desc.includes("bug")) tags.add("fix-bug")
		if (desc.includes("add") || desc.includes("new")) tags.add("add-feature")
		if (desc.includes("refactor") || desc.includes("improve")) tags.add("refactor")
		if (desc.includes("test")) tags.add("testing")
		if (desc.includes("doc") || desc.includes("comment")) tags.add("documentation")

		return Array.from(tags)
	}

	/**
	 * 计算模式匹配分数
	 */
	private calculatePatternMatchScore(pattern: EditPattern, taskDescription: string, files: string[]): number {
		let score = 0

		// 任务描述匹配 (权重 0.6)
		if (this.matchesTaskPattern(pattern, taskDescription)) {
			score += 0.6
		}

		// 文件模式匹配 (权重 0.3)
		if (this.matchesFilePattern(pattern, files)) {
			score += 0.3
		}

		// 成功率加成 (权重 0.1)
		score += pattern.successRate * 0.1

		return Math.min(score, 1.0)
	}

	/**
	 * 检查是否匹配任务模式
	 */
	private matchesTaskPattern(pattern: EditPattern, taskDescription: string): boolean {
		const desc = taskDescription.toLowerCase()
		return pattern.taskPatterns.some((p) => {
			try {
				const regex = new RegExp(p, "i")
				return regex.test(desc)
			} catch {
				return desc.includes(p.toLowerCase())
			}
		})
	}

	/**
	 * 检查是否匹配文件模式
	 */
	private matchesFilePattern(pattern: EditPattern, files: string[]): boolean {
		return files.some((file) => {
			return pattern.filePatterns.some((p) => {
				// 支持通配符
				const regex = new RegExp(p.replace(/\*/g, ".*"), "i")
				return regex.test(file)
			})
		})
	}

	/**
	 * 清空模式缓存
	 */
	clearPatternCache(): void {
		this.patternCache.clear()
	}

	/**
	 * 获取统计信息
	 */
	async getStats(): Promise<{
		totalChains: number
		completedChains: number
		totalPatterns: number
		cacheSize: number
	}> {
		const chainsResult = await this.gswSystem.queryMemory({
			types: ["reasoning"],
			limit: 1000,
		})

		const chains = chainsResult.memories.filter((m) => {
			try {
				const memory = m.content as unknown as NextEditMemory
				return !!memory.edit_chain
			} catch {
				return false
			}
		})

		const completedChains = chains.filter((m) => {
			try {
				const memory = m.content as unknown as NextEditMemory
				return memory.edit_chain.status === "completed"
			} catch {
				return false
			}
		})

		const patternsResult = await this.gswSystem.queryMemory({
			types: ["evolution"],
			limit: 1000,
		})

		const patterns = patternsResult.memories.filter((m) => {
			try {
				const memory = m.content as any
				return !!memory.pattern_data
			} catch {
				return false
			}
		})

		return {
			totalChains: chains.length,
			completedChains: completedChains.length,
			totalPatterns: patterns.length,
			cacheSize: this.patternCache.size,
		}
	}
}
