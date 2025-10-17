/**
 * Subagent Interface
 * Defines the contract that all subagents must implement
 */

import { AgentContext, SubagentResult } from "../types"

export interface SubagentInterface {
	/**
	 * The name of the subagent
	 */
	readonly name: string

	/**
	 * The default task for this subagent if none is specified
	 */
	readonly defaultTask: string

	/**
	 * Execute the subagent with the given context and task
	 */
	run(params: {
		context: AgentContext
		task: string
		userContext?: string
		options?: Record<string, any>
	}): Promise<SubagentResult>
}
