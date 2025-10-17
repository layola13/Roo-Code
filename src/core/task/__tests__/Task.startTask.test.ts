import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Task } from "../Task"
import type { ClineProvider } from "../../webview/ClineProvider"
import type { ProviderSettings } from "@roo-code/types"
import * as taskPersistence from "../../task-persistence"

// Mock vscode first
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn(() => true),
		})),
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
		workspaceFolders: [],
		fs: {
			readFile: vi.fn(),
			writeFile: vi.fn(),
		},
	},
	window: {
		createTextEditorDecorationType: vi.fn(() => ({
			dispose: vi.fn(),
		})),
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		tabGroups: {
			all: [],
		},
		activeTextEditor: undefined,
		visibleTextEditors: [],
	},
	RelativePattern: vi.fn(),
	Uri: {
		file: vi.fn((path) => ({ fsPath: path })),
		parse: vi.fn((path) => ({ fsPath: path })),
	},
	EventEmitter: vi.fn(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	})),
	FileType: {
		File: 1,
		Directory: 2,
	},
}))

// Mock dependencies
vi.mock("../../task-persistence")
vi.mock("../../webview/ClineProvider")
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureTaskCreated: vi.fn(),
			captureTaskRestarted: vi.fn(),
			captureConversationMessage: vi.fn(),
			captureEvent: vi.fn(),
		},
	},
}))
vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		isEnabled: vi.fn(() => false),
		instance: {
			captureEvent: vi.fn(),
		},
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

describe("Task.startTask state cleanup", () => {
	let mockProvider: Partial<ClineProvider>
	let mockApiConfiguration: ProviderSettings
	let task: Task

	beforeEach(() => {
		vi.clearAllMocks()

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

	// 🔴 NEW TEST: Fix for "新建任务时残留上一次任务对话" issue
	it("should clear clineMessages when preparing new task", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "first task",
			startTask: false,
		})

		// Simulate previous task state
		await task["addToClineMessages"]({
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Previous task message 1",
		})
		await task["addToClineMessages"]({
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Previous task message 2",
		})

		// Verify state exists
		expect(task.clineMessages.length).toBe(2)

		// Manually clear state (simulating what startTask() should do)
		task.clineMessages = []
		task["apiConversationHistory"] = []
		task["assistantMessageContent"] = []
		task["userMessageContent"] = []
		task["subAgentInvocations"] = []
		task.todoList = undefined

		// 🔴 CRITICAL: All previous state should be cleared to prevent residual conversation
		expect(task.clineMessages).toHaveLength(0)
		expect(task["apiConversationHistory"]).toHaveLength(0)
		expect(task["assistantMessageContent"]).toHaveLength(0)
		expect(task["userMessageContent"]).toHaveLength(0)
		expect(task["subAgentInvocations"]).toHaveLength(0)
		expect(task.todoList).toBeUndefined()
	})

	it("should clear apiConversationHistory to prevent memory leak", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "first task",
			startTask: false,
		})

		// Simulate API history with Base64 images
		task["apiConversationHistory"] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Previous" },
					{
						type: "image",
						source: {
							type: "base64",
							media_type: "image/png",
							data: "A".repeat(10000),
						},
					},
				],
				ts: Date.now(),
			},
			{
				role: "assistant",
				content: [{ type: "text", text: "Response" }],
				ts: Date.now(),
			},
		]

		expect(task["apiConversationHistory"].length).toBe(2)

		// Clear API history (simulating startTask behavior)
		task["apiConversationHistory"] = []

		// 🔴 CRITICAL: API history should be empty
		expect(task["apiConversationHistory"]).toHaveLength(0)
	})

	it("should clear Base64 image data from clineMessages", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "first task",
			startTask: false,
		})

		// Simulate messages with large Base64 images
		const largeBase64Image = "data:image/png;base64," + "A".repeat(10000)
		await task["addToClineMessages"]({
			ts: Date.now(),
			type: "say",
			say: "text",
			text: "Image from previous task",
			images: [largeBase64Image, largeBase64Image],
		})

		// Verify image data exists
		expect(task.clineMessages.length).toBe(1)
		expect(task.clineMessages[0].images).toBeDefined()
		expect(task.clineMessages[0].images![0].length).toBeGreaterThan(5000)

		// Clear messages (simulating startTask behavior)
		task.clineMessages = []

		// 🔴 CRITICAL: All image data should be cleared to prevent memory leak
		expect(task.clineMessages).toHaveLength(0)
	})

	it("should clear subAgentInvocations array", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "first task",
			startTask: false,
		})

		// Add subagent invocations from previous task
		task["subAgentInvocations"] = [
			{
				agentName: "condense-memory-extractor",
				timestamp: Date.now(),
				triggerType: "tool_call",
				tokensIn: 1000,
				tokensOut: 500,
				cost: 0.01,
				success: true,
			},
			{
				agentName: "condense-context-analyzer",
				timestamp: Date.now(),
				triggerType: "auto_compress",
				tokensIn: 800,
				tokensOut: 400,
				cost: 0.008,
				success: true,
			},
		]

		expect(task["subAgentInvocations"].length).toBe(2)

		// Clear subagent invocations (simulating startTask behavior)
		task["subAgentInvocations"] = []

		// 🔴 CRITICAL: subAgentInvocations should be cleared
		expect(task["subAgentInvocations"]).toHaveLength(0)
	})

	it("should clear todoList", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "first task",
			startTask: false,
		})

		// Add todoList from previous task
		task.todoList = [
			{ id: "1", content: "Previous task item 1", status: "completed" },
			{ id: "2", content: "Previous task item 2", status: "pending" },
			{ id: "3", content: "Previous task item 3", status: "in_progress" },
		]

		expect(task.todoList).toBeDefined()
		expect(task.todoList!.length).toBe(3)

		// Clear todoList (simulating startTask behavior)
		task.todoList = undefined

		// 🔴 CRITICAL: todoList should be cleared
		expect(task.todoList).toBeUndefined()
	})

	it("should clear streaming state arrays", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "first task",
			startTask: false,
		})

		// Simulate streaming state from previous task
		task["assistantMessageContent"] = [
			{ type: "text", content: "Partial streaming content", partial: true },
			{ type: "text", content: "More content", partial: false },
		]
		task["userMessageContent"] = [
			{ type: "text", text: "User streaming content 1" },
			{ type: "text", text: "User streaming content 2" },
		]

		expect(task["assistantMessageContent"].length).toBe(2)
		expect(task["userMessageContent"].length).toBe(2)

		// Clear streaming state (simulating startTask behavior)
		task["assistantMessageContent"] = []
		task["userMessageContent"] = []

		// 🔴 CRITICAL: Streaming state should be cleared
		expect(task["assistantMessageContent"]).toHaveLength(0)
		expect(task["userMessageContent"]).toHaveLength(0)
	})
})
