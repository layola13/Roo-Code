#!/usr/bin/env tsx
/**
 * Web版Roo-Code功能验证脚本
 *
 * 根据 docs/50-web-version-technical-evaluation.md 验证所有实现
 */

import { readFileSync, existsSync } from "fs"
import { join } from "path"

interface VerificationResult {
	category: string
	item: string
	status: "PASS" | "FAIL" | "PARTIAL" | "NOT_IMPLEMENTED"
	details?: string
}

const results: VerificationResult[] = []

function verify(category: string, item: string, check: () => boolean, details?: string): void {
	const status = check() ? "PASS" : "FAIL"
	results.push({ category, item, status, details })
}

function fileExists(path: string): boolean {
	return existsSync(join(process.cwd(), path))
}

function hasContent(path: string, searchStrings: string[]): boolean {
	if (!fileExists(path)) return false
	const content = readFileSync(join(process.cwd(), path), "utf-8")
	return searchStrings.every((str) => content.includes(str))
}

console.log("🔍 开始验证Web版Roo-Code实现...\n")

// ========================================
// 1. 基础设施验证 (Phase 1)
// ========================================
console.log("📦 Phase 1: 基础设施")

verify("基础设施", "Next.js项目结构", () => fileExists("package.json") && fileExists("next.config.ts"))

verify("基础设施", "TypeScript配置", () => fileExists("tsconfig.json"))

verify(
	"基础设施",
	"Prisma数据库Schema",
	() => fileExists("prisma/schema.prisma") && hasContent("prisma/schema.prisma", ["User", "Task", "Session"]),
)

verify(
	"基础设施",
	"NextAuth认证配置",
	() => fileExists("src/lib/auth.ts") && fileExists("src/app/api/auth/[...nextauth]/route.ts"),
)

verify("基础设施", "环境变量配置", () => fileExists(".env.example"))

// ========================================
// 2. API Routes验证 (Phase 1)
// ========================================
console.log("\n🔌 API Routes")

const apiRoutes = [
	"src/app/api/tasks/route.ts",
	"src/app/api/tasks/[taskId]/route.ts",
	"src/app/api/files/read/route.ts",
	"src/app/api/files/write/route.ts",
	"src/app/api/files/list/route.ts",
	"app/api/vscode-config/route.ts",
	"src/app/api/settings/route.ts",
	"src/app/api/auth/register/route.ts",
]

apiRoutes.forEach((route) => {
	verify("API Routes", route.replace("src/app/api/", "/api/"), () => fileExists(route))
})

// ========================================
// 3. 核心类实现验证 (Phase 2)
// ========================================
console.log("\n⚙️ 核心类实现")

verify(
	"核心类",
	"WebTaskProvider",
	() =>
		fileExists("src/lib/providers/WebTaskProvider.ts") &&
		hasContent("src/lib/providers/WebTaskProvider.ts", ["createTask", "cancelTask"]),
)

verify(
	"核心类",
	"WebConfigManager",
	() =>
		fileExists("src/lib/config/WebConfigManager.ts") &&
		hasContent("src/lib/config/WebConfigManager.ts", ["getSettings", "saveSettings"]),
)

verify(
	"核心类",
	"FileProxyClient",
	() =>
		fileExists("src/lib/file-proxy/FileProxyClient.ts") &&
		hasContent("src/lib/file-proxy/FileProxyClient.ts", ["readFile", "writeFile", "listFiles"]),
)

verify(
	"核心类",
	"BackgroundTaskScheduler",
	() =>
		fileExists("src/lib/scheduler/BackgroundTaskScheduler.ts") &&
		hasContent("src/lib/scheduler/BackgroundTaskScheduler.ts", ["submitTask", "resumeTask"]),
)

// ========================================
// 4. 前端组件验证 (Phase 2)
// ========================================
console.log("\n🎨 前端组件")

verify("前端组件", "ChatView主组件", () => fileExists("src/components/chat/ChatView.tsx"))

const chatComponents = ["ChatTextArea", "TaskHeader", "SettingsPanel", "Markdown", "CodeBlock"]

chatComponents.forEach((component) => {
	verify("前端组件", component, () => fileExists(`src/components/chat/${component}.tsx`))
})

// ========================================
// 5. 配置同步验证 (Phase 3)
// ========================================
console.log("\n🔄 配置同步")

verify(
	"配置同步",
	"VSCode配置读取器",
	() => fileExists("lib/vscode-config-reader.ts") && hasContent("lib/vscode-config-reader.ts", ["readVSCodeConfig"]),
)

verify(
	"配置同步",
	"Web配置同步客户端",
	() => fileExists("src/lib/vscode-sync-client.ts") && hasContent("src/lib/vscode-sync-client.ts", ["syncConfig"]),
)

verify("配置同步", "配置同步文档", () => fileExists("docs/VSCODE-CONFIG-SYNC.md"))

// ========================================
// 6. 数据库和认证验证
// ========================================
console.log("\n🔐 数据库和认证")

verify(
	"数据库",
	"Prisma Client配置",
	() => fileExists("src/lib/prisma.ts") && hasContent("src/lib/prisma.ts", ["PrismaClient"]),
)

verify("认证", "登录页面", () => fileExists("src/app/auth/signin/page.tsx"))

verify("认证", "注册页面", () => fileExists("src/app/auth/signup/page.tsx"))

// ========================================
// 7. 工具类和Utils验证
// ========================================
console.log("\n🛠️ 工具类")

verify("工具类", "图片处理工具", () => fileExists("src/lib/utils/imageUtils.ts"))

verify(
	"工具类",
	"类型定义",
	() => fileExists("src/types/ExtensionMessage.ts") && fileExists("src/types/settings-extension.ts"),
)

// ========================================
// 8. UI组件库验证
// ========================================
console.log("\n🎭 UI组件库")

const uiComponents = ["button", "dialog", "table", "chart"]

uiComponents.forEach((component) => {
	verify("UI组件", component, () => fileExists(`src/components/ui/${component}.tsx`))
})

// ========================================
// 9. 页面路由验证
// ========================================
console.log("\n📄 页面路由")

const pages = ["src/app/page.tsx", "src/app/chat/page.tsx", "src/app/evals/plot.tsx", "app/config-test/page.tsx"]

pages.forEach((page) => {
	verify("页面路由", page.replace("src/app/", "/").replace("app/", "/"), () => fileExists(page))
})

// ========================================
// 10. 生产环境部署配置验证
// ========================================
console.log("\n🚀 部署配置")

verify("部署配置", "Next.js配置", () => hasContent("next.config.ts", ["experimental"]))

verify(
	"部署配置",
	"Docker配置",
	() => fileExists("Dockerfile") || fileExists("docker-compose.yml"),
	"生产环境Docker配置（可选）",
)

// ========================================
// 输出结果
// ========================================
console.log("\n" + "=".repeat(60))
console.log("📊 验证结果统计\n")

const stats = {
	PASS: results.filter((r) => r.status === "PASS").length,
	FAIL: results.filter((r) => r.status === "FAIL").length,
	PARTIAL: results.filter((r) => r.status === "PARTIAL").length,
	NOT_IMPLEMENTED: results.filter((r) => r.status === "NOT_IMPLEMENTED").length,
	TOTAL: results.length,
}

console.log(`✅ 通过: ${stats.PASS}/${stats.TOTAL}`)
console.log(`❌ 失败: ${stats.FAIL}/${stats.TOTAL}`)
console.log(`⚠️  部分实现: ${stats.PARTIAL}/${stats.TOTAL}`)
console.log(`⏸️  未实现: ${stats.NOT_IMPLEMENTED}/${stats.TOTAL}`)

const passRate = ((stats.PASS / stats.TOTAL) * 100).toFixed(1)
console.log(`\n📈 通过率: ${passRate}%`)

// 按分类显示详细结果
console.log("\n" + "=".repeat(60))
console.log("📋 详细结果\n")

const categories = [...new Set(results.map((r) => r.category))]
categories.forEach((category) => {
	console.log(`\n【${category}】`)
	const categoryResults = results.filter((r) => r.category === category)
	categoryResults.forEach((r) => {
		const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : r.status === "PARTIAL" ? "⚠️" : "⏸️"
		console.log(`  ${icon} ${r.item}${r.details ? ` - ${r.details}` : ""}`)
	})
})

// 失败项目详情
if (stats.FAIL > 0) {
	console.log("\n" + "=".repeat(60))
	console.log("⚠️  需要修复的项目:\n")
	results
		.filter((r) => r.status === "FAIL")
		.forEach((r) => {
			console.log(`  ❌ ${r.category} - ${r.item}`)
			if (r.details) console.log(`     ${r.details}`)
		})
}

// 总结和建议
console.log("\n" + "=".repeat(60))
console.log("💡 总结和建议\n")

if (passRate >= 90) {
	console.log("✅ 实现质量优秀！大部分功能已完成。")
} else if (passRate >= 70) {
	console.log("⚠️  实现基本完成，但还有一些功能需要补充。")
} else {
	console.log("❌ 实现进度不足，需要继续完善。")
}

console.log("\n根据文档 docs/50-web-version-technical-evaluation.md 的要求:")
console.log("  1. ✅ Phase 1 (基础设施) - 预期完成")
console.log("  2. ✅ Phase 2 (核心功能) - 预期完成")
console.log("  3. ✅ Phase 3 (配置同步) - 预期完成")
console.log("  4. ⚠️  Phase 4 (后台运行) - 部分完成")
console.log("  5. ⏸️  Phase 5 (测试优化) - 待开始")

console.log("\n下一步行动:")
console.log("  1. 修复所有失败的验证项")
console.log("  2. 编写自动化测试")
console.log("  3. 进行端到端功能测试")
console.log("  4. 性能优化和压力测试")
console.log("  5. 准备生产环境部署")

console.log("\n" + "=".repeat(60))

// 返回退出码
process.exit(stats.FAIL > 0 ? 1 : 0)
