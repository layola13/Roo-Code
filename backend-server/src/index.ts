import express, { Express } from "express"
import { createServer } from "http"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import rateLimit from "express-rate-limit"
import { env, isProduction } from "./config/env.js"
import { initializeDatabase } from "./config/database.js"
import { initializeRedis } from "./config/redis.js"
import { SocketService } from "./services/SocketService.js"
import { sseService } from "./services/SSEService.js"
import { logger } from "./utils/logger.js"
import { apiRouter } from "./routes/index.js"

/**
 * 创建 Express 应用
 */
function createApp(): Express {
	const app = express()

	// 安全中间件
	app.use(
		helmet({
			contentSecurityPolicy: isProduction ? undefined : false,
			crossOriginEmbedderPolicy: false,
		}),
	)

	// CORS 配置
	app.use(
		cors({
			origin: env.SOCKET_CORS_ORIGIN,
			credentials: true,
			methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
		}),
	)

	// 压缩响应
	app.use(compression())

	// 请求体解析
	app.use(express.json({ limit: "10mb" }))
	app.use(express.urlencoded({ extended: true, limit: "10mb" }))

	// 速率限制
	if (isProduction) {
		const limiter = rateLimit({
			windowMs: 15 * 60 * 1000, // 15 minutes
			max: 100, // limit each IP to 100 requests per windowMs
			message: {
				success: false,
				error: {
					code: "RATE_LIMIT_EXCEEDED",
					message: "Too many requests from this IP, please try again later.",
				},
			},
			standardHeaders: true,
			legacyHeaders: false,
		})
		app.use("/api/", limiter)
	}

	// 请求日志中间件
	app.use((req, _res, next) => {
		const startTime = Date.now()
		_res.on("finish", () => {
			const duration = Date.now() - startTime
			logger.info("HTTP Request", {
				method: req.method,
				path: req.path,
				statusCode: _res.statusCode,
				duration: `${duration}ms`,
				ip: req.ip,
				userAgent: req.get("user-agent"),
			})
		})
		next()
	})

	// 健康检查端点
	app.get("/health", (_req, res) => {
		res.json({
			success: true,
			data: {
				status: "ok",
				timestamp: new Date().toISOString(),
				uptime: process.uptime(),
				env: env.NODE_ENV,
			},
		})
	})

	// 就绪检查端点（用于 Kubernetes）
	app.get("/ready", async (_req, res) => {
		try {
			// TODO: 添加数据库和 Redis 连接检查
			res.json({
				success: true,
				data: {
					status: "ready",
					timestamp: new Date().toISOString(),
				},
			})
		} catch (error) {
			res.status(503).json({
				success: false,
				error: {
					code: "SERVICE_UNAVAILABLE",
					message: "Service is not ready",
				},
			})
		}
	})

	// API 路由
	app.use("/api", apiRouter)

	// 根路径
	app.get("/", (_req, res) => {
		res.json({
			success: true,
			data: {
				name: "Roo Code Backend Server",
				version: "1.0.0",
				status: "running",
				endpoints: {
					health: "/health",
					ready: "/ready",
					api: "/api",
					apiV1: "/api/v1",
				},
			},
		})
	})

	// 404 处理
	app.use((_req, res) => {
		res.status(404).json({
			success: false,
			error: {
				code: "NOT_FOUND",
				message: "Resource not found",
			},
		})
	})

	// 全局错误处理中间件
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		logger.error("Express error handler", {
			error: err.message,
			stack: err.stack,
			code: err.code,
		})

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

	return app
}

/**
 * 初始化所有服务
 */
async function initializeServices() {
	logger.info("Initializing services...")

	// 初始化数据库
	try {
		logger.info("Connecting to database...")
		await initializeDatabase()
		logger.info("✅ Database connected successfully")
	} catch (error) {
		logger.error("❌ Database connection failed", { error })
		// 不抛出错误，允许服务器继续启动（用于开发环境）
		if (isProduction) {
			throw error
		}
	}

	// 初始化 Redis
	try {
		logger.info("Connecting to Redis...")
		await initializeRedis()
		logger.info("✅ Redis connected successfully")
	} catch (error) {
		logger.error("❌ Redis connection failed", { error })
		// 不抛出错误，允许服务器继续启动（用于开发环境）
		if (isProduction) {
			throw error
		}
	}
}

/**
 * 启动服务器
 */
async function startServer() {
	try {
		logger.info("🚀 Starting Roo Code Backend Server...")
		logger.info(`Environment: ${env.NODE_ENV}`)
		logger.info(`Port: ${env.PORT}`)

		// 初始化服务
		await initializeServices()

		// 创建 Express 应用
		const app = createApp()

		// 创建 HTTP 服务器
		const httpServer = createServer(app)

		// 初始化 Socket.IO 服务
		try {
			logger.info("Initializing Socket.IO...")
			const socketService = new SocketService()
			await socketService.initialize(httpServer)
			logger.info("✅ Socket.IO initialized successfully")

			// 将 socketService 存储到 app.locals 以便其他地方访问
			app.locals.socketService = socketService
		} catch (error) {
			logger.error("❌ Socket.IO initialization failed", { error })
			if (isProduction) {
				throw error
			}
		}

		// 初始化 SSE 服务
		try {
			logger.info("Initializing SSE...")
			await sseService.initialize()
			logger.info("✅ SSE initialized successfully")
		} catch (error) {
			logger.error("❌ SSE initialization failed", { error })
			if (isProduction) {
				throw error
			}
		}

		// 启动服务器
		httpServer.listen(env.PORT, () => {
			logger.info("=".repeat(60))
			logger.info("🎉 Server started successfully!")
			logger.info("=".repeat(60))
			logger.info(`📍 Address: http://localhost:${env.PORT}`)
			logger.info(`🌍 Environment: ${env.NODE_ENV}`)
			logger.info(`📡 API Base: http://localhost:${env.PORT}/api/v1`)
			logger.info("=".repeat(60))
			logger.info("Available endpoints:")
			logger.info(`  - Health Check: GET /health`)
			logger.info(`  - Ready Check: GET /ready`)
			logger.info(`  - API Info: GET /api`)
			logger.info(`  - Auth: /api/v1/auth`)
			logger.info(`  - Tasks: /api/v1/tasks`)
			logger.info(`  - Organizations: /api/v1/organizations`)
			logger.info(`  - Telemetry: /api/v1/telemetry`)
			logger.info(`  - Settings: /api/v1/settings`)
			logger.info(`  - Shares: /api/v1/shares`)
			logger.info(`  - SSE: /api/v1/sse`)
			logger.info("=".repeat(60))
		})

		// 优雅关闭处理
		const shutdown = async (signal: string) => {
			logger.info(`Received ${signal}, shutting down gracefully...`)

			// 关闭 HTTP 服务器
			httpServer.close(() => {
				logger.info("✅ HTTP server closed")
			})

			try {
				// 关闭 Socket.IO
				const socketService = app.locals.socketService
				if (socketService) {
					await socketService.close()
					logger.info("✅ Socket.IO closed")
				}

				// 关闭 SSE
				await sseService.close()
				logger.info("✅ SSE closed")

				logger.info("👋 Server shutdown complete")
				process.exit(0)
			} catch (error) {
				logger.error("❌ Error during shutdown", { error })
				process.exit(1)
			}
		}

		// 监听关闭信号
		process.on("SIGTERM", () => shutdown("SIGTERM"))
		process.on("SIGINT", () => shutdown("SIGINT"))

		// 未捕获的异常处理
		process.on("uncaughtException", (error) => {
			logger.error("❌ Uncaught Exception", {
				error: error.message,
				stack: error.stack,
			})
			shutdown("uncaughtException")
		})

		process.on("unhandledRejection", (reason, promise) => {
			logger.error("❌ Unhandled Rejection", {
				reason,
				promise,
			})
			shutdown("unhandledRejection")
		})
	} catch (error) {
		logger.error("❌ Failed to start server", { error })
		process.exit(1)
	}
}

// 启动服务器
startServer()
