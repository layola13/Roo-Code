import React from "react"
import { EditChain, EditStep } from "../../../../src/memory/gsw/types/next-edit"
import { EditStepCard } from "./EditStepCard"
import { EditChainProgress } from "./EditChainProgress"

/**
 * NextEditPanel组件属性
 */
export interface NextEditPanelProps {
	/** 编辑链数据 */
	chain: EditChain | null
	/** 当前编辑步骤 */
	currentStep: EditStep | null
	/** 接受编辑回调 */
	onAccept: (step: EditStep) => void
	/** 拒绝编辑回调 */
	onReject: (step: EditStep, reason?: string) => void
	/** 修改编辑回调 */
	onModify: (step: EditStep, code: string) => void
}

/**
 * NextEdit主面板组件
 *
 * 根据NextEdit设计文档的UI交互设计实现：
 * - Layer 2: Edit Chain Progress (编辑链进度指示器)
 * - Layer 3: Current Step Card (当前步骤详情卡片)
 *
 * 支持快捷键：
 * - Tab: 接受当前步骤
 * - Esc: 跳过当前步骤
 */
export const NextEditPanel: React.FC<NextEditPanelProps> = ({ chain, currentStep, onAccept, onReject, onModify }) => {
	// 快捷键处理
	React.useEffect(() => {
		if (!chain || !currentStep) return

		const handleKeyDown = (event: KeyboardEvent) => {
			// Tab键：接受当前步骤
			if (event.key === "Tab" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
				event.preventDefault()
				onAccept(currentStep)
			}
			// Esc键：跳过当前步骤
			else if (event.key === "Escape") {
				event.preventDefault()
				onReject(currentStep)
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [chain, currentStep, onAccept, onReject])

	// 如果没有编辑链，不渲染任何内容
	if (!chain) {
		return null
	}

	return (
		<div className="flex flex-col gap-3 px-3 py-2" role="region" aria-label="Next Edit Panel">
			{/* 编辑链进度指示器 */}
			{chain && (
				<EditChainProgress
					steps={chain.steps}
					currentIndex={chain.currentIndex}
					totalSteps={chain.steps.length}
				/>
			)}

			{/* 当前步骤卡片 */}
			{currentStep && (
				<EditStepCard
					step={currentStep}
					onAccept={() => onAccept(currentStep)}
					onReject={(reason) => onReject(currentStep, reason)}
					onModify={(code) => onModify(currentStep, code)}
				/>
			)}
		</div>
	)
}
