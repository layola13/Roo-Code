import { Request, Response } from "express"
import { z } from "zod"
import { authService } from "../services/AuthService.js"
import { logger } from "../utils/logger.js"

/**
 * 注册请求验证 Schema
 */
const registerSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
	name: z.string().optional(),
})

/**
 * 登录请求验证 Schema
 */
const loginSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
})

/**
 * 刷新 Token 请求验证 Schema
 */
const refreshTokenSchema = z.object({
	refreshToken: z.string().min(1, "Refresh token is required"),
})

/**
 * 切换组织请求验证 Schema
 */
const switchOrganizationSchema = z.object({
	organizationId: z.string().min(1, "Organization ID is required"),
})

/**
 * AuthController 类
 * 处理认证相关的 HTTP 请求
 */
export class AuthController {
	/**
	 * POST /api/auth/register - 用户注册
	 */
	async register(req: Request, res: Response): Promise<void> {
		try {
			// 验证请求体
			const validation = registerSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { email, password, name } = validation.data

			// 调用服务层
			const result = await authService.register(email, password, name)

			res.status(201).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Register endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Registration failed"

			if (errorMessage.includes("already registered")) {
				res.status(409).json({
					success: false,
					error: errorMessage,
				})
				return
			}

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * POST /api/auth/login - 用户登录
	 */
	async login(req: Request, res: Response): Promise<void> {
		try {
			// 验证请求体
			const validation = loginSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { email, password } = validation.data

			// 调用服务层
			const result = await authService.login(email, password)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Login endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Login failed"

			if (errorMessage.includes("Invalid credentials")) {
				res.status(401).json({
					success: false,
					error: "Invalid email or password",
				})
				return
			}

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * POST /api/auth/logout - 用户登出
	 */
	async logout(req: Request, res: Response): Promise<void> {
		try {
			// 从 Authorization header 提取 token
			const authHeader = req.headers.authorization
			if (!authHeader || !authHeader.startsWith("Bearer ")) {
				res.status(400).json({
					success: false,
					error: "No token provided",
				})
				return
			}

			const token = authHeader.substring(7)

			// 调用服务层
			await authService.logout(token)

			res.status(200).json({
				success: true,
				message: "Logged out successfully",
			})
		} catch (error) {
			logger.error("Logout endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * POST /api/auth/refresh - 刷新 Token
	 */
	async refreshToken(req: Request, res: Response): Promise<void> {
		try {
			// 验证请求体
			const validation = refreshTokenSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { refreshToken } = validation.data

			// 调用服务层
			const result = await authService.refreshToken(refreshToken)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Refresh token endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Token refresh failed"

			if (errorMessage.includes("Invalid") || errorMessage.includes("expired")) {
				res.status(401).json({
					success: false,
					error: "Invalid or expired refresh token",
				})
				return
			}

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * POST /api/auth/switch-organization - 切换组织
	 */
	async switchOrganization(req: Request, res: Response): Promise<void> {
		try {
			// 验证用户已认证
			if (!req.user || !req.user.r?.u) {
				res.status(401).json({
					success: false,
					error: "Authentication required",
				})
				return
			}

			// 验证请求体
			const validation = switchOrganizationSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { organizationId } = validation.data
			const userId = req.user.r.u

			// 调用服务层
			const result = await authService.switchOrganization(userId, organizationId)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Switch organization endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Switch organization failed"

			if (errorMessage.includes("not a member")) {
				res.status(403).json({
					success: false,
					error: "You are not a member of this organization",
				})
				return
			}

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * GET /api/auth/me - 获取当前用户信息
	 */
	async getCurrentUser(req: Request, res: Response): Promise<void> {
		try {
			// 验证用户已认证
			if (!req.user || !req.user.r?.u) {
				res.status(401).json({
					success: false,
					error: "Authentication required",
				})
				return
			}

			// 返回 JWT payload 中的用户信息
			res.status(200).json({
				success: true,
				data: {
					userId: req.user.r.u,
					organizationId: req.user.r.o,
					tokenType: req.user.r.t,
					issuedAt: req.user.iat,
					expiresAt: req.user.exp,
				},
			})
		} catch (error) {
			logger.error("Get current user endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * GET /api/auth/organizations - 获取用户的组织成员关系
	 */
	async getOrganizations(req: Request, res: Response): Promise<void> {
		try {
			// 验证用户已认证
			if (!req.user || !req.user.r?.u) {
				res.status(401).json({
					success: false,
					error: "Authentication required",
				})
				return
			}

			const userId = req.user.r.u

			// 调用服务层
			const memberships = await authService.getOrganizationMemberships(userId)

			res.status(200).json({
				success: true,
				data: memberships,
			})
		} catch (error) {
			logger.error("Get organizations endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}
}

/**
 * 导出 AuthController 单例
 */
export const authController = new AuthController()
