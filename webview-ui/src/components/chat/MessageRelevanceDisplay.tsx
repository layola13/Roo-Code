import { memo } from "react"
import type { MessageRelevance } from "@roo-code/types"

export interface MessageRelevanceDisplayProps {
	relevance: MessageRelevance
	messageIndex?: number
}

export const MessageRelevanceDisplay = memo(({ relevance }: MessageRelevanceDisplayProps) => {
	// 根据分数生成星星数量 (0.0-1.0 -> 0-5星)
	const starCount = Math.round(relevance.score * 5)
	const stars = "⭐".repeat(starCount)

	return (
		<div className="mt-2 p-2 rounded bg-vscode-badge-background/30 border border-vscode-panel-border/50">
			<div className="flex items-center gap-2 text-xs">
				<span className="codicon codicon-graph text-vscode-charts-blue" />
				<span className="font-medium">相关性:</span>
				<span className="font-mono" title={`Score: ${relevance.score.toFixed(2)}`}>
					{stars} ({relevance.score.toFixed(2)})
				</span>
			</div>

			{relevance.selectedByAgents && relevance.selectedByAgents.length > 0 && (
				<div className="mt-1 text-xs">
					<span className="text-vscode-descriptionForeground opacity-80">被选中: </span>
					<span className="text-vscode-foreground">{relevance.selectedByAgents.length} 个Agent</span>
					<span className="text-vscode-descriptionForeground ml-1">
						({relevance.selectedByAgents.join(", ")})
					</span>
				</div>
			)}

			{relevance.reasoning && (
				<div className="mt-1 text-xs text-vscode-descriptionForeground opacity-80">{relevance.reasoning}</div>
			)}
		</div>
	)
})

MessageRelevanceDisplay.displayName = "MessageRelevanceDisplay"
