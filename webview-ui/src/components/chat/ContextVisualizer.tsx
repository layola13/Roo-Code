import React, { useMemo } from "react"
import type { ClineMessage } from "@roo-code/types"

interface ContextVisualizerProps {
	messages: ClineMessage[]
	className?: string
}

/**
 * ContextVisualizer - 上下文可视化图表组件
 * 显示对话结构的可视化图表
 */
export const ContextVisualizer: React.FC<ContextVisualizerProps> = ({ messages, className = "" }) => {
	// 计算对话结构统计
	const conversationStats = useMemo(() => {
		const stats = {
			totalMessages: messages.length,
			userMessages: 0,
			assistantMessages: 0,
			toolCalls: 0,
			toolResults: 0,
			errors: 0,
			messageTypes: [] as Array<{ type: string; count: number; color: string }>,
		}

		messages.forEach((msg) => {
			switch (msg.type) {
				case "ask":
					if (msg.ask === "tool") stats.toolCalls++
					else if (msg.ask === "followup") stats.userMessages++
					break
				case "say":
					switch (msg.say) {
						case "text":
						case "completion_result":
							stats.assistantMessages++
							break
						case "error":
							stats.errors++
							break
						case "command_output":
							stats.toolResults++
							break
					}
					break
			}
		})

		// 生成消息类型统计
		stats.messageTypes = [
			{ type: "用户消息", count: stats.userMessages, color: "#0ea5e9" },
			{ type: "助手消息", count: stats.assistantMessages, color: "#8b5cf6" },
			{ type: "工具调用", count: stats.toolCalls, color: "#f59e0b" },
			{ type: "工具结果", count: stats.toolResults, color: "#10b981" },
			{ type: "错误", count: stats.errors, color: "#ef4444" },
		]

		return stats
	}, [messages])

	// 生成简单的柱状图SVG
	const renderBarChart = () => {
		const maxCount = Math.max(...conversationStats.messageTypes.map((t) => t.count))
		const barHeight = 20
		const gap = 8
		const totalHeight = conversationStats.messageTypes.length * (barHeight + gap) - gap

		return (
			<svg width="100%" height={totalHeight} className="overflow-visible">
				{conversationStats.messageTypes.map((type, index) => {
					const barWidth = maxCount > 0 ? (type.count / maxCount) * 100 : 0
					const y = index * (barHeight + gap)

					return (
						<g key={type.type}>
							{/* 背景条 */}
							<rect
								x="0"
								y={y}
								width="100%"
								height={barHeight}
								fill="var(--vscode-input-background)"
								rx="2"
							/>
							{/* 数据条 */}
							<rect x="0" y={y} width={`${barWidth}%`} height={barHeight} fill={type.color} rx="2" />
							{/* 标签 */}
							<text
								x="8"
								y={y + barHeight / 2}
								dominantBaseline="middle"
								className="text-xs font-medium"
								fill="var(--vscode-foreground)">
								{type.type}: {type.count}
							</text>
						</g>
					)
				})}
			</svg>
		)
	}

	return (
		<div className={`bg-vscode-input-background border border-vscode-panel-border rounded-md p-4 ${className}`}>
			<div className="flex items-center gap-2 mb-4">
				<span className="codicon codicon-graph text-vscode-charts-blue"></span>
				<h3 className="text-sm font-medium text-vscode-foreground">对话结构可视化</h3>
			</div>

			<div className="space-y-4">
				{/* 总体统计 */}
				<div className="grid grid-cols-2 gap-4 text-sm">
					<div>
						<span className="text-vscode-descriptionForeground">总消息数:</span>
						<span className="font-medium ml-2">{conversationStats.totalMessages}</span>
					</div>
					<div>
						<span className="text-vscode-descriptionForeground">对话深度:</span>
						<span className="font-medium ml-2">
							{conversationStats.userMessages + conversationStats.assistantMessages}
						</span>
					</div>
				</div>

				{/* 消息类型分布图表 */}
				<div>
					<h4 className="text-xs font-medium text-vscode-descriptionForeground mb-2 uppercase tracking-wide">
						消息类型分布
					</h4>
					<div className="h-32">{renderBarChart()}</div>
				</div>

				{/* 对话结构概览 */}
				<div className="border-t border-vscode-panel-border pt-3">
					<h4 className="text-xs font-medium text-vscode-descriptionForeground mb-2 uppercase tracking-wide">
						消息序列
					</h4>
					<div className="flex flex-wrap gap-1">
						{messages.slice(0, 20).map((msg, index) => {
							let bgColor = "bg-gray-400"
							let symbol = "?"

							switch (msg.type) {
								case "ask":
									if (msg.ask === "followup") {
										bgColor = "bg-blue-500"
										symbol = "U"
									} else if (msg.ask === "tool") {
										bgColor = "bg-amber-500"
										symbol = "T"
									} else {
										bgColor = "bg-blue-600"
										symbol = "U"
									}
									break
								case "say":
									switch (msg.say) {
										case "text":
										case "completion_result":
											bgColor = "bg-purple-500"
											symbol = "A"
											break
										case "command_output":
											bgColor = "bg-green-500"
											symbol = "R"
											break
										case "error":
											bgColor = "bg-red-500"
											symbol = "E"
											break
									}
									break
							}

							return (
								<div
									key={msg.ts || index}
									className={`w-6 h-6 ${bgColor} rounded-full flex items-center justify-center text-white text-xs font-bold`}
									title={`${msg.type}: ${msg.ask || msg.say}`}>
									{symbol}
								</div>
							)
						})}
						{messages.length > 20 && (
							<div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 text-xs font-bold">
								+{messages.length - 20}
							</div>
						)}
					</div>
					<div className="mt-2 text-xs text-vscode-descriptionForeground">
						U=用户, A=助手, T=工具调用, R=工具结果, E=错误
					</div>
				</div>
			</div>
		</div>
	)
}
