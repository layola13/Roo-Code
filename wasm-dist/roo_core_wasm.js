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

// Conversation exports
export {
	init as initConversation,
	create_conversation_manager,
	add_message,
	get_messages,
	get_stats,
	find_message_by_timestamp,
	clear_messages,
	get_messages_since_last_summary,
	truncate_conversation,
	calculate_messages_to_keep,
} from "./conversation/roo_conversation.js"

// Memory exports
export {
	MemoryManager,
	MemoryPriority,
	MemoryType,
	calculateTextSimilarity,
	parseMemoryPriority,
	parseMemoryType,
	init as initMemory,
} from "./memory/roo_memory.js"

/**
 * Initialize all WASM modules
 */
export async function initAll() {
	await initTaskEngine()
	await initTools()
	await initApiIntegration()
	await initConversation()
	await initMemory()
	console.log("[WASM] All 5 modules initialized successfully")
}
