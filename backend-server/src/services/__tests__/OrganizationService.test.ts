import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { OrganizationService } from "../OrganizationService.js"
import { AppDataSource } from "../../config/database.js"
import { Organization } from "../../entities/Organization.js"
import { OrganizationMembership } from "../../entities/OrganizationMembership.js"
import { User } from "../../entities/User.js"
import { cache } from "../../utils/cache.js"

// Mock dependencies
vi.mock("../../config/database.js", () => ({
	AppDataSource: {
		getRepository: vi.fn(),
		transaction: vi.fn(),
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

describe("OrganizationService", () => {
	let organizationService: OrganizationService
	let mockOrganizationRepository: any
	let mockMembershipRepository: any
	let mockUserRepository: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Setup mock repositories
		mockOrganizationRepository = {
			findOne: vi.fn(),
			create: vi.fn(),
			save: vi.fn(),
			remove: vi.fn(),
		}

		mockMembershipRepository = {
			findOne: vi.fn(),
			find: vi.fn(),
			create: vi.fn(),
			save: vi.fn(),
			remove: vi.fn(),
			count: vi.fn(),
		}

		mockUserRepository = {
			findOne: vi.fn(),
			create: vi.fn(),
			save: vi.fn(),
		}

		// Mock AppDataSource.getRepository
		vi.mocked(AppDataSource.getRepository).mockImplementation((entity: any) => {
			if (entity === Organization) return mockOrganizationRepository
			if (entity === OrganizationMembership) return mockMembershipRepository
			if (entity === User) return mockUserRepository
			return {} as any
		})

		organizationService = new OrganizationService()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("createOrganization", () => {
		it("应该成功创建组织并添加所有者", async () => {
			const ownerId = "user-123"
			const name = "Test Organization"
			const settings = { key: "value" }

			const mockUser = {
				id: ownerId,
				email: "owner@example.com",
				name: "Owner",
			}

			const mockOrg = {
				id: "org-123",
				name,
				settings,
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			// Mock: 用户存在
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: 事务
			vi.mocked(AppDataSource.transaction).mockImplementation(async (callback: any) => {
				const manager = {
					create: vi.fn((entity: any, data: any) => ({
						...data,
						createdAt: new Date(),
						updatedAt: new Date(),
					})),
					save: vi.fn((entity: any) => Promise.resolve(entity)),
				}
				return await callback(manager)
			})

			// Mock: Cache
			vi.mocked(cache.del).mockResolvedValue(true)

			const result = await organizationService.createOrganization({
				name,
				settings,
				ownerId,
			})

			expect(result).toHaveProperty("id")
			expect(result).toHaveProperty("name", name)
			expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: ownerId } })
			expect(AppDataSource.transaction).toHaveBeenCalled()
		})

		it("应该在用户不存在时抛出错误", async () => {
			const ownerId = "nonexistent-user"
			const name = "Test Organization"

			// Mock: 用户不存在
			mockUserRepository.findOne.mockResolvedValue(null)

			await expect(
				organizationService.createOrganization({
					name,
					ownerId,
				}),
			).rejects.toThrow("User not found")

			expect(AppDataSource.transaction).not.toHaveBeenCalled()
		})
	})

	describe("getOrganization", () => {
		it("应该从缓存获取组织信息", async () => {
			const organizationId = "org-123"
			const cachedOrg = {
				id: organizationId,
				name: "Cached Org",
				created_at: Date.now(),
				updated_at: Date.now(),
			}

			// Mock: 缓存存在
			vi.mocked(cache.get).mockResolvedValue(cachedOrg)

			const result = await organizationService.getOrganization(organizationId)

			expect(result).toEqual(cachedOrg)
			expect(cache.get).toHaveBeenCalled()
			expect(mockOrganizationRepository.findOne).not.toHaveBeenCalled()
		})

		it("应该从数据库获取组织信息并缓存", async () => {
			const organizationId = "org-123"
			const mockOrg = {
				id: organizationId,
				name: "Test Org",
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			// Mock: 缓存不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库查询
			mockOrganizationRepository.findOne.mockResolvedValue(mockOrg)

			// Mock: 缓存设置
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await organizationService.getOrganization(organizationId)

			expect(result).toHaveProperty("id", organizationId)
			expect(result).toHaveProperty("name", "Test Org")
			expect(mockOrganizationRepository.findOne).toHaveBeenCalledWith({
				where: { id: organizationId },
			})
			expect(cache.set).toHaveBeenCalled()
		})

		it("应该在组织不存在时抛出错误", async () => {
			const organizationId = "nonexistent-org"

			// Mock: 缓存不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库查询不到
			mockOrganizationRepository.findOne.mockResolvedValue(null)

			await expect(organizationService.getOrganization(organizationId)).rejects.toThrow("Organization not found")
		})
	})

	describe("updateOrganization", () => {
		it("应该成功更新组织信息", async () => {
			const organizationId = "org-123"
			const mockOrg = {
				id: organizationId,
				name: "Old Name",
				settings: { old: "value" },
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			const updates = {
				name: "New Name",
				settings: { new: "value" },
			}

			// Mock: 组织存在
			mockOrganizationRepository.findOne.mockResolvedValue(mockOrg)
			mockOrganizationRepository.save.mockResolvedValue({ ...mockOrg, ...updates })

			// Mock: Cache
			vi.mocked(cache.del).mockResolvedValue(true)

			const result = await organizationService.updateOrganization(organizationId, updates)

			expect(result).toHaveProperty("name", "New Name")
			expect(mockOrganizationRepository.save).toHaveBeenCalled()
			expect(cache.del).toHaveBeenCalled()
		})

		it("应该在组织不存在时抛出错误", async () => {
			const organizationId = "nonexistent-org"

			// Mock: 组织不存在
			mockOrganizationRepository.findOne.mockResolvedValue(null)

			await expect(organizationService.updateOrganization(organizationId, { name: "New Name" })).rejects.toThrow(
				"Organization not found",
			)

			expect(mockOrganizationRepository.save).not.toHaveBeenCalled()
		})
	})

	describe("deleteOrganization", () => {
		it("应该成功删除组织", async () => {
			const organizationId = "org-123"
			const mockOrg = {
				id: organizationId,
				name: "Test Org",
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			const mockMemberships = [
				{ id: "mem-1", userId: "user-1", organizationId },
				{ id: "mem-2", userId: "user-2", organizationId },
			]

			// Mock: 组织存在
			mockOrganizationRepository.findOne.mockResolvedValue(mockOrg)

			// Mock: 成员列表
			mockMembershipRepository.find.mockResolvedValue(mockMemberships)

			// Mock: 删除操作
			mockOrganizationRepository.remove.mockResolvedValue(mockOrg)

			// Mock: Cache
			vi.mocked(cache.del).mockResolvedValue(true)

			await organizationService.deleteOrganization(organizationId)

			expect(mockOrganizationRepository.remove).toHaveBeenCalledWith(mockOrg)
			expect(cache.del).toHaveBeenCalled()
		})

		it("应该在组织不存在时抛出错误", async () => {
			const organizationId = "nonexistent-org"

			// Mock: 组织不存在
			mockOrganizationRepository.findOne.mockResolvedValue(null)

			await expect(organizationService.deleteOrganization(organizationId)).rejects.toThrow(
				"Organization not found",
			)

			expect(mockOrganizationRepository.remove).not.toHaveBeenCalled()
		})
	})

	describe("listUserOrganizations", () => {
		it("应该返回用户的组织列表", async () => {
			const userId = "user-123"
			const mockMemberships = [
				{
					id: "mem-1",
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
					id: "mem-2",
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

			// Mock: 查询成员关系
			mockMembershipRepository.find.mockResolvedValue(mockMemberships)

			const result = await organizationService.listUserOrganizations(userId)

			expect(result).toHaveLength(2)
			expect(result[0]).toHaveProperty("organization")
			expect(result[0].organization).toHaveProperty("id", "org-1")
			expect(result[1].organization).toHaveProperty("id", "org-2")
			expect(mockMembershipRepository.find).toHaveBeenCalledWith({
				where: { userId },
				relations: ["organization"],
				order: { joinedAt: "ASC" },
			})
		})

		it("应该在用户没有组织时返回空数组", async () => {
			const userId = "user-123"

			// Mock: 没有成员关系
			mockMembershipRepository.find.mockResolvedValue([])

			const result = await organizationService.listUserOrganizations(userId)

			expect(result).toHaveLength(0)
		})
	})

	describe("addMember", () => {
		it("应该成功添加成员", async () => {
			const organizationId = "org-123"
			const userId = "user-456"
			const role = "member" as const

			const mockOrg = {
				id: organizationId,
				name: "Test Org",
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			const mockUser = {
				id: userId,
				email: "user@example.com",
				name: "Test User",
			}

			const mockMembership = {
				id: "mem-123",
				userId,
				organizationId,
				role,
				joinedAt: new Date(),
				organization: mockOrg,
			}

			// Mock: 组织存在
			mockOrganizationRepository.findOne.mockResolvedValue(mockOrg)

			// Mock: 用户存在
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: 不是已有成员
			mockMembershipRepository.findOne.mockResolvedValueOnce(null)

			// Mock: 创建成员关系
			mockMembershipRepository.create.mockReturnValue(mockMembership)
			mockMembershipRepository.save.mockResolvedValue(mockMembership)

			// Mock: 重新查询以获取完整信息
			mockMembershipRepository.findOne.mockResolvedValueOnce(mockMembership)

			// Mock: Cache
			vi.mocked(cache.del).mockResolvedValue(true)

			const result = await organizationService.addMember(organizationId, { userId, role })

			expect(result).toHaveProperty("id", "mem-123")
			expect(result).toHaveProperty("role", role)
			expect(result.organization).toHaveProperty("id", organizationId)
			expect(mockMembershipRepository.save).toHaveBeenCalled()
		})

		it("应该在组织不存在时抛出错误", async () => {
			const organizationId = "nonexistent-org"
			const userId = "user-456"

			// Mock: 组织不存在
			mockOrganizationRepository.findOne.mockResolvedValue(null)

			await expect(organizationService.addMember(organizationId, { userId, role: "member" })).rejects.toThrow(
				"Organization not found",
			)

			expect(mockMembershipRepository.save).not.toHaveBeenCalled()
		})

		it("应该在用户不存在时抛出错误", async () => {
			const organizationId = "org-123"
			const userId = "nonexistent-user"

			const mockOrg = {
				id: organizationId,
				name: "Test Org",
			}

			// Mock: 组织存在
			mockOrganizationRepository.findOne.mockResolvedValue(mockOrg)

			// Mock: 用户不存在
			mockUserRepository.findOne.mockResolvedValue(null)

			await expect(organizationService.addMember(organizationId, { userId, role: "member" })).rejects.toThrow(
				"User not found",
			)

			expect(mockMembershipRepository.save).not.toHaveBeenCalled()
		})

		it("应该在用户已是成员时抛出错误", async () => {
			const organizationId = "org-123"
			const userId = "user-456"

			const mockOrg = {
				id: organizationId,
				name: "Test Org",
			}

			const mockUser = {
				id: userId,
				email: "user@example.com",
			}

			const existingMembership = {
				id: "existing-mem",
				userId,
				organizationId,
				role: "member" as const,
			}

			// Mock: 组织存在
			mockOrganizationRepository.findOne.mockResolvedValue(mockOrg)

			// Mock: 用户存在
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: 已是成员
			mockMembershipRepository.findOne.mockResolvedValue(existingMembership)

			await expect(organizationService.addMember(organizationId, { userId, role: "member" })).rejects.toThrow(
				"User is already a member of this organization",
			)

			expect(mockMembershipRepository.save).not.toHaveBeenCalled()
		})
	})

	describe("removeMember", () => {
		it("应该成功移除普通成员", async () => {
			const organizationId = "org-123"
			const userId = "user-456"

			const mockMembership = {
				id: "mem-123",
				userId,
				organizationId,
				role: "member" as const,
			}

			// Mock: 成员存在
			mockMembershipRepository.findOne.mockResolvedValue(mockMembership)

			// Mock: 删除操作
			mockMembershipRepository.remove.mockResolvedValue(mockMembership)

			// Mock: Cache
			vi.mocked(cache.del).mockResolvedValue(true)

			await organizationService.removeMember(organizationId, userId)

			expect(mockMembershipRepository.remove).toHaveBeenCalledWith(mockMembership)
		})

		it("应该在成员不存在时抛出错误", async () => {
			const organizationId = "org-123"
			const userId = "user-456"

			// Mock: 成员不存在
			mockMembershipRepository.findOne.mockResolvedValue(null)

			await expect(organizationService.removeMember(organizationId, userId)).rejects.toThrow(
				"Membership not found",
			)

			expect(mockMembershipRepository.remove).not.toHaveBeenCalled()
		})

		it("应该允许移除最后一个所有者", async () => {
			const organizationId = "org-123"
			const userId = "user-456"

			const mockMembership = {
				id: "mem-123",
				userId,
				organizationId,
				role: "owner" as const,
			}

			// Mock: 所有者成员
			mockMembershipRepository.findOne.mockResolvedValue(mockMembership)

			// Mock: 只有一个成员
			mockMembershipRepository.count.mockResolvedValue(1)

			// Mock: 删除操作
			mockMembershipRepository.remove.mockResolvedValue(mockMembership)

			// Mock: Cache
			vi.mocked(cache.del).mockResolvedValue(true)

			await organizationService.removeMember(organizationId, userId)

			expect(mockMembershipRepository.remove).toHaveBeenCalledWith(mockMembership)
		})

		it("应该在尝试移除非最后一个所有者时抛出错误", async () => {
			const organizationId = "org-123"
			const userId = "user-456"

			const mockMembership = {
				id: "mem-123",
				userId,
				organizationId,
				role: "owner" as const,
			}

			// Mock: 所有者成员
			mockMembershipRepository.findOne.mockResolvedValue(mockMembership)

			// Mock: 有多个成员
			mockMembershipRepository.count.mockResolvedValue(3)

			await expect(organizationService.removeMember(organizationId, userId)).rejects.toThrow(
				"Cannot remove owner unless it is the last member",
			)

			expect(mockMembershipRepository.remove).not.toHaveBeenCalled()
		})
	})

	describe("updateMemberRole", () => {
		it("应该成功更新成员角色", async () => {
			const organizationId = "org-123"
			const userId = "user-456"
			const newRole = "admin" as const

			const mockMembership = {
				id: "mem-123",
				userId,
				organizationId,
				role: "member" as const,
				joinedAt: new Date(),
				organization: {
					id: organizationId,
					name: "Test Org",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			}

			// Mock: 成员存在
			mockMembershipRepository.findOne.mockResolvedValue(mockMembership)

			// Mock: 保存更新
			mockMembershipRepository.save.mockResolvedValue({ ...mockMembership, role: newRole })

			// Mock: Cache
			vi.mocked(cache.del).mockResolvedValue(true)

			const result = await organizationService.updateMemberRole(organizationId, userId, newRole)

			expect(result).toHaveProperty("role", newRole)
			expect(mockMembershipRepository.save).toHaveBeenCalled()
		})

		it("应该在成员不存在时抛出错误", async () => {
			const organizationId = "org-123"
			const userId = "user-456"
			const newRole = "admin" as const

			// Mock: 成员不存在
			mockMembershipRepository.findOne.mockResolvedValue(null)

			await expect(organizationService.updateMemberRole(organizationId, userId, newRole)).rejects.toThrow(
				"Membership not found",
			)

			expect(mockMembershipRepository.save).not.toHaveBeenCalled()
		})
	})

	describe("listMembers", () => {
		it("应该返回组织的成员列表", async () => {
			const organizationId = "org-123"
			const mockMemberships = [
				{
					id: "mem-1",
					userId: "user-1",
					organizationId,
					role: "owner" as const,
					joinedAt: new Date(),
					organization: {
						id: organizationId,
						name: "Test Org",
						createdAt: new Date(),
						updatedAt: new Date(),
					},
					user: {
						id: "user-1",
						email: "user1@example.com",
						name: "User 1",
					},
				},
				{
					id: "mem-2",
					userId: "user-2",
					organizationId,
					role: "admin" as const,
					joinedAt: new Date(),
					organization: {
						id: organizationId,
						name: "Test Org",
						createdAt: new Date(),
						updatedAt: new Date(),
					},
					user: {
						id: "user-2",
						email: "user2@example.com",
						name: "User 2",
					},
				},
			]

			// Mock: 查询成员列表
			mockMembershipRepository.find.mockResolvedValue(mockMemberships)

			const result = await organizationService.listMembers(organizationId)

			expect(result).toHaveLength(2)
			expect(result[0]).toHaveProperty("role", "owner")
			expect(result[1]).toHaveProperty("role", "admin")
			expect(mockMembershipRepository.find).toHaveBeenCalledWith({
				where: { organizationId },
				relations: ["organization", "user"],
				order: { joinedAt: "ASC" },
			})
		})

		it("应该在组织没有成员时返回空数组", async () => {
			const organizationId = "org-123"

			// Mock: 没有成员
			mockMembershipRepository.find.mockResolvedValue([])

			const result = await organizationService.listMembers(organizationId)

			expect(result).toHaveLength(0)
		})
	})
})
