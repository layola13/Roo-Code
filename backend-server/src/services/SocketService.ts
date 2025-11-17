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
 * Socket.IO 服务类
 * 负责管理 WebSocket 连接、房间、用户状态和事件推送
 */
export class SocketService {
	private io: SocketIOServer | null = null
	private publisher: Redis | null = null
	private subscriber: Redis | null = null
	private onlineUsers: Map<string, Set<string>> = new Map() // userId -> Set<socketId>
	private userRooms: Map<string, Set<string>> = new Map() // socketId -> Set<roomName>
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
	 * 获取 Socket.IO 服务器实例
	 */
	public getIO(): SocketIOServer | null {
		return this.io
	}
}
