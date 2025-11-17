import jwt from "jsonwebtoken"
import { JWTPayload } from "@roo-code/types"
import { env } from "../config/env.js"
import { logger } from "./logger.js"

/**
 * 生成 Access Token (认证令牌)
 * @param userId 用户 ID
 * @param organizationId 组织 ID (可选)
 * @returns JWT token 字符串
 */
export function generateToken(userId: string, organizationId?: string): string {
	const now = Math.floor(Date.now() / 1000)

	const payload: JWTPayload = {
		iss: "rcc",
		sub: userId,
		v: 1,
		r: {
			u: userId,
			o: organizationId,
			t: "auth",
		},
		iat: now,
		exp: now + 3600, // 1 hour
	}

	return jwt.sign(payload, env.JWT_SECRET)
}

/**
 * 生成 Refresh Token (刷新令牌)
 * @param userId 用户 ID
 * @returns JWT refresh token 字符串
 */
export function generateRefreshToken(userId: string): string {
	const now = Math.floor(Date.now() / 1000)

	const payload: JWTPayload = {
		iss: "rcc",
		sub: userId,
		v: 1,
		r: {
			u: userId,
			t: "auth",
		},
		iat: now,
		exp: now + 604800, // 7 days
	}

	return jwt.sign(payload, env.JWT_SECRET)
}

/**
 * 生成 Job Token (任务令牌)
 * @param userId 用户 ID
 * @param organizationId 组织 ID (可选)
 * @param jobId 任务 ID
 * @returns JWT job token 字符串
 */
export function generateJobToken(userId: string, organizationId: string | undefined, jobId: string): string {
	const now = Math.floor(Date.now() / 1000)

	const payload: JWTPayload = {
		iss: "rcc",
		sub: jobId,
		v: 1,
		r: {
			u: userId,
			o: organizationId,
			t: "cj",
		},
		iat: now,
		exp: now + 86400, // 24 hours
	}

	return jwt.sign(payload, env.JWT_SECRET)
}

/**
 * 验证 JWT Token
 * @param token JWT token 字符串
 * @returns 解析后的 JWTPayload
 * @throws 如果 token 无效或过期
 */
export async function verifyToken(token: string): Promise<JWTPayload> {
	try {
		const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload

		// 验证必要字段
		if (!decoded.iss || decoded.iss !== "rcc") {
			throw new Error("Invalid token issuer")
		}

		if (!decoded.r || !decoded.r.u) {
			throw new Error("Invalid token payload: missing user ID")
		}

		if (!decoded.r.t || !["auth", "cj"].includes(decoded.r.t)) {
			throw new Error("Invalid token type")
		}

		return decoded
	} catch (error) {
		if (error instanceof jwt.TokenExpiredError) {
			logger.warn("Token expired", { error: error.message })
			throw new Error("Token expired")
		}

		if (error instanceof jwt.JsonWebTokenError) {
			logger.warn("Invalid token", { error: error.message })
			throw new Error("Invalid token")
		}

		logger.error("Token verification failed", { error })
		throw error
	}
}

/**
 * 解码 JWT Token (不验证签名)
 * @param token JWT token 字符串
 * @returns 解码后的 JWTPayload 或 null
 */
export function decodeToken(token: string): JWTPayload | null {
	try {
		const decoded = jwt.decode(token) as JWTPayload
		return decoded
	} catch (error) {
		logger.error("Token decode failed", { error })
		return null
	}
}

/**
 * 检查 token 是否即将过期 (剩余时间少于 5 分钟)
 * @param token JWT token 字符串
 * @returns 是否即将过期
 */
export function isTokenExpiringSoon(token: string): boolean {
	try {
		const decoded = decodeToken(token)
		if (!decoded || !decoded.exp) {
			return true
		}

		const now = Math.floor(Date.now() / 1000)
		const timeLeft = decoded.exp - now

		// 剩余时间少于 5 分钟
		return timeLeft < 300
	} catch (error) {
		logger.error("Check token expiry failed", { error })
		return true
	}
}

/**
 * 从 Bearer token 字符串中提取 token
 * @param bearerToken 格式: "Bearer <token>"
 * @returns 提取的 token 或 null
 */
export function extractBearerToken(bearerToken: string): string | null {
	if (!bearerToken || !bearerToken.startsWith("Bearer ")) {
		return null
	}

	return bearerToken.substring(7).trim()
}
