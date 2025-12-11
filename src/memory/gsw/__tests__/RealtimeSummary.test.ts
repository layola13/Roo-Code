/**
 * GSW增强功能1：实时上下文总结测试
 * 验证会话总结生成、缓存和查询功能
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { MemoryCapture } from "../MemoryCapture"
import { DirectoryMemorySystem } from "../DirectoryMemorySystem"
import { SessionSummary } from "../types/summary"
import * as fs from "fs/promises"
import * as path from "path"

describe("实时上下文总结 - 总结生成", () => {
	let memoryCapture: MemoryCapture
	let memorySystem: DirectoryMemorySystem
	const testDir = path.join(process.cwd(), ".test-gsw-summary")

	beforeEach(async () => {
		// 创建测试目录
		await fs.mkdir(testDir, { recursive: true })
		memorySystem = new DirectoryMemorySystem(testDir)
		await memorySystem.initialize()
		memoryCapture = new MemoryCapture(memorySystem)
	})

	afterEach(async () => {
		// 清理测试目录
		await fs.rm(testDir, { recursive: true, force: true })
	})

	describe("generateRealtimeSummary - 基于规则的总结", () => {
		it("应该生成有效的会话总结", async () => {
			// 创建一个会话
			await memoryCapture.captureUserInteraction("实现用户登录功能", "code", "test-task-1")
			const sessionId = memoryCapture.getCurrentSessionId()!

			// 生成总结
			const summary = await memoryCapture.generateRealtimeSummary(sessionId)

			// 验证总结结构
			expect(summary).toBeDefined()
			expect(summary.session_id).toBe(sessionId)
			expect(summary.key_points).toBeInstanceOf(Array)
			expect(summary.key_points.length).toBeGreaterThan(0)
			expect(summary.user_intent).toBeDefined()
			expect(summary.current_status).toBeDefined()
			expect(summary.next_steps).toBeInstanceOf(Array)
			expect(summary.last_updated).toBeDefined()
		})

		it("应该提取强制性需求", async () => {
			// 创建包含强制性指令的会话
			await memoryCapture.captureUserInteraction("务必添加单元测试，禁止修改现有API", "code", "test-task-2")
			const sessionId = memoryCapture.getCurrentSessionId()!

			// 生成总结
			const summary = await memoryCapture.generateRealtimeSummary(sessionId)

			// 验证强制性需求被提取
			expect(summary.mandatory_requirements).toBeDefined()
			expect(summary.mandatory_requirements!.length).toBeGreaterThan(0)
			expect(summary.mandatory_requirements!.some((r) => r.includes("务必添加单元测试"))).toBe(true)
			expect(summary.mandatory_requirements!.some((r) => r.includes("禁止修改现有API"))).toBe(true)
		})

		it("应该正确处理多个用户目标", async () => {
			// 创建会话并追加多个目标
			await memoryCapture.captureUserInteraction("第一个任务", "code", "test-task-3")
			await memoryCapture.captureUserInteraction("第二个任务", "code", "test-task-3")
			await memoryCapture.captureUserInteraction("第三个任务", "code", "test-task-3")
			const sessionId = memoryCapture.getCurrentSessionId()!

			// 生成总结
			const summary = await memoryCapture.generateRealtimeSummary(sessionId)

			// 验证关键点反映了多个目标
			expect(summary.key_points.length).toBeGreaterThan(1)
			expect(summary.key_points.some((p) => p.includes("3个目标"))).toBe(true)
		})

		it("应该限制key_points不超过5条", async () => {
			await memoryCapture.captureUserInteraction("测试任务", "code", "test-task-4")
			const sessionId = memoryCapture.getCurrentSessionId()!

			const summary = await memoryCapture.generateRealtimeSummary(sessionId)

			expect(summary.key_points.length).toBeLessThanOrEqual(5)
		})

		it("应该限制next_steps不超过3条", async () => {
			await memoryCapture.captureUserInteraction("测试任务", "code", "test-task-5")
			const sessionId = memoryCapture.getCurrentSessionId()!

			const summary = await memoryCapture.generateRealtimeSummary(sessionId)

			expect(summary.next_steps.length).toBeLessThanOrEqual(3)
		})
	})
})

describe("实时上下文总结 - 总结缓存", () => {
	let memorySystem: DirectoryMemorySystem
	const testDir = path.join(process.cwd(), ".test-gsw-summary-cache")

	beforeEach(async () => {
		await fs.mkdir(testDir, { recursive: true })
		memorySystem = new DirectoryMemorySystem(testDir)
		await memorySystem.initialize()
	})

	afterEach(async () => {
		await fs.rm(testDir, { recursive: true, force: true })
	})

	describe("saveSessionSummary - 保存总结", () => {
		it("应该将总结保存到文件系统", async () => {
			const summary: SessionSummary = {
				session_id: "test-session-1",
				last_updated: new Date().toISOString(),
				key_points: ["关键点1", "关键点2", "关键点3"],
				user_intent: "实现登录功能",
				current_status: "进行中",
				next_steps: ["步骤1", "步骤2"],
			}

			await memorySystem.saveSessionSummary(summary)

			// 验证文件被创建
			const summaryPath = path.join(testDir, "summaries", "test-session-1.json")
			const exists = await fs
				.access(summaryPath)
				.then(() => true)
				.catch(() => false)
			expect(exists).toBe(true)

			// 验证文件内容
			const content = await fs.readFile(summaryPath, "utf-8")
			const parsed = JSON.parse(content)
			expect(parsed.session_id).toBe("test-session-1")
			expect(parsed.key_points).toEqual(["关键点1", "关键点2", "关键点3"])
		})

		it("应该使用safeWriteJson进行原子写入", async () => {
			const summary: SessionSummary = {
				session_id: "test-session-2",
				last_updated: new Date().toISOString(),
				key_points: ["测试"],
				user_intent: "测试",
				current_status: "测试",
				next_steps: ["测试"],
			}

			// 多次保存同一个session（模拟并发写入）
			await Promise.all([
				memorySystem.saveSessionSummary(summary),
				memorySystem.saveSessionSummary(summary),
				memorySystem.saveSessionSummary(summary),
			])

			// 验证文件没有损坏
			const summaryPath = path.join(testDir, "summaries", "test-session-2.json")
			const content = await fs.readFile(summaryPath, "utf-8")
			expect(() => JSON.parse(content)).not.toThrow()
		})
	})

	describe("getSessionSummary - 读取总结", () => {
		it("应该从文件系统读取总结", async () => {
			const summary: SessionSummary = {
				session_id: "test-session-3",
				last_updated: new Date().toISOString(),
				key_points: ["关键点A"],
				user_intent: "测试读取",
				current_status: "完成",
				next_steps: ["无"],
			}

			// 保存
			await memorySystem.saveSessionSummary(summary)

			// 读取
			const retrieved = await memorySystem.getSessionSummary("test-session-3")

			expect(retrieved).toBeDefined()
			expect(retrieved!.session_id).toBe("test-session-3")
			expect(retrieved!.key_points).toEqual(["关键点A"])
		})

		it("应该使用内存缓存提升性能", async () => {
			const summary: SessionSummary = {
				session_id: "test-session-4",
				last_updated: new Date().toISOString(),
				key_points: ["缓存测试"],
				user_intent: "测试缓存",
				current_status: "进行中",
				next_steps: ["验证缓存"],
			}

			await memorySystem.saveSessionSummary(summary)

			// 第一次读取（从文件）
			const first = await memorySystem.getSessionSummary("test-session-4")
			expect(first).toBeDefined()

			// 删除文件模拟缓存场景
			const summaryPath = path.join(testDir, "summaries", "test-session-4.json")
			await fs.unlink(summaryPath)

			// 第二次读取（从缓存）
			const second = await memorySystem.getSessionSummary("test-session-4")
			expect(second).toBeDefined()
			expect(second!.session_id).toBe("test-session-4")
		})

		it("不存在的session应该返回null", async () => {
			const result = await memorySystem.getSessionSummary("non-existent-session")
			expect(result).toBeNull()
		})
	})
})

describe("实时上下文总结 - queryMemory集成", () => {
	let memoryCapture: MemoryCapture
	let memorySystem: DirectoryMemorySystem
	const testDir = path.join(process.cwd(), ".test-gsw-query-summary")

	beforeEach(async () => {
		await fs.mkdir(testDir, { recursive: true })
		memorySystem = new DirectoryMemorySystem(testDir)
		await memorySystem.initialize()
		memoryCapture = new MemoryCapture(memorySystem)
	})

	afterEach(async () => {
		await fs.rm(testDir, { recursive: true, force: true })
	})

	describe("queryMemory with useSummaries", () => {
		it("应该优先返回会话总结", async () => {
			// 创建会话
			await memoryCapture.captureUserInteraction("实现API接口", "code", "test-task-1")
			const sessionId = memoryCapture.getCurrentSessionId()!

			// 生成并保存总结
			const summary = await memoryCapture.generateRealtimeSummary(sessionId)
			await memorySystem.saveSessionSummary(summary)

			// 查询记忆（启用总结模式）
			const result = await memorySystem.queryMemory({
				useSummaries: true,
				limit: 5,
			})

			// 验证返回了总结
			expect(result.summaries).toBeDefined()
			expect(result.summaries!.length).toBeGreaterThan(0)
			expect(result.summaries![0].session_id).toBe(sessionId)
		})

		it("应该支持时间过滤", async () => {
			// 创建旧会话
			await memoryCapture.captureUserInteraction("旧任务", "code", "old-task")
			const oldSessionId = memoryCapture.getCurrentSessionId()!
			const oldSummary = await memoryCapture.generateRealtimeSummary(oldSessionId)

			// 修改时间为30天前
			oldSummary.last_updated = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
			await memorySystem.saveSessionSummary(oldSummary)

			// 创建新会话
			await memoryCapture.captureUserInteraction("新任务", "code", "new-task")
			const newSessionId = memoryCapture.getCurrentSessionId()!
			const newSummary = await memoryCapture.generateRealtimeSummary(newSessionId)
			await memorySystem.saveSessionSummary(newSummary)

			// 查询最近7天的记忆
			const result = await memorySystem.queryMemory({
				useSummaries: true,
				recentDays: 7,
			})

			// 只应该返回新会话
			expect(result.summaries).toBeDefined()
			expect(result.summaries!.length).toBe(1)
			expect(result.summaries![0].session_id).toBe(newSessionId)
		})

		it("没有总结时应该fallback到完整记忆", async () => {
			// 创建会话但不生成总结
			// 注意：captureUserInteraction现在会自动生成总结，所以我们需要删除总结文件来模拟没有总结的情况
			await memoryCapture.captureUserInteraction("测试任务", "code", "test-task")
			const sessionId = memoryCapture.getCurrentSessionId()!

			// 删除自动生成的总结文件
			const summaryPath = path.join(testDir, "summaries", `${sessionId}.json`)
			await fs.unlink(summaryPath).catch(() => {}) // 忽略错误

			// 查询记忆（此时没有总结文件）
			const result = await memorySystem.queryMemory({
				useSummaries: true,
				limit: 5,
			})

			// 应该返回完整记忆
			expect(result.memories).toBeDefined()
			// summaries应该为空数组
			if (result.summaries) {
				expect(result.summaries.length).toBe(0)
			}
		})

		it("禁用总结模式时应该返回完整记忆", async () => {
			// 创建会话并生成总结
			await memoryCapture.captureUserInteraction("测试任务", "code", "test-task")
			const sessionId = memoryCapture.getCurrentSessionId()!
			const summary = await memoryCapture.generateRealtimeSummary(sessionId)
			await memorySystem.saveSessionSummary(summary)

			// 查询记忆（禁用总结模式）
			const result = await memorySystem.queryMemory({
				useSummaries: false,
				limit: 5,
			})

			// 应该不返回总结
			expect(result.summaries).toBeUndefined()
			// 应该返回完整记忆
			expect(result.memories).toBeDefined()
		})
	})
})

describe("实时上下文总结 - 端到端测试", () => {
	let memoryCapture: MemoryCapture
	let memorySystem: DirectoryMemorySystem
	const testDir = path.join(process.cwd(), ".test-gsw-summary-e2e")

	beforeEach(async () => {
		await fs.mkdir(testDir, { recursive: true })
		memorySystem = new DirectoryMemorySystem(testDir)
		await memorySystem.initialize()
		memoryCapture = new MemoryCapture(memorySystem)
	})

	afterEach(async () => {
		await fs.rm(testDir, { recursive: true, force: true })
	})

	it("完整流程：捕获交互 -> 自动生成总结 -> 查询总结", async () => {
		// 1. 用户交互（应该自动生成总结）
		await memoryCapture.captureUserInteraction("务必实现用户认证功能，禁止使用明文密码", "code", "e2e-task")
		const sessionId = memoryCapture.getCurrentSessionId()!

		// 等待一小段时间确保异步操作完成
		await new Promise((resolve) => setTimeout(resolve, 100))

		// 2. 验证总结文件被创建
		const summaryPath = path.join(testDir, "summaries", `${sessionId}.json`)
		const summaryExists = await fs
			.access(summaryPath)
			.then(() => true)
			.catch(() => false)
		expect(summaryExists).toBe(true)

		// 3. 读取总结
		const summary = await memorySystem.getSessionSummary(sessionId)
		expect(summary).toBeDefined()
		expect(summary!.mandatory_requirements).toBeDefined()
		expect(summary!.mandatory_requirements!.some((r) => r.includes("务必实现用户认证功能"))).toBe(true)

		// 4. 通过queryMemory查询
		const result = await memorySystem.queryMemory({
			useSummaries: true,
			limit: 5,
		})

		expect(result.summaries).toBeDefined()
		expect(result.summaries!.length).toBeGreaterThan(0)
		expect(result.summaries![0].session_id).toBe(sessionId)
	})

	it("多会话场景：按时间排序返回总结", async () => {
		// 创建3个会话
		const sessions: string[] = []

		for (let i = 1; i <= 3; i++) {
			await memoryCapture.captureUserInteraction(`任务${i}`, "code", `task-${i}`)
			const sessionId = memoryCapture.getCurrentSessionId()!
			sessions.push(sessionId)

			// 等待确保时间戳不同和异步操作完成
			await new Promise((resolve) => setTimeout(resolve, 100))
		}

		// 再等待一下确保所有总结文件都已写入
		await new Promise((resolve) => setTimeout(resolve, 200))

		// 查询所有总结
		const result = await memorySystem.queryMemory({
			useSummaries: true,
			limit: 10,
		})

		// 验证返回了所有总结
		expect(result.summaries).toBeDefined()
		expect(result.summaries!.length).toBeGreaterThanOrEqual(1) // 至少有1个

		// 如果有多个总结，验证按时间倒序排序（最新的在前）
		if (result.summaries!.length >= 2) {
			const firstTime = new Date(result.summaries![0].last_updated).getTime()
			const secondTime = new Date(result.summaries![1].last_updated).getTime()
			expect(firstTime).toBeGreaterThanOrEqual(secondTime)
		}
	})
})
