import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { ShareService } from "../ShareService.js"
import { AppDataSource } from "../../config/database.js"
import { Share } from "../../entities/Share.js"
import { Task } from "../../entities/Task.js"
import { User } from "../../entities/User.js"
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
		incr: vi.fn(),
	},
	CacheKeys: {
		stats: (type: string, id: string) => `stats:${type}:${id}`,
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

describe("ShareService", () => {
	let shareService: ShareService
	let mockShareRepository: any
	let mockTaskRepository: any
	let mockUserRepository: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Setup mock repositories
		mockShareRepository = {
			findOne: vi.fn(),
			find: vi.fn(),
			create: vi.fn(),
			save: vi.fn(),
			remove: vi.fn(),
		}

		mockTaskRepository = {
			findOne: vi.fn(),
		}

		mockUserRepository = {
			findOne: vi.fn(),
		}

		// Mock AppDataSource.getRepository
		vi.mocked(AppDataSource.getRepository).mockImplementation((entity: any) => {
			if (entity === Share) return mockShareRepository
			if (entity === Task) return mockTaskRepository
			if (entity === User) return mockUserRepository
			return {} as any
		})

		shareService = new ShareService()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("createShare", () => {
		it("应该成功创建分享链接", async () => {
			const params = {
				taskId: "task-123",
				visibility: "public" as const,
				createdBy: "user-456",
			}

			const mockTask = {
				id: "task-123",
				userId: "user-456",
				organizationId: "org-789",
			}

			const mockUser = {
				id: "user-456",
				email: "test@example.com",
			}

			const mockShare = {
				id: "share-001",
				taskId: params.taskId,
				shareUrl: "/share/abc123",
				visibility: params.visibility,
				createdBy: params.createdBy,
				createdAt: new Date(),
			}

			// Mock: 任务存在
			mockTaskRepository.findOne.mockResolvedValue(mockTask)

			// Mock: 用户存在
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			// Mock: 创建分享
			mockShareRepository.create.mockReturnValue(mockShare)
			mockShareRepository.save.mockResolvedValue(mockShare)

			// Mock: Cache operations
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await shareService.createShare(params)

			expect(result).toHaveProperty("id")
			expect(result.taskId).toBe(params.taskId)
			expect(result.visibility).toBe(params.visibility)
			expect(result.createdBy).toBe(params.createdBy)
			expect(mockShareRepository.save).toHaveBeenCalled()
			expect(cache.set).toHaveBeenCalledTimes(2) // 两次缓存调用
		})

		it("应该在任务不存在时抛出错误", async () => {
			const params = {
				taskId: "nonexistent-task",
				visibility: "public" as const,
				createdBy: "user-456",
			}

			// Mock: 任务不存在
			mockTaskRepository.findOne.mockResolvedValue(null)

			await expect(shareService.createShare(params)).rejects.toThrow("Task not found")
			expect(mockShareRepository.save).not.toHaveBeenCalled()
		})

		it("应该在用户不存在时抛出错误", async () => {
			const params = {
				taskId: "task-123",
				visibility: "public" as const,
				createdBy: "nonexistent-user",
			}

			const mockTask = {
				id: "task-123",
				userId: "user-456",
				organizationId: "org-789",
			}

			// Mock: 任务存在
			mockTaskRepository.findOne.mockResolvedValue(mockTask)

			// Mock: 用户不存在
			mockUserRepository.findOne.mockResolvedValue(null)

			await expect(shareService.createShare(params)).rejects.toThrow("User not found")
			expect(mockShareRepository.save).not.toHaveBeenCalled()
		})
	})

	describe("getShare", () => {
		it("应该从缓存获取分享", async () => {
			const shareId = "share-123"
			const cachedShare = {
				id: shareId,
				taskId: "task-456",
				shareUrl: "/share/abc123",
				visibility: "public" as const,
				createdBy: "user-789",
				createdAt: Date.now(),
			}

			// Mock: 缓存中存在
			vi.mocked(cache.get).mockResolvedValue(cachedShare)

			const result = await shareService.getShare(shareId)

			expect(result).toEqual(cachedShare)
			expect(cache.get).toHaveBeenCalled()
			expect(mockShareRepository.findOne).not.toHaveBeenCalled()
		})

		it("应该从数据库获取分享并缓存", async () => {
			const shareId = "share-123"
			const mockShare = {
				id: shareId,
				taskId: "task-456",
				shareUrl: "/share/abc123",
				visibility: "public" as const,
				createdBy: "user-789",
				createdAt: new Date(),
			}

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库中存在
			mockShareRepository.findOne.mockResolvedValue(mockShare)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await shareService.getShare(shareId)

			expect(result.id).toBe(shareId)
			expect(mockShareRepository.findOne).toHaveBeenCalled()
			expect(cache.set).toHaveBeenCalled()
		})

		it("应该在分享不存在时抛出错误", async () => {
			const shareId = "nonexistent-share"

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库中也不存在
			mockShareRepository.findOne.mockResolvedValue(null)

			await expect(shareService.getShare(shareId)).rejects.toThrow("Share not found")
		})
	})

	describe("validateShare", () => {
		it("应该验证有效的分享URL", async () => {
			const shareUrl = "/share/abc123"
			const mockShare = {
				id: "share-123",
				taskId: "task-456",
				shareUrl,
				visibility: "public" as const,
				createdBy: "user-789",
				createdAt: new Date(),
			}

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库中存在
			mockShareRepository.findOne.mockResolvedValue(mockShare)

			// Mock: Cache set
			vi.mocked(cache.set).mockResolvedValue(true)

			const result = await shareService.validateShare(shareUrl)

			expect(result.shareUrl).toBe(shareUrl)
			expect(mockShareRepository.findOne).toHaveBeenCalledWith({
				where: { shareUrl },
			})
			expect(cache.set).toHaveBeenCalled()
		})

		it("应该在URL无效时抛出错误", async () => {
			const shareUrl = "/share/invalid"

			// Mock: 缓存中不存在
			vi.mocked(cache.get).mockResolvedValue(null)

			// Mock: 数据库中也不存在
			mockShareRepository.findOne.mockResolvedValue(null)

			await expect(shareService.validateShare(shareUrl)).rejects.toThrow("Invalid share URL")
		})
	})

	describe("revokeShare", () => {
		it("应该成功撤销分享", async () => {
			const shareId = "share-123"
			const userId = "user-456"

			const mockShare = {
				id: shareId,
				taskId: "task-789",
				shareUrl: "/share/abc123",
				visibility: "public" as const,
				createdBy: userId,
				createdAt: new Date(),
			}

			// Mock: 分享存在
			mockShareRepository.findOne.mockResolvedValue(mockShare)

			// Mock: 删除分享
			mockShareRepository.remove.mockResolvedValue(mockShare)

			// Mock: Cache delete
			vi.mocked(cache.del).mockResolvedValue(true)

			await shareService.revokeShare(shareId, userId)

			expect(mockShareRepository.remove).toHaveBeenCalledWith(mockShare)
			expect(cache.del).toHaveBeenCalledTimes(2)
		})

		it("应该在分享不存在时抛出错误", async () => {
			const shareId = "nonexistent-share"
			const userId = "user-456"

			// Mock: 分享不存在
			mockShareRepository.findOne.mockResolvedValue(null)

			await expect(shareService.revokeShare(shareId, userId)).rejects.toThrow("Share not found")
			expect(mockShareRepository.remove).not.toHaveBeenCalled()
		})

		it("应该在用户无权限时抛出错误", async () => {
			const shareId = "share-123"
			const userId = "user-456"

			const mockShare = {
				id: shareId,
				taskId: "task-789",
				shareUrl: "/share/abc123",
				visibility: "public" as const,
				createdBy: "different-user",
				createdAt: new Date(),
			}

			// Mock: 分享存在但创建者不同
			mockShareRepository.findOne.mockResolvedValue(mockShare)

			await expect(shareService.revokeShare(shareId, userId)).rejects.toThrow("Permission denied")
			expect(mockShareRepository.remove).not.toHaveBeenCalled()
		})
	})

	describe("listTaskShares", () => {
		it("应该返回任务的分享列表", async () => {
			const taskId = "task-123"
			const mockShares = [
				{
					id: "share-1",
					taskId,
					shareUrl: "/share/abc1",
					visibility: "public" as const,
					createdBy: "user-1",
					createdAt: new Date(),
				},
				{
					id: "share-2",
					taskId,
					shareUrl: "/share/abc2",
					visibility: "organization" as const,
					createdBy: "user-2",
					createdAt: new Date(),
				},
			]

			// Mock: 找到分享列表
			mockShareRepository.find.mockResolvedValue(mockShares)

			const result = await shareService.listTaskShares(taskId)

			expect(result).toHaveLength(2)
			expect(result[0].taskId).toBe(taskId)
			expect(result[1].taskId).toBe(taskId)
		})

		it("应该返回空列表当没有分享时", async () => {
			const taskId = "task-123"

			// Mock: 没有找到分享
			mockShareRepository.find.mockResolvedValue([])

			const result = await shareService.listTaskShares(taskId)

			expect(result).toHaveLength(0)
		})
	})

	describe("updateAccessCount", () => {
		it("应该成功更新访问次数", async () => {
			const shareId = "share-123"
			const mockShare = {
				id: shareId,
				taskId: "task-456",
				shareUrl: "/share/abc123",
				visibility: "public" as const,
				createdBy: "user-789",
				createdAt: new Date(),
			}

			// Mock: 分享存在
			mockShareRepository.findOne.mockResolvedValue(mockShare)

			// Mock: Redis incr
			vi.mocked(cache.incr).mockResolvedValue(5)

			const result = await shareService.updateAccessCount(shareId)

			expect(result.id).toBe(shareId)
			expect(cache.incr).toHaveBeenCalledWith(`share:access:${shareId}`)
		})

		it("应该在分享不存在时抛出错误", async () => {
			const shareId = "nonexistent-share"

			// Mock: 分享不存在
			mockShareRepository.findOne.mockResolvedValue(null)

			await expect(shareService.updateAccessCount(shareId)).rejects.toThrow("Share not found")
			expect(cache.incr).not.toHaveBeenCalled()
		})
	})
})
