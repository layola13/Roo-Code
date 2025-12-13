/**
 * EditChainAnalyzer - 编辑链分析器
 * 负责模式学习和编辑链分析
 */

import { v4 as uuidv4 } from "uuid"
import { EditChain, EditPattern, EditType } from "../../memory/gsw/types/next-edit"
import { NextEditMemoryManager } from "./NextEditMemoryManager"
import { PatternLearningConfig } from "./types"

/**
 * EditChainAnalyzer
 * 分析编辑链并学习可复用模式
 */
export class EditChainAnalyzer {
	private memoryManager: NextEditMemoryManager
	private config: PatternLearningConfig

	constructor(memoryManagerOrGswSystem: NextEditMemoryManager | any, config?: PatternLearningConfig) {
		// 兼容NextEditMemoryManager或DirectoryMemorySystem
		if (memoryManagerOrGswSystem instanceof NextEditMemoryManager) {
			this.memoryManager = memoryManagerOrGswSystem
		} else {
			// 如果传入的是DirectoryMemorySystem，创建NextEditMemoryManager
			this.memoryManager = new NextEditMemoryManager(memoryManagerOrGswSystem)
		}

		// 使用默认配置
		this.config = config || {
			minSuccessRate: 0.7,
			minUsageCount: 3,
			autoUpdate: true,
		}
	}

	/**
	 * 从成功的编辑链中学习模式
	 */
	async learnFromChain(chain: EditChain): Promise<EditPattern | null> {
		// 检查是否值得学习
		if (!this.isWorthLearning(chain)) {
			return null
		}

		// 生成模式ID
		const patternId = uuidv4()

		// 提取任务模式
		const taskPatterns = this.extractTaskPatterns(chain)

		// 提取文件模式
		const filePatterns = this.extractFilePatterns(chain)

		// 提取步骤模板
		const stepTemplates = this.extractStepTemplates(chain)

		// 计算成功率
		const successRate = this.calculateSuccessRate(chain)

		const pattern: EditPattern = {
			patternId,
			taskPatterns,
			filePatterns,
			stepTemplates,
			usageCount: 1,
			successRate,
			lastUsedAt: new Date().toISOString(),
		}

		// 保存模式
		await this.memoryManager.savePattern(pattern)

		console.log(`[EditChainAnalyzer] Learned new pattern ${patternId} from chain ${chain.chainId}`)

		return pattern
	}

	/**
	 * 检查编辑链是否值得学习
	 */
	private isWorthLearning(chain: EditChain): boolean {
		// 必须已完成
		if (chain.status !== "completed") {
			return false
		}

		// 必须有足够的步骤
		if (chain.steps.length < 2) {
			return false
		}

		// 计算成功率
		const successRate = this.calculateSuccessRate(chain)

		// 必须达到最小成功率阈值
		return successRate >= this.config.minSuccessRate
	}

	/**
	 * 计算编辑链成功率
	 */
	private calculateSuccessRate(chain: EditChain): number {
		const totalSteps = chain.steps.length
		if (totalSteps === 0) return 0

		const successfulSteps = chain.steps.filter((s) => s.status === "accepted" || s.status === "modified").length

		return successfulSteps / totalSteps
	}

	/**
	 * 提取任务模式
	 */
	private extractTaskPatterns(chain: EditChain): string[] {
		const patterns: string[] = []

		// 1. 使用任务描述作为基础模式
		const taskDesc = chain.taskDescription.toLowerCase()

		// 2. 提取关键动词 + 对象组合
		const actionPatterns = [
			/add\s+(\w+)/gi,
			/create\s+(\w+)/gi,
			/implement\s+(\w+)/gi,
			/refactor\s+(\w+)/gi,
			/fix\s+(\w+)/gi,
			/update\s+(\w+)/gi,
			/remove\s+(\w+)/gi,
		]

		for (const regex of actionPatterns) {
			const matches = taskDesc.matchAll(regex)
			for (const match of matches) {
				patterns.push(match[0])
			}
		}

		// 3. 如果没有匹配到具体模式，使用完整描述的简化版
		if (patterns.length === 0) {
			// 提取前3个有意义的词
			const words = taskDesc
				.split(/\s+/)
				.filter((w) => w.length > 3 && !["the", "and", "for", "with"].includes(w))
				.slice(0, 3)

			if (words.length > 0) {
				patterns.push(words.join(".*"))
			}
		}

		return patterns.length > 0 ? patterns : [taskDesc.substring(0, 50)]
	}

	/**
	 * 提取文件模式
	 */
	private extractFilePatterns(chain: EditChain): string[] {
		const patterns = new Set<string>()

		for (const file of chain.affectedFiles) {
			// 1. 提取文件扩展名模式
			const ext = file.split(".").pop()
			if (ext) {
				patterns.add(`*.${ext}`)
			}

			// 2. 提取文件名模式
			const fileName = file.split("/").pop()
			if (fileName) {
				// 移除数字和特定后缀，保留通用模式
				const genericName = fileName
					.replace(/\d+/g, "*")
					.replace(/test|spec/i, "*")
					.replace(/\.test\.|\.spec\./, ".*.")

				patterns.add(genericName)
			}

			// 3. 提取目录模式
			const parts = file.split("/")
			if (parts.length > 1) {
				const dir = parts.slice(0, -1).join("/")
				patterns.add(`${dir}/*`)
			}
		}

		return Array.from(patterns)
	}

	/**
	 * 提取步骤模板
	 */
	private extractStepTemplates(chain: EditChain): Array<{
		editType: EditType
		descriptionTemplate: string
		codeTransform?: string
	}> {
		const templates: Array<{
			editType: EditType
			descriptionTemplate: string
			codeTransform?: string
		}> = []

		// 只保留成功的步骤
		const successfulSteps = chain.steps.filter((s) => s.status === "accepted" || s.status === "modified")

		for (const step of successfulSteps) {
			// 泛化描述（移除具体名称和数字）
			const genericDesc = step.description
				.replace(/\b[A-Z][a-zA-Z]*\b/g, "{Name}") // 替换类名
				.replace(/\b\d+\b/g, "{Number}") // 替换数字
				.replace(/"[^"]*"/g, '"{String}"') // 替换字符串
				.replace(/'[^']*'/g, "'{String}'")

			// 提取代码转换模式（简化）
			let codeTransform: string | undefined
			if (step.editType === "replace" && step.originalCode && step.suggestedCode) {
				// 记录转换类型
				if (step.suggestedCode.length > step.originalCode.length * 1.5) {
					codeTransform = "expand"
				} else if (step.suggestedCode.length < step.originalCode.length * 0.5) {
					codeTransform = "simplify"
				} else {
					codeTransform = "modify"
				}
			}

			templates.push({
				editType: step.editType,
				descriptionTemplate: genericDesc,
				codeTransform,
			})
		}

		return templates
	}

	/**
	 * 更新现有模式的统计信息
	 */
	async updatePatternStats(patternId: string, chain: EditChain): Promise<EditPattern | null> {
		const pattern = await this.memoryManager.loadPattern(patternId)
		if (!pattern) {
			return null
		}

		// 更新使用次数
		pattern.usageCount++

		// 更新成功率（加权平均）
		const chainSuccessRate = this.calculateSuccessRate(chain)
		pattern.successRate = (pattern.successRate * (pattern.usageCount - 1) + chainSuccessRate) / pattern.usageCount

		// 更新最后使用时间
		pattern.lastUsedAt = new Date().toISOString()

		// 保存更新
		await this.memoryManager.savePattern(pattern)

		return pattern
	}

	/**
	 * 分析编辑链的复杂度
	 */
	analyzeComplexity(chain: EditChain): {
		complexity: "simple" | "moderate" | "complex"
		score: number
		factors: string[]
	} {
		const factors: string[] = []
		let score = 0

		// 1. 步骤数量
		if (chain.steps.length > 10) {
			score += 3
			factors.push(`Many steps (${chain.steps.length})`)
		} else if (chain.steps.length > 5) {
			score += 2
			factors.push(`Moderate steps (${chain.steps.length})`)
		} else {
			score += 1
		}

		// 2. 依赖关系
		const stepsWithDeps = chain.steps.filter((s) => s.dependsOn && s.dependsOn.length > 0)
		if (stepsWithDeps.length > chain.steps.length * 0.5) {
			score += 2
			factors.push("Many dependencies")
		}

		// 3. 涉及文件数
		if (chain.affectedFiles.length > 5) {
			score += 2
			factors.push(`Many files (${chain.affectedFiles.length})`)
		} else if (chain.affectedFiles.length > 2) {
			score += 1
		}

		// 4. 编辑类型多样性
		const editTypes = new Set(chain.steps.map((s) => s.editType))
		if (editTypes.size >= 3) {
			score += 1
			factors.push("Diverse edit types")
		}

		// 5. 低置信度步骤
		const lowConfidenceSteps = chain.steps.filter((s) => s.confidence < 0.7)
		if (lowConfidenceSteps.length > 0) {
			score += 1
			factors.push(`Low confidence steps (${lowConfidenceSteps.length})`)
		}

		// 确定复杂度等级
		let complexity: "simple" | "moderate" | "complex"
		if (score <= 3) {
			complexity = "simple"
		} else if (score <= 6) {
			complexity = "moderate"
		} else {
			complexity = "complex"
		}

		return { complexity, score, factors }
	}

	/**
	 * 推荐编辑策略
	 */
	recommendStrategy(chain: EditChain): {
		executionMode: "sequential" | "parallel"
		reasoning: string
		confidence: number
	} {
		const complexity = this.analyzeComplexity(chain)

		// 检查依赖关系
		const hasComplexDependencies = chain.steps.some((s) => s.dependsOn && s.dependsOn.length > 1)

		// 检查文件分布
		const fileDistribution = new Map<string, number>()
		for (const step of chain.steps) {
			fileDistribution.set(step.filePath, (fileDistribution.get(step.filePath) || 0) + 1)
		}
		const filesWithMultipleEdits = Array.from(fileDistribution.values()).filter((count) => count > 1)

		// 决策逻辑
		if (hasComplexDependencies) {
			return {
				executionMode: "sequential",
				reasoning: "Complex dependencies require sequential execution",
				confidence: 0.9,
			}
		}

		if (filesWithMultipleEdits.length > chain.affectedFiles.length * 0.5) {
			return {
				executionMode: "sequential",
				reasoning: "Multiple edits to same files are safer when sequential",
				confidence: 0.8,
			}
		}

		if (complexity.complexity === "simple" && chain.affectedFiles.length <= 2) {
			return {
				executionMode: "sequential",
				reasoning: "Simple tasks with few files don't benefit from parallelization",
				confidence: 0.7,
			}
		}

		if (chain.affectedFiles.length >= 3 && complexity.complexity !== "complex") {
			return {
				executionMode: "parallel",
				reasoning: "Multiple independent files can be edited in parallel",
				confidence: 0.85,
			}
		}

		return {
			executionMode: "sequential",
			reasoning: "Default to sequential for safety",
			confidence: 0.6,
		}
	}

	/**
	 * 更新配置
	 */
	updateConfig(config: Partial<PatternLearningConfig>): void {
		this.config = { ...this.config, ...config }
	}

	/**
	 * 获取配置
	 */
	getConfig(): PatternLearningConfig {
		return { ...this.config }
	}
}
