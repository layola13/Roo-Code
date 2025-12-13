import { render, screen } from "@testing-library/react"
import { SubagentContextBanner } from "../SubagentContextBanner"

describe("SubagentContextBanner", () => {
	const defaultProps = {
		agentId: "agent-1",
		agentName: "TestAgent",
		model: "claude-3-haiku",
		status: "running" as const,
	}

	it("renders with agent name and context label", () => {
		render(<SubagentContextBanner {...defaultProps} />)

		expect(screen.getByText(/TestAgent Context/)).toBeInTheDocument()
	})

	it("displays agent ID and model", () => {
		render(<SubagentContextBanner {...defaultProps} />)

		expect(screen.getByText(/ID: agent-1 • claude-3-haiku/)).toBeInTheDocument()
	})

	it("displays default memory limit", () => {
		render(<SubagentContextBanner {...defaultProps} />)

		expect(screen.getByText("Isolated Memory: 200k")).toBeInTheDocument()
	})

	it("displays custom memory limit when provided", () => {
		render(<SubagentContextBanner {...defaultProps} memoryLimit="500k" />)

		expect(screen.getByText("Isolated Memory: 500k")).toBeInTheDocument()
	})

	it("shows spinning icon when status is running", () => {
		render(<SubagentContextBanner {...defaultProps} status="running" />)

		const spinningIcon = screen.getByText("⟳")
		expect(spinningIcon).toBeInTheDocument()
		expect(spinningIcon.className).toContain("animate-spin")
	})

	it("shows static icon when status is not running", () => {
		render(<SubagentContextBanner {...defaultProps} status="completed" />)

		const staticIcon = screen.getByText("📟")
		expect(staticIcon).toBeInTheDocument()
		expect(staticIcon.className).not.toContain("animate-spin")
	})

	it("shows static icon when status is queued", () => {
		render(<SubagentContextBanner {...defaultProps} status="queued" />)

		const staticIcon = screen.getByText("📟")
		expect(staticIcon).toBeInTheDocument()
	})

	it("shows static icon when status is failed", () => {
		render(<SubagentContextBanner {...defaultProps} status="failed" />)

		const staticIcon = screen.getByText("📟")
		expect(staticIcon).toBeInTheDocument()
	})

	it("has gradient background styling", () => {
		const { container } = render(<SubagentContextBanner {...defaultProps} />)

		const banner = container.firstChild as HTMLElement
		expect(banner.className).toContain("bg-gradient-to-r")
		expect(banner.className).toContain("from-blue-600/10")
	})

	it("has sticky positioning", () => {
		const { container } = render(<SubagentContextBanner {...defaultProps} />)

		const banner = container.firstChild as HTMLElement
		expect(banner.className).toContain("sticky")
		expect(banner.className).toContain("top-0")
	})

	it("has border styling", () => {
		const { container } = render(<SubagentContextBanner {...defaultProps} />)

		const banner = container.firstChild as HTMLElement
		expect(banner.className).toContain("border-b")
		expect(banner.className).toContain("border-blue-500/30")
	})

	it("renders with different agent names", () => {
		const { rerender } = render(<SubagentContextBanner {...defaultProps} agentName="Agent1" />)

		expect(screen.getByText(/Agent1 Context/)).toBeInTheDocument()

		rerender(<SubagentContextBanner {...defaultProps} agentName="SecurityScanner" />)

		expect(screen.getByText(/SecurityScanner Context/)).toBeInTheDocument()
	})

	it("renders with different models", () => {
		const { rerender } = render(<SubagentContextBanner {...defaultProps} model="claude-3-sonnet" />)

		expect(screen.getByText(/claude-3-sonnet/)).toBeInTheDocument()

		rerender(<SubagentContextBanner {...defaultProps} model="claude-3-opus" />)

		expect(screen.getByText(/claude-3-opus/)).toBeInTheDocument()
	})
})
