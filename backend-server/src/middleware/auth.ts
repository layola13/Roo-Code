import { Request, Response, NextFunction } from "express"
import { extractBearerToken } from "../utils/jwt.js"
import { authService } from "../services/AuthService.js"
import { logger } from "../utils/logger.js"

/**
 * 认证中间件
 * 验证 JWT token 并将用户信息附加到 req.user
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
	try {
		// 从 Authorization header 提取 token
		const authHeader = req.headers.authorization
		if (!authHeader) {
			res.status(401).json({
				success: false,
				error: "No authorization header provided",
			})
			return
		}

		// 提取 Bearer token
		const token = extractBearerToken(authHeader)
		if (!token) {
			res.status(401).json({
				success: false,
				error: "Invalid authorization header format. Expected: Bearer <token>",
			})
			return
		}

		// 验证 token 和会话
		const payload = await authService.verifyTokenWithSession(token)

		// 将用户信息附加到 request
		req.user = payload

		// 继续处理请求
		next()
	} catch (error) {
		logger.warn("Authentication failed", { error })

		const errorMessage = error instanceof Error ? error.message : "Authentication failed"

		if (errorMessage.includes("expired")) {
			res.status(401).json({
				success: false,
				error: "Token expired",
				code: "TOKEN_EXPIRED",
			})
			return
		}

		res.status(401).json({
			success: false,
			error: "Invalid or expired token",
			code: "INVALID_TOKEN",
		})
	}
}

/**
 * 可选认证中间件
 * 如果提供了 token 则验证，否则继续处理请求
 */
export async function optionalAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
	try {
		const authHeader = req.headers.authorization

		// 如果没有 authorization header，直接继续
		if (!authHeader) {
			next()
			return
		}

		const token = extractBearerToken(authHeader)
		if (!token) {
			next()
			return
		}

		// 尝试验证 token
		try {
			const payload = await authService.verifyTokenWithSession(token)
			req.user = payload
		} catch (error) {
			// 忽略验证错误，继续处理请求
			logger.debug("Optional authentication failed", { error })
		}

		next()
	} catch (error) {
		logger.error("Optional authentication error", { error })
		next()
	}
}

/**
 * 要求特定组织成员身份的中间件
 * 必须在 authenticate 中间件之后使用
 */
export function requireOrganization(req: Request, res: Response, next: NextFunction): void {
	if (!req.user) {
		res.status(401).json({
			success: false,
			error: "Authentication required",
		})
		return
	}

	if (!req.user.r?.o) {
		res.status(403).json({
			success: false,
			error: "Organization membership required",
		})
		return
	}

	next()
}

/**
 * 要求特定 token 类型的中间件
 * 必须在 authenticate 中间件之后使用
 */
export function requireTokenType(tokenType: "auth" | "cj") {
	return (req: Request, res: Response, next: NextFunction): void => {
		if (!req.user) {
			res.status(401).json({
				success: false,
				error: "Authentication required",
			})
			return
		}

		if (req.user.r?.t !== tokenType) {
			res.status(403).json({
				success: false,
				error: `Token type '${tokenType}' required`,
			})
			return
		}

		next()
	}
}
