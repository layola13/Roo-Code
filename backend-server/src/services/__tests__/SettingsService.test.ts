import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { SettingsService } from "../SettingsService.js"
import { AppDataSource } from "../../config/database.js"
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
	},
	CacheKeys: {
		userSettings: (userId: string) => `user:settings:${userId}`,
		orgSettings: (orgId: string) => `org:settings:${orgId}`,
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

describe("SettingsService", () => {
	let settingsService: SettingsService
	let mockUserRepository: any
	let mockOrganizationRepository: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Setup mock repositories
		mockUserRepository = {
			findOne: vi.fn(),
			save: vi.fn(),
		}

		mockOrganizationRepository = {
			findOne: vi.fn(),
			save: vi.fn(),
		}

		// Mock AppDataSource.getRepository
		vi.mocked(AppDataSource.getRepository).mockImplementation((entity: any) => {
			if (entity === User) return mockUserRepository
			if (entity === Organization) return mockOrganizationRepository
			return {} as any
		})

		settingsService = new SettingsService()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("getUserSettings", () => {
		it("应该从缓存获取用户设置", async () => {
			const userId = "user-123"
			const cachedSettings = {
				userId,
				settings: {
					theme: "dark",
					language: "zh",
				},
				updatedAt: Date.now(),
			}

			// Mock: 缓存中存在
			vi.mocked(cache.get).mockResolvedValue(cachedSettings)

			const result = await settingsService.getUserSettings(userId)

			expect(result).toEqual(cachedSettings)
			expect(cache.get).toHaveBeenCalled()
			expect(mockUserRepository.findOne).not.toHaveBeenCalled()
		})

		it("应该从数据库获取用户设置并缓存", async () => {
			const userId = "user-123"
			const mockUser = {
				id: userId,
				email: "test@example.com",
				settings: {
					theme: "dark",
				},
				updatedAt: new Date(),
			}

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库中存在
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await settingsService.getUserSettings(userId)

			expect(result.userId).toBe(userId)
			expect(result.settings).toHaveProperty("theme")
			expect(mockUserRepository.findOne).toHaveBeenCalled()
			expect(cache.set).toHaveBeenCalled()
		})

		it("应该合并默认设置和用户自定义设置", async () => {
			const userId = "user-123"
			const mockUser = {
				id: userId,
				email: "test@example.com",
				settings: {
					theme: "dark", // 用户自定义
				},
				updatedAt: new Date(),
			}

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库中存在
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await settingsService.getUserSettings(userId)

			// 应该包含默认设置
			expect(result.settings).toHaveProperty("language") // 默认设置
			expect(result.settings).toHaveProperty("notifications") // 默认设置
			// 应该包含用户自定义设置
			expect(result.settings.theme).toBe("dark")
		})

		it("应该在用户不存在时抛出错误", async () => {
			const userId = "nonexistent-user"

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库中也不存在
			mockUserRepository.findOne.mockResolvedValue(null)

			await expect(settingsService.getUserSettings(userId)).rejects.toThrow("User not found")
		})
	})

	describe("updateUserSettings", () => {
		it("应该成功更新用户设置", async () => {
			const userId = "user-123"
			const updates = {
				theme: "dark",
				language: "zh",
			}

			const mockUser = {
				id: userId,
				email: "test@example.com",
				settings: {
					theme: "light",
					language: "en",
				},
				updatedAt: new Date(),
			}

			// Mock: 用户存在
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: 保存用户
			mockUserRepository.save.mockResolvedValue({
				...mockUser,
				settings: { ...mockUser.settings, ...updates },
			})

			// Mock: Cache delete
			vi.mocked(cache.del).mockResolvedValue(true)

			const result = await settingsService.updateUserSettings(userId, updates)

			expect(result.settings.theme).toBe("dark")
			expect(result.settings.language).toBe("zh")
			expect(mockUserRepository.save).toHaveBeenCalled()
			expect(cache.del).toHaveBeenCalled()
		})

		it("应该深度合并嵌套设置", async () => {
			const userId = "user-123"
			const updates = {
				notifications: {
					email: false, // 只更新 email
				},
			}

			const mockUser = {
				id: userId,
				email: "test@example.com",
				settings: {
					notifications: {
						email: true,
						push: true,
					},
				},
				updatedAt: new Date(),
			}

			// Mock: 用户存在
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: 保存用户
			mockUserRepository.save.mockResolvedValue(mockUser)

			// Mock: Cache delete
			vi.mocked(cache.del).mockResolvedValue(true)

			const result = await settingsService.updateUserSettings(userId, updates)

			// 应该保留 push 设置，只更新 email
			expect(result.settings.notifications.email).toBe(false)
			expect(result.settings.notifications.push).toBe(true)
		})

		it("应该在用户不存在时抛出错误", async () => {
			const userId = "nonexistent-user"
			const updates = { theme: "dark" }

			// Mock: 用户不存在
			mockUserRepository.findOne.mockResolvedValue(null)

			await expect(settingsService.updateUserSettings(userId, updates)).rejects.toThrow("User not found")
			expect(mockUserRepository.save).not.toHaveBeenCalled()
		})
	})

	describe("getOrganizationSettings", () => {
		it("应该从缓存获取组织设置", async () => {
			const organizationId = "org-456"
			const cachedSettings = {
				organizationId,
				settings: {
					allowPublicSharing: false,
					requireApproval: true,
				},
				updatedAt: Date.now(),
			}

			// Mock: 缓存中存在
			vi.mocked(cache.get).mockResolvedValue(cachedSettings)

			const result = await settingsService.getOrganizationSettings(organizationId)

			expect(result).toEqual(cachedSettings)
			expect(cache.get).toHaveBeenCalled()
			expect(mockOrganizationRepository.findOne).not.toHaveBeenCalled()
		})

		it("应该从数据库获取组织设置并缓存", async () => {
			const organizationId = "org-456"
			const mockOrganization = {
				id: organizationId,
				name: "Test Org",
				settings: {
					allowPublicSharing: false,
				},
				updatedAt: new Date(),
			}

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库中存在
			mockOrganizationRepository.findOne.mockResolvedValue(mockOrganization)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await settingsService.getOrganizationSettings(organizationId)

			expect(result.organizationId).toBe(organizationId)
			expect(result.settings).toHaveProperty("allowPublicSharing")
			expect(mockOrganizationRepository.findOne).toHaveBeenCalled()
			expect(cache.set).toHaveBeenCalled()
		})

		it("应该在组织不存在时抛出错误", async () => {
			const organizationId = "nonexistent-org"

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库中也不存在
			mockOrganizationRepository.findOne.mockResolvedValue(null)

			await expect(settingsService.getOrganizationSettings(organizationId)).rejects.toThrow(
				"Organization not found",
			)
		})
	})

	describe("updateOrganizationSettings", () => {
		it("应该成功更新组织设置", async () => {
			const organizationId = "org-456"
			const updates = {
				allowPublicSharing: false,
				requireApproval: true,
			}

			const mockOrganization = {
				id: organizationId,
				name: "Test Org",
				settings: {
					allowPublicSharing: true,
					requireApproval: false,
				},
				updatedAt: new Date(),
			}

			// Mock: 组织存在
			mockOrganizationRepository.findOne.mockResolvedValue(mockOrganization)

			// Mock: 保存组织
			mockOrganizationRepository.save.mockResolvedValue({
				...mockOrganization,
				settings: { ...mockOrganization.settings, ...updates },
			})

			// Mock: Cache delete
			vi.mocked(cache.del).mockResolvedValue(true)

			const result = await settingsService.updateOrganizationSettings(organizationId, updates)

			expect(result.settings.allowPublicSharing).toBe(false)
			expect(result.settings.requireApproval).toBe(true)
			expect(mockOrganizationRepository.save).toHaveBeenCalled()
			expect(cache.del).toHaveBeenCalled()
		})

		it("应该在组织不存在时抛出错误", async () => {
			const organizationId = "nonexistent-org"
			const updates = { allowPublicSharing: false }

			// Mock: 组织不存在
			mockOrganizationRepository.findOne.mockResolvedValue(null)

			await expect(settingsService.updateOrganizationSettings(organizationId, updates)).rejects.toThrow(
				"Organization not found",
			)
			expect(mockOrganizationRepository.save).not.toHaveBeenCalled()
		})
	})

	describe("resetUserToDefaults", () => {
		it("应该成功重置用户设置为默认值", async () => {
			const userId = "user-123"

			const mockUser = {
				id: userId,
				email: "test@example.com",
				settings: {
					theme: "dark",
					language: "zh",
					customField: "value",
				},
				updatedAt: new Date(),
			}

			// Mock: 用户存在
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: 保存用户
			mockUserRepository.save.mockResolvedValue(mockUser)

			// Mock: Cache delete
			vi.mocked(cache.del).mockResolvedValue(true)

			const result = await settingsService.resetUserToDefaults(userId)

			// 应该包含默认设置
			expect(result.settings).toHaveProperty("theme")
			expect(result.settings).toHaveProperty("language")
			expect(result.settings).toHaveProperty("notifications")
			// 不应该包含自定义字段
			expect(result.settings).not.toHaveProperty("customField")
			expect(mockUserRepository.save).toHaveBeenCalled()
			expect(cache.del).toHaveBeenCalled()
		})

		it("应该在用户不存在时抛出错误", async () => {
			const userId = "nonexistent-user"

			// Mock: 用户不存在
			mockUserRepository.findOne.mockResolvedValue(null)

			await expect(settingsService.resetUserToDefaults(userId)).rejects.toThrow("User not found")
			expect(mockUserRepository.save).not.toHaveBeenCalled()
		})
	})

	describe("resetOrganizationToDefaults", () => {
		it("应该成功重置组织设置为默认值", async () => {
			const organizationId = "org-456"

			const mockOrganization = {
				id: organizationId,
				name: "Test Org",
				settings: {
					allowPublicSharing: false,
					customField: "value",
				},
				updatedAt: new Date(),
			}

			// Mock: 组织存在
			mockOrganizationRepository.findOne.mockResolvedValue(mockOrganization)

			// Mock: 保存组织
			mockOrganizationRepository.save.mockResolvedValue(mockOrganization)

			// Mock: Cache delete
			vi.mocked(cache.del).mockResolvedValue(true)

			const result = await settingsService.resetOrganizationToDefaults(organizationId)

			// 应该包含默认设置
			expect(result.settings).toHaveProperty("allowPublicSharing")
			expect(result.settings).toHaveProperty("requireApproval")
			expect(result.settings).toHaveProperty("defaultVisibility")
			expect(result.settings).toHaveProperty("retentionDays")
			// 不应该包含自定义字段
			expect(result.settings).not.toHaveProperty("customField")
			expect(mockOrganizationRepository.save).toHaveBeenCalled()
			expect(cache.del).toHaveBeenCalled()
		})

		it("应该在组织不存在时抛出错误", async () => {
			const organizationId = "nonexistent-org"

			// Mock: 组织不存在
			mockOrganizationRepository.findOne.mockResolvedValue(null)

			await expect(settingsService.resetOrganizationToDefaults(organizationId)).rejects.toThrow(
				"Organization not found",
			)
			expect(mockOrganizationRepository.save).not.toHaveBeenCalled()
		})
	})
})
