import { nanoid } from "nanoid"
import { AppDataSource } from "../config/database.js"
import { Organization } from "../entities/Organization.js"
import { OrganizationMembership } from "../entities/OrganizationMembership.js"
import { User } from "../entities/User.js"
import { cache, CacheKeys } from "../utils/cache.js"
import { logger } from "../utils/logger.js"
import { CloudOrganization, CloudOrganizationMembership } from "@roo-code/types"

/**
 * 创建组织的参数接口
 */
export interface CreateOrganizationParams {
	name: string
	settings?: Record<string, any>
	ownerId: string
}

/**
 * 更新组织的参数接口
 */
export interface UpdateOrganizationParams {
	name?: string
	settings?: Record<string, any>
}

/**
 * 添加成员的参数接口
 */
export interface AddMemberParams {
	userId: string
	role: "owner" | "admin" | "member"
}

/**
 * OrganizationService 类
 * 处理组织相关的业务逻辑
 */
export class OrganizationService {
	private organizationRepository = AppDataSource.getRepository(Organization)
	private membershipRepository = AppDataSource.getRepository(OrganizationMembership)
	private userRepository = AppDataSource.getRepository(User)

	/**
	 * 创建组织
	 * @param params 创建参数
	 * @returns 创建的组织
	 */
	async createOrganization(params: CreateOrganizationParams): Promise<CloudOrganization> {
		const { name, settings, ownerId } = params

		try {
			// 验证用户是否存在
			const user = await this.userRepository.findOne({ where: { id: ownerId } })
			if (!user) {
				throw new Error("User not found")
			}

			// 使用事务创建组织和成员关系
			const result = await AppDataSource.transaction(async (manager) => {
				// 创建组织
				const orgId = nanoid()
				const organization = manager.create(Organization, {
					id: orgId,
					name,
					settings,
				})
				await manager.save(organization)

				// 创建所有者成员关系
				const membershipId = nanoid()
				const membership = manager.create(OrganizationMembership, {
					id: membershipId,
					userId: ownerId,
					organizationId: orgId,
					role: "owner",
				})
				await manager.save(membership)

				return organization
			})

			logger.info("Organization created", {
				organizationId: result.id,
				name: result.name,
				ownerId,
			})

			// 清除用户的组织列表缓存
			await this.clearUserOrganizationsCache(ownerId)

			return this.mapOrganizationToCloud(result)
		} catch (error) {
			logger.error("Create organization failed", { name, ownerId, error })
			throw error
		}
	}

	/**
	 * 获取组织详情
	 * @param organizationId 组织 ID
	 * @returns 组织信息
	 */
	async getOrganization(organizationId: string): Promise<CloudOrganization> {
		try {
			// 先尝试从缓存获取
			const cacheKey = CacheKeys.orgSettings(organizationId)
			const cached = await cache.get<CloudOrganization>(cacheKey)
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

			const result = this.mapOrganizationToCloud(organization)

			// 缓存结果（5分钟）
			await cache.set(cacheKey, result, 300)

			return result
		} catch (error) {
			logger.error("Get organization failed", { organizationId, error })
			throw error
		}
	}

	/**
	 * 更新组织信息
	 * @param organizationId 组织 ID
	 * @param params 更新参数
	 * @returns 更新后的组织信息
	 */
	async updateOrganization(organizationId: string, params: UpdateOrganizationParams): Promise<CloudOrganization> {
		const { name, settings } = params

		try {
			const organization = await this.organizationRepository.findOne({
				where: { id: organizationId },
			})

			if (!organization) {
				throw new Error("Organization not found")
			}

			// 更新字段
			if (name !== undefined) {
				organization.name = name
			}
			if (settings !== undefined) {
				organization.settings = settings
			}

			await this.organizationRepository.save(organization)

			logger.info("Organization updated", { organizationId, updates: params })

			// 清除缓存
			await this.clearOrganizationCache(organizationId)

			return this.mapOrganizationToCloud(organization)
		} catch (error) {
			logger.error("Update organization failed", { organizationId, params, error })
			throw error
		}
	}

	/**
	 * 删除组织
	 * @param organizationId 组织 ID
	 */
	async deleteOrganization(organizationId: string): Promise<void> {
		try {
			const organization = await this.organizationRepository.findOne({
				where: { id: organizationId },
			})

			if (!organization) {
				throw new Error("Organization not found")
			}

			// 获取所有成员用于清除缓存
			const memberships = await this.membershipRepository.find({
				where: { organizationId },
			})

			// 删除组织（级联删除会自动删除相关的成员关系）
			await this.organizationRepository.remove(organization)

			logger.info("Organization deleted", { organizationId })

			// 清除缓存
			await this.clearOrganizationCache(organizationId)

			// 清除所有成员的组织列表缓存
			for (const membership of memberships) {
				await this.clearUserOrganizationsCache(membership.userId)
			}
		} catch (error) {
			logger.error("Delete organization failed", { organizationId, error })
			throw error
		}
	}

	/**
	 * 列出用户的组织
	 * @param userId 用户 ID
	 * @returns 组织列表
	 */
	async listUserOrganizations(userId: string): Promise<CloudOrganizationMembership[]> {
		try {
			const memberships = await this.membershipRepository.find({
				where: { userId },
				relations: ["organization"],
				order: { joinedAt: "ASC" },
			})

			return memberships.map((m) => this.mapMembershipToCloud(m))
		} catch (error) {
			logger.error("List user organizations failed", { userId, error })
			throw error
		}
	}

	/**
	 * 添加组织成员
	 * @param organizationId 组织 ID
	 * @param params 成员参数
	 * @returns 创建的成员关系
	 */
	async addMember(organizationId: string, params: AddMemberParams): Promise<CloudOrganizationMembership> {
		const { userId, role } = params

		try {
			// 验证组织是否存在
			const organization = await this.organizationRepository.findOne({
				where: { id: organizationId },
			})
			if (!organization) {
				throw new Error("Organization not found")
			}

			// 验证用户是否存在
			const user = await this.userRepository.findOne({ where: { id: userId } })
			if (!user) {
				throw new Error("User not found")
			}

			// 检查是否已经是成员
			const existingMembership = await this.membershipRepository.findOne({
				where: { userId, organizationId },
			})
			if (existingMembership) {
				throw new Error("User is already a member of this organization")
			}

			// 创建成员关系
			const membershipId = nanoid()
			const membership = this.membershipRepository.create({
				id: membershipId,
				userId,
				organizationId,
				role,
			})
			await this.membershipRepository.save(membership)

			logger.info("Member added to organization", {
				organizationId,
				userId,
				role,
			})

			// 清除用户的组织列表缓存
			await this.clearUserOrganizationsCache(userId)

			// 重新加载关系以返回完整信息
			const savedMembership = await this.membershipRepository.findOne({
				where: { id: membershipId },
				relations: ["organization"],
			})

			return this.mapMembershipToCloud(savedMembership!)
		} catch (error) {
			logger.error("Add member failed", { organizationId, params, error })
			throw error
		}
	}

	/**
	 * 移除组织成员
	 * @param organizationId 组织 ID
	 * @param userId 用户 ID
	 */
	async removeMember(organizationId: string, userId: string): Promise<void> {
		try {
			const membership = await this.membershipRepository.findOne({
				where: { userId, organizationId },
			})

			if (!membership) {
				throw new Error("Membership not found")
			}

			// 不允许移除所有者（除非是最后一个成员）
			if (membership.role === "owner") {
				const memberCount = await this.membershipRepository.count({
					where: { organizationId },
				})
				if (memberCount > 1) {
					throw new Error("Cannot remove owner unless it is the last member")
				}
			}

			await this.membershipRepository.remove(membership)

			logger.info("Member removed from organization", { organizationId, userId })

			// 清除用户的组织列表缓存
			await this.clearUserOrganizationsCache(userId)
		} catch (error) {
			logger.error("Remove member failed", { organizationId, userId, error })
			throw error
		}
	}

	/**
	 * 更新成员角色
	 * @param organizationId 组织 ID
	 * @param userId 用户 ID
	 * @param role 新角色
	 * @returns 更新后的成员关系
	 */
	async updateMemberRole(
		organizationId: string,
		userId: string,
		role: "owner" | "admin" | "member",
	): Promise<CloudOrganizationMembership> {
		try {
			const membership = await this.membershipRepository.findOne({
				where: { userId, organizationId },
				relations: ["organization"],
			})

			if (!membership) {
				throw new Error("Membership not found")
			}

			// 更新角色
			membership.role = role
			await this.membershipRepository.save(membership)

			logger.info("Member role updated", { organizationId, userId, role })

			// 清除用户的组织列表缓存
			await this.clearUserOrganizationsCache(userId)

			return this.mapMembershipToCloud(membership)
		} catch (error) {
			logger.error("Update member role failed", { organizationId, userId, role, error })
			throw error
		}
	}

	/**
	 * 列出组织成员
	 * @param organizationId 组织 ID
	 * @returns 成员列表
	 */
	async listMembers(organizationId: string): Promise<CloudOrganizationMembership[]> {
		try {
			const memberships = await this.membershipRepository.find({
				where: { organizationId },
				relations: ["organization", "user"],
				order: { joinedAt: "ASC" },
			})

			return memberships.map((m) => this.mapMembershipToCloud(m))
		} catch (error) {
			logger.error("List members failed", { organizationId, error })
			throw error
		}
	}

	/**
	 * 映射 Organization 实体到 CloudOrganization
	 */
	private mapOrganizationToCloud(org: Organization): CloudOrganization {
		return {
			id: org.id,
			name: org.name,
			created_at: org.createdAt.getTime(),
			updated_at: org.updatedAt.getTime(),
		}
	}

	/**
	 * 映射 OrganizationMembership 到 CloudOrganizationMembership
	 */
	private mapMembershipToCloud(membership: OrganizationMembership): CloudOrganizationMembership {
		return {
			id: membership.id,
			organization: this.mapOrganizationToCloud(membership.organization!),
			role: membership.role,
			created_at: membership.joinedAt.getTime(),
		}
	}

	/**
	 * 清除组织缓存
	 */
	private async clearOrganizationCache(organizationId: string): Promise<void> {
		const cacheKey = CacheKeys.orgSettings(organizationId)
		await cache.del(cacheKey)
	}

	/**
	 * 清除用户的组织列表缓存
	 */
	private async clearUserOrganizationsCache(userId: string): Promise<void> {
		// 这里可以根据需要实现缓存键
		// 目前我们没有缓存用户的组织列表，所以这个方法是为未来扩展预留的
		logger.debug("Clear user organizations cache", { userId })
	}
}

/**
 * 导出 OrganizationService 单例
 */
export const organizationService = new OrganizationService()
