import { AppDataSource } from "../config/database.js"

/**
 * 运行数据库迁移脚本
 * 用于在生产环境中自动执行迁移
 */
async function runMigrations(): Promise<void> {
	try {
		console.log("📦 正在初始化数据库连接...")
		await AppDataSource.initialize()
		console.log("✅ 数据库连接成功")

		console.log("🔄 开始运行迁移...")
		const migrations = await AppDataSource.runMigrations()

		if (migrations.length === 0) {
			console.log("ℹ️  没有需要运行的迁移")
		} else {
			console.log(`✅ 成功运行 ${migrations.length} 个迁移:`)
			migrations.forEach((migration) => {
				console.log(`   - ${migration.name}`)
			})
		}

		await AppDataSource.destroy()
		console.log("✅ 迁移完成，数据库连接已关闭")
		process.exit(0)
	} catch (error) {
		console.error("❌ 迁移失败:", error)
		if (AppDataSource.isInitialized) {
			await AppDataSource.destroy()
		}
		process.exit(1)
	}
}

// 执行迁移
runMigrations()
