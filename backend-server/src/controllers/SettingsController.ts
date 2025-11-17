import { Request, Response } from "express"
import { z } from "zod"
import { settingsService } from "../services/SettingsService.js"
import { logger } from "../utils/logger.js"

/**
 * 更新设置请求验证 Schema
 */
const updateSettingsSchema = z.object({
	settings: z.record(z.any()),
})

/**
 * SettingsController 类
 * 处理设置相关的 HTTP 请求
 */
export class SettingsController {
	/**
	 * GET /api/settings/user/:userId - 获取用户设置
	 */
	async getUserSettings(req: Request, res: Response): Promise<void> {
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
			const result = await settingsService.getUserSettings(userId)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Get user settings endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to get user settings"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
					success: false,
					error: "User not found",
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
	 * PATCH /api/settings/user/:userId - 更新用户设置
	 */
	async updateUserSettings(req: Request, res: Response): Promise<void> {
		try {
			const { userId } = req.params

			if (!userId) {
				res.status(400).json({
					success: false,
					error: "User ID is required",
				})
				return
			}

			// 验证请求体
			const validation = updateSettingsSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { settings } = validation.data

			// 调用服务层
			const result = await settingsService.updateUserSettings(userId, settings)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Update user settings endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to update user settings"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
					success: false,
					error: "User not found",
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
	 * GET /api/settings/organization/:organizationId - 获取组织设置
	 */
	async getOrganizationSettings(req: Request, res: Response): Promise<void> {
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
			const result = await settingsService.getOrganizationSettings(organizationId)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Get organization settings endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to get organization settings"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
					success: false,
					error: "Organization not found",
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
	 * PATCH /api/settings/organization/:organizationId - 更新组织设置
	 */
	async updateOrganizationSettings(req: Request, res: Response): Promise<void> {
		try {
			const { organizationId } = req.params

			if (!organizationId) {
				res.status(400).json({
					success: false,
					error: "Organization ID is required",
				})
				return
			}

			// 验证请求体
			const validation = updateSettingsSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { settings } = validation.data

			// 调用服务层
			const result = await settingsService.updateOrganizationSettings(organizationId, settings)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Update organization settings endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to update organization settings"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
					success: false,
					error: "Organization not found",
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
	 * POST /api/settings/user/:userId/reset - 重置用户设置为默认值
	 */
	async resetUserToDefaults(req: Request, res: Response): Promise<void> {
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
			const result = await settingsService.resetUserToDefaults(userId)

			res.status(200).json({
				success: true,
				data: result,
				message: "User settings reset to defaults",
			})
		} catch (error) {
			logger.error("Reset user settings endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to reset user settings"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
					success: false,
					error: "User not found",
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
	 * POST /api/settings/organization/:organizationId/reset - 重置组织设置为默认值
	 */
	async resetOrganizationToDefaults(req: Request, res: Response): Promise<void> {
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
			const result = await settingsService.resetOrganizationToDefaults(organizationId)

			res.status(200).json({
				success: true,
				data: result,
				message: "Organization settings reset to defaults",
			})
		} catch (error) {
			logger.error("Reset organization settings endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to reset organization settings"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
					success: false,
					error: "Organization not found",
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
 * 导出 SettingsController 单例
 */
export const settingsController = new SettingsController()
