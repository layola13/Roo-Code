/**
 * 文件读取 API
 *
 * 支持三种模式：
 * 1. GitHub API (公共仓库)
 * 2. GitHub 私有仓库（用户授权）
 * 3. 本地 VSCode 桥接
 */

import { NextRequest, NextResponse } from "next/server"
import { Octokit } from "@octokit/rest"

interface ReadFileRequest {
	path: string
	mode?: "github" | "bridge" | "workspace"
	repo?: string
	owner?: string
}

/**
 * POST /api/files/read - 读取文件内容
 */
export async function POST(request: NextRequest) {
	try {
		const body: ReadFileRequest = await request.json()
		const { path, mode = "github", repo, owner } = body

		if (!path) {
			return NextResponse.json({ error: "Missing required field: path" }, { status: 400 })
		}

		if (mode === "github") {
			// 使用 GitHub API
			if (!repo || !owner) {
				return NextResponse.json(
					{ error: "Missing required fields for GitHub mode: repo, owner" },
					{ status: 400 },
				)
			}

			// TODO: 从 session 或 auth header 获取 token
			const githubToken = request.headers.get("x-github-token")

			const octokit = new Octokit({
				auth: githubToken,
			})

			try {
				const { data } = await octokit.repos.getContent({
					owner,
					repo,
					path,
				})

				if ("content" in data) {
					const content = Buffer.from(data.content, "base64").toString("utf-8")
					return NextResponse.json({ content, path, mode })
				} else {
					return NextResponse.json({ error: "Path is a directory, not a file" }, { status: 400 })
				}
			} catch (error) {
				console.error("[POST /api/files/read] GitHub API error:", error)
				return NextResponse.json({ error: "File not found or access denied" }, { status: 404 })
			}
		} else if (mode === "bridge") {
			// 通过 BridgeOrchestrator 访问本地 VSCode
			// TODO: 实现 Bridge 模式
			return NextResponse.json({ error: "Bridge mode not yet implemented" }, { status: 501 })
		} else if (mode === "workspace") {
			// 使用浏览器原生 File System Access API
			// 注意：这个模式需要前端处理，后端只能返回指令
			return NextResponse.json({ error: "Workspace mode must be handled client-side" }, { status: 400 })
		}

		return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
	} catch (error) {
		console.error("[POST /api/files/read] Error:", error)
		return NextResponse.json({ error: "Failed to read file" }, { status: 500 })
	}
}
