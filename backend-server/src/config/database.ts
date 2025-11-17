import { DataSource, DataSourceOptions } from "typeorm"
import { env, isProduction } from "./env.js"

// 导入所有实体
import { User } from "../entities/User.js"
import { Organization } from "../entities/Organization.js"
import { OrganizationMembership } from "../entities/OrganizationMembership.js"
import { Task } from "../entities/Task.js"
import { TaskMessage } from "../entities/TaskMessage.js"
import { Share } from "../entities/Share.js"
import { TelemetryEvent } from "../entities/TelemetryEvent.js"

/**
 * TypeORM DataSource 配置
 */
export const dataSourceOptions: DataSourceOptions = {
	type: "mysql",
	host: env.DB_HOST,
	port: env.DB_PORT,
	username: env.DB_USER,
	password: env.DB_PASSWORD,
	database: env.DB_NAME,

	// 实体
	entities: [User, Organization, OrganizationMembership, Task, TaskMessage, Share, TelemetryEvent],

	// 连接池配置
	poolSize: env.DB_POOL_MAX,
	extra: {
		min: env.DB_POOL_MIN,
		max: env.DB_POOL_MAX,
		// 连接超时（毫秒）
		connectTimeout: 10000,
		// 空闲连接超时（毫秒）
		idleTimeoutMillis: 30000,
	},

	// 同步配置（生产环境禁用）
	synchronize: !isProduction,

	// 日志配置
	logging: env.LOG_LEVEL === "debug" ? ["query", "error"] : ["error"],

	// 迁移配置
	migrations: ["src/migrations/**/*.ts"],
	migrationsTableName: "migrations",

	// 字符集
	charset: "utf8mb4",

	// 时区
	timezone: "Z",
}

/**
 * 创建 DataSource 实例
 */
export const AppDataSource = new DataSource(dataSourceOptions)

/**
 * 初始化数据库连接
 */
export async function initializeDatabase(): Promise<DataSource> {
	try {
		if (!AppDataSource.isInitialized) {
			await AppDataSource.initialize()
			console.log("✅ 数据库连接成功")
		}
		return AppDataSource
	} catch (error) {
		console.error("❌ 数据库连接失败:", error)
		throw error
	}
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
	try {
		if (AppDataSource.isInitialized) {
			await AppDataSource.destroy()
			console.log("✅ 数据库连接已关闭")
		}
	} catch (error) {
		console.error("❌ 关闭数据库连接失败:", error)
		throw error
	}
}

/**
 * 检查数据库连接状态
 */
export function isDatabaseConnected(): boolean {
	return AppDataSource.isInitialized
}
