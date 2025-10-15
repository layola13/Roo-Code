/**
 * TaskAdapter单元测试
 *
 * 测试覆盖：
 * 1. 基本生命周期操作（start, pause, resume, abort, complete）
 * 2. WASM模式和Fallback模式切换
 * 3. 错误处理与重试机制
 * 4. 状态同步与持久化
 * 5. 状态加载
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { TaskAdapter, TaskAdapterConfig } from "../TaskAdapter"
import { HostInterface } from "../../host/HostInterface"
import { TaskStatus } from "@roo-code/types"
import { Task as WasmTask, TaskStatus as WasmTaskStatus } from "../../../../../rust-wasm/wasm-dist/roo_core_wasm"

// Mock WASM模块
vi.mock("../../../../../rust-wasm/wasm-dist/roo_core_wasm", () => ({
	Task: vi.fn().mockImplementation((mode: string, parentTaskId?: string) => {
		const mockTask = {
			task_id: "wasm-task-123",
			status: "0", // WasmTaskStatus.Idle (WASM bindings使用字符串)
			free: vi.fn(),
			instance_id: "test-instance",
			task_mode: mode,
			is_paused: false,
			is_aborted: false,
			get_subtasks: vi.fn().mockReturnValue([]),
			get_error: vi.fn().mockReturnValue(null),
			[Symbol.dispose]: vi.fn(),
			start: vi.fn().mockImplementation(async function (this: any) {
				this.status = "1" // Running
			}),
			pause: vi.fn().mockImplementation(async function (this: any) {
				this.status = "2" // Paused
			}),
			resume: vi.fn().mockImplementation(async function (this: any) {
				this.status = "1" // Running
			}),
			abort: vi.fn().mockImplementation(async function (this: any) {
				this.status = "4" // Failed
			}),
			complete: vi.fn().mockImplementation(async function (this: any) {
				this.status = "3" // Completed
			}),
		}
		return mockTask
	}),
	TaskStatus: {
		Idle: 0,
		Running: 1,
		Paused: 2,
		Completed: 3,
		Failed: 4,
		Aborted: 5,
	},
}))

// Mock safeWriteJson
vi.mock("../../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn().mockResolvedValue(undefined),
}))

// Mock HostInterface
const createMockHostInterface = (): HostInterface => {
	return {
		log: vi.fn(),
		fileExists: vi.fn().mockResolvedValue(false),
		readJson: vi.fn(),
		writeJson: vi.fn(),
	} as any
}

describe("TaskAdapter", () => {
	let hostInterface: HostInterface
	let config: TaskAdapterConfig

	beforeEach(() => {
		hostInterface = createMockHostInterface()
		config = {
			enableWasm: true,
			enableFallback: true,
			maxRetries: 3,
		}
		vi.clearAllMocks()
	})

	describe("初始化", () => {
		it("应该成功创建TaskAdapter实例", () => {
			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)
			expect(adapter).toBeDefined()
			expect(adapter.getStatus()).toBe(TaskStatus.Idle)
		})

		it("应该在WASM模式下初始化WASM Task", () => {
			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)
			expect(WasmTask).toHaveBeenCalledWith("code", undefined)
			expect(hostInterface.log).toHaveBeenCalledWith("info", expect.stringContaining("WASM Task initialized"))
		})

		it("应该支持父任务ID", () => {
			const adapter = new TaskAdapter("task-1", "code", hostInterface, config, "parent-task-1")
			expect(WasmTask).toHaveBeenCalledWith("code", "parent-task-1")
		})

		it("应该在禁用WASM时跳过WASM初始化", () => {
			const adapter = new TaskAdapter("task-1", "code", hostInterface, {
				...config,
				enableWasm: false,
			})
			expect(WasmTask).not.toHaveBeenCalled()
		})
	})

	describe("任务生命周期 - WASM模式", () => {
		it("应该成功启动任务", async () => {
			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)
			await adapter.start("Initial message")

			expect(adapter.getStatus()).toBe(TaskStatus.Running)
			expect(hostInterface.log).toHaveBeenCalledWith("info", expect.stringContaining("Task started"))
		})

		it("应该成功暂停任务", async () => {
			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)
			await adapter.start("Initial message")
			await adapter.pause()

			expect(adapter.getStatus()).toBe(TaskStatus.Idle)
			expect(hostInterface.log).toHaveBeenCalledWith("info", expect.stringContaining("Task paused"))
		})

		it("应该成功恢复任务", async () => {
			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)
			await adapter.start("Initial message")
			await adapter.pause()
			await adapter.resume()

			expect(adapter.getStatus()).toBe(TaskStatus.Running)
			expect(hostInterface.log).toHaveBeenCalledWith("info", expect.stringContaining("Task resumed"))
		})

		it("应该成功中止任务", async () => {
			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)
			await adapter.start("Initial message")
			await adapter.abort("User cancelled")

			expect(adapter.getStatus()).toBe(TaskStatus.Idle)
			expect(hostInterface.log).toHaveBeenCalledWith("warn", expect.stringContaining("Task aborted"))
		})

		it("应该成功完成任务", async () => {
			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)
			await adapter.start("Initial message")
			await adapter.complete()

			expect(adapter.getStatus()).toBe(TaskStatus.Idle)
			expect(hostInterface.log).toHaveBeenCalledWith("info", expect.stringContaining("Task completed"))
		})
	})

	describe("Fallback模式", () => {
		it("应该在WASM初始化失败时切换到Fallback模式", () => {
			// Mock WASM构造函数抛出错误
			const originalImpl = vi.mocked(WasmTask).getMockImplementation()
			vi.mocked(WasmTask).mockImplementationOnce(() => {
				throw new Error("WASM initialization failed")
			})

			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)
			expect(adapter.isFallbackMode()).toBe(true)
			expect(hostInterface.log).toHaveBeenCalledWith(
				"error",
				expect.stringContaining("WASM error during initialization"),
			)

			// 恢复原实现
			if (originalImpl) {
				vi.mocked(WasmTask).mockImplementation(originalImpl)
			}
		})

		it("应该在Fallback模式下成功启动任务", async () => {
			const originalImpl = vi.mocked(WasmTask).getMockImplementation()
			vi.mocked(WasmTask).mockImplementationOnce(() => {
				throw new Error("WASM initialization failed")
			})

			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)
			await adapter.start("Initial message")

			expect(adapter.getStatus()).toBe(TaskStatus.Running)
			expect(hostInterface.log).toHaveBeenCalledWith(
				"info",
				expect.stringContaining("Starting task in fallback mode"),
			)

			// 恢复原实现
			if (originalImpl) {
				vi.mocked(WasmTask).mockImplementation(originalImpl)
			}
		})

		it("应该在达到最大重试次数后切换到Fallback模式", async () => {
			const originalImpl = vi.mocked(WasmTask).getMockImplementation()

			// Mock WASM方法抛出错误
			const mockTask = {
				task_id: "wasm-task-123",
				status: "0",
				free: vi.fn(),
				instance_id: "test-instance",
				task_mode: "code",
				is_paused: false,
				is_aborted: false,
				get_subtasks: vi.fn().mockReturnValue([]),
				get_error: vi.fn().mockReturnValue(null),
				[Symbol.dispose]: vi.fn(),
				start: vi.fn().mockRejectedValue(new Error("WASM error")),
				pause: vi.fn().mockRejectedValue(new Error("WASM error")),
				resume: vi.fn().mockRejectedValue(new Error("WASM error")),
				abort: vi.fn(),
				complete: vi.fn(),
			}
			vi.mocked(WasmTask).mockImplementation(() => mockTask as any)

			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)

			// 第一次错误
			await adapter.start("Initial message")
			expect(adapter.isFallbackMode()).toBe(false)
			expect(adapter.getErrorCount()).toBe(1)

			// 第二次错误
			await adapter.pause()
			expect(adapter.isFallbackMode()).toBe(false)
			expect(adapter.getErrorCount()).toBe(2)

			// 第三次错误 - 应该切换到Fallback模式
			await adapter.resume()
			expect(adapter.isFallbackMode()).toBe(true)
			expect(adapter.getErrorCount()).toBe(3)
			expect(hostInterface.log).toHaveBeenCalledWith(
				"warn",
				expect.stringContaining("Switching to fallback mode"),
			)

			// 恢复原实现
			if (originalImpl) {
				vi.mocked(WasmTask).mockImplementation(originalImpl)
			}
		})

		it("应该在禁用Fallback时抛出错误", async () => {
			const originalImpl = vi.mocked(WasmTask).getMockImplementation()

			const mockTask = {
				task_id: "wasm-task-123",
				status: "0",
				free: vi.fn(),
				instance_id: "test-instance",
				task_mode: "code",
				is_paused: false,
				is_aborted: false,
				get_subtasks: vi.fn().mockReturnValue([]),
				get_error: vi.fn().mockReturnValue(null),
				[Symbol.dispose]: vi.fn(),
				start: vi.fn().mockRejectedValue(new Error("WASM error")),
				pause: vi.fn(),
				resume: vi.fn(),
				abort: vi.fn(),
				complete: vi.fn(),
			}
			vi.mocked(WasmTask).mockImplementation(() => mockTask as any)

			const adapter = new TaskAdapter("task-1", "code", hostInterface, {
				...config,
				enableFallback: false,
			})

			await expect(adapter.start("Initial message")).rejects.toThrow("WASM error")

			// 恢复原实现
			if (originalImpl) {
				vi.mocked(WasmTask).mockImplementation(originalImpl)
			}
		})
	})

	describe("状态管理", () => {
		it("应该返回当前任务状态", async () => {
			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)
			expect(adapter.getStatus()).toBe(TaskStatus.Idle)

			await adapter.start("Initial message")
			expect(adapter.getStatus()).toBe(TaskStatus.Running)
		})

		it("应该正确映射WASM状态到TypeScript状态", async () => {
			const mockTask = {
				task_id: "wasm-task-123",
				status: "1", // WasmTaskStatus.Running
				free: vi.fn(),
				instance_id: "test-instance",
				task_mode: "code",
				is_paused: false,
				is_aborted: false,
				get_subtasks: vi.fn().mockReturnValue([]),
				get_error: vi.fn().mockReturnValue(null),
				[Symbol.dispose]: vi.fn(),
				start: vi.fn().mockResolvedValue(undefined),
				pause: vi.fn().mockImplementation(function (this: any) {
					this.status = "2" // WasmTaskStatus.Paused
					return Promise.resolve()
				}),
				resume: vi.fn(),
				abort: vi.fn(),
				complete: vi.fn(),
			}
			vi.mocked(WasmTask).mockImplementation(() => mockTask as any)

			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)
			await adapter.start("Initial message")

			mockTask.status = "1" // Running
			expect(adapter.getStatus()).toBe(TaskStatus.Running)
		})

		it("应该跟踪错误计数", async () => {
			const mockTask = {
				task_id: "wasm-task-123",
				status: "0",
				free: vi.fn(),
				instance_id: "test-instance",
				task_mode: "code",
				is_paused: false,
				is_aborted: false,
				get_subtasks: vi.fn().mockReturnValue([]),
				get_error: vi.fn().mockReturnValue(null),
				[Symbol.dispose]: vi.fn(),
				start: vi.fn().mockRejectedValue(new Error("Error 1")),
				pause: vi.fn().mockRejectedValue(new Error("Error 2")),
				resume: vi.fn(),
				abort: vi.fn(),
				complete: vi.fn(),
			}
			vi.mocked(WasmTask).mockImplementation(() => mockTask as any)

			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)

			await adapter.start("Initial message")
			expect(adapter.getErrorCount()).toBe(1)

			await adapter.pause()
			expect(adapter.getErrorCount()).toBe(2)
		})

		it("应该能够重置错误计数", async () => {
			const mockTask = {
				task_id: "wasm-task-123",
				status: "0",
				free: vi.fn(),
				instance_id: "test-instance",
				task_mode: "code",
				is_paused: false,
				is_aborted: false,
				get_subtasks: vi.fn().mockReturnValue([]),
				get_error: vi.fn().mockReturnValue(null),
				[Symbol.dispose]: vi.fn(),
				start: vi.fn().mockRejectedValue(new Error("Error")),
				pause: vi.fn(),
				resume: vi.fn(),
				abort: vi.fn(),
				complete: vi.fn(),
			}
			vi.mocked(WasmTask).mockImplementation(() => mockTask as any)

			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)

			await adapter.start("Initial message")
			expect(adapter.getErrorCount()).toBe(1)

			adapter.resetErrorCount()
			expect(adapter.getErrorCount()).toBe(0)
		})
	})

	describe("状态持久化", () => {
		it("应该在配置持久化路径时同步状态", async () => {
			const { safeWriteJson } = await import("../../../../utils/safeWriteJson")

			// 确保Mock处于正确状态
			vi.mocked(WasmTask).mockImplementation((mode: string, parentTaskId?: string | null) => {
				const mockTask = {
					task_id: "wasm-task-123",
					status: "0", // WasmTaskStatus.Idle
					free: vi.fn(),
					instance_id: "test-instance",
					task_mode: mode,
					is_paused: false,
					is_aborted: false,
					get_subtasks: vi.fn().mockReturnValue([]),
					get_error: vi.fn().mockReturnValue(null),
					[Symbol.dispose]: vi.fn(),
					start: vi.fn().mockImplementation(async function (this: any) {
						this.status = "1" // Running
					}),
					pause: vi.fn().mockImplementation(async function (this: any) {
						this.status = "2" // Paused
					}),
					resume: vi.fn().mockImplementation(async function (this: any) {
						this.status = "1" // Running
					}),
					abort: vi.fn().mockImplementation(async function (this: any) {
						this.status = "4" // Failed
					}),
					complete: vi.fn().mockImplementation(async function (this: any) {
						this.status = "3" // Completed
					}),
				}
				return mockTask
			})

			const adapter = new TaskAdapter("task-1", "code", hostInterface, {
				...config,
				persistencePath: "/tmp/tasks",
			})

			await adapter.start("Initial message")

			expect(safeWriteJson).toHaveBeenCalledWith(
				"/tmp/tasks/task-1-state.json",
				expect.objectContaining({
					taskId: "task-1",
					status: TaskStatus.Running,
					mode: "wasm",
					metadata: expect.objectContaining({
						errorCount: 0,
					}),
				}),
			)
		})

		it("应该在Fallback模式下同步正确的模式标识", async () => {
			const { safeWriteJson } = await import("../../../../utils/safeWriteJson")

			vi.mocked(WasmTask).mockImplementationOnce(() => {
				throw new Error("WASM initialization failed")
			})

			const adapter = new TaskAdapter("task-1", "code", hostInterface, {
				...config,
				persistencePath: "/tmp/tasks",
			})

			await adapter.start("Initial message")

			expect(safeWriteJson).toHaveBeenCalledWith(
				"/tmp/tasks/task-1-state.json",
				expect.objectContaining({
					mode: "fallback",
				}),
			)
		})

		it("应该在状态同步失败时记录错误但不影响主流程", async () => {
			const { safeWriteJson } = await import("../../../../utils/safeWriteJson")
			vi.mocked(safeWriteJson).mockRejectedValueOnce(new Error("Write failed"))

			const adapter = new TaskAdapter("task-1", "code", hostInterface, {
				...config,
				persistencePath: "/tmp/tasks",
			})

			// 不应该抛出错误
			await expect(adapter.start("Initial message")).resolves.not.toThrow()
			expect(hostInterface.log).toHaveBeenCalledWith("error", expect.stringContaining("Failed to sync state"))
		})

		it("应该能够加载已保存的状态", async () => {
			vi.mocked(hostInterface.fileExists).mockResolvedValue(true)
			vi.mocked(hostInterface.readJson).mockResolvedValue({
				taskId: "task-1",
				status: TaskStatus.Running,
				mode: "wasm",
				metadata: {
					createdAt: Date.now(),
					updatedAt: Date.now(),
					errorCount: 0,
				},
			})

			const state = await TaskAdapter.loadState("task-1", "/tmp/tasks", hostInterface)

			expect(state).toBeDefined()
			expect(state?.taskId).toBe("task-1")
			expect(state?.status).toBe(TaskStatus.Running)
			expect(hostInterface.fileExists).toHaveBeenCalledWith("/tmp/tasks/task-1-state.json")
		})

		it("应该在状态文件不存在时返回null", async () => {
			vi.mocked(hostInterface.fileExists).mockResolvedValue(false)

			const state = await TaskAdapter.loadState("task-1", "/tmp/tasks", hostInterface)

			expect(state).toBeNull()
			expect(hostInterface.fileExists).toHaveBeenCalledWith("/tmp/tasks/task-1-state.json")
		})

		it("应该在加载状态失败时返回null并记录错误", async () => {
			vi.mocked(hostInterface.fileExists).mockResolvedValue(true)
			vi.mocked(hostInterface.readJson).mockRejectedValue(new Error("Read failed"))

			const state = await TaskAdapter.loadState("task-1", "/tmp/tasks", hostInterface)

			expect(state).toBeNull()
			expect(hostInterface.log).toHaveBeenCalledWith("error", expect.stringContaining("Failed to load state"))
		})
	})

	describe("资源清理", () => {
		it("应该成功清理资源", () => {
			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)

			expect(() => adapter.dispose()).not.toThrow()
			expect(hostInterface.log).toHaveBeenCalledWith("info", expect.stringContaining("Task disposed"))
		})

		it("应该在清理失败时记录错误", () => {
			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)

			// 不应该抛出错误
			expect(() => adapter.dispose()).not.toThrow()
		})
	})

	describe("边缘情况", () => {
		it("应该处理未初始化WASM Task的情况", async () => {
			const adapter = new TaskAdapter("task-1", "code", hostInterface, {
				...config,
				enableWasm: false,
			})

			// 应该能够正常操作
			await expect(adapter.start("Initial message")).resolves.not.toThrow()
			await expect(adapter.pause()).resolves.not.toThrow()
		})

		it("应该处理连续多次操作", async () => {
			const adapter = new TaskAdapter("task-1", "code", hostInterface, config)

			await adapter.start("Initial message")
			await adapter.pause()
			await adapter.resume()
			await adapter.pause()
			await adapter.resume()
			await adapter.complete()

			expect(adapter.getStatus()).toBe(TaskStatus.Idle)
		})

		it("应该在没有持久化路径时跳过状态同步", async () => {
			const { safeWriteJson } = await import("../../../../utils/safeWriteJson")

			const adapter = new TaskAdapter("task-1", "code", hostInterface, {
				...config,
				persistencePath: undefined,
			})

			await adapter.start("Initial message")

			expect(safeWriteJson).not.toHaveBeenCalled()
		})
	})
})
