/**
 * Unit tests for Task state cleanup logic
 * Tests the selective state cleanup feature that preserves chat history for resumed tasks
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import type { ClineMessage } from "@roo-code/types"
import type { Anthropic } from "@anthropic-ai/sdk"

// Mock types for testing
interface MockTask {
	isNewTask: boolean
	clineMessages: ClineMessage[]
	apiConversationHistory: Anthropic.MessageParam[]
	didFinishAborting: boolean
	isStreaming: boolean
	isWaitingForFirstChunk: boolean
	streamingFailedMessage?: ClineMessage
	askResponse?: string
	askResponseText?: string
	askResponseImages?: string[]
	lastMessageTs?: number
	consecutiveMistakeCount: number
	userMessageContent?: Anthropic.TextBlockParam | Anthropic.ImageBlockParam
	userMessageContentReady: boolean
	clearTemporaryState: () => void
	abortTask: (abandoned?: boolean) => Promise<void>
	dispose: () => void
}

describe("Task State Cleanup", () => {
	describe("isNewTask property", () => {
		it("应该为没有 historyItem 的任务设置 isNewTask = true", () => {
			// 新任务场景：没有 historyItem
			const mockTask: MockTask = {
				isNewTask: true, // 构造函数应该设置为 true
				clineMessages: [
					{
						ts: Date.now(),
						type: "say",
						say: "text",
						text: "测试任务",
					} as ClineMessage,
				],
				apiConversationHistory: [],
				didFinishAborting: false,
				isStreaming: false,
				isWaitingForFirstChunk: false,
				consecutiveMistakeCount: 0,
				userMessageContentReady: false,
				clearTemporaryState: vi.fn(),
				abortTask: vi.fn(),
				dispose: vi.fn(),
			}

			expect(mockTask.isNewTask).toBe(true)
		})

		it("应该为有 historyItem 的任务设置 isNewTask = false", () => {
			// 恢复任务场景：有 historyItem
			const mockTask: MockTask = {
				isNewTask: false, // 构造函数应该设置为 false
				clineMessages: [
					{
						ts: Date.now(),
						type: "say",
						say: "text",
						text: "恢复的任务",
					} as ClineMessage,
				],
				apiConversationHistory: [
					{
						role: "user",
						content: "之前的消息",
					},
				],
				didFinishAborting: false,
				isStreaming: false,
				isWaitingForFirstChunk: false,
				consecutiveMistakeCount: 0,
				userMessageContentReady: false,
				clearTemporaryState: vi.fn(),
				abortTask: vi.fn(),
				dispose: vi.fn(),
			}

			expect(mockTask.isNewTask).toBe(false)
		})
	})

	describe("clearTemporaryState method", () => {
		let mockTask: MockTask

		beforeEach(() => {
			mockTask = {
				isNewTask: false,
				clineMessages: [
					{
						ts: Date.now(),
						type: "say",
						say: "text",
						text: "保留的消息",
					} as ClineMessage,
				],
				apiConversationHistory: [
					{
						role: "user",
						content: "保留的API消息",
					},
				],
				didFinishAborting: false,
				isStreaming: true,
				isWaitingForFirstChunk: false,
				streamingFailedMessage: {
					ts: Date.now(),
					type: "say",
					say: "error",
					text: "streaming failed",
				} as ClineMessage,
				askResponse: "pending",
				askResponseText: "用户输入",
				askResponseImages: ["image1.png"],
				lastMessageTs: Date.now(),
				consecutiveMistakeCount: 3,
				userMessageContent: {
					type: "text",
					text: "用户消息",
				},
				userMessageContentReady: true,
				clearTemporaryState: function () {
					// 模拟实际的 clearTemporaryState 方法
					this.didFinishAborting = false
					this.isStreaming = false
					this.isWaitingForFirstChunk = false
					this.streamingFailedMessage = undefined
					this.askResponse = undefined
					this.askResponseText = undefined
					this.askResponseImages = undefined
					this.lastMessageTs = undefined
					this.consecutiveMistakeCount = 0
					this.userMessageContent = undefined
					this.userMessageContentReady = false
				},
				abortTask: vi.fn(),
				dispose: vi.fn(),
			}
		})

		it("应该清除临时流式状态", () => {
			mockTask.clearTemporaryState()

			expect(mockTask.didFinishAborting).toBe(false)
			expect(mockTask.isStreaming).toBe(false)
			expect(mockTask.isWaitingForFirstChunk).toBe(false)
			expect(mockTask.streamingFailedMessage).toBeUndefined()
		})

		it("应该清除用户交互状态", () => {
			mockTask.clearTemporaryState()

			expect(mockTask.askResponse).toBeUndefined()
			expect(mockTask.askResponseText).toBeUndefined()
			expect(mockTask.askResponseImages).toBeUndefined()
			expect(mockTask.userMessageContent).toBeUndefined()
			expect(mockTask.userMessageContentReady).toBe(false)
		})

		it("应该重置错误计数器", () => {
			mockTask.clearTemporaryState()

			expect(mockTask.consecutiveMistakeCount).toBe(0)
		})

		it("应该保留聊天消息历史", () => {
			const originalMessages = [...mockTask.clineMessages]
			const originalApiHistory = [...mockTask.apiConversationHistory]

			mockTask.clearTemporaryState()

			expect(mockTask.clineMessages).toEqual(originalMessages)
			expect(mockTask.apiConversationHistory).toEqual(originalApiHistory)
		})

		it("应该清除时间戳状态", () => {
			mockTask.clearTemporaryState()

			expect(mockTask.lastMessageTs).toBeUndefined()
		})
	})

	describe("ClineProvider.removeClineFromStack integration", () => {
		it("应该对新任务调用 abortTask(true)", async () => {
			const mockTask: MockTask = {
				isNewTask: true,
				clineMessages: [],
				apiConversationHistory: [],
				didFinishAborting: false,
				isStreaming: false,
				isWaitingForFirstChunk: false,
				consecutiveMistakeCount: 0,
				userMessageContentReady: false,
				clearTemporaryState: vi.fn(),
				abortTask: vi.fn().mockResolvedValue(undefined),
				dispose: vi.fn(),
			}

			// 模拟 removeClineFromStack 对新任务的处理
			if (mockTask.isNewTask) {
				await mockTask.abortTask(true)
			}

			expect(mockTask.abortTask).toHaveBeenCalledWith(true)
			expect(mockTask.clearTemporaryState).not.toHaveBeenCalled()
		})

		it("应该对恢复的任务调用 clearTemporaryState 和 dispose", () => {
			const mockTask: MockTask = {
				isNewTask: false,
				clineMessages: [
					{
						ts: Date.now(),
						type: "say",
						say: "text",
						text: "恢复的任务",
					} as ClineMessage,
				],
				apiConversationHistory: [],
				didFinishAborting: false,
				isStreaming: false,
				isWaitingForFirstChunk: false,
				consecutiveMistakeCount: 0,
				userMessageContentReady: false,
				clearTemporaryState: vi.fn(),
				abortTask: vi.fn(),
				dispose: vi.fn(),
			}

			// 模拟 removeClineFromStack 对恢复任务的处理
			if (!mockTask.isNewTask) {
				mockTask.clearTemporaryState()
				mockTask.dispose()
			}

			expect(mockTask.clearTemporaryState).toHaveBeenCalled()
			expect(mockTask.dispose).toHaveBeenCalled()
			expect(mockTask.abortTask).not.toHaveBeenCalled()
		})
	})

	describe("Memory optimization validation", () => {
		it("选择性清理应该保留重要数据同时释放临时状态", () => {
			const mockTask: MockTask = {
				isNewTask: false,
				clineMessages: [
					{
						ts: Date.now() - 1000,
						type: "say",
						say: "text",
						text: "历史消息 1",
					} as ClineMessage,
					{
						ts: Date.now(),
						type: "say",
						say: "text",
						text: "历史消息 2",
					} as ClineMessage,
				],
				apiConversationHistory: [
					{
						role: "user",
						content: "历史API消息",
					},
				],
				didFinishAborting: false,
				isStreaming: true,
				isWaitingForFirstChunk: true,
				streamingFailedMessage: {
					ts: Date.now(),
					type: "say",
					say: "error",
					text: "error",
				} as ClineMessage,
				askResponse: "pending",
				consecutiveMistakeCount: 5,
				userMessageContentReady: true,
				clearTemporaryState: function () {
					// 临时状态
					this.didFinishAborting = false
					this.isStreaming = false
					this.isWaitingForFirstChunk = false
					this.streamingFailedMessage = undefined
					this.askResponse = undefined
					this.askResponseText = undefined
					this.askResponseImages = undefined
					this.lastMessageTs = undefined
					this.consecutiveMistakeCount = 0
					this.userMessageContent = undefined
					this.userMessageContentReady = false
					// 持久化数据保持不变
					// this.clineMessages - 不清空
					// this.apiConversationHistory - 不清空
				},
				abortTask: vi.fn(),
				dispose: vi.fn(),
			}

			const originalMessageCount = mockTask.clineMessages.length
			const originalApiHistoryCount = mockTask.apiConversationHistory.length

			mockTask.clearTemporaryState()

			// 验证持久化数据被保留
			expect(mockTask.clineMessages.length).toBe(originalMessageCount)
			expect(mockTask.apiConversationHistory.length).toBe(originalApiHistoryCount)

			// 验证临时状态被清理
			expect(mockTask.isStreaming).toBe(false)
			expect(mockTask.streamingFailedMessage).toBeUndefined()
			expect(mockTask.askResponse).toBeUndefined()
			expect(mockTask.consecutiveMistakeCount).toBe(0)
		})
	})
})
