import { NextRequest, NextResponse } from "next/server"
import { VSCodeConfigReader } from "@/lib/vscode-config-reader"

/**
 * GET /api/vscode-config
 * 读取VSCode插件的配置
 */
export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams
		const workspacePath = searchParams.get("workspacePath")

		const reader = new VSCodeConfigReader()
		const config = await reader.readConfig(workspacePath || undefined)

		// 获取存储路径用于调试
		const storagePath = reader.getStoragePath()

		return NextResponse.json({
			success: true,
			data: {
				config,
				storagePath,
				hasConfig: Object.keys(config).length > 0,
			},
		})
	} catch (error) {
		console.error("Error reading VSCode config:", error)
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		)
	}
}

/**
 * GET /api/vscode-config/current
 * 获取当前激活的API配置
 */
export async function POST(request: NextRequest) {
	try {
		const reader = new VSCodeConfigReader()
		const apiConfig = await reader.getCurrentApiConfig()

		return NextResponse.json({
			success: true,
			data: apiConfig,
		})
	} catch (error) {
		console.error("Error getting current API config:", error)
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		)
	}
}
