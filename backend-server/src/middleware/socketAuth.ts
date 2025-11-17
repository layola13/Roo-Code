import { Socket } from "socket.io"
import { extractBearerToken, verifyToken } from "../utils/jwt.js"
import { authService } from "../services/AuthService.js"
import { logger } from "../utils/logger.js"
import { SocketErrorCodes, createSocketErrorResponse, SocketUserData } from "../config/socket.js"

/**
 * Socket.IO ExtendedError 类型
 */
interface ExtendedError extends Error {
	data?: any
}

/**
 * 扩展 Socket 接口以包含用户数据
 */
declare module "socket.io" {
	interface Socket {
		userData?: SocketUserData
	}
}

/**
 * Socket.IO 认证中间件
 * 从握手的 auth 或 query 参数中提取并验证 JWT token
 */
export function socketAuthMiddleware() {
	return async (socket: Socket, next: (err?: ExtendedError) => void) => {
		try {
			// 从握手中提取 token
			const token = extractTokenFromHandshake(socket)

			if (!token) {
				logger.warn("Socket connection without token", {
					socketId: socket.id,
					remoteAddress: socket.handshake.address,
				})

				const error = new Error("Authentication required") as ExtendedError
				error.data = createSocketErrorResponse(
					"Authentication token required",
					SocketErrorCodes.AUTHENTICATION_REQUIRED,
				)
				return next(error)
			}

			// 验证 token
			try {
				const payload = await verifyToken(token)

				if (!payload.r || !payload.r.u) {
					throw new Error("Invalid token payload")
				}

				// 验证会话状态 - 通过 verifyTokenWithSession
				await authService.verifyTokenWithSession(token)

				// 将用户数据附加到 socket
				socket.userData = {
					userId: payload.r.u,
					organizationId: payload.r.o,
					authenticated: true,
				}

				logger.info("Socket authenticated successfully", {
					socketId: socket.id,
					userId: payload.r.u,
					organizationId: payload.r.o,
				})

				next()
			} catch (error) {
				logger.warn("Token verification failed for socket", {
					socketId: socket.id,
					error: error instanceof Error ? error.message : "Unknown error",
				})

				const err = new Error("Invalid or expired token") as ExtendedError

				if (error instanceof Error && error.message.includes("expired")) {
					err.data = createSocketErrorResponse("Token expired", SocketErrorCodes.TOKEN_EXPIRED)
				} else {
					err.data = createSocketErrorResponse("Invalid token", SocketErrorCodes.INVALID_TOKEN)
				}

				return next(err)
			}
		} catch (error) {
			logger.error("Socket authentication error", {
				socketId: socket.id,
				error,
			})

			const err = new Error("Authentication failed") as ExtendedError
			err.data = createSocketErrorResponse("Authentication failed", SocketErrorCodes.AUTHENTICATION_FAILED)
			next(err)
		}
	}
}

/**
 * 可选的 Socket.IO 认证中间件
 * 如果提供了 token 则验证，否则允许匿名连接
 */
export function optionalSocketAuthMiddleware() {
	return async (socket: Socket, next: (err?: ExtendedError) => void) => {
		try {
			const token = extractTokenFromHandshake(socket)

			// 如果没有 token，允许匿名连接
			if (!token) {
				socket.userData = {
					userId: "",
					authenticated: false,
				}
				return next()
			}

			// 尝试验证 token
			try {
				const payload = await verifyToken(token)

				if (payload.r && payload.r.u) {
					await authService.verifyTokenWithSession(token)

					socket.userData = {
						userId: payload.r.u,
						organizationId: payload.r.o,
						authenticated: true,
					}

					logger.debug("Socket authenticated (optional)", {
						socketId: socket.id,
						userId: payload.r.u,
					})
				} else {
					socket.userData = {
						userId: "",
						authenticated: false,
					}
				}
			} catch (error) {
				// 验证失败，允许匿名连接
				logger.debug("Optional socket authentication failed, allowing anonymous", {
					socketId: socket.id,
				})

				socket.userData = {
					userId: "",
					authenticated: false,
				}
			}

			next()
		} catch (error) {
			logger.error("Optional socket authentication error", {
				socketId: socket.id,
				error,
			})

			// 发生错误时允许匿名连接
			socket.userData = {
				userId: "",
				authenticated: false,
			}
			next()
		}
	}
}

/**
 * 从 Socket 握手中提取 token
 * 优先级: auth.token > query.token > headers.authorization
 */
function extractTokenFromHandshake(socket: Socket): string | null {
	// 1. 从 auth 对象中提取
	if (socket.handshake.auth?.token) {
		const token = socket.handshake.auth.token as string
		return extractBearerToken(token) || token
	}

	// 2. 从 query 参数中提取
	if (socket.handshake.query?.token) {
		const token = socket.handshake.query.token as string
		return extractBearerToken(token) || token
	}

	// 3. 从 headers 中提取
	if (socket.handshake.headers?.authorization) {
		const authHeader = socket.handshake.headers.authorization
		return extractBearerToken(authHeader)
	}

	return null
}

/**
 * 检查 Socket 是否已认证
 */
export function isSocketAuthenticated(socket: Socket): boolean {
	return socket.userData?.authenticated === true
}

/**
 * 获取 Socket 的用户 ID
 */
export function getSocketUserId(socket: Socket): string | undefined {
	return socket.userData?.userId
}

/**
 * 获取 Socket 的组织 ID
 */
export function getSocketOrganizationId(socket: Socket): string | undefined {
	return socket.userData?.organizationId
}

/**
 * 要求 Socket 必须已认证的装饰器辅助函数
 */
export function requireSocketAuth(socket: Socket, callback: (error?: Error) => void): boolean {
	if (!isSocketAuthenticated(socket)) {
		const error = new Error("Authentication required")
		callback(error)
		return false
	}
	return true
}

/**
 * 要求 Socket 必须属于特定组织的装饰器辅助函数
 */
export function requireSocketOrganization(
	socket: Socket,
	organizationId: string,
	callback: (error?: Error) => void,
): boolean {
	if (!isSocketAuthenticated(socket)) {
		const error = new Error("Authentication required")
		callback(error)
		return false
	}

	if (socket.userData?.organizationId !== organizationId) {
		const error = new Error("Organization access denied")
		callback(error)
		return false
	}

	return true
}
