import { Request, Response } from "express"
import { z } from "zod"
import { telemetryService } from "../services/TelemetryService.js"
import { logger } from "../utils/logger.js"

/**
 * 记录遥测请求验证 Schema
 */
const recordTelemetrySchema = z.object({
	userId: z.string().min(1, "User ID is required"),
	organizationId: z.string().min(1, "Organization ID is required"),
	eventType: z.string().min(1, "Event type is required"),
	eventData: z.record(z.any()).optional(),
})

/**
 * 清理遥测请求验证 Schema
 */
const cleanupTelemetrySchema = z.object({
	daysToKeep: z.number().min(1).max(365).optional(),
})

/**
 * TelemetryController 类
 * 处理遥测相关的 HTTP 请求
 */
export class TelemetryController {
	/**
	 * POST /api/telemetry - 记录遥测数据
	 */
	async recordTelemetry(req: Request, res: Response): Promise<void> {
		try {
			// 验证请求体
			const validation = recordTelemetrySchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { userId, organizationId, eventType, eventData } = validation.data

			// 调用服务层
			const result = await telemetryService.recordTelemetry({
				userId,
				organizationId,
				eventType,
				eventData,
			})

			res.status(201).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Record telemetry endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to record telemetry"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
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
	 * GET /api/telemetry/task/:taskId - 获取任务的遥测数据
	 */
	async getTaskTelemetry(req: Request, res: Response): Promise<void> {
		try {
			const { taskId } = req.params

			if (!taskId) {
				res.status(400).json({
					success: false,
					error: "Task ID is required",
				})
				return
			}

			// 调用服务层
			const result = await telemetryService.getTaskTelemetry(taskId)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Get task telemetry endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * GET /api/telemetry/user/:userId/stats - 获取用户的遥测统计
	 */
	async getUserTelemetryStats(req: Request, res: Response): Promise<void> {
		try {
			const { userId } = req.params

			if (!userId) {
				res.status(400).json({
					success: false,
					error: "User ID is required",
				})
				return
			}

			// 调用服务层
			const result = await telemetryService.getUserTelemetryStats(userId)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Get user telemetry stats endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * GET /api/telemetry/organization/:organizationId/stats - 获取组织的遥测统计
	 */
	async getOrganizationTelemetryStats(req: Request, res: Response): Promise<void> {
		try {
			const { organizationId } = req.params

			if (!organizationId) {
				res.status(400).json({
					success: false,
					error: "Organization ID is required",
				})
				return
			}

			// 调用服务层
			const result = await telemetryService.getOrganizationTelemetryStats(organizationId)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Get organization telemetry stats endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * POST /api/telemetry/cleanup - 清理过期遥测数据
	 */
	async cleanupOldTelemetry(req: Request, res: Response): Promise<void> {
		try {
			// 验证请求体
			const validation = cleanupTelemetrySchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { daysToKeep = 90 } = validation.data

			// 调用服务层
			const deletedCount = await telemetryService.cleanupOldTelemetry(daysToKeep)

			res.status(200).json({
				success: true,
				data: {
					deletedCount,
					daysToKeep,
				},
			})
		} catch (error) {
			logger.error("Cleanup telemetry endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}
}

/**
 * 导出 TelemetryController 单例
 */
export const telemetryController = new TelemetryController()
