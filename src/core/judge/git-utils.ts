import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

/**
 * Git 文件状态信息
 */
export interface GitFileStatus {
	path: string
	status: string // XY format from git status --porcelain=v1
	statusDescription: string
}

/**
 * Git 状态检查结果
 */
export interface GitStatusResult {
	hasChanges: boolean
	modifiedFiles: GitFileStatus[]
	summary: string
}

/**
 * 解析 git status --porcelain=v1 的状态码
 */
function parseGitStatus(statusCode: string): string {
	const descriptions: Record<string, string> = {
		M: "修改",
		A: "新增",
		D: "删除",
		R: "重命名",
		C: "复制",
		U: "未合并",
		"?": "未跟踪",
		"!": "忽略",
	}

	const [index, workTree] = statusCode.split("")
	const parts: string[] = []

	if (index && index !== " " && index !== "?") {
		parts.push(`暂存区${descriptions[index] || index}`)
	}
	if (workTree && workTree !== " ") {
		parts.push(`工作区${descriptions[workTree] || workTree}`)
	}

	return parts.length > 0 ? parts.join(", ") : "无变化"
}

/**
 * 检查 Git 工作目录的状态
 * @param cwd 工作目录路径
 * @returns Git 状态信息
 */
export async function checkGitStatus(cwd: string): Promise<GitStatusResult> {
	try {
		// 使用 --porcelain=v1 格式获取稳定的输出
		const { stdout } = await execAsync("git status --porcelain=v1", { cwd })

		if (!stdout.trim()) {
			return {
				hasChanges: false,
				modifiedFiles: [],
				summary: "工作目录干净，没有未提交的更改",
			}
		}

		const lines = stdout.trim().split("\n")
		const modifiedFiles: GitFileStatus[] = lines.map((line) => {
			// porcelain format: XY PATH or XY PATH -> RENAMED_PATH
			const statusCode = line.substring(0, 2)
			const filePath = line.substring(3).split(" -> ")[0].trim()

			return {
				path: filePath,
				status: statusCode,
				statusDescription: parseGitStatus(statusCode),
			}
		})

		const summary = formatGitStatus(modifiedFiles)

		return {
			hasChanges: true,
			modifiedFiles,
			summary,
		}
	} catch (error) {
		// Git 命令失败（可能不是 git 仓库，或 git 未安装）
		return {
			hasChanges: false,
			modifiedFiles: [],
			summary: `无法获取 Git 状态: ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}

/**
 * 格式化 Git 状态信息为可读的摘要
 */
export function formatGitStatus(files: GitFileStatus[]): string {
	if (files.length === 0) {
		return "没有文件改动"
	}

	const statusGroups: Record<string, string[]> = {}

	files.forEach((file) => {
		const desc = file.statusDescription
		if (!statusGroups[desc]) {
			statusGroups[desc] = []
		}
		statusGroups[desc].push(file.path)
	})

	const lines: string[] = []
	for (const [status, paths] of Object.entries(statusGroups)) {
		lines.push(`${status}: ${paths.length} 个文件`)
		paths.forEach((path) => {
			lines.push(`  - ${path}`)
		})
	}

	return lines.join("\n")
}
