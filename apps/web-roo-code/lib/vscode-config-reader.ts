import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"

export interface VSCodeConfig {
	customModes?: string
	mcpSettings?: any
	taskHistory?: any[]
	[key: string]: any
}

/**
 * 读取VSCode配置
 */
export function readVSCodeConfig(): VSCodeConfig | null {
	try {
		const vscodeConfigPath = join(homedir(), ".vscode-server/data/User/globalStorage/rooveterinaryinc.roo-cline")

		if (!existsSync(vscodeConfigPath)) {
			console.log("VSCode config path not found:", vscodeConfigPath)
			return null
		}

		// 读取配置文件
		const configFile = join(vscodeConfigPath, "settings.json")
		if (!existsSync(configFile)) {
			return null
		}

		const config = JSON.parse(readFileSync(configFile, "utf-8"))
		return config
	} catch (error) {
		console.error("Failed to read VSCode config:", error)
		return null
	}
}
