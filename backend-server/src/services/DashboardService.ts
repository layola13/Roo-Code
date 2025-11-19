import { Between } from "typeorm"
import { AppDataSource } from "../config/database.js"
import { TelemetryEvent } from "../entities/TelemetryEvent.js"
import { User } from "../entities/User.js"
import { cache, CacheKeys } from "../utils/cache.js"
import { logger } from "../utils/logger.js"

/**
 * Token 使用趋势数据点接口
 */
export interface TokenUsageTrendPoint {
	date: string
	inputTokens: number
	outputTokens: number
	totalTokens: number
}

/**
 * 成本分析数据点接口
 */
export interface CostAnalysisPoint {
	date: string
	modelCosts: Record<string, number>
	totalCost: number
}

/**
 * Top 统计项接口
 */
export interface TopStatItem {
	name: string
	value: number
	percentage: number
}

/**
 * Top 统计数据接口
 */
export interface TopStats {
	topCreators: TopStatItem[]
	topModels: TopStatItem[]
	topRepositories: TopStatItem[]
}

/**
 * Dashboard 概览数据接口
 */
export interface DashboardOverview {
	totalApiCalls: number
	totalTokens: number
	totalCost: number
	activeUsers: number
}

/**
 * DashboardService 类
 * 处理 Dashboard 数据可视化相关的业务逻辑
 */
export class DashboardService {
	private telemetryRepository = AppDataSource.getRepository(TelemetryEvent)
	private userRepository = AppDataSource.getRepository(User)

	/**
	 * 获取 Token 使用趋势（最近 N 天）
	 * @param days 天数
	 * @param organizationId 组织 ID（可选）
	 * @returns Token 使用趋势数据
	 */
	async getTokenUsageTrend(days: number = 7, organizationId?: string): Promise<TokenUsageTrendPoint[]> {
		try {
			// 先尝试从缓存获取
			const cacheKey = CacheKeys.stats(
				"token_usage_trend",
				organizationId ? `${organizationId}_${days}` : `all_${days}`,
			)
			const cached = await cache.get<TokenUsageTrendPoint[]>(cacheKey)
			if (cached) {
				return cached
			}

			// 计算日期范围
			const endDate = new Date()
			const startDate = new Date()
			startDate.setDate(startDate.getDate() - days)

			// 查询遥测事件
			const queryBuilder = this.telemetryRepository
				.createQueryBuilder("event")
				.where("event.timestamp BETWEEN :startDate AND :endDate", { startDate, endDate })
				.andWhere("event.eventType = :eventType", { eventType: "api_call" })

			if (organizationId) {
				queryBuilder.andWhere("event.organizationId = :organizationId", { organizationId })
			}

			const events = await queryBuilder.getMany()

			// 按日期聚合数据
			const dataByDate = new Map<string, { inputTokens: number; outputTokens: number }>()

			// 初始化所有日期
			for (let i = 0; i < days; i++) {
				const date = new Date(startDate)
				date.setDate(date.getDate() + i)
				const dateStr = date.toISOString().split("T")[0]
				if (dateStr) {
					dataByDate.set(dateStr, { inputTokens: 0, outputTokens: 0 })
				}
			}

			// 聚合事件数据
			events.forEach((event) => {
				const dateStr = event.timestamp.toISOString().split("T")[0]
				if (!dateStr) return
				const data = dataByDate.get(dateStr)
				if (data && event.eventData) {
					data.inputTokens += event.eventData.inputTokens || 0
					data.outputTokens += event.eventData.outputTokens || 0
				}
			})

			// 转换为结果数组
			const result: TokenUsageTrendPoint[] = Array.from(dataByDate.entries())
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([date, data]) => ({
					date,
					inputTokens: data.inputTokens,
					outputTokens: data.outputTokens,
					totalTokens: data.inputTokens + data.outputTokens,
				}))

			// 缓存结果（10分钟）
			await cache.set(cacheKey, result, 600)

			return result
		} catch (error) {
			logger.error("Get token usage trend failed", { days, organizationId, error })
			throw error
		}
	}

	/**
	 * 获取成本分析（最近 N 天）
	 * @param days 天数
	 * @param organizationId 组织 ID（可选）
	 * @returns 成本分析数据
	 */
	async getCostAnalysis(days: number = 7, organizationId?: string): Promise<CostAnalysisPoint[]> {
		try {
			// 先尝试从缓存获取
			const cacheKey = CacheKeys.stats(
				"cost_analysis",
				organizationId ? `${organizationId}_${days}` : `all_${days}`,
			)
			const cached = await cache.get<CostAnalysisPoint[]>(cacheKey)
			if (cached) {
				return cached
			}

			// 计算日期范围
			const endDate = new Date()
			const startDate = new Date()
			startDate.setDate(startDate.getDate() - days)

			// 查询遥测事件
			const queryBuilder = this.telemetryRepository
				.createQueryBuilder("event")
				.where("event.timestamp BETWEEN :startDate AND :endDate", { startDate, endDate })
				.andWhere("event.eventType = :eventType", { eventType: "api_call" })

			if (organizationId) {
				queryBuilder.andWhere("event.organizationId = :organizationId", { organizationId })
			}

			const events = await queryBuilder.getMany()

			// 按日期和模型聚合数据
			const dataByDate = new Map<string, Record<string, number>>()

			// 初始化所有日期
			for (let i = 0; i < days; i++) {
				const date = new Date(startDate)
				date.setDate(date.getDate() + i)
				const dateStr = date.toISOString().split("T")[0]
				if (dateStr) {
					dataByDate.set(dateStr, {})
				}
			}

			// 聚合事件数据
			events.forEach((event) => {
				const dateStr = event.timestamp.toISOString().split("T")[0]
				if (!dateStr) return
				const modelCosts = dataByDate.get(dateStr)
				if (modelCosts && event.eventData) {
					const model = event.eventData.model || "unknown"
					const cost = event.eventData.cost || 0
					modelCosts[model] = (modelCosts[model] || 0) + cost
				}
			})

			// 转换为结果数组
			const result: CostAnalysisPoint[] = Array.from(dataByDate.entries())
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([date, modelCosts]) => {
					const totalCost = Object.values(modelCosts).reduce((sum, cost) => sum + cost, 0)
					return {
						date,
						modelCosts,
						totalCost,
					}
				})

			// 缓存结果（10分钟）
			await cache.set(cacheKey, result, 600)

			return result
		} catch (error) {
			logger.error("Get cost analysis failed", { days, organizationId, error })
			throw error
		}
	}

	/**
	 * 获取 Top 统计数据
	 * @param organizationId 组织 ID（可选）
	 * @returns Top 统计数据
	 */
	async getTopStats(organizationId?: string): Promise<TopStats> {
		try {
			// 先尝试从缓存获取
			const cacheKey = CacheKeys.stats("top_stats", organizationId || "all")
			const cached = await cache.get<TopStats>(cacheKey)
			if (cached) {
				return cached
			}

			// 查询最近 30 天的遥测事件
			const endDate = new Date()
			const startDate = new Date()
			startDate.setDate(startDate.getDate() - 30)

			const queryBuilder = this.telemetryRepository
				.createQueryBuilder("event")
				.where("event.timestamp BETWEEN :startDate AND :endDate", { startDate, endDate })
				.andWhere("event.eventType = :eventType", { eventType: "api_call" })

			if (organizationId) {
				queryBuilder.andWhere("event.organizationId = :organizationId", { organizationId })
			}

			const events = await queryBuilder.getMany()

			// 统计创建者使用量
			const creatorStats = new Map<string, number>()
			const modelStats = new Map<string, number>()
			const repositoryStats = new Map<string, number>()

			let totalApiCalls = 0

			events.forEach((event) => {
				totalApiCalls++

				if (event.eventData) {
					// 统计创建者
					const creator = event.eventData.creator || event.userId
					creatorStats.set(creator, (creatorStats.get(creator) || 0) + 1)

					// 统计模型
					const model = event.eventData.model || "unknown"
					modelStats.set(model, (modelStats.get(model) || 0) + 1)

					// 统计仓库
					const repository = event.eventData.repository
					if (repository) {
						repositoryStats.set(repository, (repositoryStats.get(repository) || 0) + 1)
					}
				}
			})

			// 转换为 Top 列表
			const topCreators = await this.getTopItems(creatorStats, totalApiCalls, true)
			const topModels = this.getTopItemsSync(modelStats, totalApiCalls)
			const topRepositories = this.getTopItemsSync(repositoryStats, totalApiCalls)

			const result: TopStats = {
				topCreators,
				topModels,
				topRepositories,
			}

			// 缓存结果（10分钟）
			await cache.set(cacheKey, result, 600)

			return result
		} catch (error) {
			logger.error("Get top stats failed", { organizationId, error })
			throw error
		}
	}

	/**
	 * 获取 Dashboard 概览数据
	 * @param organizationId 组织 ID（可选）
	 * @returns Dashboard 概览数据
	 */
	async getDashboardOverview(organizationId?: string): Promise<DashboardOverview> {
		try {
			// 先尝试从缓存获取
			const cacheKey = CacheKeys.stats("dashboard_overview", organizationId || "all")
			const cached = await cache.get<DashboardOverview>(cacheKey)
			if (cached) {
				return cached
			}

			// 查询最近 30 天的遥测事件
			const endDate = new Date()
			const startDate = new Date()
			startDate.setDate(startDate.getDate() - 30)

			const queryBuilder = this.telemetryRepository
				.createQueryBuilder("event")
				.where("event.timestamp BETWEEN :startDate AND :endDate", { startDate, endDate })
				.andWhere("event.eventType = :eventType", { eventType: "api_call" })

			if (organizationId) {
				queryBuilder.andWhere("event.organizationId = :organizationId", { organizationId })
			}

			const events = await queryBuilder.getMany()

			// 统计数据
			let totalTokens = 0
			let totalCost = 0
			const uniqueUsers = new Set<string>()

			events.forEach((event) => {
				if (event.eventData) {
					totalTokens += (event.eventData.inputTokens || 0) + (event.eventData.outputTokens || 0)
					totalCost += event.eventData.cost || 0
				}
				uniqueUsers.add(event.userId)
			})

			const result: DashboardOverview = {
				totalApiCalls: events.length,
				totalTokens,
				totalCost,
				activeUsers: uniqueUsers.size,
			}

			// 缓存结果（5分钟）
			await cache.set(cacheKey, result, 300)

			return result
		} catch (error) {
			logger.error("Get dashboard overview failed", { organizationId, error })
			throw error
		}
	}

	/**
	 * 获取 Top 项目列表
	 * @param statsMap 统计数据 Map
	 * @param total 总数
	 * @param resolveUserNames 是否解析用户名
	 * @returns Top 项目列表
	 */
	private async getTopItems(
		statsMap: Map<string, number>,
		total: number,
		resolveUserNames: boolean = false,
	): Promise<TopStatItem[]> {
		const items = Array.from(statsMap.entries())
			.sort(([, a], [, b]) => b - a)
			.slice(0, 10)

		const result: TopStatItem[] = []

		for (const [key, value] of items) {
			let name = key

			// 如果需要解析用户名
			if (resolveUserNames) {
				try {
					const user = await this.userRepository.findOne({ where: { id: key } })
					if (user) {
						name = user.name || user.email || key
					}
				} catch (error) {
					logger.warn("Failed to resolve user name", { userId: key, error })
				}
			}

			result.push({
				name,
				value,
				percentage: total > 0 ? Math.round((value / total) * 100 * 100) / 100 : 0,
			})
		}

		return result
	}

	/**
	 * 获取 Top 项目列表（同步版本）
	 * @param statsMap 统计数据 Map
	 * @param total 总数
	 * @returns Top 项目列表
	 */
	private getTopItemsSync(statsMap: Map<string, number>, total: number): TopStatItem[] {
		const items = Array.from(statsMap.entries())
			.sort(([, a], [, b]) => b - a)
			.slice(0, 10)

		return items.map(([name, value]) => ({
			name,
			value,
			percentage: total > 0 ? Math.round((value / total) * 100 * 100) / 100 : 0,
		}))
	}
}

/**
 * 导出 DashboardService 单例
 */
export const dashboardService = new DashboardService()
