import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { TelemetryService } from "../TelemetryService.js"
import { AppDataSource } from "../../config/database.js"
import { TelemetryEvent } from "../../entities/TelemetryEvent.js"
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
		delPattern: vi.fn(),
	},
	CacheKeys: {
		stats: (type: string, id: string) => `stats:${type}:${id}`,
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

describe("TelemetryService", () => {
	let telemetryService: TelemetryService
	let mockTelemetryRepository: any
	let mockUserRepository: any
	let mockOrganizationRepository: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Setup mock repositories
		mockTelemetryRepository = {
			findOne: vi.fn(),
			find: vi.fn(),
			create: vi.fn(),
			save: vi.fn(),
			delete: vi.fn(),
			createQueryBuilder: vi.fn(),
		}

		mockUserRepository = {
			findOne: vi.fn(),
		}

		mockOrganizationRepository = {
			findOne: vi.fn(),
		}

		// Mock AppDataSource.getRepository
		vi.mocked(AppDataSource.getRepository).mockImplementation((entity: any) => {
			if (entity === TelemetryEvent) return mockTelemetryRepository
			if (entity === User) return mockUserRepository
			if (entity === Organization) return mockOrganizationRepository
			return {} as any
		})

		telemetryService = new TelemetryService()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("recordTelemetry", () => {
		it("应该成功记录遥测数据", async () => {
			const params = {
				userId: "user-123",
				organizationId: "org-456",
				eventType: "task_created",
				eventData: { taskId: "task-789" },
			}

			const mockUser = {
				id: "user-123",
				email: "test@example.com",
			}

			const mockOrganization = {
				id: "org-456",
				name: "Test Org",
			}

			const mockEvent = {
				id: "event-001",
				userId: params.userId,
				organizationId: params.organizationId,
				eventType: params.eventType,
				eventData: params.eventData,
				timestamp: new Date(),
			}

			// Mock: 用户存在
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: 组织存在
			mockOrganizationRepository.findOne.mockResolvedValue(mockOrganization)

			// Mock: 创建遥测事件
			mockTelemetryRepository.create.mockReturnValue(mockEvent)
			mockTelemetryRepository.save.mockResolvedValue(mockEvent)

			// Mock: Cache operations
			vi.mocked(cache.del).mockResolvedValue(true)

			const result = await telemetryService.recordTelemetry(params)

			expect(result).toHaveProperty("id")
			expect(result.userId).toBe(params.userId)
			expect(result.organizationId).toBe(params.organizationId)
			expect(result.eventType).toBe(params.eventType)
			expect(result.eventData).toEqual(params.eventData)
			expect(mockTelemetryRepository.save).toHaveBeenCalled()
			expect(cache.del).toHaveBeenCalledTimes(2)
		})

		it("应该在用户不存在时抛出错误", async () => {
			const params = {
				userId: "nonexistent-user",
				organizationId: "org-456",
				eventType: "test_event",
			}

			// Mock: 用户不存在
			mockUserRepository.findOne.mockResolvedValue(null)

			await expect(telemetryService.recordTelemetry(params)).rejects.toThrow("User not found")
			expect(mockTelemetryRepository.save).not.toHaveBeenCalled()
		})

		it("应该在组织不存在时抛出错误", async () => {
			const params = {
				userId: "user-123",
				organizationId: "nonexistent-org",
				eventType: "test_event",
			}

			const mockUser = {
				id: "user-123",
				email: "test@example.com",
			}

			// Mock: 用户存在
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: 组织不存在
			mockOrganizationRepository.findOne.mockResolvedValue(null)

			await expect(telemetryService.recordTelemetry(params)).rejects.toThrow("Organization not found")
			expect(mockTelemetryRepository.save).not.toHaveBeenCalled()
		})
	})

	describe("getTaskTelemetry", () => {
		it("应该从缓存获取任务遥测数据", async () => {
			const taskId = "task-123"
			const cachedData = [
				{
					id: "event-001",
					userId: "user-123",
					organizationId: "org-456",
					eventType: "task_created",
					eventData: { taskId },
					timestamp: Date.now(),
				},
			]

			// Mock: 缓存中存在
			vi.mocked(cache.get).mockResolvedValue(cachedData)

			const result = await telemetryService.getTaskTelemetry(taskId)

			expect(result).toEqual(cachedData)
			expect(cache.get).toHaveBeenCalled()
			expect(mockTelemetryRepository.createQueryBuilder).not.toHaveBeenCalled()
		})

		it("应该从数据库获取任务遥测数据并缓存", async () => {
			const taskId = "task-123"
			const mockEvents = [
				{
					id: "event-001",
					userId: "user-123",
					organizationId: "org-456",
					eventType: "task_created",
					eventData: { taskId },
					timestamp: new Date(),
				},
			]

			const mockQueryBuilder = {
				where: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				getMany: vi.fn().mockResolvedValue(mockEvents),
			}

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库查询
			mockTelemetryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await telemetryService.getTaskTelemetry(taskId)

			expect(result).toHaveLength(1)
			expect(result[0].eventData?.taskId).toBe(taskId)
			expect(mockTelemetryRepository.createQueryBuilder).toHaveBeenCalled()
			expect(cache.set).toHaveBeenCalled()
		})
	})

	describe("getUserTelemetryStats", () => {
		it("应该从缓存获取用户遥测统计", async () => {
			const userId = "user-123"
			const cachedStats = {
				totalEvents: 10,
				eventsByType: {
					task_created: 5,
					task_updated: 5,
				},
				recentEvents: [],
			}

			// Mock: 缓存中存在
			vi.mocked(cache.get).mockResolvedValue(cachedStats)

			const result = await telemetryService.getUserTelemetryStats(userId)

			expect(result).toEqual(cachedStats)
			expect(cache.get).toHaveBeenCalled()
			expect(mockTelemetryRepository.find).not.toHaveBeenCalled()
		})

		it("应该从数据库获取用户遥测统计并缓存", async () => {
			const userId = "user-123"
			const mockEvents = [
				{
					id: "event-001",
					userId,
					organizationId: "org-456",
					eventType: "task_created",
					eventData: {},
					timestamp: new Date(),
				},
				{
					id: "event-002",
					userId,
					organizationId: "org-456",
					eventType: "task_created",
					eventData: {},
					timestamp: new Date(),
				},
				{
					id: "event-003",
					userId,
					organizationId: "org-456",
					eventType: "task_updated",
					eventData: {},
					timestamp: new Date(),
				},
			]

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库查询
			mockTelemetryRepository.find.mockResolvedValue(mockEvents)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await telemetryService.getUserTelemetryStats(userId)

			expect(result.totalEvents).toBe(3)
			expect(result.eventsByType.task_created).toBe(2)
			expect(result.eventsByType.task_updated).toBe(1)
			expect(result.recentEvents).toHaveLength(3)
			expect(mockTelemetryRepository.find).toHaveBeenCalled()
			expect(cache.set).toHaveBeenCalled()
		})
	})

	describe("getOrganizationTelemetryStats", () => {
		it("应该从缓存获取组织遥测统计", async () => {
			const organizationId = "org-456"
			const cachedStats = {
				totalEvents: 20,
				eventsByType: {
					task_created: 10,
					task_updated: 10,
				},
				recentEvents: [],
			}

			// Mock: 缓存中存在
			vi.mocked(cache.get).mockResolvedValue(cachedStats)

			const result = await telemetryService.getOrganizationTelemetryStats(organizationId)

			expect(result).toEqual(cachedStats)
			expect(cache.get).toHaveBeenCalled()
			expect(mockTelemetryRepository.find).not.toHaveBeenCalled()
		})

		it("应该从数据库获取组织遥测统计并缓存", async () => {
			const organizationId = "org-456"
			const mockEvents = [
				{
					id: "event-001",
					userId: "user-1",
					organizationId,
					eventType: "task_created",
					eventData: {},
					timestamp: new Date(),
				},
				{
					id: "event-002",
					userId: "user-2",
					organizationId,
					eventType: "task_created",
					eventData: {},
					timestamp: new Date(),
				},
			]

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库查询
			mockTelemetryRepository.find.mockResolvedValue(mockEvents)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await telemetryService.getOrganizationTelemetryStats(organizationId)

			expect(result.totalEvents).toBe(2)
			expect(result.eventsByType.task_created).toBe(2)
			expect(result.recentEvents).toHaveLength(2)
			expect(mockTelemetryRepository.find).toHaveBeenCalled()
			expect(cache.set).toHaveBeenCalled()
		})
	})

	describe("cleanupOldTelemetry", () => {
		it("应该成功清理过期遥测数据", async () => {
			const daysToKeep = 90

			// Mock: 删除操作
			mockTelemetryRepository.delete.mockResolvedValue({ affected: 100 })

			// Mock: Cache pattern delete
			vi.mocked(cache.delPattern).mockResolvedValue(5)

			const result = await telemetryService.cleanupOldTelemetry(daysToKeep)

			expect(result).toBe(100)
			expect(mockTelemetryRepository.delete).toHaveBeenCalled()
			expect(cache.delPattern).toHaveBeenCalledWith("stats:*_telemetry:*")
		})

		it("应该使用默认的保留天数", async () => {
			// Mock: 删除操作
			mockTelemetryRepository.delete.mockResolvedValue({ affected: 50 })

			// Mock: Cache pattern delete
			vi.mocked(cache.delPattern).mockResolvedValue(3)

			const result = await telemetryService.cleanupOldTelemetry()

			expect(result).toBe(50)
			expect(mockTelemetryRepository.delete).toHaveBeenCalled()
		})

		it("应该处理没有删除记录的情况", async () => {
			const daysToKeep = 30

			// Mock: 没有记录被删除
			mockTelemetryRepository.delete.mockResolvedValue({ affected: 0 })

			// Mock: Cache pattern delete
			vi.mocked(cache.delPattern).mockResolvedValue(0)

			const result = await telemetryService.cleanupOldTelemetry(daysToKeep)

			expect(result).toBe(0)
			expect(mockTelemetryRepository.delete).toHaveBeenCalled()
		})
	})
})
