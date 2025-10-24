import { describe, it, expect, vi, beforeEach } from "vitest"
import { parseAstTool } from "../parseAstTool"
import { Task } from "../../task/Task"
import { ToolUse } from "../../../shared/tools"

describe("parseAstTool", () => {
	let mockTask: Partial<Task>
	let mockBlock: ToolUse
	let mockAskApproval: any
	let mockHandleError: any
	let mockPushToolResult: any
	let mockRemoveClosingTag: any

	beforeEach(() => {
		mockTask = {
			cwd: "/test/path",
			consecutiveMistakeCount: 0,
			rooIgnoreController: {
				validateAccess: vi.fn().mockReturnValue(true),
			} as any,
			fileContextTracker: {
				trackFileContext: vi.fn(),
			} as any,
			sayAndCreateMissingParamError: vi.fn().mockResolvedValue("Missing parameter error"),
			recordToolError: vi.fn(),
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
		}

		mockBlock = {
			type: "tool_use",
			name: "parse_ast",
			params: {
				path: "test.ts",
				format: "tree",
			},
			partial: false,
		}

		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockHandleError = vi.fn()
		mockPushToolResult = vi.fn()
		mockRemoveClosingTag = vi.fn((tag: string, value?: string) => value || "")
	})

	it("should handle missing path parameter", async () => {
		mockBlock.params = {}

		await parseAstTool(
			mockTask as Task,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockTask.consecutiveMistakeCount).toBe(1)
		expect(mockTask.recordToolError).toHaveBeenCalledWith("parse_ast")
		expect(mockTask.sayAndCreateMissingParamError).toHaveBeenCalledWith("parse_ast", "path")
		expect(mockPushToolResult).toHaveBeenCalledWith("Missing parameter error")
	})

	it("should handle partial block", async () => {
		mockBlock.partial = true

		await parseAstTool(
			mockTask as Task,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockTask.ask).toHaveBeenCalled()
		expect(mockPushToolResult).not.toHaveBeenCalled()
	})

	it("should reset consecutive mistake count on valid parameters", async () => {
		mockTask.consecutiveMistakeCount = 5

		// Mock file system to avoid actual file operations
		await parseAstTool(
			mockTask as Task,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockTask.consecutiveMistakeCount).toBe(0)
	})

	it("should call removeClosingTag for each parameter", async () => {
		await parseAstTool(
			mockTask as Task,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockRemoveClosingTag).toHaveBeenCalledWith("path", "test.ts")
		expect(mockRemoveClosingTag).toHaveBeenCalledWith("format", "tree")
	})

	it("should handle unsupported file format parameter", async () => {
		mockBlock.params = {
			path: "test.ts",
			format: "invalid",
		}

		await parseAstTool(
			mockTask as Task,
			mockBlock,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Tool should still process with invalid format (defaults to tree)
		expect(mockTask.consecutiveMistakeCount).toBe(0)
	})
})
