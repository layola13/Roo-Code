import { describe, it, expect, vi, beforeEach } from "vitest"
import { Task } from "../Task"

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureTaskCreated: vi.fn(),
			captureTaskRestarted: vi.fn(),
			captureConversationMessage: vi.fn(),
			captureLlmCompletion: vi.fn(),
			captureMemoryUsage: vi.fn(),
		},
	},
}))

// Mock dependencies
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn(() => false),
		})),
		workspaceFolders: [{ uri: { fsPath: "/test/workspace" } }],
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
	},
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		createTextEditorDecorationType: vi.fn(() => ({
			dispose: vi.fn(),
		})),
	},
	Uri: {
		file: vi.fn((path) => ({ fsPath: path })),
	},
	RelativePattern: vi.fn(),
	EventEmitter: vi.fn(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	})),
}))

describe("Task.buildEnhancedTaskDescription", () => {
	let mockProvider: any
	let mockContext: any

	beforeEach(() => {
		mockContext = {
			subscriptions: [],
			extensionPath: "/test/path",
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
			},
			globalStorageUri: {
				fsPath: "/test/storage",
			},
		}

		mockProvider = {
			postMessageToWebview: vi.fn(),
			postStateToWebview: vi.fn(),
			getState: vi.fn().mockResolvedValue({}),
			context: mockContext,
		}
	})

	it("should return only task description for root task (no parent context)", () => {
		const rootTask = new Task({
			provider: mockProvider,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "claude-sonnet-4",
			} as any,
			task: "Root task: Build a web application",
			startTask: false,
		})

		const description = (rootTask as any).buildEnhancedTaskDescription()

		// Should contain task description
		expect(description).toContain("Root task: Build a web application")

		// Should NOT contain parent/root context headers (because it's a root task)
		expect(description).not.toContain("## Root Task Context")
		expect(description).not.toContain("## Parent Task Context")
		expect(description).not.toContain("## Current Subtask")
	})

	it("should include root task context for single-level subtask", () => {
		const rootTask = new Task({
			provider: mockProvider,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "claude-sonnet-4",
			} as any,
			task: "Root task: Build a web application",
			startTask: false,
		})

		const childTask = new Task({
			provider: mockProvider,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "claude-sonnet-4",
			} as any,
			task: "Subtask: Create login page",
			parentTask: rootTask,
			startTask: false,
		})

		const description = (childTask as any).buildEnhancedTaskDescription()

		// Should contain root task context (parent task's description)
		expect(description).toContain("## Root Task Context")
		expect(description).toContain("Root task: Build a web application")

		// Should mark as subtask
		expect(description).toContain("## Current Subtask")
		expect(description).toContain("Subtask: Create login page")

		// Should NOT contain parent task context (since parent IS the root)
		expect(description).not.toContain("## Parent Task Context")
	})

	it("should include both root and parent context for multi-level subtask", () => {
		const rootTask = new Task({
			provider: mockProvider,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "claude-sonnet-4",
			} as any,
			task: "Root task: Build a web application",
			startTask: false,
		})

		const parentTask = new Task({
			provider: mockProvider,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "claude-sonnet-4",
			} as any,
			task: "Parent task: Implement authentication module",
			parentTask: rootTask,
			startTask: false,
		})

		// Set rootTask explicitly for parentTask
		;(parentTask as any).rootTask = rootTask

		const childTask = new Task({
			provider: mockProvider,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "claude-sonnet-4",
			} as any,
			task: "Child task: Add password validation",
			parentTask: parentTask,
			startTask: false,
		})

		// Set rootTask explicitly for childTask
		;(childTask as any).rootTask = rootTask

		const description = (childTask as any).buildEnhancedTaskDescription()

		// Should contain root task context
		expect(description).toContain("## Root Task Context")
		expect(description).toContain("Root task: Build a web application")

		// Should contain parent task context (since parent !== root)
		expect(description).toContain("## Parent Task Context")
		expect(description).toContain("Parent task: Implement authentication module")

		// Should mark as subtask
		expect(description).toContain("## Current Subtask")
		expect(description).toContain("Child task: Add password validation")

		// Verify order
		const rootIndex = description.indexOf("## Root Task Context")
		const parentIndex = description.indexOf("## Parent Task Context")
		const currentIndex = description.indexOf("## Current Subtask")

		expect(rootIndex).toBeGreaterThan(-1)
		expect(parentIndex).toBeGreaterThan(rootIndex)
		expect(currentIndex).toBeGreaterThan(parentIndex)
	})

	it("should include context summary with user feedback", () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "claude-sonnet-4",
			} as any,
			task: "Test task",
			startTask: false,
		})

		// Add user feedback messages
		task.clineMessages.push(
			{ ts: Date.now(), type: "say", say: "user_feedback", text: "Please add error handling" },
			{ ts: Date.now(), type: "say", say: "user_feedback", text: "Also implement logging" },
		)

		const description = (task as any).buildEnhancedTaskDescription()

		// Should contain the task description
		expect(description).toContain("Test task")

		// buildContextSummary will include user feedback if present
		// The format is "### User Requirements and Feedback:"
		if (task.clineMessages.some((m) => m.say === "user_feedback")) {
			expect(
				description.includes("User") ||
					description.includes("Feedback") ||
					description.includes("error handling"),
			).toBe(true)
		}
	})

	it("should include completion attempts in context summary", () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "claude-sonnet-4",
			} as any,
			task: "Test task",
			startTask: false,
		})

		// Add completion attempt messages
		task.clineMessages.push(
			{ ts: Date.now(), type: "say", say: "completion_result", text: "First attempt" },
			{ ts: Date.now(), type: "say", say: "completion_result", text: "Second attempt" },
		)

		const description = (task as any).buildEnhancedTaskDescription()

		// buildContextSummary includes completion attempts
		expect(description).toContain("Test task")
	})

	it("should handle empty task description", () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "claude-sonnet-4",
			} as any,
			task: "",
			startTask: false,
		})

		const description = (task as any).buildEnhancedTaskDescription()

		// Should still return a string (even if empty or just context summary)
		expect(typeof description).toBe("string")
	})

	it("should be called by invokeJudge method", async () => {
		const task = new Task({
			provider: mockProvider,
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "claude-sonnet-4",
			} as any,
			task: "Test task for judge",
			startTask: false,
		})

		// Spy on buildEnhancedTaskDescription
		const spy = vi.spyOn(task as any, "buildEnhancedTaskDescription")

		// Mock JudgeService
		const mockJudgeService = {
			judgeCompletion: vi.fn().mockResolvedValue({
				approved: true,
				reasoning: "Task completed",
				missingItems: [],
				suggestions: [],
				hasCriticalIssues: false,
			}),
			setApiHandler: vi.fn(),
		}

		// Set mock judge service
		;(task as any).judgeService = mockJudgeService

		// Mock getJudgeConfig
		vi.spyOn(task as any, "getJudgeConfig").mockResolvedValue({
			enabled: true,
			mode: "always",
			allowUserOverride: true,
			blockOnCriticalIssues: false,
		})

		// Call invokeJudge
		await task.invokeJudge("Test completion result")

		// Verify buildEnhancedTaskDescription was called
		expect(spy).toHaveBeenCalled()

		// Verify judge service was called with enhanced description
		expect(mockJudgeService.judgeCompletion).toHaveBeenCalled()
		const callArgs = mockJudgeService.judgeCompletion.mock.calls[0]
		expect(callArgs[0].originalTask).toContain("Test task for judge")
	})
})
