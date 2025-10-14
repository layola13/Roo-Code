/**
 * WASM Integration Tests
 *
 * 测试WASM模块的加载、初始化和基本功能
 */

import { describe, it, expect, beforeAll } from "vitest"
import { WasmLoader, initializeWasm } from "../WasmLoader"
import { createHostInterface } from "../host/HostInterface"
import { createRooWasmAPI } from "../RooWasmAPI"
import { MemoryPriority, MemoryType, TaskStatus } from "../../../../rust-wasm/wasm-dist/roo_core_wasm"

describe("WASM Integration Tests", () => {
	let wasmLoader: WasmLoader

	beforeAll(async () => {
		// 初始化WASM模块
		wasmLoader = await initializeWasm()
	})

	describe("WasmLoader", () => {
		it("should initialize successfully", () => {
			expect(wasmLoader).toBeDefined()
			expect(wasmLoader.isInitialized()).toBe(true)
		})

		it("should pass health check", () => {
			expect(wasmLoader.healthCheck()).toBe(true)
		})

		it("should return module info", () => {
			const info = wasmLoader.getModuleInfo()
			expect(info).toBeDefined()
			expect(info.name).toBe("roo-core-wasm")
			expect(info.version).toBe("0.1.0")
			expect(info.modules).toContain("api_integration")
			expect(info.modules).toContain("task_engine")
			expect(info.modules).toContain("tools")
			expect(info.modules).toContain("conversation")
			expect(info.modules).toContain("memory")
		})

		it("should return singleton instance", () => {
			const instance1 = WasmLoader.getInstance()
			const instance2 = WasmLoader.getInstance()
			expect(instance1).toBe(instance2)
		})
	})

	describe("RooWasmAPI", () => {
		let api: ReturnType<typeof createRooWasmAPI> extends Promise<infer T> ? T : never

		beforeAll(async () => {
			const hostInterface = createHostInterface()
			api = await createRooWasmAPI(hostInterface)
		})

		it("should create API successfully", () => {
			expect(api).toBeDefined()
			expect(api.task).toBeDefined()
			expect(api.conversation).toBeDefined()
			expect(api.memory).toBeDefined()
			expect(api.tools).toBeDefined()
		})

		it("should pass health check", () => {
			expect(api.healthCheck()).toBe(true)
		})

		describe("Task API", () => {
			it("should create a task", () => {
				const task = api.task.createTask("code")
				expect(task).toBeDefined()
				expect(task.task_mode).toBe("code")
				expect(task.task_id).toBeDefined()
			})

			it("should create a subtask", () => {
				const parentTask = api.task.createTask("architect")
				const childTask = api.task.createTask("code", parentTask.task_id)
				expect(childTask).toBeDefined()
				expect(childTask.task_mode).toBe("code")
			})
		})

		describe("Conversation API", () => {
			it("should create conversation manager", () => {
				const manager = api.conversation.createManager()
				expect(manager).toBeDefined()
			})

			it("should add and retrieve messages", () => {
				const manager = api.conversation.createManager()
				const message = {
					role: "user",
					content: "Hello, world!",
					timestamp: Date.now(),
				}

				api.conversation.addMessage(manager, message)
				const messages = api.conversation.getMessages(manager)
				expect(messages).toBeDefined()
				expect(Array.isArray(messages)).toBe(true)
			})

			it("should get conversation stats", () => {
				const manager = api.conversation.createManager()
				const stats = api.conversation.getStats(manager)
				expect(stats).toBeDefined()
				expect(stats.message_count).toBeGreaterThanOrEqual(0)
			})
		})

		describe("Memory API", () => {
			it("should create memory manager", () => {
				const config = {
					max_memories: 100,
					aging_enabled: true,
				}
				const manager = api.memory.createManager("test-task-id", config)
				expect(manager).toBeDefined()
			})

			it("should get all memories", () => {
				const config = { max_memories: 100 }
				const manager = api.memory.createManager("test-task-id", config)
				const memories = api.memory.getAllMemories(manager)
				expect(memories).toBeDefined()
				expect(Array.isArray(memories)).toBe(true)
			})

			it("should get critical memories", () => {
				const config = { max_memories: 100 }
				const manager = api.memory.createManager("test-task-id", config)
				const memories = api.memory.getCriticalMemories(manager)
				expect(memories).toBeDefined()
				expect(Array.isArray(memories)).toBe(true)
			})

			it("should filter memories by priority", () => {
				const config = { max_memories: 100 }
				const manager = api.memory.createManager("test-task-id", config)
				const memories = api.memory.getMemoriesByPriority(manager, MemoryPriority.High)
				expect(memories).toBeDefined()
				expect(Array.isArray(memories)).toBe(true)
			})

			it("should filter memories by type", () => {
				const config = { max_memories: 100 }
				const manager = api.memory.createManager("test-task-id", config)
				const memories = api.memory.getMemoriesByType(manager, MemoryType.UserInstruction)
				expect(memories).toBeDefined()
				expect(Array.isArray(memories)).toBe(true)
			})

			it("should generate memory summary", () => {
				const config = { max_memories: 100 }
				const manager = api.memory.createManager("test-task-id", config)
				const summary = api.memory.generateSummary(manager, Date.now())
				expect(summary).toBeDefined()
				expect(typeof summary).toBe("string")
			})

			it("should get memory stats", () => {
				const config = { max_memories: 100 }
				const manager = api.memory.createManager("test-task-id", config)
				const stats = api.memory.getStats(manager, Date.now())
				expect(stats).toBeDefined()
				expect(stats.total_memories).toBeGreaterThanOrEqual(0)
			})

			it("should serialize and deserialize memory manager", () => {
				const config = { max_memories: 100 }
				const manager = api.memory.createManager("test-task-id", config)
				const serialized = api.memory.serialize(manager)
				expect(serialized).toBeDefined()
				expect(typeof serialized).toBe("string")

				const deserialized = api.memory.deserialize(serialized)
				expect(deserialized).toBeDefined()
			})
		})

		describe("Tools API", () => {
			it("should create tool registry", () => {
				const registry = api.tools.createRegistry()
				expect(registry).toBeDefined()
			})

			it("should get available tools", () => {
				const registry = api.tools.createRegistry()
				const tools = api.tools.getAvailableTools(registry)
				expect(tools).toBeDefined()
				expect(Array.isArray(tools)).toBe(true)
				expect(tools.length).toBeGreaterThan(0)
			})

			it("should register and unregister tools", () => {
				const registry = api.tools.createRegistry()

				// Register a tool
				const result = api.tools.registerTool(registry, "read_file")
				expect(result).toBeDefined()

				// Unregister the tool
				const unregisterResult = api.tools.unregisterTool(registry, "read_file")
				expect(unregisterResult).toBeDefined()
			})
		})
	})

	describe("Host Interface", () => {
		it("should create host interface", () => {
			const host = createHostInterface()
			expect(host).toBeDefined()
		})

		it("should log messages", () => {
			const host = createHostInterface()
			expect(() => {
				host.log("info", "Test message")
				host.log("warn", "Test warning")
				host.log("error", "Test error")
			}).not.toThrow()
		})
	})
})
