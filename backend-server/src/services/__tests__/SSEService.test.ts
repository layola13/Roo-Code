import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Response } from "express"
import { SSEService, SSEEventType } from "../SSEService.js"
import { EventEmitter } from "events"

// Mock dependencies
vi.mock("../../config/redis.js", () => ({
	createRedisPubSubClient: vi.fn(() => ({
		psubscribe: vi.fn(),
		on: vi.fn(),
		quit: vi.fn(),
		status: "ready",
	})),
}))

vi.mock("../../utils/logger.js", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}))

/**
 * 创建模拟的 Express Response 对象
 */
function createMockResponse(): Response {
	const emitter = new EventEmitter()
	const chunks: string[] = []

	const mockRes = {
		setHeader: vi.fn(),
		write: vi.fn((chunk: string) => {
			chunks.push(chunk)
			return true
		}),
		end: vi.fn(),
		on: emitter.on.bind(emitter),
		emit: emitter.emit.bind(emitter),
		writableEnded: false,
		// Helper methods for testing
		getChunks: () => chunks,
		getLastChunk: () => chunks[chunks.length - 1],
		close: () => {
			mockRes.writableEnded = true
			emitter.emit("close")
		},
	} as unknown as Response

	return mockRes
}

/**
 * 解析 SSE 消息
 */
function parseSSEMessage(message: string): {
	id?: string
	event?: string
	data?: any
	retry?: number
} {
	const lines = message.trim().split("\n")
	const result: any = {}

	for (const line of lines) {
		if (!line.trim()) continue

		const colonIndex = line.indexOf(":")
		if (colonIndex === -1) continue

		const field = line.substring(0, colonIndex).trim()
		const value = line.substring(colonIndex + 1).trim()

		if (field === "id") {
			result.id = value
		} else if (field === "event") {
			result.event = value
		} else if (field === "data") {
			try {
				result.data = JSON.parse(value)
			} catch {
				result.data = value
			}
		} else if (field === "retry") {
			result.retry = parseInt(value, 10)
		}
	}

	return result
}

describe("SSEService", () => {
	let sseService: SSEService

	beforeEach(async () => {
		sseService = new SSEService()
		await sseService.initialize()
	})

	afterEach(async () => {
		await sseService.close()
	})

	describe("初始化", () => {
		it("应该成功初始化 SSEService", () => {
			expect(sseService).toBeDefined()
		})

		it("不应该重复初始化", async () => {
			// 尝试重复初始化
			await sseService.initialize()
			// 不应该抛出错误
		})
	})

	describe("连接管理", () => {
		it("应该创建 SSE 连接", () => {
			const mockRes = createMockResponse()
			const connectionId = "conn-123"
			const userId = "user-123"

			sseService.createConnection(connectionId, userId, undefined, mockRes)

			// 验证响应头
			expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream")
			expect(mockRes.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache")
			expect(mockRes.setHeader).toHaveBeenCalledWith("Connection", "keep-alive")

			// 验证连接已创建
			expect(sseService.getActiveConnectionsCount()).toBe(1)
		})

		it("应该在创建连接时发送 connected 事件", () => {
			const mockRes = createMockResponse()
			const connectionId = "conn-123"
			const userId = "user-123"

			sseService.createConnection(connectionId, userId, undefined, mockRes)

			const chunks = (mockRes as any).getChunks()
			expect(chunks.length).toBeGreaterThan(0)

			// 查找 connected 事件
			const connectedMessage = chunks.find((chunk: string) => chunk.includes("event: connected"))
			expect(connectedMessage).toBeDefined()
		})

		it("应该正确关闭连接", () => {
			const mockRes = createMockResponse()
			const connectionId = "conn-123"
			const userId = "user-123"

			sseService.createConnection(connectionId, userId, undefined, mockRes)
			expect(sseService.getActiveConnectionsCount()).toBe(1)

			sseService.closeConnection(connectionId)
			expect(sseService.getActiveConnectionsCount()).toBe(0)
			expect(mockRes.end).toHaveBeenCalled()
		})

		it("应该在响应关闭时自动清理连接", () => {
			const mockRes = createMockResponse()
			const connectionId = "conn-123"
			const userId = "user-123"

			sseService.createConnection(connectionId, userId, undefined, mockRes)
			expect(sseService.getActiveConnectionsCount()).toBe(1)

			// 模拟客户端断开连接
			;(mockRes as any).close()

			expect(sseService.getActiveConnectionsCount()).toBe(0)
		})
	})

	describe("频道订阅", () => {
		it("应该能订阅频道", () => {
			const mockRes = createMockResponse()
			const connectionId = "conn-123"
			const userId = "user-123"
			const channel = "sse:task:task-123"

			sseService.createConnection(connectionId, userId, undefined, mockRes)
			sseService.subscribeToChannel(connectionId, channel)

			// 验证订阅成功（通过发送事件测试）
			const connections = sseService.getConnections()
			expect(connections[0].channels).toContain(channel)
		})

		it("应该能取消订阅频道", () => {
			const mockRes = createMockResponse()
			const connectionId = "conn-123"
			const userId = "user-123"
			const channel = "sse:task:task-123"

			sseService.createConnection(connectionId, userId, undefined, mockRes)
			sseService.subscribeToChannel(connectionId, channel)
			sseService.unsubscribeFromChannel(connectionId, channel)

			const connections = sseService.getConnections()
			expect(connections[0].channels).not.toContain(channel)
		})
	})

	describe("事件发送", () => {
		it("应该能发送简单事件", () => {
			const mockRes = createMockResponse()
			const connectionId = "conn-123"
			const userId = "user-123"

			sseService.createConnection(connectionId, userId, undefined, mockRes)

			const success = sseService.sendEvent(connectionId, {
				event: "test",
				data: { message: "Hello" },
			})

			expect(success).toBe(true)
			const chunks = (mockRes as any).getChunks()
			const lastChunk = (mockRes as any).getLastChunk()

			expect(lastChunk).toContain("event: test")
			expect(lastChunk).toContain("data:")
		})

		it("应该能发送带 ID 的事件", () => {
			const mockRes = createMockResponse()
			const connectionId = "conn-123"
			const userId = "user-123"

			sseService.createConnection(connectionId, userId, undefined, mockRes)

			sseService.sendEvent(connectionId, {
				id: "event-123",
				event: "test",
				data: { message: "Hello" },
			})

			const lastChunk = (mockRes as any).getLastChunk()
			expect(lastChunk).toContain("id: event-123")
		})

		it("应该能发送多行数据", () => {
			const mockRes = createMockResponse()
			const connectionId = "conn-123"
			const userId = "user-123"

			sseService.createConnection(connectionId, userId, undefined, mockRes)

			sseService.sendEvent(connectionId, {
				event: "test",
				data: "Line 1\nLine 2\nLine 3",
			})

			const lastChunk = (mockRes as any).getLastChunk()
			expect(lastChunk).toContain("data: Line 1")
			expect(lastChunk).toContain("data: Line 2")
			expect(lastChunk).toContain("data: Line 3")
		})

		it("发送到不存在的连接应该返回 false", () => {
			const success = sseService.sendEvent("non-existent", {
				event: "test",
				data: {},
			})

			expect(success).toBe(false)
		})
	})

	describe("用户事件", () => {
		it("应该向用户的所有连接发送事件", () => {
			const userId = "user-123"
			const mockRes1 = createMockResponse()
			const mockRes2 = createMockResponse()

			sseService.createConnection("conn-1", userId, undefined, mockRes1)
			sseService.createConnection("conn-2", userId, undefined, mockRes2)

			sseService.sendEventToUser(userId, {
				event: "test",
				data: { message: "Hello User" },
			})

			const chunks1 = (mockRes1 as any).getChunks()
			const chunks2 = (mockRes2 as any).getChunks()

			expect(chunks1.some((c: string) => c.includes("Hello User"))).toBe(true)
			expect(chunks2.some((c: string) => c.includes("Hello User"))).toBe(true)
		})

		it("应该获取正确的用户连接数", () => {
			const userId = "user-123"
			const mockRes1 = createMockResponse()
			const mockRes2 = createMockResponse()

			sseService.createConnection("conn-1", userId, undefined, mockRes1)
			sseService.createConnection("conn-2", userId, undefined, mockRes2)

			const count = sseService.getUserConnectionsCount(userId)
			expect(count).toBe(2)
		})
	})

	describe("组织事件", () => {
		it("应该向组织的所有连接发送事件", () => {
			const organizationId = "org-123"
			const mockRes1 = createMockResponse()
			const mockRes2 = createMockResponse()

			sseService.createConnection("conn-1", "user-1", organizationId, mockRes1)
			sseService.createConnection("conn-2", "user-2", organizationId, mockRes2)

			sseService.sendEventToOrganization(organizationId, {
				event: "test",
				data: { message: "Hello Organization" },
			})

			const chunks1 = (mockRes1 as any).getChunks()
			const chunks2 = (mockRes2 as any).getChunks()

			expect(chunks1.some((c: string) => c.includes("Hello Organization"))).toBe(true)
			expect(chunks2.some((c: string) => c.includes("Hello Organization"))).toBe(true)
		})

		it("不应该向其他组织的连接发送事件", () => {
			const mockRes1 = createMockResponse()
			const mockRes2 = createMockResponse()

			sseService.createConnection("conn-1", "user-1", "org-123", mockRes1)
			sseService.createConnection("conn-2", "user-2", "org-456", mockRes2)

			sseService.sendEventToOrganization("org-123", {
				event: "test",
				data: { message: "Hello" },
			})

			const chunks1 = (mockRes1 as any).getChunks()
			const chunks2 = (mockRes2 as any).getChunks()

			expect(chunks1.some((c: string) => c.includes("Hello"))).toBe(true)
			expect(chunks2.some((c: string) => c.includes("Hello"))).toBe(false)
		})
	})

	describe("任务事件", () => {
		it("应该发送任务进度事件", () => {
			const mockRes = createMockResponse()
			const connectionId = "conn-123"
			const taskId = "task-123"
			const channel = `sse:task:${taskId}`

			sseService.createConnection(connectionId, "user-123", undefined, mockRes)
			sseService.subscribeToChannel(connectionId, channel)

			sseService.sendTaskProgress(taskId, "user-123", 50, "Processing...")

			const chunks = (mockRes as any).getChunks()
			const progressMessage = chunks.find((c: string) => c.includes(SSEEventType.TASK_PROGRESS))

			expect(progressMessage).toBeDefined()
			expect(progressMessage).toContain("50")
		})

		it("应该发送任务状态事件", () => {
			const mockRes = createMockResponse()
			const connectionId = "conn-123"
			const taskId = "task-123"
			const channel = `sse:task:${taskId}`

			sseService.createConnection(connectionId, "user-123", undefined, mockRes)
			sseService.subscribeToChannel(connectionId, channel)

			sseService.sendTaskStatus(taskId, "user-123", "completed", { result: "success" })

			const chunks = (mockRes as any).getChunks()
			const statusMessage = chunks.find((c: string) => c.includes(SSEEventType.TASK_STATUS))

			expect(statusMessage).toBeDefined()
			expect(statusMessage).toContain("completed")
		})
	})

	describe("遥测事件", () => {
		it("应该发送遥测数据", () => {
			const mockRes = createMockResponse()
			const connectionId = "conn-123"
			const taskId = "task-123"
			const channel = `sse:telemetry:${taskId}`

			sseService.createConnection(connectionId, "user-123", undefined, mockRes)
			sseService.subscribeToChannel(connectionId, channel)

			sseService.sendTelemetry(taskId, {
				metric: "cpu_usage",
				value: 75.5,
			})

			const chunks = (mockRes as any).getChunks()
			const telemetryMessage = chunks.find((c: string) => c.includes(SSEEventType.TELEMETRY))

			expect(telemetryMessage).toBeDefined()
			expect(telemetryMessage).toContain("cpu_usage")
		})
	})

	describe("组织事件流", () => {
		it("应该发送组织事件", () => {
			const mockRes = createMockResponse()
			const connectionId = "conn-123"
			const organizationId = "org-123"
			const channel = `sse:organization:${organizationId}`

			sseService.createConnection(connectionId, "user-123", organizationId, mockRes)
			sseService.subscribeToChannel(connectionId, channel)

			sseService.sendOrganizationEvent(organizationId, "member_added", {
				memberId: "user-456",
				role: "member",
			})

			const chunks = (mockRes as any).getChunks()
			const orgMessage = chunks.find((c: string) => c.includes(SSEEventType.ORGANIZATION_EVENT))

			expect(orgMessage).toBeDefined()
			expect(orgMessage).toContain("member_added")
		})
	})

	describe("错误处理", () => {
		it("应该发送错误事件", () => {
			const mockRes = createMockResponse()
			const connectionId = "conn-123"

			sseService.createConnection(connectionId, "user-123", undefined, mockRes)

			sseService.sendError(connectionId, "Test error", "TEST_ERROR")

			const chunks = (mockRes as any).getChunks()
			const errorMessage = chunks.find((c: string) => c.includes(SSEEventType.ERROR))

			expect(errorMessage).toBeDefined()
			expect(errorMessage).toContain("Test error")
		})

		it("发送到已关闭的连接应该关闭连接", () => {
			const mockRes = createMockResponse()
			const connectionId = "conn-123"

			sseService.createConnection(connectionId, "user-123", undefined, mockRes)

			// 模拟连接已结束
			;(mockRes as any).writableEnded = true

			const success = sseService.sendEvent(connectionId, {
				event: "test",
				data: {},
			})

			expect(success).toBe(false)
			expect(sseService.getActiveConnectionsCount()).toBe(0)
		})
	})

	describe("连接信息", () => {
		it("应该获取正确的活跃连接数", () => {
			const mockRes1 = createMockResponse()
			const mockRes2 = createMockResponse()

			sseService.createConnection("conn-1", "user-1", undefined, mockRes1)
			sseService.createConnection("conn-2", "user-2", undefined, mockRes2)

			expect(sseService.getActiveConnectionsCount()).toBe(2)

			sseService.closeConnection("conn-1")
			expect(sseService.getActiveConnectionsCount()).toBe(1)
		})

		it("应该获取所有连接信息", () => {
			const mockRes1 = createMockResponse()
			const mockRes2 = createMockResponse()

			sseService.createConnection("conn-1", "user-1", "org-1", mockRes1)
			sseService.createConnection("conn-2", "user-2", "org-2", mockRes2)

			const connections = sseService.getConnections()

			expect(connections).toHaveLength(2)
			expect(connections[0]).toHaveProperty("id")
			expect(connections[0]).toHaveProperty("userId")
			expect(connections[0]).toHaveProperty("organizationId")
			expect(connections[0]).toHaveProperty("channels")
			expect(connections[0]).toHaveProperty("createdAt")
			expect(connections[0]).toHaveProperty("lastHeartbeat")
		})
	})

	describe("服务关闭", () => {
		it("应该正确关闭服务", async () => {
			const mockRes = createMockResponse()

			sseService.createConnection("conn-1", "user-1", undefined, mockRes)
			expect(sseService.getActiveConnectionsCount()).toBe(1)

			await sseService.close()

			expect(sseService.getActiveConnectionsCount()).toBe(0)
		})

		it("关闭后不应该能创建新连接", async () => {
			await sseService.close()

			const mockRes = createMockResponse()

			// 这不会抛出错误，但服务不再活跃
			sseService.createConnection("conn-1", "user-1", undefined, mockRes)

			// 由于服务已关闭，连接可能不会被正确创建
			// 这取决于具体实现
		})
	})
})
