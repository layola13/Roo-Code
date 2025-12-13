import React, { useState, useEffect, useRef, useCallback } from "react"
import { ChevronRight, ChevronLeft } from "lucide-react"
import { SubagentTab } from "./SubagentTab"
import { ParallelSubAgentInfo } from "../../../../src/shared/ExtensionMessage"

interface SubagentTabBarProps {
	subagents: ParallelSubAgentInfo[]
	activeTabId: string
	onTabChange: (id: string) => void
	onTabClose: (id: string) => void
}

/**
 * SubagentTabBar - 并行子代理Tab栏组件
 *
 * 功能：
 * - 显示主任务Tab + 所有子代理Tab
 * - 横向滚动支持（超出宽度时显示左右箭头）
 * - 队列指示器（显示"+N in Queue"）
 * - 响应式设计，自动检测滚动状态
 * - 支持Tab切换和关闭
 */
export const SubagentTabBar: React.FC<SubagentTabBarProps> = ({ subagents, activeTabId, onTabChange, onTabClose }) => {
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const [canScrollLeft, setCanScrollLeft] = useState(false)
	const [canScrollRight, setCanScrollRight] = useState(false)

	// 计算队列中的数量
	const queuedCount = subagents.filter((a) => a.status === "queued").length

	// 检查滚动状态
	const checkScroll = useCallback(() => {
		const el = scrollContainerRef.current
		if (el) {
			const { scrollLeft, scrollWidth, clientWidth } = el
			// 使用 1px 的容差
			setCanScrollLeft(scrollLeft > 1)
			setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
		}
	}, [])

	// 监听窗口大小变化和subagents变化
	useEffect(() => {
		checkScroll()
		window.addEventListener("resize", checkScroll)
		return () => window.removeEventListener("resize", checkScroll)
	}, [checkScroll, subagents])

	// 平滑滚动
	const scroll = (direction: "left" | "right") => {
		const el = scrollContainerRef.current
		if (el) {
			const scrollAmount = 200 // 每次滚动的像素距离
			el.scrollBy({
				left: direction === "left" ? -scrollAmount : scrollAmount,
				behavior: "smooth",
			})
		}
	}

	return (
		<div className="relative flex items-center bg-vscode-tab-inactiveBackground border-b border-vscode-editorGroup-border h-[36px] w-full group/tabbar">
			{/* 左滚动按钮 */}
			{canScrollLeft && (
				<button
					onClick={() => scroll("left")}
					className="absolute left-0 top-0 bottom-0 z-20 px-1 bg-vscode-tab-inactiveBackground shadow-[2px_0_5px_rgba(0,0,0,0.3)] hover:bg-vscode-toolbar-hoverBackground text-vscode-foreground flex items-center justify-center transition-colors border-r border-vscode-editorGroup-border"
					aria-label="Scroll left">
					<ChevronLeft size={14} />
				</button>
			)}

			{/* 可滚动容器（隐藏滚动条） */}
			<div
				ref={scrollContainerRef}
				onScroll={checkScroll}
				className="flex items-center gap-1 px-3 h-full overflow-x-auto select-none w-full scrollbar-hide">
				{/* 主任务Tab */}
				<SubagentTab
					id="main"
					name="Main Task"
					status="running"
					isActive={activeTabId === "main"}
					isMain={true}
					onClick={() => onTabChange("main")}
				/>

				{/* 分隔符 */}
				{subagents.length > 0 && <div className="w-[1px] h-4 bg-vscode-editorGroup-border mx-1 shrink-0" />}

				{/* 子代理Tabs */}
				{subagents.map((agent) => (
					<SubagentTab
						key={agent.id}
						id={agent.id}
						name={agent.name}
						status={agent.status}
						progress={agent.progress}
						model={agent.model}
						isActive={activeTabId === agent.id}
						onClick={() => onTabChange(agent.id)}
						onClose={() => onTabClose(agent.id)}
					/>
				))}

				{/* 队列指示器 - 保持在末尾 */}
				{queuedCount > 0 && (
					<div className="flex items-center gap-1.5 px-2 py-1 ml-auto text-xs text-vscode-descriptionForeground animate-pulse whitespace-nowrap">
						<span className="font-mono font-bold">+{queuedCount}</span>
						<span>in Queue</span>
					</div>
				)}
			</div>

			{/* 右滚动按钮 */}
			{canScrollRight && (
				<button
					onClick={() => scroll("right")}
					className="absolute right-0 top-0 bottom-0 z-20 px-1 bg-vscode-tab-inactiveBackground shadow-[-2px_0_5px_rgba(0,0,0,0.3)] hover:bg-vscode-toolbar-hoverBackground text-vscode-foreground flex items-center justify-center transition-colors border-l border-vscode-editorGroup-border"
					aria-label="Scroll right">
					<ChevronRight size={14} />
				</button>
			)}
		</div>
	)
}
