import { Router, Request, Response, NextFunction } from "express"
import { authRouter } from "./auth.js"
import { taskRouter } from "./task.routes.js"
import { organizationRouter } from "./organization.routes.js"
import { telemetryRouter } from "./telemetry.routes.js"
import { settingsRouter } from "./settings.routes.js"
import { shareRouter } from "./share.routes.js"
import { dashboardRouter } from "./dashboard.routes.js"
import sseRoutes from "./sse.routes.js"
import { logger } from "../utils/logger.js"
import { isProduction } from "../config/env.js"

/**
 * 创建 API 路由
 */
export function createApiRouter(): Router {
	const router = Router()

	// 请求日志中间件
	router.use((req: Request, _res: Response, next: NextFunction) => {
		logger.debug("API Request", {
			method: req.method,
			path: req.path,
			ip: req.ip,
			userAgent: req.get("user-agent"),
		})
		next()
	})

	// API 版本前缀 /api/v1
	const v1Router = Router()

	// 挂载各个业务路由
	v1Router.use("/auth", authRouter)
	v1Router.use("/tasks", taskRouter)
	v1Router.use("/organizations", organizationRouter)
	v1Router.use("/telemetry", telemetryRouter)
	v1Router.use("/settings", settingsRouter)
	v1Router.use("/shares", shareRouter)
	v1Router.use("/dashboard", dashboardRouter)
	v1Router.use("/sse", sseRoutes)

	// 挂载 v1 路由
	router.use("/v1", v1Router)

	// API 根路径信息
	router.get("/", (_req: Request, res: Response) => {
		res.json({
			success: true,
			data: {
				name: "Roo Code Backend API",
				version: "1.0.0",
				endpoints: {
					auth: "/api/v1/auth",
					tasks: "/api/v1/tasks",
					organizations: "/api/v1/organizations",
					telemetry: "/api/v1/telemetry",
					settings: "/api/v1/settings",
					shares: "/api/v1/shares",
					dashboard: "/api/v1/dashboard",
					sse: "/api/v1/sse",
				},
				docs: "/api/docs",
			},
		})
	})

	// 404 处理 - API 路由未找到
	router.use((_req: Request, res: Response) => {
		res.status(404).json({
			success: false,
			error: {
				code: "NOT_FOUND",
				message: "API endpoint not found",
			},
		})
	})

	// 全局错误处理中间件
	router.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
		logger.error("API Error Handler", {
			error: err.message,
			stack: err.stack,
			code: err.code,
		})

		// 根据错误类型返回不同的状态码
		const statusCode = err.statusCode || err.status || 500
		const errorCode = err.code || "INTERNAL_SERVER_ERROR"

		res.status(statusCode).json({
			success: false,
			error: {
				code: errorCode,
				message: isProduction ? "Internal Server Error" : err.message,
				...(isProduction ? {} : { stack: err.stack }),
			},
		})
	})

	return router
}

/**
 * 导出默认路由实例
 */
export const apiRouter = createApiRouter()
