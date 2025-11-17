import { nanoid } from "nanoid"
import { LessThan } from "typeorm"
import { AppDataSource } from "../config/database.js"
import { TelemetryEvent } from "../entities/TelemetryEvent.js"
import { User } from "../entities/User.js"
import { Organization } from "../entities/Organization.js"
import { cache, CacheKeys } from "../utils/cache.js"
import { logger } from "../utils/logger.js"

/**
 * 遥测事件数据接口
 */
export interface TelemetryEventData {
	id: string
	userId: string
	organizationId: string
	eventType: string
	eventData?: Record<string, any>
	timestamp: number
}

/**
 * 记录遥测参数接口
 */
export interface RecordTelemetryParams {
	userId: string
	organizationId: string
	eventType: string
	eventData?: Record<string, any>
}

/**
 * 遥测统计接口
 */
export interface TelemetryStats {
	totalEvents: number
	eventsByType: Record<string, number>
	recentEvents: TelemetryEventData[]
}

/**
 * TelemetryService 类
 * 处理遥测数据相关的业务逻辑
 */
export class TelemetryService {
	private telemetryRepository = AppDataSource.getRepository(TelemetryEvent)
	private userRepository = AppDataSource.getRepository(User)
	private organizationRepository = AppDataSource.getRepository(Organization)

	/**
	 * 记录遥测数据
	 * @param params 遥测参数
	 * @returns 记录的遥测事件
	 */
	async recordTelemetry(params: RecordTelemetryParams): Promise<TelemetryEventData> {
		const { userId, organizationId, eventType, eventData } = params

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

			// 创建遥测事件
			const eventId = nanoid()
			const telemetryEvent = this.telemetryRepository.create({
				id: eventId,
				userId,
				organizationId,
				eventType,
				eventData: eventData || {},
			})

			await this.telemetryRepository.save(telemetryEvent)

			logger.info("Telemetry recorded", { eventId, userId, organizationId, eventType })

			// 清除相关的缓存
			await this.clearTelemetryCache(userId, organizationId)

			return this.mapTelemetryToData(telemetryEvent)
		} catch (error) {
			logger.error("Record telemetry failed", { params, error })
			throw error
		}
	}

	/**
	 * 获取任务的遥测数据
	 * @param taskId 任务 ID
	 * @returns 遥测事件列表
	 */
	async getTaskTelemetry(taskId: string): Promise<TelemetryEventData[]> {
		try {
			// 先尝试从缓存获取
			const cacheKey = CacheKeys.stats("task_telemetry", taskId)
			const cached = await cache.get<TelemetryEventData[]>(cacheKey)
			if (cached) {
				return cached
			}

			// 从数据库查询（通过 eventData 中的 taskId）
			const events = await this.telemetryRepository
				.createQueryBuilder("event")
				.where("event.eventData->>'taskId' = :taskId", { taskId })
				.orderBy("event.timestamp", "DESC")
				.limit(100)
				.getMany()

			const result = events.map((event) => this.mapTelemetryToData(event))

			// 缓存结果（5分钟）
			await cache.set(cacheKey, result, 300)

			return result
		} catch (error) {
			logger.error("Get task telemetry failed", { taskId, error })
			throw error
		}
	}

	/**
	 * 获取用户的遥测统计
	 * @param userId 用户 ID
	 * @returns 遥测统计数据
	 */
	async getUserTelemetryStats(userId: string): Promise<TelemetryStats> {
		try {
			// 先尝试从缓存获取
			const cacheKey = CacheKeys.stats("user_telemetry", userId)
			const cached = await cache.get<TelemetryStats>(cacheKey)
			if (cached) {
				return cached
			}

			// 从数据库查询
			const events = await this.telemetryRepository.find({
				where: { userId },
				order: { timestamp: "DESC" },
				take: 100,
			})

			// 统计按事件类型分组
			const eventsByType: Record<string, number> = {}
			events.forEach((event) => {
				eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1
			})

			const stats: TelemetryStats = {
				totalEvents: events.length,
				eventsByType,
				recentEvents: events.slice(0, 10).map((event) => this.mapTelemetryToData(event)),
			}

			// 缓存结果（10分钟）
			await cache.set(cacheKey, stats, 600)

			return stats
		} catch (error) {
			logger.error("Get user telemetry stats failed", { userId, error })
			throw error
		}
	}

	/**
	 * 获取组织的遥测统计
	 * @param organizationId 组织 ID
	 * @returns 遥测统计数据
	 */
	async getOrganizationTelemetryStats(organizationId: string): Promise<TelemetryStats> {
		try {
			// 先尝试从缓存获取
			const cacheKey = CacheKeys.stats("org_telemetry", organizationId)
			const cached = await cache.get<TelemetryStats>(cacheKey)
			if (cached) {
				return cached
			}

			// 从数据库查询
			const events = await this.telemetryRepository.find({
				where: { organizationId },
				order: { timestamp: "DESC" },
				take: 100,
			})

			// 统计按事件类型分组
			const eventsByType: Record<string, number> = {}
			events.forEach((event) => {
				eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1
			})

			const stats: TelemetryStats = {
				totalEvents: events.length,
				eventsByType,
				recentEvents: events.slice(0, 10).map((event) => this.mapTelemetryToData(event)),
			}

			// 缓存结果（10分钟）
			await cache.set(cacheKey, stats, 600)

			return stats
		} catch (error) {
			logger.error("Get organization telemetry stats failed", { organizationId, error })
			throw error
		}
	}

	/**
	 * 清理过期遥测数据
	 * @param daysToKeep 保留天数
	 * @returns 删除的记录数
	 */
	async cleanupOldTelemetry(daysToKeep: number = 90): Promise<number> {
		try {
			const cutoffDate = new Date()
			cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

			const result = await this.telemetryRepository.delete({
				timestamp: LessThan(cutoffDate),
			})

			const deletedCount = result.affected || 0

			logger.info("Old telemetry cleaned up", { daysToKeep, deletedCount })

			// 清除所有遥测相关的缓存
			await cache.delPattern("stats:*_telemetry:*")

			return deletedCount
		} catch (error) {
			logger.error("Cleanup old telemetry failed", { daysToKeep, error })
			throw error
		}
	}

	/**
	 * 映射 TelemetryEvent 实体到数据对象
	 */
	private mapTelemetryToData(event: TelemetryEvent): TelemetryEventData {
		return {
			id: event.id,
			userId: event.userId,
			organizationId: event.organizationId,
			eventType: event.eventType,
			eventData: event.eventData,
			timestamp: event.timestamp.getTime(),
		}
	}

	/**
	 * 清除遥测缓存
	 */
	private async clearTelemetryCache(userId: string, organizationId: string): Promise<void> {
		await cache.del(CacheKeys.stats("user_telemetry", userId))
		await cache.del(CacheKeys.stats("org_telemetry", organizationId))
	}
}

/**
 * 导出 TelemetryService 单例
 */
export const telemetryService = new TelemetryService()
