import { Router } from "express"
import { authController } from "../controllers/AuthController.js"
import { authenticate } from "../middleware/auth.js"

/**
 * 创建认证路由
 */
export function createAuthRouter(): Router {
	const router = Router()

	/**
	 * POST /api/auth/register
	 * 用户注册
	 * 公开端点 - 不需要认证
	 */
	router.post("/register", (req, res) => authController.register(req, res))

	/**
	 * POST /api/auth/login
	 * 用户登录
	 * 公开端点 - 不需要认证
	 */
	router.post("/login", (req, res) => authController.login(req, res))

	/**
	 * POST /api/auth/logout
	 * 用户登出
	 * 公开端点 - 但需要提供 token
	 */
	router.post("/logout", (req, res) => authController.logout(req, res))

	/**
	 * POST /api/auth/refresh
	 * 刷新 access token
	 * 公开端点 - 但需要提供 refresh token
	 */
	router.post("/refresh", (req, res) => authController.refreshToken(req, res))

	/**
	 * POST /api/auth/switch-organization
	 * 切换当前组织
	 * 需要认证
	 */
	router.post("/switch-organization", authenticate, (req, res) => authController.switchOrganization(req, res))

	/**
	 * GET /api/auth/me
	 * 获取当前用户信息
	 * 需要认证
	 */
	router.get("/me", authenticate, (req, res) => authController.getCurrentUser(req, res))

	/**
	 * GET /api/auth/organizations
	 * 获取用户的组织成员关系列表
	 * 需要认证
	 */
	router.get("/organizations", authenticate, (req, res) => authController.getOrganizations(req, res))

	return router
}

/**
 * 导出默认路由实例
 */
export const authRouter = createAuthRouter()
