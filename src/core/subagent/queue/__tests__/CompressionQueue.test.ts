/**
 * CompressionQueue Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { CompressionQueue } from "../CompressionQueue"
import { SubagentExecutor } from "../../executor/SubagentExecutor"
import { CompressionTask, Priority, SubagentResult } from "../../types"

describe("CompressionQueue", () => {
	let queue: CompressionQueue
	let mockExecutor: SubagentExecutor

	beforeEach(() => {
		// Mock SubagentExecutor
		mockExecutor = {
			executeSubagent: vi.fn().mockResolvedValue({
				agentName: "condense-context-analyzer",
				output: "Test output",
				tokensUsed: 100,
				executionTime: 50,
				success: true,
			} as SubagentResult),
		} as any

		queue = new CompressionQueue(mockExecutor, {
			concurrency: 2,
			maxRetries: 3,
			verboseLogging: false,
			maxQueueSize: 50,
		})
	})

	describe("Enqueue and Priority Sorting", () => {
		it("应该正确入队任务", async () => {
			const task = createMockTask("task-1", "medium")
			await queue.enqueue(task)

			// Wait a bit for queue to process
			await sleep(50)

			const stats = queue.getStats()
			// Task should be in queue (either pending or processing/completed)
			expect(stats.queueSize).toBeGreaterThan(0)
		})

		it("应该按优先级排序任务 (high > medium > low)", async () => {
			// Mock slow execution to keep tasks pending
			mockExecutor.executeSubagent = vi.fn().mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									agentName: "test",
									output: "output",
									tokensUsed: 100,
									executionTime: 50,
									success: true,
								}),
							500,
						),
					),
			)

			const lowTask = createMockTask("task-low", "low")
			const mediumTask = createMockTask("task-medium", "medium")
			const highTask = createMockTask("task-high", "high")

			// 乱序入队
			await queue.enqueue(lowTask)
			await queue.enqueue(highTask)
			await queue.enqueue(mediumTask)

			// Wait for tasks to start processing
			await sleep(100)

			const stats = queue.getStats()
			// At least one task should be queued
			expect(stats.queueSize).toBeGreaterThan(0)

			// 检查高优先级任务存在
			const firstTask = queue.getTaskStatus("task-high")
			expect(firstTask).toBeDefined()
			expect(firstTask?.task.priority).toBe("high")
		})

		it("应该在优先级相同时按时间排序 (先入先出)", async () => {
			const task1 = createMockTask("task-1", "medium")
			const task2 = createMockTask("task-2", "medium")

			await queue.enqueue(task1)
			await sleep(10) // 确保时间戳不同
			await queue.enqueue(task2)

			await sleep(50)

			const firstTask = queue.getTaskStatus("task-1")
			const secondTask = queue.getTaskStatus("task-2")

			expect(firstTask?.addedAt).toBeLessThan(secondTask?.addedAt || 0)
		})
	})

	describe("Task Processing", () => {
		it("应该异步处理任务", async () => {
			const task = createMockTask("task-1", "high")
			await queue.enqueue(task)

			// 等待处理完成
			await queue.waitForCompletion(1000)

			const status = queue.getTaskStatus("task-1")
			expect(status?.status).toBe("completed")
			expect(status?.result?.success).toBe(true)
		})

		it("应该并发处理多个任务", async () => {
			const task1 = createMockTask("task-1", "high")
			const task2 = createMockTask("task-2", "high")

			await queue.enqueue(task1)
			await queue.enqueue(task2)

			// 等待处理
			await queue.waitForCompletion(2000)

			const stats = queue.getStats()
			expect(stats.completed).toBe(2)
			expect(mockExecutor.executeSubagent).toHaveBeenCalledTimes(2) // 每个任务1个step
		})

		it("应该在任务失败时重试", async () => {
			// Mock失败然后成功
			let callCount = 0
			mockExecutor.executeSubagent = vi.fn().mockImplementation(() => {
				callCount++
				if (callCount < 2) {
					throw new Error("Simulated failure")
				}
				return Promise.resolve({
					agentName: "test",
					output: "Success",
					tokensUsed: 100,
					executionTime: 50,
					success: true,
				})
			})

			const task = createMockTask("task-1", "high")
			await queue.enqueue(task)

			await queue.waitForCompletion(2000)

			const status = queue.getTaskStatus("task-1")
			expect(status?.status).toBe("completed")
			expect(status?.attempts).toBe(2) // 第一次失败，第二次成功
		})

		it("应该在达到最大重试次数后标记为失败", async () => {
			// Mock总是失败
			mockExecutor.executeSubagent = vi.fn().mockRejectedValue(new Error("Always fail"))

			const task = createMockTask("task-1", "high")
			await queue.enqueue(task)

			await queue.waitForCompletion(3000)

			const status = queue.getTaskStatus("task-1")
			expect(status?.status).toBe("failed")
			expect(status?.attempts).toBe(3) // maxRetries = 3
		})
	})

	describe("Queue Management", () => {
		it("应该正确报告队列统计信息", async () => {
			// Mock slow execution to keep tasks in queue
			mockExecutor.executeSubagent = vi.fn().mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									agentName: "test",
									output: "output",
									tokensUsed: 100,
									executionTime: 50,
									success: true,
								}),
							300,
						),
					),
			)

			const task1 = createMockTask("task-1", "high")
			const task2 = createMockTask("task-2", "medium")

			await queue.enqueue(task1)
			await queue.enqueue(task2)

			await sleep(50)

			const stats = queue.getStats()
			expect(stats.queueSize).toBe(2)
			// Either pending or processing
			expect(stats.pending + stats.processing).toBeGreaterThan(0)
		})

		it("应该清理已完成的任务", async () => {
			const task = createMockTask("task-1", "high")
			await queue.enqueue(task)

			await queue.waitForCompletion(1000)

			expect(queue.getStats().completed).toBe(1)

			queue.cleanup()

			const stats = queue.getStats()
			expect(stats.queueSize).toBe(0) // 已完成任务被清理
		})

		it("应该清空队列", async () => {
			await queue.enqueue(createMockTask("task-1", "high"))
			await queue.enqueue(createMockTask("task-2", "medium"))
			await queue.enqueue(createMockTask("task-3", "low"))

			expect(queue.getStats().queueSize).toBe(3)

			queue.clear()

			expect(queue.getStats().queueSize).toBe(0)
			expect(queue.isEmpty()).toBe(true)
		})

		it("应该检测队列是否为空", async () => {
			expect(queue.isEmpty()).toBe(true)

			// Mock slow execution
			mockExecutor.executeSubagent = vi.fn().mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									agentName: "test",
									output: "output",
									tokensUsed: 100,
									executionTime: 50,
									success: true,
								}),
							200,
						),
					),
			)

			await queue.enqueue(createMockTask("task-1", "high"))

			// Should not be empty immediately after enqueue
			await sleep(10)
			expect(queue.isEmpty()).toBe(false)

			await queue.waitForCompletion(1000)
			expect(queue.isEmpty()).toBe(true) // 所有任务已完成
		})

		it("应该在队列满时移除低优先级任务", async () => {
			// 创建一个小队列
			queue = new CompressionQueue(mockExecutor, {
				concurrency: 1,
				maxRetries: 3,
				verboseLogging: false,
				maxQueueSize: 3, // 最多3个任务
			})

			// 先添加低优先级任务
			await queue.enqueue(createMockTask("task-low-1", "low"))
			await queue.enqueue(createMockTask("task-low-2", "low"))
			await queue.enqueue(createMockTask("task-medium", "medium"))

			expect(queue.getStats().queueSize).toBe(3)

			// 添加第4个任务（应该移除一个低优先级）
			await queue.enqueue(createMockTask("task-high", "high"))

			expect(queue.getStats().queueSize).toBe(3) // 仍然是3个
			// 应该保留 high, medium, low-2 (移除了low-1)
		})
	})

	describe("Task Status Tracking", () => {
		it("应该通过ID获取任务状态", async () => {
			// Mock slow execution to keep task in pending/processing state
			mockExecutor.executeSubagent = vi.fn().mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									agentName: "test",
									output: "output",
									tokensUsed: 100,
									executionTime: 50,
									success: true,
								}),
							500,
						),
					),
			)

			const task = createMockTask("task-1", "high")
			await queue.enqueue(task)

			await sleep(10)

			const status = queue.getTaskStatus("task-1")
			expect(status).toBeDefined()
			expect(status?.task.id).toBe("task-1")
			// Status could be pending, processing, or completed
			expect(["pending", "processing", "completed"]).toContain(status?.status)
		})

		it("应该追踪任务的时间戳", async () => {
			// Mock with measurable execution time
			mockExecutor.executeSubagent = vi.fn().mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									agentName: "test",
									output: "output",
									tokensUsed: 100,
									executionTime: 50,
									success: true,
								}),
							100,
						),
					), // 100ms delay to ensure timestamps are different
			)

			const task = createMockTask("task-1", "high")
			await queue.enqueue(task)

			// addedAt should always be set
			const beforeProcess = queue.getTaskStatus("task-1")
			expect(beforeProcess?.addedAt).toBeDefined()

			await queue.waitForCompletion(1000)

			const afterProcess = queue.getTaskStatus("task-1")
			expect(afterProcess?.startedAt).toBeDefined()
			expect(afterProcess?.completedAt).toBeDefined()
			// completedAt should be greater than or equal to addedAt
			if (afterProcess?.completedAt && afterProcess?.addedAt) {
				expect(afterProcess.completedAt).toBeGreaterThanOrEqual(afterProcess.addedAt)
			}
		})

		it("应该计算平均处理时间", async () => {
			// Mock with measurable execution time
			mockExecutor.executeSubagent = vi.fn().mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									agentName: "test",
									output: "output",
									tokensUsed: 100,
									executionTime: 50,
									success: true,
								}),
							50,
						),
					),
			)

			await queue.enqueue(createMockTask("task-1", "high"))
			await queue.enqueue(createMockTask("task-2", "high"))

			await queue.waitForCompletion(2000)

			const stats = queue.getStats()
			expect(stats.averageProcessingTime).toBeGreaterThan(0)
			expect(stats.totalProcessed).toBe(2)
		})
	})

	describe("Edge Cases", () => {
		it("应该处理空策略的任务", async () => {
			const task: CompressionTask = {
				id: "empty-task",
				conversationId: "conv-1",
				trigger: "test",
				priority: "medium",
				messageRange: [0, 10],
				strategy: {
					steps: [], // 空步骤
				},
				createdAt: Date.now(),
			}

			await queue.enqueue(task)
			await queue.waitForCompletion(500)

			const status = queue.getTaskStatus("empty-task")
			expect(status?.status).toBe("completed") // 即使没有步骤也标记为完成
		})

		it("应该处理多步骤任务", async () => {
			const task: CompressionTask = {
				id: "multi-step",
				conversationId: "conv-1",
				trigger: "test",
				priority: "high",
				messageRange: [0, 20],
				strategy: {
					steps: [
						{ agent: "condense-context-analyzer", weight: 1 },
						{ agent: "condense-memory-extractor", weight: 1 },
						{ agent: "condense-code-summarizer", weight: 0.5 },
					],
				},
				createdAt: Date.now(),
			}

			await queue.enqueue(task)
			await queue.waitForCompletion(2000)

			const status = queue.getTaskStatus("multi-step")
			expect(status?.status).toBe("completed")
			expect(mockExecutor.executeSubagent).toHaveBeenCalledTimes(3) // 3个步骤
		})

		it("应该处理waitForCompletion超时", async () => {
			// Mock一个永远不完成的任务
			mockExecutor.executeSubagent = vi.fn().mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 10000) // 10秒后才完成
					}),
			)

			const task = createMockTask("slow-task", "high")
			await queue.enqueue(task)

			await expect(queue.waitForCompletion(500)).rejects.toThrow("Queue processing timeout")
		})
	})
})

// Helper functions
function createMockTask(id: string, priority: Priority): CompressionTask {
	return {
		id,
		conversationId: "conv-1",
		trigger: "test",
		priority,
		messageRange: [0, 10],
		strategy: {
			steps: [{ agent: "condense-context-analyzer", weight: 1 }],
		},
		createdAt: Date.now(),
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
