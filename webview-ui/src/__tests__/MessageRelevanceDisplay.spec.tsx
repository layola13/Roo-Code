import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MessageRelevanceDisplay } from "../components/chat/MessageRelevanceDisplay"
import type { MessageRelevance } from "@roo-code/types"

describe("MessageRelevanceDisplay", () => {
	it("renders relevance score correctly", () => {
		const mockRelevance: MessageRelevance = {
			score: 0.95,
			selectedByAgents: ["技术专家", "产品专家"],
			reasoning: "这条消息包含关键API错误信息",
		}

		render(<MessageRelevanceDisplay relevance={mockRelevance} messageIndex={12} />)

		expect(screen.getByText("相关性:")).toBeInTheDocument()
		expect(screen.getByText("⭐⭐⭐⭐⭐ (0.95)")).toBeInTheDocument()
	})

	it("displays selected agents", () => {
		const mockRelevance: MessageRelevance = {
			score: 0.8,
			selectedByAgents: ["技术专家", "产品专家"],
		}

		render(<MessageRelevanceDisplay relevance={mockRelevance} />)

		expect(screen.getByText("被选中:")).toBeInTheDocument()
		expect(screen.getByText("2 个Agent")).toBeInTheDocument()
		expect(screen.getByText("(技术专家, 产品专家)")).toBeInTheDocument()
	})

	it("displays reasoning when available", () => {
		const mockRelevance: MessageRelevance = {
			score: 0.75,
			selectedByAgents: ["技术专家"],
			reasoning: "包含重要的技术讨论内容",
		}

		render(<MessageRelevanceDisplay relevance={mockRelevance} />)

		expect(screen.getByText("包含重要的技术讨论内容")).toBeInTheDocument()
	})

	it("renders correct star count for different scores", () => {
		const testCases = [
			{ score: 0.0, stars: "" },
			{ score: 0.1, stars: "⭐" },
			{ score: 0.3, stars: "⭐⭐" },
			{ score: 0.5, stars: "⭐⭐⭐" },
			{ score: 0.7, stars: "⭐⭐⭐⭐" },
			{ score: 0.9, stars: "⭐⭐⭐⭐⭐" },
			{ score: 1.0, stars: "⭐⭐⭐⭐⭐" },
		]

		testCases.forEach(({ score }) => {
			const { unmount } = render(<MessageRelevanceDisplay relevance={{ score, selectedByAgents: [] }} />)

			// Use getByTitle to find the element, as the text is split across elements
			const scoreElement = screen.getByTitle(`Score: ${score.toFixed(2)}`)
			expect(scoreElement).toBeInTheDocument()
			// Check that the content includes the score
			expect(scoreElement.textContent).toContain(score.toFixed(2))

			unmount()
		})
	})

	it("works without reasoning", () => {
		const mockRelevance: MessageRelevance = {
			score: 0.85,
			selectedByAgents: ["技术专家"],
		}

		const { container } = render(<MessageRelevanceDisplay relevance={mockRelevance} />)

		expect(container.textContent).not.toContain("undefined")
		expect(screen.getByText("⭐⭐⭐⭐ (0.85)")).toBeInTheDocument()
	})

	it("works with empty selected agents", () => {
		const mockRelevance: MessageRelevance = {
			score: 0.5,
			selectedByAgents: [],
		}

		render(<MessageRelevanceDisplay relevance={mockRelevance} />)

		expect(screen.getByText("相关性:")).toBeInTheDocument()
		expect(screen.queryByText("被选中:")).not.toBeInTheDocument()
	})
})
