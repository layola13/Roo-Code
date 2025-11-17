import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { Request, Response } from "express"
import { TaskController } from "../TaskController.js"
import { taskService } from "../../services/TaskService.js"

// Mock taskService
vi.mock("../../services/TaskService.js", () => ({
	taskService: {
		createTask: vi.fn(),
		getTask: vi.fn(),
		updateTask: vi.fn(),
		deleteTask: vi.fn(),
		listUserTasks: vi.fn(),
		listOrganizationTasks: vi.fn(),
		updateTaskStatus: vi.fn(),
		searchTasks: vi.fn(),
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

describe("TaskController", () => {
	let taskController: TaskController
	let mockRequest: Partial<Request>
	let mockResponse: Partial<Response>
	let jsonMock: any
	let statusMock: any

	beforeEach(() => {
		vi.clearAllMocks()

		taskController = new TaskController()

		jsonMock = vi.fn()
		statusMock = vi.fn(() => ({ json: jsonMock }))

		mockResponse = {
			status: statusMock,
			json: jsonMock,
		}

		mockRequest = {
			params: {},
			body: {},
			query: {},
		}
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("createTask", () => {
		it("应该成功创建任务", async () => {
			const requestBody = {
				userId: "user-123",
				organizationId: "org-456",
				metadata: { key: "value" },
			}

			const mockTask = {
				id: "task-789",
				userId: requestBody.userId,
				organizationId: requestBody.organizationId,
				metadata: requestBody.metadata,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			mockRequest.body = requestBody

			vi.mocked(taskService.createTask).mockResolvedValue(mockTask)

			await taskController.createTask(mockRequest as Request, mockResponse as Response)

			expect(taskService.createTask).toHaveBeenCalledWith(requestBody)
			expect(statusMock).toHaveBeenCalledWith(201)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: mockTask,
			})
		})

		it("应该在验证失败时返回400错误", async () => {
			mockRequest.body = {
				userId: "", // Invalid: empty string
				organizationId: "org-456",
			}

			await taskController.createTask(mockRequest as Request, mockResponse as Response)

			expect(taskService.createTask).not.toHaveBeenCalled()
			expect(statusMock).toHaveBeenCalledWith(400)
			expect(jsonMock).toHaveBeenCalledWith(
				expect.objectContaining({
					success: false,
					error: "Validation failed",
				}),
			)
		})

		it("应该在用户不存在时返回404错误", async () => {
			mockRequest.body = {
				userId: "nonexistent-user",
				organizationId: "org-456",
			}

			vi.mocked(taskService.createTask).mockRejectedValue(new Error("User not found"))

			await taskController.createTask(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(404)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "User not found",
			})
		})
	})

	describe("getTask", () => {
		it("应该成功获取任务", async () => {
			const taskId = "task-123"
			const mockTask = {
				id: taskId,
				userId: "user-123",
				organizationId: "org-456",
				metadata: {},
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			mockRequest.params = { id: taskId }

			vi.mocked(taskService.getTask).mockResolvedValue(mockTask)

			await taskController.getTask(mockRequest as Request, mockResponse as Response)

			expect(taskService.getTask).toHaveBeenCalledWith(taskId)
			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: mockTask,
			})
		})

		it("应该在任务不存在时返回404错误", async () => {
			mockRequest.params = { id: "nonexistent-task" }

			vi.mocked(taskService.getTask).mockRejectedValue(new Error("Task not found"))

			await taskController.getTask(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(404)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Task not found",
			})
		})

		it("应该在缺少ID时返回400错误", async () => {
			mockRequest.params = {}

			await taskController.getTask(mockRequest as Request, mockResponse as Response)

			expect(taskService.getTask).not.toHaveBeenCalled()
			expect(statusMock).toHaveBeenCalledWith(400)
		})
	})

	describe("updateTask", () => {
		it("应该成功更新任务", async () => {
			const taskId = "task-123"
			const updates = {
				metadata: { updated: "data" },
			}

			const mockTask = {
				id: taskId,
				userId: "user-123",
				organizationId: "org-456",
				metadata: updates.metadata,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			mockRequest.params = { id: taskId }
			mockRequest.body = updates

			vi.mocked(taskService.updateTask).mockResolvedValue(mockTask)

			await taskController.updateTask(mockRequest as Request, mockResponse as Response)

			expect(taskService.updateTask).toHaveBeenCalledWith(taskId, updates)
			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: mockTask,
			})
		})

		it("应该在任务不存在时返回404错误", async () => {
			mockRequest.params = { id: "nonexistent-task" }
			mockRequest.body = { metadata: {} }

			vi.mocked(taskService.updateTask).mockRejectedValue(new Error("Task not found"))

			await taskController.updateTask(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(404)
		})
	})

	describe("deleteTask", () => {
		it("应该成功删除任务", async () => {
			const taskId = "task-123"

			mockRequest.params = { id: taskId }

			vi.mocked(taskService.deleteTask).mockResolvedValue(undefined)

			await taskController.deleteTask(mockRequest as Request, mockResponse as Response)

			expect(taskService.deleteTask).toHaveBeenCalledWith(taskId)
			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				message: "Task deleted successfully",
			})
		})

		it("应该在任务不存在时返回404错误", async () => {
			mockRequest.params = { id: "nonexistent-task" }

			vi.mocked(taskService.deleteTask).mockRejectedValue(new Error("Task not found"))

			await taskController.deleteTask(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(404)
		})
	})

	describe("listUserTasks", () => {
		it("应该成功列出用户的任务", async () => {
			const userId = "user-123"
			const mockTasks = [
				{
					id: "task-1",
					userId,
					organizationId: "org-456",
					metadata: {},
					createdAt: Date.now(),
					updatedAt: Date.now(),
				},
				{
					id: "task-2",
					userId,
					organizationId: "org-456",
					metadata: {},
					createdAt: Date.now(),
					updatedAt: Date.now(),
				},
			]

			mockRequest.params = { userId }
			mockRequest.query = {}

			vi.mocked(taskService.listUserTasks).mockResolvedValue(mockTasks)

			await taskController.listUserTasks(mockRequest as Request, mockResponse as Response)

			expect(taskService.listUserTasks).toHaveBeenCalledWith(userId, {
				limit: 50,
				offset: 0,
				sortBy: undefined,
				sortOrder: undefined,
			})
			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: mockTasks,
				pagination: {
					limit: 50,
					offset: 0,
					total: 2,
				},
			})
		})

		it("应该支持查询参数", async () => {
			const userId = "user-123"

			mockRequest.params = { userId }
			mockRequest.query = {
				limit: "10",
				offset: "5",
				sortBy: "createdAt",
				sortOrder: "ASC",
			}

			vi.mocked(taskService.listUserTasks).mockResolvedValue([])

			await taskController.listUserTasks(mockRequest as Request, mockResponse as Response)

			expect(taskService.listUserTasks).toHaveBeenCalledWith(userId, {
				limit: 10,
				offset: 5,
				sortBy: "createdAt",
				sortOrder: "ASC",
			})
		})

		it("应该在缺少用户ID时返回400错误", async () => {
			mockRequest.params = {}

			await taskController.listUserTasks(mockRequest as Request, mockResponse as Response)

			expect(taskService.listUserTasks).not.toHaveBeenCalled()
			expect(statusMock).toHaveBeenCalledWith(400)
		})
	})

	describe("listOrganizationTasks", () => {
		it("应该成功列出组织的任务", async () => {
			const organizationId = "org-456"
			const mockTasks = [
				{
					id: "task-1",
					userId: "user-1",
					organizationId,
					metadata: {},
					createdAt: Date.now(),
					updatedAt: Date.now(),
				},
			]

			mockRequest.params = { organizationId }
			mockRequest.query = {}

			vi.mocked(taskService.listOrganizationTasks).mockResolvedValue(mockTasks)

			await taskController.listOrganizationTasks(mockRequest as Request, mockResponse as Response)

			expect(taskService.listOrganizationTasks).toHaveBeenCalledWith(organizationId, {
				limit: 50,
				offset: 0,
				sortBy: undefined,
				sortOrder: undefined,
			})
			expect(statusMock).toHaveBeenCalledWith(200)
		})

		it("应该在缺少组织ID时返回400错误", async () => {
			mockRequest.params = {}

			await taskController.listOrganizationTasks(mockRequest as Request, mockResponse as Response)

			expect(taskService.listOrganizationTasks).not.toHaveBeenCalled()
			expect(statusMock).toHaveBeenCalledWith(400)
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
				metadata: { status },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			mockRequest.params = { id: taskId }
			mockRequest.body = { status }

			vi.mocked(taskService.updateTaskStatus).mockResolvedValue(mockTask)

			await taskController.updateTaskStatus(mockRequest as Request, mockResponse as Response)

			expect(taskService.updateTaskStatus).toHaveBeenCalledWith(taskId, status)
			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: mockTask,
			})
		})

		it("应该在验证失败时返回400错误", async () => {
			mockRequest.params = { id: "task-123" }
			mockRequest.body = { status: "" } // Invalid: empty string

			await taskController.updateTaskStatus(mockRequest as Request, mockResponse as Response)

			expect(taskService.updateTaskStatus).not.toHaveBeenCalled()
			expect(statusMock).toHaveBeenCalledWith(400)
		})
	})

	describe("searchTasks", () => {
		it("应该成功搜索任务", async () => {
			const searchParams = {
				userId: "user-123",
				organizationId: "org-456",
				metadataQuery: { status: "completed" },
			}

			const mockTasks = [
				{
					id: "task-1",
					userId: searchParams.userId,
					organizationId: searchParams.organizationId,
					metadata: { status: "completed" },
					createdAt: Date.now(),
					updatedAt: Date.now(),
				},
			]

			mockRequest.body = searchParams

			vi.mocked(taskService.searchTasks).mockResolvedValue(mockTasks)

			await taskController.searchTasks(mockRequest as Request, mockResponse as Response)

			expect(taskService.searchTasks).toHaveBeenCalledWith({
				...searchParams,
				limit: 50,
				offset: 0,
			})
			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: mockTasks,
				pagination: {
					limit: 50,
					offset: 0,
					total: 1,
				},
			})
		})

		it("应该支持分页参数", async () => {
			mockRequest.body = {
				userId: "user-123",
				limit: "20",
				offset: "10",
			}

			vi.mocked(taskService.searchTasks).mockResolvedValue([])

			await taskController.searchTasks(mockRequest as Request, mockResponse as Response)

			expect(taskService.searchTasks).toHaveBeenCalledWith({
				userId: "user-123",
				organizationId: undefined,
				metadataQuery: undefined,
				limit: 20,
				offset: 10,
			})
		})
	})
})
