import { Router } from "express"
import { dashboardController } from "../controllers/DashboardController.js"
import { authenticate } from "../middleware/auth.js"

/**
 * 创建 Dashboard 路由
 */
export function createDashboardRouter(): Router {
	const router = Router()

	/**
	 * GET /api/v1/dashboard/overview
	 * 获取 Dashboard 概览数据
	 * 需要认证
	 */
	router.get("/overview", authenticate, (req, res) => dashboardController.getOverview(req, res))

	/**
	 * GET /api/v1/dashboard/token-usage
	 * 获取 Token 使用趋势数据
	 * 需要认证
	 */
	router.get("/token-usage", authenticate, (req, res) => dashboardController.getTokenUsage(req, res))

	/**
	 * GET /api/v1/dashboard/cost-analysis
	 * 获取成本分析数据
	 * 需要认证
	 */
	router.get("/cost-analysis", authenticate, (req, res) => dashboardController.getCostAnalysis(req, res))

	/**
	 * GET /api/v1/dashboard/top-stats
	 * 获取 Top 统计数据
	 * 需要认证
	 */
	router.get("/top-stats", authenticate, (req, res) => dashboardController.getTopStats(req, res))

	return router
}

/**
 * 导出默认路由实例
 */
export const dashboardRouter = createDashboardRouter()
