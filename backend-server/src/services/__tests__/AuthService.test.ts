import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { AuthService } from "../AuthService.js"
import { AppDataSource } from "../../config/database.js"
import { User } from "../../entities/User.js"
import { Organization } from "../../entities/Organization.js"
import { OrganizationMembership } from "../../entities/OrganizationMembership.js"
import { cache } from "../../utils/cache.js"
import * as jwtUtils from "../../utils/jwt.js"

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
		exists: vi.fn(),
	},
	CacheKeys: {
		session: (token: string) => `session:${token}`,
		refreshToken: (token: string) => `refresh:${token}`,
	},
}))

vi.mock("../../utils/jwt.js", () => ({
	generateToken: vi.fn(),
	generateRefreshToken: vi.fn(),
	generateJobToken: vi.fn(),
	verifyToken: vi.fn(),
}))

vi.mock("../../utils/logger.js", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}))

describe("AuthService", () => {
	let authService: AuthService
	let mockUserRepository: any
	let mockMembershipRepository: any
	let mockOrganizationRepository: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Setup mock repositories
		mockUserRepository = {
			findOne: vi.fn(),
			create: vi.fn(),
			save: vi.fn(),
		}

		mockMembershipRepository = {
			findOne: vi.fn(),
			find: vi.fn(),
		}

		mockOrganizationRepository = {
			findOne: vi.fn(),
		}

		// Mock AppDataSource.getRepository
		vi.mocked(AppDataSource.getRepository).mockImplementation((entity: any) => {
			if (entity === User) return mockUserRepository
			if (entity === OrganizationMembership) return mockMembershipRepository
			if (entity === Organization) return mockOrganizationRepository
			return {} as any
		})

		authService = new AuthService()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("register", () => {
		it("应该成功注册新用户", async () => {
			const email = "test@example.com"
			const password = "password123"
			const name = "Test User"

			// Mock: 邮箱不存在
			mockUserRepository.findOne.mockResolvedValue(null)

			// Mock: 创建用户
			const mockUser = {
				id: "user-123",
				email,
				name,
				passwordHash: "hashed_password",
			}
			mockUserRepository.create.mockReturnValue(mockUser)
			mockUserRepository.save.mockResolvedValue(mockUser)

			// Mock: JWT tokens
			vi.mocked(jwtUtils.generateToken).mockReturnValue("access_token")
			vi.mocked(jwtUtils.generateRefreshToken).mockReturnValue("refresh_token")

			// Mock: Cache
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await authService.register(email, password, name)

			expect(result).toHaveProperty("user")
			expect(result).toHaveProperty("accessToken", "access_token")
			expect(result).toHaveProperty("refreshToken", "refresh_token")
			expect(result).toHaveProperty("expiresIn", 3600)
			expect(result.user.email).toBe(email)
			expect(mockUserRepository.save).toHaveBeenCalled()
			expect(cache.set).toHaveBeenCalledTimes(2) // session + refresh token
		})

		it("应该在邮箱已存在时抛出错误", async () => {
			const email = "existing@example.com"
			const password = "password123"

			// Mock: 邮箱已存在
			mockUserRepository.findOne.mockResolvedValue({
				id: "existing-user",
				email,
			})

			await expect(authService.register(email, password)).rejects.toThrow("Email already registered")
			expect(mockUserRepository.save).not.toHaveBeenCalled()
		})
	})

	describe("login", () => {
		it("应该成功登录并返回 tokens", async () => {
			const email = "test@example.com"
			const password = "password123"

			const mockUser = {
				id: "user-123",
				email,
				name: "Test User",
				passwordHash: "hashed_password",
			}

			// Mock: 找到用户
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: 密码验证通过
			vi.spyOn(authService, "validatePassword").mockResolvedValue(true)

			// Mock: 没有组织
			vi.spyOn(authService, "getOrganizationMemberships").mockResolvedValue([])

			// Mock: JWT tokens
			vi.mocked(jwtUtils.generateToken).mockReturnValue("access_token")
			vi.mocked(jwtUtils.generateRefreshToken).mockReturnValue("refresh_token")

			// Mock: Cache
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await authService.login(email, password)

			expect(result).toHaveProperty("accessToken", "access_token")
			expect(result).toHaveProperty("refreshToken", "refresh_token")
			expect(result.user.email).toBe(email)
		})

		it("应该在用户不存在时抛出错误", async () => {
			const email = "nonexistent@example.com"
			const password = "password123"

			// Mock: 用户不存在
			mockUserRepository.findOne.mockResolvedValue(null)

			await expect(authService.login(email, password)).rejects.toThrow("Invalid credentials")
		})

		it("应该在密码错误时抛出错误", async () => {
			const email = "test@example.com"
			const password = "wrong_password"

			const mockUser = {
				id: "user-123",
				email,
				passwordHash: "hashed_password",
			}

			// Mock: 找到用户
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: 密码验证失败
			vi.spyOn(authService, "validatePassword").mockResolvedValue(false)

			await expect(authService.login(email, password)).rejects.toThrow("Invalid credentials")
		})
	})

	describe("verifyTokenWithSession", () => {
		it("应该成功验证有效的 token 和会话", async () => {
			const token = "valid_token"
			const mockPayload = {
				iss: "rcc",
				sub: "user-123",
				v: 1,
				r: { u: "user-123", t: "auth" },
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
			}

			// Mock: JWT 验证成功
			vi.mocked(jwtUtils.verifyToken).mockResolvedValue(mockPayload)

			// Mock: Session 存在
			vi.mocked(cache.exists).mockResolvedValue(true)

			const result = await authService.verifyTokenWithSession(token)

			expect(result).toEqual(mockPayload)
			expect(jwtUtils.verifyToken).toHaveBeenCalledWith(token)
			expect(cache.exists).toHaveBeenCalled()
		})

		it("应该在会话不存在时抛出错误", async () => {
			const token = "valid_token"
			const mockPayload = {
				iss: "rcc",
				sub: "user-123",
				v: 1,
				r: { u: "user-123", t: "auth" },
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
			}

			// Mock: JWT 验证成功
			vi.mocked(jwtUtils.verifyToken).mockResolvedValue(mockPayload)

			// Mock: Session 不存在
			vi.mocked(cache.exists).mockResolvedValue(false)

			await expect(authService.verifyTokenWithSession(token)).rejects.toThrow("Session expired or invalid")
		})
	})

	describe("refreshToken", () => {
		it("应该成功刷新 token", async () => {
			const refreshToken = "valid_refresh_token"
			const userId = "user-123"

			const mockPayload = {
				iss: "rcc",
				sub: userId,
				v: 1,
				r: { u: userId, t: "auth" },
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 604800,
			}

			const mockUser = {
				id: userId,
				email: "test@example.com",
				name: "Test User",
			}

			// Mock: Refresh token 验证
			vi.mocked(jwtUtils.verifyToken).mockResolvedValue(mockPayload)

			// Mock: Refresh token 在 Redis 中
			vi.mocked(cache.get).mockResolvedValue({ userId })

			// Mock: 找到用户
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: 没有组织
			vi.spyOn(authService, "getOrganizationMemberships").mockResolvedValue([])

			// Mock: 新的 tokens
			vi.mocked(jwtUtils.generateToken).mockReturnValue("new_access_token")
			vi.mocked(jwtUtils.generateRefreshToken).mockReturnValue("new_refresh_token")

			// Mock: Cache operations
			vi.mocked(cache.del).mockResolvedValue(true)
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await authService.refreshToken(refreshToken)

			expect(result).toHaveProperty("accessToken", "new_access_token")
			expect(result).toHaveProperty("refreshToken", "new_refresh_token")
			expect(cache.del).toHaveBeenCalled() // 删除旧的 refresh token
		})

		it("应该在 refresh token 无效时抛出错误", async () => {
			const refreshToken = "invalid_refresh_token"

			// Mock: Refresh token 验证失败
			vi.mocked(jwtUtils.verifyToken).mockRejectedValue(new Error("Invalid token"))

			await expect(authService.refreshToken(refreshToken)).rejects.toThrow()
		})
	})

	describe("logout", () => {
		it("应该成功登出", async () => {
			const token = "access_token"

			// Mock: Cache delete
			vi.mocked(cache.del).mockResolvedValue(true)

			await authService.logout(token)

			expect(cache.del).toHaveBeenCalled()
		})
	})

	describe("switchOrganization", () => {
		it("应该成功切换组织", async () => {
			const userId = "user-123"
			const organizationId = "org-456"

			const mockMembership = {
				id: "membership-789",
				userId,
				organizationId,
				role: "member" as const,
				organization: {
					id: organizationId,
					name: "Test Org",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			}

			const mockUser = {
				id: userId,
				email: "test@example.com",
				name: "Test User",
			}

			// Mock: 找到 membership
			mockMembershipRepository.findOne.mockResolvedValue(mockMembership)

			// Mock: 找到用户
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: JWT tokens
			vi.mocked(jwtUtils.generateToken).mockReturnValue("new_access_token")
			vi.mocked(jwtUtils.generateRefreshToken).mockReturnValue("new_refresh_token")

			// Mock: Cache
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await authService.switchOrganization(userId, organizationId)

			expect(result).toHaveProperty("accessToken", "new_access_token")
			expect(result.user.organizationId).toBe(organizationId)
		})

		it("应该在用户不是组织成员时抛出错误", async () => {
			const userId = "user-123"
			const organizationId = "org-456"

			// Mock: Membership 不存在
			mockMembershipRepository.findOne.mockResolvedValue(null)

			await expect(authService.switchOrganization(userId, organizationId)).rejects.toThrow(
				"User is not a member of this organization",
			)
		})
	})

	describe("getOrganizationMemberships", () => {
		it("应该返回用户的组织成员关系列表", async () => {
			const userId = "user-123"

			const mockMemberships = [
				{
					id: "membership-1",
					userId,
					organizationId: "org-1",
					role: "owner" as const,
					joinedAt: new Date(),
					organization: {
						id: "org-1",
						name: "Org 1",
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				},
				{
					id: "membership-2",
					userId,
					organizationId: "org-2",
					role: "member" as const,
					joinedAt: new Date(),
					organization: {
						id: "org-2",
						name: "Org 2",
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				},
			]

			// Mock: 找到 memberships
			mockMembershipRepository.find.mockResolvedValue(mockMemberships)

			const result = await authService.getOrganizationMemberships(userId)

			expect(result).toHaveLength(2)
			expect(result[0].organization.id).toBe("org-1")
			expect(result[1].organization.id).toBe("org-2")
		})

		it("应该在用户没有组织时返回空数组", async () => {
			const userId = "user-123"

			// Mock: 没有 memberships
			mockMembershipRepository.find.mockResolvedValue([])

			const result = await authService.getOrganizationMemberships(userId)

			expect(result).toHaveLength(0)
		})
	})

	describe("hashPassword and validatePassword", () => {
		it("应该成功哈希和验证密码", async () => {
			const password = "test_password_123"

			// 哈希密码
			const hashedPassword = await authService.hashPassword(password)
			expect(hashedPassword).toBeTruthy()
			expect(hashedPassword).not.toBe(password)

			// 验证正确的密码
			const isValid = await authService.validatePassword(password, hashedPassword)
			expect(isValid).toBe(true)

			// 验证错误的密码
			const isInvalid = await authService.validatePassword("wrong_password", hashedPassword)
			expect(isInvalid).toBe(false)
		})
	})
})
