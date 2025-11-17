import { Router } from "express"
import { settingsController } from "../controllers/SettingsController.js"
import { authenticate } from "../middleware/auth.js"

/**
 * 创建设置路由
 */
export function createSettingsRouter(): Router {
	const router = Router()

	/**
	 * GET /api/settings/user/:userId
	 * 获取用户设置
	 * 需要认证
	 */
	router.get("/user/:userId", authenticate, (req, res) => settingsController.getUserSettings(req, res))

	/**
	 * PATCH /api/settings/user/:userId
	 * 更新用户设置
	 * 需要认证
	 */
	router.patch("/user/:userId", authenticate, (req, res) => settingsController.updateUserSettings(req, res))

	/**
	 * POST /api/settings/user/:userId/reset
	 * 重置用户设置为默认值
	 * 需要认证
	 */
	router.post("/user/:userId/reset", authenticate, (req, res) => settingsController.resetUserToDefaults(req, res))

	/**
	 * GET /api/settings/organization/:organizationId
	 * 获取组织设置
	 * 需要认证
	 */
	router.get("/organization/:organizationId", authenticate, (req, res) =>
		settingsController.getOrganizationSettings(req, res),
	)

	/**
	 * PATCH /api/settings/organization/:organizationId
	 * 更新组织设置
	 * 需要认证
	 */
	router.patch("/organization/:organizationId", authenticate, (req, res) =>
		settingsController.updateOrganizationSettings(req, res),
	)

	/**
	 * POST /api/settings/organization/:organizationId/reset
	 * 重置组织设置为默认值
	 * 需要认证
	 */
	router.post("/organization/:organizationId/reset", authenticate, (req, res) =>
		settingsController.resetOrganizationToDefaults(req, res),
	)

	return router
}

/**
 * 导出默认路由实例
 */
export const settingsRouter = createSettingsRouter()
