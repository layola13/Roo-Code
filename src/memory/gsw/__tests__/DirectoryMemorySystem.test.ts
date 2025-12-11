/**
 * GSW三元记忆系统 - DirectoryMemorySystem 测试
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { DirectoryMemorySystem } from "../DirectoryMemorySystem"
import { InteractionMemory } from "../types/interaction"
import { ReasoningMemory } from "../types/reasoning"
import { EvolutionMemory } from "../types/evolution"
import { fileExistsAtPath } from "../../../utils/fs"

describe("DirectoryMemorySystem", () => {
	let system: DirectoryMemorySystem
	let tempDir: string

	beforeEach(async () => {
		// 创建临时测试目录
		tempDir = path.join(os.tmpdir(), `gsw-test-${Date.now()}`)
		system = new DirectoryMemorySystem(tempDir)
		await system.initialize()
	})

	afterEach(async () => {
		// 清理测试目录
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch (error) {
			console.error("Failed to clean up test directory:", error)
		}
	})

	describe("initialize", () => {
		it("应该创建所有必需的目录结构", async () => {
			const dirs = [
				"interaction_memory/sessions",
				"reasoning_memory/decisions",
				"evolution_memory/files",
				"system/locks",
			]

			for (const dir of dirs) {
				const exists = await fileExistsAtPath(path.join(tempDir, dir))
				expect(exists).toBe(true)
			}
		})

		it("应该初始化所有索引文件", async () => {
			const types = ["interaction_memory", "reasoning_memory", "evolution_memory"]

			for (const type of types) {
				const indexPath = path.join(tempDir, type, "index.json")
				const exists = await fileExistsAtPath(indexPath)
				expect(exists).toBe(true)

				const content = await fs.readFile(indexPath, "utf-8")
				const index = JSON.parse(content)
				expect(index.version).toBe("1.0")
				expect(index.entries).toEqual([])
			}
		})

		it("应该支持幂等性调用", async () => {
			// 第二次初始化不应该报错
			await expect(system.initialize()).resolves.not.toThrow()
		})
	})

	describe("writeMemory - Interaction", () => {
		it("应该写入交互记忆并更新索引", async () => {
			const sessionData: InteractionMemory = {
				version: "1.0",
				session_id: "sess_001",
				start_time: new Date().toISOString(),
				mode: "Code",
				user_goals: [
					{
						timestamp: new Date().toISOString(),
						goal: "优化性能",
						context: "当前系统响应慢",
						context_switch: false,
					},
				],
			}

			const id = await system.writeMemory("interaction", sessionData)
			expect(id).toBe("sess_001")

			// 验证文件存在
			const files = await fs.readdir(path.join(tempDir, "interaction_memory", "sessions"))
			expect(files.length).toBe(1)
			expect(files[0]).toContain("sess_001")

			// 验证索引更新
			const indexPath = path.join(tempDir, "interaction_memory", "index.json")
			const index = JSON.parse(await fs.readFile(indexPath, "utf-8"))
			expect(index.entries.length).toBe(1)
			expect(index.entries[0].id).toBe("sess_001")
		})
	})

	describe("writeMemory - Reasoning", () => {
		it("应该写入推理记忆", async () => {
			const reasoningData: ReasoningMemory = {
				version: "1.0",
				entry_id: "reason_001",
				timestamp: new Date().toISOString(),
				related_session: "sess_001",
				source_file: "src/test.ts",
				reasoning: "选择使用缓存机制来提升性能",
				decision_points: ["性能 vs 复杂度：选择性能优先"],
				confidence: 0.8,
				related_files: ["src/test.ts"],
			}

			const id = await system.writeMemory("reasoning", reasoningData)
			expect(id).toBe("reason_001")
		})
	})

	describe("writeMemory - Evolution", () => {
		it("应该写入代码演进记忆", async () => {
			const evolutionData: EvolutionMemory = {
				version: "1.0",
				evolution_id: "evol_001",
				timestamp: new Date().toISOString(),
				file_path: "src/test.ts",
				git_commit: "abc123",
				diff_summary: "+ 10行 / - 5行",
				modification_context: {
					reason: "添加缓存功能",
					related_session: "sess_001",
				},
				benefits: ["提升性能"],
				potential_issues: ["需要管理缓存失效"],
				future_applications: ["可应用到其他模块"],
			}

			const id = await system.writeMemory("evolution", evolutionData)
			expect(id).toBe("evol_001")
		})
	})

	describe("readMemory", () => {
		it("应该正确读取已写入的记忆", async () => {
			const data: InteractionMemory = {
				version: "1.0",
				session_id: "sess_002",
				start_time: new Date().toISOString(),
				mode: "Debug",
				user_goals: [],
			}

			await system.writeMemory("interaction", data)
			const retrieved = await system.readMemory("interaction", "sess_002")

			expect(retrieved).not.toBeNull()
			expect((retrieved as InteractionMemory).session_id).toBe("sess_002")
			expect((retrieved as InteractionMemory).mode).toBe("Debug")
		})

		it("应该在记忆不存在时返回null", async () => {
			const result = await system.readMemory("interaction", "nonexistent")
			expect(result).toBeNull()
		})
	})

	describe("readMemories", () => {
		it("应该支持批量读取和过滤", async () => {
			// 写入多个记忆
			for (let i = 0; i < 3; i++) {
				const data: InteractionMemory = {
					version: "1.0",
					session_id: `sess_${i}`,
					start_time: new Date().toISOString(),
					mode: "Code",
					user_goals: [],
				}
				await system.writeMemory("interaction", data)
			}

			const results = await system.readMemories("interaction", { limit: 10 })
			expect(results.length).toBe(3)
		})
	})

	describe("getStats", () => {
		it("应该返回正确的统计信息", async () => {
			const data: InteractionMemory = {
				version: "1.0",
				session_id: "sess_stats",
				start_time: new Date().toISOString(),
				mode: "Code",
				user_goals: [],
			}
			await system.writeMemory("interaction", data)

			const stats = await system.getStats()
			expect(stats.totalEntries).toBeGreaterThan(0)
			expect(stats.byType.interaction).toBeGreaterThan(0)
		})
	})

	describe("healthCheck", () => {
		it("应该检测系统健康状态", async () => {
			const report = await system.healthCheck()
			expect(report).toHaveProperty("healthy")
			expect(report).toHaveProperty("issues")
			expect(report).toHaveProperty("summary")
		})
	})
})
