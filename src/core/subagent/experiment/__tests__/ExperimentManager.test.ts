import { describe, it, expect, beforeEach } from "vitest"
import { ExperimentManager, type ExperimentConfig, type MetricRecord } from "../ExperimentManager"

describe("ExperimentManager", () => {
	let manager: ExperimentManager

	beforeEach(() => {
		manager = new ExperimentManager()
	})

	describe("创建实验", () => {
		it("应该能够创建基本实验", async () => {
			const config: ExperimentConfig = {
				name: "test-experiment",
				variants: [
					{ name: "control", description: "Control group", config: { strategy: "baseline" } },
					{ name: "treatment", description: "Treatment group", config: { strategy: "new-strategy" } },
				],
			}

			const experimentId = await manager.createExperiment(config)

			expect(experimentId).toBeTruthy()
			expect(experimentId).toMatch(/^exp_/)

			const experiment = manager.getExperiment(experimentId)
			expect(experiment).toBeDefined()
			expect(experiment?.name).toBe("test-experiment")
			expect(experiment?.variants).toHaveLength(2)
			expect(experiment?.status).toBe("active")
		})

		it("应该自动分配均等allocation", async () => {
			const config: ExperimentConfig = {
				name: "test-experiment",
				variants: [
					{ name: "v1", description: "Variant 1", config: { strategy: "s1" } },
					{ name: "v2", description: "Variant 2", config: { strategy: "s2" } },
					{ name: "v3", description: "Variant 3", config: { strategy: "s3" } },
				],
			}

			const experimentId = await manager.createExperiment(config)
			const experiment = manager.getExperiment(experimentId)

			expect(experiment?.allocation.v1).toBeCloseTo(0.333, 2)
			expect(experiment?.allocation.v2).toBeCloseTo(0.333, 2)
			expect(experiment?.allocation.v3).toBeCloseTo(0.333, 2)
		})

		it("应该接受自定义allocation", async () => {
			const config: ExperimentConfig = {
				name: "test-experiment",
				variants: [
					{ name: "control", description: "Control", config: { strategy: "baseline" } },
					{ name: "treatment", description: "Treatment", config: { strategy: "new" } },
				],
				allocation: {
					control: 0.7,
					treatment: 0.3,
				},
			}

			const experimentId = await manager.createExperiment(config)
			const experiment = manager.getExperiment(experimentId)

			expect(experiment?.allocation.control).toBe(0.7)
			expect(experiment?.allocation.treatment).toBe(0.3)
		})

		it("应该拒绝无效的allocation", async () => {
			const config: ExperimentConfig = {
				name: "test-experiment",
				variants: [
					{ name: "v1", description: "V1", config: { strategy: "s1" } },
					{ name: "v2", description: "V2", config: { strategy: "s2" } },
				],
				allocation: {
					v1: 0.6,
					v2: 0.5,
				},
			}

			await expect(manager.createExperiment(config)).rejects.toThrow("Allocation must sum to 1.0")
		})
	})

	describe("变体分配", () => {
		let experimentId: string

		beforeEach(async () => {
			const config: ExperimentConfig = {
				name: "test-experiment",
				variants: [
					{ name: "control", description: "Control", config: { strategy: "baseline" } },
					{ name: "treatment", description: "Treatment", config: { strategy: "new" } },
				],
				allocation: {
					control: 0.5,
					treatment: 0.5,
				},
			}
			experimentId = await manager.createExperiment(config)
		})

		it("应该为用户分配变体", async () => {
			const variant = await manager.assignVariant("user1", experimentId)

			expect(variant).toBeTruthy()
			expect(["control", "treatment"]).toContain(variant)
		})

		it("同一用户应该总是获得相同变体", async () => {
			const variant1 = await manager.assignVariant("user1", experimentId)
			const variant2 = await manager.assignVariant("user1", experimentId)
			const variant3 = await manager.assignVariant("user1", experimentId)

			expect(variant1).toBe(variant2)
			expect(variant2).toBe(variant3)
		})

		it("不同用户应该可能获得不同变体", async () => {
			const variants = new Set<string>()

			for (let i = 0; i < 100; i++) {
				const variant = await manager.assignVariant(`user${i}`, experimentId)
				variants.add(variant)
			}

			expect(variants.size).toBeGreaterThanOrEqual(2)
		})

		it("应该根据allocation分配变体", async () => {
			const config: ExperimentConfig = {
				name: "unbalanced-experiment",
				variants: [
					{ name: "control", description: "Control", config: { strategy: "baseline" } },
					{ name: "treatment", description: "Treatment", config: { strategy: "new" } },
				],
				allocation: {
					control: 0.9,
					treatment: 0.1,
				},
			}
			const expId = await manager.createExperiment(config)

			const counts = { control: 0, treatment: 0 }

			for (let i = 0; i < 1000; i++) {
				const variant = await manager.assignVariant(`user${i}`, expId)
				counts[variant as keyof typeof counts]++
			}

			expect(counts.control).toBeGreaterThan(800)
			expect(counts.control).toBeLessThan(950)
			expect(counts.treatment).toBeGreaterThan(50)
			expect(counts.treatment).toBeLessThan(200)
		})

		it("应该处理不存在的实验", async () => {
			await expect(manager.assignVariant("user1", "non-existent")).rejects.toThrow("not found")
		})
	})

	describe("指标记录", () => {
		let experimentId: string

		beforeEach(async () => {
			const config: ExperimentConfig = {
				name: "test-experiment",
				variants: [
					{ name: "control", description: "Control", config: { strategy: "baseline" } },
					{ name: "treatment", description: "Treatment", config: { strategy: "new" } },
				],
			}
			experimentId = await manager.createExperiment(config)
		})

		it("应该能够记录指标", async () => {
			const metric: Omit<MetricRecord, "variant" | "timestamp"> = {
				userId: "user1",
				conversationId: "conv1",
				tokensSaved: 100,
				compressionRatio: 0.7,
				responseTime: 500,
				qualityScore: 0.85,
			}

			await manager.recordMetric(experimentId, "control", metric)

			const experiment = manager.getExperiment(experimentId)
			expect(experiment?.metrics).toHaveLength(1)
			expect(experiment?.metrics[0].variant).toBe("control")
			expect(experiment?.metrics[0].tokensSaved).toBe(100)
		})

		it("应该跳过不存在的实验", async () => {
			const metric: Omit<MetricRecord, "variant" | "timestamp"> = {
				userId: "user1",
				conversationId: "conv1",
				tokensSaved: 100,
				compressionRatio: 0.7,
				responseTime: 500,
				qualityScore: 0.85,
			}

			await expect(manager.recordMetric("non-existent", "control", metric)).resolves.toBeUndefined()
		})

		it("应该跳过非活跃实验的指标", async () => {
			await manager.stopExperiment(experimentId)

			const metric: Omit<MetricRecord, "variant" | "timestamp"> = {
				userId: "user1",
				conversationId: "conv1",
				tokensSaved: 100,
				compressionRatio: 0.7,
				responseTime: 500,
				qualityScore: 0.85,
			}

			await manager.recordMetric(experimentId, "control", metric)

			const experiment = manager.getExperiment(experimentId)
			expect(experiment?.metrics).toHaveLength(0)
		})
	})

	describe("结果分析", () => {
		let experimentId: string

		beforeEach(async () => {
			const config: ExperimentConfig = {
				name: "test-experiment",
				variants: [
					{ name: "control", description: "Control", config: { strategy: "baseline" } },
					{ name: "treatment", description: "Treatment", config: { strategy: "new" } },
				],
			}
			experimentId = await manager.createExperiment(config)
		})

		it("应该分析实验结果", async () => {
			for (let i = 0; i < 50; i++) {
				await manager.recordMetric(experimentId, "control", {
					userId: `user${i}`,
					conversationId: `conv${i}`,
					tokensSaved: 100 + Math.random() * 20,
					compressionRatio: 0.6 + Math.random() * 0.1,
					responseTime: 500 + Math.random() * 100,
					qualityScore: 0.8 + Math.random() * 0.1,
				})

				await manager.recordMetric(experimentId, "treatment", {
					userId: `user${i}`,
					conversationId: `conv${i}`,
					tokensSaved: 120 + Math.random() * 20,
					compressionRatio: 0.75 + Math.random() * 0.1,
					responseTime: 450 + Math.random() * 100,
					qualityScore: 0.85 + Math.random() * 0.1,
				})
			}

			const results = await manager.analyzeResults(experimentId)

			expect(results.experimentId).toBe(experimentId)
			expect(results.variants.control).toBeDefined()
			expect(results.variants.treatment).toBeDefined()
			expect(results.recommendation).toBeTruthy()
		})

		it("应该选择最佳变体", async () => {
			for (let i = 0; i < 50; i++) {
				await manager.recordMetric(experimentId, "control", {
					userId: `user${i}`,
					conversationId: `conv${i}`,
					tokensSaved: 100,
					compressionRatio: 0.6,
					responseTime: 500,
					qualityScore: 0.7,
				})

				await manager.recordMetric(experimentId, "treatment", {
					userId: `user${i}`,
					conversationId: `conv${i}`,
					tokensSaved: 200,
					compressionRatio: 0.85,
					responseTime: 400,
					qualityScore: 0.9,
				})
			}

			const results = await manager.analyzeResults(experimentId)

			expect(results.recommendation).toBe("treatment")
			expect(results.summary).toContain("treatment")
		})
	})

	describe("实验管理", () => {
		it("应该能够停止实验", async () => {
			const config: ExperimentConfig = {
				name: "test-experiment",
				variants: [
					{ name: "control", description: "Control", config: { strategy: "baseline" } },
					{ name: "treatment", description: "Treatment", config: { strategy: "new" } },
				],
			}

			const experimentId = await manager.createExperiment(config)
			await manager.stopExperiment(experimentId)

			const experiment = manager.getExperiment(experimentId)
			expect(experiment?.status).toBe("completed")
			expect(experiment?.endDate).toBeDefined()
		})

		it("应该获取所有活跃实验", async () => {
			const config1: ExperimentConfig = {
				name: "experiment-1",
				variants: [
					{ name: "control", description: "Control", config: { strategy: "baseline" } },
					{ name: "treatment", description: "Treatment", config: { strategy: "new" } },
				],
			}

			const config2: ExperimentConfig = {
				name: "experiment-2",
				variants: [
					{ name: "control", description: "Control", config: { strategy: "baseline" } },
					{ name: "treatment", description: "Treatment", config: { strategy: "new" } },
				],
			}

			const exp1 = await manager.createExperiment(config1)
			const exp2 = await manager.createExperiment(config2)

			const activeExperiments = manager.getActiveExperiments()
			expect(activeExperiments).toHaveLength(2)

			await manager.stopExperiment(exp1)

			const activeAfterStop = manager.getActiveExperiments()
			expect(activeAfterStop).toHaveLength(1)
			expect(activeAfterStop[0].id).toBe(exp2)
		})

		it("应该能够清理所有数据", () => {
			manager.clear()

			const activeExperiments = manager.getActiveExperiments()
			expect(activeExperiments).toHaveLength(0)
		})
	})

	describe("获取变体配置", () => {
		let experimentId: string

		beforeEach(async () => {
			const config: ExperimentConfig = {
				name: "test-experiment",
				variants: [
					{
						name: "control",
						description: "Control",
						config: {
							strategy: "baseline",
							windowSize: 10,
						},
					},
					{
						name: "treatment",
						description: "Treatment",
						config: {
							strategy: "semantic-clustering",
							similarityThreshold: 0.7,
							priorityWeights: {
								recency: 0.3,
								importance: 0.5,
								relevance: 0.2,
							},
						},
					},
				],
			}
			experimentId = await manager.createExperiment(config)
		})

		it("应该能够获取变体配置", async () => {
			const controlConfig = await manager.getVariantConfig(experimentId, "control")
			expect(controlConfig).toBeDefined()
			expect(controlConfig?.strategy).toBe("baseline")
			expect(controlConfig?.windowSize).toBe(10)

			const treatmentConfig = await manager.getVariantConfig(experimentId, "treatment")
			expect(treatmentConfig).toBeDefined()
			expect(treatmentConfig?.strategy).toBe("semantic-clustering")
			expect(treatmentConfig?.similarityThreshold).toBe(0.7)
		})

		it("不存在的变体应返回null", async () => {
			const config = await manager.getVariantConfig(experimentId, "non-existent")
			expect(config).toBeNull()
		})

		it("不存在的实验应返回null", async () => {
			const config = await manager.getVariantConfig("non-existent", "control")
			expect(config).toBeNull()
		})
	})
})
