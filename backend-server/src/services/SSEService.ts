import { Response } from "express"
import { Redis } from "ioredis"
import { createRedisPubSubClient } from "../config/redis.js"
import { logger } from "../utils/logger.js"

/**
 * SSE 事件类型
 */
export enum SSEEventType {
	MESSAGE = "message",
	HEARTBEAT = "heartbeat",
	ERROR = "error",
	TASK_PROGRESS = "task:progress",
	TASK_STATUS = "task:status",
	TELEMETRY = "telemetry",
	ORGANIZATION_EVENT = "organization:event",
}

/**
 * SSE 连接信息
 */
export interface SSEConnection {
	id: string
	userId: string
	organizationId?: string
	response: Response
	channels: Set<string>
	createdAt: number
	lastHeartbeat: number
}

/**
 * SSE 事件数据
 */
export interface SSEEventData {
	id?: string
	event?: string
	data: any
	retry?: number
}

/**
 * SSE 服务类
 * 负责管理 Server-Sent Events 连接和事件流
 */
export class SSEService {
	private connections: Map<string, SSEConnection> = new Map()
	private subscriber: Redis | null = null
	private heartbeatInterval: NodeJS.Timeout | null = null
	private isInitialized = false

	// SSE 配置
	private readonly HEARTBEAT_INTERVAL = 30000 // 30 seconds
	private readonly CONNECTION_TIMEOUT = 300000 // 5 minutes
	private readonly RETRY_TIME = 3000 // 3 seconds

	/**
	 * 初始化 SSE 服务
	 */
	async initialize(): Promise<void> {
		if (this.isInitialized) {
			logger.warn("SSEService already initialized")
			return
		}

		try {
			// 创建 Redis 订阅客户端
			this.subscriber = createRedisPubSubClient()

			// 设置 Redis 订阅
			await this.setupRedisSubscriptions()

			// 启动心跳定时器
			this.startHeartbeat()

			this.isInitialized = true
			logger.info("SSEService initialized successfully")
		} catch (error) {
			logger.error("Failed to initialize SSEService", { error })
			throw error
		}
	}

	/**
	 * 设置 Redis 订阅
	 */
	private async setupRedisSubscriptions(): Promise<void> {
		if (!this.subscriber) return

		// 订阅所有 SSE 相关的频道
		const channels = ["sse:task:*", "sse:telemetry:*", "sse:organization:*"]

		// Redis pattern subscribe
		await this.subscriber.psubscribe(...channels)

		this.subscriber.on("pmessage", (pattern: string, channel: string, message: string) => {
			try {
				const event = JSON.parse(message)
				this.handleRedisMessage(channel, event)
			} catch (error) {
				logger.error("Failed to parse Redis SSE message", { channel, error })
			}
		})

		logger.info("Redis SSE subscriptions setup complete")
	}

	/**
	 * 处理 Redis 消息
	 */
	private handleRedisMessage(channel: string, event: any): void {
		// 向订阅了该频道的所有连接发送事件
		for (const [connectionId, connection] of this.connections) {
			if (connection.channels.has(channel)) {
				this.sendEvent(connectionId, {
					event: event.type || SSEEventType.MESSAGE,
					data: event,
				})
			}
		}
	}

	/**
	 * 启动心跳定时器
	 */
	private startHeartbeat(): void {
		this.heartbeatInterval = setInterval(() => {
			const now = Date.now()

			for (const [connectionId, connection] of this.connections) {
				// 检查连接超时
				if (now - connection.lastHeartbeat > this.CONNECTION_TIMEOUT) {
					logger.warn("SSE connection timeout", { connectionId, userId: connection.userId })
					this.closeConnection(connectionId)
					continue
				}

				// 发送心跳
				this.sendHeartbeat(connectionId)
			}
		}, this.HEARTBEAT_INTERVAL)

		logger.debug("SSE heartbeat started", { interval: this.HEARTBEAT_INTERVAL })
	}

	/**
	 * 停止心跳定时器
	 */
	private stopHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval)
			this.heartbeatInterval = null
			logger.debug("SSE heartbeat stopped")
		}
	}

	/**
	 * 创建 SSE 连接
	 */
	public createConnection(
		connectionId: string,
		userId: string,
		organizationId: string | undefined,
		res: Response,
	): void {
		// 设置 SSE 响应头
		res.setHeader("Content-Type", "text/event-stream")
		res.setHeader("Cache-Control", "no-cache")
		res.setHeader("Connection", "keep-alive")
		res.setHeader("X-Accel-Buffering", "no") // Nginx 支持

		// 发送初始重试时间
		res.write(`retry: ${this.RETRY_TIME}\n\n`)

		// 创建连接记录
		const connection: SSEConnection = {
			id: connectionId,
			userId,
			organizationId,
			response: res,
			channels: new Set(),
			createdAt: Date.now(),
			lastHeartbeat: Date.now(),
		}

		this.connections.set(connectionId, connection)

		// 处理客户端断开连接
		res.on("close", () => {
			this.closeConnection(connectionId)
		})

		logger.info("SSE connection created", {
			connectionId,
			userId,
			organizationId,
		})

		// 发送连接成功消息
		this.sendEvent(connectionId, {
			event: "connected",
			data: {
				connectionId,
				userId,
				organizationId,
				timestamp: Date.now(),
			},
		})
	}

	/**
	 * 关闭连接
	 */
	public closeConnection(connectionId: string): void {
		const connection = this.connections.get(connectionId)
		if (!connection) return

		try {
			// 发送关闭事件
			this.sendEvent(connectionId, {
				event: "close",
				data: { message: "Connection closed" },
			})

			// 结束响应
			if (!connection.response.writableEnded) {
				connection.response.end()
			}
		} catch (error) {
			logger.error("Error closing SSE connection", { connectionId, error })
		} finally {
			// 移除连接
			this.connections.delete(connectionId)

			logger.info("SSE connection closed", {
				connectionId,
				userId: connection.userId,
			})
		}
	}

	/**
	 * 订阅频道
	 */
	public subscribeToChannel(connectionId: string, channel: string): void {
		const connection = this.connections.get(connectionId)
		if (!connection) {
			logger.warn("SSE connection not found for subscribe", { connectionId, channel })
			return
		}

		connection.channels.add(channel)
		logger.debug("SSE connection subscribed to channel", {
			connectionId,
			channel,
			totalChannels: connection.channels.size,
		})
	}

	/**
	 * 取消订阅频道
	 */
	public unsubscribeFromChannel(connectionId: string, channel: string): void {
		const connection = this.connections.get(connectionId)
		if (!connection) return

		connection.channels.delete(channel)
		logger.debug("SSE connection unsubscribed from channel", {
			connectionId,
			channel,
			totalChannels: connection.channels.size,
		})
	}

	/**
	 * 发送事件
	 */
	public sendEvent(connectionId: string, event: SSEEventData): boolean {
		const connection = this.connections.get(connectionId)
		if (!connection) {
			logger.warn("SSE connection not found for send", { connectionId })
			return false
		}

		try {
			// 检查响应是否可写
			if (connection.response.writableEnded) {
				logger.warn("SSE response already ended", { connectionId })
				this.closeConnection(connectionId)
				return false
			}

			// 构建 SSE 消息
			let message = ""

			if (event.id) {
				message += `id: ${event.id}\n`
			}

			if (event.event) {
				message += `event: ${event.event}\n`
			}

			if (event.retry) {
				message += `retry: ${event.retry}\n`
			}

			// 数据字段（支持多行）
			const dataString = typeof event.data === "string" ? event.data : JSON.stringify(event.data)

			const dataLines = dataString.split("\n")
			for (const line of dataLines) {
				message += `data: ${line}\n`
			}

			message += "\n"

			// 写入响应
			connection.response.write(message)

			// 更新最后心跳时间
			connection.lastHeartbeat = Date.now()

			return true
		} catch (error) {
			logger.error("Failed to send SSE event", { connectionId, error })
			this.closeConnection(connectionId)
			return false
		}
	}

	/**
	 * 发送心跳
	 */
	private sendHeartbeat(connectionId: string): void {
		this.sendEvent(connectionId, {
			event: SSEEventType.HEARTBEAT,
			data: { timestamp: Date.now() },
		})
	}

	/**
	 * 向用户的所有连接发送事件
	 */
	public sendEventToUser(userId: string, event: SSEEventData): void {
		let sentCount = 0

		for (const [connectionId, connection] of this.connections) {
			if (connection.userId === userId) {
				if (this.sendEvent(connectionId, event)) {
					sentCount++
				}
			}
		}

		logger.debug("Sent SSE event to user connections", {
			userId,
			sentCount,
		})
	}

	/**
	 * 向组织的所有连接发送事件
	 */
	public sendEventToOrganization(organizationId: string, event: SSEEventData): void {
		let sentCount = 0

		for (const [connectionId, connection] of this.connections) {
			if (connection.organizationId === organizationId) {
				if (this.sendEvent(connectionId, event)) {
					sentCount++
				}
			}
		}

		logger.debug("Sent SSE event to organization connections", {
			organizationId,
			sentCount,
		})
	}

	/**
	 * 发送任务进度事件
	 */
	public sendTaskProgress(taskId: string, userId: string, progress: number, message?: string): void {
		const channel = `sse:task:${taskId}`

		const event: SSEEventData = {
			event: SSEEventType.TASK_PROGRESS,
			data: {
				taskId,
				userId,
				progress,
				message,
				timestamp: Date.now(),
			},
		}

		// 发送到订阅了该任务频道的连接
		for (const [connectionId, connection] of this.connections) {
			if (connection.channels.has(channel)) {
				this.sendEvent(connectionId, event)
			}
		}
	}

	/**
	 * 发送任务状态事件
	 */
	public sendTaskStatus(taskId: string, userId: string, status: string, metadata?: any): void {
		const channel = `sse:task:${taskId}`

		const event: SSEEventData = {
			event: SSEEventType.TASK_STATUS,
			data: {
				taskId,
				userId,
				status,
				metadata,
				timestamp: Date.now(),
			},
		}

		// 发送到订阅了该任务频道的连接
		for (const [connectionId, connection] of this.connections) {
			if (connection.channels.has(channel)) {
				this.sendEvent(connectionId, event)
			}
		}
	}

	/**
	 * 发送遥测数据
	 */
	public sendTelemetry(taskId: string, telemetryData: any): void {
		const channel = `sse:telemetry:${taskId}`

		const event: SSEEventData = {
			event: SSEEventType.TELEMETRY,
			data: {
				taskId,
				...telemetryData,
				timestamp: Date.now(),
			},
		}

		// 发送到订阅了该遥测频道的连接
		for (const [connectionId, connection] of this.connections) {
			if (connection.channels.has(channel)) {
				this.sendEvent(connectionId, event)
			}
		}
	}

	/**
	 * 发送组织事件
	 */
	public sendOrganizationEvent(organizationId: string, eventType: string, eventData: any): void {
		const channel = `sse:organization:${organizationId}`

		const event: SSEEventData = {
			event: SSEEventType.ORGANIZATION_EVENT,
			data: {
				organizationId,
				eventType,
				...eventData,
				timestamp: Date.now(),
			},
		}

		// 发送到订阅了该组织频道的连接
		for (const [connectionId, connection] of this.connections) {
			if (connection.channels.has(channel)) {
				this.sendEvent(connectionId, event)
			}
		}
	}

	/**
	 * 发送错误事件
	 */
	public sendError(connectionId: string, error: string, code?: string): void {
		this.sendEvent(connectionId, {
			event: SSEEventType.ERROR,
			data: {
				error,
				code,
				timestamp: Date.now(),
			},
		})
	}

	/**
	 * 获取活跃连接数
	 */
	public getActiveConnectionsCount(): number {
		return this.connections.size
	}

	/**
	 * 获取用户的连接数
	 */
	public getUserConnectionsCount(userId: string): number {
		let count = 0
		for (const connection of this.connections.values()) {
			if (connection.userId === userId) {
				count++
			}
		}
		return count
	}

	/**
	 * 获取所有连接信息
	 */
	public getConnections(): Array<{
		id: string
		userId: string
		organizationId?: string
		channels: string[]
		createdAt: number
		lastHeartbeat: number
	}> {
		const connections = []

		for (const connection of this.connections.values()) {
			connections.push({
				id: connection.id,
				userId: connection.userId,
				organizationId: connection.organizationId,
				channels: Array.from(connection.channels),
				createdAt: connection.createdAt,
				lastHeartbeat: connection.lastHeartbeat,
			})
		}

		return connections
	}

	/**
	 * 关闭 SSE 服务
	 */
	async close(): Promise<void> {
		if (!this.isInitialized) return

		try {
			// 停止心跳
			this.stopHeartbeat()

			// 关闭所有连接
			for (const connectionId of Array.from(this.connections.keys())) {
				this.closeConnection(connectionId)
			}

			// 关闭 Redis 订阅
			if (this.subscriber) {
				await this.subscriber.quit()
				this.subscriber = null
			}

			this.isInitialized = false
			logger.info("SSEService closed successfully")
		} catch (error) {
			logger.error("Failed to close SSEService", { error })
			throw error
		}
	}
}

/**
 * 创建单例实例
 */
export const sseService = new SSEService()
