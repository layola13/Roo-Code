import { Router } from "express"
import { telemetryController } from "../controllers/TelemetryController.js"
import { authenticate } from "../middleware/auth.js"

/**
 * 创建遥测路由
 */
export function createTelemetryRouter(): Router {
	const router = Router()

	/**
	 * POST /api/telemetry
	 * 记录遥测数据
	 * 需要认证
	 */
	router.post("/", authenticate, (req, res) => telemetryController.recordTelemetry(req, res))

	/**
	 * GET /api/telemetry/task/:taskId
	 * 获取任务的遥测数据
	 * 需要认证
	 */
	router.get("/task/:taskId", authenticate, (req, res) => telemetryController.getTaskTelemetry(req, res))

	/**
	 * GET /api/telemetry/user/:userId/stats
	 * 获取用户的遥测统计
	 * 需要认证
	 */
	router.get("/user/:userId/stats", authenticate, (req, res) => telemetryController.getUserTelemetryStats(req, res))

	/**
	 * GET /api/telemetry/organization/:organizationId/stats
	 * 获取组织的遥测统计
	 * 需要认证
	 */
	router.get("/organization/:organizationId/stats", authenticate, (req, res) =>
		telemetryController.getOrganizationTelemetryStats(req, res),
	)

	/**
	 * POST /api/telemetry/cleanup
	 * 清理过期遥测数据
	 * 需要认证
	 */
	router.post("/cleanup", authenticate, (req, res) => telemetryController.cleanupOldTelemetry(req, res))

	return router
}

/**
 * 导出默认路由实例
 */
export const telemetryRouter = createTelemetryRouter()
