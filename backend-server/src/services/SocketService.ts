import { Server as SocketIOServer, Socket } from "socket.io"
import { Server as HTTPServer } from "http"
import { Redis } from "ioredis"
import {
	createSocketServer,
	SocketEvents,
	SocketRooms,
	createSocketErrorResponse,
	createSocketSuccessResponse,
	SocketErrorCodes,
	ExtensionSocketEvents,
	TaskSocketEvents,
} from "../config/socket.js"
import { socketAuthMiddleware } from "../middleware/socketAuth.js"
import { createRedisPubSubClient } from "../config/redis.js"
import { logger } from "../utils/logger.js"

/**
 * Socket 事件数据接口
 */
export interface SocketEventData {
	type: string
	payload: any
	timestamp: number
	userId?: string
	organizationId?: string
}

/**
 * 在线用户信息接口
 */
export interface OnlineUser {
	userId: string
	socketId: string
	organizationId?: string
	connectedAt: number
}

/**
 * Extension 实例信息接口
 */
export interface ExtensionInstance {
	instanceId: string
	userId: string
	socketId: string
	organizationId?: string
	registeredAt: number
	lastHeartbeat: number
}

/**
 * Extension 事件数据接口
 */
export interface ExtensionEventData {
	instanceId: string
	eventType: string
	payload: any
	timestamp: number
}

/**
 * Task 事件数据接口
 */
export interface TaskEventData {
	taskId: string
	eventType: string
	payload: any
	timestamp: number
}

/**
 * Socket.IO 服务类
 * 负责管理 WebSocket 连接、房间、用户状态和事件推送
 */
export class SocketService {
	private io: SocketIOServer | null = null
	private publisher: Redis | null = null
	private subscriber: Redis | null = null
	private onlineUsers: Map<string, Set<string>> = new Map() // userId -> Set<socketId>
	private userRooms: Map<string, Set<string>> = new Map() // socketId -> Set<roomName>
	private extensionInstances: Map<string, ExtensionInstance> = new Map() // instanceId -> ExtensionInstance
	private taskRooms: Map<string, Set<string>> = new Map() // taskId -> Set<socketId>
	private isInitialized = false

	/**
	 * 初始化 Socket.IO 服务
	 * @param httpServer HTTP 服务器实例
	 */
	async initialize(httpServer: HTTPServer): Promise<void> {
		if (this.isInitialized) {
			logger.warn("SocketService already initialized")
			return
		}

		try {
			// 创建 Socket.IO 服务器
			this.io = createSocketServer(httpServer)

			// 创建 Redis pub/sub 客户端用于多实例通信
			this.publisher = createRedisPubSubClient()
			this.subscriber = createRedisPubSubClient()

			// 应用认证中间件
			this.io.use(socketAuthMiddleware())

			// 设置事件监听器
			this.setupEventListeners()

			// 订阅 Redis 频道
			await this.setupRedisSubscriptions()

			this.isInitialized = true
			logger.info("SocketService initialized successfully")
		} catch (error) {
			logger.error("Failed to initialize SocketService", { error })
			throw error
		}
	}

	/**
	 * 设置 Socket.IO 事件监听器
	 */
	private setupEventListeners(): void {
		if (!this.io) return

		this.io.on(SocketEvents.CONNECTION, (socket: Socket) => {
			this.handleConnection(socket)

			// 处理断开连接
			socket.on(SocketEvents.DISCONNECT, () => {
				this.handleDisconnect(socket)
			})

			// 处理加入房间
			socket.on(SocketEvents.JOIN_ROOM, (roomName: string, callback) => {
				this.handleJoinRoom(socket, roomName, callback)
			})

			// 处理离开房间
			socket.on(SocketEvents.LEAVE_ROOM, (roomName: string, callback) => {
				this.handleLeaveRoom(socket, roomName, callback)
			})

			// 处理心跳
			socket.on(SocketEvents.PING, (callback) => {
				this.handlePing(socket, callback)
			})

			// Extension 事件处理
			socket.on(ExtensionSocketEvents.REGISTER, (data, callback) => {
				this.handleExtensionRegister(socket, data, callback)
			})

			socket.on(ExtensionSocketEvents.UNREGISTER, (instanceId, callback) => {
				this.handleExtensionUnregister(socket, instanceId, callback)
			})

			socket.on(ExtensionSocketEvents.HEARTBEAT, (instanceId, callback) => {
				this.handleExtensionHeartbeat(socket, instanceId, callback)
			})

			socket.on(ExtensionSocketEvents.EVENT, (eventData, callback) => {
				this.handleExtensionEvent(socket, eventData, callback)
			})

			socket.on(ExtensionSocketEvents.COMMAND, (command, callback) => {
				this.handleExtensionCommand(socket, command, callback)
			})

			// Task 事件处理
			socket.on(TaskSocketEvents.JOIN, (taskId, callback) => {
				this.handleTaskJoin(socket, taskId, callback)
			})

			socket.on(TaskSocketEvents.LEAVE, (taskId, callback) => {
				this.handleTaskLeave(socket, taskId, callback)
			})

			socket.on(TaskSocketEvents.EVENT, (eventData, callback) => {
				this.handleTaskSocketEvent(socket, eventData, callback)
			})

			socket.on(TaskSocketEvents.COMMAND, (command, callback) => {
				this.handleTaskCommand(socket, command, callback)
			})

			// 处理错误
			socket.on(SocketEvents.ERROR, (error) => {
				logger.error("Socket error", { socketId: socket.id, error })
			})
		})
	}

	/**
	 * 处理新连接
	 */
	private handleConnection(socket: Socket): void {
		const userId = socket.userData?.userId
		const organizationId = socket.userData?.organizationId

		logger.info("Socket connected", {
			socketId: socket.id,
			userId,
			organizationId,
		})

		if (userId) {
			// 记录在线用户
			if (!this.onlineUsers.has(userId)) {
				this.onlineUsers.set(userId, new Set())
			}
			this.onlineUsers.get(userId)?.add(socket.id)

			// 自动加入用户私有房间
			const userRoom = SocketRooms.user(userId)
			socket.join(userRoom)

			// 如果有组织，加入组织房间
			if (organizationId) {
				const orgRoom = SocketRooms.organization(organizationId)
				socket.join(orgRoom)
			}

			// 广播用户上线事件
			this.broadcastUserOnline(userId, organizationId)

			// 通知客户端连接成功
			socket.emit(
				SocketEvents.AUTHENTICATED,
				createSocketSuccessResponse({
					userId,
					organizationId,
					rooms: Array.from(socket.rooms),
				}),
			)
		}
	}

	/**
	 * 处理断开连接
	 */
	private handleDisconnect(socket: Socket): void {
		const userId = socket.userData?.userId
		const organizationId = socket.userData?.organizationId

		logger.info("Socket disconnected", {
			socketId: socket.id,
			userId,
			organizationId,
		})

		if (userId) {
			// 从在线用户列表中移除
			const userSockets = this.onlineUsers.get(userId)
			if (userSockets) {
				userSockets.delete(socket.id)
				if (userSockets.size === 0) {
					this.onlineUsers.delete(userId)
					// 用户完全离线，广播离线事件
					this.broadcastUserOffline(userId, organizationId)
				}
			}
		}

		// 清理 Extension 实例
		for (const [instanceId, instance] of this.extensionInstances.entries()) {
			if (instance.socketId === socket.id) {
				this.extensionInstances.delete(instanceId)
				logger.info("Extension instance unregistered on disconnect", { instanceId })
			}
		}

		// 清理 Task 房间
		for (const [taskId, sockets] of this.taskRooms.entries()) {
			if (sockets.has(socket.id)) {
				sockets.delete(socket.id)
				if (sockets.size === 0) {
					this.taskRooms.delete(taskId)
				}
			}
		}

		// 清理房间记录
		this.userRooms.delete(socket.id)
	}

	/**
	 * 处理加入房间
	 */
	private handleJoinRoom(socket: Socket, roomName: string, callback?: (response: any) => void): void {
		try {
			socket.join(roomName)

			// 记录房间
			if (!this.userRooms.has(socket.id)) {
				this.userRooms.set(socket.id, new Set())
			}
			this.userRooms.get(socket.id)?.add(roomName)

			logger.debug("Socket joined room", {
				socketId: socket.id,
				userId: socket.userData?.userId,
				roomName,
			})

			const response = createSocketSuccessResponse({
				roomName,
				joined: true,
			})

			socket.emit(SocketEvents.ROOM_JOINED, response)
			if (callback) callback(response)
		} catch (error) {
			logger.error("Failed to join room", {
				socketId: socket.id,
				roomName,
				error,
			})

			const response = createSocketErrorResponse("Failed to join room", SocketErrorCodes.ROOM_JOIN_FAILED)

			if (callback) callback(response)
		}
	}

	/**
	 * 处理离开房间
	 */
	private handleLeaveRoom(socket: Socket, roomName: string, callback?: (response: any) => void): void {
		try {
			socket.leave(roomName)

			// 从房间记录中移除
			this.userRooms.get(socket.id)?.delete(roomName)

			logger.debug("Socket left room", {
				socketId: socket.id,
				userId: socket.userData?.userId,
				roomName,
			})

			const response = createSocketSuccessResponse({
				roomName,
				left: true,
			})

			socket.emit(SocketEvents.ROOM_LEFT, response)
			if (callback) callback(response)
		} catch (error) {
			logger.error("Failed to leave room", {
				socketId: socket.id,
				roomName,
				error,
			})

			const response = createSocketErrorResponse("Failed to leave room", SocketErrorCodes.ROOM_LEAVE_FAILED)

			if (callback) callback(response)
		}
	}

	/**
	 * 处理心跳
	 */
	private handlePing(socket: Socket, callback?: (response: any) => void): void {
		const response = createSocketSuccessResponse({
			timestamp: Date.now(),
		})

		socket.emit(SocketEvents.PONG, response)
		if (callback) callback(response)
	}

	/**
	 * 广播用户上线事件
	 */
	private broadcastUserOnline(userId: string, organizationId?: string): void {
		const event: SocketEventData = {
			type: SocketEvents.USER_ONLINE,
			payload: { userId, organizationId },
			timestamp: Date.now(),
			userId,
			organizationId,
		}

		// 发布到 Redis 供其他实例使用
		this.publishEvent(SocketEvents.USER_ONLINE, event)

		// 广播到组织房间
		if (organizationId) {
			this.emitToRoom(SocketRooms.organization(organizationId), SocketEvents.USER_ONLINE, event)
		}
	}

	/**
	 * 广播用户离线事件
	 */
	private broadcastUserOffline(userId: string, organizationId?: string): void {
		const event: SocketEventData = {
			type: SocketEvents.USER_OFFLINE,
			payload: { userId, organizationId },
			timestamp: Date.now(),
			userId,
			organizationId,
		}

		// 发布到 Redis 供其他实例使用
		this.publishEvent(SocketEvents.USER_OFFLINE, event)

		// 广播到组织房间
		if (organizationId) {
			this.emitToRoom(SocketRooms.organization(organizationId), SocketEvents.USER_OFFLINE, event)
		}
	}

	/**
	 * 设置 Redis 订阅
	 */
	private async setupRedisSubscriptions(): Promise<void> {
		if (!this.subscriber) return

		// 订阅所有 Socket 事件频道
		const channels = Object.values(SocketEvents).filter(
			(event) => !["connection", "disconnect", "disconnecting", "error"].includes(event),
		)

		await this.subscriber.subscribe(...channels)

		this.subscriber.on("message", (channel: string, message: string) => {
			try {
				const event: SocketEventData = JSON.parse(message)
				this.handleRedisEvent(channel, event)
			} catch (error) {
				logger.error("Failed to parse Redis message", { channel, error })
			}
		})

		logger.info("Redis subscriptions setup complete", { channels })
	}

	/**
	 * 处理 Redis 事件
	 */
	private handleRedisEvent(channel: string, event: SocketEventData): void {
		logger.debug("Received Redis event", { channel, event })

		// 根据事件类型分发到相应的房间
		switch (channel) {
			case SocketEvents.TASK_CREATED:
			case SocketEvents.TASK_UPDATED:
			case SocketEvents.TASK_DELETED:
			case SocketEvents.TASK_STATUS_CHANGED:
				this.handleTaskEvent(event)
				break

			case SocketEvents.ORGANIZATION_MEMBER_ADDED:
			case SocketEvents.ORGANIZATION_MEMBER_REMOVED:
			case SocketEvents.ORGANIZATION_UPDATED:
				this.handleOrganizationEvent(event)
				break

			case SocketEvents.TELEMETRY_RECORDED:
				this.handleTelemetryEvent(event)
				break

			case SocketEvents.USER_ONLINE:
			case SocketEvents.USER_OFFLINE:
				this.handleUserStatusEvent(event)
				break

			default:
				logger.debug("Unhandled Redis event", { channel })
		}
	}

	/**
	 * 处理任务事件
	 */
	private handleTaskEvent(event: SocketEventData): void {
		const { payload, organizationId } = event

		// 发送到任务房间
		if (payload.taskId) {
			this.emitToRoom(SocketRooms.task(payload.taskId), event.type, event)
		}

		// 发送到组织房间
		if (organizationId) {
			this.emitToRoom(SocketRooms.organization(organizationId), event.type, event)
		}

		// 发送到用户房间
		if (payload.userId) {
			this.emitToUser(payload.userId, event.type, event)
		}
	}

	/**
	 * 处理组织事件
	 */
	private handleOrganizationEvent(event: SocketEventData): void {
		const { payload, organizationId } = event

		// 发送到组织房间
		if (organizationId) {
			this.emitToRoom(SocketRooms.organization(organizationId), event.type, event)
		}

		// 如果有特定用户，也发送到用户房间
		if (payload.userId) {
			this.emitToUser(payload.userId, event.type, event)
		}
	}

	/**
	 * 处理遥测事件
	 */
	private handleTelemetryEvent(event: SocketEventData): void {
		const { payload } = event

		// 发送到任务房间
		if (payload.taskId) {
			this.emitToRoom(SocketRooms.task(payload.taskId), event.type, event)
		}
	}

	/**
	 * 处理用户状态事件
	 */
	private handleUserStatusEvent(event: SocketEventData): void {
		const { organizationId } = event

		// 发送到组织房间
		if (organizationId) {
			this.emitToRoom(SocketRooms.organization(organizationId), event.type, event)
		}
	}

	/**
	 * 发布事件到 Redis
	 */
	private publishEvent(channel: string, event: SocketEventData): void {
		if (!this.publisher) return

		this.publisher.publish(channel, JSON.stringify(event)).catch((error) => {
			logger.error("Failed to publish event to Redis", { channel, error })
		})
	}

	/**
	 * 向特定房间发送事件
	 */
	public emitToRoom(roomName: string, event: string, data: any): void {
		if (!this.io) return

		this.io.to(roomName).emit(event, data)
		logger.debug("Emitted to room", { roomName, event })
	}

	/**
	 * 向特定用户发送事件
	 */
	public emitToUser(userId: string, event: string, data: any): void {
		if (!this.io) return

		const userRoom = SocketRooms.user(userId)
		this.io.to(userRoom).emit(event, data)
		logger.debug("Emitted to user", { userId, event })
	}

	/**
	 * 向所有连接的客户端广播事件
	 */
	public broadcast(event: string, data: any): void {
		if (!this.io) return

		this.io.emit(event, data)
		logger.debug("Broadcasted event", { event })
	}

	/**
	 * 发送任务创建事件
	 */
	public async emitTaskCreated(
		taskId: string,
		userId: string,
		organizationId: string | undefined,
		data: any,
	): Promise<void> {
		const event: SocketEventData = {
			type: SocketEvents.TASK_CREATED,
			payload: { taskId, userId, ...data },
			timestamp: Date.now(),
			userId,
			organizationId,
		}

		this.publishEvent(SocketEvents.TASK_CREATED, event)
	}

	/**
	 * 发送任务更新事件
	 */
	public async emitTaskUpdated(
		taskId: string,
		userId: string,
		organizationId: string | undefined,
		data: any,
	): Promise<void> {
		const event: SocketEventData = {
			type: SocketEvents.TASK_UPDATED,
			payload: { taskId, userId, ...data },
			timestamp: Date.now(),
			userId,
			organizationId,
		}

		this.publishEvent(SocketEvents.TASK_UPDATED, event)
	}

	/**
	 * 发送任务删除事件
	 */
	public async emitTaskDeleted(taskId: string, userId: string, organizationId: string | undefined): Promise<void> {
		const event: SocketEventData = {
			type: SocketEvents.TASK_DELETED,
			payload: { taskId, userId },
			timestamp: Date.now(),
			userId,
			organizationId,
		}

		this.publishEvent(SocketEvents.TASK_DELETED, event)
	}

	/**
	 * 发送任务状态变更事件
	 */
	public async emitTaskStatusChanged(
		taskId: string,
		userId: string,
		organizationId: string | undefined,
		oldStatus: string,
		newStatus: string,
	): Promise<void> {
		const event: SocketEventData = {
			type: SocketEvents.TASK_STATUS_CHANGED,
			payload: { taskId, userId, oldStatus, newStatus },
			timestamp: Date.now(),
			userId,
			organizationId,
		}

		this.publishEvent(SocketEvents.TASK_STATUS_CHANGED, event)
	}

	/**
	 * 发送组织成员添加事件
	 */
	public async emitOrganizationMemberAdded(
		organizationId: string,
		userId: string,
		memberUserId: string,
		role: string,
	): Promise<void> {
		const event: SocketEventData = {
			type: SocketEvents.ORGANIZATION_MEMBER_ADDED,
			payload: { organizationId, userId, memberUserId, role },
			timestamp: Date.now(),
			userId,
			organizationId,
		}

		this.publishEvent(SocketEvents.ORGANIZATION_MEMBER_ADDED, event)
	}

	/**
	 * 发送组织成员移除事件
	 */
	public async emitOrganizationMemberRemoved(
		organizationId: string,
		userId: string,
		memberUserId: string,
	): Promise<void> {
		const event: SocketEventData = {
			type: SocketEvents.ORGANIZATION_MEMBER_REMOVED,
			payload: { organizationId, userId, memberUserId },
			timestamp: Date.now(),
			userId,
			organizationId,
		}

		this.publishEvent(SocketEvents.ORGANIZATION_MEMBER_REMOVED, event)
	}

	/**
	 * 发送遥测记录事件
	 */
	public async emitTelemetryRecorded(taskId: string, data: any): Promise<void> {
		const event: SocketEventData = {
			type: SocketEvents.TELEMETRY_RECORDED,
			payload: { taskId, ...data },
			timestamp: Date.now(),
		}

		this.publishEvent(SocketEvents.TELEMETRY_RECORDED, event)
	}

	/**
	 * 获取在线用户列表
	 */
	public getOnlineUsers(): OnlineUser[] {
		const users: OnlineUser[] = []

		for (const [userId, socketIds] of this.onlineUsers.entries()) {
			for (const socketId of socketIds) {
				const socket = this.io?.sockets.sockets.get(socketId)
				if (socket) {
					users.push({
						userId,
						socketId,
						organizationId: socket.userData?.organizationId,
						connectedAt: Date.now(), // 实际应用中应该记录真实连接时间
					})
				}
			}
		}

		return users
	}

	/**
	 * 检查用户是否在线
	 */
	public isUserOnline(userId: string): boolean {
		return this.onlineUsers.has(userId)
	}

	/**
	 * 获取用户的所有 Socket 连接
	 */
	public getUserSockets(userId: string): Set<string> | undefined {
		return this.onlineUsers.get(userId)
	}

	/**
	 * 关闭 Socket.IO 服务
	 */
	async close(): Promise<void> {
		if (!this.isInitialized) return

		try {
			// 关闭所有连接
			if (this.io) {
				this.io.close()
				this.io = null
			}

			// 关闭 Redis 连接
			if (this.publisher) {
				await this.publisher.quit()
				this.publisher = null
			}

			if (this.subscriber) {
				await this.subscriber.quit()
				this.subscriber = null
			}

			// 清理数据
			this.onlineUsers.clear()
			this.userRooms.clear()

			this.isInitialized = false
			logger.info("SocketService closed successfully")
		} catch (error) {
			logger.error("Failed to close SocketService", { error })
			throw error
		}
	}

	/**
	 * 处理 Extension 注册
	 */
	private handleExtensionRegister(socket: Socket, data: any, callback?: (response: any) => void): void {
		try {
			const { instanceId, userId, organizationId } = data
			const instance: ExtensionInstance = {
				instanceId,
				userId,
				socketId: socket.id,
				organizationId,
				registeredAt: Date.now(),
				lastHeartbeat: Date.now(),
			}

			this.extensionInstances.set(instanceId, instance)

			logger.info("Extension instance registered", {
				instanceId,
				userId,
				organizationId,
				socketId: socket.id,
			})

			const response = createSocketSuccessResponse({
				instanceId,
				registered: true,
			})

			socket.emit(ExtensionSocketEvents.CONNECTED, response)
			if (callback) callback(response)

			// 广播实例注册事件
			this.broadcastExtensionEvent({
				instanceId,
				eventType: "instance_registered",
				payload: { instance },
				timestamp: Date.now(),
			})
		} catch (error) {
			logger.error("Failed to register extension instance", { error })
			const response = createSocketErrorResponse(
				"Failed to register extension instance",
				SocketErrorCodes.INTERNAL_ERROR,
			)
			if (callback) callback(response)
		}
	}

	/**
	 * 处理 Extension 注销
	 */
	private handleExtensionUnregister(socket: Socket, instanceId: string, callback?: (response: any) => void): void {
		try {
			const instance = this.extensionInstances.get(instanceId)
			if (instance) {
				this.extensionInstances.delete(instanceId)

				logger.info("Extension instance unregistered", { instanceId })

				const response = createSocketSuccessResponse({
					instanceId,
					unregistered: true,
				})

				if (callback) callback(response)

				// 广播实例注销事件
				this.broadcastExtensionEvent({
					instanceId,
					eventType: "instance_unregistered",
					payload: { instance },
					timestamp: Date.now(),
				})
			} else {
				const response = createSocketErrorResponse("Instance not found", SocketErrorCodes.INVALID_PAYLOAD)
				if (callback) callback(response)
			}
		} catch (error) {
			logger.error("Failed to unregister extension instance", { instanceId, error })
			const response = createSocketErrorResponse(
				"Failed to unregister extension instance",
				SocketErrorCodes.INTERNAL_ERROR,
			)
			if (callback) callback(response)
		}
	}

	/**
	 * 处理 Extension 心跳
	 */
	private handleExtensionHeartbeat(socket: Socket, instanceId: string, callback?: (response: any) => void): void {
		try {
			const instance = this.extensionInstances.get(instanceId)
			if (instance) {
				instance.lastHeartbeat = Date.now()
				this.extensionInstances.set(instanceId, instance)

				const response = createSocketSuccessResponse({
					instanceId,
					timestamp: Date.now(),
				})

				if (callback) callback(response)
			} else {
				const response = createSocketErrorResponse("Instance not found", SocketErrorCodes.INVALID_PAYLOAD)
				if (callback) callback(response)
			}
		} catch (error) {
			logger.error("Failed to update extension heartbeat", { instanceId, error })
			const response = createSocketErrorResponse("Failed to update heartbeat", SocketErrorCodes.INTERNAL_ERROR)
			if (callback) callback(response)
		}
	}

	/**
	 * 处理 Extension 事件
	 */
	private handleExtensionEvent(
		socket: Socket,
		eventData: ExtensionEventData,
		callback?: (response: any) => void,
	): void {
		try {
			logger.debug("Received extension event", eventData)

			// 广播事件
			this.broadcastExtensionEvent(eventData)

			const response = createSocketSuccessResponse({
				received: true,
				timestamp: Date.now(),
			})

			if (callback) callback(response)
		} catch (error) {
			logger.error("Failed to handle extension event", { error })
			const response = createSocketErrorResponse(
				"Failed to handle extension event",
				SocketErrorCodes.INTERNAL_ERROR,
			)
			if (callback) callback(response)
		}
	}

	/**
	 * 处理 Extension 命令
	 */
	private handleExtensionCommand(socket: Socket, command: any, callback?: (response: any) => void): void {
		try {
			const { instanceId, commandType, payload } = command

			logger.debug("Received extension command", { instanceId, commandType })

			const instance = this.extensionInstances.get(instanceId)
			if (instance) {
				// 发送命令到目标实例
				this.io?.to(instance.socketId).emit(ExtensionSocketEvents.RELAYED_COMMAND, command)

				const response = createSocketSuccessResponse({
					sent: true,
					timestamp: Date.now(),
				})

				if (callback) callback(response)
			} else {
				const response = createSocketErrorResponse("Instance not found", SocketErrorCodes.INVALID_PAYLOAD)
				if (callback) callback(response)
			}
		} catch (error) {
			logger.error("Failed to handle extension command", { error })
			const response = createSocketErrorResponse(
				"Failed to handle extension command",
				SocketErrorCodes.INTERNAL_ERROR,
			)
			if (callback) callback(response)
		}
	}

	/**
	 * 广播 Extension 事件
	 */
	private broadcastExtensionEvent(eventData: ExtensionEventData): void {
		if (!this.io) return

		// 发布到 Redis 供其他实例使用
		this.publishEvent("extension:event", eventData as any)

		// 广播到所有连接的客户端
		this.io.emit(ExtensionSocketEvents.RELAYED_EVENT, eventData)

		logger.debug("Broadcasted extension event", { eventType: eventData.eventType })
	}

	/**
	 * 处理 Task 加入
	 */
	private handleTaskJoin(socket: Socket, taskId: string, callback?: (response: any) => void): void {
		try {
			// 加入任务房间
			const taskRoom = SocketRooms.task(taskId)
			socket.join(taskRoom)

			// 记录房间成员
			if (!this.taskRooms.has(taskId)) {
				this.taskRooms.set(taskId, new Set())
			}
			this.taskRooms.get(taskId)?.add(socket.id)

			logger.debug("Socket joined task room", {
				socketId: socket.id,
				userId: socket.userData?.userId,
				taskId,
			})

			const response = createSocketSuccessResponse({
				taskId,
				joined: true,
			})

			if (callback) callback(response)
		} catch (error) {
			logger.error("Failed to join task room", { taskId, error })
			const response = createSocketErrorResponse("Failed to join task room", SocketErrorCodes.ROOM_JOIN_FAILED)
			if (callback) callback(response)
		}
	}

	/**
	 * 处理 Task 离开
	 */
	private handleTaskLeave(socket: Socket, taskId: string, callback?: (response: any) => void): void {
		try {
			// 离开任务房间
			const taskRoom = SocketRooms.task(taskId)
			socket.leave(taskRoom)

			// 从房间记录中移除
			const taskSockets = this.taskRooms.get(taskId)
			if (taskSockets) {
				taskSockets.delete(socket.id)
				if (taskSockets.size === 0) {
					this.taskRooms.delete(taskId)
				}
			}

			logger.debug("Socket left task room", {
				socketId: socket.id,
				userId: socket.userData?.userId,
				taskId,
			})

			const response = createSocketSuccessResponse({
				taskId,
				left: true,
			})

			if (callback) callback(response)
		} catch (error) {
			logger.error("Failed to leave task room", { taskId, error })
			const response = createSocketErrorResponse("Failed to leave task room", SocketErrorCodes.ROOM_LEAVE_FAILED)
			if (callback) callback(response)
		}
	}

	/**
	 * 处理 Task Socket 事件
	 */
	private handleTaskSocketEvent(socket: Socket, eventData: TaskEventData, callback?: (response: any) => void): void {
		try {
			logger.debug("Received task socket event", eventData)

			// 广播到任务房间
			this.broadcastTaskEvent(eventData.taskId, eventData)

			const response = createSocketSuccessResponse({
				received: true,
				timestamp: Date.now(),
			})

			if (callback) callback(response)
		} catch (error) {
			logger.error("Failed to handle task socket event", { error })
			const response = createSocketErrorResponse("Failed to handle task event", SocketErrorCodes.INTERNAL_ERROR)
			if (callback) callback(response)
		}
	}

	/**
	 * 处理 Task 命令
	 */
	private handleTaskCommand(socket: Socket, command: any, callback?: (response: any) => void): void {
		try {
			const { taskId, commandType, payload } = command

			logger.debug("Received task command", { taskId, commandType })

			// 发送命令到任务房间的所有成员
			const taskRoom = SocketRooms.task(taskId)
			this.io?.to(taskRoom).emit(TaskSocketEvents.RELAYED_COMMAND, command)

			const response = createSocketSuccessResponse({
				sent: true,
				timestamp: Date.now(),
			})

			if (callback) callback(response)
		} catch (error) {
			logger.error("Failed to handle task command", { error })
			const response = createSocketErrorResponse("Failed to handle task command", SocketErrorCodes.INTERNAL_ERROR)
			if (callback) callback(response)
		}
	}

	/**
	 * 广播 Task 事件到任务房间
	 */
	private broadcastTaskEvent(taskId: string, eventData: TaskEventData): void {
		if (!this.io) return

		// 发布到 Redis 供其他实例使用
		this.publishEvent(`task:${taskId}`, eventData as any)

		// 广播到任务房间
		const taskRoom = SocketRooms.task(taskId)
		this.io.to(taskRoom).emit(TaskSocketEvents.RELAYED_EVENT, eventData)

		logger.debug("Broadcasted task event", { taskId, eventType: eventData.eventType })
	}

	/**
	 * 获取在线 Extension 实例列表
	 */
	public getOnlineInstances(): ExtensionInstance[] {
		return Array.from(this.extensionInstances.values())
	}

	/**
	 * 获取特定用户的 Extension 实例
	 */
	public getUserInstances(userId: string): ExtensionInstance[] {
		return Array.from(this.extensionInstances.values()).filter((instance) => instance.userId === userId)
	}

	/**
	 * 获取 Socket.IO 服务器实例
	 */
	public getIO(): SocketIOServer | null {
		return this.io
	}
}
