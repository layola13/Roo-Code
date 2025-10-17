/**
 * WASM Config 测试
 *
 * 测试运行时配置管理和切换功能
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
	WasmConfigManager,
	DEFAULT_WASM_CONFIG,
	TYPESCRIPT_ONLY_CONFIG,
	WASM_ONLY_CONFIG,
	getRuntimeConfig,
} from "../config"

describe("WasmConfigManager", () => {
	let configManager: WasmConfigManager
	let originalEnv: string | undefined

	beforeEach(() => {
		// 保存原始环境变量
		originalEnv = process.env.ROO_WASM_MODE

		// 获取单例实例
		configManager = WasmConfigManager.getInstance()

		// 重置为默认配置
		configManager.reset()
	})

	afterEach(() => {
		// 恢复环境变量
		if (originalEnv !== undefined) {
			process.env.ROO_WASM_MODE = originalEnv
		} else {
			delete process.env.ROO_WASM_MODE
		}

		// 重置配置
		configManager.reset()
	})

	describe("getInstance", () => {
		it("应该返回单例实例", () => {
			const instance1 = WasmConfigManager.getInstance()
			const instance2 = WasmConfigManager.getInstance()
			expect(instance1).toBe(instance2)
		})
	})

	describe("getConfig", () => {
		it("应该返回默认配置", () => {
			const config = configManager.getConfig()
			expect(config).toEqual(DEFAULT_WASM_CONFIG)
		})

		it("应该返回配置的副本（不可变）", () => {
			const config1 = configManager.getConfig()
			const config2 = configManager.getConfig()
			expect(config1).not.toBe(config2) // 不同引用
			expect(config1).toEqual(config2) // 相同内容
		})
	})

	describe("updateConfig", () => {
		it("应该更新部分配置", () => {
			configManager.updateConfig({ enableWasm: false })
			const config = configManager.getConfig()
			expect(config.enableWasm).toBe(false)
			expect(config.enableFallback).toBe(true) // 其他字段不变
		})

		it("应该更新多个字段", () => {
			configManager.updateConfig({
				enableWasm: false,
				maxRetries: 5,
			})
			const config = configManager.getConfig()
			expect(config.enableWasm).toBe(false)
			expect(config.maxRetries).toBe(5)
		})
	})

	describe("switchToTypeScript", () => {
		it("应该切换到 TypeScript 模式", () => {
			configManager.switchToTypeScript()
			const config = configManager.getConfig()
			expect(config).toEqual(TYPESCRIPT_ONLY_CONFIG)
			expect(config.enableWasm).toBe(false)
		})
	})

	describe("switchToWasm", () => {
		it("应该切换到 WASM 模式", () => {
			// 先切换到 TypeScript
			configManager.switchToTypeScript()
			expect(configManager.getConfig().enableWasm).toBe(false)

			// 再切换回 WASM
			configManager.switchToWasm()
			const config = configManager.getConfig()
			expect(config).toEqual(DEFAULT_WASM_CONFIG)
			expect(config.enableWasm).toBe(true)
		})
	})

	describe("reset", () => {
		it("应该重置为默认配置", () => {
			// 修改配置
			configManager.updateConfig({ enableWasm: false, maxRetries: 10 })
			expect(configManager.getConfig().enableWasm).toBe(false)

			// 重置
			configManager.reset()
			const config = configManager.getConfig()
			expect(config).toEqual(DEFAULT_WASM_CONFIG)
		})
	})
})

describe("getRuntimeConfig", () => {
	let originalEnv: string | undefined

	beforeEach(() => {
		originalEnv = process.env.ROO_WASM_MODE
	})

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env.ROO_WASM_MODE = originalEnv
		} else {
			delete process.env.ROO_WASM_MODE
		}
	})

	it("应该返回默认配置（无环境变量）", () => {
		delete process.env.ROO_WASM_MODE
		const config = getRuntimeConfig()
		expect(config).toEqual(DEFAULT_WASM_CONFIG)
	})

	it("应该从环境变量读取 TypeScript 模式", () => {
		process.env.ROO_WASM_MODE = "typescript"
		const config = getRuntimeConfig()
		expect(config).toEqual(TYPESCRIPT_ONLY_CONFIG)
		expect(config.enableWasm).toBe(false)
	})

	it("应该从环境变量读取 WASM-only 模式", () => {
		process.env.ROO_WASM_MODE = "wasm-only"
		const config = getRuntimeConfig()
		expect(config).toEqual(WASM_ONLY_CONFIG)
		expect(config.enableWasm).toBe(true)
		expect(config.enableFallback).toBe(false)
	})

	it("应该忽略无效的环境变量值", () => {
		process.env.ROO_WASM_MODE = "invalid-mode"
		const config = getRuntimeConfig()
		expect(config).toEqual(DEFAULT_WASM_CONFIG)
	})
})

describe("预定义配置常量", () => {
	it("DEFAULT_WASM_CONFIG 应该启用 WASM 和 Fallback", () => {
		expect(DEFAULT_WASM_CONFIG.enableWasm).toBe(true)
		expect(DEFAULT_WASM_CONFIG.enableFallback).toBe(true)
		expect(DEFAULT_WASM_CONFIG.maxRetries).toBe(3)
	})

	it("TYPESCRIPT_ONLY_CONFIG 应该禁用 WASM", () => {
		expect(TYPESCRIPT_ONLY_CONFIG.enableWasm).toBe(false)
		expect(TYPESCRIPT_ONLY_CONFIG.enableFallback).toBe(true)
	})

	it("WASM_ONLY_CONFIG 应该禁用 Fallback", () => {
		expect(WASM_ONLY_CONFIG.enableWasm).toBe(true)
		expect(WASM_ONLY_CONFIG.enableFallback).toBe(false)
	})
})

describe("运行时切换场景", () => {
	let configManager: WasmConfigManager

	beforeEach(() => {
		configManager = WasmConfigManager.getInstance()
		configManager.reset()
	})

	it("场景1: 开发时禁用 WASM 进行调试", () => {
		// 开发者想用 TypeScript 调试
		configManager.switchToTypeScript()

		const config = configManager.getConfig()
		expect(config.enableWasm).toBe(false)
		expect(config.enableFallback).toBe(true)
	})

	it("场景2: 测试 WASM 严格模式（无 Fallback）", () => {
		// 测试人员想确保 WASM 完全工作
		configManager.updateConfig({
			enableWasm: true,
			enableFallback: false,
		})

		const config = configManager.getConfig()
		expect(config.enableWasm).toBe(true)
		expect(config.enableFallback).toBe(false)
	})

	it("场景3: 生产环境使用 WASM + Fallback", () => {
		// 生产环境需要容错
		configManager.switchToWasm()

		const config = configManager.getConfig()
		expect(config.enableWasm).toBe(true)
		expect(config.enableFallback).toBe(true)
		expect(config.maxRetries).toBe(3)
	})

	it("场景4: 动态调整重试次数", () => {
		// 根据环境调整容错策略
		configManager.updateConfig({ maxRetries: 1 }) // 快速失败
		expect(configManager.getConfig().maxRetries).toBe(1)

		configManager.updateConfig({ maxRetries: 10 }) // 更宽容
		expect(configManager.getConfig().maxRetries).toBe(10)
	})
})
