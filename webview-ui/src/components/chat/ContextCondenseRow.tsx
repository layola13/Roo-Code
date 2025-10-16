import { useState } from "react"
import { useTranslation } from "react-i18next"
import { VSCodeBadge } from "@vscode/webview-ui-toolkit/react"

import type { ContextCondense } from "@roo-code/types"

import { Markdown } from "./Markdown"
import { ProgressIndicator } from "./ProgressIndicator"

export const ContextCondenseRow = ({
	cost,
	prevContextTokens,
	newContextTokens,
	summary,
	subAgentTokenUsage,
}: ContextCondense) => {
	const { t } = useTranslation()
	const [isExpanded, setIsExpanded] = useState(false)

	// Handle null/undefined token values to prevent crashes
	const prevTokens = prevContextTokens ?? 0
	const newTokens = newContextTokens ?? 0
	const displayCost = cost ?? 0

	// Calculate compression ratio
	const compressionRatio = prevTokens > 0 ? ((prevTokens - newTokens) / prevTokens) * 100 : 0
	const hasSubAgents = subAgentTokenUsage && subAgentTokenUsage.length > 0

	return (
		<div className="mb-2">
			<div
				className="flex items-center justify-between cursor-pointer select-none"
				onClick={() => setIsExpanded(!isExpanded)}>
				<div
					style={{
						width: 16,
						height: 16,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}>
					<span
						className={`codicon codicon-check`}
						style={{ color: "var(--vscode-charts-green)", fontSize: 16, marginBottom: "-1.5px" }}
					/>
				</div>
				<div className="flex items-center gap-2 flex-grow">
					<span className="codicon codicon-compress text-blue-400" />
					<span className="font-bold text-vscode-foreground">{t("chat:contextCondense.title")}</span>
					<span className="text-vscode-descriptionForeground text-sm">
						{prevTokens.toLocaleString()} → {newTokens.toLocaleString()} {t("tokens")}
					</span>
					{/* Compression ratio badge */}
					{compressionRatio > 0 && <VSCodeBadge>-{compressionRatio.toFixed(1)}%</VSCodeBadge>}
					{/* Sub-agent indicator */}
					{hasSubAgents && (
						<VSCodeBadge className="bg-vscode-badge-background">
							<span className="codicon codicon-organization text-xs mr-1" />
							{subAgentTokenUsage.length} {t("chat:contextCondense.subAgents")}
						</VSCodeBadge>
					)}
					<VSCodeBadge className={displayCost > 0 ? "opacity-100" : "opacity-0"}>
						${displayCost.toFixed(2)}
					</VSCodeBadge>
				</div>
				<span className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`}></span>
			</div>

			{isExpanded && (
				<div className="mt-2 ml-0 p-4 bg-vscode-editor-background rounded text-vscode-foreground text-sm">
					{/* Compression statistics */}
					<div className="mb-4 pb-3 border-b border-vscode-panel-border">
						<h4 className="font-bold mb-2 text-vscode-foreground">
							{t("chat:contextCondense.statistics")}
						</h4>
						<div className="grid grid-cols-2 gap-2 text-xs">
							<div>
								<span className="text-vscode-descriptionForeground">
									{t("chat:contextCondense.before")}:
								</span>
								<span className="ml-2 font-mono">{prevTokens.toLocaleString()}</span>
							</div>
							<div>
								<span className="text-vscode-descriptionForeground">
									{t("chat:contextCondense.after")}:
								</span>
								<span className="ml-2 font-mono">{newTokens.toLocaleString()}</span>
							</div>
							<div>
								<span className="text-vscode-descriptionForeground">
									{t("chat:contextCondense.reduced")}:
								</span>
								<span className="ml-2 font-mono">{(prevTokens - newTokens).toLocaleString()}</span>
							</div>
							<div>
								<span className="text-vscode-descriptionForeground">
									{t("chat:contextCondense.ratio")}:
								</span>
								<span className="ml-2 font-mono font-bold text-vscode-charts-green">
									{compressionRatio.toFixed(1)}%
								</span>
							</div>
						</div>
					</div>

					{/* Sub-agent details */}
					{hasSubAgents && (
						<div className="mb-4 pb-3 border-b border-vscode-panel-border">
							<h4 className="font-bold mb-2 text-vscode-foreground flex items-center gap-2">
								<span className="codicon codicon-organization" />
								{t("chat:contextCondense.subAgentDetails")}
							</h4>
							<div className="space-y-2">
								{subAgentTokenUsage.map((agent, index) => {
									// 根据 status 判断是否成功执行
									const isSuccess = agent.tokensOut > 0 && agent.cost > 0
									const statusIcon = isSuccess ? "check" : "circle-slash"
									const statusColor = isSuccess
										? "text-vscode-charts-green"
										: "text-vscode-descriptionForeground opacity-50"

									return (
										<div
											key={index}
											className="flex items-center justify-between p-2 bg-vscode-input-background rounded text-xs">
											<div className="flex items-center gap-2">
												<span className={`codicon codicon-${statusIcon} ${statusColor}`} />
												<span className="font-medium">{agent.agentName}</span>
												{isSuccess && (
													<span className="text-vscode-charts-green text-xs">✓</span>
												)}
											</div>
											<div className="flex items-center gap-3 text-vscode-descriptionForeground">
												<span>↑ {agent.tokensIn.toLocaleString()}</span>
												<span>↓ {agent.tokensOut.toLocaleString()}</span>
												<span className="font-mono">${agent.cost.toFixed(4)}</span>
											</div>
										</div>
									)
								})}
							</div>
						</div>
					)}

					{/* Summary */}
					<div>
						<h4 className="font-bold mb-2 text-vscode-foreground">{t("chat:contextCondense.summary")}</h4>
						<Markdown markdown={summary} />
					</div>
				</div>
			)}
		</div>
	)
}

export const CondensingContextRow = () => {
	const { t } = useTranslation()
	return (
		<div className="flex items-center gap-2">
			<ProgressIndicator />
			<span className="codicon codicon-compress text-blue-400" />
			<span className="font-bold text-vscode-foreground">{t("chat:contextCondense.condensing")}</span>
		</div>
	)
}

export const CondenseContextErrorRow = ({ errorText }: { errorText?: string }) => {
	const { t } = useTranslation()
	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-2">
				<span className="codicon codicon-warning text-vscode-editorWarning-foreground opacity-80 text-base -mb-0.5"></span>
				<span className="font-bold text-vscode-foreground">{t("chat:contextCondense.errorHeader")}</span>
			</div>
			<span className="text-vscode-descriptionForeground text-sm">{errorText}</span>
		</div>
	)
}
