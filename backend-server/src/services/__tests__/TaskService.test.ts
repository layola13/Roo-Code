import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { TaskService } from "../TaskService.js"
import { AppDataSource } from "../../config/database.js"
import { Task } from "../../entities/Task.js"
import { User } from "../../entities/User.js"
import { Organization } from "../../entities/Organization.js"
import { cache } from "../../utils/cache.js"

// Mock dependencies
vi.mock("../../config/database.js", () => ({
	AppDataSource: {
		getRepository: vi.fn(),
	},
}))

vi.mock("../../utils/cache.js", () => ({
	cache: {
		set: vi.fn(),
		get: vi.fn(),
		del: vi.fn(),
	},
	CacheKeys: {
		task: (taskId: string) => `task:${taskId}`,
	},
}))

vi.mock("../../utils/logger.js", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}))

describe("TaskService", () => {
	let taskService: TaskService
	let mockTaskRepository: any
	let mockUserRepository: any
	let mockOrganizationRepository: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Setup mock repositories
		mockTaskRepository = {
			findOne: vi.fn(),
			find: vi.fn(),
			create: vi.fn(),
			save: vi.fn(),
			remove: vi.fn(),
		}

		mockUserRepository = {
			findOne: vi.fn(),
		}

		mockOrganizationRepository = {
			findOne: vi.fn(),
		}

		// Mock AppDataSource.getRepository
		vi.mocked(AppDataSource.getRepository).mockImplementation((entity: any) => {
			if (entity === Task) return mockTaskRepository
			if (entity === User) return mockUserRepository
			if (entity === Organization) return mockOrganizationRepository
			return {} as any
		})

		taskService = new TaskService()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("createTask", () => {
		it("应该成功创建任务", async () => {
			const params = {
				userId: "user-123",
				organizationId: "org-456",
				metadata: { key: "value" },
			}

			const mockUser = {
				id: "user-123",
				email: "test@example.com",
			}

			const mockOrganization = {
				id: "org-456",
				name: "Test Org",
			}

			const mockTask = {
				id: "task-789",
				userId: params.userId,
				organizationId: params.organizationId,
				metadata: params.metadata,
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			// Mock: 用户存在
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: 组织存在
			mockOrganizationRepository.findOne.mockResolvedValue(mockOrganization)

			// Mock: 创建任务
			mockTaskRepository.create.mockReturnValue(mockTask)
			mockTaskRepository.save.mockResolvedValue(mockTask)

			// Mock: Cache
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await taskService.createTask(params)

			expect(result).toHaveProperty("id")
			expect(result.userId).toBe(params.userId)
			expect(result.organizationId).toBe(params.organizationId)
			expect(result.metadata).toEqual(params.metadata)
			expect(mockTaskRepository.save).toHaveBeenCalled()
			expect(cache.set).toHaveBeenCalled()
		})

		it("应该在用户不存在时抛出错误", async () => {
			const params = {
				userId: "nonexistent-user",
				organizationId: "org-456",
			}

			// Mock: 用户不存在
			mockUserRepository.findOne.mockResolvedValue(null)

			await expect(taskService.createTask(params)).rejects.toThrow("User not found")
			expect(mockTaskRepository.save).not.toHaveBeenCalled()
		})

		it("应该在组织不存在时抛出错误", async () => {
			const params = {
				userId: "user-123",
				organizationId: "nonexistent-org",
			}

			const mockUser = {
				id: "user-123",
				email: "test@example.com",
			}

			// Mock: 用户存在
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: 组织不存在
			mockOrganizationRepository.findOne.mockResolvedValue(null)

			await expect(taskService.createTask(params)).rejects.toThrow("Organization not found")
			expect(mockTaskRepository.save).not.toHaveBeenCalled()
		})
	})

	describe("getTask", () => {
		it("应该从缓存获取任务", async () => {
			const taskId = "task-123"
			const cachedTask = {
				id: taskId,
				userId: "user-123",
				organizationId: "org-456",
				metadata: {},
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			// Mock: 缓存中存在
			vi.mocked(cache.get).mockResolvedValue(cachedTask)

			const result = await taskService.getTask(taskId)

			expect(result).toEqual(cachedTask)
			expect(cache.get).toHaveBeenCalled()
			expect(mockTaskRepository.findOne).not.toHaveBeenCalled()
		})

		it("应该从数据库获取任务并缓存", async () => {
			const taskId = "task-123"
			const mockTask = {
				id: taskId,
				userId: "user-123",
				organizationId: "org-456",
				metadata: {},
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库中存在
			mockTaskRepository.findOne.mockResolvedValue(mockTask)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await taskService.getTask(taskId)

			expect(result.id).toBe(taskId)
			expect(mockTaskRepository.findOne).toHaveBeenCalled()
			expect(cache.set).toHaveBeenCalled()
		})

		it("应该在任务不存在时抛出错误", async () => {
			const taskId = "nonexistent-task"

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库中也不存在
			mockTaskRepository.findOne.mockResolvedValue(null)

			await expect(taskService.getTask(taskId)).rejects.toThrow("Task not found")
		})
	})

	describe("updateTask", () => {
		it("应该成功更新任务", async () => {
			const taskId = "task-123"
			const params = {
				metadata: { updated: "data" },
			}

			const mockTask = {
				id: taskId,
				userId: "user-123",
				organizationId: "org-456",
				metadata: { old: "data" },
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			// Mock: 任务存在
			mockTaskRepository.findOne.mockResolvedValue(mockTask)

			// Mock: 保存任务
			mockTaskRepository.save.mockResolvedValue({
				...mockTask,
				metadata: params.metadata,
			})

			// Mock: Cache delete
			vi.mocked(cache.del).mockResolvedValue(true)

			const result = await taskService.updateTask(taskId, params)

			expect(result.metadata).toEqual(params.metadata)
			expect(mockTaskRepository.save).toHaveBeenCalled()
			expect(cache.del).toHaveBeenCalled()
		})

		it("应该在任务不存在时抛出错误", async () => {
			const taskId = "nonexistent-task"
			const params = {
				metadata: { updated: "data" },
			}

			// Mock: 任务不存在
			mockTaskRepository.findOne.mockResolvedValue(null)

			await expect(taskService.updateTask(taskId, params)).rejects.toThrow("Task not found")
			expect(mockTaskRepository.save).not.toHaveBeenCalled()
		})
	})

	describe("deleteTask", () => {
		it("应该成功删除任务", async () => {
			const taskId = "task-123"
			const mockTask = {
				id: taskId,
				userId: "user-123",
				organizationId: "org-456",
				metadata: {},
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			// Mock: 任务存在
			mockTaskRepository.findOne.mockResolvedValue(mockTask)

			// Mock: 删除任务
			mockTaskRepository.remove.mockResolvedValue(mockTask)

			// Mock: Cache delete
			vi.mocked(cache.del).mockResolvedValue(true)

			await taskService.deleteTask(taskId)

			expect(mockTaskRepository.remove).toHaveBeenCalledWith(mockTask)
			expect(cache.del).toHaveBeenCalled()
		})

		it("应该在任务不存在时抛出错误", async () => {
			const taskId = "nonexistent-task"

			// Mock: 任务不存在
			mockTaskRepository.findOne.mockResolvedValue(null)

			await expect(taskService.deleteTask(taskId)).rejects.toThrow("Task not found")
			expect(mockTaskRepository.remove).not.toHaveBeenCalled()
		})
	})

	describe("listUserTasks", () => {
		it("应该返回用户的任务列表", async () => {
			const userId = "user-123"
			const mockTasks = [
				{
					id: "task-1",
					userId,
					organizationId: "org-456",
					metadata: {},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				{
					id: "task-2",
					userId,
					organizationId: "org-456",
					metadata: {},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			]

			// Mock: 找到任务列表
			mockTaskRepository.find.mockResolvedValue(mockTasks)

			const result = await taskService.listUserTasks(userId)

			expect(result).toHaveLength(2)
			expect(result[0].userId).toBe(userId)
			expect(result[1].userId).toBe(userId)
		})

		it("应该支持分页和排序选项", async () => {
			const userId = "user-123"
			const options = {
				limit: 10,
				offset: 5,
				sortBy: "createdAt" as const,
				sortOrder: "ASC" as const,
			}

			mockTaskRepository.find.mockResolvedValue([])

			await taskService.listUserTasks(userId, options)

			expect(mockTaskRepository.find).toHaveBeenCalledWith({
				where: { userId },
				order: { createdAt: "ASC" },
				take: 10,
				skip: 5,
			})
		})
	})

	describe("listOrganizationTasks", () => {
		it("应该返回组织的任务列表", async () => {
			const organizationId = "org-456"
			const mockTasks = [
				{
					id: "task-1",
					userId: "user-1",
					organizationId,
					metadata: {},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				{
					id: "task-2",
					userId: "user-2",
					organizationId,
					metadata: {},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			]

			// Mock: 找到任务列表
			mockTaskRepository.find.mockResolvedValue(mockTasks)

			const result = await taskService.listOrganizationTasks(organizationId)

			expect(result).toHaveLength(2)
			expect(result[0].organizationId).toBe(organizationId)
			expect(result[1].organizationId).toBe(organizationId)
		})
	})

	describe("updateTaskStatus", () => {
		it("应该成功更新任务状态", async () => {
			const taskId = "task-123"
			const status = "completed"

			const mockTask = {
				id: taskId,
				userId: "user-123",
				organizationId: "org-456",
				metadata: { oldStatus: "pending" },
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			// Mock: 任务存在
			mockTaskRepository.findOne.mockResolvedValue(mockTask)

			// Mock: 保存任务
			mockTaskRepository.save.mockResolvedValue({
				...mockTask,
				metadata: { ...mockTask.metadata, status },
			})

			// Mock: Cache delete
			vi.mocked(cache.del).mockResolvedValue(true)

			const result = await taskService.updateTaskStatus(taskId, status)

			expect(result.metadata?.status).toBe(status)
			expect(mockTaskRepository.save).toHaveBeenCalled()
			expect(cache.del).toHaveBeenCalled()
		})

		it("应该在任务不存在时抛出错误", async () => {
			const taskId = "nonexistent-task"
			const status = "completed"

			// Mock: 任务不存在
			mockTaskRepository.findOne.mockResolvedValue(null)

			await expect(taskService.updateTaskStatus(taskId, status)).rejects.toThrow("Task not found")
			expect(mockTaskRepository.save).not.toHaveBeenCalled()
		})
	})

	describe("searchTasks", () => {
		it("应该搜索任务（按用户ID）", async () => {
			const params = {
				userId: "user-123",
			}

			const mockTasks = [
				{
					id: "task-1",
					userId: params.userId,
					organizationId: "org-456",
					metadata: {},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			]

			// Mock: 找到任务
			mockTaskRepository.find.mockResolvedValue(mockTasks)

			const result = await taskService.searchTasks(params)

			expect(result).toHaveLength(1)
			expect(result[0].userId).toBe(params.userId)
		})

		it("应该搜索任务（按组织ID）", async () => {
			const params = {
				organizationId: "org-456",
			}

			const mockTasks = [
				{
					id: "task-1",
					userId: "user-123",
					organizationId: params.organizationId,
					metadata: {},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			]

			// Mock: 找到任务
			mockTaskRepository.find.mockResolvedValue(mockTasks)

			const result = await taskService.searchTasks(params)

			expect(result).toHaveLength(1)
			expect(result[0].organizationId).toBe(params.organizationId)
		})

		it("应该搜索任务（按metadata过滤）", async () => {
			const params = {
				userId: "user-123",
				metadataQuery: { status: "completed" },
			}

			const mockTasks = [
				{
					id: "task-1",
					userId: params.userId,
					organizationId: "org-456",
					metadata: { status: "completed" },
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				{
					id: "task-2",
					userId: params.userId,
					organizationId: "org-456",
					metadata: { status: "pending" },
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			]

			// Mock: 找到所有任务
			mockTaskRepository.find.mockResolvedValue(mockTasks)

			const result = await taskService.searchTasks(params)

			// 应该只返回 status 为 'completed' 的任务
			expect(result).toHaveLength(1)
			expect(result[0].metadata?.status).toBe("completed")
		})

		it("应该支持分页", async () => {
			const params = {
				userId: "user-123",
				limit: 20,
				offset: 10,
			}

			mockTaskRepository.find.mockResolvedValue([])

			await taskService.searchTasks(params)

			expect(mockTaskRepository.find).toHaveBeenCalledWith({
				where: { userId: params.userId },
				order: { createdAt: "DESC" },
				take: 20,
				skip: 10,
			})
		})
	})
})
