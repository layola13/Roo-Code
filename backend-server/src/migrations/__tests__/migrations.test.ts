import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { DataSource } from "typeorm"
import { dataSourceOptions } from "../../config/database.js"

describe("数据库迁移测试", () => {
	let testDataSource: DataSource

	beforeAll(async () => {
		// 创建测试数据源（使用内存数据库或测试数据库）
		testDataSource = new DataSource({
			...dataSourceOptions,
			// 在测试环境中使用独立的数据库
			database: `${dataSourceOptions.database}_test_${Date.now()}`,
			synchronize: false, // 禁用自动同步，使用迁移
			logging: false, // 禁用日志输出
		})

		await testDataSource.initialize()
	})

	afterAll(async () => {
		if (testDataSource?.isInitialized) {
			// 清理测试数据库
			await testDataSource.query(`DROP DATABASE IF EXISTS \`${testDataSource.options.database}\``)
			await testDataSource.destroy()
		}
	})

	it("应该成功运行所有迁移 (up)", async () => {
		// 执行所有迁移
		const migrations = await testDataSource.runMigrations()

		// 验证迁移已运行
		expect(migrations).toBeDefined()
		expect(migrations.length).toBeGreaterThan(0)

		// 验证迁移表已创建
		const migrationTable = await testDataSource.query("SELECT COUNT(*) as count FROM migrations")
		expect(migrationTable[0].count).toBeGreaterThan(0)

		// 验证所有表已创建
		const tables = await testDataSource.query(
			`SELECT table_name FROM information_schema.tables 
			 WHERE table_schema = DATABASE() 
			 AND table_type = 'BASE TABLE'
			 AND table_name != 'migrations'`,
		)

		const tableNames = tables.map((t: any) => t.TABLE_NAME || t.table_name)

		expect(tableNames).toContain("users")
		expect(tableNames).toContain("organizations")
		expect(tableNames).toContain("organization_memberships")
		expect(tableNames).toContain("tasks")
		expect(tableNames).toContain("task_messages")
		expect(tableNames).toContain("shares")
		expect(tableNames).toContain("telemetry_events")
	})

	it("应该验证 users 表结构", async () => {
		const columns = await testDataSource.query(
			`SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY 
			 FROM information_schema.COLUMNS 
			 WHERE TABLE_SCHEMA = DATABASE() 
			 AND TABLE_NAME = 'users'`,
		)

		const columnNames = columns.map((c: any) => c.COLUMN_NAME || c.column_name)

		expect(columnNames).toContain("id")
		expect(columnNames).toContain("email")
		expect(columnNames).toContain("password_hash")
		expect(columnNames).toContain("name")
		expect(columnNames).toContain("settings")
		expect(columnNames).toContain("created_at")
		expect(columnNames).toContain("updated_at")
	})

	it("应该验证 organizations 表结构", async () => {
		const columns = await testDataSource.query(
			`SELECT COLUMN_NAME FROM information_schema.COLUMNS 
			 WHERE TABLE_SCHEMA = DATABASE() 
			 AND TABLE_NAME = 'organizations'`,
		)

		const columnNames = columns.map((c: any) => c.COLUMN_NAME || c.column_name)

		expect(columnNames).toContain("id")
		expect(columnNames).toContain("name")
		expect(columnNames).toContain("settings")
		expect(columnNames).toContain("created_at")
		expect(columnNames).toContain("updated_at")
	})

	it("应该验证 organization_memberships 表结构和外键", async () => {
		const columns = await testDataSource.query(
			`SELECT COLUMN_NAME FROM information_schema.COLUMNS 
			 WHERE TABLE_SCHEMA = DATABASE() 
			 AND TABLE_NAME = 'organization_memberships'`,
		)

		const columnNames = columns.map((c: any) => c.COLUMN_NAME || c.column_name)

		expect(columnNames).toContain("id")
		expect(columnNames).toContain("user_id")
		expect(columnNames).toContain("organization_id")
		expect(columnNames).toContain("role")
		expect(columnNames).toContain("joined_at")

		// 验证外键约束
		const foreignKeys = await testDataSource.query(
			`SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME 
			 FROM information_schema.KEY_COLUMN_USAGE 
			 WHERE TABLE_SCHEMA = DATABASE() 
			 AND TABLE_NAME = 'organization_memberships'
			 AND REFERENCED_TABLE_NAME IS NOT NULL`,
		)

		expect(foreignKeys.length).toBeGreaterThanOrEqual(2) // 至少有两个外键
	})

	it("应该验证 tasks 表结构和索引", async () => {
		const columns = await testDataSource.query(
			`SELECT COLUMN_NAME FROM information_schema.COLUMNS 
			 WHERE TABLE_SCHEMA = DATABASE() 
			 AND TABLE_NAME = 'tasks'`,
		)

		const columnNames = columns.map((c: any) => c.COLUMN_NAME || c.column_name)

		expect(columnNames).toContain("id")
		expect(columnNames).toContain("user_id")
		expect(columnNames).toContain("organization_id")
		expect(columnNames).toContain("metadata")
		expect(columnNames).toContain("created_at")
		expect(columnNames).toContain("updated_at")

		// 验证索引
		const indexes = await testDataSource.query(
			`SELECT INDEX_NAME FROM information_schema.STATISTICS 
			 WHERE TABLE_SCHEMA = DATABASE() 
			 AND TABLE_NAME = 'tasks'`,
		)

		const indexNames = indexes.map((i: any) => i.INDEX_NAME || i.index_name)
		expect(indexNames.length).toBeGreaterThan(0)
	})

	it("应该验证 task_messages 表结构", async () => {
		const columns = await testDataSource.query(
			`SELECT COLUMN_NAME FROM information_schema.COLUMNS 
			 WHERE TABLE_SCHEMA = DATABASE() 
			 AND TABLE_NAME = 'task_messages'`,
		)

		const columnNames = columns.map((c: any) => c.COLUMN_NAME || c.column_name)

		expect(columnNames).toContain("id")
		expect(columnNames).toContain("task_id")
		expect(columnNames).toContain("type")
		expect(columnNames).toContain("content")
		expect(columnNames).toContain("timestamp")
	})

	it("应该验证 shares 表结构", async () => {
		const columns = await testDataSource.query(
			`SELECT COLUMN_NAME FROM information_schema.COLUMNS 
			 WHERE TABLE_SCHEMA = DATABASE() 
			 AND TABLE_NAME = 'shares'`,
		)

		const columnNames = columns.map((c: any) => c.COLUMN_NAME || c.column_name)

		expect(columnNames).toContain("id")
		expect(columnNames).toContain("task_id")
		expect(columnNames).toContain("share_url")
		expect(columnNames).toContain("visibility")
		expect(columnNames).toContain("created_by")
		expect(columnNames).toContain("created_at")
	})

	it("应该验证 telemetry_events 表结构", async () => {
		const columns = await testDataSource.query(
			`SELECT COLUMN_NAME FROM information_schema.COLUMNS 
			 WHERE TABLE_SCHEMA = DATABASE() 
			 AND TABLE_NAME = 'telemetry_events'`,
		)

		const columnNames = columns.map((c: any) => c.COLUMN_NAME || c.column_name)

		expect(columnNames).toContain("id")
		expect(columnNames).toContain("user_id")
		expect(columnNames).toContain("organization_id")
		expect(columnNames).toContain("event_type")
		expect(columnNames).toContain("event_data")
		expect(columnNames).toContain("timestamp")
	})

	it("应该成功回滚所有迁移 (down)", async () => {
		// 回滚所有迁移
		await testDataSource.undoLastMigration()

		// 验证表已删除（除了 migrations 表）
		const tables = await testDataSource.query(
			`SELECT table_name FROM information_schema.tables 
			 WHERE table_schema = DATABASE() 
			 AND table_type = 'BASE TABLE'
			 AND table_name != 'migrations'`,
		)

		// 回滚后应该没有业务表（只剩 migrations 表）
		expect(tables.length).toBe(0)
	})

	it("应该能够重新运行迁移", async () => {
		// 重新运行迁移
		const migrations = await testDataSource.runMigrations()

		expect(migrations).toBeDefined()
		expect(migrations.length).toBeGreaterThan(0)

		// 验证表重新创建
		const tables = await testDataSource.query(
			`SELECT table_name FROM information_schema.tables 
			 WHERE table_schema = DATABASE() 
			 AND table_type = 'BASE TABLE'
			 AND table_name != 'migrations'`,
		)

		expect(tables.length).toBeGreaterThan(0)
	})
})
