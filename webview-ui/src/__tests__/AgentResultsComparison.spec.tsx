import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { AgentResultsComparison } from "../components/chat/AgentResultsComparison"
import type { AgentSearchResult } from "@roo-code/types"

describe("AgentResultsComparison", () => {
	const mockAgentResults: AgentSearchResult[] = [
		{
			agentName: "技术专家Agent",
			selectedIndices: [5, 12, 18],
			relevanceScores: { 5: 0.8, 12: 0.95, 18: 0.7 },
			reasoning: "这些消息包含API错误讨论",
			executionTime: 234,
		},
		{
			agentName: "产品专家Agent",
			selectedIndices: [12, 20, 25],
			relevanceScores: { 12: 0.9, 20: 0.85, 25: 0.75 },
			reasoning: "涉及产品功能变更",
			executionTime: 189,
		},
	]

	it("renders agent results comparison header", () => {
		render(
			<AgentResultsComparison
				agentResults={mockAgentResults}
				selectedIndices={[5, 12, 18, 20, 25]}
				conflictedIndices={[12]}
			/>,
		)

		expect(screen.getByText("🤖 Agent检索结果对比")).toBeInTheDocument()
		expect(screen.getByText("(2 个Agent)")).toBeInTheDocument()
	})

	it("expands and collapses when clicked", () => {
		render(<AgentResultsComparison agentResults={mockAgentResults} selectedIndices={[5, 12, 18, 20, 25]} />)

		const header = screen.getByText("🤖 Agent检索结果对比")

		// Initially collapsed
		expect(screen.queryByText("技术专家Agent:")).not.toBeInTheDocument()

		// Click to expand
		fireEvent.click(header)
		expect(screen.getByText("技术专家Agent:")).toBeInTheDocument()
		expect(screen.getByText("产品专家Agent:")).toBeInTheDocument()

		// Click to collapse
		fireEvent.click(header)
		expect(screen.queryByText("技术专家Agent:")).not.toBeInTheDocument()
	})

	it("displays agent results when expanded", () => {
		render(<AgentResultsComparison agentResults={mockAgentResults} selectedIndices={[5, 12, 18, 20, 25]} />)

		fireEvent.click(screen.getByText("🤖 Agent检索结果对比"))

		expect(screen.getByText("技术专家Agent:")).toBeInTheDocument()
		expect(screen.getByText("耗时 234ms")).toBeInTheDocument()
		expect(screen.getByText("这些消息包含API错误讨论")).toBeInTheDocument()

		expect(screen.getByText("产品专家Agent:")).toBeInTheDocument()
		expect(screen.getByText("耗时 189ms")).toBeInTheDocument()
		expect(screen.getByText("涉及产品功能变更")).toBeInTheDocument()
	})

	it("displays final decision", () => {
		render(<AgentResultsComparison agentResults={mockAgentResults} selectedIndices={[5, 12, 18, 20, 25]} />)

		fireEvent.click(screen.getByText("🤖 Agent检索结果对比"))

		expect(screen.getByText("裁判最终决策:")).toBeInTheDocument()
		expect(screen.getByText("5 条消息")).toBeInTheDocument()
		expect(screen.getByText("msg#5, msg#12, msg#18, msg#20, msg#25")).toBeInTheDocument()
	})

	it("displays conflicted indices when available", () => {
		render(
			<AgentResultsComparison
				agentResults={mockAgentResults}
				selectedIndices={[5, 12, 18, 20, 25]}
				conflictedIndices={[12]}
			/>,
		)

		fireEvent.click(screen.getByText("🤖 Agent检索结果对比"))

		expect(screen.getByText("重复消息:")).toBeInTheDocument()
		// Use getAllByText since msg#12 appears multiple times in the rendered output
		const msg12Elements = screen.getAllByText(/msg#12/)
		expect(msg12Elements.length).toBeGreaterThan(0)
		expect(screen.getByText("(多个Agent都选中，相关性高)")).toBeInTheDocument()
	})

	it("returns null when no agent results", () => {
		const { container } = render(<AgentResultsComparison agentResults={[]} selectedIndices={[]} />)

		expect(container.firstChild).toBeNull()
	})
})
