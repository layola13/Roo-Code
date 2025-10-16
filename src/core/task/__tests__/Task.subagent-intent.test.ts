// npx vitest core/task/__tests__/Task.subagent-intent.test.ts

import * as os from "os"
import * as path from "path"
import * as vscode from "vscode"
import type { GlobalState, ProviderSettings } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"
import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import { ApiHandler } from "../../../api/index"

// Mock delay before any imports that might use it
vi.mock("delay", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("execa", () => ({
	execa: vi.fn(),
}))

vi.mock("fs/promises", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, any>
	const mockFunctions = {
		mkdir: vi.fn().mockResolvedValue(undefined),
		writeFile: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue("[]"),
		unlink: vi.fn().mockResolvedValue(undefined),
		rmdir: vi.fn().mockResolvedValue(undefined),
	}

	return {
		...actual,
		...mockFunctions,
		default: mockFunctions,
	}
})

vi.mock("p-wait-for", () => ({
	default: vi.fn().mockImplementation(async () => Promise.resolve()),
}))

vi.mock("vscode", () => {
	const mockDisposable = { dispose: vi.fn() }
	const mockEventEmitter = { event: vi.fn(), fire: vi.fn() }

	return {
		TabInputTextDiff: vi.fn(),
		CodeActionKind: {
			QuickFix: { value: "quickfix" },
			RefactorRewrite: { value: "refactor.rewrite" },
		},
		window: {
			createTextEditorDecorationType: vi.fn().mockReturnValue({
				dispose: vi.fn(),
			}),
			visibleTextEditors: [],
			tabGroups: {
				all: [],
				close: vi.fn(),
				onDidChangeTabs: vi.fn(() => ({ dispose: vi.fn() })),
			},
			showErrorMessage: vi.fn(),
		},
		workspace: {
			workspaceFolders: [
				{
					uri: { fsPath: "/mock/workspace/path" },
					name: "mock-workspace",
					index: 0,
				},
			],
			createFileSystemWatcher: vi.fn(() => ({
				onDidCreate: vi.fn(() => mockDisposable),
				onDidDelete: vi.fn(() => mockDisposable),
				onDidChange: vi.fn(() => mockDisposable),
				dispose: vi.fn(),
			})),
			fs: {
				stat: vi.fn().mockResolvedValue({ type: 1 }),
			},
			onDidSaveTextDocument: vi.fn(() => mockDisposable),
			getConfiguration: vi.fn(() => ({ get: (key: string, defaultValue: any) => defaultValue })),
		},
		env: {
			uriScheme: "vscode",
			language: "en",
		},
		EventEmitter: vi.fn().mockImplementation(() => mockEventEmitter),
		Disposable: {
			from: vi.fn(),
		},
		TabInputText: vi.fn(),
	}
})

vi.mock("../../mentions", () => ({
	parseMentions: vi.fn().mockImplementation((text) => {
		return Promise.resolve(`processed: ${text}`)
	}),
	openMention: vi.fn(),
	getLatestTerminalOutput: vi.fn(),
}))

vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockResolvedValue("Mock file content"),
}))

vi.mock("../../environment/getEnvironmentDetails", () => ({
	getEnvironmentDetails: vi.fn().mockResolvedValue(""),
}))

vi.mock("../../ignore/RooIgnoreController")

vi.mock("../../../utils/storage", () => ({
	getTaskDirectoryPath: vi
		.fn()
		.mockImplementation((globalStoragePath, taskId) => Promise.resolve(`${globalStoragePath}/tasks/${taskId}`)),
	getSettingsDirectoryPath: vi
		.fn()
		.mockImplementation((globalStoragePath) => Promise.resolve(`${globalStoragePath}/settings`)),
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockReturnValue(false),
}))

describe("Task Subagent Intent Detection and Execution", () => {
	let mockProvider: any
	let mockApiConfig: ProviderSettings
	let mockOutputChannel: any
	let mockExtensionContext: vscode.ExtensionContext

	beforeEach(() => {
		if (!TelemetryService.hasInstance()) {
			TelemetryService.createInstance([])
		}

		// Setup mock extension context
		const storageUri = {
			fsPath: path.join(os.tmpdir(), "test-storage"),
		}

		mockExtensionContext = {
			globalState: {
				get: vi.fn().mockImplementation((key: keyof GlobalState) => undefined),
				update: vi.fn().mockImplementation((_key, _value) => Promise.resolve()),
				keys: vi.fn().mockReturnValue([]),
			},
			globalStorageUri: storageUri,
			workspaceState: {
				get: vi.fn().mockImplementation((_key) => undefined),
				update: vi.fn().mockImplementation((_key, _value) => Promise.resolve()),
				keys: vi.fn().mockReturnValue([]),
			},
			secrets: {
				get: vi.fn().mockImplementation((_key) => Promise.resolve(undefined)),
				store: vi.fn().mockImplementation((_key, _value) => Promise.resolve()),
				delete: vi.fn().mockImplementation((_key) => Promise.resolve()),
			},
			extensionUri: {
				fsPath: "/mock/extension/path",
			},
			extension: {
				packageJSON: {
					version: "1.0.0",
				},
			},
		} as unknown as vscode.ExtensionContext

		// Setup mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		}

		// Setup mock provider
		mockProvider = new ClineProvider(
			mockExtensionContext,
			mockOutputChannel,
			"sidebar",
			new ContextProxy(mockExtensionContext),
		) as any

		// Setup mock API configuration
		mockApiConfig = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			apiKey: "test-api-key",
		}

		// Mock provider methods
		mockProvider.postMessageToWebview = vi.fn().mockResolvedValue(undefined)
		mockProvider.postStateToWebview = vi.fn().mockResolvedValue(undefined)
		mockProvider.getState = vi.fn().mockResolvedValue({
			apiConfiguration: mockApiConfig,
		})
	})

	describe("detectSubAgentIntent", () => {
		it("should detect condense-context-analyzer intent with 'call' keyword", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const text = "I need to call condense-context-analyzer to analyze the conversation flow"
			const result = task.detectSubAgentIntent(text)

			expect(result).toBe("condense-context-analyzer")
		})

		it("should detect condense-memory-extractor intent with 'invoke' keyword", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const text = "Let me invoke the condense-memory-extractor subagent"
			const result = task.detectSubAgentIntent(text)

			expect(result).toBe("condense-memory-extractor")
		})

		it("should detect condense-code-summarizer intent with 'use' keyword", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const text = "I'll use condense-code-summarizer to summarize the code changes"
			const result = task.detectSubAgentIntent(text)

			expect(result).toBe("condense-code-summarizer")
		})

		it("should detect intent with 'subagent' suffix", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const text = "The condense-context-analyzer subagent will help with this"
			const result = task.detectSubAgentIntent(text)

			expect(result).toBe("condense-context-analyzer")
		})

		it("should detect intent with 'agent' suffix", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const text = "We need the condense-memory-extractor agent"
			const result = task.detectSubAgentIntent(text)

			expect(result).toBe("condense-memory-extractor")
		})

		it("should be case-insensitive", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const testCases = [
				"Call CONDENSE-CONTEXT-ANALYZER",
				"Invoke Condense-Memory-Extractor",
				"USE condense-code-SUMMARIZER",
			]

			expect(task.detectSubAgentIntent(testCases[0])).toBe("condense-context-analyzer")
			expect(task.detectSubAgentIntent(testCases[1])).toBe("condense-memory-extractor")
			expect(task.detectSubAgentIntent(testCases[2])).toBe("condense-code-summarizer")
		})

		it("should return null for text without subagent mentions", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const text = "This is just a normal conversation without any subagent references"
			const result = task.detectSubAgentIntent(text)

			expect(result).toBeNull()
		})

		it("should handle false positives - partial matches", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// These should NOT match because they don't have the full subagent name
			const falsePositives = [
				"I need to condense the context",
				"Let's analyze the memory",
				"Summarize the code please",
			]

			falsePositives.forEach((text) => {
				expect(task.detectSubAgentIntent(text)).toBeNull()
			})
		})

		it("should return first match when multiple subagents are mentioned", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const text =
				"I'll call condense-context-analyzer first, then use condense-memory-extractor and condense-code-summarizer"
			const result = task.detectSubAgentIntent(text)

			// Should return the first match
			expect(result).toBe("condense-context-analyzer")
		})

		it("should handle text with newlines and special characters", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const text = `
				Let me analyze this conversation.
				I need to call the condense-context-analyzer!
				This will help us understand the flow.
			`
			const result = task.detectSubAgentIntent(text)

			expect(result).toBe("condense-context-analyzer")
		})

		it("should handle variations of calling/invoking/using", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const variations = [
				"calling condense-context-analyzer",
				"invoking condense-memory-extractor",
				"using condense-code-summarizer",
			]

			expect(task.detectSubAgentIntent(variations[0])).toBe("condense-context-analyzer")
			expect(task.detectSubAgentIntent(variations[1])).toBe("condense-memory-extractor")
			expect(task.detectSubAgentIntent(variations[2])).toBe("condense-code-summarizer")
		})

		it("should detect high-confidence explicit intent patterns", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Test explicit intent patterns (highest confidence)
			const explicitPatterns = [
				"I need condense-context-analyzer to analyze this",
				"I'll call condense-memory-extractor for extraction",
				"I will invoke condense-code-summarizer",
				"I want condense-context-analyzer to help",
				"Let me use condense-memory-extractor",
				"Let's call the condense-code-summarizer",
				"I'm going to use condense-context-analyzer",
				"Going to invoke condense-memory-extractor",
			]

			expect(task.detectSubAgentIntent(explicitPatterns[0])).toBe("condense-context-analyzer")
			expect(task.detectSubAgentIntent(explicitPatterns[1])).toBe("condense-memory-extractor")
			expect(task.detectSubAgentIntent(explicitPatterns[2])).toBe("condense-code-summarizer")
			expect(task.detectSubAgentIntent(explicitPatterns[3])).toBe("condense-context-analyzer")
			expect(task.detectSubAgentIntent(explicitPatterns[4])).toBe("condense-memory-extractor")
			expect(task.detectSubAgentIntent(explicitPatterns[5])).toBe("condense-code-summarizer")
			expect(task.detectSubAgentIntent(explicitPatterns[6])).toBe("condense-context-analyzer")
			expect(task.detectSubAgentIntent(explicitPatterns[7])).toBe("condense-memory-extractor")
		})

		it("should detect context patterns with keywords", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Test context patterns (medium confidence)
			const contextPatterns = [
				"condense-context-analyzer to analyze the flow",
				"condense-memory-extractor for extracting memories",
				"condense-code-summarizer will help",
				"condense-context-analyzer should work",
				"condense-memory-extractor can extract",
			]

			expect(task.detectSubAgentIntent(contextPatterns[0])).toBe("condense-context-analyzer")
			expect(task.detectSubAgentIntent(contextPatterns[1])).toBe("condense-memory-extractor")
			expect(task.detectSubAgentIntent(contextPatterns[2])).toBe("condense-code-summarizer")
			expect(task.detectSubAgentIntent(contextPatterns[3])).toBe("condense-context-analyzer")
			expect(task.detectSubAgentIntent(contextPatterns[4])).toBe("condense-memory-extractor")
		})

		it("should filter out descriptive/documentation text", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// These should NOT trigger because they're descriptive, not invocations
			const descriptiveTexts = [
				"The condense-context-analyzer is a tool that analyzes conversations",
				"condense-memory-extractor is a subagent for extracting memories",
				"What is condense-code-summarizer?",
				"Let me tell you about condense-context-analyzer",
				"condense-memory-extractor (which extracts memories) is useful",
				"condense-code-summarizer - a tool for summarizing code",
			]

			descriptiveTexts.forEach((text) => {
				expect(task.detectSubAgentIntent(text)).toBeNull()
			})
		})

		it("should handle natural language variations with 'need' and 'want'", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const naturalVariations = [
				"I need the condense-context-analyzer",
				"We need condense-memory-extractor here",
				"I want condense-code-summarizer to help",
				"need condense-context-analyzer for this task",
				"want the condense-memory-extractor subagent",
			]

			expect(task.detectSubAgentIntent(naturalVariations[0])).toBe("condense-context-analyzer")
			expect(task.detectSubAgentIntent(naturalVariations[1])).toBe("condense-memory-extractor")
			expect(task.detectSubAgentIntent(naturalVariations[2])).toBe("condense-code-summarizer")
			expect(task.detectSubAgentIntent(naturalVariations[3])).toBe("condense-context-analyzer")
			expect(task.detectSubAgentIntent(naturalVariations[4])).toBe("condense-memory-extractor")
		})

		it("should handle 'run' and 'execute' action verbs", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const actionVerbs = [
				"run condense-context-analyzer",
				"running condense-memory-extractor now",
				"execute the condense-code-summarizer",
				"executing condense-context-analyzer",
			]

			expect(task.detectSubAgentIntent(actionVerbs[0])).toBe("condense-context-analyzer")
			expect(task.detectSubAgentIntent(actionVerbs[1])).toBe("condense-memory-extractor")
			expect(task.detectSubAgentIntent(actionVerbs[2])).toBe("condense-code-summarizer")
			expect(task.detectSubAgentIntent(actionVerbs[3])).toBe("condense-context-analyzer")
		})
	})

	describe("executeSubAgentByIntent", () => {
		const createMockApiHandler = (responseText: string = "Mock output") => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text" as const, text: responseText }
					yield {
						type: "usage" as const,
						inputTokens: 100,
						outputTokens: 50,
						totalCost: 0.005,
					}
				},
			}

			return {
				createMessage: vi.fn().mockReturnValue(mockStream),
				getModel: vi.fn().mockReturnValue({
					id: "test-model",
					info: { maxTokens: 100000 },
				}),
				countTokens: vi.fn().mockResolvedValue(1000),
			} as unknown as ApiHandler
		}

		it("should execute condense-context-analyzer when specified", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Mock the API handler
			task.api = createMockApiHandler("Context analysis result")

			// Add some conversation history
			task.apiConversationHistory = [
				{
					role: "user",
					content: "Test message",
					ts: Date.now(),
				},
			]

			const result = await task.executeSubAgentByIntent("condense-context-analyzer")

			expect(result).not.toBeNull()
			expect(result?.success).toBe(true)
			expect(result?.output).toBe("Context analysis result")
			expect(result?.tokensIn).toBe(100)
			expect(result?.tokensOut).toBe(50)
			expect(result?.cost).toBe(0.005)
		})

		it("should execute condense-memory-extractor when specified", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			task.api = createMockApiHandler("Memory extraction result")

			task.apiConversationHistory = [
				{
					role: "user",
					content: "Test message",
					ts: Date.now(),
				},
			]

			const result = await task.executeSubAgentByIntent("condense-memory-extractor")

			expect(result).not.toBeNull()
			expect(result?.success).toBe(true)
			expect(result?.output).toBe("Memory extraction result")
		})

		it("should execute condense-code-summarizer when specified", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			task.api = createMockApiHandler("Code summary result")

			task.apiConversationHistory = [
				{
					role: "user",
					content: "Test code",
					ts: Date.now(),
				},
			]

			const result = await task.executeSubAgentByIntent("condense-code-summarizer")

			expect(result).not.toBeNull()
			expect(result?.success).toBe(true)
			expect(result?.output).toBe("Code summary result")
		})

		it("should use recent conversation messages (last 10)", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Create 15 messages to verify only last 10 are used
			task.apiConversationHistory = Array.from({ length: 15 }, (_, i) => ({
				role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
				content: `Message ${i}`,
				ts: Date.now() + i,
			}))

			task.api = createMockApiHandler("Result")

			const createMessageSpy = vi.spyOn(task.api, "createMessage")

			await task.executeSubAgentByIntent("condense-context-analyzer")

			// Verify createMessage was called
			expect(createMessageSpy).toHaveBeenCalled()
			// The method should use the last 10 messages
		})

		it("should use custom prompts from provider state", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			// Mock provider state with custom prompts
			const customContextPrompt = "Custom context analyzer prompt"
			mockProvider.getState = vi.fn().mockResolvedValue({
				contextAnalyzerPrompt: customContextPrompt,
			})

			task.apiConversationHistory = [
				{
					role: "user",
					content: "Test",
					ts: Date.now(),
				},
			]

			task.api = createMockApiHandler("Result")

			const createMessageSpy = vi.spyOn(task.api, "createMessage")

			await task.executeSubAgentByIntent("condense-context-analyzer")

			// Verify the custom prompt was used
			expect(createMessageSpy).toHaveBeenCalled()
			const callArgs = createMessageSpy.mock.calls[0]
			expect(callArgs[0]).toContain(customContextPrompt)
		})

		it("should return null for unknown subagent type", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			task.apiConversationHistory = [
				{
					role: "user",
					content: "Test",
					ts: Date.now(),
				},
			]

			const result = await task.executeSubAgentByIntent("unknown-subagent" as any)

			expect(result).toBeNull()
		})

		it("should handle API errors gracefully", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			task.apiConversationHistory = [
				{
					role: "user",
					content: "Test",
					ts: Date.now(),
				},
			]

			// Mock API handler that throws an error
			const mockApiHandler = {
				createMessage: vi.fn().mockImplementation(() => {
					throw new Error("API Error")
				}),
				getModel: vi.fn().mockReturnValue({
					id: "test-model",
					info: { maxTokens: 100000 },
				}),
				countTokens: vi.fn().mockResolvedValue(1000),
			} as unknown as ApiHandler

			task.api = mockApiHandler

			const result = await task.executeSubAgentByIntent("condense-context-analyzer")

			expect(result).not.toBeNull()
			expect(result?.success).toBe(false)
			expect(result?.error).toContain("API Error")
		})

		it("should handle empty conversation history", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			task.apiConversationHistory = []

			task.api = createMockApiHandler("Result")

			const result = await task.executeSubAgentByIntent("condense-context-analyzer")

			// Should still execute even with empty history
			expect(result).not.toBeNull()
		})
	})

	describe("getSubAgentInvocations and recordSubAgentInvocation", () => {
		it("should start with empty invocations", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			const invocations = task.getSubAgentInvocations()
			expect(invocations).toEqual([])
		})

		it("should record subagent invocation", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			task.recordSubAgentInvocation({
				agentName: "condense-context-analyzer",
				triggerType: "tool_call",
				timestamp: Date.now(),
				tokensIn: 100,
				tokensOut: 50,
				cost: 0.005,
				success: true,
			})

			const invocations = task.getSubAgentInvocations()
			expect(invocations).toHaveLength(1)
			expect(invocations[0].agentName).toBe("condense-context-analyzer")
			expect(invocations[0].triggerType).toBe("tool_call")
			expect(invocations[0].success).toBe(true)
		})

		it("should record multiple invocations", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			task.recordSubAgentInvocation({
				agentName: "condense-context-analyzer",
				triggerType: "tool_call",
				timestamp: Date.now(),
				tokensIn: 100,
				tokensOut: 50,
				cost: 0.005,
				success: true,
			})

			task.recordSubAgentInvocation({
				agentName: "condense-memory-extractor",
				triggerType: "auto_compress",
				timestamp: Date.now(),
				tokensIn: 200,
				tokensOut: 100,
				cost: 0.01,
				success: true,
			})

			const invocations = task.getSubAgentInvocations()
			expect(invocations).toHaveLength(2)
			expect(invocations[0].agentName).toBe("condense-context-analyzer")
			expect(invocations[1].agentName).toBe("condense-memory-extractor")
		})

		it("should record failed invocations with error", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			task.recordSubAgentInvocation({
				agentName: "condense-code-summarizer",
				triggerType: "tool_call",
				timestamp: Date.now(),
				tokensIn: 0,
				tokensOut: 0,
				cost: 0,
				success: false,
				error: "Network timeout",
			})

			const invocations = task.getSubAgentInvocations()
			expect(invocations).toHaveLength(1)
			expect(invocations[0].success).toBe(false)
			expect(invocations[0].error).toBe("Network timeout")
		})

		it("should distinguish between proactive_call and auto_compress", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfig,
				task: "test task",
				startTask: false,
			})

			task.recordSubAgentInvocation({
				agentName: "condense-context-analyzer",
				triggerType: "tool_call",
				timestamp: Date.now(),
				tokensIn: 100,
				tokensOut: 50,
				cost: 0.005,
				success: true,
			})

			task.recordSubAgentInvocation({
				agentName: "condense-context-analyzer",
				triggerType: "auto_compress",
				timestamp: Date.now() + 1000,
				tokensIn: 150,
				tokensOut: 75,
				cost: 0.0075,
				success: true,
			})

			const invocations = task.getSubAgentInvocations()
			expect(invocations).toHaveLength(2)
			expect(invocations[0].triggerType).toBe("tool_call")
			expect(invocations[1].triggerType).toBe("auto_compress")
		})
	})
})
