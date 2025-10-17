import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { MemoryAdapter, MemoryType, MemoryPriority } from "../MemoryAdapter"
import type { HostInterface } from "../../host/HostInterface"
import * as fs from "fs/promises"
import * as path from "path"

// Mock safeWriteJson
vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn(async (filePath: string, data: any) => {
		await fs.mkdir(path.dirname(filePath), { recursive: true })
		await fs.writeFile(filePath, JSON.stringify(data, null, 2))
	}),
}))

// Mock WASM模块
vi.mock("../../../../wasm-dist/memory/memory_wasm", () => ({
	MemoryManager: vi.fn().mockImplementation(() => ({
		extractMemories: vi.fn(),
		getAllMemories: vi.fn(() => []),
		getCriticalMemories: vi.fn(() => []),
		getMemoriesByPriority: vi.fn(() => []),
		getMemoriesByType: vi.fn(() => []),
		recordMemoryAccess: vi.fn(),
		generateMemorySummary: vi.fn(() => ""),
		applyMemoryAging: vi.fn(),
		pruneLowPriorityMemories: vi.fn(),
		getMemoryStats: vi.fn(() => ({
			total_memories: 0,
			by_type: {},
			by_priority: {},
			pending_memories: 0,
			persisted_memories: 0,
		})),
	})),
}))

describe("MemoryAdapter", () => {
	let mockHostInterface: HostInterface
	let testPersistencePath: string

	beforeEach(() => {
		testPersistencePath = path.join(process.cwd(), "test-temp", `memory-test-${Date.now()}`)

		mockHostInterface = {
			log: vi.fn(),
			readFile: vi.fn(),
			writeFile: vi.fn(),
			fileExists: vi.fn(),
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

	describe("初始化", () => {
		it("应该正确初始化适配器", async () => {
			const adapter = new MemoryAdapter({
				taskId: "test-task-1",
				hostInterface: mockHostInterface,
				enableFallback: true,
				persistencePath: testPersistencePath,
			})

			expect(adapter).toBeDefined()
			expect(adapter.getErrorCount()).toBeGreaterThanOrEqual(0)
		})

		it("应该正确初始化Fallback模式", async () => {
			const adapter = new MemoryAdapter({
				taskId: "test-task-2",
				hostInterface: mockHostInterface,
				enableFallback: true,
				enableWasm: false,
				persistencePath: testPersistencePath,
			})

			expect(adapter).toBeDefined()
			expect(adapter.isFallbackMode()).toBe(true)
		})
	})

	describe("记忆提取", () => {
		it("应该从消息中提取用户指令", async () => {
			const adapter = new MemoryAdapter({
				taskId: "test-task-4",
				hostInterface: mockHostInterface,
				enableFallback: true,
				enableWasm: false,
				persistencePath: testPersistencePath,
			})

			const messages = [
				{
					role: "user" as const,
					content: "You must implement error handling for all API calls",
				},
				{
					role: "assistant" as const,
					content: "I will add try-catch blocks",
				},
			]

			const result = await adapter.extractMemories(messages)

			expect(result).toBeDefined()
			expect(result.scanned_messages).toBe(2)
			expect(result.new_memories_count).toBeGreaterThan(0)
			expect(result.memories).toBeInstanceOf(Array)

			const userInstructions = result.memories.filter((m) => m.type === MemoryType.UserInstruction)
			expect(userInstructions.length).toBeGreaterThan(0)
		})

		it("应该从消息中提取错误信息", async () => {
			const adapter = new MemoryAdapter({
				taskId: "test-task-5",
				hostInterface: mockHostInterface,
				enableFallback: true,
				enableWasm: false,
				persistencePath: testPersistencePath,
			})

			const messages = [
				{
					role: "assistant" as const,
					content: "Error: Failed to connect to database",
				},
			]

			const result = await adapter.extractMemories(messages)

			expect(result.new_memories_count).toBeGreaterThan(0)

			const errorMemories = result.memories.filter((m) => m.type === MemoryType.ImportantError)
			expect(errorMemories.length).toBeGreaterThan(0)
		})
	})

	describe("记忆管理", () => {
		it("应该获取所有记忆", async () => {
			const adapter = new MemoryAdapter({
				taskId: "test-task-8",
				hostInterface: mockHostInterface,
				enableFallback: true,
				enableWasm: false,
				persistencePath: testPersistencePath,
			})

			await adapter.extractMemories([
				{
					role: "user" as const,
					content: "You must implement tests",
				},
			])

			const memories = await adapter.getAllMemories()

			expect(memories).toBeInstanceOf(Array)
			expect(memories.length).toBeGreaterThan(0)
		})

		it("应该按优先级过滤记忆", async () => {
			const adapter = new MemoryAdapter({
				taskId: "test-task-10",
				hostInterface: mockHostInterface,
				enableFallback: true,
				enableWasm: false,
				persistencePath: testPersistencePath,
			})

			await adapter.extractMemories([
				{
					role: "user" as const,
					content: "You must implement tests",
				},
			])

			const highPriorityMemories = await adapter.getMemoriesByPriority(MemoryPriority.High)

			expect(highPriorityMemories).toBeInstanceOf(Array)
			highPriorityMemories.forEach((m) => {
				expect(m.priority).toBe(MemoryPriority.High)
			})
		})
	})

	describe("记忆访问", () => {
		it("应该记录访问并更新计数", async () => {
			const adapter = new MemoryAdapter({
				taskId: "test-task-12",
				hostInterface: mockHostInterface,
				enableFallback: true,
				enableWasm: false,
				persistencePath: testPersistencePath,
			})

			const result = await adapter.extractMemories([
				{
					role: "user" as const,
					content: "You must implement tests",
				},
			])

			const memoryId = result.memories[0]?.id
			if (memoryId) {
				await adapter.recordMemoryAccess(memoryId)

				const memories = await adapter.getAllMemories()
				const accessedMemory = memories.find((m) => m.id === memoryId)

				expect(accessedMemory).toBeDefined()
				expect(accessedMemory!.access_count).toBeGreaterThan(0)
			}
		})
	})

	describe("记忆摘要", () => {
		it("应该生成记忆摘要", async () => {
			const adapter = new MemoryAdapter({
				taskId: "test-task-14",
				hostInterface: mockHostInterface,
				enableFallback: true,
				enableWasm: false,
				persistencePath: testPersistencePath,
			})

			await adapter.extractMemories([
				{
					role: "user" as const,
					content: "You must implement comprehensive error handling",
				},
			])

			const summary = await adapter.generateMemorySummary()

			expect(summary).toBeDefined()
			expect(typeof summary).toBe("string")
		})
	})

	describe("记忆统计", () => {
		it("应该返回正确的统计信息", async () => {
			const adapter = new MemoryAdapter({
				taskId: "test-task-20",
				hostInterface: mockHostInterface,
				enableFallback: true,
				enableWasm: false,
				persistencePath: testPersistencePath,
			})

			await adapter.extractMemories([{ role: "user" as const, content: "You must implement tests" }])

			const stats = await adapter.getMemoryStats()

			expect(stats).toBeDefined()
			expect(stats.total_memories).toBeGreaterThan(0)
			expect(stats.by_type).toBeDefined()
			expect(stats.by_priority).toBeDefined()
		})
	})

	describe("Fallback模式", () => {
		it("Fallback模式应该正常工作", async () => {
			const adapter = new MemoryAdapter({
				taskId: "test-task-26",
				hostInterface: mockHostInterface,
				enableFallback: true,
				enableWasm: false,
				persistencePath: testPersistencePath,
			})

			expect(adapter.isFallbackMode()).toBe(true)

			const result = await adapter.extractMemories([
				{ role: "user" as const, content: "You must implement tests" },
			])

			expect(result).toBeDefined()
			expect(result.memories).toBeInstanceOf(Array)
		})
	})

	describe("资源清理", () => {
		it("应该正确清理资源", async () => {
			const adapter = new MemoryAdapter({
				taskId: "test-task-31",
				hostInterface: mockHostInterface,
				enableFallback: true,
				enableWasm: false,
				persistencePath: testPersistencePath,
			})

			await adapter.extractMemories([{ role: "user" as const, content: "Test" }])

			adapter.dispose()

			expect(mockHostInterface.log).toHaveBeenCalledWith("info", expect.stringContaining("disposed"))
		})
	})
})
