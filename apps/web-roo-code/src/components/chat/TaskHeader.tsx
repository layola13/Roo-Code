import React from "react"
import type { ClineMessage } from "@roo-code/types"

interface TaskHeaderProps {
	task: ClineMessage
	tokensIn: number
	tokensOut: number
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	contextTokens?: number
	buttonsDisabled: boolean
	handleCondenseContext: () => void
	todos?: string[]
	subAgentTokenUsage?: Record<string, any>
	subAgentCompressionEnabled?: boolean
	useContextAnalyzer?: boolean
	useMemoryExtractor?: boolean
	useCodeSummarizer?: boolean
}

export default function TaskHeader(props: TaskHeaderProps) {
	const { task, tokensIn, tokensOut, totalCost } = props

	return (
		<div className="p-4 border-b bg-gray-50">
			<div className="flex justify-between items-center">
				<h2 className="text-lg font-semibold">Task</h2>
				<div className="text-sm text-gray-600">
					<span>Tokens: {tokensIn + tokensOut}</span>
					<span className="ml-4">Cost: ${totalCost.toFixed(4)}</span>
				</div>
			</div>
		</div>
	)
}
