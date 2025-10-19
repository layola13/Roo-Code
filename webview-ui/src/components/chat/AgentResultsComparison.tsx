import { memo, useState } from "react"
import type { AgentSearchResult } from "@roo-code/types"
import { ChevronDown, ChevronUp } from "lucide-react"

export interface AgentResultsComparisonProps {
	agentResults: AgentSearchResult[]
	selectedIndices: number[]
	conflictedIndices?: number[]
}

export const AgentResultsComparison = memo(
	({ agentResults, selectedIndices, conflictedIndices = [] }: AgentResultsComparisonProps) => {
		const [isExpanded, setIsExpanded] = useState(false)

		if (!agentResults || agentResults.length === 0) {
			return null
		}

		return (
			<div className="border border-vscode-panel-border/50 rounded-md p-3 mb-2 bg-vscode-editor-background">
				<div
					className="flex items-center justify-between cursor-pointer"
					onClick={() => setIsExpanded(!isExpanded)}>
					<div className="flex items-center gap-2">
						<span className="codicon codicon-organization text-vscode-charts-green" />
						<span className="font-bold text-sm">🤖 Agent检索结果对比</span>
						<span className="text-xs text-vscode-descriptionForeground">
							({agentResults.length} 个Agent)
						</span>
					</div>
					{isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
				</div>

				{isExpanded && (
					<div className="mt-3 space-y-3">
						{agentResults.map((result, idx) => (
							<div key={idx} className="border-l-2 border-vscode-charts-blue/50 pl-3">
								<div className="flex items-center gap-2 mb-1">
									<span className="font-medium text-xs">{result.agentName}:</span>
									<span className="text-xs text-vscode-descriptionForeground">
										耗时 {result.executionTime}ms
									</span>
								</div>

								<div className="text-xs mb-1">
									<span className="text-vscode-descriptionForeground opacity-80">选中: </span>
									<span className="font-mono">
										{result.selectedIndices.map((idx) => `msg#${idx}`).join(", ")}
									</span>
								</div>

								<div className="text-xs text-vscode-descriptionForeground opacity-80">
									{result.reasoning}
								</div>
							</div>
						))}

						<div className="border-t border-vscode-panel-border/30 pt-2 mt-2">
							<div className="text-xs">
								<div className="flex items-center gap-2 mb-1">
									<span className="codicon codicon-check text-vscode-charts-green" />
									<span className="font-medium">裁判最终决策:</span>
								</div>

								<div className="ml-5 space-y-1">
									<div>
										<span className="text-vscode-descriptionForeground opacity-80">合并结果: </span>
										<span className="font-medium">{selectedIndices.length} 条消息</span>
										<span className="text-vscode-descriptionForeground ml-1">(去重后)</span>
									</div>

									<div className="font-mono text-vscode-foreground">
										{selectedIndices.map((idx) => `msg#${idx}`).join(", ")}
									</div>

									{conflictedIndices.length > 0 && (
										<div className="mt-2 p-2 rounded bg-vscode-inputValidation-infoBackground/20 border border-vscode-inputValidation-infoBorder/50">
											<div className="flex items-center gap-1 mb-1">
												<span className="codicon codicon-info text-vscode-charts-blue" />
												<span className="font-medium">重复消息:</span>
											</div>
											<div className="ml-4 text-vscode-descriptionForeground">
												{conflictedIndices.map((idx) => `msg#${idx}`).join(", ")}
												<span className="ml-1">(多个Agent都选中，相关性高)</span>
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		)
	},
)

AgentResultsComparison.displayName = "AgentResultsComparison"
