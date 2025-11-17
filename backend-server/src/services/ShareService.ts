import { nanoid } from "nanoid"
import { AppDataSource } from "../config/database.js"
import { Share } from "../entities/Share.js"
import { Task } from "../entities/Task.js"
import { User } from "../entities/User.js"
import { cache, CacheKeys } from "../utils/cache.js"
import { logger } from "../utils/logger.js"

/**
 * 分享数据接口
 */
export interface ShareData {
	id: string
	taskId: string
	shareUrl: string
	visibility: "public" | "organization"
	createdBy: string
	createdAt: number
}

/**
 * 创建分享参数接口
 */
export interface CreateShareParams {
	taskId: string
	visibility: "public" | "organization"
	createdBy: string
}

/**
 * ShareService 类
 * 处理分享链接相关的业务逻辑
 */
export class ShareService {
	private shareRepository = AppDataSource.getRepository(Share)
	private taskRepository = AppDataSource.getRepository(Task)
	private userRepository = AppDataSource.getRepository(User)

	/**
	 * 创建分享链接
	 * @param params 创建参数
	 * @returns 创建的分享
	 */
	async createShare(params: CreateShareParams): Promise<ShareData> {
		const { taskId, visibility, createdBy } = params

		try {
			// 验证任务是否存在
			const task = await this.taskRepository.findOne({ where: { id: taskId } })
			if (!task) {
				throw new Error("Task not found")
			}

			// 验证创建者是否存在
			const user = await this.userRepository.findOne({ where: { id: createdBy } })
			if (!user) {
				throw new Error("User not found")
			}

			// 生成分享链接
			const shareId = nanoid()
			const shareToken = nanoid(16)
			const shareUrl = `/share/${shareToken}`

			// 创建分享
			const share = this.shareRepository.create({
				id: shareId,
				taskId,
				shareUrl,
				visibility,
				createdBy,
			})

			await this.shareRepository.save(share)

			logger.info("Share created", { shareId, taskId, visibility, createdBy })

			// 缓存分享（30分钟）
			const result = this.mapShareToData(share)
			await cache.set(this.getShareCacheKey(shareId), result, 1800)
			await cache.set(this.getShareUrlCacheKey(shareUrl), result, 1800)

			return result
		} catch (error) {
			logger.error("Create share failed", { params, error })
			throw error
		}
	}

	/**
	 * 获取分享详情
	 * @param shareId 分享 ID
	 * @returns 分享信息
	 */
	async getShare(shareId: string): Promise<ShareData> {
		try {
			// 先尝试从缓存获取
			const cacheKey = this.getShareCacheKey(shareId)
			const cached = await cache.get<ShareData>(cacheKey)
			if (cached) {
				return cached
			}

			// 从数据库查询
			const share = await this.shareRepository.findOne({
				where: { id: shareId },
			})

			if (!share) {
				throw new Error("Share not found")
			}

			const result = this.mapShareToData(share)

			// 缓存结果（30分钟）
			await cache.set(cacheKey, result, 1800)

			return result
		} catch (error) {
			logger.error("Get share failed", { shareId, error })
			throw error
		}
	}

	/**
	 * 验证分享链接
	 * @param shareUrl 分享链接
	 * @returns 分享信息（如果有效）
	 */
	async validateShare(shareUrl: string): Promise<ShareData> {
		try {
			// 先尝试从缓存获取
			const cacheKey = this.getShareUrlCacheKey(shareUrl)
			const cached = await cache.get<ShareData>(cacheKey)
			if (cached) {
				return cached
			}

			// 从数据库查询
			const share = await this.shareRepository.findOne({
				where: { shareUrl },
			})

			if (!share) {
				throw new Error("Invalid share URL")
			}

			const result = this.mapShareToData(share)

			// 缓存结果（30分钟）
			await cache.set(cacheKey, result, 1800)

			return result
		} catch (error) {
			logger.error("Validate share failed", { shareUrl, error })
			throw error
		}
	}

	/**
	 * 撤销分享
	 * @param shareId 分享 ID
	 * @param userId 用户 ID（验证权限）
	 */
	async revokeShare(shareId: string, userId: string): Promise<void> {
		try {
			const share = await this.shareRepository.findOne({
				where: { id: shareId },
			})

			if (!share) {
				throw new Error("Share not found")
			}

			// 验证权限：只有创建者可以撤销
			if (share.createdBy !== userId) {
				throw new Error("Permission denied")
			}

			// 删除分享
			await this.shareRepository.remove(share)

			logger.info("Share revoked", { shareId, userId })

			// 清除缓存
			await this.clearShareCache(shareId, share.shareUrl)
		} catch (error) {
			logger.error("Revoke share failed", { shareId, userId, error })
			throw error
		}
	}

	/**
	 * 列出任务的分享
	 * @param taskId 任务 ID
	 * @returns 分享列表
	 */
	async listTaskShares(taskId: string): Promise<ShareData[]> {
		try {
			const shares = await this.shareRepository.find({
				where: { taskId },
				order: { createdAt: "DESC" },
			})

			return shares.map((share) => this.mapShareToData(share))
		} catch (error) {
			logger.error("List task shares failed", { taskId, error })
			throw error
		}
	}

	/**
	 * 更新分享访问次数
	 * @param shareId 分享 ID
	 * @returns 更新后的分享信息
	 */
	async updateAccessCount(shareId: string): Promise<ShareData> {
		try {
			const share = await this.shareRepository.findOne({
				where: { id: shareId },
			})

			if (!share) {
				throw new Error("Share not found")
			}

			// 使用 Redis 原子递增来记录访问次数
			const accessCountKey = `share:access:${shareId}`
			await cache.incr(accessCountKey)

			logger.info("Share access count updated", { shareId })

			return this.mapShareToData(share)
		} catch (error) {
			logger.error("Update access count failed", { shareId, error })
			throw error
		}
	}

	/**
	 * 映射 Share 实体到数据对象
	 */
	private mapShareToData(share: Share): ShareData {
		return {
			id: share.id,
			taskId: share.taskId,
			shareUrl: share.shareUrl,
			visibility: share.visibility,
			createdBy: share.createdBy,
			createdAt: share.createdAt.getTime(),
		}
	}

	/**
	 * 获取分享缓存键
	 */
	private getShareCacheKey(shareId: string): string {
		return `share:${shareId}`
	}

	/**
	 * 获取分享URL缓存键
	 */
	private getShareUrlCacheKey(shareUrl: string): string {
		return `share:url:${shareUrl}`
	}

	/**
	 * 清除分享缓存
	 */
	private async clearShareCache(shareId: string, shareUrl: string): Promise<void> {
		await cache.del(this.getShareCacheKey(shareId))
		await cache.del(this.getShareUrlCacheKey(shareUrl))
	}
}

/**
 * 导出 ShareService 单例
 */
export const shareService = new ShareService()
