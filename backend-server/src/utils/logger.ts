import winston from "winston"
import { env, isProduction } from "../config/env.js"

/**
 * 自定义日志格式
 */
const logFormat = winston.format.combine(
	winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
	winston.format.errors({ stack: true }),
	winston.format.splat(),
	winston.format.json(),
)

/**
 * 控制台输出格式（开发环境使用）
 */
const consoleFormat = winston.format.combine(
	winston.format.colorize(),
	winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
	winston.format.printf(({ timestamp, level, message, ...meta }) => {
		let msg = `${timestamp} [${level}]: ${message}`
		if (Object.keys(meta).length > 0) {
			msg += ` ${JSON.stringify(meta)}`
		}
		return msg
	}),
)

/**
 * 创建日志传输器
 */
const transports: winston.transport[] = [
	// 控制台输出
	new winston.transports.Console({
		format: isProduction ? logFormat : consoleFormat,
	}),
]

// 如果配置了日志文件路径，添加文件传输器
if (env.LOG_FILE_PATH) {
	// 错误日志文件
	transports.push(
		new winston.transports.File({
			filename: `${env.LOG_FILE_PATH}/error.log`,
			level: "error",
			format: logFormat,
			maxsize: 10 * 1024 * 1024, // 10MB
			maxFiles: 5,
		}),
	)

	// 综合日志文件
	transports.push(
		new winston.transports.File({
			filename: `${env.LOG_FILE_PATH}/combined.log`,
			format: logFormat,
			maxsize: 10 * 1024 * 1024, // 10MB
			maxFiles: 5,
		}),
	)
}

/**
 * 创建 Winston Logger 实例
 */
export const logger = winston.createLogger({
	level: env.LOG_LEVEL,
	format: logFormat,
	defaultMeta: { service: "backend-server" },
	transports,
	// 捕获未处理的异常和拒绝
	exceptionHandlers: [
		new winston.transports.Console({
			format: consoleFormat,
		}),
	],
	rejectionHandlers: [
		new winston.transports.Console({
			format: consoleFormat,
		}),
	],
})

/**
 * 日志辅助函数
 */
export const log = {
	error: (message: string, meta?: any) => logger.error(message, meta),
	warn: (message: string, meta?: any) => logger.warn(message, meta),
	info: (message: string, meta?: any) => logger.info(message, meta),
	debug: (message: string, meta?: any) => logger.debug(message, meta),
}

/**
 * 导出默认 logger
 */
export default logger
