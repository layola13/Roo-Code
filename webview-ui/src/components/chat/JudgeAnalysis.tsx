import { memo } from "react"
import type { JudgeDecision } from "@roo-code/types"
import { formatLargeNumber } from "@src/utils/format"

export interface JudgeAnalysisProps {
	decision: JudgeDecision
}

export const JudgeAnalysis = memo(({ decision }: JudgeAnalysisProps) => {
	const confidencePercent = ((decision.confidence || 0) * 100).toFixed(0)
	const confidenceColor =
		(decision.confidence || 0) >= 0.8
			? "text-vscode-charts-green"
			: (decision.confidence || 0) >= 0.6
				? "text-vscode-charts-yellow"
				: "text-vscode-charts-orange"

	return (
		<div className="border border-vscode-panel-border/50 rounded-md p-3 mb-2 bg-vscode-editor-background">
			<div className="flex items-center justify-between gap-2 mb-2">
				<div className="flex items-center gap-2">
					<span className="codicon codicon-target text-vscode-charts-blue" />
					<span className="font-bold text-sm">🎯 上下文裁判分析</span>
				</div>
				<div className="flex items-center gap-2 text-xs">
					<span className="text-vscode-descriptionForeground">
						执行时间: {decision.totalExecutionTime || 0}ms
					</span>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-2 text-xs">
				<div className="flex items-start gap-2">
					<span className="text-vscode-descriptionForeground opacity-80 min-w-[80px]">用户意图:</span>
					<span className="text-vscode-foreground">{decision.intent}</span>
				</div>

				<div className="flex items-start gap-2">
					<span className="text-vscode-descriptionForeground opacity-80 min-w-[80px]">涉及领域:</span>
					<div className="flex flex-wrap gap-1">
						{decision.domains.map((domain, idx) => (
							<span
								key={idx}
								className="px-1.5 py-0.5 rounded bg-vscode-badge-background text-vscode-badge-foreground">
								{domain}
							</span>
						))}
					</div>
				</div>

				<div className="flex items-start gap-2">
					<span className="text-vscode-descriptionForeground opacity-80 min-w-[80px]">时间范围:</span>
					<span className="text-vscode-foreground">{decision.timeScope}</span>
				</div>

				<div className="flex items-start gap-2">
					<span className="text-vscode-descriptionForeground opacity-80 min-w-[80px]">置信度:</span>
					<span className={`font-medium ${confidenceColor}`}>{confidencePercent}%</span>
				</div>

				<div className="flex items-start gap-2">
					<span className="text-vscode-descriptionForeground opacity-80 min-w-[80px]">Token预算:</span>
					<span className="text-vscode-foreground">
						{formatLargeNumber(decision.allocatedTokens)} / {formatLargeNumber(decision.totalTokenBudget)}
						<span className="text-vscode-descriptionForeground ml-1">
							(保留 {formatLargeNumber(decision.reservedForResponse)} 用于回复)
						</span>
					</span>
				</div>

				<div className="flex items-start gap-2">
					<span className="text-vscode-descriptionForeground opacity-80 min-w-[80px]">筛选结果:</span>
					<span className="text-vscode-foreground">
						选中 {decision.selectedIndices.length} 条消息
						{decision.agentResults && decision.agentResults.length > 0 && (
							<span className="text-vscode-descriptionForeground ml-1">
								(来自 {decision.agentResults.length} 个Agent)
							</span>
						)}
					</span>
				</div>
			</div>
		</div>
	)
})

JudgeAnalysis.displayName = "JudgeAnalysis"
