import { Anthropic } from "@anthropic-ai/sdk"
import type { UseSubagentToolUse } from "../../shared/tools"
import type { Task } from "../task/Task"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { SubAgentExecutor } from "../condense/SubAgentExecutor"
import type { SubAgentConfig } from "../condense/SubAgentExecutor"

/**
 * Executes the use_subagent tool which allows the assistant to delegate
 * specialized analysis tasks to subagents running in isolated contexts.
 */
export async function useSubagentTool(
	cline: Task,
	block: UseSubagentToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	const { agent_name: agentName, task, context } = block.params

	// Debug log: Track when tool is invoked
	console.log("[useSubagentTool] Tool invoked by LLM", {
		agentName,
		task,
		context,
		timestamp: new Date().toISOString(),
	})

	// Validate agent name
	const validAgents = ["condense-context-analyzer", "condense-memory-extractor", "condense-code-summarizer"]
	if (!agentName) {
		await pushToolResult("Error: agent_name parameter is required")
		return
	}

	if (!validAgents.includes(agentName)) {
		await pushToolResult(`Error: Invalid agent_name '${agentName}'. Must be one of: ${validAgents.join(", ")}`)
		return
	}

	try {
		// Ask for approval
		const approved = await askApproval("tool", undefined, undefined, true)
		if (!approved) {
			await pushToolResult("Subagent execution cancelled by user.")
			return
		}

		// Get recent conversation history (last 20 messages for context)
		const recentMessages = cline.apiConversationHistory.slice(-20)

		// Create subagent configuration (only enable the requested subagent)
		const config: SubAgentConfig = {
			enabled: true,
			useContextAnalyzer: agentName === "condense-context-analyzer",
			useMemoryExtractor: agentName === "condense-memory-extractor",
			useCodeSummarizer: agentName === "condense-code-summarizer",
			verboseLogging: false,
		}

		// If custom task is provided, we could potentially override the system prompt
		// For now, we'll execute with default prompts and include task/context in a system message
		const executor = new SubAgentExecutor(cline.api, config)

		// Add task/context as a system message if provided
		let messagesWithTask = recentMessages
		if (task || context) {
			const additionalContext: Anthropic.MessageParam = {
				role: "user",
				content: [
					{
						type: "text",
						text: `Additional instructions for this analysis:\n${task ? `Task: ${task}\n` : ""}${context ? `Context: ${context}` : ""}`,
					},
				],
			}
			messagesWithTask = [...recentMessages, additionalContext]
		}

		// Execute the subagent
		const result = await executor.executeCompression(messagesWithTask)

		// Extract the specific subagent result
		let subagentResult: {
			success: boolean
			output?: string
			tokensIn: number
			tokensOut: number
			cost: number
			error?: string
		} | null = null

		if (agentName === "condense-context-analyzer" && result.analyzerResult) {
			subagentResult = result.analyzerResult
		} else if (agentName === "condense-memory-extractor" && result.extractorResult) {
			subagentResult = result.extractorResult
		} else if (agentName === "condense-code-summarizer" && result.summarizerResult) {
			subagentResult = result.summarizerResult
		}

		// Format and return the result
		if (subagentResult && subagentResult.success && subagentResult.output) {
			const resultText = [
				`<subagent_result>`,
				`Agent: ${agentName}`,
				`Status: Success`,
				`Tokens Used: ${subagentResult.tokensIn} in / ${subagentResult.tokensOut} out`,
				`Cost: $${subagentResult.cost.toFixed(4)}`,
				``,
				`--- Analysis Result ---`,
				subagentResult.output,
				`</subagent_result>`,
			].join("\n")

			await pushToolResult(resultText)
		} else if (subagentResult && !subagentResult.success) {
			await pushToolResult(`Subagent execution failed: ${subagentResult.error || "Unknown error"}`)
		} else {
			await pushToolResult("Subagent did not produce a result.")
		}
	} catch (error) {
		await handleError("use_subagent", error as Error)
		const errorMessage = error instanceof Error ? error.message : String(error)
		await pushToolResult(`Error executing subagent: ${errorMessage}`)
	}
}
