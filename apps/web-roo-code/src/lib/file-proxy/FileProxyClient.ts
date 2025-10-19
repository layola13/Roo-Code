/**
 * 文件代理客户端
 *
 * Web 端无法直接访问文件系统，需要通过代理服务
 *
 * 支持的方案：
 * 1. GitHub API (公共仓库)
 * 2. Workspace API (用户授权的私有仓库)
 * 3. 本地 VSCode 桥接 (通过 BridgeOrchestrator)
 */

export interface FileProxyConfig {
	apiEndpoint: string
	authToken?: string
	mode?: "github" | "bridge" | "workspace"
}

export interface FileInfo {
	path: string
	type: "file" | "directory"
	size?: number
	content?: string
}

/**
 * 文件代理客户端
 * 提供统一的文件系统访问接口
 */
export class FileProxyClient {
	private apiEndpoint: string
	private authToken?: string
	private mode: "github" | "bridge" | "workspace"

	constructor(config: FileProxyConfig) {
		this.apiEndpoint = config.apiEndpoint
		this.authToken = config.authToken
		this.mode = config.mode || "github"
	}

	/**
	 * 读取文件内容
	 */
	async readFile(path: string): Promise<string> {
		try {
			const response = await fetch(`${this.apiEndpoint}/files/read`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				credentials: "include",
				body: JSON.stringify({
					path,
					mode: this.mode,
				}),
			})

			if (!response.ok) {
				throw new Error(`Failed to read file: ${path} - ${response.statusText}`)
			}

			const data = await response.json()
			return data.content
		} catch (error) {
			console.error(`[FileProxyClient] Error reading file ${path}:`, error)
			throw error
		}
	}

	/**
	 * 写入文件内容
	 */
	async writeFile(path: string, content: string): Promise<void> {
		try {
			const response = await fetch(`${this.apiEndpoint}/files/write`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				credentials: "include",
				body: JSON.stringify({
					path,
					content,
					mode: this.mode,
				}),
			})

			if (!response.ok) {
				throw new Error(`Failed to write file: ${path} - ${response.statusText}`)
			}
		} catch (error) {
			console.error(`[FileProxyClient] Error writing file ${path}:`, error)
			throw error
		}
	}

	/**
	 * 列出目录文件
	 */
	async listFiles(path: string, recursive: boolean = false): Promise<FileInfo[]> {
		try {
			const response = await fetch(
				`${this.apiEndpoint}/files/list?path=${encodeURIComponent(path)}&recursive=${recursive}&mode=${this.mode}`,
				{
					headers: {
						...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
					},
					credentials: "include",
				},
			)

			if (!response.ok) {
				throw new Error(`Failed to list files: ${path} - ${response.statusText}`)
			}

			const data = await response.json()
			return data.files
		} catch (error) {
			console.error(`[FileProxyClient] Error listing files ${path}:`, error)
			throw error
		}
	}

	/**
	 * 检查文件是否存在
	 */
	async fileExists(path: string): Promise<boolean> {
		try {
			const response = await fetch(
				`${this.apiEndpoint}/files/exists?path=${encodeURIComponent(path)}&mode=${this.mode}`,
				{
					headers: {
						...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
					},
					credentials: "include",
				},
			)

			if (!response.ok) {
				return false
			}

			const data = await response.json()
			return data.exists
		} catch (error) {
			console.error(`[FileProxyClient] Error checking file existence ${path}:`, error)
			return false
		}
	}

	/**
	 * 删除文件
	 */
	async deleteFile(path: string): Promise<void> {
		try {
			const response = await fetch(`${this.apiEndpoint}/files/delete`, {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				credentials: "include",
				body: JSON.stringify({
					path,
					mode: this.mode,
				}),
			})

			if (!response.ok) {
				throw new Error(`Failed to delete file: ${path} - ${response.statusText}`)
			}
		} catch (error) {
			console.error(`[FileProxyClient] Error deleting file ${path}:`, error)
			throw error
		}
	}

	/**
	 * 创建目录
	 */
	async createDirectory(path: string): Promise<void> {
		try {
			const response = await fetch(`${this.apiEndpoint}/files/mkdir`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				credentials: "include",
				body: JSON.stringify({
					path,
					mode: this.mode,
				}),
			})

			if (!response.ok) {
				throw new Error(`Failed to create directory: ${path} - ${response.statusText}`)
			}
		} catch (error) {
			console.error(`[FileProxyClient] Error creating directory ${path}:`, error)
			throw error
		}
	}

	/**
	 * 搜索文件
	 */
	async searchFiles(pattern: string, directory: string = "."): Promise<FileInfo[]> {
		try {
			const response = await fetch(`${this.apiEndpoint}/files/search`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				credentials: "include",
				body: JSON.stringify({
					pattern,
					directory,
					mode: this.mode,
				}),
			})

			if (!response.ok) {
				throw new Error(`Failed to search files: ${pattern} - ${response.statusText}`)
			}

			const data = await response.json()
			return data.results
		} catch (error) {
			console.error(`[FileProxyClient] Error searching files with pattern ${pattern}:`, error)
			throw error
		}
	}

	/**
	 * 设置访问模式
	 */
	setMode(mode: "github" | "bridge" | "workspace"): void {
		this.mode = mode
	}

	/**
	 * 获取当前访问模式
	 */
	getMode(): "github" | "bridge" | "workspace" {
		return this.mode
	}

	/**
	 * 设置认证令牌
	 */
	setAuthToken(token: string): void {
		this.authToken = token
	}

	/**
	 * 批量读取文件
	 */
	async readFiles(paths: string[]): Promise<Map<string, string>> {
		const results = new Map<string, string>()

		try {
			const response = await fetch(`${this.apiEndpoint}/files/batch-read`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				credentials: "include",
				body: JSON.stringify({
					paths,
					mode: this.mode,
				}),
			})

			if (!response.ok) {
				throw new Error(`Failed to batch read files - ${response.statusText}`)
			}

			const data = await response.json()

			for (const [path, content] of Object.entries(data.files)) {
				results.set(path, content as string)
			}

			return results
		} catch (error) {
			console.error("[FileProxyClient] Error batch reading files:", error)
			throw error
		}
	}

	/**
	 * 批量写入文件
	 */
	async writeFiles(files: Map<string, string>): Promise<void> {
		try {
			const filesObject = Object.fromEntries(files)

			const response = await fetch(`${this.apiEndpoint}/files/batch-write`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
				},
				credentials: "include",
				body: JSON.stringify({
					files: filesObject,
					mode: this.mode,
				}),
			})

			if (!response.ok) {
				throw new Error(`Failed to batch write files - ${response.statusText}`)
			}
		} catch (error) {
			console.error("[FileProxyClient] Error batch writing files:", error)
			throw error
		}
	}
}
