import React, { useState } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { EditStep } from "../../../../src/memory/gsw/types/next-edit"

/**
 * EditStepCard组件属性
 */
export interface EditStepCardProps {
	/** 编辑步骤数据 */
	step: EditStep
	/** 接受回调 */
	onAccept: () => void
	/** 拒绝回调 */
	onReject: (reason?: string) => void
	/** 修改回调 */
	onModify: (code: string) => void
}

/**
 * 单个编辑步骤卡片组件
 *
 * 显示编辑步骤的详细信息：
 * - 文件路径和行号
 * - 编辑描述
 * - 代码Diff预览
 * - 操作按钮（接受、修改、跳过）
 * - 置信度指示器
 */
export const EditStepCard: React.FC<EditStepCardProps> = ({ step, onAccept, onReject, onModify }) => {
	const [isEditing, setIsEditing] = useState(false)
	const [modifiedCode, setModifiedCode] = useState(step.suggestedCode)
	const [showRejectReason, setShowRejectReason] = useState(false)
	const [rejectReason, setRejectReason] = useState("")

	// 编辑类型的显示文本和样式
	const getEditTypeBadge = () => {
		const badges = {
			insert: { text: "插入", className: "bg-green-600/20 text-green-400" },
			replace: { text: "替换", className: "bg-blue-600/20 text-blue-400" },
			delete: { text: "删除", className: "bg-red-600/20 text-red-400" },
			refactor: { text: "重构", className: "bg-purple-600/20 text-purple-400" },
		}
		return badges[step.editType] || badges.replace
	}

	const badge = getEditTypeBadge()

	// 置信度颜色
	const getConfidenceColor = () => {
		if (step.confidence >= 0.8) return "bg-green-500"
		if (step.confidence >= 0.5) return "bg-yellow-500"
		return "bg-red-500"
	}

	// 处理修改保存
	const handleSaveModification = () => {
		onModify(modifiedCode)
		setIsEditing(false)
	}

	// 处理拒绝
	const handleReject = () => {
		if (showRejectReason && rejectReason.trim()) {
			onReject(rejectReason)
			setShowRejectReason(false)
			setRejectReason("")
		} else {
			setShowRejectReason(true)
		}
	}

	return (
		<div
			className="border border-vscode-editorWidget-border rounded bg-vscode-editorWidget-background p-3"
			role="article"
			aria-label={`Edit step ${step.index + 1}: ${step.description}`}>
			{/* 头部：编辑类型、文件路径、行号 */}
			<div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>{badge.text}</span>
					<span className="text-sm text-vscode-descriptionForeground truncate" title={step.filePath}>
						{step.filePath}
					</span>
				</div>
				<span className="text-xs text-vscode-descriptionForeground whitespace-nowrap">
					L{step.startLine}-{step.endLine}
				</span>
			</div>

			{/* 描述 */}
			<p className="text-sm text-vscode-foreground mb-3">{step.description}</p>

			{/* 代码Diff区域 */}
			<div className="mb-3 rounded border border-vscode-editorWidget-border overflow-hidden">
				<div className="bg-vscode-editor-background">
					{!isEditing ? (
						<div className="p-3">
							{/* 原始代码 */}
							{step.originalCode && (
								<div className="mb-2">
									<div className="text-xs text-red-400 mb-1">- 原始代码</div>
									<pre className="text-xs text-vscode-editor-foreground bg-red-900/10 p-2 rounded overflow-x-auto">
										<code>{step.originalCode}</code>
									</pre>
								</div>
							)}
							{/* 建议代码 */}
							<div>
								<div className="text-xs text-green-400 mb-1">+ 建议代码</div>
								<pre className="text-xs text-vscode-editor-foreground bg-green-900/10 p-2 rounded overflow-x-auto">
									<code>{step.suggestedCode}</code>
								</pre>
							</div>
						</div>
					) : (
						<div className="p-3">
							<div className="text-xs text-vscode-descriptionForeground mb-2">编辑代码</div>
							<textarea
								className="w-full bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded p-2 text-xs font-mono resize-y min-h-[100px]"
								value={modifiedCode}
								onChange={(e) => setModifiedCode(e.target.value)}
								autoFocus
								aria-label="Edit suggested code"
							/>
						</div>
					)}
				</div>
			</div>

			{/* 拒绝原因输入 */}
			{showRejectReason && (
				<div className="mb-3">
					<input
						type="text"
						className="w-full bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded px-2 py-1 text-sm"
						placeholder="请输入拒绝原因（可选）"
						value={rejectReason}
						onChange={(e) => setRejectReason(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleReject()
							} else if (e.key === "Escape") {
								setShowRejectReason(false)
								setRejectReason("")
							}
						}}
						autoFocus
						aria-label="Rejection reason"
					/>
				</div>
			)}

			{/* 操作按钮 */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					{!isEditing ? (
						<>
							<VSCodeButton onClick={onAccept} appearance="primary" aria-label="Accept edit (Tab key)">
								<span className="codicon codicon-check mr-1" />
								接受 (Tab)
							</VSCodeButton>
							<VSCodeButton
								onClick={() => setIsEditing(true)}
								appearance="secondary"
								aria-label="Modify code">
								<span className="codicon codicon-edit mr-1" />
								修改
							</VSCodeButton>
							<VSCodeButton
								onClick={handleReject}
								appearance="secondary"
								aria-label="Skip edit (Esc key)">
								<span className="codicon codicon-close mr-1" />
								跳过 (Esc)
							</VSCodeButton>
						</>
					) : (
						<>
							<VSCodeButton
								onClick={handleSaveModification}
								appearance="primary"
								aria-label="Save changes">
								<span className="codicon codicon-save mr-1" />
								保存
							</VSCodeButton>
							<VSCodeButton
								onClick={() => {
									setIsEditing(false)
									setModifiedCode(step.suggestedCode)
								}}
								appearance="secondary"
								aria-label="Cancel editing">
								取消
							</VSCodeButton>
						</>
					)}
				</div>

				{/* 置信度指示器 */}
				<div
					className="flex items-center gap-2"
					aria-label={`Confidence: ${Math.round(step.confidence * 100)}%`}>
					<span className="text-xs text-vscode-descriptionForeground">置信度</span>
					<div className="w-16 h-1.5 bg-vscode-editorWidget-border rounded overflow-hidden">
						<div
							className={`h-full ${getConfidenceColor()}`}
							style={{ width: `${step.confidence * 100}%` }}
							role="progressbar"
							aria-valuenow={step.confidence * 100}
							aria-valuemin={0}
							aria-valuemax={100}
						/>
					</div>
					<span className="text-xs text-vscode-descriptionForeground">
						{Math.round(step.confidence * 100)}%
					</span>
				</div>
			</div>
		</div>
	)
}
