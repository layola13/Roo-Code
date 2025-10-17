/**
 * Unified WASM Export Module
 *
 * This module re-exports all functionality from individual WASM modules
 * to provide a single import point for TypeScript code.
 */

// Task Engine exports
export { Task, TaskStatus, init as initTaskEngine } from "./task-engine/roo_task_engine.js"

// Tools exports
export {
	init as initTools,
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
} from "./tools/roo_tools.js"

// API Integration exports
export { init as initApiIntegration, getApiIntegrationVersion } from "./api-integration/roo_api_integration.js"

/**
 * Placeholder exports for Conversation module
 * These will be replaced when conversation WASM is compiled
 */
export function create_conversation_manager() {
	throw new Error("Conversation WASM module not yet compiled. Using TypeScript fallback.")
}

export function add_message(manager, message) {
	throw new Error("Conversation WASM module not yet compiled. Using TypeScript fallback.")
}

export function get_messages(manager) {
	throw new Error("Conversation WASM module not yet compiled. Using TypeScript fallback.")
}

export function get_stats(manager) {
	throw new Error("Conversation WASM module not yet compiled. Using TypeScript fallback.")
}

/**
 * Placeholder Memory Manager class
 * This will be replaced when memory WASM is compiled
 */
export class MemoryManager {
	constructor(taskId, config) {
		throw new Error("Memory WASM module not yet compiled. Using TypeScript fallback.")
	}

	extractMemories(messages, timestamp) {
		throw new Error("Memory WASM module not yet compiled. Using TypeScript fallback.")
	}

	getAllMemories() {
		throw new Error("Memory WASM module not yet compiled. Using TypeScript fallback.")
	}

	getCriticalMemories() {
		throw new Error("Memory WASM module not yet compiled. Using TypeScript fallback.")
	}

	getMemoriesByPriority(priority) {
		throw new Error("Memory WASM module not yet compiled. Using TypeScript fallback.")
	}

	getMemoriesByType(type) {
		throw new Error("Memory WASM module not yet compiled. Using TypeScript fallback.")
	}

	generateMemorySummary(timestamp) {
		throw new Error("Memory WASM module not yet compiled. Using TypeScript fallback.")
	}

	applyMemoryAging(currentTime) {
		throw new Error("Memory WASM module not yet compiled. Using TypeScript fallback.")
	}

	pruneLowPriorityMemories(maxCount, currentTime) {
		throw new Error("Memory WASM module not yet compiled. Using TypeScript fallback.")
	}

	getMemoryStats(currentTime) {
		throw new Error("Memory WASM module not yet compiled. Using TypeScript fallback.")
	}

	serialize() {
		throw new Error("Memory WASM module not yet compiled. Using TypeScript fallback.")
	}

	static deserialize(data) {
		throw new Error("Memory WASM module not yet compiled. Using TypeScript fallback.")
	}
}

/**
 * Memory enums
 */
export const MemoryPriority = {
	Low: "low",
	Medium: "medium",
	High: "high",
	Critical: "critical",
}

export const MemoryType = {
	UserInstruction: "user_instruction",
	TechnicalDecision: "technical_decision",
	Configuration: "configuration",
	ImportantError: "important_error",
	ProjectContext: "project_context",
	WorkflowPattern: "workflow_pattern",
}

/**
 * Initialize all WASM modules
 */
export async function initAll() {
	await initTaskEngine()
	await initTools()
	await initApiIntegration()
	console.log("[WASM] All available modules initialized")
	console.warn("[WASM] Conversation and Memory modules not yet compiled - using TypeScript fallback")
}
