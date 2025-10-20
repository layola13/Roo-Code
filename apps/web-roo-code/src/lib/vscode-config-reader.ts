/**
 * VSCode Configuration Reader
 * 读取VSCode插件的配置文件，支持Web版直接使用插件配置
 */

import fs from "fs/promises"
import path from "path"
import os from "os"
import { parse as parseJsonc } from "jsonc-parser"

export interface VSCodeConfig {
	// Provider settings
	apiProvider?: string
	apiKey?: string
	apiModelId?: string

	// OpenRouter
	openRouterApiKey?: string
	openRouterModelId?: string

	// Anthropic
	anthropicBaseUrl?: string

	// OpenAI
	openAiApiKey?: string
	openAiBaseUrl?: string
	openAiModelId?: string

	// Bedrock
	awsAccessKey?: string
	awsSecretKey?: string
	awsRegion?: string

	// Gemini
	geminiApiKey?: string

	// Global settings
	customInstructions?: string
	currentApiConfigName?: string
	listApiConfigMeta?: Array<{
		id: string
		name: string
		apiProvider?: string
		modelId?: string
	}>

	// 其他配置
	[key: string]: any
}

export interface SecretConfig {
	[key: string]: string | undefined
}

/**
 * VSCode配置文件位置
 */
export class VSCodeConfigPaths {
	private homeDir: string
	private vscodeServerPath: string
	private vscodeDesktopPath: string

	constructor() {
		this.homeDir = os.homedir()
		this.vscodeServerPath = path.join(this.homeDir, ".vscode-server")
		this.vscodeDesktopPath = path.join(this.homeDir, ".vscode")
	}

	/**
	 * 获取可能的globalStorage路径
	 */
	getGlobalStoragePaths(): string[] {
		const extensionId = "rooveterinaryinc.roo-cline"

		return [
			// VSCode Server (远程开发)
			path.join(this.vscodeServerPath, "data", "User", "globalStorage", extensionId),
			// VSCode Desktop
			path.join(this.vscodeDesktopPath, "User", "globalStorage", extensionId),
			// Linux
			path.join(this.homeDir, ".config", "Code", "User", "globalStorage", extensionId),
			// macOS
			path.join(this.homeDir, "Library", "Application Support", "Code", "User", "globalStorage", extensionId),
			// Windows
			path.join(this.homeDir, "AppData", "Roaming", "Code", "User", "globalStorage", extensionId),
		]
	}

	/**
	 * 查找实际存在的globalStorage路径
	 */
	async findGlobalStoragePath(): Promise<string | null> {
		const paths = this.getGlobalStoragePaths()

		for (const p of paths) {
			try {
				await fs.access(p)
				return p
			} catch {
				continue
			}
		}

		return null
	}
}

/**
 * 读取VSCode的state.vscdb文件（SQLite格式）
 * 注意：state.vscdb是二进制SQLite文件，我们需要使用其他方法
 */
export class VSCodeStateReader {
	private storagePath: string | null = null

	async initialize(): Promise<boolean> {
		const paths = new VSCodeConfigPaths()
		this.storagePath = await paths.findGlobalStoragePath()
		return this.storagePath !== null
	}

	/**
	 * 读取settings目录中的JSON配置文件
	 */
	async readSettingsFiles(): Promise<Partial<VSCodeConfig>> {
		if (!this.storagePath) {
			throw new Error("Storage path not initialized")
		}

		const config: Partial<VSCodeConfig> = {}
		const settingsPath = path.join(this.storagePath, "settings")

		try {
			// 读取custom_modes.yaml
			try {
				const modesPath = path.join(settingsPath, "custom_modes.yaml")
				const modesContent = await fs.readFile(modesPath, "utf-8")
				config.customModes = modesContent
			} catch {
				// 文件不存在或读取失败
			}

			// 读取mcp_settings.json
			try {
				const mcpPath = path.join(settingsPath, "mcp_settings.json")
				const mcpContent = await fs.readFile(mcpPath, "utf-8")
				config.mcpSettings = JSON.parse(mcpContent)
			} catch {
				// 文件不存在或读取失败
			}
		} catch (error) {
			console.error("Error reading settings files:", error)
		}

		return config
	}

	/**
	 * 从VSCode的workspace settings读取配置
	 */
	async readWorkspaceSettings(workspacePath: string): Promise<Partial<VSCodeConfig>> {
		const config: Partial<VSCodeConfig> = {}

		try {
			const settingsPath = path.join(workspacePath, ".vscode", "settings.json")
			const content = await fs.readFile(settingsPath, "utf-8")
			const settings = parseJsonc(content, undefined, { allowTrailingComma: true })

			// 提取roo-cline相关配置
			for (const [key, value] of Object.entries(settings)) {
				if (key.startsWith("roo-cline.")) {
					const configKey = key.replace("roo-cline.", "")
					config[configKey] = value
				}
			}
		} catch {
			// 文件不存在或读取失败
		}

		return config
	}

	/**
	 * 读取任务历史
	 */
	async readTaskHistory(): Promise<any[]> {
		if (!this.storagePath) {
			return []
		}

		try {
			const tasksPath = path.join(this.storagePath, "tasks")
			const taskDirs = await fs.readdir(tasksPath)

			const tasks = []
			for (const taskId of taskDirs) {
				try {
					const metadataPath = path.join(tasksPath, taskId, "task_metadata.json")
					const metadata = await fs.readFile(metadataPath, "utf-8")
					tasks.push({
						id: taskId,
						...JSON.parse(metadata),
					})
				} catch {
					// 跳过无法读取的任务
				}
			}

			return tasks.sort((a, b) => {
				const timeA = new Date(a.createdAt || 0).getTime()
				const timeB = new Date(b.createdAt || 0).getTime()
				return timeB - timeA
			})
		} catch {
			return []
		}
	}

	/**
	 * 导出完整配置供Web版使用
	 */
	async exportConfig(): Promise<VSCodeConfig> {
		if (!this.storagePath) {
			throw new Error("Storage path not initialized. Call initialize() first.")
		}

		const config: VSCodeConfig = {}

		// 读取settings文件
		const settings = await this.readSettingsFiles()
		Object.assign(config, settings)

		// 读取任务历史
		const taskHistory = await this.readTaskHistory()
		config.taskHistory = taskHistory

		return config
	}

	/**
	 * 获取存储路径（用于调试）
	 */
	getStoragePath(): string | null {
		return this.storagePath
	}
}

/**
 * 主配置读取器 - 整合所有配置源
 */
export class VSCodeConfigReader {
	private stateReader: VSCodeStateReader

	constructor() {
		this.stateReader = new VSCodeStateReader()
	}

	/**
	 * 初始化并读取所有配置
	 */
	async readConfig(workspacePath?: string): Promise<VSCodeConfig> {
		// 初始化状态读取器
		const initialized = await this.stateReader.initialize()

		if (!initialized) {
			console.warn("VSCode storage path not found. Using default configuration.")
			return {}
		}

		// 读取全局配置
		const config = await this.stateReader.exportConfig()

		// 如果提供了workspace路径，读取workspace配置
		if (workspacePath) {
			const workspaceConfig = await this.stateReader.readWorkspaceSettings(workspacePath)
			Object.assign(config, workspaceConfig)
		}

		return config
	}

	/**
	 * 获取当前激活的API配置
	 */
	async getCurrentApiConfig(): Promise<{
		provider?: string
		apiKey?: string
		modelId?: string
		baseUrl?: string
	}> {
		const config = await this.readConfig()

		// 如果有多个配置，返回当前激活的
		if (config.listApiConfigMeta && config.currentApiConfigName) {
			const current = config.listApiConfigMeta.find((meta) => meta.name === config.currentApiConfigName)

			if (current) {
				return {
					provider: current.apiProvider,
					modelId: current.modelId,
					// 需要从secrets中读取apiKey
				}
			}
		}

		// 返回默认配置
		return {
			provider: config.apiProvider,
			apiKey: config.apiKey,
			modelId: config.apiModelId,
		}
	}

	/**
	 * 获取存储路径（用于调试）
	 */
	getStoragePath(): string | null {
		return this.stateReader.getStoragePath()
	}
}

/**
 * 便捷函数：快速读取配置
 */
export async function readVSCodeConfig(workspacePath?: string): Promise<VSCodeConfig> {
	const reader = new VSCodeConfigReader()
	return reader.readConfig(workspacePath)
}

/**
 * 便捷函数：获取当前API配置
 */
export async function getCurrentApiConfig() {
	const reader = new VSCodeConfigReader()
	return reader.getCurrentApiConfig()
}
