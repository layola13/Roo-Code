import { Request, Response } from "express"
import { z } from "zod"
import { dashboardService } from "../services/DashboardService.js"
import { logger } from "../utils/logger.js"

/**
 * 获取趋势数据请求验证 Schema
 */
const getTrendDataSchema = z.object({
	days: z.number().min(1).max(365).optional(),
	organizationId: z.string().optional(),
})

/**
 * DashboardController 类
 * 处理 Dashboard 数据可视化相关的 HTTP 请求
 */
export class DashboardController {
	/**
	 * GET /api/v1/dashboard/overview - 获取 Dashboard 概览数据
	 */
	async getOverview(req: Request, res: Response): Promise<void> {
		try {
			const { organizationId } = req.query

			// 调用服务层
			const result = await dashboardService.getDashboardOverview(organizationId as string | undefined)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Get dashboard overview endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * GET /api/v1/dashboard/token-usage - 获取 Token 使用趋势数据
	 */
	async getTokenUsage(req: Request, res: Response): Promise<void> {
		try {
			const { days = 7, organizationId } = req.query

			// 验证参数
			const validation = getTrendDataSchema.safeParse({
				days: days ? parseInt(days as string, 10) : 7,
				organizationId: organizationId as string | undefined,
			})

			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			// 调用服务层
			const result = await dashboardService.getTokenUsageTrend(
				validation.data.days || 7,
				validation.data.organizationId,
			)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Get token usage endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * GET /api/v1/dashboard/cost-analysis - 获取成本分析数据
	 */
	async getCostAnalysis(req: Request, res: Response): Promise<void> {
		try {
			const { days = 7, organizationId } = req.query

			// 验证参数
			const validation = getTrendDataSchema.safeParse({
				days: days ? parseInt(days as string, 10) : 7,
				organizationId: organizationId as string | undefined,
			})

			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			// 调用服务层
			const result = await dashboardService.getCostAnalysis(
				validation.data.days || 7,
				validation.data.organizationId,
			)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Get cost analysis endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * GET /api/v1/dashboard/top-stats - 获取 Top 统计数据
	 */
	async getTopStats(req: Request, res: Response): Promise<void> {
		try {
			const { organizationId } = req.query

			// 调用服务层
			const result = await dashboardService.getTopStats(organizationId as string | undefined)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Get top stats endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}
}

/**
 * 导出 DashboardController 单例
 */
export const dashboardController = new DashboardController()
