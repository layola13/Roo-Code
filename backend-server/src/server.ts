import express, { Express } from "express"
import { createServer } from "http"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import rateLimit from "express-rate-limit"
import { env, isProduction } from "./config/env.js"
import { initializeRedis } from "./config/redis.js"
import { SocketService } from "./services/SocketService.js"
import { sseService } from "./services/SSEService.js"
import { logger } from "./utils/logger.js"

// Import routes
import { authRouter } from "./routes/auth.js"
import sseRoutes from "./routes/sse.routes.js"

/**
 * 创建 Express 应用
 */
function createApp(): Express {
	const app = express()

	// 安全中间件
	app.use(
		helmet({
			contentSecurityPolicy: isProduction ? undefined : false,
		}),
	)

	// CORS 配置
	app.use(
		cors({
			origin: env.SOCKET_CORS_ORIGIN,
			credentials: true,
		}),
	)

	// 压缩响应
	app.use(compression())

	// 请求体解析
	app.use(express.json({ limit: "10mb" }))
	app.use(express.urlencoded({ extended: true, limit: "10mb" }))

	// 速率限制
	const limiter = rateLimit({
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 100, // limit each IP to 100 requests per windowMs
		message: "Too many requests from this IP, please try again later.",
	})

	if (isProduction) {
		app.use("/api/", limiter)
	}

	// 请求日志
	app.use((req, _res, next) => {
		logger.debug("Incoming request", {
			method: req.method,
			path: req.path,
			ip: req.ip,
		})
		next()
	})

	// 健康检查端点
	app.get("/health", (_req, res) => {
		res.json({
			success: true,
			data: {
				status: "ok",
				timestamp: Date.now(),
				env: env.NODE_ENV,
			},
		})
	})

	// API 路由
	app.use("/api/auth", authRouter)
	app.use("/api/sse", sseRoutes)

	// TODO: Add other routes when they are implemented
	// app.use('/api/tasks', taskRoutes)
	// app.use('/api/organizations', organizationRoutes)
	// app.use('/api/telemetry', telemetryRoutes)
	// app.use('/api/settings', settingsRoutes)
	// app.use('/api/share', shareRoutes)

	// 404 处理
	app.use((_req, res) => {
		res.status(404).json({
			success: false,
			error: "Not Found",
		})
	})

	// 错误处理中间件
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		logger.error("Express error handler", {
			error: err.message,
			stack: err.stack,
		})

		res.status(err.status || 500).json({
			success: false,
			error: isProduction ? "Internal Server Error" : err.message,
			...(isProduction ? {} : { stack: err.stack }),
		})
	})

	return app
}

/**
 * 启动服务器
 */
async function startServer() {
	try {
		logger.info("Starting Roo Code Backend Server...")

		// 初始化 Redis
		logger.info("Initializing Redis...")
		await initializeRedis()

		// 创建 Express 应用
		const app = createApp()

		// 创建 HTTP 服务器
		const httpServer = createServer(app)

		// 初始化 Socket.IO 服务
		logger.info("Initializing Socket.IO...")
		const socketService = new SocketService()
		await socketService.initialize(httpServer)

		// 初始化 SSE 服务
		logger.info("Initializing SSE...")
		await sseService.initialize()

		// 启动服务器
		httpServer.listen(env.PORT, () => {
			logger.info("🚀 Server started successfully", {
				port: env.PORT,
				env: env.NODE_ENV,
				apiUrl: env.API_URL || `http://localhost:${env.PORT}`,
			})

			logger.info("Available endpoints:", {
				health: "/health",
				api: "/api",
				sse: "/api/sse",
			})
		})

		// 优雅关闭处理
		const shutdown = async (signal: string) => {
			logger.info(`Received ${signal}, shutting down gracefully...`)

			// 关闭 HTTP 服务器
			httpServer.close(() => {
				logger.info("HTTP server closed")
			})

			try {
				// 关闭 Socket.IO
				await socketService.close()
				logger.info("Socket.IO closed")

				// 关闭 SSE
				await sseService.close()
				logger.info("SSE closed")

				logger.info("Server shutdown complete")
				process.exit(0)
			} catch (error) {
				logger.error("Error during shutdown", { error })
				process.exit(1)
			}
		}

		// 监听关闭信号
		process.on("SIGTERM", () => shutdown("SIGTERM"))
		process.on("SIGINT", () => shutdown("SIGINT"))

		// 未捕获的异常处理
		process.on("uncaughtException", (error) => {
			logger.error("Uncaught Exception", {
				error: error.message,
				stack: error.stack,
			})
			shutdown("uncaughtException")
		})

		process.on("unhandledRejection", (reason, promise) => {
			logger.error("Unhandled Rejection", {
				reason,
				promise,
			})
			shutdown("unhandledRejection")
		})
	} catch (error) {
		logger.error("Failed to start server", { error })
		process.exit(1)
	}
}

// 启动服务器
startServer()
