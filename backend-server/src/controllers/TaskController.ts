import { Request, Response } from "express"
import { z } from "zod"
import { taskService } from "../services/TaskService.js"
import { logger } from "../utils/logger.js"

/**
 * 创建任务请求验证 Schema
 */
const createTaskSchema = z.object({
	userId: z.string().min(1, "User ID is required"),
	organizationId: z.string().min(1, "Organization ID is required"),
	metadata: z.record(z.any()).optional(),
})

/**
 * 更新任务请求验证 Schema
 */
const updateTaskSchema = z.object({
	metadata: z.record(z.any()).optional(),
})

/**
 * 更新任务状态请求验证 Schema
 */
const updateTaskStatusSchema = z.object({
	status: z.string().min(1, "Status is required"),
})

/**
 * 列表查询参数验证 Schema
 */
const listQuerySchema = z.object({
	limit: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val, 10) : 50)),
	offset: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val, 10) : 0)),
	sortBy: z.enum(["createdAt", "updatedAt"]).optional(),
	sortOrder: z.enum(["ASC", "DESC"]).optional(),
})

/**
 * 搜索任务请求验证 Schema
 */
const searchTasksSchema = z.object({
	userId: z.string().optional(),
	organizationId: z.string().optional(),
	metadataQuery: z.record(z.any()).optional(),
	limit: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val, 10) : 50)),
	offset: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val, 10) : 0)),
})

/**
 * TaskController 类
 * 处理任务相关的 HTTP 请求
 */
export class TaskController {
	/**
	 * POST /api/tasks - 创建任务
	 */
	async createTask(req: Request, res: Response): Promise<void> {
		try {
			// 验证请求体
			const validation = createTaskSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { userId, organizationId, metadata } = validation.data

			// 调用服务层
			const result = await taskService.createTask({
				userId,
				organizationId,
				metadata,
			})

			res.status(201).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Create task endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to create task"

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
	 * GET /api/tasks/:id - 获取任务详情
	 */
	async getTask(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params

			if (!id) {
				res.status(400).json({
					success: false,
					error: "Task ID is required",
				})
				return
			}

			// 调用服务层
			const result = await taskService.getTask(id)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Get task endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to get task"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
					success: false,
					error: "Task not found",
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
	 * PATCH /api/tasks/:id - 更新任务信息
	 */
	async updateTask(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params

			if (!id) {
				res.status(400).json({
					success: false,
					error: "Task ID is required",
				})
				return
			}

			// 验证请求体
			const validation = updateTaskSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { metadata } = validation.data

			// 调用服务层
			const result = await taskService.updateTask(id, { metadata })

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Update task endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to update task"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
					success: false,
					error: "Task not found",
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
	 * DELETE /api/tasks/:id - 删除任务
	 */
	async deleteTask(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params

			if (!id) {
				res.status(400).json({
					success: false,
					error: "Task ID is required",
				})
				return
			}

			// 调用服务层
			await taskService.deleteTask(id)

			res.status(200).json({
				success: true,
				message: "Task deleted successfully",
			})
		} catch (error) {
			logger.error("Delete task endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to delete task"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
					success: false,
					error: "Task not found",
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
	 * GET /api/tasks/user/:userId - 列出用户的任务
	 */
	async listUserTasks(req: Request, res: Response): Promise<void> {
		try {
			const { userId } = req.params

			if (!userId) {
				res.status(400).json({
					success: false,
					error: "User ID is required",
				})
				return
			}

			// 验证查询参数
			const validation = listQuerySchema.safeParse(req.query)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Invalid query parameters",
					details: validation.error.errors,
				})
				return
			}

			const { limit, offset, sortBy, sortOrder } = validation.data

			// 调用服务层
			const result = await taskService.listUserTasks(userId, {
				limit,
				offset,
				sortBy,
				sortOrder,
			})

			res.status(200).json({
				success: true,
				data: result,
				pagination: {
					limit,
					offset,
					total: result.length,
				},
			})
		} catch (error) {
			logger.error("List user tasks endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * GET /api/tasks/organization/:organizationId - 列出组织的任务
	 */
	async listOrganizationTasks(req: Request, res: Response): Promise<void> {
		try {
			const { organizationId } = req.params

			if (!organizationId) {
				res.status(400).json({
					success: false,
					error: "Organization ID is required",
				})
				return
			}

			// 验证查询参数
			const validation = listQuerySchema.safeParse(req.query)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Invalid query parameters",
					details: validation.error.errors,
				})
				return
			}

			const { limit, offset, sortBy, sortOrder } = validation.data

			// 调用服务层
			const result = await taskService.listOrganizationTasks(organizationId, {
				limit,
				offset,
				sortBy,
				sortOrder,
			})

			res.status(200).json({
				success: true,
				data: result,
				pagination: {
					limit,
					offset,
					total: result.length,
				},
			})
		} catch (error) {
			logger.error("List organization tasks endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}

	/**
	 * PATCH /api/tasks/:id/status - 更新任务状态
	 */
	async updateTaskStatus(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params

			if (!id) {
				res.status(400).json({
					success: false,
					error: "Task ID is required",
				})
				return
			}

			// 验证请求体
			const validation = updateTaskStatusSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { status } = validation.data

			// 调用服务层
			const result = await taskService.updateTaskStatus(id, status)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error) {
			logger.error("Update task status endpoint error", { error })

			const errorMessage = error instanceof Error ? error.message : "Failed to update task status"

			if (errorMessage.includes("not found")) {
				res.status(404).json({
					success: false,
					error: "Task not found",
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
	 * POST /api/tasks/search - 搜索任务
	 */
	async searchTasks(req: Request, res: Response): Promise<void> {
		try {
			// 验证请求体
			const validation = searchTasksSchema.safeParse(req.body)
			if (!validation.success) {
				res.status(400).json({
					success: false,
					error: "Validation failed",
					details: validation.error.errors,
				})
				return
			}

			const { userId, organizationId, metadataQuery, limit, offset } = validation.data

			// 调用服务层
			const result = await taskService.searchTasks({
				userId,
				organizationId,
				metadataQuery,
				limit,
				offset,
			})

			res.status(200).json({
				success: true,
				data: result,
				pagination: {
					limit,
					offset,
					total: result.length,
				},
			})
		} catch (error) {
			logger.error("Search tasks endpoint error", { error })

			res.status(500).json({
				success: false,
				error: "Internal server error",
			})
		}
	}
}

/**
 * 导出 TaskController 单例
 */
export const taskController = new TaskController()
