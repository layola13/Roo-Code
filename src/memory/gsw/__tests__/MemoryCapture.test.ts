/**
 * GSW三元记忆系统 - 记忆捕获器测试
 * 验证强制性关键词识别、用户交互捕获、推理捕获等核心功能
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { MemoryCapture } from "../MemoryCapture"
import { DirectoryMemorySystem } from "../DirectoryMemorySystem"
import * as fs from "fs/promises"
import * as path from "path"

describe("MemoryCapture - 强制性关键词识别", () => {
	let memoryCapture: MemoryCapture
	let memorySystem: DirectoryMemorySystem
	const testDir = path.join(process.cwd(), ".test-gsw-memory")

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

	describe("extractMandatoryInstructions - 关键词提取", () => {
		it("应该识别「务必」关键词", async () => {
			const message = "务必完成这个任务，不能有任何遗漏。"

			await memoryCapture.captureUserInteraction(message, "code", "test-task-1")

			// 验证记忆文件被创建
			const interactionFiles = await fs.readdir(path.join(testDir, "interaction"))
			expect(interactionFiles.length).toBeGreaterThan(0)

			// 读取记忆内容
			const memoryFile = interactionFiles.find((f) => f.endsWith(".yaml"))
			expect(memoryFile).toBeDefined()

			const content = await fs.readFile(path.join(testDir, "interaction", memoryFile!), "utf-8")
			expect(content).toContain("务必完成这个任务")
			expect(content).toContain("mandatory_instructions")
		})

		it("应该识别「禁止」关键词", async () => {
			const message = "禁止修改配置文件，这是系统规则。"

			await memoryCapture.captureUserInteraction(message, "code", "test-task-2")

			const interactionFiles = await fs.readdir(path.join(testDir, "interaction"))
			const memoryFile = interactionFiles.find((f) => f.endsWith(".yaml"))
			const content = await fs.readFile(path.join(testDir, "interaction", memoryFile!), "utf-8")

			expect(content).toContain("禁止修改配置文件")
			expect(content).toContain("mandatory_instructions")
		})

		it("应该识别「必须」关键词", async () => {
			const message = "你必须先阅读文档，然后再开始编码。"

			await memoryCapture.captureUserInteraction(message, "code", "test-task-3")

			const interactionFiles = await fs.readdir(path.join(testDir, "interaction"))
			const memoryFile = interactionFiles.find((f) => f.endsWith(".yaml"))
			const content = await fs.readFile(path.join(testDir, "interaction", memoryFile!), "utf-8")

			expect(content).toContain("必须先阅读文档")
			expect(content).toContain("mandatory_instructions")
		})

		it("应该识别多个关键词", async () => {
			const message = "务必遵守以下规则：1. 禁止删除文件 2. 必须添加注释 3. 一定要测试"

			await memoryCapture.captureUserInteraction(message, "code", "test-task-4")

			const interactionFiles = await fs.readdir(path.join(testDir, "interaction"))
			const memoryFile = interactionFiles.find((f) => f.endsWith(".yaml"))
			const content = await fs.readFile(path.join(testDir, "interaction", memoryFile!), "utf-8")

			expect(content).toContain("mandatory_instructions")
			// 验证包含多条指令
			expect(content).toContain("禁止删除文件")
			expect(content).toContain("必须添加注释")
		})

		it("应该识别所有配置的关键词类型", async () => {
			const keywords = [
				"务必",
				"必须",
				"一定要",
				"一定得",
				"禁止",
				"不能",
				"不要",
				"严禁",
				"绝对不",
				"千万不要",
				"切记",
				"注意",
				"记住",
			]

			for (const keyword of keywords) {
				const message = `${keyword}按照标准流程执行任务。`
				await memoryCapture.captureUserInteraction(message, "code", `test-task-${keyword}`)

				const interactionFiles = await fs.readdir(path.join(testDir, "interaction"))
				// 过滤掉index.json，只读取YAML文件
				const yamlFiles = interactionFiles.filter((f) => f.endsWith(".yaml"))
				const latestFile = yamlFiles[yamlFiles.length - 1]
				const content = await fs.readFile(path.join(testDir, "interaction", latestFile), "utf-8")

				expect(content).toContain(keyword)
				expect(content).toContain("mandatory_instructions")
			}
		})

		it("没有关键词时不应该添加mandatory_instructions字段", async () => {
			const message = "请帮我创建一个新文件。"

			await memoryCapture.captureUserInteraction(message, "code", "test-task-5")

			const interactionFiles = await fs.readdir(path.join(testDir, "interaction"))
			const memoryFile = interactionFiles.find((f) => f.endsWith(".yaml"))
			const content = await fs.readFile(path.join(testDir, "interaction", memoryFile!), "utf-8")

			// mandatory_instructions字段不应该出现，或者应该是undefined/null
			expect(content).not.toMatch(/mandatory_instructions:\s*\n\s+-/)
		})
	})

	describe("captureUserInteraction - 用户交互捕获", () => {
		it("应该创建interaction记忆文件", async () => {
			await memoryCapture.captureUserInteraction("测试消息", "code", "test-task")

			const interactionFiles = await fs.readdir(path.join(testDir, "interaction"))
			expect(interactionFiles.length).toBeGreaterThan(0)
			expect(interactionFiles.some((f) => f.endsWith(".yaml"))).toBe(true)
		})

		it("应该更新索引文件", async () => {
			await memoryCapture.captureUserInteraction("测试消息", "code", "test-task")

			const indexPath = path.join(testDir, "interaction", "index.json")
			const indexExists = await fs
				.access(indexPath)
				.then(() => true)
				.catch(() => false)
			expect(indexExists).toBe(true)
		})

		it("应该记录session_id", async () => {
			await memoryCapture.captureUserInteraction("测试消息", "code", "test-task")

			const sessionId = memoryCapture.getCurrentSessionId()
			expect(sessionId).toBeDefined()
			expect(sessionId).toMatch(/^sess_\d+$/)
		})
	})

	describe("captureReasoning - 推理记忆捕获", () => {
		it("应该创建reasoning记忆文件", async () => {
			await memoryCapture.captureUserInteraction("初始消息", "code", "test-task")
			const sessionId = memoryCapture.getCurrentSessionId()!

			await memoryCapture.captureReasoning(
				"我分析了代码结构，决定使用模块化设计。这样可以提高代码的可维护性。",
				["src/test.ts"],
				sessionId,
			)

			const reasoningFiles = await fs.readdir(path.join(testDir, "reasoning"))
			expect(reasoningFiles.length).toBeGreaterThan(0)
		})

		it("应该过滤太短的推理内容", async () => {
			await memoryCapture.captureUserInteraction("初始消息", "code", "test-task")
			const sessionId = memoryCapture.getCurrentSessionId()!

			await memoryCapture.captureReasoning("短", ["src/test.ts"], sessionId)

			const reasoningFiles = await fs.readdir(path.join(testDir, "reasoning"))
			// 过滤掉index.json，只检查YAML文件
			const yamlFiles = reasoningFiles.filter((f) => f.endsWith(".yaml"))
			// 太短的内容不应该被记录
			expect(yamlFiles.length).toBe(0)
		})
	})

	describe("captureCodeEvolution - 代码演进捕获", () => {
		it("应该创建evolution记忆文件", async () => {
			await memoryCapture.captureUserInteraction("初始消息", "code", "test-task")
			const sessionId = memoryCapture.getCurrentSessionId()!

			const diff = `
@@ -1,3 +1,5 @@
+import { test } from 'vitest'
+
 function hello() {
   console.log('Hello')
 }
`

			await memoryCapture.captureCodeEvolution("src/test.ts", diff, null, sessionId)

			const evolutionFiles = await fs.readdir(path.join(testDir, "evolution"))
			expect(evolutionFiles.length).toBeGreaterThan(0)
		})

		it("应该生成diff摘要", async () => {
			await memoryCapture.captureUserInteraction("初始消息", "code", "test-task")
			const sessionId = memoryCapture.getCurrentSessionId()!

			const diff = `
+++ added line 1
+++ added line 2
--- removed line 1
`

			await memoryCapture.captureCodeEvolution("src/test.ts", diff, null, sessionId)

			// Evolution按文件路径分组，需要递归查找YAML文件
			const evolutionDir = path.join(testDir, "evolution")
			const findYamlFiles = async (dir: string): Promise<string[]> => {
				const entries = await fs.readdir(dir, { withFileTypes: true })
				const files = await Promise.all(
					entries.map(async (entry) => {
						const fullPath = path.join(dir, entry.name)
						if (entry.isDirectory()) {
							return findYamlFiles(fullPath)
						} else if (entry.name.endsWith(".yaml")) {
							return [fullPath]
						}
						return []
					}),
				)
				return files.flat()
			}

			const yamlFiles = await findYamlFiles(evolutionDir)
			expect(yamlFiles.length).toBeGreaterThan(0)

			const content = await fs.readFile(yamlFiles[0], "utf-8")
			expect(content).toContain("+ 2")
			expect(content).toContain("- 1")
		})
	})
})

describe("MemoryCapture - 端到端测试", () => {
	let memoryCapture: MemoryCapture
	let memorySystem: DirectoryMemorySystem
	const testDir = path.join(process.cwd(), ".test-gsw-e2e")

	beforeEach(async () => {
		await fs.mkdir(testDir, { recursive: true })
		memorySystem = new DirectoryMemorySystem(testDir)
		await memorySystem.initialize()
		memoryCapture = new MemoryCapture(memorySystem)
	})

	afterEach(async () => {
		await fs.rm(testDir, { recursive: true, force: true })
	})

	it("完整流程：用户指令 -> 推理 -> 代码修改", async () => {
		// 1. 用户下达包含强制性指令的任务
		const userMessage = "务必添加单元测试，禁止修改现有接口。"
		await memoryCapture.captureUserInteraction(userMessage, "code", "e2e-task")
		const sessionId = memoryCapture.getCurrentSessionId()!

		// 2. AI推理
		const reasoning = "我理解了用户的要求。我将创建新的测试文件，而不修改现有接口。这样可以保证向后兼容性。"
		await memoryCapture.captureReasoning(reasoning, ["src/test.ts"], sessionId)

		// 3. 代码演进
		const diff = `
+++ src/test.test.ts
+import { describe, it, expect } from 'vitest'
+
+describe('Test Suite', () => {
+  it('should pass', () => {
+    expect(true).toBe(true)
+  })
+})
`
		await memoryCapture.captureCodeEvolution("src/test.test.ts", diff, null, sessionId)

		// 验证三个记忆文件都被创建
		const interactionFiles = await fs.readdir(path.join(testDir, "interaction"))
		const reasoningFiles = await fs.readdir(path.join(testDir, "reasoning"))
		const evolutionFiles = await fs.readdir(path.join(testDir, "evolution"))

		expect(interactionFiles.length).toBeGreaterThan(0)
		expect(reasoningFiles.length).toBeGreaterThan(0)
		expect(evolutionFiles.length).toBeGreaterThan(0)

		// 验证interaction包含强制性指令
		const interactionFile = interactionFiles.find((f) => f.endsWith(".yaml"))!
		const interactionContent = await fs.readFile(path.join(testDir, "interaction", interactionFile), "utf-8")
		expect(interactionContent).toContain("务必添加单元测试")
		expect(interactionContent).toContain("禁止修改现有接口")
		expect(interactionContent).toContain("mandatory_instructions")
	})
})
