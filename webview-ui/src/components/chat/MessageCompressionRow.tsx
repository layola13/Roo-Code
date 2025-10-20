import { useState } from "react"
import { useTranslation } from "react-i18next"
import { VSCodeBadge } from "@vscode/webview-ui-toolkit/react"

import { ProgressIndicator } from "./ProgressIndicator"

export interface MessageCompressionResult {
	originalCount: number
	compressedCount: number
	durationMs: number
}

export const MessageCompressionRow = ({ originalCount, compressedCount, durationMs }: MessageCompressionResult) => {
	const { t } = useTranslation()
	const [isExpanded, setIsExpanded] = useState(false)

	const compressionRatio = originalCount > 0 ? ((originalCount - compressedCount) / originalCount) * 100 : 0

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
						className="codicon codicon-check"
						style={{ color: "var(--vscode-charts-green)", fontSize: 16, marginBottom: "-1.5px" }}
					/>
				</div>
				<div className="flex items-center gap-2 flex-grow flex-wrap">
					<span className="codicon codicon-sparkle text-blue-400" />
					<span className="font-bold text-vscode-foreground">{t("chat:messageCompression.title")}</span>
					<span className="text-vscode-descriptionForeground text-sm">
						{originalCount.toLocaleString()} → {compressedCount.toLocaleString()}{" "}
						{t("chat:messageCompression.messages")}
					</span>
					{compressionRatio > 0 && <VSCodeBadge>-{compressionRatio.toFixed(1)}%</VSCodeBadge>}
					{durationMs > 0 && (
						<span className="text-vscode-descriptionForeground text-xs">
							{durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(2)}s`}
						</span>
					)}
				</div>
				<span className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`} />
			</div>

			{isExpanded && (
				<div className="mt-2 ml-0 p-4 bg-vscode-editor-background rounded text-vscode-foreground text-sm">
					<div className="mb-4 pb-3 border-b border-vscode-panel-border">
						<h4 className="font-bold mb-2 text-vscode-foreground">
							{t("chat:messageCompression.statistics")}
						</h4>
						<div className="grid grid-cols-2 gap-2 text-xs">
							<div>
								<span className="text-vscode-descriptionForeground">
									{t("chat:messageCompression.before")}:
								</span>
								<span className="ml-2 font-mono">{originalCount.toLocaleString()}</span>
							</div>
							<div>
								<span className="text-vscode-descriptionForeground">
									{t("chat:messageCompression.after")}:
								</span>
								<span className="ml-2 font-mono">{compressedCount.toLocaleString()}</span>
							</div>
							<div>
								<span className="text-vscode-descriptionForeground">
									{t("chat:messageCompression.reduced")}:
								</span>
								<span className="ml-2 font-mono">
									{(originalCount - compressedCount).toLocaleString()}
								</span>
							</div>
							<div>
								<span className="text-vscode-descriptionForeground">
									{t("chat:messageCompression.ratio")}:
								</span>
								<span className="ml-2 font-mono font-bold text-vscode-charts-green">
									{compressionRatio.toFixed(1)}%
								</span>
							</div>
							{durationMs > 0 && (
								<div>
									<span className="text-vscode-descriptionForeground">
										{t("chat:messageCompression.duration")}:
									</span>
									<span className="ml-2 font-mono">
										{durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(2)}s`}
									</span>
								</div>
							)}
						</div>
					</div>

					<div>
						<h4 className="font-bold mb-2 text-vscode-foreground">
							{t("chat:messageCompression.summary")}
						</h4>
						<p className="text-vscode-descriptionForeground text-xs">
							{t("chat:messageCompression.summaryText", {
								count: originalCount - compressedCount,
								ratio: compressionRatio.toFixed(1),
							})}
						</p>
					</div>
				</div>
			)}
		</div>
	)
}

export const CompressingMessagesRow = () => {
	const { t } = useTranslation()
	return (
		<div className="flex items-center gap-2">
			<ProgressIndicator />
			<span className="codicon codicon-sparkle text-blue-400" />
			<span className="font-bold text-vscode-foreground">{t("chat:messageCompression.compressing")}</span>
			<span className="text-vscode-descriptionForeground text-sm">{t("chat:messageCompression.poweredBy")}</span>
		</div>
	)
}

export const CompressMessagesErrorRow = ({ errorText }: { errorText?: string }) => {
	const { t } = useTranslation()
	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-2">
				<span className="codicon codicon-warning text-vscode-editorWarning-foreground opacity-80 text-base -mb-0.5" />
				<span className="font-bold text-vscode-foreground">{t("chat:messageCompression.errorHeader")}</span>
			</div>
			<span className="text-vscode-descriptionForeground text-sm">{errorText}</span>
		</div>
	)
}
