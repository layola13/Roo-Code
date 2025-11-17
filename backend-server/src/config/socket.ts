import { Server as HTTPServer } from "http"
import { Server as SocketIOServer, ServerOptions } from "socket.io"
import { env } from "./env.js"
import { logger } from "../utils/logger.js"

/**
 * Socket.IO 服务器配置选项
 */
export const socketOptions: Partial<ServerOptions> = {
	cors: {
		origin: env.SOCKET_CORS_ORIGIN,
		credentials: true,
		methods: ["GET", "POST"],
	},

	// 传输协议配置
	transports: ["websocket", "polling"],

	// 连接超时
	connectTimeout: 10000,

	// Ping 配置
	pingTimeout: 60000,
	pingInterval: 25000,

	// 最大 HTTP 缓冲区大小
	maxHttpBufferSize: 1e6, // 1MB

	// 允许升级
	allowUpgrades: true,

	// Cookie 配置
	cookie: false,

	// 服务器端超时
	serveClient: false,
}

/**
 * 创建 Socket.IO 服务器实例
 * @param httpServer HTTP 服务器实例
 * @returns Socket.IO 服务器实例
 */
export function createSocketServer(httpServer: HTTPServer): SocketIOServer {
	const io = new SocketIOServer(httpServer, socketOptions)

	logger.info("Socket.IO server created", {
		cors: socketOptions.cors,
		transports: socketOptions.transports,
	})

	return io
}

/**
 * Socket.IO 事件类型定义
 */
export const SocketEvents = {
	// 连接事件
	CONNECTION: "connection",
	DISCONNECT: "disconnect",
	DISCONNECTING: "disconnecting",
	ERROR: "error",

	// 认证事件
	AUTHENTICATE: "authenticate",
	AUTHENTICATED: "authenticated",
	UNAUTHORIZED: "unauthorized",

	// 房间事件
	JOIN_ROOM: "join:room",
	LEAVE_ROOM: "leave:room",
	ROOM_JOINED: "room:joined",
	ROOM_LEFT: "room:left",

	// 任务事件
	TASK_CREATED: "task:created",
	TASK_UPDATED: "task:updated",
	TASK_DELETED: "task:deleted",
	TASK_STATUS_CHANGED: "task:status_changed",

	// 组织事件
	ORGANIZATION_MEMBER_ADDED: "organization:member_added",
	ORGANIZATION_MEMBER_REMOVED: "organization:member_removed",
	ORGANIZATION_UPDATED: "organization:updated",

	// 遥测事件
	TELEMETRY_RECORDED: "telemetry:recorded",

	// 用户状态事件
	USER_ONLINE: "user:online",
	USER_OFFLINE: "user:offline",
	USER_STATUS: "user:status",

	// 心跳事件
	PING: "ping",
	PONG: "pong",
} as const

/**
 * Socket.IO 房间名称生成器
 */
export const SocketRooms = {
	/**
	 * 用户私有房间
	 * @param userId 用户 ID
	 */
	user: (userId: string): string => `user:${userId}`,

	/**
	 * 组织房间
	 * @param organizationId 组织 ID
	 */
	organization: (organizationId: string): string => `org:${organizationId}`,

	/**
	 * 任务房间
	 * @param taskId 任务 ID
	 */
	task: (taskId: string): string => `task:${taskId}`,

	/**
	 * 全局房间
	 */
	global: (): string => "global",
} as const

/**
 * Socket.IO 命名空间
 */
export const SocketNamespaces = {
	/**
	 * 默认命名空间
	 */
	DEFAULT: "/",

	/**
	 * 任务命名空间
	 */
	TASKS: "/tasks",

	/**
	 * 组织命名空间
	 */
	ORGANIZATIONS: "/organizations",

	/**
	 * 遥测命名空间
	 */
	TELEMETRY: "/telemetry",
} as const

/**
 * Socket 用户数据接口
 */
export interface SocketUserData {
	userId: string
	organizationId?: string
	authenticated: boolean
}

/**
 * Socket 错误代码
 */
export const SocketErrorCodes = {
	AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
	AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
	INVALID_TOKEN: "INVALID_TOKEN",
	TOKEN_EXPIRED: "TOKEN_EXPIRED",
	ROOM_JOIN_FAILED: "ROOM_JOIN_FAILED",
	ROOM_LEAVE_FAILED: "ROOM_LEAVE_FAILED",
	PERMISSION_DENIED: "PERMISSION_DENIED",
	INVALID_PAYLOAD: "INVALID_PAYLOAD",
	INTERNAL_ERROR: "INTERNAL_ERROR",
} as const

/**
 * Socket 错误响应接口
 */
export interface SocketErrorResponse {
	success: false
	error: string
	code: string
	timestamp: number
}

/**
 * Socket 成功响应接口
 */
export interface SocketSuccessResponse<T = any> {
	success: true
	data: T
	timestamp: number
}

/**
 * 创建 Socket 错误响应
 */
export function createSocketErrorResponse(error: string, code: string): SocketErrorResponse {
	return {
		success: false,
		error,
		code,
		timestamp: Date.now(),
	}
}

/**
 * 创建 Socket 成功响应
 */
export function createSocketSuccessResponse<T>(data: T): SocketSuccessResponse<T> {
	return {
		success: true,
		data,
		timestamp: Date.now(),
	}
}
