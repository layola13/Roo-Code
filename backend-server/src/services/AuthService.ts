import bcrypt from "bcryptjs"
import { nanoid } from "nanoid"
import { AppDataSource } from "../config/database.js"
import { User } from "../entities/User.js"
import { OrganizationMembership } from "../entities/OrganizationMembership.js"
import { Organization } from "../entities/Organization.js"
import { generateToken, generateRefreshToken, generateJobToken, verifyToken } from "../utils/jwt.js"
import { cache, CacheKeys } from "../utils/cache.js"
import { logger } from "../utils/logger.js"
import { JWTPayload, CloudUserInfo, CloudOrganizationMembership, CloudOrganization } from "@roo-code/types"

/**
 * 认证响应接口
 */
export interface AuthResponse {
	user: CloudUserInfo
	accessToken: string
	refreshToken: string
	expiresIn: number
}

/**
 * 会话数据接口
 */
interface SessionData {
	userId: string
	organizationId?: string
	createdAt: number
}

/**
 * Refresh Token 数据接口
 */
interface RefreshTokenData {
	userId: string
}

/**
 * AuthService 类
 * 处理用户认证相关的业务逻辑
 */
export class AuthService {
	private userRepository = AppDataSource.getRepository(User)
	private membershipRepository = AppDataSource.getRepository(OrganizationMembership)
	private organizationRepository = AppDataSource.getRepository(Organization)

	/**
	 * 用户注册
	 * @param email 邮箱
	 * @param password 密码
	 * @param name 用户名
	 * @returns 认证响应
	 */
	async register(email: string, password: string, name?: string): Promise<AuthResponse> {
		try {
			// 检查邮箱是否已存在
			const existingUser = await this.userRepository.findOne({ where: { email } })
			if (existingUser) {
				throw new Error("Email already registered")
			}

			// 哈希密码
			const passwordHash = await this.hashPassword(password)

			// 创建用户
			const userId = nanoid()
			const user = this.userRepository.create({
				id: userId,
				email,
				passwordHash,
				name: name || email.split("@")[0],
			})

			await this.userRepository.save(user)

			logger.info("User registered", { userId, email })

			// 生成 tokens
			const accessToken = generateToken(userId)
			const refreshToken = generateRefreshToken(userId)

			// 存储会话和 refresh token
			await this.storeSession(accessToken, userId)
			await this.storeRefreshToken(refreshToken, userId)

			return {
				user: this.mapUserToCloudUserInfo(user),
				accessToken,
				refreshToken,
				expiresIn: 3600, // 1 hour
			}
		} catch (error) {
			logger.error("Registration failed", { email, error })
			throw error
		}
	}

	/**
	 * 用户登录
	 * @param email 邮箱
	 * @param password 密码
	 * @returns 认证响应
	 */
	async login(email: string, password: string): Promise<AuthResponse> {
		try {
			// 查找用户
			const user = await this.userRepository.findOne({ where: { email } })
			if (!user) {
				throw new Error("Invalid credentials")
			}

			// 验证密码
			const isPasswordValid = await this.validatePassword(password, user.passwordHash)
			if (!isPasswordValid) {
				throw new Error("Invalid credentials")
			}

			logger.info("User logged in", { userId: user.id, email })

			// 获取用户的第一个组织（如果有）
			const memberships = await this.getOrganizationMemberships(user.id)
			const organizationId = memberships.length > 0 ? memberships[0]?.organization?.id : undefined

			// 生成 tokens
			const accessToken = generateToken(user.id, organizationId)
			const refreshToken = generateRefreshToken(user.id)

			// 存储会话和 refresh token
			await this.storeSession(accessToken, user.id, organizationId)
			await this.storeRefreshToken(refreshToken, user.id)

			return {
				user: this.mapUserToCloudUserInfo(user, organizationId),
				accessToken,
				refreshToken,
				expiresIn: 3600, // 1 hour
			}
		} catch (error) {
			logger.error("Login failed", { email, error })
			throw error
		}
	}

	/**
	 * 验证 Token
	 * @param token JWT token
	 * @returns JWT payload
	 */
	async verifyTokenWithSession(token: string): Promise<JWTPayload> {
		try {
			// 验证 JWT 签名
			const payload = await verifyToken(token)

			// 检查 Redis 会话是否存在
			const sessionKey = CacheKeys.session(token)
			const sessionExists = await cache.exists(sessionKey)

			if (!sessionExists) {
				throw new Error("Session expired or invalid")
			}

			return payload
		} catch (error) {
			logger.error("Token verification failed", { error })
			throw error
		}
	}

	/**
	 * 刷新 Token
	 * @param refreshToken Refresh token
	 * @returns 新的认证响应
	 */
	async refreshToken(refreshToken: string): Promise<AuthResponse> {
		try {
			// 验证 refresh token
			const payload = await verifyToken(refreshToken)

			// 检查 refresh token 是否在 Redis 中
			const refreshKey = CacheKeys.refreshToken(refreshToken)
			const refreshData = await cache.get<RefreshTokenData>(refreshKey)

			if (!refreshData || refreshData.userId !== payload.r?.u) {
				throw new Error("Invalid refresh token")
			}

			const userId = refreshData.userId

			// 查找用户
			const user = await this.userRepository.findOne({ where: { id: userId } })
			if (!user) {
				throw new Error("User not found")
			}

			// 获取用户的组织（如果有）
			const memberships = await this.getOrganizationMemberships(userId)
			const organizationId = memberships.length > 0 ? memberships[0]?.organization?.id : undefined

			// 生成新的 tokens
			const newAccessToken = generateToken(userId, organizationId)
			const newRefreshToken = generateRefreshToken(userId)

			// 删除旧的 refresh token
			await cache.del(refreshKey)

			// 存储新的会话和 refresh token
			await this.storeSession(newAccessToken, userId, organizationId)
			await this.storeRefreshToken(newRefreshToken, userId)

			logger.info("Token refreshed", { userId })

			return {
				user: this.mapUserToCloudUserInfo(user, organizationId),
				accessToken: newAccessToken,
				refreshToken: newRefreshToken,
				expiresIn: 3600, // 1 hour
			}
		} catch (error) {
			logger.error("Token refresh failed", { error })
			throw error
		}
	}

	/**
	 * 用户登出
	 * @param token Access token
	 */
	async logout(token: string): Promise<void> {
		try {
			// 解析 token 获取 refresh token（如果需要）
			// 这里我们只删除 session
			const sessionKey = CacheKeys.session(token)
			await cache.del(sessionKey)

			logger.info("User logged out")
		} catch (error) {
			logger.error("Logout failed", { error })
			throw error
		}
	}

	/**
	 * 切换组织
	 * @param userId 用户 ID
	 * @param organizationId 组织 ID
	 * @returns 新的认证响应
	 */
	async switchOrganization(userId: string, organizationId: string): Promise<AuthResponse> {
		try {
			// 验证用户是否属于该组织
			const membership = await this.membershipRepository.findOne({
				where: { userId, organizationId },
				relations: ["organization"],
			})

			if (!membership) {
				throw new Error("User is not a member of this organization")
			}

			// 查找用户
			const user = await this.userRepository.findOne({ where: { id: userId } })
			if (!user) {
				throw new Error("User not found")
			}

			// 生成新的 tokens
			const accessToken = generateToken(userId, organizationId)
			const refreshToken = generateRefreshToken(userId)

			// 存储会话和 refresh token
			await this.storeSession(accessToken, userId, organizationId)
			await this.storeRefreshToken(refreshToken, userId)

			logger.info("Organization switched", { userId, organizationId })

			return {
				user: this.mapUserToCloudUserInfo(user, organizationId),
				accessToken,
				refreshToken,
				expiresIn: 3600, // 1 hour
			}
		} catch (error) {
			logger.error("Switch organization failed", { userId, organizationId, error })
			throw error
		}
	}

	/**
	 * 生成 Job Token
	 * @param userId 用户 ID
	 * @param organizationId 组织 ID
	 * @param jobId 任务 ID
	 * @returns Job token
	 */
	async generateJobTokenForUser(userId: string, organizationId: string | undefined, jobId: string): Promise<string> {
		try {
			const jobToken = generateJobToken(userId, organizationId, jobId)

			logger.info("Job token generated", { userId, organizationId, jobId })

			return jobToken
		} catch (error) {
			logger.error("Job token generation failed", { userId, organizationId, jobId, error })
			throw error
		}
	}

	/**
	 * 获取用户的组织成员关系
	 * @param userId 用户 ID
	 * @returns 组织成员关系列表
	 */
	async getOrganizationMemberships(userId: string): Promise<CloudOrganizationMembership[]> {
		try {
			const memberships = await this.membershipRepository.find({
				where: { userId },
				relations: ["organization"],
				order: { joinedAt: "ASC" },
			})

			return memberships.map((m) => this.mapMembershipToCloudMembership(m))
		} catch (error) {
			logger.error("Get memberships failed", { userId, error })
			throw error
		}
	}

	/**
	 * 验证密码
	 * @param plainPassword 明文密码
	 * @param hashedPassword 哈希密码
	 * @returns 是否匹配
	 */
	async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
		return bcrypt.compare(plainPassword, hashedPassword)
	}

	/**
	 * 哈希密码
	 * @param password 明文密码
	 * @returns 哈希后的密码
	 */
	async hashPassword(password: string): Promise<string> {
		const saltRounds = 10
		return bcrypt.hash(password, saltRounds)
	}

	/**
	 * 存储会话到 Redis
	 * @param token Access token
	 * @param userId 用户 ID
	 * @param organizationId 组织 ID (可选)
	 */
	private async storeSession(token: string, userId: string, organizationId?: string): Promise<void> {
		const sessionKey = CacheKeys.session(token)
		const sessionData: SessionData = {
			userId,
			organizationId,
			createdAt: Date.now(),
		}
		await cache.set(sessionKey, sessionData, 3600) // 1 hour TTL
	}

	/**
	 * 存储 refresh token 到 Redis
	 * @param refreshToken Refresh token
	 * @param userId 用户 ID
	 */
	private async storeRefreshToken(refreshToken: string, userId: string): Promise<void> {
		const refreshKey = CacheKeys.refreshToken(refreshToken)
		const refreshData: RefreshTokenData = {
			userId,
		}
		await cache.set(refreshKey, refreshData, 604800) // 7 days TTL
	}

	/**
	 * 映射 User 实体到 CloudUserInfo
	 */
	private mapUserToCloudUserInfo(user: User, organizationId?: string): CloudUserInfo {
		return {
			id: user.id,
			email: user.email,
			name: user.name,
			organizationId,
		}
	}

	/**
	 * 映射 OrganizationMembership 到 CloudOrganizationMembership
	 */
	private mapMembershipToCloudMembership(membership: OrganizationMembership): CloudOrganizationMembership {
		const org: CloudOrganization = {
			id: membership.organization!.id,
			name: membership.organization!.name,
			created_at: membership.organization!.createdAt.getTime(),
			updated_at: membership.organization!.updatedAt.getTime(),
		}

		return {
			id: membership.id,
			organization: org,
			role: membership.role,
			created_at: membership.joinedAt.getTime(),
		}
	}
}

/**
 * 导出 AuthService 单例
 */
export const authService = new AuthService()
