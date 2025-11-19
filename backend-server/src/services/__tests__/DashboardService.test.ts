import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { DashboardService } from "../DashboardService.js"
import { AppDataSource } from "../../config/database.js"
import { TelemetryEvent } from "../../entities/TelemetryEvent.js"
import { User } from "../../entities/User.js"
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

describe("DashboardService", () => {
	let dashboardService: DashboardService
	let mockTelemetryRepository: any
	let mockUserRepository: any

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

		// Mock AppDataSource.getRepository
		vi.mocked(AppDataSource.getRepository).mockImplementation((entity: any) => {
			if (entity === TelemetryEvent) return mockTelemetryRepository
			if (entity === User) return mockUserRepository
			return {} as any
		})

		dashboardService = new DashboardService()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("getTokenUsageTrend", () => {
		it("应该从缓存获取 Token 使用趋势数据", async () => {
			const days = 7
			const cachedData = [
				{
					date: "2024-01-01",
					inputTokens: 1000,
					outputTokens: 500,
					totalTokens: 1500,
				},
			]

			// Mock: 缓存中存在
			vi.mocked(cache.get).mockResolvedValue(cachedData)

			const result = await dashboardService.getTokenUsageTrend(days)

			expect(result).toEqual(cachedData)
			expect(cache.get).toHaveBeenCalled()
			expect(mockTelemetryRepository.createQueryBuilder).not.toHaveBeenCalled()
		})

		it("应该从数据库获取 Token 使用趋势数据并缓存", async () => {
			const days = 7
			const mockEvents = [
				{
					id: "event-001",
					userId: "user-123",
					organizationId: "org-456",
					eventType: "api_call",
					eventData: { inputTokens: 1000, outputTokens: 500 },
					timestamp: new Date("2024-01-01"),
				},
				{
					id: "event-002",
					userId: "user-123",
					organizationId: "org-456",
					eventType: "api_call",
					eventData: { inputTokens: 2000, outputTokens: 1000 },
					timestamp: new Date("2024-01-01"),
				},
			]

			const mockQueryBuilder = {
				where: vi.fn().mockReturnThis(),
				andWhere: vi.fn().mockReturnThis(),
				getMany: vi.fn().mockResolvedValue(mockEvents),
			}

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库查询
			mockTelemetryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await dashboardService.getTokenUsageTrend(days)

			expect(result).toHaveLength(days)
			expect(result[0]).toHaveProperty("date")
			expect(result[0]).toHaveProperty("inputTokens")
			expect(result[0]).toHaveProperty("outputTokens")
			expect(result[0]).toHaveProperty("totalTokens")
			expect(mockTelemetryRepository.createQueryBuilder).toHaveBeenCalled()
			expect(cache.set).toHaveBeenCalled()
		})

		it("应该支持按组织过滤", async () => {
			const days = 7
			const organizationId = "org-456"

			const mockQueryBuilder = {
				where: vi.fn().mockReturnThis(),
				andWhere: vi.fn().mockReturnThis(),
				getMany: vi.fn().mockResolvedValue([]),
			}

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库查询
			mockTelemetryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			await dashboardService.getTokenUsageTrend(days, organizationId)

			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith("event.organizationId = :organizationId", {
				organizationId,
			})
		})
	})

	describe("getCostAnalysis", () => {
		it("应该从缓存获取成本分析数据", async () => {
			const days = 7
			const cachedData = [
				{
					date: "2024-01-01",
					modelCosts: { "gpt-4": 10.5 },
					totalCost: 10.5,
				},
			]

			// Mock: 缓存中存在
			vi.mocked(cache.get).mockResolvedValue(cachedData)

			const result = await dashboardService.getCostAnalysis(days)

			expect(result).toEqual(cachedData)
			expect(cache.get).toHaveBeenCalled()
			expect(mockTelemetryRepository.createQueryBuilder).not.toHaveBeenCalled()
		})

		it("应该从数据库获取成本分析数据并缓存", async () => {
			const days = 7
			const mockEvents = [
				{
					id: "event-001",
					userId: "user-123",
					organizationId: "org-456",
					eventType: "api_call",
					eventData: { model: "gpt-4", cost: 10.5 },
					timestamp: new Date("2024-01-01"),
				},
				{
					id: "event-002",
					userId: "user-123",
					organizationId: "org-456",
					eventType: "api_call",
					eventData: { model: "gpt-3.5-turbo", cost: 2.5 },
					timestamp: new Date("2024-01-01"),
				},
			]

			const mockQueryBuilder = {
				where: vi.fn().mockReturnThis(),
				andWhere: vi.fn().mockReturnThis(),
				getMany: vi.fn().mockResolvedValue(mockEvents),
			}

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库查询
			mockTelemetryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await dashboardService.getCostAnalysis(days)

			expect(result).toHaveLength(days)
			expect(result[0]).toHaveProperty("date")
			expect(result[0]).toHaveProperty("modelCosts")
			expect(result[0]).toHaveProperty("totalCost")
			expect(mockTelemetryRepository.createQueryBuilder).toHaveBeenCalled()
			expect(cache.set).toHaveBeenCalled()
		})
	})

	describe("getTopStats", () => {
		it("应该从缓存获取 Top 统计数据", async () => {
			const cachedData = {
				topCreators: [{ name: "User 1", value: 100, percentage: 50 }],
				topModels: [{ name: "gpt-4", value: 80, percentage: 40 }],
				topRepositories: [{ name: "repo-1", value: 60, percentage: 30 }],
			}

			// Mock: 缓存中存在
			vi.mocked(cache.get).mockResolvedValue(cachedData)

			const result = await dashboardService.getTopStats()

			expect(result).toEqual(cachedData)
			expect(cache.get).toHaveBeenCalled()
			expect(mockTelemetryRepository.createQueryBuilder).not.toHaveBeenCalled()
		})

		it("应该从数据库获取 Top 统计数据并缓存", async () => {
			const mockEvents = [
				{
					id: "event-001",
					userId: "user-123",
					organizationId: "org-456",
					eventType: "api_call",
					eventData: {
						creator: "user-123",
						model: "gpt-4",
						repository: "repo-1",
					},
					timestamp: new Date(),
				},
				{
					id: "event-002",
					userId: "user-123",
					organizationId: "org-456",
					eventType: "api_call",
					eventData: {
						creator: "user-123",
						model: "gpt-4",
						repository: "repo-1",
					},
					timestamp: new Date(),
				},
			]

			const mockUser = {
				id: "user-123",
				name: "Test User",
				email: "test@example.com",
			}

			const mockQueryBuilder = {
				where: vi.fn().mockReturnThis(),
				andWhere: vi.fn().mockReturnThis(),
				getMany: vi.fn().mockResolvedValue(mockEvents),
			}

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库查询
			mockTelemetryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

			// Mock: 用户查询
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await dashboardService.getTopStats()

			expect(result).toHaveProperty("topCreators")
			expect(result).toHaveProperty("topModels")
			expect(result).toHaveProperty("topRepositories")
			expect(result.topCreators).toBeInstanceOf(Array)
			expect(result.topModels).toBeInstanceOf(Array)
			expect(result.topRepositories).toBeInstanceOf(Array)
			expect(mockTelemetryRepository.createQueryBuilder).toHaveBeenCalled()
			expect(cache.set).toHaveBeenCalled()
		})

		it("应该支持按组织过滤", async () => {
			const organizationId = "org-456"

			const mockQueryBuilder = {
				where: vi.fn().mockReturnThis(),
				andWhere: vi.fn().mockReturnThis(),
				getMany: vi.fn().mockResolvedValue([]),
			}

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库查询
			mockTelemetryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			await dashboardService.getTopStats(organizationId)

			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith("event.organizationId = :organizationId", {
				organizationId,
			})
		})
	})

	describe("getDashboardOverview", () => {
		it("应该从缓存获取 Dashboard 概览数据", async () => {
			const cachedData = {
				totalApiCalls: 1000,
				totalTokens: 50000,
				totalCost: 100.5,
				activeUsers: 10,
			}

			// Mock: 缓存中存在
			vi.mocked(cache.get).mockResolvedValue(cachedData)

			const result = await dashboardService.getDashboardOverview()

			expect(result).toEqual(cachedData)
			expect(cache.get).toHaveBeenCalled()
			expect(mockTelemetryRepository.createQueryBuilder).not.toHaveBeenCalled()
		})

		it("应该从数据库获取 Dashboard 概览数据并缓存", async () => {
			const mockEvents = [
				{
					id: "event-001",
					userId: "user-123",
					organizationId: "org-456",
					eventType: "api_call",
					eventData: {
						inputTokens: 1000,
						outputTokens: 500,
						cost: 10.5,
					},
					timestamp: new Date(),
				},
				{
					id: "event-002",
					userId: "user-456",
					organizationId: "org-456",
					eventType: "api_call",
					eventData: {
						inputTokens: 2000,
						outputTokens: 1000,
						cost: 20.5,
					},
					timestamp: new Date(),
				},
			]

			const mockQueryBuilder = {
				where: vi.fn().mockReturnThis(),
				andWhere: vi.fn().mockReturnThis(),
				getMany: vi.fn().mockResolvedValue(mockEvents),
			}

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库查询
			mockTelemetryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await dashboardService.getDashboardOverview()

			expect(result.totalApiCalls).toBe(2)
			expect(result.totalTokens).toBe(4500) // 1000+500+2000+1000
			expect(result.totalCost).toBe(31) // 10.5+20.5
			expect(result.activeUsers).toBe(2)
			expect(mockTelemetryRepository.createQueryBuilder).toHaveBeenCalled()
			expect(cache.set).toHaveBeenCalled()
		})

		it("应该支持按组织过滤", async () => {
			const organizationId = "org-456"

			const mockQueryBuilder = {
				where: vi.fn().mockReturnThis(),
				andWhere: vi.fn().mockReturnThis(),
				getMany: vi.fn().mockResolvedValue([]),
			}

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库查询
			mockTelemetryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			await dashboardService.getDashboardOverview(organizationId)

			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith("event.organizationId = :organizationId", {
				organizationId,
			})
		})
	})
})
