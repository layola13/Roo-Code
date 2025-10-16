/**
 * ToolsAdapter - TypeScript Tools System与Rust WASM Tools Module之间的适配器
 *
 * 职责：
 * 1. 管理工具注册表（ToolRegistry）
 * 2. 桥接工具调用（TypeScript ToolUse ↔ Rust WASM）
 * 3. 集成重复检测（ToolRepetitionDetector）
 * 4. 提供Fallback机制（WASM失败时降级到TypeScript）
 * 5. 状态持久化（使用safeWriteJson保证原子性）
 */

import {
	create_tool_registry,
	create_empty_tool_registry,
	is_tool_available,
	get_available_tools,
	get_tools_in_group,
	register_tool,
	unregister_tool,
	validate_tool,
	enable_group,
	disable_group,
	get_tool_count,
} from "../../../../rust-wasm/wasm-dist/roo_core_wasm"
import { HostInterface } from "../host/HostInterface"
import { ToolRepetitionDetector } from "../../tools/ToolRepetitionDetector"
import { validateToolUse } from "../../tools/validateToolUse"
import { safeWriteJson } from "../../../utils/safeWriteJson"
import type { ToolUse } from "../../../shared/tools"
import type { ToolName, ToolGroup } from "@roo-code/types"
import type { Mode } from "../../../shared/modes"

/**
 * ToolsAdapter配置
 */
export interface ToolsAdapterConfig {
	enableWasm: boolean // 是否启用WASM模式
	enableFallback: boolean // 是否启用Fallback
	persistencePath?: string // 状态持久化路径
	maxRetries?: number // 最大重试次数
	repetitionLimit?: number // 重复检测限制（默认3）
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult {
	success: boolean // 执行是否成功
	result?: any // 执行结果
	error?: string // 错误信息
	usedWasm: boolean // 是否使用了WASM
	retryCount: number // 重试次数
	blocked?: boolean // 是否被重复检测阻止
}

/**
 * 注册表状态（持久化格式）
 */
export interface RegistryState {
	tools: string[] // 可用工具列表
	toolCount: number // 工具数量
	timestamp: number // 时间戳
	wasmMode: boolean // 是否WASM模式
	errorCount: number // 错误计数
}

/**
 * ToolsAdapter - TypeScript与Rust WASM的桥接层
 */
export class ToolsAdapter {
	private wasmRegistry: any // WASM注册表对象
	private hostInterface: HostInterface
	private config: ToolsAdapterConfig
	private fallbackMode: boolean = false
	private errorCount: number = 0
	private repetitionDetector: ToolRepetitionDetector
	private createdAt: number
	private updatedAt: number

	constructor(hostInterface: HostInterface, config: ToolsAdapterConfig) {
		this.hostInterface = hostInterface
		this.config = {
			maxRetries: 3,
			repetitionLimit: 3,
			...config,
			enableFallback: config.enableFallback ?? true,
		}
		this.createdAt = Date.now()
		this.updatedAt = Date.now()

		// 初始化重复检测器
		this.repetitionDetector = new ToolRepetitionDetector(this.config.repetitionLimit || 3)

		// 初始化WASM注册表（如果启用）
		if (this.config.enableWasm) {
			try {
				this.wasmRegistry = create_tool_registry()
				this.hostInterface.log("info", "[ToolsAdapter] WASM registry initialized")
			} catch (error) {
				// 初始化失败时立即切换到Fallback模式
				if (this.config.enableFallback) {
					this.fallbackMode = true
					this.errorCount++
					const errorMessage = error instanceof Error ? error.message : String(error)
					this.hostInterface.log(
						"error",
						`[ToolsAdapter] WASM error during initialization: ${errorMessage} (count: ${this.errorCount})`,
					)
					this.hostInterface.log("warn", "[ToolsAdapter] Using fallback mode for tools")
				} else {
					throw error
				}
			}
		} else {
			// WASM未启用，直接使用Fallback
			this.fallbackMode = true
			this.hostInterface.log("info", "[ToolsAdapter] WASM disabled, using fallback mode")
		}
	}

	// ==================== 注册表管理方法 ====================

	/**
	 * 初始化注册表（创建包含所有工具的注册表）
	 */
	async initializeRegistry(): Promise<void> {
		if (this.fallbackMode) {
			this.hostInterface.log("info", "[ToolsAdapter] Registry initialized in fallback mode")
			return
		}

		try {
			this.wasmRegistry = create_tool_registry()
			this.updatedAt = Date.now()
			this.hostInterface.log("info", "[ToolsAdapter] Registry re-initialized with all tools")
			await this.syncRegistry()
		} catch (error) {
			await this.handleWasmError("initializeRegistry", error)

			if (this.fallbackMode) {
				this.hostInterface.log("info", "[ToolsAdapter] Registry initialized in fallback mode after error")
			} else if (!this.config.enableFallback) {
				throw error
			}
		}
	}

	/**
	 * 创建空注册表
	 */
	async createEmptyRegistry(): Promise<void> {
		if (this.fallbackMode) {
			this.hostInterface.log("info", "[ToolsAdapter] Empty registry created in fallback mode")
			return
		}

		try {
			this.wasmRegistry = create_empty_tool_registry()
			this.updatedAt = Date.now()
			this.hostInterface.log("info", "[ToolsAdapter] Empty registry created")
			await this.syncRegistry()
		} catch (error) {
			await this.handleWasmError("createEmptyRegistry", error)

			if (this.fallbackMode) {
				this.hostInterface.log("info", "[ToolsAdapter] Empty registry created in fallback mode after error")
			} else if (!this.config.enableFallback) {
				throw error
			}
		}
	}

	/**
	 * 注册工具
	 */
	async registerTool(toolName: string): Promise<boolean> {
		if (this.fallbackMode) {
			this.hostInterface.log("info", `[ToolsAdapter] Tool registered in fallback mode: ${toolName}`)
			return true
		}

		try {
			const result = register_tool(this.wasmRegistry, toolName)
			if (result === null || result === undefined) {
				this.hostInterface.log("warn", `[ToolsAdapter] Failed to register tool: ${toolName}`)
				return false
			}

			this.wasmRegistry = result
			this.updatedAt = Date.now()
			this.hostInterface.log("info", `[ToolsAdapter] Tool registered: ${toolName}`)
			await this.syncRegistry()
			return true
		} catch (error) {
			await this.handleWasmError("registerTool", error)

			if (this.fallbackMode) {
				this.hostInterface.log("info", `[ToolsAdapter] Tool registered in fallback mode: ${toolName}`)
				return true
			} else if (!this.config.enableFallback) {
				throw error
			}
			return false
		}
	}

	/**
	 * 注销工具
	 */
	async unregisterTool(toolName: string): Promise<boolean> {
		if (this.fallbackMode) {
			this.hostInterface.log("info", `[ToolsAdapter] Tool unregistered in fallback mode: ${toolName}`)
			return true
		}

		try {
			const result = unregister_tool(this.wasmRegistry, toolName)
			if (result === null || result === undefined) {
				this.hostInterface.log("warn", `[ToolsAdapter] Failed to unregister tool: ${toolName}`)
				return false
			}

			this.wasmRegistry = result
			this.updatedAt = Date.now()
			this.hostInterface.log("info", `[ToolsAdapter] Tool unregistered: ${toolName}`)
			await this.syncRegistry()
			return true
		} catch (error) {
			await this.handleWasmError("unregisterTool", error)

			if (this.fallbackMode) {
				this.hostInterface.log("info", `[ToolsAdapter] Tool unregistered in fallback mode: ${toolName}`)
				return true
			} else if (!this.config.enableFallback) {
				throw error
			}
			return false
		}
	}

	/**
	 * 启用工具组
	 */
	async enableGroup(group: ToolGroup): Promise<void> {
		if (this.fallbackMode) {
			this.hostInterface.log("info", `[ToolsAdapter] Group enabled in fallback mode: ${group}`)
			return
		}

		try {
			const result = enable_group(this.wasmRegistry, group)
			if (result === null || result === undefined) {
				this.hostInterface.log("warn", `[ToolsAdapter] Failed to enable group: ${group}`)
				return
			}

			this.wasmRegistry = result
			this.updatedAt = Date.now()
			this.hostInterface.log("info", `[ToolsAdapter] Group enabled: ${group}`)
			await this.syncRegistry()
		} catch (error) {
			await this.handleWasmError("enableGroup", error)

			if (this.fallbackMode) {
				this.hostInterface.log("info", `[ToolsAdapter] Group enabled in fallback mode: ${group}`)
			} else if (!this.config.enableFallback) {
				throw error
			}
		}
	}

	/**
	 * 禁用工具组
	 */
	async disableGroup(group: ToolGroup): Promise<void> {
		if (this.fallbackMode) {
			this.hostInterface.log("info", `[ToolsAdapter] Group disabled in fallback mode: ${group}`)
			return
		}

		try {
			const result = disable_group(this.wasmRegistry, group)
			if (result === null || result === undefined) {
				this.hostInterface.log("warn", `[ToolsAdapter] Failed to disable group: ${group}`)
				return
			}

			this.wasmRegistry = result
			this.updatedAt = Date.now()
			this.hostInterface.log("info", `[ToolsAdapter] Group disabled: ${group}`)
			await this.syncRegistry()
		} catch (error) {
			await this.handleWasmError("disableGroup", error)

			if (this.fallbackMode) {
				this.hostInterface.log("info", `[ToolsAdapter] Group disabled in fallback mode: ${group}`)
			} else if (!this.config.enableFallback) {
				throw error
			}
		}
	}

	// ==================== 工具查询方法 ====================

	/**
	 * 检查工具是否可用
	 */
	async isToolAvailable(toolName: string): Promise<boolean> {
		if (this.fallbackMode) {
			// Fallback模式：所有工具都可用
			return true
		}

		try {
			const available = is_tool_available(this.wasmRegistry, toolName)
			return available
		} catch (error) {
			await this.handleWasmError("isToolAvailable", error)

			if (this.fallbackMode) {
				return true
			} else if (!this.config.enableFallback) {
				throw error
			}
			return false
		}
	}

	/**
	 * 获取所有可用工具
	 */
	async getAvailableTools(): Promise<string[]> {
		if (this.fallbackMode) {
			// Fallback模式：返回所有工具名称
			return [
				"read_file",
				"fetch_instructions",
				"search_files",
				"list_files",
				"list_code_definition_names",
				"codebase_search",
				"apply_diff",
				"write_to_file",
				"insert_content",
				"search_and_replace",
				"generate_image",
				"execute_command",
				"browser_action",
				"use_mcp_tool",
				"access_mcp_resource",
				"switch_mode",
				"new_task",
				"ask_followup_question",
				"attempt_completion",
				"update_todo_list",
				"run_slash_command",
			]
		}

		try {
			const tools = get_available_tools(this.wasmRegistry)
			return tools || []
		} catch (error) {
			await this.handleWasmError("getAvailableTools", error)

			if (this.fallbackMode) {
				return this.getAvailableTools() // 递归调用Fallback逻辑
			} else if (!this.config.enableFallback) {
				throw error
			}
			return []
		}
	}

	/**
	 * 获取工具组内的工具
	 */
	async getToolsInGroup(group: ToolGroup): Promise<string[]> {
		if (this.fallbackMode) {
			// Fallback模式：返回对应组的工具
			const groupTools: Record<ToolGroup, string[]> = {
				read: [
					"read_file",
					"fetch_instructions",
					"search_files",
					"list_files",
					"list_code_definition_names",
					"codebase_search",
				],
				edit: ["apply_diff", "write_to_file", "insert_content", "search_and_replace", "generate_image"],
				command: ["execute_command"],
				browser: ["browser_action"],
				mcp: ["use_mcp_tool", "access_mcp_resource"],
				modes: ["switch_mode", "new_task"],
			}
			return groupTools[group] || []
		}

		try {
			const tools = get_tools_in_group(this.wasmRegistry, group)
			return tools || []
		} catch (error) {
			await this.handleWasmError("getToolsInGroup", error)

			if (this.fallbackMode) {
				return this.getToolsInGroup(group) // 递归调用Fallback逻辑
			} else if (!this.config.enableFallback) {
				throw error
			}
			return []
		}
	}

	/**
	 * 获取工具数量
	 */
	async getToolCount(): Promise<number> {
		if (this.fallbackMode) {
			return 21 // 所有工具数量
		}

		try {
			return get_tool_count(this.wasmRegistry)
		} catch (error) {
			await this.handleWasmError("getToolCount", error)

			if (this.fallbackMode) {
				return 21
			} else if (!this.config.enableFallback) {
				throw error
			}
			return 0
		}
	}

	// ==================== 工具验证与执行方法 ====================

	/**
	 * 验证并执行工具（核心方法）
	 */
	async validateAndExecute(toolUse: ToolUse, mode: Mode): Promise<ToolExecutionResult> {
		// 1. 重复检测（优先级最高）
		const repetitionCheck = this.repetitionDetector.check(toolUse)
		if (!repetitionCheck.allowExecution) {
			this.hostInterface.log(
				"warn",
				`[ToolsAdapter] Tool execution blocked by repetition detector: ${toolUse.name}`,
			)
			return {
				success: false,
				error: repetitionCheck.askUser?.messageDetail || "Tool execution blocked by repetition limit",
				usedWasm: false,
				retryCount: 0,
				blocked: true,
			}
		}

		// 2. 工具验证
		try {
			if (this.fallbackMode) {
				// Fallback模式：使用TypeScript validateToolUse
				validateToolUse(toolUse.name, mode)
			} else {
				// WASM模式：使用WASM validate_tool
				const isValid = validate_tool(this.wasmRegistry, toolUse.name)
				if (!isValid) {
					return {
						success: false,
						error: `Tool "${toolUse.name}" is not available in the current registry`,
						usedWasm: true,
						retryCount: 0,
					}
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			return {
				success: false,
				error: errorMessage,
				usedWasm: !this.fallbackMode,
				retryCount: 0,
			}
		}

		// 3. 执行工具（实际执行由调用方完成，这里只做验证）
		return {
			success: true,
			usedWasm: !this.fallbackMode,
			retryCount: 0,
		}
	}

	/**
	 * 检查工具重复（暴露给外部使用）
	 */
	checkRepetition(toolUse: ToolUse): {
		allowExecution: boolean
		askUser?: { messageKey: string; messageDetail: string }
	} {
		return this.repetitionDetector.check(toolUse)
	}

	// ==================== 状态管理方法 ====================

	/**
	 * 同步注册表状态到持久化存储
	 * ⚠️ 关键：必须使用safeWriteJson确保原子性写入
	 */
	private async syncRegistry(): Promise<void> {
		if (!this.config.persistencePath) {
			return
		}

		try {
			const tools = await this.getAvailableTools()
			const toolCount = await this.getToolCount()

			const registryState: RegistryState = {
				tools,
				toolCount,
				timestamp: this.updatedAt,
				wasmMode: !this.fallbackMode,
				errorCount: this.errorCount,
			}

			const statePath = `${this.config.persistencePath}/tools-registry.json`
			// ⚠️ 强制使用safeWriteJson，不能用JSON.stringify + fs.writeFile
			await safeWriteJson(statePath, registryState)

			this.hostInterface.log("info", `[ToolsAdapter] Registry state synced: ${toolCount} tools`)
		} catch (error) {
			// 状态同步失败不应该影响主流程
			this.hostInterface.log("error", `[ToolsAdapter] Failed to sync registry: ${error}`)
		}
	}

	/**
	 * 从持久化存储加载注册表状态
	 */
	async loadRegistry(): Promise<RegistryState | null> {
		if (!this.config.persistencePath) {
			return null
		}

		try {
			const statePath = `${this.config.persistencePath}/tools-registry.json`
			const exists = await this.hostInterface.fileExists(statePath)

			if (!exists) {
				return null
			}

			const data = await this.hostInterface.readJson(statePath)
			this.hostInterface.log("info", `[ToolsAdapter] Registry state loaded: ${data.toolCount} tools`)
			return data as RegistryState
		} catch (error) {
			this.hostInterface.log("error", `[ToolsAdapter] Failed to load registry state: ${error}`)
			return null
		}
	}

	/**
	 * 静态方法：加载注册表状态
	 */
	static async loadRegistryState(
		persistencePath: string,
		hostInterface: HostInterface,
	): Promise<RegistryState | null> {
		try {
			const statePath = `${persistencePath}/tools-registry.json`
			const exists = await hostInterface.fileExists(statePath)

			if (!exists) {
				return null
			}

			const data = await hostInterface.readJson(statePath)
			return data as RegistryState
		} catch (error) {
			hostInterface.log("error", `[ToolsAdapter] Failed to load registry state: ${error}`)
			return null
		}
	}

	// ==================== 错误处理与Fallback ====================

	/**
	 * 处理WASM错误
	 */
	private async handleWasmError(operation: string, error: any): Promise<void> {
		this.errorCount++
		this.updatedAt = Date.now()
		const errorMessage = error instanceof Error ? error.message : String(error)

		this.hostInterface.log(
			"error",
			`[ToolsAdapter] WASM error during ${operation}: ${errorMessage} (count: ${this.errorCount})`,
		)

		// 同步错误状态（在切换Fallback之前）
		await this.syncRegistry()

		// 检查是否应该切换到Fallback模式
		if (this.config.enableFallback && !this.fallbackMode && this.errorCount >= (this.config.maxRetries || 3)) {
			this.fallbackMode = true
			this.hostInterface.log("warn", "[ToolsAdapter] Switching to fallback mode")
		}
	}

	// ==================== 状态查询方法 ====================

	/**
	 * 检查是否处于Fallback模式
	 */
	isFallbackMode(): boolean {
		return this.fallbackMode
	}

	/**
	 * 获取错误计数
	 */
	getErrorCount(): number {
		return this.errorCount
	}

	/**
	 * 重置错误计数
	 */
	resetErrorCount(): void {
		this.errorCount = 0
	}

	/**
	 * 获取创建时间
	 */
	getCreatedAt(): number {
		return this.createdAt
	}

	/**
	 * 获取最后更新时间
	 */
	getUpdatedAt(): number {
		return this.updatedAt
	}

	// ==================== 资源清理 ====================

	/**
	 * 清理资源
	 */
	dispose(): void {
		try {
			if (this.wasmRegistry) {
				// Rust WASM对象会自动清理
				this.wasmRegistry = undefined
			}
			this.hostInterface.log("info", "[ToolsAdapter] Tools adapter disposed")
		} catch (error) {
			this.hostInterface.log("error", `[ToolsAdapter] Error disposing adapter: ${error}`)
		}
	}
}
