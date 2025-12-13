import React, { useState, useEffect } from "react"
import { CheckCircle, Clock, XCircle, X } from "lucide-react"

type AgentStatus = "running" | "completed" | "queued" | "failed"

interface SubagentTabProps {
	id: string
	name: string
	status: AgentStatus
	progress?: number
	model?: string
	isActive: boolean
	isMain?: boolean
	onClick: () => void
	onClose?: () => void
}

const AUTO_CLOSE_DELAY = 3000

/**
 * SubagentTab - 单个子代理Tab组件
 *
 * 功能：
 * - 显示子代理的状态图标（运行中/完成/队列/失败）
 * - 显示进度条（运行中状态）
 * - 显示模型名称
 * - 自动关闭动画（完成后3秒淡出）
 * - 支持手动关闭
 */
export const SubagentTab: React.FC<SubagentTabProps> = ({
	id: _id,
	name,
	status,
	progress = 0,
	model,
	isActive,
	isMain = false,
	onClick,
	onClose,
}) => {
	const [isClosing, setIsClosing] = useState(false)

	// 状态图标
	const getIcon = () => {
		switch (status) {
			case "running":
				return (
					<div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-400 border-t-transparent" />
				)
			case "completed":
				return <CheckCircle className="w-3.5 h-3.5 text-green-400" />
			case "queued":
				return <Clock className="w-3.5 h-3.5 text-yellow-500" />
			case "failed":
				return <XCircle className="w-3.5 h-3.5 text-red-500" />
			default:
				return null
		}
	}

	// 自动关闭逻辑：完成状态且非主任务且非激活状态时，3秒后淡出
	useEffect(() => {
		if (status === "completed" && !isMain && !isActive) {
			const timer = setTimeout(() => setIsClosing(true), AUTO_CLOSE_DELAY)
			const removeTimer = setTimeout(() => {
				onClose?.()
			}, AUTO_CLOSE_DELAY + 300) // 等待淡出动画完成

			return () => {
				clearTimeout(timer)
				clearTimeout(removeTimer)
			}
		}
	}, [status, isMain, isActive, onClose])

	return (
		<div
			onClick={onClick}
			className={`
        relative group flex items-center gap-2 px-3 py-1.5 rounded-t-sm cursor-pointer text-xs transition-all duration-200 min-w-[140px] max-w-[180px] border border-transparent flex-shrink-0
        ${
			isActive
				? "bg-vscode-editor-background border-t-blue-500 border-x-vscode-editorGroup-border"
				: "bg-vscode-tab-inactiveBackground hover:bg-vscode-tab-hoverBackground text-vscode-tab-inactiveForeground"
		}
        ${isClosing ? "opacity-0 -translate-y-2 scale-95 pointer-events-none" : "opacity-100"}
        ${isMain ? "font-semibold min-w-[100px]" : ""}
      `}
			style={{
				borderBottom: isActive ? "1px solid var(--vscode-editor-background)" : "1px solid transparent",
				marginBottom: "-1px",
				zIndex: isActive ? 10 : 1,
			}}>
			{/* 状态图标 */}
			<div className="shrink-0 flex items-center justify-center w-4">{getIcon()}</div>

			<div className="flex flex-col flex-1 overflow-hidden">
				<div className="flex items-center justify-between w-full">
					<span className="truncate">{name}</span>
					{!isMain && (
						<button
							onClick={(e) => {
								e.stopPropagation()
								if (onClose) {
									onClose()
								}
							}}
							className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-vscode-toolbar-hoverBackground rounded transition-opacity"
							aria-label="Close tab">
							<X size={10} />
						</button>
					)}
				</div>

				{/* 进度条（仅运行中状态显示） */}
				{status === "running" && !isMain && (
					<div className="w-full h-[2px] bg-vscode-editorWidget-background mt-1 rounded-full overflow-hidden">
						<div
							className="h-full bg-blue-500 transition-all duration-300 ease-out"
							style={{ width: `${progress}%` }}
						/>
					</div>
				)}

				{/* 模型标签（非运行状态显示） */}
				{status !== "running" && model && !isMain && (
					<span className="text-[9px] opacity-60 leading-none mt-0.5">{model}</span>
				)}
			</div>
		</div>
	)
}
