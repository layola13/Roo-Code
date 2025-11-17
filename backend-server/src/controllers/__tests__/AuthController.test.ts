import { describe, it, expect, beforeEach, vi } from "vitest"
import { Request, Response } from "express"
import { AuthController } from "../AuthController.js"
import { authService } from "../../services/AuthService.js"

// Mock dependencies
vi.mock("../../services/AuthService.js", () => ({
	authService: {
		register: vi.fn(),
		login: vi.fn(),
		logout: vi.fn(),
		refreshToken: vi.fn(),
		switchOrganization: vi.fn(),
		getOrganizationMemberships: vi.fn(),
	},
}))

vi.mock("../../utils/logger.js", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}))

describe("AuthController", () => {
	let authController: AuthController
	let mockRequest: Partial<Request>
	let mockResponse: Partial<Response>
	let jsonMock: any
	let statusMock: any

	beforeEach(() => {
		vi.clearAllMocks()

		authController = new AuthController()

		jsonMock = vi.fn()
		statusMock = vi.fn().mockReturnValue({ json: jsonMock })

		mockRequest = {
			body: {},
			headers: {},
			user: undefined,
		}

		mockResponse = {
			status: statusMock,
			json: jsonMock,
		}
	})

	describe("register", () => {
		it("应该成功注册用户", async () => {
			const mockAuthResponse = {
				user: {
					id: "user-123",
					email: "test@example.com",
					name: "Test User",
				},
				accessToken: "access_token",
				refreshToken: "refresh_token",
				expiresIn: 3600,
			}

			mockRequest.body = {
				email: "test@example.com",
				password: "password123",
				name: "Test User",
			}

			vi.mocked(authService.register).mockResolvedValue(mockAuthResponse)

			await authController.register(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(201)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: mockAuthResponse,
			})
		})

		it("应该在验证失败时返回 400", async () => {
			mockRequest.body = {
				email: "invalid-email",
				password: "short",
			}

			await authController.register(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(400)
			expect(jsonMock).toHaveBeenCalledWith(
				expect.objectContaining({
					success: false,
					error: "Validation failed",
				}),
			)
		})

		it("应该在邮箱已存在时返回 409", async () => {
			mockRequest.body = {
				email: "existing@example.com",
				password: "password123",
			}

			vi.mocked(authService.register).mockRejectedValue(new Error("Email already registered"))

			await authController.register(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(409)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Email already registered",
			})
		})

		it("应该在服务器错误时返回 500", async () => {
			mockRequest.body = {
				email: "test@example.com",
				password: "password123",
			}

			vi.mocked(authService.register).mockRejectedValue(new Error("Database error"))

			await authController.register(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(500)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Internal server error",
			})
		})
	})

	describe("login", () => {
		it("应该成功登录", async () => {
			const mockAuthResponse = {
				user: {
					id: "user-123",
					email: "test@example.com",
					name: "Test User",
				},
				accessToken: "access_token",
				refreshToken: "refresh_token",
				expiresIn: 3600,
			}

			mockRequest.body = {
				email: "test@example.com",
				password: "password123",
			}

			vi.mocked(authService.login).mockResolvedValue(mockAuthResponse)

			await authController.login(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: mockAuthResponse,
			})
		})

		it("应该在凭证无效时返回 401", async () => {
			mockRequest.body = {
				email: "test@example.com",
				password: "wrong_password",
			}

			vi.mocked(authService.login).mockRejectedValue(new Error("Invalid credentials"))

			await authController.login(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(401)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Invalid email or password",
			})
		})
	})

	describe("logout", () => {
		it("应该成功登出", async () => {
			mockRequest.headers = {
				authorization: "Bearer access_token",
			}

			vi.mocked(authService.logout).mockResolvedValue()

			await authController.logout(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				message: "Logged out successfully",
			})
		})

		it("应该在没有 token 时返回 400", async () => {
			mockRequest.headers = {}

			await authController.logout(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(400)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "No token provided",
			})
		})
	})

	describe("refreshToken", () => {
		it("应该成功刷新 token", async () => {
			const mockAuthResponse = {
				user: {
					id: "user-123",
					email: "test@example.com",
				},
				accessToken: "new_access_token",
				refreshToken: "new_refresh_token",
				expiresIn: 3600,
			}

			mockRequest.body = {
				refreshToken: "old_refresh_token",
			}

			vi.mocked(authService.refreshToken).mockResolvedValue(mockAuthResponse)

			await authController.refreshToken(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: mockAuthResponse,
			})
		})

		it("应该在 refresh token 无效时返回 401", async () => {
			mockRequest.body = {
				refreshToken: "invalid_refresh_token",
			}

			vi.mocked(authService.refreshToken).mockRejectedValue(new Error("Invalid refresh token"))

			await authController.refreshToken(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(401)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Invalid or expired refresh token",
			})
		})
	})

	describe("switchOrganization", () => {
		it("应该成功切换组织", async () => {
			const mockAuthResponse = {
				user: {
					id: "user-123",
					email: "test@example.com",
					organizationId: "org-456",
				},
				accessToken: "new_access_token",
				refreshToken: "new_refresh_token",
				expiresIn: 3600,
			}

			mockRequest.user = {
				iss: "rcc",
				sub: "user-123",
				v: 1,
				r: { u: "user-123", t: "auth" },
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
			}

			mockRequest.body = {
				organizationId: "org-456",
			}

			vi.mocked(authService.switchOrganization).mockResolvedValue(mockAuthResponse)

			await authController.switchOrganization(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: mockAuthResponse,
			})
		})

		it("应该在未认证时返回 401", async () => {
			mockRequest.user = undefined
			mockRequest.body = {
				organizationId: "org-456",
			}

			await authController.switchOrganization(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(401)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Authentication required",
			})
		})

		it("应该在用户不是成员时返回 403", async () => {
			mockRequest.user = {
				iss: "rcc",
				sub: "user-123",
				v: 1,
				r: { u: "user-123", t: "auth" },
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
			}

			mockRequest.body = {
				organizationId: "org-456",
			}

			vi.mocked(authService.switchOrganization).mockRejectedValue(
				new Error("User is not a member of this organization"),
			)

			await authController.switchOrganization(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(403)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "You are not a member of this organization",
			})
		})
	})

	describe("getCurrentUser", () => {
		it("应该返回当前用户信息", async () => {
			const now = Math.floor(Date.now() / 1000)
			mockRequest.user = {
				iss: "rcc",
				sub: "user-123",
				v: 1,
				r: { u: "user-123", o: "org-456", t: "auth" },
				iat: now,
				exp: now + 3600,
			}

			await authController.getCurrentUser(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: {
					userId: "user-123",
					organizationId: "org-456",
					tokenType: "auth",
					issuedAt: now,
					expiresAt: now + 3600,
				},
			})
		})

		it("应该在未认证时返回 401", async () => {
			mockRequest.user = undefined

			await authController.getCurrentUser(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(401)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Authentication required",
			})
		})
	})

	describe("getOrganizations", () => {
		it("应该返回用户的组织列表", async () => {
			const mockMemberships = [
				{
					id: "membership-1",
					organization: {
						id: "org-1",
						name: "Org 1",
					},
					role: "owner",
				},
				{
					id: "membership-2",
					organization: {
						id: "org-2",
						name: "Org 2",
					},
					role: "member",
				},
			]

			mockRequest.user = {
				iss: "rcc",
				sub: "user-123",
				v: 1,
				r: { u: "user-123", t: "auth" },
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
			}

			vi.mocked(authService.getOrganizationMemberships).mockResolvedValue(mockMemberships as any)

			await authController.getOrganizations(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(200)
			expect(jsonMock).toHaveBeenCalledWith({
				success: true,
				data: mockMemberships,
			})
		})

		it("应该在未认证时返回 401", async () => {
			mockRequest.user = undefined

			await authController.getOrganizations(mockRequest as Request, mockResponse as Response)

			expect(statusMock).toHaveBeenCalledWith(401)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Authentication required",
			})
		})
	})
})
