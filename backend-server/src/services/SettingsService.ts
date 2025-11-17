import { AppDataSource } from "../config/database.js"
import { User } from "../entities/User.js"
import { Organization } from "../entities/Organization.js"
import { cache, CacheKeys } from "../utils/cache.js"
import { logger } from "../utils/logger.js"

/**
 * 用户设置数据接口
 */
export interface UserSettingsData {
	userId: string
	settings: Record<string, any>
	updatedAt: number
}

/**
 * 组织设置数据接口
 */
export interface OrganizationSettingsData {
	organizationId: string
	settings: Record<string, any>
	updatedAt: number
}

/**
 * 默认用户设置
 */
const DEFAULT_USER_SETTINGS = {
	theme: "light",
	language: "en",
	notifications: {
		email: true,
		push: false,
	},
	privacy: {
		showProfile: true,
		showActivity: false,
	},
}

/**
 * 默认组织设置
 */
const DEFAULT_ORGANIZATION_SETTINGS = {
	allowPublicSharing: true,
	requireApproval: false,
	defaultVisibility: "organization",
	retentionDays: 90,
}

/**
 * SettingsService 类
 * 处理用户和组织设置相关的业务逻辑
 */
export class SettingsService {
	private userRepository = AppDataSource.getRepository(User)
	private organizationRepository = AppDataSource.getRepository(Organization)

	/**
	 * 获取用户设置
	 * @param userId 用户 ID
	 * @returns 用户设置
	 */
	async getUserSettings(userId: string): Promise<UserSettingsData> {
		try {
			// 先尝试从缓存获取
			const cacheKey = CacheKeys.userSettings(userId)
			const cached = await cache.get<UserSettingsData>(cacheKey)
			if (cached) {
				return cached
			}

			// 从数据库查询
			const user = await this.userRepository.findOne({
				where: { id: userId },
			})

			if (!user) {
				throw new Error("User not found")
			}

			// 合并默认设置和用户自定义设置
			const settings = {
				...DEFAULT_USER_SETTINGS,
				...(user.settings || {}),
			}

			const result: UserSettingsData = {
				userId,
				settings,
				updatedAt: user.updatedAt.getTime(),
			}

			// 缓存结果（15分钟）
			await cache.set(cacheKey, result, 900)

			return result
		} catch (error) {
			logger.error("Get user settings failed", { userId, error })
			throw error
		}
	}

	/**
	 * 更新用户设置
	 * @param userId 用户 ID
	 * @param updates 设置更新
	 * @returns 更新后的用户设置
	 */
	async updateUserSettings(userId: string, updates: Record<string, any>): Promise<UserSettingsData> {
		try {
			const user = await this.userRepository.findOne({
				where: { id: userId },
			})

			if (!user) {
				throw new Error("User not found")
			}

			// 合并现有设置和更新
			const currentSettings = user.settings || {}
			const newSettings = this.deepMerge(currentSettings, updates)

			// 更新用户设置
			user.settings = newSettings
			await this.userRepository.save(user)

			logger.info("User settings updated", { userId, updates })

			// 清除缓存
			await cache.del(CacheKeys.userSettings(userId))

			const result: UserSettingsData = {
				userId,
				settings: newSettings,
				updatedAt: user.updatedAt.getTime(),
			}

			return result
		} catch (error) {
			logger.error("Update user settings failed", { userId, updates, error })
			throw error
		}
	}

	/**
	 * 获取组织设置
	 * @param organizationId 组织 ID
	 * @returns 组织设置
	 */
	async getOrganizationSettings(organizationId: string): Promise<OrganizationSettingsData> {
		try {
			// 先尝试从缓存获取
			const cacheKey = CacheKeys.orgSettings(organizationId)
			const cached = await cache.get<OrganizationSettingsData>(cacheKey)
			if (cached) {
				return cached
			}

			// 从数据库查询
			const organization = await this.organizationRepository.findOne({
				where: { id: organizationId },
			})

			if (!organization) {
				throw new Error("Organization not found")
			}

			// 合并默认设置和组织自定义设置
			const settings = {
				...DEFAULT_ORGANIZATION_SETTINGS,
				...(organization.settings || {}),
			}

			const result: OrganizationSettingsData = {
				organizationId,
				settings,
				updatedAt: organization.updatedAt.getTime(),
			}

			// 缓存结果（15分钟）
			await cache.set(cacheKey, result, 900)

			return result
		} catch (error) {
			logger.error("Get organization settings failed", { organizationId, error })
			throw error
		}
	}

	/**
	 * 更新组织设置
	 * @param organizationId 组织 ID
	 * @param updates 设置更新
	 * @returns 更新后的组织设置
	 */
	async updateOrganizationSettings(
		organizationId: string,
		updates: Record<string, any>,
	): Promise<OrganizationSettingsData> {
		try {
			const organization = await this.organizationRepository.findOne({
				where: { id: organizationId },
			})

			if (!organization) {
				throw new Error("Organization not found")
			}

			// 合并现有设置和更新
			const currentSettings = organization.settings || {}
			const newSettings = this.deepMerge(currentSettings, updates)

			// 更新组织设置
			organization.settings = newSettings
			await this.organizationRepository.save(organization)

			logger.info("Organization settings updated", { organizationId, updates })

			// 清除缓存
			await cache.del(CacheKeys.orgSettings(organizationId))

			const result: OrganizationSettingsData = {
				organizationId,
				settings: newSettings,
				updatedAt: organization.updatedAt.getTime(),
			}

			return result
		} catch (error) {
			logger.error("Update organization settings failed", { organizationId, updates, error })
			throw error
		}
	}

	/**
	 * 重置用户设置为默认值
	 * @param userId 用户 ID
	 * @returns 重置后的用户设置
	 */
	async resetUserToDefaults(userId: string): Promise<UserSettingsData> {
		try {
			const user = await this.userRepository.findOne({
				where: { id: userId },
			})

			if (!user) {
				throw new Error("User not found")
			}

			// 重置为默认设置
			user.settings = { ...DEFAULT_USER_SETTINGS }
			await this.userRepository.save(user)

			logger.info("User settings reset to defaults", { userId })

			// 清除缓存
			await cache.del(CacheKeys.userSettings(userId))

			const result: UserSettingsData = {
				userId,
				settings: user.settings,
				updatedAt: user.updatedAt.getTime(),
			}

			return result
		} catch (error) {
			logger.error("Reset user settings failed", { userId, error })
			throw error
		}
	}

	/**
	 * 重置组织设置为默认值
	 * @param organizationId 组织 ID
	 * @returns 重置后的组织设置
	 */
	async resetOrganizationToDefaults(organizationId: string): Promise<OrganizationSettingsData> {
		try {
			const organization = await this.organizationRepository.findOne({
				where: { id: organizationId },
			})

			if (!organization) {
				throw new Error("Organization not found")
			}

			// 重置为默认设置
			organization.settings = { ...DEFAULT_ORGANIZATION_SETTINGS }
			await this.organizationRepository.save(organization)

			logger.info("Organization settings reset to defaults", { organizationId })

			// 清除缓存
			await cache.del(CacheKeys.orgSettings(organizationId))

			const result: OrganizationSettingsData = {
				organizationId,
				settings: organization.settings,
				updatedAt: organization.updatedAt.getTime(),
			}

			return result
		} catch (error) {
			logger.error("Reset organization settings failed", { organizationId, error })
			throw error
		}
	}

	/**
	 * 深度合并对象
	 */
	private deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
		const result = { ...target }

		for (const key in source) {
			if (source.hasOwnProperty(key)) {
				if (
					source[key] &&
					typeof source[key] === "object" &&
					!Array.isArray(source[key]) &&
					target[key] &&
					typeof target[key] === "object" &&
					!Array.isArray(target[key])
				) {
					// 递归合并嵌套对象
					result[key] = this.deepMerge(target[key], source[key])
				} else {
					// 直接赋值
					result[key] = source[key]
				}
			}
		}

		return result
	}
}

/**
 * 导出 SettingsService 单例
 */
export const settingsService = new SettingsService()
