import React from "react"
import { EditStep } from "../../../../src/memory/gsw/types/next-edit"

/**
 * EditChainProgress组件属性
 */
export interface EditChainProgressProps {
	/** 所有编辑步骤 */
	steps: EditStep[]
	/** 当前步骤索引 */
	currentIndex: number
	/** 总步骤数 */
	totalSteps: number
}

/**
 * 编辑链进度指示器组件
 *
 * 显示编辑链的整体进度和所有步骤的状态：
 * - 显示总进度（X/Y）
 * - 列出所有步骤及其状态图标
 * - 高亮当前步骤
 * - 可视化完成进度条
 */
export const EditChainProgress: React.FC<EditChainProgressProps> = ({ steps, currentIndex, totalSteps }) => {
	// 计算统计数据
	const completedCount = steps.filter((s) => s.status === "accepted" || s.status === "modified").length
	const rejectedCount = steps.filter((s) => s.status === "rejected").length
	const progressPercentage = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0

	// 获取步骤状态图标
	const getStepIcon = (step: EditStep, index: number) => {
		if (index === currentIndex) {
			return <span className="codicon codicon-play-circle text-blue-400" aria-label="Current step" />
		}

		switch (step.status) {
			case "accepted":
				return <span className="codicon codicon-check text-green-400" aria-label="Accepted" />
			case "modified":
				return <span className="codicon codicon-edit text-yellow-400" aria-label="Modified" />
			case "rejected":
				return <span className="codicon codicon-close text-red-400" aria-label="Rejected" />
			case "pending":
			default:
				return (
					<span
						className="codicon codicon-circle-outline text-vscode-descriptionForeground"
						aria-label="Pending"
					/>
				)
		}
	}

	// 获取步骤文本样式
	const getStepTextClass = (step: EditStep, index: number) => {
		if (index === currentIndex) {
			return "text-vscode-foreground font-medium"
		}

		switch (step.status) {
			case "accepted":
			case "modified":
				return "text-vscode-descriptionForeground line-through"
			case "rejected":
				return "text-vscode-descriptionForeground line-through opacity-60"
			case "pending":
			default:
				return "text-vscode-descriptionForeground"
		}
	}

	return (
		<div
			className="border border-vscode-editorWidget-border rounded bg-vscode-editorWidget-background p-3"
			role="region"
			aria-label="Edit chain progress">
			{/* 标题和统计 */}
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-sm font-semibold text-vscode-foreground">
					编辑链进度 ({completedCount}/{totalSteps})
				</h3>
				<div className="flex items-center gap-3 text-xs text-vscode-descriptionForeground">
					<span className="flex items-center gap-1">
						<span className="codicon codicon-check text-green-400" />
						{completedCount} 已完成
					</span>
					{rejectedCount > 0 && (
						<span className="flex items-center gap-1">
							<span className="codicon codicon-close text-red-400" />
							{rejectedCount} 已跳过
						</span>
					)}
				</div>
			</div>

			{/* 进度条 */}
			<div className="mb-3">
				<div className="w-full h-2 bg-vscode-editorWidget-border rounded overflow-hidden">
					<div
						className="h-full bg-green-500 transition-all duration-300"
						style={{ width: `${progressPercentage}%` }}
						role="progressbar"
						aria-valuenow={progressPercentage}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label={`Progress: ${Math.round(progressPercentage)}%`}
					/>
				</div>
			</div>

			{/* 步骤列表 */}
			<div className="space-y-1.5 max-h-[200px] overflow-y-auto">
				{steps.map((step, index) => (
					<div
						key={step.stepId}
						className={`flex items-start gap-2 p-2 rounded transition-colors ${
							index === currentIndex ? "bg-vscode-list-activeSelectionBackground/20" : ""
						}`}
						role="listitem"
						aria-current={index === currentIndex ? "step" : undefined}>
						{/* 状态图标 */}
						<div className="flex-shrink-0 w-4 h-4 mt-0.5">{getStepIcon(step, index)}</div>

						{/* 步骤信息 */}
						<div className="flex-1 min-w-0">
							<div className={`text-sm ${getStepTextClass(step, index)}`}>
								{index + 1}. {step.description}
							</div>
							<div
								className="text-xs text-vscode-descriptionForeground mt-0.5 truncate"
								title={step.filePath}>
								{step.filePath} • L{step.startLine}-{step.endLine}
							</div>
						</div>

						{/* 用户修改标记 */}
						{step.userModifiedCode && (
							<span
								className="flex-shrink-0 text-xs text-yellow-400"
								title="用户已修改此步骤"
								aria-label="User modified">
								<span className="codicon codicon-edit" />
							</span>
						)}
					</div>
				))}
			</div>

			{/* 图例说明 */}
			<div className="mt-3 pt-3 border-t border-vscode-editorWidget-border">
				<div className="flex flex-wrap gap-3 text-xs text-vscode-descriptionForeground">
					<div className="flex items-center gap-1">
						<span className="codicon codicon-play-circle text-blue-400" />
						<span>当前步骤</span>
					</div>
					<div className="flex items-center gap-1">
						<span className="codicon codicon-check text-green-400" />
						<span>已接受</span>
					</div>
					<div className="flex items-center gap-1">
						<span className="codicon codicon-edit text-yellow-400" />
						<span>已修改</span>
					</div>
					<div className="flex items-center gap-1">
						<span className="codicon codicon-close text-red-400" />
						<span>已跳过</span>
					</div>
					<div className="flex items-center gap-1">
						<span className="codicon codicon-circle-outline" />
						<span>待处理</span>
					</div>
				</div>
			</div>
		</div>
	)
}
