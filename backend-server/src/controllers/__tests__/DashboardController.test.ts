import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { Request, Response } from "express"
import { DashboardController } from "../DashboardController.js"
import { dashboardService } from "../../services/DashboardService.js"

// Mock DashboardService
vi.mock("../../services/DashboardService.js", () => ({
	dashboardService: {
		getDashboardOverview: vi.fn(),
		getTokenUsageTrend: vi.fn(),
		getCostAnalysis: vi.fn(),
		getTopStats: vi.fn(),
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

describe("DashboardController", () => {
	let dashboardController: DashboardController
	let mockRequest: Partial<Request>
	let mockResponse: Partial<Response>
	let jsonMock: any
	let statusMock: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Create mock response
		jsonMock = vi.fn()
		statusMock = vi.fn().mockReturnValue({ json: jsonMock })

		mockResponse = {
			status: statusMock,
			json: jsonMock,
		}

		dashboardController = new DashboardController()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("getOverview", () => {
		it("应该成功获取 Dashboard 概览数据", async () => {
			const mockData = {
				totalApiCalls: 1000,
				totalTokens: 50000,
				totalCost: 100.5,
				activeUsers: 10,
			}

			mockRequest = {
				query: {},
			}

			vi.mocked(dashboardService.getDashboardOverview).mockResolvedValue(mockData)

			await dashboardController.getOverview(mockRequest as Request, mockResponse as Response)

			expect(dashboardService.getDashboardOverview).toHaveBeenCalledWith(undefined)
			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: mockData,
			})
		})

		it("应该支持按组织过滤", async () => {
			const organizationId = "org-456"
			const mockData = {
				totalApiCalls: 500,
				totalTokens: 25000,
				totalCost: 50.5,
				activeUsers: 5,
			}

			mockRequest = {
				query: { organizationId },
			}

			vi.mocked(dashboardService.getDashboardOverview).mockResolvedValue(mockData)

			await dashboardController.getOverview(mockRequest as Request, mockResponse as Response)

			expect(dashboardService.getDashboardOverview).toHaveBeenCalledWith(organizationId)
			expect(statusMock).toHaveBeenCalledWith(200)
		})

		it("应该处理服务层错误", async () => {
			mockRequest = {
				query: {},
			}

			vi.mocked(dashboardService.getDashboardOverview).mockRejectedValue(new Error("Database error"))

			await dashboardController.getOverview(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(500)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Internal server error",
			})
		})
	})

	describe("getTokenUsage", () => {
		it("应该成功获取 Token 使用趋势数据", async () => {
			const mockData = [
				{
					date: "2024-01-01",
					inputTokens: 1000,
					outputTokens: 500,
					totalTokens: 1500,
				},
			]

			mockRequest = {
				query: { days: "7" },
			}

			vi.mocked(dashboardService.getTokenUsageTrend).mockResolvedValue(mockData)

			await dashboardController.getTokenUsage(mockRequest as Request, mockResponse as Response)

			expect(dashboardService.getTokenUsageTrend).toHaveBeenCalledWith(7, undefined)
			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: mockData,
			})
		})

		it("应该使用默认的天数参数", async () => {
			const mockData = []

			mockRequest = {
				query: {},
			}

			vi.mocked(dashboardService.getTokenUsageTrend).mockResolvedValue(mockData)

			await dashboardController.getTokenUsage(mockRequest as Request, mockResponse as Response)

			expect(dashboardService.getTokenUsageTrend).toHaveBeenCalledWith(7, undefined)
		})

		it("应该支持按组织过滤", async () => {
			const organizationId = "org-456"
			const mockData = []

			mockRequest = {
				query: { days: "14", organizationId },
			}

			vi.mocked(dashboardService.getTokenUsageTrend).mockResolvedValue(mockData)

			await dashboardController.getTokenUsage(mockRequest as Request, mockResponse as Response)

			expect(dashboardService.getTokenUsageTrend).toHaveBeenCalledWith(14, organizationId)
		})

		it("应该验证天数参数范围", async () => {
			mockRequest = {
				query: { days: "500" }, // 超出最大值 365
			}

			await dashboardController.getTokenUsage(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(400)
			expect(jsonMock).toHaveBeenCalledWith(
				expect.objectContaining({
					success: false,
					error: "Validation failed",
				}),
			)
		})

		it("应该处理服务层错误", async () => {
			mockRequest = {
				query: { days: "7" },
			}

			vi.mocked(dashboardService.getTokenUsageTrend).mockRejectedValue(new Error("Database error"))

			await dashboardController.getTokenUsage(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(500)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Internal server error",
			})
		})
	})

	describe("getCostAnalysis", () => {
		it("应该成功获取成本分析数据", async () => {
			const mockData = [
				{
					date: "2024-01-01",
					modelCosts: { "gpt-4": 10.5 },
					totalCost: 10.5,
				},
			]

			mockRequest = {
				query: { days: "7" },
			}

			vi.mocked(dashboardService.getCostAnalysis).mockResolvedValue(mockData)

			await dashboardController.getCostAnalysis(mockRequest as Request, mockResponse as Response)

			expect(dashboardService.getCostAnalysis).toHaveBeenCalledWith(7, undefined)
			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: mockData,
			})
		})

		it("应该使用默认的天数参数", async () => {
			const mockData = []

			mockRequest = {
				query: {},
			}

			vi.mocked(dashboardService.getCostAnalysis).mockResolvedValue(mockData)

			await dashboardController.getCostAnalysis(mockRequest as Request, mockResponse as Response)

			expect(dashboardService.getCostAnalysis).toHaveBeenCalledWith(7, undefined)
		})

		it("应该支持按组织过滤", async () => {
			const organizationId = "org-456"
			const mockData = []

			mockRequest = {
				query: { days: "30", organizationId },
			}

			vi.mocked(dashboardService.getCostAnalysis).mockResolvedValue(mockData)

			await dashboardController.getCostAnalysis(mockRequest as Request, mockResponse as Response)

			expect(dashboardService.getCostAnalysis).toHaveBeenCalledWith(30, organizationId)
		})

		it("应该验证天数参数范围", async () => {
			mockRequest = {
				query: { days: "0" }, // 小于最小值 1
			}

			await dashboardController.getCostAnalysis(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(400)
			expect(jsonMock).toHaveBeenCalledWith(
				expect.objectContaining({
					success: false,
					error: "Validation failed",
				}),
			)
		})

		it("应该处理服务层错误", async () => {
			mockRequest = {
				query: { days: "7" },
			}

			vi.mocked(dashboardService.getCostAnalysis).mockRejectedValue(new Error("Database error"))

			await dashboardController.getCostAnalysis(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(500)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Internal server error",
			})
		})
	})

	describe("getTopStats", () => {
		it("应该成功获取 Top 统计数据", async () => {
			const mockData = {
				topCreators: [{ name: "User 1", value: 100, percentage: 50 }],
				topModels: [{ name: "gpt-4", value: 80, percentage: 40 }],
				topRepositories: [{ name: "repo-1", value: 60, percentage: 30 }],
			}

			mockRequest = {
				query: {},
			}

			vi.mocked(dashboardService.getTopStats).mockResolvedValue(mockData)

			await dashboardController.getTopStats(mockRequest as Request, mockResponse as Response)

			expect(dashboardService.getTopStats).toHaveBeenCalledWith(undefined)
			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: mockData,
			})
		})

		it("应该支持按组织过滤", async () => {
			const organizationId = "org-456"
			const mockData = {
				topCreators: [],
				topModels: [],
				topRepositories: [],
			}

			mockRequest = {
				query: { organizationId },
			}

			vi.mocked(dashboardService.getTopStats).mockResolvedValue(mockData)

			await dashboardController.getTopStats(mockRequest as Request, mockResponse as Response)

			expect(dashboardService.getTopStats).toHaveBeenCalledWith(organizationId)
			expect(statusMock).toHaveBeenCalledWith(200)
		})

		it("应该处理服务层错误", async () => {
			mockRequest = {
				query: {},
			}

			vi.mocked(dashboardService.getTopStats).mockRejectedValue(new Error("Database error"))

			await dashboardController.getTopStats(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(500)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Internal server error",
			})
		})
	})
})
