/**
 * Host Interface Implementation for WASM
 *
 * This module provides the TypeScript implementation of the Host Interface
 * that the Rust WASM module calls to interact with the VSCode environment.
 *
 * 22 Interface Functions:
 * - File System (7): readFile, writeFile, fileExists, listDir, createDir, deleteFile, getFileMetadata
 * - Terminal (3): executeCommand, getTerminalOutput, killProcess
 * - UI (4): showNotification, askApproval, askInput, showError
 * - Network (2): httpRequest, httpStream
 * - Config (2): getConfig, setConfig
 * - Vector DB (2): vectorSearch, vectorInsert
 */

import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { ExecException, exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

// ============================================================================
// Type Definitions
// ============================================================================

export interface FileMetadata {
	size: number
	created: number
	modified: number
	isDirectory: boolean
	isFile: boolean
	permissions: string
}

export interface HttpConfig {
	method: string
	headers?: Record<string, string>
	body?: string
	timeout?: number
}

export interface HttpResponse {
	status: number
	headers: Record<string, string>
	body: string
}

export interface VectorSearchParams {
	collection: string
	query: number[]
	limit: number
	filter?: Record<string, any>
}

export interface VectorInsertParams {
	collection: string
	id: string
	vector: number[]
	metadata?: Record<string, any>
}

// ============================================================================
// Host Interface Implementation
// ============================================================================

export class HostInterface {
	private processMap: Map<string, any> = new Map()
	private outputChannels: Map<string, vscode.OutputChannel> = new Map()

	// ========================================================================
	// File System Operations (7 functions)
	// ========================================================================

	/**
	 * Read file contents
	 * @param filePath Absolute or workspace-relative path
	 * @returns File contents as string
	 */
	async readFile(filePath: string): Promise<string> {
		try {
			const absolutePath = this.resolveWorkspacePath(filePath)
			const content = await fs.readFile(absolutePath, "utf-8")
			return content
		} catch (error) {
			throw new Error(`Failed to read file ${filePath}: ${error}`)
		}
	}

	/**
	 * Write file contents
	 * @param filePath Absolute or workspace-relative path
	 * @param content File content to write
	 */
	async writeFile(filePath: string, content: string): Promise<void> {
		try {
			const absolutePath = this.resolveWorkspacePath(filePath)
			const dir = path.dirname(absolutePath)

			// Ensure directory exists
			await fs.mkdir(dir, { recursive: true })
			await fs.writeFile(absolutePath, content, "utf-8")
		} catch (error) {
			throw new Error(`Failed to write file ${filePath}: ${error}`)
		}
	}

	/**
	 * Check if file exists
	 * @param filePath Absolute or workspace-relative path
	 * @returns true if file exists
	 */
	async fileExists(filePath: string): Promise<boolean> {
		try {
			const absolutePath = this.resolveWorkspacePath(filePath)
			await fs.access(absolutePath)
			return true
		} catch {
			return false
		}
	}

	/**
	 * List directory contents
	 * @param dirPath Directory path
	 * @returns Array of file/directory names
	 */
	async listDir(dirPath: string): Promise<string[]> {
		try {
			const absolutePath = this.resolveWorkspacePath(dirPath)
			const entries = await fs.readdir(absolutePath)
			return entries
		} catch (error) {
			throw new Error(`Failed to list directory ${dirPath}: ${error}`)
		}
	}

	/**
	 * Create directory
	 * @param dirPath Directory path
	 */
	async createDir(dirPath: string): Promise<void> {
		try {
			const absolutePath = this.resolveWorkspacePath(dirPath)
			await fs.mkdir(absolutePath, { recursive: true })
		} catch (error) {
			throw new Error(`Failed to create directory ${dirPath}: ${error}`)
		}
	}

	/**
	 * Delete file or directory
	 * @param filePath File/directory path
	 */
	async deleteFile(filePath: string): Promise<void> {
		try {
			const absolutePath = this.resolveWorkspacePath(filePath)
			const stat = await fs.stat(absolutePath)

			if (stat.isDirectory()) {
				await fs.rm(absolutePath, { recursive: true, force: true })
			} else {
				await fs.unlink(absolutePath)
			}
		} catch (error) {
			throw new Error(`Failed to delete ${filePath}: ${error}`)
		}
	}

	/**
	 * Get file metadata
	 * @param filePath File path
	 * @returns File metadata
	 */
	async getFileMetadata(filePath: string): Promise<FileMetadata> {
		try {
			const absolutePath = this.resolveWorkspacePath(filePath)
			const stat = await fs.stat(absolutePath)

			return {
				size: stat.size,
				created: stat.birthtimeMs,
				modified: stat.mtimeMs,
				isDirectory: stat.isDirectory(),
				isFile: stat.isFile(),
				permissions: stat.mode.toString(8),
			}
		} catch (error) {
			throw new Error(`Failed to get metadata for ${filePath}: ${error}`)
		}
	}

	// ========================================================================
	// Terminal Operations (3 functions)
	// ========================================================================

	/**
	 * Execute shell command
	 * @param command Command to execute
	 * @param cwd Working directory (optional)
	 * @returns Command output
	 */
	async executeCommand(command: string, cwd?: string): Promise<string> {
		try {
			const workingDir = cwd ? this.resolveWorkspacePath(cwd) : this.getWorkspaceRoot()

			const { stdout, stderr } = await execAsync(command, {
				cwd: workingDir,
				maxBuffer: 10 * 1024 * 1024, // 10MB
			})

			return stdout + (stderr ? `\nSTDERR:\n${stderr}` : "")
		} catch (error: any) {
			const execError = error as ExecException
			throw new Error(
				`Command failed: ${command}\nExit code: ${execError.code}\nOutput: ${execError.stdout}\nError: ${execError.stderr}`,
			)
		}
	}

	/**
	 * Get terminal output (for long-running processes)
	 * @param processId Process ID
	 * @returns Current output
	 */
	async getTerminalOutput(processId: string): Promise<string> {
		const channel = this.outputChannels.get(processId)
		if (!channel) {
			throw new Error(`No output channel found for process ${processId}`)
		}

		// Note: VSCode OutputChannel doesn't provide direct output retrieval
		// This is a placeholder implementation
		return `Process ${processId} output (not implemented)`
	}

	/**
	 * Kill running process
	 * @param processId Process ID
	 */
	async killProcess(processId: string): Promise<void> {
		const process = this.processMap.get(processId)
		if (process && typeof process.kill === "function") {
			process.kill()
			this.processMap.delete(processId)
		}

		const channel = this.outputChannels.get(processId)
		if (channel) {
			channel.dispose()
			this.outputChannels.delete(processId)
		}
	}

	// ========================================================================
	// UI Operations (4 functions)
	// ========================================================================

	/**
	 * Show notification message
	 * @param message Message to display
	 * @param level Notification level: "info" | "warning" | "error"
	 */
	async showNotification(message: string, level: string): Promise<void> {
		switch (level.toLowerCase()) {
			case "error":
				vscode.window.showErrorMessage(message)
				break
			case "warning":
				vscode.window.showWarningMessage(message)
				break
			case "info":
			default:
				vscode.window.showInformationMessage(message)
				break
		}
	}

	/**
	 * Ask for user approval
	 * @param message Question to ask
	 * @param options Approval options (e.g., ["Yes", "No"])
	 * @returns Selected option or null if cancelled
	 */
	async askApproval(message: string, options: string[]): Promise<string | null> {
		const result = await vscode.window.showQuickPick(options, {
			placeHolder: message,
			canPickMany: false,
		})

		return result || null
	}

	/**
	 * Ask for text input
	 * @param prompt Input prompt
	 * @param defaultValue Default value
	 * @returns User input or null if cancelled
	 */
	async askInput(prompt: string, defaultValue?: string): Promise<string | null> {
		const result = await vscode.window.showInputBox({
			prompt,
			value: defaultValue,
		})

		return result || null
	}

	/**
	 * Show error message
	 * @param message Error message
	 */
	async showError(message: string): Promise<void> {
		vscode.window.showErrorMessage(`Roo-Code Error: ${message}`)
	}

	// ========================================================================
	// Network Operations (2 functions)
	// ========================================================================

	/**
	 * Make HTTP request
	 * @param url Request URL
	 * @param config Request configuration
	 * @returns HTTP response
	 */
	async httpRequest(url: string, config: HttpConfig): Promise<HttpResponse> {
		try {
			const controller = new AbortController()
			const timeout = config.timeout || 30000 // 30s default

			const timeoutId = setTimeout(() => controller.abort(), timeout)

			const response = await fetch(url, {
				method: config.method || "GET",
				headers: config.headers,
				body: config.body,
				signal: controller.signal,
			})

			clearTimeout(timeoutId)

			const body = await response.text()
			const headers: Record<string, string> = {}

			response.headers.forEach((value, key) => {
				headers[key] = value
			})

			return {
				status: response.status,
				headers,
				body,
			}
		} catch (error) {
			throw new Error(`HTTP request failed: ${error}`)
		}
	}

	/**
	 * Stream HTTP response
	 * @param url Request URL
	 * @param config Request configuration
	 * @returns Stream handle (not implemented)
	 */
	async httpStream(url: string, config: HttpConfig): Promise<string> {
		// Placeholder for streaming implementation
		// Real implementation would return a stream handle
		throw new Error("HTTP streaming not yet implemented")
	}

	// ========================================================================
	// Configuration Operations (2 functions)
	// ========================================================================

	/**
	 * Get configuration value
	 * @param key Configuration key
	 * @returns Configuration value
	 */
	async getConfig(key: string): Promise<string | null> {
		const config = vscode.workspace.getConfiguration("roo-cline")
		const value = config.get<string>(key)
		return value || null
	}

	/**
	 * Set configuration value
	 * @param key Configuration key
	 * @param value Configuration value
	 */
	async setConfig(key: string, value: string): Promise<void> {
		const config = vscode.workspace.getConfiguration("roo-cline")
		await config.update(key, value, vscode.ConfigurationTarget.Global)
	}

	// ========================================================================
	// Vector Database Operations (2 functions)
	// ========================================================================

	/**
	 * Search vector database
	 * @param params Search parameters
	 * @returns Search results (placeholder)
	 */
	async vectorSearch(params: VectorSearchParams): Promise<any[]> {
		// Placeholder - real implementation would call Qdrant
		console.log("Vector search not yet implemented:", params)
		return []
	}

	/**
	 * Insert into vector database
	 * @param params Insert parameters
	 */
	async vectorInsert(params: VectorInsertParams): Promise<void> {
		// Placeholder - real implementation would call Qdrant
		console.log("Vector insert not yet implemented:", params)
	}

	// ========================================================================
	// Helper Methods
	// ========================================================================

	/**
	 * Resolve workspace-relative path to absolute path
	 */
	private resolveWorkspacePath(filePath: string): string {
		if (path.isAbsolute(filePath)) {
			return filePath
		}

		const workspaceRoot = this.getWorkspaceRoot()
		return path.join(workspaceRoot, filePath)
	}

	/**
	 * Get workspace root directory
	 */
	private getWorkspaceRoot(): string {
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			throw new Error("No workspace folder open")
		}

		return workspaceFolders[0].uri.fsPath
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

let hostInterfaceInstance: HostInterface | null = null

export function getHostInterface(): HostInterface {
	if (!hostInterfaceInstance) {
		hostInterfaceInstance = new HostInterface()
	}
	return hostInterfaceInstance
}
