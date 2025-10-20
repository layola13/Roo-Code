import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

/**
 * GET /api/files/list - 列出目录文件
 * 支持GitHub API模式
 */
export async function GET(request: NextRequest) {
	try {
		const session = await getServerSession(authOptions)

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		const searchParams = request.nextUrl.searchParams
		const path = searchParams.get("path") || "/"
		const recursive = searchParams.get("recursive") === "true"

		// TODO: 实现GitHub API列表逻辑
		// 这里返回模拟数据
		return NextResponse.json({
			success: true,
			path,
			recursive,
			files: ["README.md", "package.json", "src/index.ts", "src/app.ts"],
		})
	} catch (error) {
		console.error("File list error:", error)
		return NextResponse.json({ error: "Failed to list files" }, { status: 500 })
	}
}
