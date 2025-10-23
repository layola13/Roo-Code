import { describe, it, expect, beforeEach, vi } from "vitest"
import { executeCommandTool } from "../executeCommandTool"
import type { Task } from "../../task/Task"
import type { ToolUse } from "../../../shared/tools"
import * as fs from "fs/promises"
import { TerminalRegistry } from "../../../integrations/terminal/TerminalRegistry"

// Mock dependencies
vi.mock("fs/promises")
vi.mock("../../../integrations/terminal/TerminalRegistry")
vi.mock("../../../integrations/terminal/Terminal")
vi.mock("../../../integrations/terminal/ExecaTerminal")
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue(0),
		}),
	},
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path })),
	},
}))

describe("Command Cleaning", () => {
	let mockTask: any
	let mockAskApproval: any
	let mockHandleError: any
	let mockPushToolResult: any
	let mockRemoveClosingTag: any
	let capturedCommand: string | undefined

	beforeEach(() => {
		vi.clearAllMocks()
		capturedCommand = undefined

		// Mock fs.access to allow directory checks
		;(fs.access as any).mockResolvedValue(undefined)

		// Mock terminal registry
		const mockTerminal = {
			runCommand: vi.fn().mockReturnValue(Promise.resolve()),
			getCurrentWorkingDirectory: vi.fn().mockReturnValue("/test/project"),
		}
		;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValue(mockTerminal)

		// Create mock task
		mockTask = {
			cwd: "/test/project",
			taskId: "test-task",
			providerRef: {
				deref: vi.fn().mockResolvedValue({
					getState: vi.fn().mockResolvedValue({
						terminalOutputLineLimit: 500,
						terminalShellIntegrationDisabled: false,
						autoCloseIdleTerminals: true,
						commandApprovalFreeMode: false, // Disable free mode to ensure askApproval is called
						allowedCommands: [],
						deniedCommands: [],
					}),
					postMessageToWebview: vi.fn(),
				}),
			},
			say: vi.fn().mockResolvedValue(undefined),
			terminalProcess: undefined,
			consecutiveMistakeCount: 0,
			rooIgnoreController: {
				validateCommand: vi.fn().mockReturnValue(null),
			},
		}

		// Mock approval to always approve and capture the cleaned command
		mockAskApproval = vi.fn().mockImplementation(async (_type: string, command: string) => {
			capturedCommand = command
			return true
		})

		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn((tag: string, content: string | undefined) => content || "")
	})

	describe("Trailing Operator Removal", () => {
		it("should remove trailing &&", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "execute_command",
				params: {
					command: "cd haxe-rs/tests && ../target/release/haxe-rs build.hxml &&",
				},
				partial: false,
			}

			await executeCommandTool(
				mockTask,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(capturedCommand).toBe("cd haxe-rs/tests && ../target/release/haxe-rs build.hxml")
		})

		it("should remove trailing ||", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "execute_command",
				params: {
					command: "npm test || echo failed ||",
				},
				partial: false,
			}

			await executeCommandTool(
				mockTask,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(capturedCommand).toBe("npm test || echo failed")
		})

		it("should remove trailing ;", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "execute_command",
				params: {
					command: "echo hello; echo world;",
				},
				partial: false,
			}

			await executeCommandTool(
				mockTask,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(capturedCommand).toBe("echo hello; echo world")
		})

		it("should remove trailing |", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "execute_command",
				params: {
					command: "ls -la | grep test |",
				},
				partial: false,
			}

			await executeCommandTool(
				mockTask,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(capturedCommand).toBe("ls -la | grep test")
		})

		it("should handle multiple trailing operators", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "execute_command",
				params: {
					command: "cmd1 && cmd2 &&   ",
				},
				partial: false,
			}

			await executeCommandTool(
				mockTask,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(capturedCommand).toBe("cmd1 && cmd2")
		})
	})

	describe("Multi-line Command Handling", () => {
		it("should convert multi-line command with > prompt to single line", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "execute_command",
				params: {
					command:
						'cd haxe-rs/tests && ../target/release/haxe-rs build.hxml 2>&1 && echo "\n> === 运行测试 ===" && node bin/AbstractClassTest.js',
				},
				partial: false,
			}

			await executeCommandTool(
				mockTask,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(capturedCommand).toBe(
				'cd haxe-rs/tests && ../target/release/haxe-rs build.hxml 2>&1 && echo " === 运行测试 ===" && node bin/AbstractClassTest.js',
			)
		})

		it("should convert multi-line with continuation prompt", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "execute_command",
				params: {
					command: "echo line1 &&\n> echo line2 &&\n> echo line3",
				},
				partial: false,
			}

			await executeCommandTool(
				mockTask,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(capturedCommand).toBe("echo line1 && echo line2 && echo line3")
		})

		it("should handle multi-line with trailing operator", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "execute_command",
				params: {
					command:
						"cd haxe-rs/tests && ../target/release/haxe-rs build.hxml 2>&1 && echo\n> === 运行测试 === &&",
				},
				partial: false,
			}

			await executeCommandTool(
				mockTask,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Should convert to single line AND remove trailing &&
			expect(capturedCommand).toBe(
				"cd haxe-rs/tests && ../target/release/haxe-rs build.hxml 2>&1 && echo === 运行测试 ===",
			)
		})

		it("should handle plain newlines without prompt", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "execute_command",
				params: {
					command: "echo line1\necho line2\necho line3",
				},
				partial: false,
			}

			await executeCommandTool(
				mockTask,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(capturedCommand).toBe("echo line1 echo line2 echo line3")
		})
	})

	describe("Combined Scenarios", () => {
		it("should handle complex multi-line with operators and trailing operator", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "execute_command",
				params: {
					command: "cd test &&\n> npm install &&\n> npm test &&",
				},
				partial: false,
			}

			await executeCommandTool(
				mockTask,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(capturedCommand).toBe("cd test && npm install && npm test")
		})

		it("should preserve valid command chains", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "execute_command",
				params: {
					command: "cd dir && npm install && npm test",
				},
				partial: false,
			}

			await executeCommandTool(
				mockTask,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(capturedCommand).toBe("cd dir && npm install && npm test")
		})

		it("should handle whitespace variations", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "execute_command",
				params: {
					command: "  cmd1  &&  \n  >  cmd2  &&  ",
				},
				partial: false,
			}

			await executeCommandTool(
				mockTask,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(capturedCommand).toBe("cmd1  &&  cmd2")
		})
	})

	describe("Edge Cases", () => {
		it("should handle empty command", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "execute_command",
				params: {
					command: "",
				},
				partial: false,
			}

			await executeCommandTool(
				mockTask,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			// Empty command should trigger missing parameter error
			expect(mockPushToolResult).toHaveBeenCalled()
			expect(capturedCommand).toBeUndefined()
		})

		it("should handle command with only operators", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "execute_command",
				params: {
					command: "&&",
				},
				partial: false,
			}

			await executeCommandTool(
				mockTask,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(capturedCommand).toBe("")
		})

		it("should handle single command without operators", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "execute_command",
				params: {
					command: "ls -la",
				},
				partial: false,
			}

			await executeCommandTool(
				mockTask,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(capturedCommand).toBe("ls -la")
		})
	})
})
