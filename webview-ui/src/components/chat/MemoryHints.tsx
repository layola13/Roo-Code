import React, { useMemo } from "react"
import { StandardTooltip } from "@/components/ui"

interface MemoryItem {
	id: string
	content: string
	category: "decision" | "requirement" | "technical" | "constraint"
	importance: "high" | "medium" | "low"
	timestamp: number
	context?: string
}

interface MemoryHintsProps {
	memories: MemoryItem[]
	className?: string
	maxDisplay?: number
}

/**
 * MemoryHints - 记忆提示UI组件
 * 显示相关历史记忆提示
 */
export const MemoryHints: React.FC<MemoryHintsProps> = ({ memories, className = "", maxDisplay = 5 }) => {
	// 按重要性和时间排序记忆
	const sortedMemories = useMemo(() => {
		const importanceWeight = { high: 3, medium: 2, low: 1 }
		return [...memories]
			.sort((a, b) => {
				// 首先按重要性排序
				const importanceDiff = importanceWeight[b.importance] - importanceWeight[a.importance]
				if (importanceDiff !== 0) return importanceDiff
				// 然后按时间排序（最新的在前）
				return b.timestamp - a.timestamp
			})
			.slice(0, maxDisplay)
	}, [memories, maxDisplay])

	// 获取类别图标
	const getCategoryIcon = (category: string) => {
		switch (category) {
			case "decision":
				return "check"
			case "requirement":
				return "bookmark"
			case "technical":
				return "code"
			case "constraint":
				return "warning"
			default:
				return "info"
		}
	}

	// 获取类别颜色
	const getCategoryColor = (category: string) => {
		switch (category) {
			case "decision":
				return "text-vscode-charts-green"
			case "requirement":
				return "text-vscode-charts-blue"
			case "technical":
				return "text-vscode-charts-purple"
			case "constraint":
				return "text-vscode-charts-orange"
			default:
				return "text-vscode-descriptionForeground"
		}
	}

	// 获取重要性样式
	const getImportanceStyle = (importance: string) => {
		switch (importance) {
			case "high":
				return "border-l-4 border-l-vscode-errorForeground bg-vscode-errorForeground/5"
			case "medium":
				return "border-l-4 border-l-vscode-charts-orange bg-vscode-charts-orange/5"
			case "low":
				return "border-l-4 border-l-vscode-descriptionForeground bg-vscode-descriptionForeground/5"
			default:
				return "border-l-4 border-l-vscode-panel-border"
		}
	}

	// 获取类别标签
	const getCategoryLabel = (category: string) => {
		switch (category) {
			case "decision":
				return "决策"
			case "requirement":
				return "需求"
			case "technical":
				return "技术"
			case "constraint":
				return "约束"
			default:
				return "其他"
		}
	}

	// 格式化时间
	const formatTime = (timestamp: number) => {
		const now = Date.now()
		const diff = now - timestamp
		const minutes = Math.floor(diff / 60000)
		const hours = Math.floor(diff / 3600000)
		const days = Math.floor(diff / 86400000)

		if (minutes < 1) return "刚刚"
		if (minutes < 60) return `${minutes}分钟前`
		if (hours < 24) return `${hours}小时前`
		return `${days}天前`
	}

	if (sortedMemories.length === 0) {
		return (
			<div className={`bg-vscode-input-background border border-vscode-panel-border rounded-md p-4 ${className}`}>
				<div className="flex items-center gap-2 mb-3">
					<span className="codicon codicon-lightbulb text-vscode-charts-yellow"></span>
					<h3 className="text-sm font-medium text-vscode-foreground">相关记忆</h3>
				</div>
				<div className="text-xs text-vscode-descriptionForeground opacity-60 text-center py-4">
					<span className="codicon codicon-info mr-1"></span>
					暂无相关历史记忆
				</div>
			</div>
		)
	}

	return (
		<div className={`bg-vscode-input-background border border-vscode-panel-border rounded-md p-4 ${className}`}>
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					<span className="codicon codicon-lightbulb text-vscode-charts-yellow"></span>
					<h3 className="text-sm font-medium text-vscode-foreground">相关记忆</h3>
				</div>
				<span className="text-xs text-vscode-descriptionForeground">
					显示 {sortedMemories.length} / {memories.length}
				</span>
			</div>

			<div className="space-y-2">
				{sortedMemories.map((memory) => (
					<StandardTooltip
						key={memory.id}
						content={
							<div className="space-y-2 max-w-md">
								{memory.context && (
									<div className="text-xs text-vscode-descriptionForeground">
										<span className="font-medium">上下文:</span> {memory.context}
									</div>
								)}
								<div className="text-xs">
									<span className="font-medium">时间:</span>{" "}
									{new Date(memory.timestamp).toLocaleString("zh-CN")}
								</div>
							</div>
						}>
						<div
							className={`relative p-3 rounded-r-md cursor-pointer hover:bg-vscode-list-hoverBackground transition-colors ${getImportanceStyle(memory.importance)}`}>
							<div className="flex items-start gap-2">
								<span
									className={`codicon codicon-${getCategoryIcon(memory.category)} ${getCategoryColor(memory.category)} shrink-0 mt-0.5`}></span>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 mb-1">
										<span className="text-xs font-medium text-vscode-descriptionForeground">
											{getCategoryLabel(memory.category)}
										</span>
										<span className="text-xs text-vscode-descriptionForeground opacity-70">
											{formatTime(memory.timestamp)}
										</span>
									</div>
									<div className="text-sm text-vscode-foreground line-clamp-2">{memory.content}</div>
								</div>
							</div>
						</div>
					</StandardTooltip>
				))}
			</div>

			{memories.length > maxDisplay && (
				<div className="mt-3 text-xs text-center text-vscode-descriptionForeground opacity-70">
					还有 {memories.length - maxDisplay} 条记忆未显示
				</div>
			)}
		</div>
	)
}
