/**
 * Roo-Code WASM Module
 *
 * 统一导出所有WASM相关的API和类型
 */

// Core
export { WasmLoader, initializeWasm } from "./WasmLoader"
export { createHostInterface, HostInterface } from "./host/HostInterface"
export { RooWasmAPI, TaskAPI, ConversationAPI, MemoryAPI, ToolsAPI, createRooWasmAPI } from "./RooWasmAPI"

// Re-export WASM types
export { Task, TaskStatus, MemoryManager, MemoryPriority, MemoryType } from "../../../rust-wasm/wasm-dist/roo_core_wasm"

// Host Interface types
export type {
	FileSystemHost,
	TerminalHost,
	UIHost,
	NetworkHost,
	ConfigHost,
	LogHost,
	VectorDBHost,
} from "./host/HostInterface"
