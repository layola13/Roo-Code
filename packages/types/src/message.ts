import { z } from "zod"

/**
 * ClineAsk
 */

/**
 * Array of possible ask types that the LLM can use to request user interaction or approval.
 * These represent different scenarios where the assistant needs user input to proceed.
 *
 * @constant
 * @readonly
 *
 * Ask type descriptions:
 * - `followup`: LLM asks a clarifying question to gather more information needed to complete the task
 * - `command`: Permission to execute a terminal/shell command
 * - `command_output`: Permission to read the output from a previously executed command
 * - `completion_result`: Task has been completed, awaiting user feedback or a new task
 * - `tool`: Permission to use a tool for file operations (read, write, search, etc.)
 * - `api_req_failed`: API request failed, asking user whether to retry
 * - `resume_task`: Confirmation needed to resume a previously paused task
 * - `resume_completed_task`: Confirmation needed to resume a task that was already marked as completed
 * - `mistake_limit_reached`: Too many errors encountered, needs user guidance on how to proceed
 * - `browser_action_launch`: Permission to open or interact with a browser
 * - `use_mcp_server`: Permission to use Model Context Protocol (MCP) server functionality
 * - `auto_approval_max_req_reached`: Auto-approval limit has been reached, manual approval required
 */
export const clineAsks = [
	"followup",
	"command",
	"command_output",
	"completion_result",
	"tool",
	"api_req_failed",
	"resume_task",
	"resume_completed_task",
	"mistake_limit_reached",
	"browser_action_launch",
	"use_mcp_server",
	"auto_approval_max_req_reached",
] as const

export const clineAskSchema = z.enum(clineAsks)

export type ClineAsk = z.infer<typeof clineAskSchema>

// Needs classification:
// - `followup`
// - `command_output

/**
 * IdleAsk
 *
 * Asks that put the task into an "idle" state.
 */

export const idleAsks = [
	"completion_result",
	"api_req_failed",
	"resume_completed_task",
	"mistake_limit_reached",
	"auto_approval_max_req_reached",
] as const satisfies readonly ClineAsk[]

export type IdleAsk = (typeof idleAsks)[number]

export function isIdleAsk(ask: ClineAsk): ask is IdleAsk {
	return (idleAsks as readonly ClineAsk[]).includes(ask)
}

/**
 * ResumableAsk
 *
 * Asks that put the task into an "resumable" state.
 */

export const resumableAsks = ["resume_task"] as const satisfies readonly ClineAsk[]

export type ResumableAsk = (typeof resumableAsks)[number]

export function isResumableAsk(ask: ClineAsk): ask is ResumableAsk {
	return (resumableAsks as readonly ClineAsk[]).includes(ask)
}

/**
 * InteractiveAsk
 *
 * Asks that put the task into an "user interaction required" state.
 */

export const interactiveAsks = [
	"followup",
	"command",
	"tool",
	"browser_action_launch",
	"use_mcp_server",
] as const satisfies readonly ClineAsk[]

export type InteractiveAsk = (typeof interactiveAsks)[number]

export function isInteractiveAsk(ask: ClineAsk): ask is InteractiveAsk {
	return (interactiveAsks as readonly ClineAsk[]).includes(ask)
}

/**
 * ClineSay
 */

/**
 * Array of possible say types that represent different kinds of messages the assistant can send.
 * These are used to categorize and handle various types of communication from the LLM to the user.
 *
 * @constant
 * @readonly
 *
 * Say type descriptions:
 * - `error`: General error message
 * - `api_req_started`: Indicates an API request has been initiated
 * - `api_req_finished`: Indicates an API request has completed successfully
 * - `api_req_retried`: Indicates an API request is being retried after a failure
 * - `api_req_retry_delayed`: Indicates an API request retry has been delayed
 * - `api_req_deleted`: Indicates an API request has been deleted/cancelled
 * - `text`: General text message or assistant response
 * - `reasoning`: Assistant's reasoning or thought process (often hidden from user)
 * - `completion_result`: Final result of task completion
 * - `user_feedback`: Message containing user feedback
 * - `user_feedback_diff`: Diff-formatted feedback from user showing requested changes
 * - `command_output`: Output from an executed command
 * - `shell_integration_warning`: Warning about shell integration issues or limitations
 * - `browser_action`: Action performed in the browser
 * - `browser_action_result`: Result of a browser action
 * - `mcp_server_request_started`: MCP server request has been initiated
 * - `mcp_server_response`: Response received from MCP server
 * - `subtask_result`: Result of a completed subtask
 * - `checkpoint_saved`: Indicates a checkpoint has been saved
 * - `rooignore_error`: Error related to .rooignore file processing
 * - `diff_error`: Error occurred while applying a diff/patch
 * - `condense_context`: Context condensation/summarization has started
 * - `condense_context_error`: Error occurred during context condensation
 * - `codebase_search_result`: Results from searching the codebase
 */
export const clineSays = [
	"error",
	"api_req_started",
	"api_req_finished",
	"api_req_retried",
	"api_req_retry_delayed",
	"api_req_deleted",
	"text",
	"image",
	"reasoning",
	"completion_result",
	"user_feedback",
	"user_feedback_diff",
	"command_output",
	"shell_integration_warning",
	"browser_action",
	"browser_action_result",
	"mcp_server_request_started",
	"mcp_server_response",
	"subtask_result",
	"checkpoint_saved",
	"rooignore_error",
	"diff_error",
	"condense_context",
	"condense_context_error",
	"codebase_search_result",
	"user_edit_todos",
	"edit_chain_created",
	"parallel_edit_chains_started",
] as const

export const clineSaySchema = z.enum(clineSays)

export type ClineSay = z.infer<typeof clineSaySchema>

/**
 * ToolProgressStatus
 */

export const toolProgressStatusSchema = z.object({
	icon: z.string().optional(),
	text: z.string().optional(),
})

export type ToolProgressStatus = z.infer<typeof toolProgressStatusSchema>

/**
 * SubAgentStatus
 *
 * Execution status for individual subagents
 */

export const subAgentStatusSchema = z.enum(["pending", "running", "completed", "failed"])

export type SubAgentStatus = z.infer<typeof subAgentStatusSchema>

/**
 * SubAgentTokenUsage
 *
 * Token usage tracking for individual subagents in the compression system
 */

export const subAgentTokenUsageSchema = z.object({
	agentName: z.string(),
	tokensIn: z.number(),
	tokensOut: z.number(),
	cost: z.number(),
	status: subAgentStatusSchema.optional(),
})

export type SubAgentTokenUsage = z.infer<typeof subAgentTokenUsageSchema>

/**
 * AgentSearchResult
 *
 * Result from a single agent's context search
 */

export const agentSearchResultSchema = z.object({
	agentName: z.string(),
	selectedIndices: z.array(z.number()),
	relevanceScores: z.record(z.number()),
	reasoning: z.string(),
	executionTime: z.number(),
	success: z.boolean(),
	error: z.string().optional(),
})

export type AgentSearchResult = z.infer<typeof agentSearchResultSchema>

/**
 * JudgeDecision
 *
 * Judge agent's analysis and decision
 */

export const judgeDecisionSchema = z.object({
	intent: z.string(),
	domains: z.array(z.string()),
	timeScope: z.string(),
	confidence: z.number(),
	agentResults: z.array(agentSearchResultSchema),
	selectedIndices: z.array(z.number()),
	duplicateIndices: z.record(z.array(z.string())).optional(),
	conflictResolution: z
		.object({
			conflictedIndices: z.array(z.number()),
			resolution: z.string(),
		})
		.optional(),
	totalTokenBudget: z.number(),
	allocatedTokens: z.number(),
	reservedForResponse: z.number(),
	totalExecutionTime: z.number(),
	timestamp: z.number(),
})

export type JudgeDecision = z.infer<typeof judgeDecisionSchema>

/**
 * MessageRelevance
 *
 * Relevance information for a message in intelligent context
 */

export const messageRelevanceSchema = z.object({
	score: z.number(), // 0-1 relevance score
	selectedByAgents: z.array(z.string()), // Names of agents that selected this message
	reasoning: z.string().optional(),
})

export type MessageRelevance = z.infer<typeof messageRelevanceSchema>

/**
 * IntelligentContextResult
 *
 * Result from intelligent context filtering
 */

export const intelligentContextResultSchema = z.object({
	originalMessageCount: z.number(),
	selectedMessageCount: z.number(),
	tokenSavings: z.number(),
	judgeDecision: judgeDecisionSchema.optional(),
})

export type IntelligentContextResult = z.infer<typeof intelligentContextResultSchema>

/**
 * ContextCondense
 */

export const contextCondenseSchema = z.object({
	cost: z.number(),
	prevContextTokens: z.number(),
	newContextTokens: z.number(),
	summary: z.string(),
	subAgentTokenUsage: z.array(subAgentTokenUsageSchema).optional(),
	apiConfigName: z.string().optional(), // API configuration name used for compression
	durationMs: z.number().optional(), // Compression duration in milliseconds
	isRealtimeCompression: z.boolean().optional(), // Whether this used pre-warmed realtime cache (instant)
	// GSW System Usage Information
	gswUsed: z.boolean().optional(), // Whether GSW system was used
	gswVectorSearchEnabled: z.boolean().optional(), // Whether vector search is enabled in GSW
	gswMemoriesRetrieved: z.number().optional(), // Number of memories retrieved from GSW
	gswMemoryTypes: z.array(z.string()).optional(), // Types of memories retrieved (interaction/reasoning/evolution)
	gswSearchMode: z.enum(["vector", "yaml", "hybrid"]).optional(), // Search mode used by GSW
})

export type ContextCondense = z.infer<typeof contextCondenseSchema>

/**
 * ClineMessage
 */

export const clineMessageSchema = z.object({
	ts: z.number(),
	type: z.union([z.literal("ask"), z.literal("say")]),
	ask: clineAskSchema.optional(),
	say: clineSaySchema.optional(),
	text: z.string().optional(),
	images: z.array(z.string()).optional(),
	imageIds: z.array(z.string()).optional(),
	partial: z.boolean().optional(),
	reasoning: z.string().optional(),
	conversationHistoryIndex: z.number().optional(),
	messageIndex: z.number().optional(), // Global unique message index for intelligent context system
	checkpoint: z.record(z.string(), z.unknown()).optional(),
	progressStatus: toolProgressStatusSchema.optional(),
	contextCondense: contextCondenseSchema.optional(),
	isProtected: z.boolean().optional(),
	apiProtocol: z.union([z.literal("openai"), z.literal("anthropic")]).optional(),
	isAnswered: z.boolean().optional(),
	judgeDecision: judgeDecisionSchema.optional(), // Judge agent analysis and decision
	relevance: messageRelevanceSchema.optional(), // Message relevance in intelligent context
	intelligentContextResult: intelligentContextResultSchema.optional(), // Result from intelligent context filtering
	resumeReason: z.enum(["user_cancelled", "api_error", "network_error", "reopen_task"]).optional(), // Reason for task resumption
	metadata: z
		.object({
			gpt5: z
				.object({
					previous_response_id: z.string().optional(),
					instructions: z.string().optional(),
					reasoning_summary: z.string().optional(),
				})
				.optional(),
		})
		.optional(),
})

export type ClineMessage = z.infer<typeof clineMessageSchema>

/**
 * TokenUsage
 */

export const tokenUsageSchema = z.object({
	totalTokensIn: z.number(),
	totalTokensOut: z.number(),
	totalCacheWrites: z.number().optional(),
	totalCacheReads: z.number().optional(),
	totalCost: z.number(),
	contextTokens: z.number(),
	subAgentTokenUsage: z.array(subAgentTokenUsageSchema).optional(),
})

export type TokenUsage = z.infer<typeof tokenUsageSchema>

/**
 * QueuedMessage
 */

export const queuedMessageSchema = z.object({
	timestamp: z.number(),
	id: z.string(),
	text: z.string(),
	images: z.array(z.string()).optional(),
})

export type QueuedMessage = z.infer<typeof queuedMessageSchema>
