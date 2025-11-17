import { Router, Request, Response } from "express"
import type { Router as ExpressRouter } from "express"
import { authenticate } from "../middleware/auth.js"
import { sseService } from "../services/SSEService.js"
import { logger } from "../utils/logger.js"
import { nanoid } from "nanoid"

const router: ExpressRouter = Router()

/**
 * SSE 连接端点 - 任务进度流
 * GET /api/sse/tasks/:taskId
 */
router.get("/tasks/:taskId", authenticate, async (req: Request, res: Response) => {
	try {
		const { taskId } = req.params
		const userId = req.user!.r?.u
		const organizationId = req.user!.r?.o

		if (!userId) {
			return res.status(401).json({
				success: false,
				error: "User ID not found in token",
			})
		}

		// 验证任务访问权限
		// TODO: 添加任务访问权限验证

		// 生成唯一连接 ID
		const connectionId = nanoid()

		logger.info("SSE connection request for task", {
			connectionId,
			taskId,
			userId,
			organizationId,
		})

		// 创建 SSE 连接
		sseService.createConnection(connectionId, userId, organizationId, res)

		// 订阅任务频道
		const taskChannel = `sse:task:${taskId}`
		sseService.subscribeToChannel(connectionId, taskChannel)

		// 订阅遥测频道
		const telemetryChannel = `sse:telemetry:${taskId}`
		sseService.subscribeToChannel(connectionId, telemetryChannel)

		logger.info("SSE connection established for task", {
			connectionId,
			taskId,
			userId,
		})
	} catch (error) {
		logger.error("Failed to establish SSE connection for task", {
			taskId: req.params.taskId,
			userId: req.user?.r?.u,
			error,
		})

		if (!res.headersSent) {
			res.status(500).json({
				success: false,
				error: "Failed to establish SSE connection",
			})
		}
	}
})

/**
 * SSE 连接端点 - 遥测数据流
 * GET /api/sse/telemetry/:taskId
 */
router.get("/telemetry/:taskId", authenticate, async (req: Request, res: Response) => {
	try {
		const { taskId } = req.params
		const userId = req.user!.r?.u
		const organizationId = req.user!.r?.o

		if (!userId) {
			return res.status(401).json({
				success: false,
				error: "User ID not found in token",
			})
		}

		// 验证任务访问权限
		// TODO: 添加任务访问权限验证

		// 生成唯一连接 ID
		const connectionId = nanoid()

		logger.info("SSE connection request for telemetry", {
			connectionId,
			taskId,
			userId,
			organizationId,
		})

		// 创建 SSE 连接
		sseService.createConnection(connectionId, userId, organizationId, res)

		// 订阅遥测频道
		const telemetryChannel = `sse:telemetry:${taskId}`
		sseService.subscribeToChannel(connectionId, telemetryChannel)

		logger.info("SSE connection established for telemetry", {
			connectionId,
			taskId,
			userId,
		})
	} catch (error) {
		logger.error("Failed to establish SSE connection for telemetry", {
			taskId: req.params.taskId,
			userId: req.user?.r?.u,
			error,
		})

		if (!res.headersSent) {
			res.status(500).json({
				success: false,
				error: "Failed to establish SSE connection",
			})
		}
	}
})

/**
 * SSE 连接端点 - 组织事件流
 * GET /api/sse/organizations/:orgId
 */
router.get("/organizations/:orgId", authenticate, async (req: Request, res: Response) => {
	try {
		const { orgId } = req.params
		const userId = req.user!.r?.u
		const userOrganizationId = req.user!.r?.o

		if (!userId) {
			return res.status(401).json({
				success: false,
				error: "User ID not found in token",
			})
		}

		// 验证组织访问权限
		if (userOrganizationId !== orgId) {
			logger.warn("Unauthorized SSE connection attempt for organization", {
				userId,
				requestedOrgId: orgId,
				userOrgId: userOrganizationId,
			})

			return res.status(403).json({
				success: false,
				error: "Access denied to organization",
			})
		}

		// 生成唯一连接 ID
		const connectionId = nanoid()

		logger.info("SSE connection request for organization", {
			connectionId,
			organizationId: orgId,
			userId,
		})

		// 创建 SSE 连接
		sseService.createConnection(connectionId, userId, orgId, res)

		// 订阅组织频道
		const orgChannel = `sse:organization:${orgId}`
		sseService.subscribeToChannel(connectionId, orgChannel)

		logger.info("SSE connection established for organization", {
			connectionId,
			organizationId: orgId,
			userId,
		})
	} catch (error) {
		logger.error("Failed to establish SSE connection for organization", {
			organizationId: req.params.orgId,
			userId: req.user?.r?.u,
			error,
		})

		if (!res.headersSent) {
			res.status(500).json({
				success: false,
				error: "Failed to establish SSE connection",
			})
		}
	}
})

/**
 * SSE 连接端点 - 用户事件流
 * GET /api/sse/user
 */
router.get("/user", authenticate, async (req: Request, res: Response) => {
	try {
		const userId = req.user!.r?.u
		const organizationId = req.user!.r?.o

		if (!userId) {
			return res.status(401).json({
				success: false,
				error: "User ID not found in token",
			})
		}

		// 生成唯一连接 ID
		const connectionId = nanoid()

		logger.info("SSE connection request for user", {
			connectionId,
			userId,
			organizationId,
		})

		// 创建 SSE 连接
		sseService.createConnection(connectionId, userId, organizationId, res)

		// 订阅用户相关的所有频道
		// 用户可以接收其任务、组织的所有事件

		if (organizationId) {
			const orgChannel = `sse:organization:${organizationId}`
			sseService.subscribeToChannel(connectionId, orgChannel)
		}

		logger.info("SSE connection established for user", {
			connectionId,
			userId,
		})
	} catch (error) {
		logger.error("Failed to establish SSE connection for user", {
			userId: req.user?.r?.u,
			error,
		})

		if (!res.headersSent) {
			res.status(500).json({
				success: false,
				error: "Failed to establish SSE connection",
			})
		}
	}
})

/**
 * 获取 SSE 连接统计信息
 * GET /api/sse/stats
 */
router.get("/stats", authenticate, async (req: Request, res: Response) => {
	try {
		const userId = req.user!.r?.u
		const organizationId = req.user!.r?.o

		if (!userId) {
			return res.status(401).json({
				success: false,
				error: "User ID not found in token",
			})
		}

		// 只有组织管理员可以查看统计信息
		// TODO: 添加权限验证

		const stats = {
			totalConnections: sseService.getActiveConnectionsCount(),
			userConnections: sseService.getUserConnectionsCount(userId),
			timestamp: Date.now(),
		}

		logger.debug("SSE stats requested", {
			userId,
			organizationId,
			stats,
		})

		res.json({
			success: true,
			data: stats,
		})
	} catch (error) {
		logger.error("Failed to get SSE stats", {
			userId: req.user?.r?.u,
			error,
		})

		res.status(500).json({
			success: false,
			error: "Failed to get SSE stats",
		})
	}
})

/**
 * 获取活跃连接列表
 * GET /api/sse/connections
 */
router.get("/connections", authenticate, async (req: Request, res: Response) => {
	try {
		const userId = req.user!.r?.u
		const organizationId = req.user!.r?.o

		if (!userId) {
			return res.status(401).json({
				success: false,
				error: "User ID not found in token",
			})
		}

		// 只有组织管理员可以查看连接列表
		// TODO: 添加权限验证

		const connections = sseService.getConnections()

		// 过滤只显示当前组织的连接
		const filteredConnections = organizationId
			? connections.filter((conn) => conn.organizationId === organizationId)
			: connections.filter((conn) => conn.userId === userId)

		logger.debug("SSE connections requested", {
			userId,
			organizationId,
			totalConnections: connections.length,
			filteredConnections: filteredConnections.length,
		})

		res.json({
			success: true,
			data: filteredConnections,
		})
	} catch (error) {
		logger.error("Failed to get SSE connections", {
			userId: req.user?.r?.u,
			error,
		})

		res.status(500).json({
			success: false,
			error: "Failed to get SSE connections",
		})
	}
})

/**
 * 健康检查端点
 * GET /api/sse/health
 */
router.get("/health", (_req: Request, res: Response) => {
	res.json({
		success: true,
		data: {
			status: "ok",
			service: "SSE",
			timestamp: Date.now(),
		},
	})
})

export default router
