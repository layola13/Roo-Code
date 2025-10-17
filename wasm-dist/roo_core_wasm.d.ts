/**
 * Unified WASM Type Definitions
 *
 * This module provides TypeScript type definitions for all WASM modules
 */

// Task Engine Types
export enum TaskStatus {
	Running = 0,
	Interactive = 1,
	Resumable = 2,
	Idle = 3,
	Paused = 4,
	Aborted = 5,
	Completed = 6,
}

export class Task {
	constructor(task_mode: string, parent_task_id?: string | null)

	get task_id(): string
	get instance_id(): string
	get task_mode(): string
	get is_paused(): boolean
	get is_aborted(): boolean
	get status(): string

	start(initial_message: string): Promise<void>
	pause(): Promise<void>
	resume(): Promise<void>
	abort(reason: string): Promise<void>
	complete(): Promise<void>

	free(): void
}

// Tools Types
export function init(): void
export function initTaskEngine(): void
export function initTools(): void
export function initApiIntegration(): void
export function initAll(): Promise<void>

export function create_tool_registry(): any
export function create_empty_tool_registry(): any
export function is_tool_available(registry_js: any, tool_name: string): boolean
export function get_available_tools(registry_js: any): any
export function get_tools_in_group(registry_js: any, group: string): any
export function register_tool(registry_js: any, tool_name: string): any
export function unregister_tool(registry_js: any, tool_name: string): any
export function validate_tool(registry_js: any, tool_name: string): boolean
export function enable_group(registry_js: any, group: string): any
export function disable_group(registry_js: any, group: string): any
export function get_tool_count(registry_js: any): number

// API Integration Types
export function getApiIntegrationVersion(): string

// Conversation Types (Placeholder)
export function create_conversation_manager(): any
export function add_message(manager: any, message: any): any
export function get_messages(manager: any): any
export function get_stats(manager: any): any

// Memory Types (Placeholder)
export enum MemoryPriority {
	Low = "low",
	Medium = "medium",
	High = "high",
	Critical = "critical",
}

export enum MemoryType {
	UserInstruction = "user_instruction",
	TechnicalDecision = "technical_decision",
	Configuration = "configuration",
	ImportantError = "important_error",
	ProjectContext = "project_context",
	WorkflowPattern = "workflow_pattern",
}

export class MemoryManager {
	constructor(taskId: string, config: any)

	extractMemories(messages: any, timestamp: number): any
	getAllMemories(): any
	getCriticalMemories(): any
	getMemoriesByPriority(priority: string): any
	getMemoriesByType(type: string): any
	generateMemorySummary(timestamp: number): string
	applyMemoryAging(currentTime: number): void
	pruneLowPriorityMemories(maxCount: number, currentTime: number): void
	getMemoryStats(currentTime: number): any
	serialize(): string

	static deserialize(data: string): MemoryManager
}
