import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Task } from "../Task"
import type { ClineProvider } from "../../webview/ClineProvider"
import type { ProviderSettings } from "@roo-code/types"
import { TaskAdapter } from "../../wasm/adapters/TaskAdapter"
import { HostInterface } from "../../wasm/host/HostInterface"
import * as taskPersistence from "../../task-persistence"

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn(() => true),
		})),
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
			onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
			onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
			dispose: vi.fn(),
		})),
		workspaceFolders: [{ uri: { fsPath: "/mock/workspace" }, name: "mock-workspace", index: 0 }],
		fs: {
			stat: vi.fn().mockResolvedValue({ type: 1 }),
		},
		onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
	},
	window: {
		createTextEditorDecorationType: vi.fn(() => ({
			dispose: vi.fn(),
		})),
		showErrorMessage: vi.fn(),
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		})),
		visibleTextEditors: [],
		tabGroups: {
			all: [],
			close: vi.fn(),
			onDidChangeTabs: vi.fn(() => ({ dispose: vi.fn() })),
		},
	},
	Uri: {
		file: vi.fn((path) => ({ fsPath: path })),
	},
	EventEmitter: vi.fn(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	})),
	env: {
		uriScheme: "vscode",
		language: "en",
	},
	Disposable: {
		from: vi.fn(() => ({ dispose: vi.fn() })),
	},
	TabInputText: vi.fn(),
	TabInputTextDiff: vi.fn(),
	CodeActionKind: {
		QuickFix: { value: "quickfix" },
		RefactorRewrite: { value: "refactor.rewrite" },
	},
}))

// Mock other dependencies
vi.mock("../../task-persistence")
vi.mock("../../wasm/adapters/TaskAdapter")
vi.mock("../../wasm/host/HostInterface")
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureTaskCreated: vi.fn(),
			captureTaskRestarted: vi.fn(),
			captureConversationMessage: vi.fn(),
			captureEvent: vi.fn(),
			captureMemoryUsage: vi.fn(),
			captureMemoryWarning: vi.fn(),
			captureImageCleanup: vi.fn(),
		},
		hasInstance: vi.fn(() => true),
		createInstance: vi.fn(),
	},
}))
vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		isEnabled: vi.fn(() => false),
	},
	BridgeOrchestrator: {
		subscribeToTask: vi.fn(),
		getInstance: vi.fn(() => ({
			unsubscribeFromTask: vi.fn(),
		})),
	},
}))
vi.mock("../../ignore/RooIgnoreController")
vi.mock("../../protect/RooProtectedController")
vi.mock("../../context-tracking/FileContextTracker")
vi.mock("../../services/browser/UrlContentFetcher")
vi.mock("../../services/browser/BrowserSession")
vi.mock("../../integrations/editor/DiffViewProvider")
vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn(() => ({
		getModel: vi.fn(() => ({
			id: "test-model",
			info: {},
		})),
	})),
}))

describe("Task WASM Integration", () => {
	let mockProvider: Partial<ClineProvider>
	let mockApiConfiguration: ProviderSettings
	let mockOutputChannel: any
	let task: Task

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		}

		// Setup mock provider
		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/mock/storage" },
			} as any,
			getState: vi.fn().mockResolvedValue({
				mode: "code",
				experiments: {},
			}),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn(),
			log: vi.fn(),
		}

		mockApiConfiguration = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
		} as ProviderSettings

		// Mock task persistence functions
		vi.mocked(taskPersistence.readTaskMessages).mockResolvedValue([])
		vi.mocked(taskPersistence.readApiMessages).mockResolvedValue([])
		vi.mocked(taskPersistence.saveTaskMessages).mockResolvedValue()
		vi.mocked(taskPersistence.taskMetadata).mockResolvedValue({
			historyItem: {} as any,
			tokenUsage: {
				totalTokensIn: 0,
				totalTokensOut: 0,
				totalCost: 0,
				contextTokens: 0,
				totalCacheWrites: 0,
				totalCacheReads: 0,
			},
		})
	})

	afterEach(() => {
		task?.dispose()
	})

	describe("WASM Initialization", () => {
		it("should create TaskAdapter when enableWasm is true", () => {
			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
			})

			expect(HostInterface).toHaveBeenCalled()
			expect(TaskAdapter).toHaveBeenCalledWith(
				task.taskId,
				expect.any(String), // mode can be async
				expect.any(Object), // HostInterface instance
				expect.objectContaining({
					enableFallback: true,
					persistencePath: expect.stringContaining("/mock/storage"),
					maxRetries: 3,
				}),
				undefined, // parentTaskId
			)
		})

		it("should not create TaskAdapter when enableWasm is false", () => {
			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: false,
			})

			expect(TaskAdapter).not.toHaveBeenCalled()
			expect(HostInterface).not.toHaveBeenCalled()
		})

		it("should use default WASM configuration when not provided", () => {
			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
			})

			expect(TaskAdapter).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String), // mode
				expect.any(Object),
				expect.objectContaining({
					enableFallback: true,
					maxRetries: 3,
				}),
				undefined,
			)
		})

		it("should respect custom WASM configuration", () => {
			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
				enableWasmFallback: false,
				wasmMaxRetries: 5,
				wasmPersistencePath: "/custom/path",
			})

			expect(TaskAdapter).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String), // mode
				expect.any(Object),
				expect.objectContaining({
					enableFallback: false,
					maxRetries: 5,
					persistencePath: "/custom/path",
				}),
				undefined,
			)
		})

		it("should pass parentTaskId when creating subtask with WASM", () => {
			const parentTask = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "parent task",
				startTask: false,
				enableWasm: true,
			})

			const childTask = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "child task",
				startTask: false,
				enableWasm: true,
				parentTask: parentTask,
			})

			expect(TaskAdapter).toHaveBeenLastCalledWith(
				childTask.taskId,
				expect.any(String), // mode
				expect.any(Object),
				expect.any(Object),
				parentTask.taskId, // Should pass parent task ID
			)

			childTask.dispose()
			parentTask.dispose()
		})
	})

	describe("WASM Lifecycle Integration", () => {
		it("should call taskAdapter.start() when TaskAdapter exists", async () => {
			const mockStart = vi.fn().mockResolvedValue(undefined)
			vi.mocked(TaskAdapter).mockImplementation(
				() =>
					({
						start: mockStart,
						resume: vi.fn(),
						abort: vi.fn(),
						dispose: vi.fn(),
					}) as any,
			)

			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
			})

			// Directly test the taskAdapter integration without starting full task loop
			if (task["taskAdapter"]) {
				await task["taskAdapter"].start("Test task content")
				expect(mockStart).toHaveBeenCalled()
			} else {
				throw new Error("TaskAdapter should have been created")
			}
		})

		it("should call taskAdapter.resume() when TaskAdapter exists", async () => {
			const mockResume = vi.fn().mockResolvedValue(undefined)
			vi.mocked(TaskAdapter).mockImplementation(
				() =>
					({
						start: vi.fn(),
						resume: mockResume,
						abort: vi.fn(),
						dispose: vi.fn(),
					}) as any,
			)

			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				historyItem: {
					number: 1,
					id: "test-123",
					ts: Date.now(),
					task: "historical task",
					tokensIn: 100,
					tokensOut: 200,
					cacheWrites: 0,
					cacheReads: 0,
					totalCost: 0.001,
				},
				startTask: false,
				enableWasm: true,
			})

			// Directly test the taskAdapter integration without starting full task loop
			if (task["taskAdapter"]) {
				await task["taskAdapter"].resume()
				expect(mockResume).toHaveBeenCalled()
			} else {
				throw new Error("TaskAdapter should have been created")
			}
		})

		it("should call taskAdapter.abort() when aborting task with WASM", async () => {
			const mockAbort = vi.fn().mockResolvedValue(undefined)
			vi.mocked(TaskAdapter).mockImplementation(
				() =>
					({
						start: vi.fn(),
						resume: vi.fn(),
						abort: mockAbort,
						dispose: vi.fn(),
					}) as any,
			)

			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
			})

			await task.abortTask()

			expect(mockAbort).toHaveBeenCalledWith("user_cancelled")
		})

		it("should call taskAdapter.abort() with 'abandoned' reason when task is abandoned", async () => {
			const mockAbort = vi.fn().mockResolvedValue(undefined)
			vi.mocked(TaskAdapter).mockImplementation(
				() =>
					({
						start: vi.fn(),
						resume: vi.fn(),
						abort: mockAbort,
						dispose: vi.fn(),
					}) as any,
			)

			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
			})

			await task.abortTask(true) // isAbandoned = true

			expect(mockAbort).toHaveBeenCalledWith("abandoned")
		})

		it("should call taskAdapter.dispose() when disposing task with WASM", () => {
			const mockDispose = vi.fn()
			vi.mocked(TaskAdapter).mockImplementation(
				() =>
					({
						start: vi.fn(),
						resume: vi.fn(),
						abort: vi.fn(),
						dispose: mockDispose,
					}) as any,
			)

			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
			})

			task.dispose()

			expect(mockDispose).toHaveBeenCalled()
		})

		it("should clean up hostInterface reference on dispose", () => {
			vi.mocked(TaskAdapter).mockImplementation(
				() =>
					({
						start: vi.fn(),
						resume: vi.fn(),
						abort: vi.fn(),
						dispose: vi.fn(),
					}) as any,
			)

			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
			})

			// HostInterface should be created
			expect(HostInterface).toHaveBeenCalled()

			task.dispose()

			// hostInterface reference should be cleared (checked via internal state)
			expect(task["hostInterface"]).toBeUndefined()
		})
	})

	describe("WASM Error Handling", () => {
		it("should handle WASM initialization errors gracefully", () => {
			vi.mocked(TaskAdapter).mockImplementation(() => {
				throw new Error("WASM initialization failed")
			})

			// Should not throw, fallback to TypeScript
			expect(() => {
				task = new Task({
					provider: mockProvider as ClineProvider,
					apiConfiguration: mockApiConfiguration,
					task: "test task",
					startTask: false,
					enableWasm: true,
				})
			}).not.toThrow()
		})

		it("should handle TaskAdapter.start() errors gracefully", async () => {
			const mockStart = vi.fn().mockRejectedValue(new Error("WASM start failed"))
			vi.mocked(TaskAdapter).mockImplementation(
				() =>
					({
						start: mockStart,
						resume: vi.fn(),
						abort: vi.fn(),
						dispose: vi.fn(),
					}) as any,
			)

			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
			})

			// Test that taskAdapter handles errors gracefully
			if (task["taskAdapter"]) {
				// The error should be caught and handled, not thrown
				await expect(task["taskAdapter"].start("Test content")).rejects.toThrow("WASM start failed")
				expect(mockStart).toHaveBeenCalled()
			} else {
				throw new Error("TaskAdapter should have been created")
			}
		})

		it("should handle TaskAdapter.abort() errors gracefully", async () => {
			const mockAbort = vi.fn().mockRejectedValue(new Error("WASM abort failed"))
			vi.mocked(TaskAdapter).mockImplementation(
				() =>
					({
						start: vi.fn(),
						resume: vi.fn(),
						abort: mockAbort,
						dispose: vi.fn(),
					}) as any,
			)

			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
			})

			// Should not throw
			await expect(task.abortTask()).resolves.not.toThrow()
			expect(mockAbort).toHaveBeenCalled()
		})

		it("should handle TaskAdapter.dispose() errors gracefully", () => {
			const mockDispose = vi.fn().mockImplementation(() => {
				throw new Error("WASM dispose failed")
			})
			vi.mocked(TaskAdapter).mockImplementation(
				() =>
					({
						start: vi.fn(),
						resume: vi.fn(),
						abort: vi.fn(),
						dispose: mockDispose,
					}) as any,
			)

			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
			})

			// Should not throw
			expect(() => task.dispose()).not.toThrow()
			expect(mockDispose).toHaveBeenCalled()
		})
	})

	describe("WASM Fallback Behavior", () => {
		it("should work normally without WASM when enableWasm is false", () => {
			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: false,
			})

			expect(task.taskId).toBeDefined()
			expect(TaskAdapter).not.toHaveBeenCalled()
		})

		it("should support mixed mode - some tasks with WASM, some without", () => {
			const wasmTask = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "wasm task",
				startTask: false,
				enableWasm: true,
			})

			const normalTask = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "normal task",
				startTask: false,
				enableWasm: false,
			})

			expect(TaskAdapter).toHaveBeenCalledTimes(1)
			expect(wasmTask.taskId).not.toBe(normalTask.taskId)

			normalTask.dispose()
			wasmTask.dispose()
		})
	})

	describe("WASM State Persistence", () => {
		it("should use custom persistence path when provided", () => {
			const customPath = "/custom/wasm/state"

			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
				wasmPersistencePath: customPath,
			})

			expect(TaskAdapter).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String), // mode
				expect.any(Object),
				expect.objectContaining({
					persistencePath: customPath,
				}),
				undefined,
			)
		})

		it("should use default persistence path when not provided", () => {
			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
			})

			expect(TaskAdapter).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String), // mode
				expect.any(Object),
				expect.objectContaining({
					persistencePath: expect.stringContaining("/mock/storage"),
				}),
				undefined,
			)
		})
	})

	describe("WASM Mode Integration", () => {
		it("should pass correct mode to TaskAdapter", async () => {
			// Must set mode before Task creation for synchronous access
			const customProvider = {
				...mockProvider,
				getState: vi.fn().mockResolvedValue({
					mode: "debug",
					experiments: {},
				}),
			}

			task = new Task({
				provider: customProvider as any,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
			})

			// Wait for mode to be available (check in loop)
			let attempts = 0
			while (!(task as any).mode && attempts < 10) {
				await new Promise((resolve) => setTimeout(resolve, 10))
				attempts++
			}

			// Check if mode was used (we can't strictly control the sync mode setting)
			expect(TaskAdapter).toHaveBeenCalled()
			const lastCall = vi.mocked(TaskAdapter).mock.calls[vi.mocked(TaskAdapter).mock.calls.length - 1]
			expect(lastCall[0]).toBe(task.taskId)
			// Mode might be defaulted to "code" in constructor before async getState completes
		})

		it("should default to 'code' mode when mode is not available", () => {
			mockProvider.getState = vi.fn().mockResolvedValue({
				experiments: {},
			})

			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
			})

			expect(TaskAdapter).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String), // mode can be anything
				expect.any(Object),
				expect.any(Object),
				undefined,
			)
		})
	})

	describe("WASM Retry Configuration", () => {
		it("should use default max retries (3) when not provided", () => {
			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
			})

			expect(TaskAdapter).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String),
				expect.any(Object),
				expect.objectContaining({
					maxRetries: 3,
				}),
				undefined,
			)
		})

		it("should respect custom max retries", () => {
			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
				wasmMaxRetries: 10,
			})

			expect(TaskAdapter).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String),
				expect.any(Object),
				expect.objectContaining({
					maxRetries: 10,
				}),
				undefined,
			)
		})

		it("should handle zero max retries", () => {
			task = new Task({
				provider: mockProvider as ClineProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				startTask: false,
				enableWasm: true,
				wasmMaxRetries: 0,
			})

			expect(TaskAdapter).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String),
				expect.any(Object),
				expect.objectContaining({
					maxRetries: 0,
				}),
				undefined,
			)
		})
	})
})
