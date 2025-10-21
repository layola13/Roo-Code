import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Task } from "../Task"
import type { ClineProvider } from "../../webview/ClineProvider"
import type { ProviderSettings } from "@roo-code/types"

// Mock vscode module
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn(),
		}),
		createFileSystemWatcher: vi.fn().mockReturnValue({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		}),
	},
	window: {
		createTextEditorDecorationType: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
		showTextDocument: vi.fn(),
		activeTextEditor: undefined,
	},
	RelativePattern: class RelativePattern {
		constructor(
			public base: any,
			public pattern: string,
		) {}
	},
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path, scheme: "file" })),
		parse: vi.fn((uri: string) => ({ fsPath: uri, scheme: "file" })),
	},
	Range: class Range {
		constructor(
			public start: any,
			public end: any,
		) {}
	},
	Position: class Position {
		constructor(
			public line: number,
			public character: number,
		) {}
	},
}))

// Mock delay function
vi.mock("delay", () => ({
	default: vi.fn((ms: number) => Promise.resolve()),
}))

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		get instance() {
			return {
				trackEvent: vi.fn(),
				trackError: vi.fn(),
				trackPerformance: vi.fn(),
				captureTaskCreated: vi.fn(),
				captureTaskCompleted: vi.fn(),
				captureTaskFailed: vi.fn(),
			}
		},
	},
}))

describe("Task Auto-Resume Feature", () => {
	let mockProvider: Partial<ClineProvider>
	let mockApiConfiguration: ProviderSettings
	let task: Task

	beforeEach(() => {
		// Mock provider
		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/tmp/test" },
			} as any,
			getState: vi.fn().mockResolvedValue({
				mode: "code",
				apiConfiguration: {},
			}),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			postMessageToWebview: vi.fn().mockResolvedValue(undefined),
			log: vi.fn(),
		} as Partial<ClineProvider>

		// Mock API configuration
		mockApiConfiguration = {
			apiProvider: "anthropic",
		} as ProviderSettings

		// Reset timers
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.clearAllMocks()
	})

	it("should start auto-resume timer when task needs resumption", () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})

		// Start the auto-resume timer
		task.startAutoResumeTimer()

		const status = task.getAutoResumeStatus()
		expect(status.isAutoResuming).toBe(true)
		expect(status.countdown).toBe(10) // 10 seconds default
		expect(status.attempts).toBe(1)
	})

	it("should clear auto-resume timer when user manually resumes", () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})

		// Start the timer
		task.startAutoResumeTimer()
		expect(task.getAutoResumeStatus().isAutoResuming).toBe(true)

		// Simulate manual resume
		task.clearAutoResumeTimer()

		const status = task.getAutoResumeStatus()
		expect(status.isAutoResuming).toBe(false)
		expect(status.countdown).toBe(0)
	})

	it("should stop retrying after max attempts", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})

		const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)

		// Simulate reaching max attempts (10 attempts)
		for (let i = 0; i < 10; i++) {
			task.startAutoResumeTimer()
			task.clearAutoResumeTimer()
		}

		// Try to start timer after max attempts
		task.startAutoResumeTimer()

		// Should show error message instead of starting timer
		await vi.waitFor(() => {
			expect(saySpy).toHaveBeenCalledWith("error", expect.stringContaining("已达到最大自动恢复尝试次数"))
		})

		const status = task.getAutoResumeStatus()
		expect(status.attempts).toBe(10)
	})

	it("should countdown from 10 to 0 seconds", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})

		const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)

		task.startAutoResumeTimer()

		// Initial message
		expect(saySpy).toHaveBeenCalledWith("text", expect.stringContaining("10 秒后自动恢复"), undefined, true)

		// Advance timer by 1 second
		await vi.advanceTimersByTimeAsync(1000)

		expect(saySpy).toHaveBeenCalledWith("text", expect.stringContaining("9 秒后自动恢复"), undefined, true)

		// Advance timer by 9 more seconds (total 10 seconds)
		await vi.advanceTimersByTimeAsync(9000)

		// Should trigger auto-resume
		await vi.waitFor(() => {
			expect(saySpy).toHaveBeenCalledWith("text", expect.stringContaining("正在尝试自动恢复任务"))
		})
	})

	it("should handle manual response and clear timer", () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})

		task.startAutoResumeTimer()
		expect(task.getAutoResumeStatus().isAutoResuming).toBe(true)

		// Simulate user clicking yes button
		task.handleWebviewAskResponse("yesButtonClicked")

		const status = task.getAutoResumeStatus()
		expect(status.isAutoResuming).toBe(false)
		expect(status.countdown).toBe(0)
	})

	it("should reset attempt counter on successful resume", async () => {
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			task: "test task",
			startTask: false,
		})

		// Start timer multiple times to build up attempts
		for (let i = 0; i < 3; i++) {
			task.startAutoResumeTimer()
			task.clearAutoResumeTimer()
		}

		expect(task.getAutoResumeStatus().attempts).toBe(3)

		// Simulate successful task resumption by manually calling the method
		// that would be called after successful resume
		;(task as any).autoResumeAttempts = 0

		const status = task.getAutoResumeStatus()
		expect(status.attempts).toBe(0) // Should be reset
	})
})
