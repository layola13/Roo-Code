import { Router } from "express"
import { shareController } from "../controllers/ShareController.js"
import { authenticate } from "../middleware/auth.js"

/**
 * 创建分享路由
 */
export function createShareRouter(): Router {
	const router = Router()

	/**
	 * POST /api/shares
	 * 创建分享链接
	 * 需要认证
	 */
	router.post("/", authenticate, (req, res) => shareController.createShare(req, res))

	/**
	 * GET /api/shares/:id
	 * 获取分享详情
	 * 需要认证
	 */
	router.get("/:id", authenticate, (req, res) => shareController.getShare(req, res))

	/**
	 * POST /api/shares/validate
	 * 验证分享链接
	 * 不需要认证（公开访问）
	 */
	router.post("/validate", (req, res) => shareController.validateShare(req, res))

	/**
	 * DELETE /api/shares/:id
	 * 撤销分享
	 * 需要认证
	 */
	router.delete("/:id", authenticate, (req, res) => shareController.revokeShare(req, res))

	/**
	 * GET /api/shares/task/:taskId
	 * 列出任务的分享
	 * 需要认证
	 */
	router.get("/task/:taskId", authenticate, (req, res) => shareController.listTaskShares(req, res))

	/**
	 * POST /api/shares/:id/access
	 * 更新分享访问次数
	 * 不需要认证（公开访问）
	 */
	router.post("/:id/access", (req, res) => shareController.updateAccessCount(req, res))

	return router
}

/**
 * 导出默认路由实例
 */
export const shareRouter = createShareRouter()
