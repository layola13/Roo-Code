/**
 * WASM Module Loader
 *
 * 负责加载和初始化Rust WASM模块
 */

import initWasm, {
	type InitOutput,
	initialize,
	health_check,
	get_module_info,
	log,
	log_error,
	log_warn,
} from "../../../rust-wasm/wasm-dist/roo_core_wasm"

/**
 * WASM模块加载器类
 */
export class WasmLoader {
	private static instance: WasmLoader | null = null
	private wasmModule: InitOutput | null = null
	private initialized = false

	private constructor() {}

	/**
	 * 获取单例实例
	 */
	static getInstance(): WasmLoader {
		if (!WasmLoader.instance) {
			WasmLoader.instance = new WasmLoader()
		}
		return WasmLoader.instance
	}

	/**
	 * 初始化WASM模块
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			log("WASM module already initialized")
			return
		}

		try {
			// 加载WASM模块
			const wasmPath = require.resolve("../../../rust-wasm/wasm-dist/roo_core_wasm_bg.wasm")
			this.wasmModule = await initWasm()

			// 调用初始化函数
			const version = initialize()
			log(`WASM module initialized: ${version}`)

			// 健康检查
			const isHealthy = health_check()
			if (!isHealthy) {
				throw new Error("WASM module health check failed")
			}

			// 获取模块信息
			const moduleInfo = get_module_info()
			log(`Module info: ${JSON.stringify(moduleInfo)}`)

			this.initialized = true
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			log_error(`Failed to initialize WASM module: ${errorMsg}`)
			throw error
		}
	}

	/**
	 * 检查模块是否已初始化
	 */
	isInitialized(): boolean {
		return this.initialized
	}

	/**
	 * 获取WASM模块实例
	 */
	getModule(): InitOutput {
		if (!this.wasmModule) {
			throw new Error("WASM module not initialized. Call initialize() first.")
		}
		return this.wasmModule
	}

	/**
	 * 健康检查
	 */
	healthCheck(): boolean {
		if (!this.initialized) {
			return false
		}
		return health_check()
	}

	/**
	 * 获取模块信息
	 */
	getModuleInfo(): any {
		if (!this.initialized) {
			throw new Error("WASM module not initialized")
		}
		return get_module_info()
	}
}

/**
 * 便捷的初始化函数
 */
export async function initializeWasm(): Promise<WasmLoader> {
	const loader = WasmLoader.getInstance()
	await loader.initialize()
	return loader
}
