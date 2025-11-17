import { Request, Response } from "express"
import { z } from "zod"
import { shareService } from "../services/ShareService.js"
import { logger } from "../utils/logger.js"

/**
 * 创建分享请求验证 Schema
 */
const createShareSchema = z.object({
	taskId: z.string().min(1, "Task ID is required"),
	visibility: z.enum(["public", "organization"]),
	createdBy: z.string().min(1, "Created by is required"),
})

/**
 * 撤销分享请求验证 Schema
 */
const revokeShareSchema = z.object({
	userId: z.string().min(1, "User ID is required"),
})

/**
 * ShareController 类
 * 处理分享相关的 HTTP 请求
 */
export class ShareController {
	/**
	 * POST /api/shares - 创建分享链接
	 */
	async createShare(req: Request, res: Response): Promise<void> {
		try {
			// 验证请求体
			const validation = createShareSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { taskId, visibility, createdBy } = validation.data

			// 调用服务层
			const result = await shareService.createShare({
				taskId,
				visibility,
				createdBy,
			})

			res.status(201).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Create share endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to create share"

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
	 * GET /api/shares/:id - 获取分享详情
	 */
	async getShare(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params

			if (!id) {
				res.status(400).json({
					success: false,
					error: "Share ID is required",
				})
				return
			}

			// 调用服务层
			const result = await shareService.getShare(id)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Get share endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to get share"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
					success: false,
					error: "Share not found",
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
	 * POST /api/shares/validate - 验证分享链接
	 */
	async validateShare(req: Request, res: Response): Promise<void> {
		try {
			const { shareUrl } = req.body

			if (!shareUrl) {
				res.status(400).json({
					success: false,
					error: "Share URL is required",
				})
				return
			}

			// 调用服务层
			const result = await shareService.validateShare(shareUrl)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Validate share endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to validate share"

			if (errorMessage.includes("Invalid")) {
				res.status(404).json({
					success: false,
					error: "Invalid share URL",
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
	 * DELETE /api/shares/:id - 撤销分享
	 */
	async revokeShare(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params

			if (!id) {
				res.status(400).json({
					success: false,
					error: "Share ID is required",
				})
				return
			}

			// 验证请求体
			const validation = revokeShareSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { userId } = validation.data

			// 调用服务层
			await shareService.revokeShare(id, userId)

			res.status(200).json({
				success: true,
				message: "Share revoked successfully",
			})
		} catch (error) {
			logger.error("Revoke share endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to revoke share"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
					success: false,
					error: "Share not found",
				})
				return
			}

			if (errorMessage.includes("Permission denied")) {
				res.status(403).json({
					success: false,
					error: "Permission denied",
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
	 * GET /api/shares/task/:taskId - 列出任务的分享
	 */
	async listTaskShares(req: Request, res: Response): Promise<void> {
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
			const result = await shareService.listTaskShares(taskId)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("List task shares endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * POST /api/shares/:id/access - 更新分享访问次数
	 */
	async updateAccessCount(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params

			if (!id) {
				res.status(400).json({
					success: false,
					error: "Share ID is required",
				})
				return
			}

			// 调用服务层
			const result = await shareService.updateAccessCount(id)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Update access count endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to update access count"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
					success: false,
					error: "Share not found",
				})
				return
			}

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}
}

/**
 * 导出 ShareController 单例
 */
export const shareController = new ShareController()
