import { config } from "dotenv"
import { z } from "zod"

// 加载 .env 文件
config()

/**
 * 环境变量 Schema
 */
const envSchema = z.object({
	// 服务器配置
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	PORT: z.string().transform(Number).pipe(z.number().int().positive()).default("3000"),
	API_URL: z.string().url().optional(),

	// 数据库配置
	DB_HOST: z.string().default("localhost"),
	DB_PORT: z.string().transform(Number).pipe(z.number().int().positive()).default("3306"),
	DB_NAME: z.string().default("roo_code"),
	DB_USER: z.string().default("app_user"),
	DB_PASSWORD: z.string().default("app_password"),
	DB_POOL_MIN: z.string().transform(Number).pipe(z.number().int().nonnegative()).default("2"),
	DB_POOL_MAX: z.string().transform(Number).pipe(z.number().int().positive()).default("10"),

	// Redis 配置
	REDIS_HOST: z.string().default("localhost"),
	REDIS_PORT: z.string().transform(Number).pipe(z.number().int().positive()).default("6379"),
	REDIS_PASSWORD: z.string().optional(),
	REDIS_DB: z.string().transform(Number).pipe(z.number().int().nonnegative()).default("0"),

	// JWT 配置
	JWT_SECRET: z.string().min(32).default("your-super-secret-jwt-key-change-in-production-min-32-chars"),
	JWT_EXPIRES_IN: z.string().default("1h"),
	JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

	// Socket.IO 配置
	SOCKET_CORS_ORIGIN: z.string().default("*"),

	// 日志配置
	LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
	LOG_FILE_PATH: z.string().optional(),
})

/**
 * 环境变量类型
 */
export type Env = z.infer<typeof envSchema>

/**
 * 验证并解析环境变量
 */
function validateEnv(): Env {
	try {
		return envSchema.parse(process.env)
	} catch (error) {
		if (error instanceof z.ZodError) {
			const missingVars = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n")

			console.error("❌ 环境变量验证失败:\n", missingVars)
			throw new Error("Invalid environment variables")
		}
		throw error
	}
}

/**
 * 导出验证后的环境变量
 */
export const env = validateEnv()

/**
 * 检查是否为生产环境
 */
export const isProduction = env.NODE_ENV === "production"

/**
 * 检查是否为开发环境
 */
export const isDevelopment = env.NODE_ENV === "development"

/**
 * 检查是否为测试环境
 */
export const isTest = env.NODE_ENV === "test"
