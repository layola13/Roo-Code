import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { SubagentTabBar } from "../SubagentTabBar"
import { ParallelSubAgentInfo } from "../../../../../src/shared/ExtensionMessage"

describe("SubagentTabBar", () => {
	const mockSubagents: ParallelSubAgentInfo[] = [
		{
			id: "agent-1",
			name: "ContextAnalyzer",
			status: "running",
			progress: 50,
			model: "claude-3-haiku",
		},
		{
			id: "agent-2",
			name: "SecurityScanner",
			status: "queued",
			progress: 0,
			model: "claude-3-sonnet",
		},
		{
			id: "agent-3",
			name: "TestGenerator",
			status: "completed",
			progress: 100,
			model: "claude-3-opus",
		},
	]

	let onTabChange: ReturnType<typeof vi.fn>
	let onTabClose: ReturnType<typeof vi.fn>

	beforeEach(() => {
		onTabChange = vi.fn()
		onTabClose = vi.fn()
	})

	it("应该渲染主任务Tab和所有子代理Tabs", () => {
		render(
			<SubagentTabBar
				subagents={mockSubagents}
				activeTabId="main"
				onTabChange={onTabChange}
				onTabClose={onTabClose}
			/>,
		)

		// 主任务Tab
		expect(screen.getByText("Main Task")).toBeInTheDocument()

		// 所有子代理Tabs
		expect(screen.getByText("ContextAnalyzer")).toBeInTheDocument()
		expect(screen.getByText("SecurityScanner")).toBeInTheDocument()
		expect(screen.getByText("TestGenerator")).toBeInTheDocument()
	})

	it("应该显示队列指示器", () => {
		render(
			<SubagentTabBar
				subagents={mockSubagents}
				activeTabId="main"
				onTabChange={onTabChange}
				onTabClose={onTabClose}
			/>,
		)

		// 应该显示"+1 in Queue"（一个queued状态的agent）
		expect(screen.getByText("+1")).toBeInTheDocument()
		expect(screen.getByText("in Queue")).toBeInTheDocument()
	})

	it("没有队列时不应该显示队列指示器", () => {
		const noQueuedAgents = mockSubagents.map((a) => ({ ...a, status: "running" as const }))

		render(
			<SubagentTabBar
				subagents={noQueuedAgents}
				activeTabId="main"
				onTabChange={onTabChange}
				onTabClose={onTabClose}
			/>,
		)

		// 不应该显示队列指示器
		expect(screen.queryByText("in Queue")).not.toBeInTheDocument()
	})

	it("点击Tab应该调用onTabChange", () => {
		render(
			<SubagentTabBar
				subagents={mockSubagents}
				activeTabId="main"
				onTabChange={onTabChange}
				onTabClose={onTabClose}
			/>,
		)

		const contextAnalyzerTab = screen.getByText("ContextAnalyzer").closest("div")
		fireEvent.click(contextAnalyzerTab!)

		expect(onTabChange).toHaveBeenCalledWith("agent-1")
	})

	it("点击主任务Tab应该切换到main", () => {
		render(
			<SubagentTabBar
				subagents={mockSubagents}
				activeTabId="agent-1"
				onTabChange={onTabChange}
				onTabClose={onTabClose}
			/>,
		)

		const mainTab = screen.getByText("Main Task").closest("div")
		fireEvent.click(mainTab!)

		expect(onTabChange).toHaveBeenCalledWith("main")
	})

	it("关闭Tab应该调用onTabClose", () => {
		render(
			<SubagentTabBar
				subagents={mockSubagents}
				activeTabId="main"
				onTabChange={onTabChange}
				onTabClose={onTabClose}
			/>,
		)

		// 找到第一个子代理的关闭按钮
		const closeButtons = screen.getAllByRole("button", { name: "Close tab" })
		fireEvent.click(closeButtons[0])

		expect(onTabClose).toHaveBeenCalledWith("agent-1")
	})

	it("没有子代理时不应该显示分隔符", () => {
		const { container } = render(
			<SubagentTabBar subagents={[]} activeTabId="main" onTabChange={onTabChange} onTabClose={onTabClose} />,
		)

		// 主任务Tab应该存在
		expect(screen.getByText("Main Task")).toBeInTheDocument()

		// 分隔符不应该存在
		const separator = container.querySelector(".bg-vscode-editorGroup-border.mx-1")
		expect(separator).not.toBeInTheDocument()
	})

	it("有子代理时应该显示分隔符", () => {
		const { container } = render(
			<SubagentTabBar
				subagents={mockSubagents}
				activeTabId="main"
				onTabChange={onTabChange}
				onTabClose={onTabClose}
			/>,
		)

		// 分隔符应该存在
		const separator = container.querySelector(".bg-vscode-editorGroup-border.mx-1")
		expect(separator).toBeInTheDocument()
	})

	it("应该正确计算运行中和队列中的数量", () => {
		const mixedAgents: ParallelSubAgentInfo[] = [
			{ id: "1", name: "A1", status: "running", progress: 50, model: "m1" },
			{ id: "2", name: "A2", status: "running", progress: 30, model: "m2" },
			{ id: "3", name: "A3", status: "queued", progress: 0, model: "m3" },
			{ id: "4", name: "A4", status: "queued", progress: 0, model: "m4" },
			{ id: "5", name: "A5", status: "completed", progress: 100, model: "m5" },
		]

		render(
			<SubagentTabBar
				subagents={mixedAgents}
				activeTabId="main"
				onTabChange={onTabChange}
				onTabClose={onTabClose}
			/>,
		)

		// 应该显示"+2 in Queue"
		expect(screen.getByText("+2")).toBeInTheDocument()
		expect(screen.getByText("in Queue")).toBeInTheDocument()
	})

	it("滚动容器应该有正确的样式类", () => {
		const { container } = render(
			<SubagentTabBar
				subagents={mockSubagents}
				activeTabId="main"
				onTabChange={onTabChange}
				onTabClose={onTabClose}
			/>,
		)

		const scrollContainer = container.querySelector(".scrollbar-hide")
		expect(scrollContainer).toBeInTheDocument()
		expect(scrollContainer).toHaveClass("overflow-x-auto")
	})

	it("激活的Tab应该正确高亮", () => {
		const { container } = render(
			<SubagentTabBar
				subagents={mockSubagents}
				activeTabId="agent-1"
				onTabChange={onTabChange}
				onTabClose={onTabClose}
			/>,
		)

		const activeTab = container.querySelector(".bg-vscode-editor-background.border-t-blue-500")
		expect(activeTab).toBeInTheDocument()
		expect(activeTab).toHaveTextContent("ContextAnalyzer")
	})

	it("多个队列项应该显示正确的数量", () => {
		const manyQueuedAgents: ParallelSubAgentInfo[] = Array.from({ length: 5 }, (_, i) => ({
			id: `agent-${i}`,
			name: `Agent${i}`,
			status: "queued" as const,
			progress: 0,
			model: "claude-3-haiku",
		}))

		render(
			<SubagentTabBar
				subagents={manyQueuedAgents}
				activeTabId="main"
				onTabChange={onTabChange}
				onTabClose={onTabClose}
			/>,
		)

		// 应该显示"+5 in Queue"
		expect(screen.getByText("+5")).toBeInTheDocument()
		expect(screen.getByText("in Queue")).toBeInTheDocument()
	})
})
