/**
 * A/B测试实验管理器
 * 用于对比不同压缩策略的效果
 */

export interface ExperimentConfig {
	name: string
	variants: ExperimentVariant[]
	allocation?: Record<string, number>
	startDate?: Date
	endDate?: Date
}

export interface ExperimentVariant {
	name: string
	description: string
	config: VariantConfig
}

export interface VariantConfig {
	strategy: string
	windowSize?: number
	summaryThreshold?: number
	similarityThreshold?: number
	priorityWeights?: {
		recency: number
		importance: number
		relevance: number
	}
	useSubagents?: boolean
	aggressiveness?: "low" | "medium" | "high"
	[key: string]: any
}

export interface Experiment {
	id: string
	name: string
	variants: ExperimentVariant[]
	allocation: Record<string, number>
	metrics: MetricRecord[]
	startDate: Date
	endDate?: Date
	status: "active" | "completed" | "paused"
}

export interface MetricRecord {
	variant: string
	timestamp: Date
	userId: string
	conversationId: string
	tokensSaved: number
	compressionRatio: number
	responseTime: number
	qualityScore: number
	userSatisfaction?: number
}

export interface VariantResult {
	sampleSize: number
	metrics: {
		avgTokensSaved: number
		avgCompressionRatio: number
		avgResponseTime: number
		qualityScore: number
		userSatisfaction: number
	}
	statisticalSignificance: {
		pValue: number
		confidenceInterval: [number, number]
	}
}

export interface ExperimentResults {
	experimentId: string
	variants: Record<string, VariantResult>
	recommendation: string
	summary: string
}

/**
 * 实验管理器
 */
export class ExperimentManager {
	private experiments: Map<string, Experiment> = new Map()
	private userAssignments: Map<string, Map<string, string>> = new Map()

	/**
	 * 创建新实验
	 */
	async createExperiment(config: ExperimentConfig): Promise<string> {
		const experimentId = this.generateId()

		// 验证allocation总和为1
		const allocation = config.allocation || this.defaultAllocation(config.variants)
		const total = Object.values(allocation).reduce((sum, val) => sum + val, 0)
		if (Math.abs(total - 1.0) > 0.001) {
			throw new Error(`Allocation must sum to 1.0, got ${total}`)
		}

		const experiment: Experiment = {
			id: experimentId,
			name: config.name,
			variants: config.variants,
			allocation,
			metrics: [],
			startDate: config.startDate || new Date(),
			endDate: config.endDate,
			status: "active",
		}

		this.experiments.set(experimentId, experiment)
		return experimentId
	}

	/**
	 * 为用户分配变体
	 * 使用一致性哈希确保同一用户总是获得相同变体
	 */
	async assignVariant(userId: string, experimentId: string): Promise<string> {
		const experiment = this.experiments.get(experimentId)
		if (!experiment) {
			throw new Error(`Experiment ${experimentId} not found`)
		}

		// 检查是否已有分配
		if (!this.userAssignments.has(userId)) {
			this.userAssignments.set(userId, new Map())
		}
		const userExperiments = this.userAssignments.get(userId)!

		if (userExperiments.has(experimentId)) {
			return userExperiments.get(experimentId)!
		}

		// 使用一致性哈希分配变体
		const hash = this.hashUserId(userId, experimentId)
		const allocation = experiment.allocation

		let cumulativeProbability = 0
		let assignedVariant = "control"

		for (const [variant, probability] of Object.entries(allocation)) {
			cumulativeProbability += probability
			if (hash < cumulativeProbability) {
				assignedVariant = variant
				break
			}
		}

		// 保存分配
		userExperiments.set(experimentId, assignedVariant)
		return assignedVariant
	}

	/**
	 * 记录实验指标
	 */
	async recordMetric(
		experimentId: string,
		variant: string,
		metric: Omit<MetricRecord, "variant" | "timestamp">,
	): Promise<void> {
		const experiment = this.experiments.get(experimentId)
		if (!experiment) {
			console.warn(`Experiment ${experimentId} not found, skipping metric`)
			return
		}

		if (experiment.status !== "active") {
			console.warn(`Experiment ${experimentId} is not active, skipping metric`)
			return
		}

		experiment.metrics.push({
			variant,
			timestamp: new Date(),
			...metric,
		})
	}

	/**
	 * 获取实验的变体配置
	 */
	async getVariantConfig(experimentId: string, variant: string): Promise<VariantConfig | null> {
		const experiment = this.experiments.get(experimentId)
		if (!experiment) return null

		const variantObj = experiment.variants.find((v) => v.name === variant)
		return variantObj?.config || null
	}

	/**
	 * 分析实验结果
	 */
	async analyzeResults(experimentId: string): Promise<ExperimentResults> {
		const experiment = this.experiments.get(experimentId)
		if (!experiment) {
			throw new Error(`Experiment ${experimentId} not found`)
		}

		const results: ExperimentResults = {
			experimentId,
			variants: {},
			recommendation: "",
			summary: "",
		}

		// 计算每个变体的指标
		for (const variant of experiment.variants) {
			const variantMetrics = experiment.metrics.filter((m) => m.variant === variant.name)

			if (variantMetrics.length === 0) {
				results.variants[variant.name] = this.emptyVariantResult()
				continue
			}

			results.variants[variant.name] = {
				sampleSize: variantMetrics.length,
				metrics: {
					avgTokensSaved: this.calculateAverage(variantMetrics, "tokensSaved"),
					avgCompressionRatio: this.calculateAverage(variantMetrics, "compressionRatio"),
					avgResponseTime: this.calculateAverage(variantMetrics, "responseTime"),
					qualityScore: this.calculateAverage(variantMetrics, "qualityScore"),
					userSatisfaction: this.calculateAverage(
						variantMetrics.filter((m) => m.userSatisfaction !== undefined),
						"userSatisfaction",
					),
				},
				statisticalSignificance: this.calculateSignificance(
					variantMetrics,
					experiment.metrics.filter((m) => m.variant === "control"),
				),
			}
		}

		// 推荐最佳变体
		results.recommendation = this.selectWinner(results.variants)
		results.summary = this.generateSummary(results)

		return results
	}

	/**
	 * 停止实验
	 */
	async stopExperiment(experimentId: string): Promise<void> {
		const experiment = this.experiments.get(experimentId)
		if (!experiment) {
			throw new Error(`Experiment ${experimentId} not found`)
		}

		experiment.status = "completed"
		experiment.endDate = new Date()
	}

	/**
	 * 获取所有活跃实验
	 */
	getActiveExperiments(): Experiment[] {
		return Array.from(this.experiments.values()).filter((exp) => exp.status === "active")
	}

	/**
	 * 获取实验详情
	 */
	getExperiment(experimentId: string): Experiment | undefined {
		return this.experiments.get(experimentId)
	}

	/**
	 * 清理实验数据（用于测试）
	 */
	clear(): void {
		this.experiments.clear()
		this.userAssignments.clear()
	}

	// ========== 私有辅助方法 ==========

	private generateId(): string {
		return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}

	private defaultAllocation(variants: ExperimentVariant[]): Record<string, number> {
		const allocation: Record<string, number> = {}
		const share = 1.0 / variants.length

		variants.forEach((v) => {
			allocation[v.name] = share
		})

		return allocation
	}

	private hashUserId(userId: string, experimentId: string): number {
		// 简单的哈希函数 - 生产环境应使用更好的哈希
		const str = `${userId}:${experimentId}`
		let hash = 0
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i)
			hash = (hash << 5) - hash + char
			hash = hash & hash // Convert to 32bit integer
		}
		return Math.abs(hash % 1000) / 1000 // 归一化到 [0, 1)
	}

	private calculateAverage(metrics: MetricRecord[], field: keyof MetricRecord): number {
		if (metrics.length === 0) return 0

		const values = metrics.map((m) => Number(m[field]) || 0)
		const sum = values.reduce((a, b) => a + b, 0)
		return sum / values.length
	}

	private calculateSignificance(
		treatmentMetrics: MetricRecord[],
		controlMetrics: MetricRecord[],
	): {
		pValue: number
		confidenceInterval: [number, number]
	} {
		// 简化的统计显著性检验
		// 生产环境应使用更严格的统计方法（如t-test）

		if (treatmentMetrics.length < 30 || controlMetrics.length < 30) {
			return {
				pValue: 1.0, // 样本量不足，无法判断显著性
				confidenceInterval: [0, 0],
			}
		}

		// 计算均值差异（以compressionRatio为主要指标）
		const treatmentMean = this.calculateAverage(treatmentMetrics, "compressionRatio")
		const controlMean = this.calculateAverage(controlMetrics, "compressionRatio")
		const diff = Math.abs(treatmentMean - controlMean)

		// 简化的p值估算
		// 如果差异 > 10%，认为显著
		const pValue = diff > 0.1 ? 0.01 : diff > 0.05 ? 0.05 : 0.5

		// 简化的置信区间
		const margin = 0.05
		const confidenceInterval: [number, number] = [treatmentMean - margin, treatmentMean + margin]

		return { pValue, confidenceInterval }
	}

	private selectWinner(variants: Record<string, VariantResult>): string {
		let bestScore = -Infinity
		let winner = "control"

		for (const [name, result] of Object.entries(variants)) {
			if (result.sampleSize < 30) continue // 样本量不足

			// 综合评分：
			// 50% 压缩效果 (compressionRatio)
			// 30% 质量 (qualityScore)
			// 20% 速度 (responseTime倒数)
			const score =
				result.metrics.avgCompressionRatio * 0.5 +
				result.metrics.qualityScore * 0.3 +
				(1 / Math.max(result.metrics.avgResponseTime, 1)) * 100 * 0.2

			// 必须有统计显著性
			if (score > bestScore && result.statisticalSignificance.pValue < 0.05) {
				bestScore = score
				winner = name
			}
		}

		return winner
	}

	private generateSummary(results: ExperimentResults): string {
		const winner = results.recommendation
		const winnerResult = results.variants[winner]

		if (!winnerResult) {
			return "No clear winner found. Need more data."
		}

		return `
Recommended variant: ${winner}
Sample size: ${winnerResult.sampleSize}
Average compression ratio: ${(winnerResult.metrics.avgCompressionRatio * 100).toFixed(1)}%
Average quality score: ${(winnerResult.metrics.qualityScore * 100).toFixed(1)}%
P-value: ${winnerResult.statisticalSignificance.pValue.toFixed(3)}
    `.trim()
	}

	private emptyVariantResult(): VariantResult {
		return {
			sampleSize: 0,
			metrics: {
				avgTokensSaved: 0,
				avgCompressionRatio: 0,
				avgResponseTime: 0,
				qualityScore: 0,
				userSatisfaction: 0,
			},
			statisticalSignificance: {
				pValue: 1.0,
				confidenceInterval: [0, 0],
			},
		}
	}
}
