import { describe, it, expect, beforeEach, vi } from "vitest"
import { Request, Response, NextFunction } from "express"
import { authenticate, optionalAuthenticate, requireOrganization, requireTokenType } from "../auth.js"
import { authService } from "../../services/AuthService.js"
import * as jwtUtils from "../../utils/jwt.js"

// Mock dependencies
vi.mock("../../services/AuthService.js", () => ({
	authService: {
		verifyTokenWithSession: vi.fn(),
	},
}))

vi.mock("../../utils/jwt.js", () => ({
	extractBearerToken: vi.fn(),
}))

vi.mock("../../utils/logger.js", () => ({
	logger: {
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}))

describe("Auth Middleware", () => {
	let mockRequest: Partial<Request>
	let mockResponse: Partial<Response>
	let mockNext: NextFunction
	let jsonMock: any
	let statusMock: any

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks()

		// Setup response mock
		jsonMock = vi.fn()
		statusMock = vi.fn().mockReturnValue({ json: jsonMock })

		mockRequest = {
			headers: {},
			user: undefined,
		}

		mockResponse = {
			status: statusMock,
			json: jsonMock,
		}

		mockNext = vi.fn()
	})

	describe("authenticate", () => {
		it("应该在提供有效 token 时通过认证", async () => {
			const token = "valid_token"
			const mockPayload = {
				iss: "rcc",
				sub: "user-123",
				v: 1,
				r: { u: "user-123", t: "auth" },
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
			}

			mockRequest.headers = {
				authorization: `Bearer ${token}`,
			}

			// Mock: 提取 token
			vi.mocked(jwtUtils.extractBearerToken).mockReturnValue(token)

			// Mock: 验证成功
			vi.mocked(authService.verifyTokenWithSession).mockResolvedValue(mockPayload)

			await authenticate(mockRequest as Request, mockResponse as Response, mockNext)

			expect(mockRequest.user).toEqual(mockPayload)
			expect(mockNext).toHaveBeenCalled()
			expect(statusMock).not.toHaveBeenCalled()
		})

		it("应该在没有 authorization header 时返回 401", async () => {
			mockRequest.headers = {}

			await authenticate(mockRequest as Request, mockResponse as Response, mockNext)

			expect(statusMock).toHaveBeenCalledWith(401)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "No authorization header provided",
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it("应该在 authorization header 格式无效时返回 401", async () => {
			mockRequest.headers = {
				authorization: "InvalidFormat token",
			}

			// Mock: 提取失败
			vi.mocked(jwtUtils.extractBearerToken).mockReturnValue(null)

			await authenticate(mockRequest as Request, mockResponse as Response, mockNext)

			expect(statusMock).toHaveBeenCalledWith(401)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Invalid authorization header format. Expected: Bearer <token>",
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it("应该在 token 过期时返回 401", async () => {
			const token = "expired_token"

			mockRequest.headers = {
				authorization: `Bearer ${token}`,
			}

			// Mock: 提取 token
			vi.mocked(jwtUtils.extractBearerToken).mockReturnValue(token)

			// Mock: Token 过期
			vi.mocked(authService.verifyTokenWithSession).mockRejectedValue(new Error("Token expired"))

			await authenticate(mockRequest as Request, mockResponse as Response, mockNext)

			expect(statusMock).toHaveBeenCalledWith(401)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Token expired",
				code: "TOKEN_EXPIRED",
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it("应该在 token 无效时返回 401", async () => {
			const token = "invalid_token"

			mockRequest.headers = {
				authorization: `Bearer ${token}`,
			}

			// Mock: 提取 token
			vi.mocked(jwtUtils.extractBearerToken).mockReturnValue(token)

			// Mock: Token 无效
			vi.mocked(authService.verifyTokenWithSession).mockRejectedValue(new Error("Invalid token"))

			await authenticate(mockRequest as Request, mockResponse as Response, mockNext)

			expect(statusMock).toHaveBeenCalledWith(401)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Invalid or expired token",
				code: "INVALID_TOKEN",
			})
			expect(mockNext).not.toHaveBeenCalled()
		})
	})

	describe("optionalAuthenticate", () => {
		it("应该在没有 authorization header 时继续", async () => {
			mockRequest.headers = {}

			await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext)

			expect(mockRequest.user).toBeUndefined()
			expect(mockNext).toHaveBeenCalled()
			expect(statusMock).not.toHaveBeenCalled()
		})

		it("应该在提供有效 token 时设置用户信息", async () => {
			const token = "valid_token"
			const mockPayload = {
				iss: "rcc",
				sub: "user-123",
				v: 1,
				r: { u: "user-123", t: "auth" },
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
			}

			mockRequest.headers = {
				authorization: `Bearer ${token}`,
			}

			// Mock: 提取 token
			vi.mocked(jwtUtils.extractBearerToken).mockReturnValue(token)

			// Mock: 验证成功
			vi.mocked(authService.verifyTokenWithSession).mockResolvedValue(mockPayload)

			await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext)

			expect(mockRequest.user).toEqual(mockPayload)
			expect(mockNext).toHaveBeenCalled()
			expect(statusMock).not.toHaveBeenCalled()
		})

		it("应该在 token 无效时仍然继续", async () => {
			const token = "invalid_token"

			mockRequest.headers = {
				authorization: `Bearer ${token}`,
			}

			// Mock: 提取 token
			vi.mocked(jwtUtils.extractBearerToken).mockReturnValue(token)

			// Mock: Token 无效
			vi.mocked(authService.verifyTokenWithSession).mockRejectedValue(new Error("Invalid token"))

			await optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext)

			expect(mockRequest.user).toBeUndefined()
			expect(mockNext).toHaveBeenCalled()
			expect(statusMock).not.toHaveBeenCalled()
		})
	})

	describe("requireOrganization", () => {
		it("应该在用户有组织时通过", () => {
			mockRequest.user = {
				iss: "rcc",
				sub: "user-123",
				v: 1,
				r: { u: "user-123", o: "org-456", t: "auth" },
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
			}

			requireOrganization(mockRequest as Request, mockResponse as Response, mockNext)

			expect(mockNext).toHaveBeenCalled()
			expect(statusMock).not.toHaveBeenCalled()
		})

		it("应该在没有用户信息时返回 401", () => {
			mockRequest.user = undefined

			requireOrganization(mockRequest as Request, mockResponse as Response, mockNext)

			expect(statusMock).toHaveBeenCalledWith(401)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Authentication required",
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it("应该在用户没有组织时返回 403", () => {
			mockRequest.user = {
				iss: "rcc",
				sub: "user-123",
				v: 1,
				r: { u: "user-123", t: "auth" }, // 没有 organizationId
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
			}

			requireOrganization(mockRequest as Request, mockResponse as Response, mockNext)

			expect(statusMock).toHaveBeenCalledWith(403)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Organization membership required",
			})
			expect(mockNext).not.toHaveBeenCalled()
		})
	})

	describe("requireTokenType", () => {
		it("应该在 token 类型匹配时通过 (auth)", () => {
			mockRequest.user = {
				iss: "rcc",
				sub: "user-123",
				v: 1,
				r: { u: "user-123", t: "auth" },
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
			}

			const middleware = requireTokenType("auth")
			middleware(mockRequest as Request, mockResponse as Response, mockNext)

			expect(mockNext).toHaveBeenCalled()
			expect(statusMock).not.toHaveBeenCalled()
		})

		it("应该在 token 类型匹配时通过 (cj)", () => {
			mockRequest.user = {
				iss: "rcc",
				sub: "job-123",
				v: 1,
				r: { u: "user-123", t: "cj" },
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
			}

			const middleware = requireTokenType("cj")
			middleware(mockRequest as Request, mockResponse as Response, mockNext)

			expect(mockNext).toHaveBeenCalled()
			expect(statusMock).not.toHaveBeenCalled()
		})

		it("应该在没有用户信息时返回 401", () => {
			mockRequest.user = undefined

			const middleware = requireTokenType("auth")
			middleware(mockRequest as Request, mockResponse as Response, mockNext)

			expect(statusMock).toHaveBeenCalledWith(401)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Authentication required",
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it("应该在 token 类型不匹配时返回 403", () => {
			mockRequest.user = {
				iss: "rcc",
				sub: "user-123",
				v: 1,
				r: { u: "user-123", t: "auth" },
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
			}

			const middleware = requireTokenType("cj")
			middleware(mockRequest as Request, mockResponse as Response, mockNext)

			expect(statusMock).toHaveBeenCalledWith(403)
			expect(jsonMock).toHaveBeenCalledWith({
				success: false,
				error: "Token type 'cj' required",
			})
			expect(mockNext).not.toHaveBeenCalled()
		})
	})
})
