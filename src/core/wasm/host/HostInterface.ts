/**
 * Host Interface
 *
 * WASM模块和宿主环境（VSCode/Blender/Unreal/Unity）之间的通信桥梁
 * WASM模块无法直接访问外部资源，所有交互必须通过Host Interface
 */

import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { safeWriteJson } from "../../../utils/safeWriteJson"

/**
 * 文件系统操作接口
 */
export interface FileSystemHost {
	readFile(filePath: string): Promise<string>
	writeFile(filePath: string, content: string): Promise<void>
	deleteFile(filePath: string): Promise<void>
	fileExists(filePath: string): Promise<boolean>
	listFiles(dirPath: string): Promise<string[]>
	createDirectory(dirPath: string): Promise<void>
}

/**
 * 终端操作接口
 */
export interface TerminalHost {
	executeCommand(command: string, cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }>
	createTerminal(name: string): Promise<void>
	sendToTerminal(terminalId: string, text: string): Promise<void>
}

/**
 * UI操作接口
 */
export interface UIHost {
	showMessage(message: string, type: "info" | "warning" | "error"): Promise<void>
	showProgress(title: string, progress: number): Promise<void>
	askQuestion(question: string, options: string[]): Promise<string | undefined>
}

/**
 * 网络操作接口
 */
export interface NetworkHost {
	httpRequest(url: string, options: any): Promise<{ status: number; body: string; headers: any }>
}

/**
 * 配置操作接口
 */
export interface ConfigHost {
	getConfig(key: string): Promise<any>
	setConfig(key: string, value: any): Promise<void>
}

/**
 * 日志操作接口
 */
export interface LogHost {
	log(level: "debug" | "info" | "warn" | "error", message: string): void
}

/**
 * 向量数据库操作接口
 */
export interface VectorDBHost {
	search(query: string, limit: number): Promise<any[]>
	insert(id: string, vector: number[], metadata: any): Promise<void>
	delete(id: string): Promise<void>
}

/**
 * 完整的Host Interface
 */
export class HostInterface
	implements FileSystemHost, TerminalHost, UIHost, NetworkHost, ConfigHost, LogHost, VectorDBHost
{
	private workspaceRoot: string
	private outputChannel: vscode.OutputChannel

	constructor(workspaceRoot: string, outputChannel: vscode.OutputChannel) {
		this.workspaceRoot = workspaceRoot
		this.outputChannel = outputChannel
	}

	// ==================== 文件系统操作 ====================

	async readFile(filePath: string): Promise<string> {
		const fullPath = this.resolvePath(filePath)
		return await fs.readFile(fullPath, "utf-8")
	}

	async writeFile(filePath: string, content: string): Promise<void> {
		const fullPath = this.resolvePath(filePath)
		await fs.mkdir(path.dirname(fullPath), { recursive: true })
		await fs.writeFile(fullPath, content, "utf-8")
	}

	async deleteFile(filePath: string): Promise<void> {
		const fullPath = this.resolvePath(filePath)
		await fs.unlink(fullPath)
	}

	async fileExists(filePath: string): Promise<boolean> {
		try {
			const fullPath = this.resolvePath(filePath)
			await fs.access(fullPath)
			return true
		} catch {
			return false
		}
	}

	async listFiles(dirPath: string): Promise<string[]> {
		const fullPath = this.resolvePath(dirPath)
		return await fs.readdir(fullPath)
	}

	async createDirectory(dirPath: string): Promise<void> {
		const fullPath = this.resolvePath(dirPath)
		await fs.mkdir(fullPath, { recursive: true })
	}

	// ==================== 终端操作 ====================

	async executeCommand(command: string, cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
		const { exec } = require("child_process")
		const { promisify } = require("util")
		const execAsync = promisify(exec)

		try {
			const { stdout, stderr } = await execAsync(command, {
				cwd: cwd || this.workspaceRoot,
				maxBuffer: 10 * 1024 * 1024, // 10MB
			})
			return { stdout, stderr, exitCode: 0 }
		} catch (error: any) {
			return {
				stdout: error.stdout || "",
				stderr: error.stderr || error.message,
				exitCode: error.code || 1,
			}
		}
	}

	async createTerminal(name: string): Promise<void> {
		vscode.window.createTerminal({ name })
	}

	async sendToTerminal(terminalId: string, text: string): Promise<void> {
		const terminals = vscode.window.terminals
		const terminal = terminals.find((t) => t.name === terminalId)
		if (terminal) {
			terminal.sendText(text)
		} else {
			throw new Error(`Terminal not found: ${terminalId}`)
		}
	}

	// ==================== UI操作 ====================

	async showMessage(message: string, type: "info" | "warning" | "error"): Promise<void> {
		switch (type) {
			case "info":
				vscode.window.showInformationMessage(message)
				break
			case "warning":
				vscode.window.showWarningMessage(message)
				break
			case "error":
				vscode.window.showErrorMessage(message)
				break
		}
	}

	async showProgress(title: string, progress: number): Promise<void> {
		// VSCode progress API需要在withProgress中使用，这里简化处理
		this.log("info", `Progress: ${title} - ${progress}%`)
	}

	async askQuestion(question: string, options: string[]): Promise<string | undefined> {
		return await vscode.window.showQuickPick(options, {
			placeHolder: question,
		})
	}

	// ==================== 网络操作 ====================

	async httpRequest(url: string, options: any): Promise<{ status: number; body: string; headers: any }> {
		const https = require("https")
		const http = require("http")

		return new Promise((resolve, reject) => {
			const client = url.startsWith("https") ? https : http
			const req = client.request(url, options, (res: any) => {
				let body = ""
				res.on("data", (chunk: any) => {
					body += chunk
				})
				res.on("end", () => {
					resolve({
						status: res.statusCode,
						body,
						headers: res.headers,
					})
				})
			})
			req.on("error", reject)
			if (options.body) {
				req.write(options.body)
			}
			req.end()
		})
	}

	// ==================== 配置操作 ====================

	async getConfig(key: string): Promise<any> {
		const config = vscode.workspace.getConfiguration("roo-code")
		return config.get(key)
	}

	async setConfig(key: string, value: any): Promise<void> {
		const config = vscode.workspace.getConfiguration("roo-code")
		await config.update(key, value, vscode.ConfigurationTarget.Global)
	}

	// ==================== 日志操作 ====================

	log(level: "debug" | "info" | "warn" | "error", message: string): void {
		const timestamp = new Date().toISOString()
		const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`
		this.outputChannel.appendLine(logMessage)

		if (level === "error") {
			console.error(logMessage)
		} else if (level === "warn") {
			console.warn(logMessage)
		} else {
			console.log(logMessage)
		}
	}

	// ==================== 向量数据库操作 ====================

	async search(query: string, limit: number): Promise<any[]> {
		// TODO: 实现向量数据库搜索
		this.log("warn", "Vector DB search not implemented yet")
		return []
	}

	async insert(id: string, vector: number[], metadata: any): Promise<void> {
		// TODO: 实现向量数据库插入
		this.log("warn", "Vector DB insert not implemented yet")
	}

	async delete(id: string): Promise<void> {
		// TODO: 实现向量数据库删除
		this.log("warn", "Vector DB delete not implemented yet")
	}

	// ==================== 辅助方法 ====================

	private resolvePath(filePath: string): string {
		if (path.isAbsolute(filePath)) {
			return filePath
		}
		return path.join(this.workspaceRoot, filePath)
	}

	/**
	 * 写入JSON文件（使用原子化写入）
	 */
	async writeJson(filePath: string, data: any): Promise<void> {
		const fullPath = this.resolvePath(filePath)
		await safeWriteJson(fullPath, data)
	}

	/**
	 * 读取JSON文件
	 */
	async readJson(filePath: string): Promise<any> {
		const content = await this.readFile(filePath)
		return JSON.parse(content)
	}
}

/**
 * 创建Host Interface实例
 */
export function createHostInterface(): HostInterface {
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd()
	const outputChannel = vscode.window.createOutputChannel("Roo-Code WASM")
	return new HostInterface(workspaceRoot, outputChannel)
}
