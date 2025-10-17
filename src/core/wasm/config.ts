/**
 * WASM Runtime Configuration
 *
 * 用于全局控制 WASM 和 Fallback 行为
 */

export interface WasmRuntimeConfig {
	/**
	 * 是否启用 WASM 模式
	 * - true: 优先使用 WASM，失败时降级到 TypeScript
	 * - false: 直接使用 TypeScript 实现
	 */
	enableWasm: boolean

	/**
	 * 是否启用 Fallback 机制
	 * - true: WASM 失败时自动切换到 TypeScript
	 * - false: WASM 失败时直接抛出错误
	 */
	enableFallback: boolean

	/**
	 * 最大重试次数（触发 Fallback 的阈值）
	 * 默认: 3
	 */
	maxRetries: number

	/**
	 * 持久化路径（用于状态同步）
	 */
	persistencePath?: string
}

/**
 * 默认配置
 */
export const DEFAULT_WASM_CONFIG: WasmRuntimeConfig = {
	enableWasm: true, // 默认启用 WASM
	enableFallback: true, // 默认启用 Fallback
	maxRetries: 3, // 3 次错误后降级
}

/**
 * 纯 TypeScript 模式配置（禁用 WASM）
 */
export const TYPESCRIPT_ONLY_CONFIG: WasmRuntimeConfig = {
	enableWasm: false, // 禁用 WASM
	enableFallback: true,
	maxRetries: 0,
}

/**
 * 纯 WASM 模式配置（禁用 Fallback，用于测试）
 */
export const WASM_ONLY_CONFIG: WasmRuntimeConfig = {
	enableWasm: true,
	enableFallback: false, // 禁用 Fallback（错误会直接抛出）
	maxRetries: 0,
}

/**
 * 获取当前运行时配置
 *
 * 优先级：
 * 1. 环境变量 ROO_WASM_MODE
 * 2. VS Code 设置 roo-cline.wasm.*
 * 3. 默认配置
 */
export function getRuntimeConfig(vscodeConfig?: {
	enableWasm?: boolean
	enableFallback?: boolean
	maxRetries?: number
}): WasmRuntimeConfig {
	// 1. 检查环境变量
	const envMode = process.env.ROO_WASM_MODE

	if (envMode === "typescript") {
		return TYPESCRIPT_ONLY_CONFIG
	} else if (envMode === "wasm-only") {
		return WASM_ONLY_CONFIG
	}

	// 2. 检查 VS Code 设置
	if (vscodeConfig) {
		return {
			enableWasm: vscodeConfig.enableWasm ?? DEFAULT_WASM_CONFIG.enableWasm,
			enableFallback: vscodeConfig.enableFallback ?? DEFAULT_WASM_CONFIG.enableFallback,
			maxRetries: vscodeConfig.maxRetries ?? DEFAULT_WASM_CONFIG.maxRetries,
		}
	}

	// 3. 返回默认配置
	return DEFAULT_WASM_CONFIG
}

/**
 * 运行时配置管理器
 */
export class WasmConfigManager {
	private static instance: WasmConfigManager
	private config: WasmRuntimeConfig

	private constructor() {
		this.config = getRuntimeConfig()
	}

	static getInstance(): WasmConfigManager {
		if (!WasmConfigManager.instance) {
			WasmConfigManager.instance = new WasmConfigManager()
		}
		return WasmConfigManager.instance
	}

	/**
	 * 获取当前配置
	 */
	getConfig(): WasmRuntimeConfig {
		return { ...this.config }
	}

	/**
	 * 更新配置（运行时切换）
	 */
	updateConfig(newConfig: Partial<WasmRuntimeConfig>): void {
		this.config = { ...this.config, ...newConfig }
	}

	/**
	 * 切换到 TypeScript 模式
	 */
	switchToTypeScript(): void {
		this.config = TYPESCRIPT_ONLY_CONFIG
	}

	/**
	 * 切换到 WASM 模式
	 */
	switchToWasm(): void {
		this.config = DEFAULT_WASM_CONFIG
	}

	/**
	 * 重置为默认配置
	 */
	reset(): void {
		this.config = getRuntimeConfig()
	}
}
