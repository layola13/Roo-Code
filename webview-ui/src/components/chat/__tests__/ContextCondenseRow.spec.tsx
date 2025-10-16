// npx vitest src/components/chat/__tests__/ContextCondenseRow.spec.tsx

import React from "react"
import { render, screen, fireEvent } from "@/utils/test-utils"

import type { ContextCondense } from "@roo-code/types"

import { ContextCondenseRow, CondensingContextRow, CondenseContextErrorRow } from "../ContextCondenseRow"

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: any) => {
			// Handle keys with parameters
			if (key === "tokens" && params) {
				return "tokens"
			}
			return key
		},
	}),
}))

// Mock the VSCodeBadge component
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeBadge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
		<div data-testid="vscode-badge" className={className}>
			{children}
		</div>
	),
}))

// Mock the Markdown component
vi.mock("../Markdown", () => ({
	Markdown: ({ markdown }: { markdown: string }) => <div data-testid="markdown">{markdown}</div>,
}))

// Mock the ProgressIndicator component
vi.mock("../ProgressIndicator", () => ({
	ProgressIndicator: () => <div data-testid="progress-indicator">Loading...</div>,
}))

describe("ContextCondenseRow", () => {
	const baseProps: ContextCondense = {
		cost: 0.05,
		prevContextTokens: 10000,
		newContextTokens: 5000,
		summary: "Test summary of the conversation",
	}

	it("should render basic compression statistics", () => {
		render(<ContextCondenseRow {...baseProps} />)

		expect(screen.getByText("chat:contextCondense.title")).toBeInTheDocument()
		expect(screen.getByText(/10,000/)).toBeInTheDocument()
		expect(screen.getByText(/5,000/)).toBeInTheDocument()
		expect(screen.getByText("$0.05")).toBeInTheDocument()
	})

	it("should calculate and display compression ratio", () => {
		render(<ContextCondenseRow {...baseProps} />)

		// Compression ratio should be 50% ((10000-5000)/10000 * 100)
		expect(screen.getByText("-50.0%")).toBeInTheDocument()
	})

	it("should expand and show detailed statistics when clicked", () => {
		render(<ContextCondenseRow {...baseProps} />)

		// Initially, detailed stats should not be visible
		expect(screen.queryByText("chat:contextCondense.statistics")).not.toBeInTheDocument()

		// Click to expand
		const header = screen.getByText("chat:contextCondense.title")
		fireEvent.click(header.closest("div")!)

		// Now detailed stats should be visible
		expect(screen.getByText("chat:contextCondense.statistics")).toBeInTheDocument()
		expect(screen.getByText(/chat:contextCondense\.before/)).toBeInTheDocument()
		expect(screen.getByText(/chat:contextCondense\.after/)).toBeInTheDocument()
		expect(screen.getByText("chat:contextCondense.summary")).toBeInTheDocument()
		expect(screen.getByTestId("markdown")).toHaveTextContent("Test summary of the conversation")
	})

	it("should display subagent badge when subAgentTokenUsage is provided", () => {
		const propsWithSubAgents: ContextCondense = {
			...baseProps,
			subAgentTokenUsage: [
				{
					agentName: "Context Analyzer",
					tokensIn: 1000,
					tokensOut: 500,
					cost: 0.015,
				},
				{
					agentName: "Memory Extractor",
					tokensIn: 1000,
					tokensOut: 500,
					cost: 0.015,
				},
				{
					agentName: "Code Summarizer",
					tokensIn: 1000,
					tokensOut: 500,
					cost: 0.02,
				},
			],
		}

		render(<ContextCondenseRow {...propsWithSubAgents} />)

		// Should show subagent count badge
		const badges = screen.getAllByTestId("vscode-badge")
		const subAgentBadge = badges.find((badge) => badge.textContent?.includes("3"))
		expect(subAgentBadge).toBeInTheDocument()
		expect(subAgentBadge).toHaveTextContent("chat:contextCondense.subAgents")
	})

	it("should show subagent details when expanded with subAgentTokenUsage", () => {
		const propsWithSubAgents: ContextCondense = {
			...baseProps,
			subAgentTokenUsage: [
				{
					agentName: "Context Analyzer",
					tokensIn: 1000,
					tokensOut: 500,
					cost: 0.015,
				},
				{
					agentName: "Memory Extractor",
					tokensIn: 1000,
					tokensOut: 500,
					cost: 0.015,
				},
				{
					agentName: "Code Summarizer",
					tokensIn: 1000,
					tokensOut: 500,
					cost: 0.02,
				},
			],
		}

		render(<ContextCondenseRow {...propsWithSubAgents} />)

		// Click to expand
		const header = screen.getByText("chat:contextCondense.title")
		fireEvent.click(header.closest("div")!)

		// Check subagent details are shown
		expect(screen.getByText("chat:contextCondense.subAgentDetails")).toBeInTheDocument()
		expect(screen.getByText("Context Analyzer")).toBeInTheDocument()
		expect(screen.getByText("Memory Extractor")).toBeInTheDocument()
		expect(screen.getByText("Code Summarizer")).toBeInTheDocument()
	})

	it("should show success status icon for subagents with output", () => {
		const propsWithSubAgents: ContextCondense = {
			...baseProps,
			subAgentTokenUsage: [
				{
					agentName: "Context Analyzer",
					tokensIn: 1000,
					tokensOut: 500,
					cost: 0.015,
				},
			],
		}

		render(<ContextCondenseRow {...propsWithSubAgents} />)

		// Click to expand
		const header = screen.getByText("chat:contextCondense.title")
		fireEvent.click(header.closest("div")!)

		// Check for success icon (codicon-check)
		const successIcons = document.querySelectorAll(".codicon-check")
		expect(successIcons.length).toBeGreaterThan(0)
	})

	it("should show inactive status icon for subagents without output", () => {
		const propsWithSubAgents: ContextCondense = {
			...baseProps,
			subAgentTokenUsage: [
				{
					agentName: "Inactive Agent",
					tokensIn: 0,
					tokensOut: 0,
					cost: 0,
				},
			],
		}

		render(<ContextCondenseRow {...propsWithSubAgents} />)

		// Click to expand
		const header = screen.getByText("chat:contextCondense.title")
		fireEvent.click(header.closest("div")!)

		// Check for inactive icon (codicon-circle-slash)
		const inactiveIcons = document.querySelectorAll(".codicon-circle-slash")
		expect(inactiveIcons.length).toBeGreaterThan(0)
	})

	it("should handle null/undefined token values gracefully", () => {
		const propsWithNulls: ContextCondense = {
			cost: null as any,
			prevContextTokens: null as any,
			newContextTokens: null as any,
			summary: "Test summary",
		}

		render(<ContextCondenseRow {...propsWithNulls} />)

		// Should render with 0 values - text is split across elements
		const container = screen.getByText("chat:contextCondense.title").closest(".mb-2")
		expect(container).toHaveTextContent("0")
		expect(container).toHaveTextContent("$0.00")
	})

	it("should toggle expansion state when clicked multiple times", () => {
		render(<ContextCondenseRow {...baseProps} />)

		const header = screen.getByText("chat:contextCondense.title")
		const clickableDiv = header.closest("div")!

		// Initially collapsed
		expect(screen.queryByText("chat:contextCondense.statistics")).not.toBeInTheDocument()

		// First click - expand
		fireEvent.click(clickableDiv)
		expect(screen.getByText("chat:contextCondense.statistics")).toBeInTheDocument()

		// Second click - collapse
		fireEvent.click(clickableDiv)
		expect(screen.queryByText("chat:contextCondense.statistics")).not.toBeInTheDocument()
	})
})

describe("CondensingContextRow", () => {
	it("should render progress indicator and message", () => {
		render(<CondensingContextRow />)

		expect(screen.getByTestId("progress-indicator")).toBeInTheDocument()
		expect(screen.getByText("chat:contextCondense.condensing")).toBeInTheDocument()
	})
})

describe("CondenseContextErrorRow", () => {
	it("should render error header", () => {
		render(<CondenseContextErrorRow />)

		expect(screen.getByText("chat:contextCondense.errorHeader")).toBeInTheDocument()
	})

	it("should render error text when provided", () => {
		const errorText = "Failed to condense: API error"
		render(<CondenseContextErrorRow errorText={errorText} />)

		expect(screen.getByText("chat:contextCondense.errorHeader")).toBeInTheDocument()
		expect(screen.getByText(errorText)).toBeInTheDocument()
	})

	it("should not render error text when not provided", () => {
		render(<CondenseContextErrorRow />)

		// Should only have the header
		const container = screen.getByText("chat:contextCondense.errorHeader").parentElement
		expect(container?.children.length).toBe(2) // Only header div and (possibly empty) text span
	})
})
