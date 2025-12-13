import { memo } from "react"

export interface SubagentContextBannerProps {
	agentId: string
	agentName: string
	model: string
	status: "running" | "completed" | "queued" | "failed"
	memoryLimit?: string
}

export const SubagentContextBanner = memo(function SubagentContextBanner({
	agentId,
	agentName,
	model,
	status,
	memoryLimit = "200k",
}: SubagentContextBannerProps) {
	const statusIcon = status === "running" ? "⟳" : "📟"

	return (
		<div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600/10 via-blue-500/10 to-blue-600/10 backdrop-blur-sm border-b border-blue-500/30 p-3 shadow-lg">
			<div className="flex justify-between items-center text-xs">
				<div className="flex flex-col">
					<span className="font-bold text-blue-400 flex items-center gap-1.5">
						{status === "running" && <span className="animate-spin">{statusIcon}</span>}
						{status !== "running" && <span>{statusIcon}</span>}
						{agentName} Context
					</span>
					<span className="opacity-60 font-mono text-[10px] text-vscode-descriptionForeground mt-0.5">
						ID: {agentId} • {model}
					</span>
				</div>
				<div className="text-[10px] px-2 py-1 bg-vscode-editor-background rounded border border-vscode-panel-border">
					Isolated Memory: {memoryLimit}
				</div>
			</div>
		</div>
	)
})
