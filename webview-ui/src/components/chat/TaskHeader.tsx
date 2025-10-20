import { memo, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useCloudUpsell } from "@src/hooks/useCloudUpsell"
import { CloudUpsellDialog } from "@src/components/cloud/CloudUpsellDialog"
import DismissibleUpsell from "@src/components/common/DismissibleUpsell"
import { FoldVertical, ChevronUp, ChevronDown, Sparkles } from "lucide-react"
import prettyBytes from "pretty-bytes"

import type { ClineMessage } from "@roo-code/types"

import { getModelMaxOutputTokens } from "@roo/api"
import { findLastIndex } from "@roo/array"

import { formatLargeNumber } from "@src/utils/format"
import { cn } from "@src/lib/utils"
import { StandardTooltip } from "@src/components/ui"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"

import Thumbnails from "../common/Thumbnails"

import { TaskActions } from "./TaskActions"
import { ContextWindowProgress } from "./ContextWindowProgress"
import { Mention } from "./Mention"
import { TodoListDisplay } from "./TodoListDisplay"
import StorageStatusIndicator, { StorageStatus } from "./StorageStatusIndicator"
import { JudgeAnalysis } from "./JudgeAnalysis"
import { AgentResultsComparison } from "./AgentResultsComparison"

export interface TaskHeaderProps {
	task: ClineMessage
	tokensIn: number
	tokensOut: number
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	contextTokens: number
	buttonsDisabled: boolean
	handleCondenseContext: (taskId: string) => void
	handleCompressMessages?: () => void
	todos?: any[]
	subAgentTokenUsage?: Array<{
		agentName: string
		tokensIn: number
		tokensOut: number
		cost: number
	}>
	// Sub-agent configuration debug info
	subAgentCompressionEnabled?: boolean
	useContextAnalyzer?: boolean
	useMemoryExtractor?: boolean
	useCodeSummarizer?: boolean
	// Storage status
	storageStatus?: StorageStatus
	// Compression progress
	compressionProgress?: { current: number; total: number } | null
}

const TaskHeader = ({
	task,
	tokensIn,
	tokensOut,
	cacheWrites,
	cacheReads,
	totalCost,
	contextTokens,
	buttonsDisabled,
	handleCondenseContext,
	handleCompressMessages,
	todos,
	subAgentTokenUsage,
	subAgentCompressionEnabled,
	useContextAnalyzer,
	useMemoryExtractor,
	useCodeSummarizer,
	storageStatus,
	compressionProgress,
}: TaskHeaderProps) => {
	const { t } = useTranslation()
	const { apiConfiguration, currentTaskItem, clineMessages, subAgentInvocations } = useExtensionState()
	const { id: modelId, info: model } = useSelectedModel(apiConfiguration)
	const [isTaskExpanded, setIsTaskExpanded] = useState(false)
	const [showLongRunningTaskMessage, setShowLongRunningTaskMessage] = useState(false)
	const { isOpen, openUpsell, closeUpsell, handleConnect } = useCloudUpsell({
		autoOpenOnAuth: false,
	})

	// Check if the task is complete by looking at the last relevant message (skipping resume messages)
	const isTaskComplete =
		clineMessages && clineMessages.length > 0
			? (() => {
					const lastRelevantIndex = findLastIndex(
						clineMessages,
						(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"),
					)
					return lastRelevantIndex !== -1
						? clineMessages[lastRelevantIndex]?.ask === "completion_result"
						: false
				})()
			: false

	useEffect(() => {
		const timer = setTimeout(() => {
			if (currentTaskItem && !isTaskComplete) {
				setShowLongRunningTaskMessage(true)
			}
		}, 120_000) // Show upsell after 2 minutes

		return () => clearTimeout(timer)
	}, [currentTaskItem, isTaskComplete])

	const textContainerRef = useRef<HTMLDivElement>(null)
	const textRef = useRef<HTMLDivElement>(null)
	const contextWindow = model?.contextWindow || 1

	const condenseButton = (
		<StandardTooltip content={t("chat:task.condenseContext")}>
			<button
				disabled={buttonsDisabled}
				onClick={() => currentTaskItem && handleCondenseContext(currentTaskItem.id)}
				className="shrink-0 min-h-[20px] min-w-[20px] p-[2px] cursor-pointer disabled:cursor-not-allowed opacity-85 hover:opacity-100 bg-transparent border-none rounded-md">
				<FoldVertical size={16} />
			</button>
		</StandardTooltip>
	)

	const hasTodos = todos && Array.isArray(todos) && todos.length > 0

	return (
		<div className="pt-2 pb-0 px-3">
			{showLongRunningTaskMessage && !isTaskComplete && (
				<DismissibleUpsell
					upsellId="longRunningTask"
					onClick={() => openUpsell()}
					dismissOnClick={false}
					variant="banner">
					{t("cloud:upsell.longRunningTask")}
				</DismissibleUpsell>
			)}
			<div
				className={cn(
					"px-2.5 pt-2.5 pb-2 flex flex-col gap-1.5 relative z-1 cursor-pointer",
					"bg-vscode-input-background hover:bg-vscode-input-background/90",
					"text-vscode-foreground/80 hover:text-vscode-foreground",
					"shadow-sm shadow-black/30 rounded-md",
					hasTodos && "border-b-0",
				)}
				onClick={(e) => {
					// Don't expand if clicking on buttons or interactive elements
					if (
						e.target instanceof Element &&
						(e.target.closest("button") ||
							e.target.closest('[role="button"]') ||
							e.target.closest(".share-button") ||
							e.target.closest("[data-radix-popper-content-wrapper]") ||
							e.target.closest("img") ||
							e.target.tagName === "IMG")
					) {
						return
					}

					// Don't expand/collapse if user is selecting text
					const selection = window.getSelection()
					if (selection && selection.toString().length > 0) {
						return
					}

					setIsTaskExpanded(!isTaskExpanded)
				}}>
				<div className="flex justify-between items-center gap-0">
					<div className="flex items-center select-none grow min-w-0">
						<div className="whitespace-nowrap overflow-hidden text-ellipsis grow min-w-0">
							{isTaskExpanded && <span className="font-bold">{t("chat:task.title")}</span>}
							{!isTaskExpanded && (
								<div>
									<span className="font-bold mr-1">{t("chat:task.title")}</span>
									<Mention text={task.text} />
								</div>
							)}
						</div>
						<div className="flex items-center shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
							<StandardTooltip content={isTaskExpanded ? t("chat:task.collapse") : t("chat:task.expand")}>
								<button
									onClick={() => setIsTaskExpanded(!isTaskExpanded)}
									className="shrink-0 min-h-[20px] min-w-[20px] p-[2px] cursor-pointer opacity-85 hover:opacity-100 bg-transparent border-none rounded-md">
									{isTaskExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
								</button>
							</StandardTooltip>
						</div>
					</div>
				</div>
				{!isTaskExpanded && contextWindow > 0 && (
					<div className="flex items-center gap-2 text-sm" onClick={(e) => e.stopPropagation()}>
						<StandardTooltip
							content={
								<div className="space-y-1">
									<div>
										{t("chat:tokenProgress.tokensUsed", {
											used: formatLargeNumber(contextTokens || 0),
											total: formatLargeNumber(contextWindow),
										})}
									</div>
									{(() => {
										const maxTokens = model
											? getModelMaxOutputTokens({ modelId, model, settings: apiConfiguration })
											: 0
										const reservedForOutput = maxTokens || 0
										const availableSpace = contextWindow - (contextTokens || 0) - reservedForOutput

										return (
											<>
												{reservedForOutput > 0 && (
													<div>
														{t("chat:tokenProgress.reservedForResponse", {
															amount: formatLargeNumber(reservedForOutput),
														})}
													</div>
												)}
												{availableSpace > 0 && (
													<div>
														{t("chat:tokenProgress.availableSpace", {
															amount: formatLargeNumber(availableSpace),
														})}
													</div>
												)}
											</>
										)
									})()}
								</div>
							}
							side="top"
							sideOffset={8}>
							<span className="mr-1">
								{formatLargeNumber(contextTokens || 0)} / {formatLargeNumber(contextWindow)}
							</span>
						</StandardTooltip>
						{!!totalCost && <span>${totalCost.toFixed(2)}</span>}
					</div>
				)}
				{/* Expanded state: Show task text and images */}
				{isTaskExpanded && (
					<>
						<div
							ref={textContainerRef}
							className="text-vscode-font-size overflow-y-auto break-words break-anywhere relative">
							<div
								ref={textRef}
								className="overflow-auto max-h-80 whitespace-pre-wrap break-words break-anywhere cursor-text"
								style={{
									display: "-webkit-box",
									WebkitLineClamp: "unset",
									WebkitBoxOrient: "vertical",
								}}>
								<Mention text={task.text} />
							</div>
						</div>
						{task.images && task.images.length > 0 && <Thumbnails images={task.images} />}

						{/* Judge Analysis and Agent Results */}
						{task.judgeDecision && (
							<>
								<JudgeAnalysis decision={task.judgeDecision} />
								<AgentResultsComparison
									agentResults={task.judgeDecision.agentResults}
									selectedIndices={task.judgeDecision.selectedIndices}
									conflictedIndices={task.judgeDecision.conflictResolution?.conflictedIndices}
								/>
							</>
						)}

						<div className="border-t border-b border-vscode-panel-border/50 py-4 mt-2 mb-1">
							<table className="w-full">
								<tbody>
									{contextWindow > 0 && (
										<tr>
											<th
												className="font-bold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px]"
												data-testid="context-window-label">
												{t("chat:task.contextWindow")}
											</th>
											<td className="align-top">
												<div className={`max-w-80 -mt-0.5 flex flex-nowrap gap-1`}>
													<ContextWindowProgress
														contextWindow={contextWindow}
														contextTokens={contextTokens || 0}
														maxTokens={
															model
																? getModelMaxOutputTokens({
																		modelId,
																		model,
																		settings: apiConfiguration,
																	})
																: undefined
														}
													/>
													{condenseButton}
													{handleCompressMessages && (
														<div className="flex items-center gap-1">
															<StandardTooltip content={t("chat:task.compressMessages")}>
																<button
																	disabled={buttonsDisabled || !!compressionProgress}
																	onClick={handleCompressMessages}
																	className="shrink-0 min-h-[20px] min-w-[20px] p-[2px] cursor-pointer disabled:cursor-not-allowed opacity-85 hover:opacity-100 bg-transparent border-none rounded-md">
																	<Sparkles size={16} />
																</button>
															</StandardTooltip>
															{compressionProgress && (
																<span className="text-xs text-vscode-descriptionForeground whitespace-nowrap">
																	{compressionProgress.current}/
																	{compressionProgress.total}
																</span>
															)}
														</div>
													)}
												</div>
											</td>
										</tr>
									)}

									<tr>
										<th className="font-bold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px]">
											{t("chat:task.tokens")}
										</th>
										<td className="align-top">
											<div className="flex items-center gap-1 flex-wrap">
												{typeof tokensIn === "number" && tokensIn > 0 && (
													<span>↑ {formatLargeNumber(tokensIn)}</span>
												)}
												{typeof tokensOut === "number" && tokensOut > 0 && (
													<span>↓ {formatLargeNumber(tokensOut)}</span>
												)}
											</div>
										</td>
									</tr>

									{((typeof cacheReads === "number" && cacheReads > 0) ||
										(typeof cacheWrites === "number" && cacheWrites > 0)) && (
										<tr>
											<th className="font-bold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px]">
												{t("chat:task.cache")}
											</th>
											<td className="align-top">
												<div className="flex items-center gap-1 flex-wrap">
													{typeof cacheWrites === "number" && cacheWrites > 0 && (
														<span>↑ {formatLargeNumber(cacheWrites)}</span>
													)}
													{typeof cacheReads === "number" && cacheReads > 0 && (
														<span>↓ {formatLargeNumber(cacheReads)}</span>
													)}
												</div>
											</td>
										</tr>
									)}

									{!!totalCost && (
										<tr>
											<th className="font-bold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px]">
												{t("chat:task.apiCost")}
											</th>
											<td className="align-top">
												<span>${totalCost?.toFixed(2)}</span>
											</td>
										</tr>
									)}

									{/* Size display */}
									{!!currentTaskItem?.size && currentTaskItem.size > 0 && (
										<tr>
											<th className="font-bold text-left align-top w-1 whitespace-nowrap pl-1 pr-2 h-[20px]">
												{t("chat:task.size")}
											</th>
											<td className="align-top">{prettyBytes(currentTaskItem.size)}</td>
										</tr>
									)}

									{/* Sub-agent compression visualization */}
									<tr>
										<th className="font-bold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px]">
											{t("chat:task.subAgents")}
										</th>
										<td className="align-top">
											<div className="flex flex-col gap-2">
												{/* Configuration status */}
												<div className="flex items-center gap-2 text-xs">
													<span
														className={`codicon ${subAgentCompressionEnabled ? "codicon-check text-vscode-charts-green" : "codicon-circle-slash text-vscode-descriptionForeground opacity-60"}`}
													/>
													<span className="font-medium">
														{subAgentCompressionEnabled ? "启用" : "未启用"}
													</span>
													{subAgentCompressionEnabled && (
														<span className="text-vscode-descriptionForeground">
															(
															{
																[
																	useContextAnalyzer,
																	useMemoryExtractor,
																	useCodeSummarizer,
																].filter(Boolean).length
															}
															/3 子代理激活)
														</span>
													)}
												</div>

												{/* Sub-agent token usage and status */}
												{subAgentTokenUsage && subAgentTokenUsage.length > 0 ? (
													<div className="flex flex-col gap-1 border-t border-vscode-panel-border/30 pt-2">
														{subAgentTokenUsage.map((agent, index) => {
															const isSuccess = agent.tokensOut > 0 && agent.cost > 0
															const statusIcon = isSuccess ? "check" : "circle-slash"
															const statusColor = isSuccess
																? "text-vscode-charts-green"
																: "text-vscode-descriptionForeground opacity-50"

															return (
																<div
																	key={index}
																	className="flex items-center gap-2 text-xs">
																	<span
																		className={`codicon codicon-${statusIcon} ${statusColor}`}
																	/>
																	<span className="font-medium min-w-[120px]">
																		{agent.agentName}:
																	</span>
																	<span>↑ {formatLargeNumber(agent.tokensIn)}</span>
																	<span>↓ {formatLargeNumber(agent.tokensOut)}</span>
																	<span className="text-vscode-descriptionForeground">
																		${agent.cost.toFixed(4)}
																	</span>
																</div>
															)
														})}

														{/* Total cost */}
														<div className="flex items-center gap-2 text-xs border-t border-vscode-panel-border/30 pt-1 mt-1 font-medium">
															<span className="codicon codicon-symbol-misc text-vscode-charts-blue" />
															<span className="min-w-[120px]">总计:</span>
															<span>
																↑{" "}
																{formatLargeNumber(
																	subAgentTokenUsage.reduce(
																		(sum, a) => sum + (a.tokensIn || 0),
																		0,
																	),
																)}
															</span>
															<span>
																↓{" "}
																{formatLargeNumber(
																	subAgentTokenUsage.reduce(
																		(sum, a) => sum + (a.tokensOut || 0),
																		0,
																	),
																)}
															</span>
															<span className="text-vscode-descriptionForeground">
																$
																{subAgentTokenUsage
																	.reduce((sum, a) => sum + (a.cost || 0), 0)
																	.toFixed(4)}
															</span>
														</div>
													</div>
												) : subAgentCompressionEnabled ? (
													<div className="flex items-center gap-2 text-xs text-vscode-descriptionForeground opacity-60 border-t border-vscode-panel-border/30 pt-2">
														<span className="codicon codicon-info" />
														<span>尚未触发压缩。点击上方压缩按钮可触发。</span>
													</div>
												) : (
													<div className="flex items-center gap-2 text-xs text-vscode-descriptionForeground opacity-60 border-t border-vscode-panel-border/30 pt-2">
														<span className="codicon codicon-info" />
														<span>在设置中启用子代理压缩功能</span>
													</div>
												)}

												{/* Historical invocations */}
												{subAgentInvocations && subAgentInvocations.length > 0 && (
													<div className="flex flex-col gap-2 border-t border-vscode-panel-border/30 pt-2 mt-2">
														{/* Statistics Summary */}
														<div className="flex flex-col gap-1.5">
															<div className="flex items-center gap-2 text-xs font-medium text-vscode-descriptionForeground">
																<span className="codicon codicon-graph" />
																<span>调用统计</span>
															</div>
															<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pl-5">
																<div className="flex items-center gap-1.5">
																	<span className="text-vscode-descriptionForeground opacity-80">
																		总次数:
																	</span>
																	<span className="font-medium">
																		{subAgentInvocations.length}
																	</span>
																</div>
																<div className="flex items-center gap-1.5">
																	<span className="text-vscode-descriptionForeground opacity-80">
																		成功率:
																	</span>
																	<span className="font-medium text-vscode-charts-green">
																		{(
																			(subAgentInvocations.filter(
																				(inv) => inv.success,
																			).length /
																				subAgentInvocations.length) *
																			100
																		).toFixed(0)}
																		%
																	</span>
																</div>
																<div className="flex items-center gap-1.5">
																	<span className="text-vscode-descriptionForeground opacity-80">
																		工具调用:
																	</span>
																	<span className="font-medium">
																		{
																			subAgentInvocations.filter(
																				(inv) =>
																					inv.triggerType === "tool_call",
																			).length
																		}
																	</span>
																</div>
																<div className="flex items-center gap-1.5">
																	<span className="text-vscode-descriptionForeground opacity-80">
																		自动压缩:
																	</span>
																	<span className="font-medium">
																		{
																			subAgentInvocations.filter(
																				(inv) =>
																					inv.triggerType === "auto_compress",
																			).length
																		}
																	</span>
																</div>
																<div className="flex items-center gap-1.5">
																	<span className="text-vscode-descriptionForeground opacity-80">
																		总Token:
																	</span>
																	<span className="font-medium text-xs">
																		↑{" "}
																		{formatLargeNumber(
																			subAgentInvocations.reduce(
																				(sum, inv) => sum + inv.tokensIn,
																				0,
																			),
																		)}{" "}
																		↓{" "}
																		{formatLargeNumber(
																			subAgentInvocations.reduce(
																				(sum, inv) => sum + inv.tokensOut,
																				0,
																			),
																		)}
																	</span>
																</div>
																<div className="flex items-center gap-1.5">
																	<span className="text-vscode-descriptionForeground opacity-80">
																		总成本:
																	</span>
																	<span className="font-medium">
																		$
																		{subAgentInvocations
																			.reduce((sum, inv) => sum + inv.cost, 0)
																			.toFixed(4)}
																	</span>
																</div>
															</div>
														</div>

														{/* Historical calls list */}
														<div className="flex flex-col gap-1">
															<div className="flex items-center gap-2 text-xs font-medium text-vscode-descriptionForeground border-t border-vscode-panel-border/20 pt-2">
																<span className="codicon codicon-history" />
																<span>调用历史</span>
															</div>
															<div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
																{subAgentInvocations.map((invocation, index) => {
																	const isSuccess = invocation.success
																	const statusIcon = isSuccess ? "check" : "error"
																	const statusColor = isSuccess
																		? "text-vscode-charts-green"
																		: "text-vscode-charts-red"
																	const triggerTypeText =
																		invocation.triggerType === "tool_call"
																			? "工具调用"
																			: "自动压缩"
																	const triggerIcon =
																		invocation.triggerType === "tool_call"
																			? "symbol-method"
																			: "zap"
																	const timeStr = new Date(
																		invocation.timestamp,
																	).toLocaleTimeString("zh-CN", {
																		hour: "2-digit",
																		minute: "2-digit",
																		second: "2-digit",
																	})

																	return (
																		<div
																			key={index}
																			className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-vscode-list-hoverBackground">
																			<span
																				className={`codicon codicon-${statusIcon} ${statusColor}`}
																			/>
																			<span className="font-medium min-w-[100px]">
																				{invocation.agentName}
																			</span>
																			<span
																				className={`codicon codicon-${triggerIcon} text-vscode-descriptionForeground opacity-70`}
																			/>
																			<span className="text-vscode-descriptionForeground min-w-[60px]">
																				{triggerTypeText}
																			</span>
																			<span className="text-vscode-descriptionForeground opacity-70">
																				{timeStr}
																			</span>
																			<span>
																				↑{" "}
																				{formatLargeNumber(invocation.tokensIn)}
																			</span>
																			<span>
																				↓{" "}
																				{formatLargeNumber(
																					invocation.tokensOut,
																				)}
																			</span>
																			<span className="text-vscode-descriptionForeground">
																				${invocation.cost.toFixed(4)}
																			</span>
																			{invocation.error && (
																				<StandardTooltip
																					content={invocation.error}>
																					<span className="codicon codicon-warning text-vscode-charts-orange" />
																				</StandardTooltip>
																			)}
																		</div>
																	)
																})}
															</div>
														</div>
													</div>
												)}
											</div>
										</td>
									</tr>

									{/* Intelligent Context Filtering Row */}
									{task.intelligentContextResult && (
										<tr>
											<th className="font-bold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px]">
												智能筛选
											</th>
											<td className="align-top">
												<div className="flex flex-col gap-2">
													{/* Status indicator */}
													<div className="flex items-center gap-2 text-xs">
														<span className="codicon codicon-filter text-vscode-charts-blue" />
														<span className="font-medium text-vscode-charts-green">
															已应用
														</span>
														<span className="text-vscode-descriptionForeground">
															(节省{" "}
															{formatLargeNumber(
																task.intelligentContextResult.tokenSavings,
															)}{" "}
															tokens)
														</span>
													</div>

													{/* Filtering statistics */}
													<div className="flex flex-col gap-1 border-t border-vscode-panel-border/30 pt-2">
														<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
															<div className="flex items-center gap-1.5">
																<span className="text-vscode-descriptionForeground opacity-80">
																	原始消息:
																</span>
																<span className="font-medium">
																	{task.intelligentContextResult.originalMessageCount}
																</span>
															</div>
															<div className="flex items-center gap-1.5">
																<span className="text-vscode-descriptionForeground opacity-80">
																	筛选后:
																</span>
																<span className="font-medium text-vscode-charts-green">
																	{task.intelligentContextResult.selectedMessageCount}
																</span>
															</div>
															<div className="flex items-center gap-1.5">
																<span className="text-vscode-descriptionForeground opacity-80">
																	压缩率:
																</span>
																<span className="font-medium text-vscode-charts-blue">
																	{(
																		(1 -
																			task.intelligentContextResult
																				.selectedMessageCount /
																				task.intelligentContextResult
																					.originalMessageCount) *
																		100
																	).toFixed(1)}
																	%
																</span>
															</div>
															<div className="flex items-center gap-1.5">
																<span className="text-vscode-descriptionForeground opacity-80">
																	筛选策略:
																</span>
																<span className="font-medium">
																	{task.intelligentContextResult.judgeDecision
																		?.intent || "语义相关性"}
																</span>
															</div>
														</div>
													</div>
												</div>
											</td>
										</tr>
									)}

									{/* Storage status row */}
									{storageStatus && (
										<tr>
											<th className="font-bold text-left align-top w-1 whitespace-nowrap pl-1 pr-3 h-[24px]">
												{t("chat:task.storage")}
											</th>
											<td className="align-top">
												<StorageStatusIndicator status={storageStatus} compact={false} />
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>

						{/* Footer with task management buttons */}
						<div onClick={(e) => e.stopPropagation()}>
							<TaskActions item={currentTaskItem} buttonsDisabled={buttonsDisabled} />
						</div>
					</>
				)}
			</div>
			<TodoListDisplay todos={todos ?? (task as any)?.tool?.todos ?? []} />
			<CloudUpsellDialog open={isOpen} onOpenChange={closeUpsell} onConnect={handleConnect} />
		</div>
	)
}

export default memo(TaskHeader)
