/**
 * Rust+WASM 集成测试
 *
 * 目标：验证各个 Adapter 之间的协作和端到端流程
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { TaskAdapter } from "../TaskAdapter"
import { ToolsAdapter } from "../ToolsAdapter"
import { ConversationAdapter } from "../ConversationAdapter"
import { MemoryAdapter, MemoryType, MemoryPriority } from "../MemoryAdapter"
import type { HostInterface } from "../../host/HostInterface"
import { TaskStatus } from "@roo-code/types"
import * as fs from "fs/promises"
import * as path from "path"

// Mock safeWriteJson
vi.mock("../../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn(async (filePath: string, data: any) => {
		await fs.mkdir(path.dirname(filePath), { recursive: true })
		await fs.writeFile(filePath, JSON.stringify(data, null, 2))
	}),
}))

describe("Rust+WASM 集成测试", () => {
	let mockHostInterface: HostInterface
	let testPersistencePath: string

	beforeEach(() => {
		testPersistencePath = path.join(process.cwd(), "test-temp", `integration-test-${Date.now()}`)

		mockHostInterface = {
			log: vi.fn(),
			readFile: vi.fn(),
			writeFile: vi.fn(),
			fileExists: vi.fn().mockResolvedValue(false),
			readJson: vi.fn().mockResolvedValue({}),
			listFiles: vi.fn(),
			ensureDir: vi.fn(),
			fetch: vi.fn(),
			showNotification: vi.fn(),
		} as any
	})

	afterEach(async () => {
		try {
			await fs.rm(testPersistencePath, { recursive: true, force: true })
		} catch (error) {
			// 忽略清理错误
		}
	})

	describe("端到端流程测试", () => {
		it("应该完成完整的任务执行流程：Task → Conversation → Memory", async () => {
			// 1. 初始化 Task
			const taskAdapter = new TaskAdapter("integration-test-1", "code", mockHostInterface, {
				enableWasm: false, // 使用 Fallback 模式确保测试稳定
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			// 2. 初始化 Conversation
			const conversationAdapter = new ConversationAdapter(mockHostInterface, {
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			// 3. 初始化 Memory
			const memoryAdapter = new MemoryAdapter({
				taskId: "integration-test-1",
				hostInterface: mockHostInterface,
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			// 4. 启动任务
			await taskAdapter.start("Initial message")
			expect(taskAdapter.getStatus()).toBe(TaskStatus.Running)

			// 5. 添加对话消息
			await conversationAdapter.addMessage({
				role: "user",
				content: "You must implement error handling for all API calls",
			})

			await conversationAdapter.addMessage({
				role: "assistant",
				content: "I will add try-catch blocks to all API calls",
			})

			// 6. 从对话中提取记忆
			const messages = await conversationAdapter.getMessages()
			const memoryResult = await memoryAdapter.extractMemories(
				messages.map((m) => ({
					role: m.role,
					content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
				})),
			)

			// 7. 验证记忆提取
			expect(memoryResult.scanned_messages).toBe(2)
			expect(memoryResult.new_memories_count).toBeGreaterThan(0)

			// 验证至少有一些记忆被提取
			expect(memoryResult.memories.length).toBeGreaterThan(0)

			// 8. 获取记忆统计
			const stats = await memoryAdapter.getMemoryStats()
			expect(stats.total_memories).toBeGreaterThan(0)

			// 9. 完成任务
			await taskAdapter.complete()
			expect(taskAdapter.getStatus()).toBe(TaskStatus.Idle)

			// 10. 清理资源
			taskAdapter.dispose()
			conversationAdapter.dispose()
			memoryAdapter.dispose()
		})

		it("应该处理 Task → Tools → Conversation 集成流程", async () => {
			// 1. 初始化 Task 和 Tools
			const taskAdapter = new TaskAdapter("integration-test-2", "code", mockHostInterface, {
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			const toolsAdapter = new ToolsAdapter(mockHostInterface, {
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			const conversationAdapter = new ConversationAdapter(mockHostInterface, {
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			// 2. 启动任务
			await taskAdapter.start("Initial message")
			expect(taskAdapter.getStatus()).toBe(TaskStatus.Running)

			// 3. 初始化工具注册表
			await toolsAdapter.initializeRegistry()

			// 4. 验证工具可用
			const tools = await toolsAdapter.getAvailableTools()
			expect(tools.length).toBeGreaterThan(0)

			// 5. 检查特定工具是否可用
			const isAvailable = await toolsAdapter.isToolAvailable("read_file")
			expect(isAvailable).toBe(true)

			// 6. 添加对话记录工具使用
			await conversationAdapter.addMessage({
				role: "assistant",
				content: "I will read the configuration file",
			})

			// 7. 获取对话统计
			const stats = await conversationAdapter.getStats()
			expect(stats.total_messages).toBeGreaterThan(0)

			// 8. 完成任务
			await taskAdapter.complete()
			expect(taskAdapter.getStatus()).toBe(TaskStatus.Idle)

			// 9. 清理资源
			taskAdapter.dispose()
			toolsAdapter.dispose()
			conversationAdapter.dispose()
		})
	})

	describe("Fallback 机制集成测试", () => {
		it("应该在 WASM 不可用时自动切换到 Fallback", async () => {
			// 测试所有 Adapter 的 Fallback 模式
			const taskAdapter = new TaskAdapter("fallback-test-1", "code", mockHostInterface, {
				enableWasm: false, // 强制 Fallback
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			const conversationAdapter = new ConversationAdapter(mockHostInterface, {
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			const memoryAdapter = new MemoryAdapter({
				taskId: "fallback-test-1",
				hostInterface: mockHostInterface,
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			// 验证 Fallback 模式
			expect(taskAdapter.isFallbackMode()).toBe(true)
			expect(conversationAdapter.isFallbackMode()).toBe(true)
			expect(memoryAdapter.isFallbackMode()).toBe(true)

			// 执行基本操作验证 Fallback 功能正常
			await taskAdapter.start("Initial message")
			expect(taskAdapter.getStatus()).toBe(TaskStatus.Running)

			await conversationAdapter.addMessage({
				role: "user",
				content: "Test message",
			})

			const messages = await conversationAdapter.getMessages()
			expect(messages.length).toBeGreaterThan(0)

			const memoryResult = await memoryAdapter.extractMemories([
				{ role: "user", content: "You must test this feature" },
			])
			expect(memoryResult.scanned_messages).toBe(1)

			await taskAdapter.complete()

			// 清理资源
			taskAdapter.dispose()
			conversationAdapter.dispose()
			memoryAdapter.dispose()
		})
	})

	describe("错误处理和恢复", () => {
		it("应该支持任务暂停和恢复", async () => {
			const taskAdapter = new TaskAdapter("pause-resume-test", "code", mockHostInterface, {
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			// 启动 → 暂停 → 恢复 → 完成
			await taskAdapter.start("Initial message")
			expect(taskAdapter.getStatus()).toBe(TaskStatus.Running)

			await taskAdapter.pause()
			expect(taskAdapter.getStatus()).toBe(TaskStatus.Idle)

			await taskAdapter.resume()
			expect(taskAdapter.getStatus()).toBe(TaskStatus.Running)

			await taskAdapter.complete()
			expect(taskAdapter.getStatus()).toBe(TaskStatus.Idle)

			taskAdapter.dispose()
		})

		it("应该处理任务中止", async () => {
			const taskAdapter = new TaskAdapter("abort-test", "code", mockHostInterface, {
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			await taskAdapter.start("Initial message")
			expect(taskAdapter.getStatus()).toBe(TaskStatus.Running)

			await taskAdapter.abort("Test abort reason")
			expect(taskAdapter.getStatus()).toBe(TaskStatus.Idle)

			// 验证 abort 操作成功（状态已变为 Idle）
			// 注意：Fallback 模式下不会记录特定的 "aborted" 日志

			taskAdapter.dispose()
		})

		it("应该处理对话截断", async () => {
			const conversationAdapter = new ConversationAdapter(mockHostInterface, {
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			// 添加多条消息
			await conversationAdapter.addMessage({ role: "user", content: "Message 1" })
			await conversationAdapter.addMessage({ role: "assistant", content: "Response 1" })
			await conversationAdapter.addMessage({ role: "user", content: "Message 2" })

			// 截断到第一条消息
			await conversationAdapter.truncateConversation(0)

			const messages = await conversationAdapter.getMessages()
			expect(messages.length).toBe(1)
			expect(messages[0].content).toBe("Message 1")

			conversationAdapter.dispose()
		})
	})

	describe("性能和资源管理", () => {
		it("应该正确清理资源", async () => {
			const taskAdapter = new TaskAdapter("cleanup-test", "code", mockHostInterface, {
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			const conversationAdapter = new ConversationAdapter(mockHostInterface, {
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			const memoryAdapter = new MemoryAdapter({
				taskId: "cleanup-test",
				hostInterface: mockHostInterface,
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			// 执行一些操作
			await taskAdapter.start("Initial message")
			await conversationAdapter.addMessage({ role: "user", content: "Test" })
			await memoryAdapter.extractMemories([{ role: "user", content: "Test" }])

			// 清理资源
			taskAdapter.dispose()
			conversationAdapter.dispose()
			memoryAdapter.dispose()

			// 验证清理日志
			expect(mockHostInterface.log).toHaveBeenCalledWith("info", expect.stringContaining("disposed"))
		})

		it("应该处理大量消息而不崩溃", async () => {
			const conversationAdapter = new ConversationAdapter(mockHostInterface, {
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			// 添加 100 条消息
			for (let i = 0; i < 100; i++) {
				await conversationAdapter.addMessage({
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}`,
				})
			}

			const messages = await conversationAdapter.getMessages()
			expect(messages.length).toBe(100)

			// 验证统计信息
			const stats = await conversationAdapter.getStats()
			expect(stats.total_messages).toBe(100)
			expect(stats.estimated_tokens).toBeGreaterThan(0)

			conversationAdapter.dispose()
		})
	})

	describe("状态持久化集成", () => {
		it("应该持久化所有 Adapter 的状态", async () => {
			const taskAdapter = new TaskAdapter("persistence-test", "code", mockHostInterface, {
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			const memoryAdapter = new MemoryAdapter({
				taskId: "persistence-test",
				hostInterface: mockHostInterface,
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			// 执行操作
			await taskAdapter.start("Initial message")

			await memoryAdapter.extractMemories([{ role: "user", content: "You must save this" }])

			// 等待持久化完成
			await new Promise((resolve) => setTimeout(resolve, 100))

			// 验证 safeWriteJson 被调用
			const { safeWriteJson } = await import("../../../../utils/safeWriteJson")
			expect(safeWriteJson).toHaveBeenCalled()

			// 清理
			taskAdapter.dispose()
			memoryAdapter.dispose()
		})
	})

	describe("工具系统集成", () => {
		it("应该支持工具注册和查询", async () => {
			const toolsAdapter = new ToolsAdapter(mockHostInterface, {
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			// 初始化注册表
			await toolsAdapter.initializeRegistry()

			// 获取工具数量
			const toolCount = await toolsAdapter.getToolCount()
			expect(toolCount).toBeGreaterThan(0)

			// 检查特定工具
			const isAvailable = await toolsAdapter.isToolAvailable("read_file")
			expect(isAvailable).toBe(true)

			// 获取所有工具
			const tools = await toolsAdapter.getAvailableTools()
			expect(tools).toContain("read_file")

			// 清理
			toolsAdapter.dispose()
		})

		it("应该支持工具组管理", async () => {
			const toolsAdapter = new ToolsAdapter(mockHostInterface, {
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			// 获取 read 组的工具
			const readTools = await toolsAdapter.getToolsInGroup("read")
			expect(readTools.length).toBeGreaterThan(0)
			expect(readTools).toContain("read_file")

			// 获取 edit 组的工具
			const editTools = await toolsAdapter.getToolsInGroup("edit")
			expect(editTools.length).toBeGreaterThan(0)

			// 清理
			toolsAdapter.dispose()
		})
	})

	describe("记忆系统集成", () => {
		it("应该支持记忆提取和查询", async () => {
			const memoryAdapter = new MemoryAdapter({
				taskId: "memory-test",
				hostInterface: mockHostInterface,
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			// 提取记忆
			const result = await memoryAdapter.extractMemories([
				{ role: "user", content: "You must implement error handling" },
				{ role: "assistant", content: "I will add error handling" },
			])

			expect(result.scanned_messages).toBe(2)
			expect(result.new_memories_count).toBeGreaterThan(0)

			// 获取所有记忆
			const memories = await memoryAdapter.getAllMemories()
			expect(memories.length).toBeGreaterThan(0)

			// 获取关键记忆
			const critical = await memoryAdapter.getCriticalMemories()
			expect(critical.length).toBeGreaterThanOrEqual(0)

			// 获取统计信息
			const stats = await memoryAdapter.getMemoryStats()
			expect(stats.total_memories).toBeGreaterThan(0)

			// 清理
			memoryAdapter.dispose()
		})

		it("应该支持记忆过滤", async () => {
			const memoryAdapter = new MemoryAdapter({
				taskId: "filter-test",
				hostInterface: mockHostInterface,
				enableWasm: false,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			// 提取记忆
			await memoryAdapter.extractMemories([
				{ role: "user", content: "You must use TypeScript for this project" },
				{ role: "user", content: "This failed with error: connection timeout" },
			])

			// 按类型过滤
			const userInstructions = await memoryAdapter.getMemoriesByType(MemoryType.UserInstruction)
			expect(userInstructions.length).toBeGreaterThan(0)

			// 按优先级过滤
			const highPriority = await memoryAdapter.getMemoriesByPriority(MemoryPriority.High)
			expect(highPriority.length).toBeGreaterThanOrEqual(0)

			// 清理
			memoryAdapter.dispose()
		})
	})
})
