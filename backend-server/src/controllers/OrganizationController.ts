import { Request, Response } from "express"
import { z } from "zod"
import { organizationService } from "../services/OrganizationService.js"
import { logger } from "../utils/logger.js"

/**
 * 创建组织请求验证 Schema
 */
const createOrganizationSchema = z.object({
	name: z.string().min(1, "Organization name is required").max(255, "Name too long"),
	settings: z.record(z.any()).optional(),
})

/**
 * 更新组织请求验证 Schema
 */
const updateOrganizationSchema = z.object({
	name: z.string().min(1, "Organization name is required").max(255, "Name too long").optional(),
	settings: z.record(z.any()).optional(),
})

/**
 * 添加成员请求验证 Schema
 */
const addMemberSchema = z.object({
	userId: z.string().min(1, "User ID is required"),
	role: z.enum(["owner", "admin", "member"], {
		errorMap: () => ({ message: "Role must be one of: owner, admin, member" }),
	}),
})

/**
 * 更新成员角色请求验证 Schema
 */
const updateMemberRoleSchema = z.object({
	role: z.enum(["owner", "admin", "member"], {
		errorMap: () => ({ message: "Role must be one of: owner, admin, member" }),
	}),
})

/**
 * OrganizationController 类
 * 处理组织相关的 HTTP 请求
 */
export class OrganizationController {
	/**
	 * POST /api/organizations - 创建组织
	 */
	async createOrganization(req: Request, res: Response): Promise<void> {
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
			const validation = createOrganizationSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { name, settings } = validation.data
			const ownerId = req.user.r.u

			// 调用服务层
			const organization = await organizationService.createOrganization({
				name,
				settings,
				ownerId,
			})

			res.status(201).json({
				success: true,
				data: organization,
			})
		} catch (error) {
			logger.error("Create organization endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Create organization failed"

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
	 * GET /api/organizations/:id - 获取组织详情
	 */
	async getOrganization(req: Request, res: Response): Promise<void> {
		try {
			// 验证用户已认证
			if (!req.user || !req.user.r?.u) {
				res.status(401).json({
					success: false,
					error: "Authentication required",
				})
				return
			}

			const { id } = req.params

			if (!id) {
				res.status(400).json({
					success: false,
					error: "Organization ID is required",
				})
				return
			}

			// 调用服务层
			const organization = await organizationService.getOrganization(id)

			res.status(200).json({
				success: true,
				data: organization,
			})
		} catch (error) {
			logger.error("Get organization endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Get organization failed"

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
	 * PATCH /api/organizations/:id - 更新组织信息
	 */
	async updateOrganization(req: Request, res: Response): Promise<void> {
		try {
			// 验证用户已认证
			if (!req.user || !req.user.r?.u) {
				res.status(401).json({
					success: false,
					error: "Authentication required",
				})
				return
			}

			const { id } = req.params

			if (!id) {
				res.status(400).json({
					success: false,
					error: "Organization ID is required",
				})
				return
			}

			// 验证请求体
			const validation = updateOrganizationSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			// 调用服务层
			const organization = await organizationService.updateOrganization(id, validation.data)

			res.status(200).json({
				success: true,
				data: organization,
			})
		} catch (error) {
			logger.error("Update organization endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Update organization failed"

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
	 * DELETE /api/organizations/:id - 删除组织
	 */
	async deleteOrganization(req: Request, res: Response): Promise<void> {
		try {
			// 验证用户已认证
			if (!req.user || !req.user.r?.u) {
				res.status(401).json({
					success: false,
					error: "Authentication required",
				})
				return
			}

			const { id } = req.params

			if (!id) {
				res.status(400).json({
					success: false,
					error: "Organization ID is required",
				})
				return
			}

			// 调用服务层
			await organizationService.deleteOrganization(id)

			res.status(200).json({
				success: true,
				message: "Organization deleted successfully",
			})
		} catch (error) {
			logger.error("Delete organization endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Delete organization failed"

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
	 * GET /api/organizations - 获取用户的组织列表
	 */
	async listUserOrganizations(req: Request, res: Response): Promise<void> {
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
			const organizations = await organizationService.listUserOrganizations(userId)

			res.status(200).json({
				success: true,
				data: organizations,
			})
		} catch (error) {
			logger.error("List user organizations endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * POST /api/organizations/:id/members - 添加组织成员
	 */
	async addMember(req: Request, res: Response): Promise<void> {
		try {
			// 验证用户已认证
			if (!req.user || !req.user.r?.u) {
				res.status(401).json({
					success: false,
					error: "Authentication required",
				})
				return
			}

			const { id } = req.params

			if (!id) {
				res.status(400).json({
					success: false,
					error: "Organization ID is required",
				})
				return
			}

			// 验证请求体
			const validation = addMemberSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			// 调用服务层
			const membership = await organizationService.addMember(id, validation.data)

			res.status(201).json({
				success: true,
				data: membership,
			})
		} catch (error) {
			logger.error("Add member endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Add member failed"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
					success: false,
					error: errorMessage,
				})
				return
			}

			if (errorMessage.includes("already a member")) {
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
	 * DELETE /api/organizations/:id/members/:userId - 移除组织成员
	 */
	async removeMember(req: Request, res: Response): Promise<void> {
		try {
			// 验证用户已认证
			if (!req.user || !req.user.r?.u) {
				res.status(401).json({
					success: false,
					error: "Authentication required",
				})
				return
			}

			const { id, userId } = req.params

			if (!id || !userId) {
				res.status(400).json({
					success: false,
					error: "Organization ID and User ID are required",
				})
				return
			}

			// 调用服务层
			await organizationService.removeMember(id, userId)

			res.status(200).json({
				success: true,
				message: "Member removed successfully",
			})
		} catch (error) {
			logger.error("Remove member endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Remove member failed"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
					success: false,
					error: errorMessage,
				})
				return
			}

			if (errorMessage.includes("Cannot remove owner")) {
				res.status(403).json({
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
	 * PATCH /api/organizations/:id/members/:userId/role - 更新成员角色
	 */
	async updateMemberRole(req: Request, res: Response): Promise<void> {
		try {
			// 验证用户已认证
			if (!req.user || !req.user.r?.u) {
				res.status(401).json({
					success: false,
					error: "Authentication required",
				})
				return
			}

			const { id, userId } = req.params

			if (!id || !userId) {
				res.status(400).json({
					success: false,
					error: "Organization ID and User ID are required",
				})
				return
			}

			// 验证请求体
			const validation = updateMemberRoleSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { role } = validation.data

			// 调用服务层
			const membership = await organizationService.updateMemberRole(id, userId, role)

			res.status(200).json({
				success: true,
				data: membership,
			})
		} catch (error) {
			logger.error("Update member role endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Update member role failed"

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
	 * GET /api/organizations/:id/members - 获取组织成员列表
	 */
	async listMembers(req: Request, res: Response): Promise<void> {
		try {
			// 验证用户已认证
			if (!req.user || !req.user.r?.u) {
				res.status(401).json({
					success: false,
					error: "Authentication required",
				})
				return
			}

			const { id } = req.params

			if (!id) {
				res.status(400).json({
					success: false,
					error: "Organization ID is required",
				})
				return
			}

			// 调用服务层
			const members = await organizationService.listMembers(id)

			res.status(200).json({
				success: true,
				data: members,
			})
		} catch (error) {
			logger.error("List members endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}
}

/**
 * 导出 OrganizationController 单例
 */
export const organizationController = new OrganizationController()
