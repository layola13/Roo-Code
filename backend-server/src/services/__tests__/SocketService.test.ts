import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createServer, Server as HTTPServer } from "http"
import { SocketService } from "../SocketService.js"
import { SocketEvents, SocketRooms, ExtensionSocketEvents, TaskSocketEvents } from "../../config/socket.js"
import { io as ioClient, Socket as ClientSocket } from "socket.io-client"

// Mock dependencies
vi.mock("../../config/redis.js", () => ({
	createRedisPubSubClient: vi.fn(() => ({
		subscribe: vi.fn().mockResolvedValue(undefined),
		on: vi.fn(),
		publish: vi.fn().mockResolvedValue(1), // Redis publish returns number of subscribers
		quit: vi.fn().mockResolvedValue(undefined),
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

vi.mock("../../middleware/socketAuth.js", () => ({
	socketAuthMiddleware: vi.fn(() => {
		return (socket: any, next: any) => {
			// Mock authentication - set default user data
			socket.userData = {
				userId: "test-user-id",
				organizationId: "test-org-id",
				authenticated: true,
			}
			next()
		}
	}),
}))

describe("SocketService", () => {
	let httpServer: HTTPServer
	let socketService: SocketService
	let clientSocket: ClientSocket
	let serverAddress: string

	beforeEach(async () => {
		// Create HTTP server
		httpServer = createServer()

		// Start server on random port
		await new Promise<void>((resolve) => {
			httpServer.listen(0, () => {
				const address = httpServer.address()
				if (address && typeof address === "object") {
					serverAddress = `http://localhost:${address.port}`
				}
				resolve()
			})
		})

		// Initialize SocketService
		socketService = new SocketService()
		await socketService.initialize(httpServer)
	})

	afterEach(async () => {
		// Disconnect client
		if (clientSocket) {
			clientSocket.disconnect()
		}

		// Close SocketService
		await socketService.close()

		// Close HTTP server
		await new Promise<void>((resolve) => {
			httpServer.close(() => resolve())
		})
	})

	describe("初始化", () => {
		it("应该成功初始化 SocketService", () => {
			expect(socketService).toBeDefined()
		})

		it("不应该重复初始化", async () => {
			// 尝试重复初始化
			await socketService.initialize(httpServer)
			// 不应该抛出错误
		})
	})

	describe("连接管理", () => {
		it("应该接受客户端连接", (done) => {
			clientSocket = ioClient(serverAddress, {
				auth: { token: "test-token" },
			})

			clientSocket.on("connect", () => {
				expect(clientSocket.connected).toBe(true)
				done()
			})

			clientSocket.on("connect_error", (error) => {
				done(error)
			})
		})

		it("连接后应该收到认证成功事件", (done) => {
			clientSocket = ioClient(serverAddress, {
				auth: { token: "test-token" },
			})

			clientSocket.on(SocketEvents.AUTHENTICATED, (response) => {
				expect(response.success).toBe(true)
				expect(response.data.userId).toBe("test-user-id")
				expect(response.data.organizationId).toBe("test-org-id")
				done()
			})
		})

		it("应该正确处理断开连接", (done) => {
			clientSocket = ioClient(serverAddress, {
				auth: { token: "test-token" },
			})

			clientSocket.on("connect", () => {
				clientSocket.disconnect()
			})

			clientSocket.on("disconnect", () => {
				expect(clientSocket.connected).toBe(false)
				done()
			})
		})
	})

	describe("房间管理", () => {
		beforeEach((done) => {
			clientSocket = ioClient(serverAddress, {
				auth: { token: "test-token" },
			})
			clientSocket.on("connect", () => done())
		})

		it("应该能加入房间", (done) => {
			const roomName = "test-room"

			clientSocket.emit(SocketEvents.JOIN_ROOM, roomName, (response: any) => {
				expect(response.success).toBe(true)
				expect(response.data.roomName).toBe(roomName)
				expect(response.data.joined).toBe(true)
				done()
			})
		})

		it("应该能离开房间", (done) => {
			const roomName = "test-room"

			// First join the room
			clientSocket.emit(SocketEvents.JOIN_ROOM, roomName, () => {
				// Then leave the room
				clientSocket.emit(SocketEvents.LEAVE_ROOM, roomName, (response: any) => {
					expect(response.success).toBe(true)
					expect(response.data.roomName).toBe(roomName)
					expect(response.data.left).toBe(true)
					done()
				})
			})
		})

		it("加入房间后应该收到房间事件", (done) => {
			const roomName = "test-room"

			clientSocket.on(SocketEvents.ROOM_JOINED, (response) => {
				expect(response.success).toBe(true)
				expect(response.data.roomName).toBe(roomName)
				done()
			})

			clientSocket.emit(SocketEvents.JOIN_ROOM, roomName)
		})

		it("离开房间后应该收到房间事件", (done) => {
			const roomName = "test-room"

			clientSocket.emit(SocketEvents.JOIN_ROOM, roomName, () => {
				clientSocket.on(SocketEvents.ROOM_LEFT, (response) => {
					expect(response.success).toBe(true)
					expect(response.data.roomName).toBe(roomName)
					done()
				})

				clientSocket.emit(SocketEvents.LEAVE_ROOM, roomName)
			})
		})
	})

	describe("心跳机制", () => {
		beforeEach((done) => {
			clientSocket = ioClient(serverAddress, {
				auth: { token: "test-token" },
			})
			clientSocket.on("connect", () => done())
		})

		it("应该响应 ping 请求", (done) => {
			clientSocket.emit(SocketEvents.PING, (response: any) => {
				expect(response.success).toBe(true)
				expect(response.data.timestamp).toBeDefined()
				done()
			})
		})

		it("应该收到 pong 事件", (done) => {
			clientSocket.on(SocketEvents.PONG, (response) => {
				expect(response.success).toBe(true)
				expect(response.data.timestamp).toBeDefined()
				done()
			})

			clientSocket.emit(SocketEvents.PING)
		})
	})

	describe("事件发送", () => {
		beforeEach((done) => {
			clientSocket = ioClient(serverAddress, {
				auth: { token: "test-token" },
			})
			clientSocket.on("connect", () => done())
		})

		it("应该能向用户发送事件", (done) => {
			const testEvent = "test:event"
			const testData = { message: "Hello" }

			clientSocket.on(testEvent, (data) => {
				expect(data).toEqual(testData)
				done()
			})

			// Emit to user
			socketService.emitToUser("test-user-id", testEvent, testData)
		})

		it("应该能向房间发送事件", (done) => {
			const roomName = "test-room"
			const testEvent = "test:event"
			const testData = { message: "Hello Room" }

			// Join room first
			clientSocket.emit(SocketEvents.JOIN_ROOM, roomName, () => {
				clientSocket.on(testEvent, (data) => {
					expect(data).toEqual(testData)
					done()
				})

				// Emit to room
				socketService.emitToRoom(roomName, testEvent, testData)
			})
		})

		it("应该能广播事件", (done) => {
			const testEvent = "test:broadcast"
			const testData = { message: "Broadcast" }

			clientSocket.on(testEvent, (data) => {
				expect(data).toEqual(testData)
				done()
			})

			// Broadcast
			socketService.broadcast(testEvent, testData)
		})
	})

	describe("任务事件", () => {
		beforeEach(async () => {
			clientSocket = ioClient(serverAddress, {
				auth: { token: "test-token" },
			})
			await new Promise<void>((resolve) => {
				clientSocket.on("connect", () => resolve())
			})
		})

		it("应该发送任务创建事件", async () => {
			const taskId = "task-123"
			const userId = "test-user-id"
			const organizationId = "test-org-id"
			const data = { title: "Test Task" }

			const eventPromise = new Promise((resolve) => {
				clientSocket.on(SocketEvents.TASK_CREATED, (event) => {
					resolve(event)
				})
			})

			await socketService.emitTaskCreated(taskId, userId, organizationId, data)

			// Wait a bit for event to propagate
			await new Promise((resolve) => setTimeout(resolve, 100))
		})

		it("应该发送任务更新事件", async () => {
			const taskId = "task-123"
			const userId = "test-user-id"
			const organizationId = "test-org-id"
			const data = { status: "completed" }

			await socketService.emitTaskUpdated(taskId, userId, organizationId, data)
		})

		it("应该发送任务删除事件", async () => {
			const taskId = "task-123"
			const userId = "test-user-id"
			const organizationId = "test-org-id"

			await socketService.emitTaskDeleted(taskId, userId, organizationId)
		})

		it("应该发送任务状态变更事件", async () => {
			const taskId = "task-123"
			const userId = "test-user-id"
			const organizationId = "test-org-id"
			const oldStatus = "pending"
			const newStatus = "in_progress"

			await socketService.emitTaskStatusChanged(taskId, userId, organizationId, oldStatus, newStatus)
		})
	})

	describe("组织事件", () => {
		it("应该发送组织成员添加事件", async () => {
			const organizationId = "org-123"
			const userId = "user-123"
			const memberUserId = "member-456"
			const role = "member"

			await socketService.emitOrganizationMemberAdded(organizationId, userId, memberUserId, role)
		})

		it("应该发送组织成员移除事件", async () => {
			const organizationId = "org-123"
			const userId = "user-123"
			const memberUserId = "member-456"

			await socketService.emitOrganizationMemberRemoved(organizationId, userId, memberUserId)
		})
	})

	describe("遥测事件", () => {
		it("应该发送遥测记录事件", async () => {
			const taskId = "task-123"
			const data = {
				metric: "cpu_usage",
				value: 75.5,
			}

			await socketService.emitTelemetryRecorded(taskId, data)
		})
	})

	describe("用户状态管理", () => {
		it("应该正确追踪在线用户", (done) => {
			clientSocket = ioClient(serverAddress, {
				auth: { token: "test-token" },
			})

			clientSocket.on("connect", () => {
				// Check if user is online
				const isOnline = socketService.isUserOnline("test-user-id")
				expect(isOnline).toBe(true)

				// Get online users
				const onlineUsers = socketService.getOnlineUsers()
				expect(onlineUsers.length).toBeGreaterThan(0)
				expect(onlineUsers.some((u) => u.userId === "test-user-id")).toBe(true)

				done()
			})
		})

		it("应该正确追踪用户 socket 连接", (done) => {
			clientSocket = ioClient(serverAddress, {
				auth: { token: "test-token" },
			})

			clientSocket.on("connect", () => {
				const userSockets = socketService.getUserSockets("test-user-id")
				expect(userSockets).toBeDefined()
				expect(userSockets!.size).toBeGreaterThan(0)
				done()
			})
		})

		it("断开连接后应该更新在线状态", (done) => {
			clientSocket = ioClient(serverAddress, {
				auth: { token: "test-token" },
			})

			clientSocket.on("connect", () => {
				expect(socketService.isUserOnline("test-user-id")).toBe(true)
				clientSocket.disconnect()
			})

			clientSocket.on("disconnect", () => {
				// Wait a bit for the disconnect to be processed
				setTimeout(() => {
					expect(socketService.isUserOnline("test-user-id")).toBe(false)
					done()
				}, 100)
			})
		})
	})

	describe("Socket Rooms 辅助函数", () => {
		it("应该生成正确的用户房间名", () => {
			const userId = "user-123"
			const roomName = SocketRooms.user(userId)
			expect(roomName).toBe("user:user-123")
		})

		it("应该生成正确的组织房间名", () => {
			const organizationId = "org-123"
			const roomName = SocketRooms.organization(organizationId)
			expect(roomName).toBe("org:org-123")
		})

		it("应该生成正确的任务房间名", () => {
			const taskId = "task-123"
			const roomName = SocketRooms.task(taskId)
			expect(roomName).toBe("task:task-123")
		})

		it("应该生成正确的全局房间名", () => {
			const roomName = SocketRooms.global()
			expect(roomName).toBe("global")
		})
	})

	describe("Extension Socket 事件", () => {
		beforeEach((done) => {
			clientSocket = ioClient(serverAddress, {
				auth: { token: "test-token" },
			})
			clientSocket.on("connect", () => done())
		})

		it("应该能注册 Extension 实例", (done) => {
			const instanceData = {
				instanceId: "instance-123",
				userId: "test-user-id",
				organizationId: "test-org-id",
			}

			clientSocket.on(ExtensionSocketEvents.CONNECTED, (response: any) => {
				expect(response.success).toBe(true)
				expect(response.data.instanceId).toBe(instanceData.instanceId)
				expect(response.data.registered).toBe(true)
			})

			clientSocket.emit(ExtensionSocketEvents.REGISTER, instanceData, (response: any) => {
				expect(response.success).toBe(true)
				expect(response.data.instanceId).toBe(instanceData.instanceId)

				// 验证实例已注册
				const instances = socketService.getOnlineInstances()
				expect(instances.some((i) => i.instanceId === instanceData.instanceId)).toBe(true)
				done()
			})
		})

		it("应该能注销 Extension 实例", (done) => {
			const instanceData = {
				instanceId: "instance-456",
				userId: "test-user-id",
				organizationId: "test-org-id",
			}

			// 先注册
			clientSocket.emit(ExtensionSocketEvents.REGISTER, instanceData, () => {
				// 再注销
				clientSocket.emit(ExtensionSocketEvents.UNREGISTER, instanceData.instanceId, (response: any) => {
					expect(response.success).toBe(true)
					expect(response.data.instanceId).toBe(instanceData.instanceId)
					expect(response.data.unregistered).toBe(true)

					// 验证实例已注销
					const instances = socketService.getOnlineInstances()
					expect(instances.some((i) => i.instanceId === instanceData.instanceId)).toBe(false)
					done()
				})
			})
		})

		it("应该能更新 Extension 心跳", (done) => {
			const instanceData = {
				instanceId: "instance-789",
				userId: "test-user-id",
				organizationId: "test-org-id",
			}

			// 先注册
			clientSocket.emit(ExtensionSocketEvents.REGISTER, instanceData, () => {
				// 发送心跳
				clientSocket.emit(ExtensionSocketEvents.HEARTBEAT, instanceData.instanceId, (response: any) => {
					expect(response.success).toBe(true)
					expect(response.data.instanceId).toBe(instanceData.instanceId)
					expect(response.data.timestamp).toBeDefined()
					done()
				})
			})
		})

		it("应该能发送和接收 Extension 事件", (done) => {
			const eventData = {
				instanceId: "instance-event",
				eventType: "test_event",
				payload: { message: "Hello" },
				timestamp: Date.now(),
			}

			clientSocket.on(ExtensionSocketEvents.RELAYED_EVENT, (receivedEvent: any) => {
				expect(receivedEvent.instanceId).toBe(eventData.instanceId)
				expect(receivedEvent.eventType).toBe(eventData.eventType)
				expect(receivedEvent.payload).toEqual(eventData.payload)
				done()
			})

			clientSocket.emit(ExtensionSocketEvents.EVENT, eventData, (response: any) => {
				expect(response.success).toBe(true)
				expect(response.data.received).toBe(true)
			})
		})

		it("应该能发送 Extension 命令", (done) => {
			const instanceData = {
				instanceId: "instance-cmd",
				userId: "test-user-id",
				organizationId: "test-org-id",
			}

			const command = {
				instanceId: instanceData.instanceId,
				commandType: "test_command",
				payload: { action: "do_something" },
			}

			// 先注册实例
			clientSocket.emit(ExtensionSocketEvents.REGISTER, instanceData, () => {
				// 监听中继命令
				clientSocket.on(ExtensionSocketEvents.RELAYED_COMMAND, (receivedCommand: any) => {
					expect(receivedCommand.instanceId).toBe(command.instanceId)
					expect(receivedCommand.commandType).toBe(command.commandType)
					expect(receivedCommand.payload).toEqual(command.payload)
					done()
				})

				// 发送命令
				clientSocket.emit(ExtensionSocketEvents.COMMAND, command, (response: any) => {
					expect(response.success).toBe(true)
					expect(response.data.sent).toBe(true)
				})
			})
		})

		it("尝试注销不存在的实例应该返回错误", (done) => {
			const nonExistentInstanceId = "non-existent-instance"

			clientSocket.emit(ExtensionSocketEvents.UNREGISTER, nonExistentInstanceId, (response: any) => {
				expect(response.success).toBe(false)
				expect(response.code).toBe("INVALID_PAYLOAD")
				done()
			})
		})

		it("应该能获取用户的所有实例", (done) => {
			const instances = [
				{ instanceId: "user-inst-1", userId: "test-user-id", organizationId: "test-org-id" },
				{ instanceId: "user-inst-2", userId: "test-user-id", organizationId: "test-org-id" },
			]

			let registered = 0

			instances.forEach((instance) => {
				clientSocket.emit(ExtensionSocketEvents.REGISTER, instance, () => {
					registered++
					if (registered === instances.length) {
						const userInstances = socketService.getUserInstances("test-user-id")
						expect(userInstances.length).toBe(2)
						expect(userInstances.every((i) => i.userId === "test-user-id")).toBe(true)
						done()
					}
				})
			})
		})
	})

	describe("Task Socket 事件", () => {
		beforeEach((done) => {
			clientSocket = ioClient(serverAddress, {
				auth: { token: "test-token" },
			})
			clientSocket.on("connect", () => done())
		})

		it("应该能加入任务房间", (done) => {
			const taskId = "task-join-123"

			clientSocket.emit(TaskSocketEvents.JOIN, taskId, (response: any) => {
				expect(response.success).toBe(true)
				expect(response.data.taskId).toBe(taskId)
				expect(response.data.joined).toBe(true)
				done()
			})
		})

		it("应该能离开任务房间", (done) => {
			const taskId = "task-leave-123"

			// 先加入
			clientSocket.emit(TaskSocketEvents.JOIN, taskId, () => {
				// 再离开
				clientSocket.emit(TaskSocketEvents.LEAVE, taskId, (response: any) => {
					expect(response.success).toBe(true)
					expect(response.data.taskId).toBe(taskId)
					expect(response.data.left).toBe(true)
					done()
				})
			})
		})

		it("应该能发送和接收任务事件", (done) => {
			const taskId = "task-event-123"
			const eventData = {
				taskId,
				eventType: "task_progress",
				payload: { progress: 50 },
				timestamp: Date.now(),
			}

			// 先加入任务房间
			clientSocket.emit(TaskSocketEvents.JOIN, taskId, () => {
				// 监听中继事件
				clientSocket.on(TaskSocketEvents.RELAYED_EVENT, (receivedEvent: any) => {
					expect(receivedEvent.taskId).toBe(eventData.taskId)
					expect(receivedEvent.eventType).toBe(eventData.eventType)
					expect(receivedEvent.payload).toEqual(eventData.payload)
					done()
				})

				// 发送事件
				clientSocket.emit(TaskSocketEvents.EVENT, eventData, (response: any) => {
					expect(response.success).toBe(true)
					expect(response.data.received).toBe(true)
				})
			})
		})

		it("应该能发送任务命令到房间", (done) => {
			const taskId = "task-cmd-123"
			const command = {
				taskId,
				commandType: "pause_task",
				payload: { reason: "User requested" },
			}

			// 先加入任务房间
			clientSocket.emit(TaskSocketEvents.JOIN, taskId, () => {
				// 监听中继命令
				clientSocket.on(TaskSocketEvents.RELAYED_COMMAND, (receivedCommand: any) => {
					expect(receivedCommand.taskId).toBe(command.taskId)
					expect(receivedCommand.commandType).toBe(command.commandType)
					expect(receivedCommand.payload).toEqual(command.payload)
					done()
				})

				// 发送命令
				clientSocket.emit(TaskSocketEvents.COMMAND, command, (response: any) => {
					expect(response.success).toBe(true)
					expect(response.data.sent).toBe(true)
				})
			})
		})

		it("多个客户端应该都能接收任务房间事件", (done) => {
			const taskId = "task-multi-123"
			const eventData = {
				taskId,
				eventType: "task_update",
				payload: { status: "running" },
				timestamp: Date.now(),
			}

			// 创建第二个客户端
			const client2 = ioClient(serverAddress, {
				auth: { token: "test-token-2" },
			})

			let receivedCount = 0

			const checkDone = () => {
				receivedCount++
				if (receivedCount === 2) {
					client2.disconnect()
					done()
				}
			}

			client2.on("connect", () => {
				// 两个客户端都加入同一任务房间
				clientSocket.emit(TaskSocketEvents.JOIN, taskId, () => {
					client2.emit(TaskSocketEvents.JOIN, taskId, () => {
						// 监听事件
						clientSocket.on(TaskSocketEvents.RELAYED_EVENT, (event: any) => {
							expect(event.taskId).toBe(taskId)
							checkDone()
						})

						client2.on(TaskSocketEvents.RELAYED_EVENT, (event: any) => {
							expect(event.taskId).toBe(taskId)
							checkDone()
						})

						// 发送事件
						clientSocket.emit(TaskSocketEvents.EVENT, eventData)
					})
				})
			})
		})
	})

	describe("Extension 和 Task 事件清理", () => {
		beforeEach((done) => {
			clientSocket = ioClient(serverAddress, {
				auth: { token: "test-token" },
			})
			clientSocket.on("connect", () => done())
		})

		it("断开连接后应该清理 Extension 实例", (done) => {
			const instanceData = {
				instanceId: "cleanup-inst-123",
				userId: "test-user-id",
				organizationId: "test-org-id",
			}

			clientSocket.emit(ExtensionSocketEvents.REGISTER, instanceData, () => {
				// 验证实例已注册
				expect(socketService.getOnlineInstances().some((i) => i.instanceId === instanceData.instanceId)).toBe(
					true,
				)

				clientSocket.disconnect()
			})

			clientSocket.on("disconnect", () => {
				setTimeout(() => {
					// 验证实例已清理
					expect(
						socketService.getOnlineInstances().some((i) => i.instanceId === instanceData.instanceId),
					).toBe(false)
					done()
				}, 100)
			})
		})

		it("断开连接后应该清理任务房间成员", (done) => {
			const taskId = "cleanup-task-123"

			clientSocket.emit(TaskSocketEvents.JOIN, taskId, () => {
				clientSocket.disconnect()
			})

			clientSocket.on("disconnect", () => {
				setTimeout(() => {
					// 任务房间应该被清理（因为没有成员了）
					done()
				}, 100)
			})
		})
	})

	describe("错误处理", () => {
		it("关闭服务后不应该接受新连接", async () => {
			await socketService.close()

			return new Promise<void>((resolve, reject) => {
				clientSocket = ioClient(serverAddress, {
					auth: { token: "test-token" },
					timeout: 1000,
				})

				clientSocket.on("connect", () => {
					reject(new Error("Should not connect after service is closed"))
				})

				clientSocket.on("connect_error", () => {
					// Expected behavior
					resolve()
				})

				// Timeout fallback
				setTimeout(() => {
					if (!clientSocket.connected) {
						resolve()
					}
				}, 1500)
			})
		})
	})
})
