import { nanoid } from "nanoid"
import { FindOptionsWhere, Like } from "typeorm"
import { AppDataSource } from "../config/database.js"
import { Task } from "../entities/Task.js"
import { User } from "../entities/User.js"
import { Organization } from "../entities/Organization.js"
import { cache, CacheKeys } from "../utils/cache.js"
import { logger } from "../utils/logger.js"

/**
 * CloudTask 接口
 * 简化的任务响应类型
 */
export interface CloudTask {
	id: string
	userId: string
	organizationId: string
	metadata?: Record<string, any>
	createdAt: number
	updatedAt: number
}

/**
 * 创建任务的参数接口
 */
export interface CreateTaskParams {
	userId: string
	organizationId: string
	metadata?: Record<string, any>
}

/**
 * 更新任务的参数接口
 */
export interface UpdateTaskParams {
	metadata?: Record<string, any>
}

/**
 * 列出任务的选项接口
 */
export interface ListTasksOptions {
	limit?: number
	offset?: number
	sortBy?: "createdAt" | "updatedAt"
	sortOrder?: "ASC" | "DESC"
}

/**
 * 搜索任务的参数接口
 */
export interface SearchTasksParams {
	userId?: string
	organizationId?: string
	metadataQuery?: Record<string, any>
	limit?: number
	offset?: number
}

/**
 * TaskService 类
 * 处理任务相关的业务逻辑
 */
export class TaskService {
	private taskRepository = AppDataSource.getRepository(Task)
	private userRepository = AppDataSource.getRepository(User)
	private organizationRepository = AppDataSource.getRepository(Organization)

	/**
	 * 创建任务
	 * @param params 创建参数
	 * @returns 创建的任务
	 */
	async createTask(params: CreateTaskParams): Promise<CloudTask> {
		const { userId, organizationId, metadata } = params

		try {
			// 验证用户是否存在
			const user = await this.userRepository.findOne({ where: { id: userId } })
			if (!user) {
				throw new Error("User not found")
			}

			// 验证组织是否存在
			const organization = await this.organizationRepository.findOne({
				where: { id: organizationId },
			})
			if (!organization) {
				throw new Error("Organization not found")
			}

			// 创建任务
			const taskId = nanoid()
			const task = this.taskRepository.create({
				id: taskId,
				userId,
				organizationId,
				metadata: metadata || {},
			})

			await this.taskRepository.save(task)

			logger.info("Task created", { taskId, userId, organizationId })

			// 缓存任务（5分钟）
			const result = this.mapTaskToCloud(task)
			await cache.set(CacheKeys.task(taskId), result, 300)

			return result
		} catch (error) {
			logger.error("Create task failed", { params, error })
			throw error
		}
	}

	/**
	 * 获取任务详情
	 * @param taskId 任务 ID
	 * @returns 任务信息
	 */
	async getTask(taskId: string): Promise<CloudTask> {
		try {
			// 先尝试从缓存获取
			const cacheKey = CacheKeys.task(taskId)
			const cached = await cache.get<CloudTask>(cacheKey)
			if (cached) {
				return cached
			}

			// 从数据库查询
			const task = await this.taskRepository.findOne({
				where: { id: taskId },
			})

			if (!task) {
				throw new Error("Task not found")
			}

			const result = this.mapTaskToCloud(task)

			// 缓存结果（5分钟）
			await cache.set(cacheKey, result, 300)

			return result
		} catch (error) {
			logger.error("Get task failed", { taskId, error })
			throw error
		}
	}

	/**
	 * 更新任务信息
	 * @param taskId 任务 ID
	 * @param params 更新参数
	 * @returns 更新后的任务信息
	 */
	async updateTask(taskId: string, params: UpdateTaskParams): Promise<CloudTask> {
		const { metadata } = params

		try {
			const task = await this.taskRepository.findOne({
				where: { id: taskId },
			})

			if (!task) {
				throw new Error("Task not found")
			}

			// 更新字段
			if (metadata !== undefined) {
				task.metadata = metadata
			}

			await this.taskRepository.save(task)

			logger.info("Task updated", { taskId, updates: params })

			// 清除缓存
			await this.clearTaskCache(taskId)

			return this.mapTaskToCloud(task)
		} catch (error) {
			logger.error("Update task failed", { taskId, params, error })
			throw error
		}
	}

	/**
	 * 删除任务
	 * @param taskId 任务 ID
	 */
	async deleteTask(taskId: string): Promise<void> {
		try {
			const task = await this.taskRepository.findOne({
				where: { id: taskId },
			})

			if (!task) {
				throw new Error("Task not found")
			}

			// 删除任务
			await this.taskRepository.remove(task)

			logger.info("Task deleted", { taskId })

			// 清除缓存
			await this.clearTaskCache(taskId)
		} catch (error) {
			logger.error("Delete task failed", { taskId, error })
			throw error
		}
	}

	/**
	 * 列出用户的任务
	 * @param userId 用户 ID
	 * @param options 列表选项
	 * @returns 任务列表
	 */
	async listUserTasks(userId: string, options: ListTasksOptions = {}): Promise<CloudTask[]> {
		const { limit = 50, offset = 0, sortBy = "createdAt", sortOrder = "DESC" } = options

		try {
			const tasks = await this.taskRepository.find({
				where: { userId },
				order: { [sortBy]: sortOrder },
				take: limit,
				skip: offset,
			})

			return tasks.map((task) => this.mapTaskToCloud(task))
		} catch (error) {
			logger.error("List user tasks failed", { userId, options, error })
			throw error
		}
	}

	/**
	 * 列出组织的任务
	 * @param organizationId 组织 ID
	 * @param options 列表选项
	 * @returns 任务列表
	 */
	async listOrganizationTasks(organizationId: string, options: ListTasksOptions = {}): Promise<CloudTask[]> {
		const { limit = 50, offset = 0, sortBy = "createdAt", sortOrder = "DESC" } = options

		try {
			const tasks = await this.taskRepository.find({
				where: { organizationId },
				order: { [sortBy]: sortOrder },
				take: limit,
				skip: offset,
			})

			return tasks.map((task) => this.mapTaskToCloud(task))
		} catch (error) {
			logger.error("List organization tasks failed", { organizationId, options, error })
			throw error
		}
	}

	/**
	 * 更新任务状态（通过 metadata）
	 * @param taskId 任务 ID
	 * @param status 任务状态
	 * @returns 更新后的任务信息
	 */
	async updateTaskStatus(taskId: string, status: string): Promise<CloudTask> {
		try {
			const task = await this.taskRepository.findOne({
				where: { id: taskId },
			})

			if (!task) {
				throw new Error("Task not found")
			}

			// 更新 metadata 中的 status
			task.metadata = {
				...task.metadata,
				status,
			}

			await this.taskRepository.save(task)

			logger.info("Task status updated", { taskId, status })

			// 清除缓存
			await this.clearTaskCache(taskId)

			return this.mapTaskToCloud(task)
		} catch (error) {
			logger.error("Update task status failed", { taskId, status, error })
			throw error
		}
	}

	/**
	 * 搜索任务
	 * @param params 搜索参数
	 * @returns 任务列表
	 */
	async searchTasks(params: SearchTasksParams): Promise<CloudTask[]> {
		const { userId, organizationId, metadataQuery, limit = 50, offset = 0 } = params

		try {
			const where: FindOptionsWhere<Task> = {}

			if (userId) {
				where.userId = userId
			}

			if (organizationId) {
				where.organizationId = organizationId
			}

			// 注意：metadataQuery 的实现取决于具体的搜索需求
			// 这里提供基本的框架，实际使用时可能需要更复杂的查询逻辑

			const tasks = await this.taskRepository.find({
				where,
				order: { createdAt: "DESC" },
				take: limit,
				skip: offset,
			})

			// 如果有 metadataQuery，在内存中过滤
			let filteredTasks = tasks
			if (metadataQuery && Object.keys(metadataQuery).length > 0) {
				filteredTasks = tasks.filter((task) => {
					if (!task.metadata) return false

					return Object.entries(metadataQuery).every(([key, value]) => {
						return task.metadata?.[key] === value
					})
				})
			}

			return filteredTasks.map((task) => this.mapTaskToCloud(task))
		} catch (error) {
			logger.error("Search tasks failed", { params, error })
			throw error
		}
	}

	/**
	 * 映射 Task 实体到 CloudTask
	 */
	private mapTaskToCloud(task: Task): CloudTask {
		return {
			id: task.id,
			userId: task.userId,
			organizationId: task.organizationId,
			metadata: task.metadata,
			createdAt: task.createdAt.getTime(),
			updatedAt: task.updatedAt.getTime(),
		}
	}

	/**
	 * 清除任务缓存
	 */
	private async clearTaskCache(taskId: string): Promise<void> {
		const cacheKey = CacheKeys.task(taskId)
		await cache.del(cacheKey)
	}
}

/**
 * 导出 TaskService 单例
 */
export const taskService = new TaskService()
