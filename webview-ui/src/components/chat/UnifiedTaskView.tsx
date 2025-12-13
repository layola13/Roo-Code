import React from "react"
import { SubagentTabBar } from "./SubagentTabBar"
import { NextEditPanel } from "../next-edit/NextEditPanel"
import { ParallelSubAgentInfo } from "../../../../src/shared/ExtensionMessage"
import { EditChain, EditStep } from "../../../../src/memory/gsw/types/next-edit"

/**
 * UnifiedTaskView组件属性
 */
export interface UnifiedTaskViewProps {
	/** 并行子代理列表 */
	parallelSubagents: ParallelSubAgentInfo[]
	/** 当前活动的Tab ID */
	activeTabId: string
	/** Tab切换回调 */
	onTabChange: (id: string) => void
	/** Tab关闭回调 */
	onTabClose: (id: string) => void
	/** 编辑链数据 */
	editChain: EditChain | null
	/** 当前编辑步骤 */
	currentStep: EditStep | null
	/** 接受编辑回调 */
	onAcceptEdit: (step: EditStep) => void
	/** 拒绝编辑回调 */
	onRejectEdit: (step: EditStep, reason?: string) => void
	/** 修改编辑回调 */
	onModifyEdit: (step: EditStep, code: string) => void
}

/**
 * UnifiedTaskView - 统一任务视图组件
 *
 * 根据NextEdit设计文档的UI交互设计实现三层UI架构：
 * - Layer 1: 并行Slot标签栏（如果有并行任务）
 * - Layer 2: 编辑链进度（当前Slot的链进度）
 * - Layer 3: 当前步骤详情卡片
 *
 * 特性：
 * - 整合SubagentTabBar（用于并行任务）
 * - 整合NextEditPanel（用于编辑链）
 * - 支持Tab切换和关闭
 * - 响应式设计
 * - VSCode原生样式
 */
export const UnifiedTaskView: React.FC<UnifiedTaskViewProps> = ({
	parallelSubagents,
	activeTabId,
	onTabChange,
	onTabClose,
	editChain,
	currentStep,
	onAcceptEdit,
	onRejectEdit,
	onModifyEdit,
}) => {
	// 如果既没有并行任务也没有编辑链，不显示任何内容
	if (parallelSubagents.length === 0 && !editChain) {
		return null
	}

	return (
		<div className="flex flex-col w-full" role="region" aria-label="Unified Task View">
			{/* Layer 1: 并行Slot标签栏（如果有并行任务）*/}
			{parallelSubagents.length > 0 && (
				<SubagentTabBar
					subagents={parallelSubagents}
					activeTabId={activeTabId}
					onTabChange={onTabChange}
					onTabClose={onTabClose}
				/>
			)}

			{/* Layer 2 & 3: NextEdit面板（编辑链进度 + 当前步骤详情）*/}
			{editChain && (
				<NextEditPanel
					chain={editChain}
					currentStep={currentStep}
					onAccept={onAcceptEdit}
					onReject={onRejectEdit}
					onModify={onModifyEdit}
				/>
			)}
		</div>
	)
}
