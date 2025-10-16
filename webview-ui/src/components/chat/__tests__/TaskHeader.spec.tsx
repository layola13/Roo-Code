// npx vitest src/components/chat/__tests__/TaskHeader.spec.tsx

import React from "react"
import { render, screen, fireEvent } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type { ProviderSettings } from "@roo-code/types"

import TaskHeader, { TaskHeaderProps } from "../TaskHeader"

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: any) => {
			// Handle number formatting keys
			if (key === "number_format.thousand_suffix") return "K"
			if (key === "number_format.million_suffix") return "M"
			// Handle other keys with interpolation
			if (options && typeof options === "object") {
				return key.replace(/\{\{(\w+)\}\}/g, (_, k) => options[k] || "")
			}
			return key
		},
	}),
	// Mock initReactI18next to prevent initialization errors in tests
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
}))

// Mock the vscode API
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock i18next for formatLargeNumber
vi.mock("i18next", () => ({
	default: {
		t: (key: string) => {
			if (key === "common:number_format.thousand_suffix") return "K"
			if (key === "common:number_format.million_suffix") return "M"
			if (key === "common:number_format.billion_suffix") return "B"
			return key
		},
		language: "en",
		use: vi.fn().mockReturnThis(),
		init: vi.fn().mockResolvedValue(undefined),
	},
}))

// Mock the VSCodeBadge component
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeBadge: ({ children }: { children: React.ReactNode }) => <div data-testid="vscode-badge">{children}</div>,
}))

// Create a variable to hold the mock state
let mockExtensionState: {
	apiConfiguration: ProviderSettings
	currentTaskItem: { id: string } | null
	clineMessages: any[]
} = {
	apiConfiguration: {
		apiProvider: "anthropic",
		apiKey: "test-api-key",
		apiModelId: "claude-3-opus-20240229",
	} as ProviderSettings,
	currentTaskItem: { id: "test-task-id" },
	clineMessages: [],
}

// Mock the ExtensionStateContext
vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => mockExtensionState,
}))

// Mock the useCloudUpsell hook
vi.mock("@src/hooks/useCloudUpsell", () => ({
	useCloudUpsell: () => ({
		isOpen: false,
		openUpsell: vi.fn(),
		closeUpsell: vi.fn(),
		handleConnect: vi.fn(),
	}),
}))

// Mock DismissibleUpsell component
vi.mock("@src/components/common/DismissibleUpsell", () => ({
	default: ({ children, ...props }: any) => (
		<div data-testid="dismissible-upsell" {...props}>
			{children}
		</div>
	),
}))

// Mock CloudUpsellDialog component
vi.mock("@src/components/cloud/CloudUpsellDialog", () => ({
	CloudUpsellDialog: () => null,
}))

// Mock findLastIndex from @roo/array
vi.mock("@roo/array", () => ({
	findLastIndex: (array: any[], predicate: (item: any) => boolean) => {
		for (let i = array.length - 1; i >= 0; i--) {
			if (predicate(array[i])) {
				return i
			}
		}
		return -1
	},
}))

describe("TaskHeader", () => {
	const defaultProps: TaskHeaderProps = {
		task: { type: "say", ts: Date.now(), text: "Test task", images: [] },
		tokensIn: 100,
		tokensOut: 50,
		totalCost: 0.05,
		contextTokens: 200,
		buttonsDisabled: false,
		handleCondenseContext: vi.fn(),
	}

	const queryClient = new QueryClient()

	const renderTaskHeader = (props: Partial<TaskHeaderProps> = {}) => {
		return render(
			<QueryClientProvider client={queryClient}>
				<TaskHeader {...defaultProps} {...props} />
			</QueryClientProvider>,
		)
	}

	it("should display cost when totalCost is greater than 0", () => {
		renderTaskHeader()
		expect(screen.getByText("$0.05")).toBeInTheDocument()
	})

	it("should not display cost when totalCost is 0", () => {
		renderTaskHeader({ totalCost: 0 })
		expect(screen.queryByText("$0.0000")).not.toBeInTheDocument()
	})

	it("should not display cost when totalCost is null", () => {
		renderTaskHeader({ totalCost: null as any })
		expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
	})

	it("should not display cost when totalCost is undefined", () => {
		renderTaskHeader({ totalCost: undefined as any })
		expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
	})

	it("should not display cost when totalCost is NaN", () => {
		renderTaskHeader({ totalCost: NaN })
		expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
	})

	it("should render the condense context button when expanded", () => {
		renderTaskHeader()
		// First click to expand the task header
		const taskHeader = screen.getByText("Test task")
		fireEvent.click(taskHeader)

		// Now find the condense button in the expanded state
		const buttons = screen.getAllByRole("button")
		const condenseButton = buttons.find((button) => button.querySelector("svg.lucide-fold-vertical"))
		expect(condenseButton).toBeDefined()
		expect(condenseButton?.querySelector("svg")).toBeInTheDocument()
	})

	it("should call handleCondenseContext when condense context button is clicked", () => {
		const handleCondenseContext = vi.fn()
		renderTaskHeader({ handleCondenseContext })

		// First click to expand the task header
		const taskHeader = screen.getByText("Test task")
		fireEvent.click(taskHeader)

		// Find the button that contains the FoldVertical icon
		const buttons = screen.getAllByRole("button")
		const condenseButton = buttons.find((button) => button.querySelector("svg.lucide-fold-vertical"))
		expect(condenseButton).toBeDefined()
		fireEvent.click(condenseButton!)
		expect(handleCondenseContext).toHaveBeenCalledWith("test-task-id")
	})

	it("should disable the condense context button when buttonsDisabled is true", () => {
		const handleCondenseContext = vi.fn()
		renderTaskHeader({ buttonsDisabled: true, handleCondenseContext })

		// First click to expand the task header
		const taskHeader = screen.getByText("Test task")
		fireEvent.click(taskHeader)

		// Find the button that contains the FoldVertical icon
		const buttons = screen.getAllByRole("button")
		const condenseButton = buttons.find((button) => button.querySelector("svg.lucide-fold-vertical"))
		expect(condenseButton).toBeDefined()
		expect(condenseButton).toBeDisabled()
		fireEvent.click(condenseButton!)
		expect(handleCondenseContext).not.toHaveBeenCalled()
	})

	describe("DismissibleUpsell behavior", () => {
		beforeEach(() => {
			vi.useFakeTimers()
			// Reset the mock state before each test
			mockExtensionState = {
				apiConfiguration: {
					apiProvider: "anthropic",
					apiKey: "test-api-key",
					apiModelId: "claude-3-opus-20240229",
				} as ProviderSettings,
				currentTaskItem: { id: "test-task-id" },
				clineMessages: [],
			}
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("should show DismissibleUpsell after 2 minutes when task is not complete", async () => {
			renderTaskHeader()

			// Initially, the upsell should not be visible
			expect(screen.queryByTestId("dismissible-upsell")).not.toBeInTheDocument()

			// Fast-forward time by 2 minutes to match component timeout
			await vi.advanceTimersByTimeAsync(120_000)

			// The upsell should now be visible
			expect(screen.getByTestId("dismissible-upsell")).toBeInTheDocument()
			expect(screen.getByText("cloud:upsell.longRunningTask")).toBeInTheDocument()
		})

		it("should not show DismissibleUpsell when task is complete", async () => {
			// Set up mock state with a completion_result message
			mockExtensionState = {
				...mockExtensionState,
				clineMessages: [
					{
						type: "ask",
						ask: "completion_result",
						ts: Date.now(),
						text: "Task completed!",
					},
				],
			}

			renderTaskHeader()

			// Fast-forward time by more than 2 minutes
			await vi.advanceTimersByTimeAsync(130_000)

			// The upsell should not appear
			expect(screen.queryByTestId("dismissible-upsell")).not.toBeInTheDocument()
		})

		it("should not show DismissibleUpsell when currentTaskItem is null", async () => {
			// Update the mock state to have null currentTaskItem
			mockExtensionState = {
				...mockExtensionState,
				currentTaskItem: null,
			}

			renderTaskHeader()

			// Fast-forward time by more than 2 minutes
			await vi.advanceTimersByTimeAsync(130_000)

			// The upsell should not appear
			expect(screen.queryByTestId("dismissible-upsell")).not.toBeInTheDocument()
		})

		it("should not show DismissibleUpsell when task has completion_result in clineMessages", async () => {
			// Set up mock state with a completion_result message from the start
			mockExtensionState = {
				...mockExtensionState,
				clineMessages: [
					{
						type: "say",
						say: "text",
						ts: Date.now() - 1000,
						text: "Working on task...",
					},
					{
						type: "ask",
						ask: "completion_result",
						ts: Date.now(),
						text: "Task completed!",
					},
				],
			}

			renderTaskHeader()

			// Fast-forward time by more than 2 minutes
			await vi.advanceTimersByTimeAsync(130_000)

			// The upsell should not appear because the task is complete
			expect(screen.queryByTestId("dismissible-upsell")).not.toBeInTheDocument()
		})

		it("should not show DismissibleUpsell when task has completion_result followed by resume messages", async () => {
			// Set up mock state with a completion_result message followed by resume messages
			mockExtensionState = {
				...mockExtensionState,
				clineMessages: [
					{
						type: "say",
						say: "text",
						ts: Date.now() - 3000,
						text: "Working on task...",
					},
					{
						type: "ask",
						ask: "completion_result",
						ts: Date.now() - 2000,
						text: "Task completed!",
					},
					{
						type: "ask",
						ask: "resume_completed_task",
						ts: Date.now() - 1000,
						text: "Resume completed task?",
					},
					{
						type: "ask",
						ask: "resume_task",
						ts: Date.now(),
						text: "Resume task?",
					},
				],
			}

			renderTaskHeader()

			// Fast-forward time by more than 2 minutes
			await vi.advanceTimersByTimeAsync(130_000)

			// The upsell should not appear because the last relevant message (skipping resume messages) is completion_result
			expect(screen.queryByTestId("dismissible-upsell")).not.toBeInTheDocument()
		})

		it("should show DismissibleUpsell when task has non-completion message followed by resume messages", async () => {
			// Set up mock state with a non-completion message followed by resume messages
			mockExtensionState = {
				...mockExtensionState,
				clineMessages: [
					{
						type: "say",
						say: "text",
						ts: Date.now() - 3000,
						text: "Working on task...",
					},
					{
						type: "ask",
						ask: "tool",
						ts: Date.now() - 2000,
						text: "Need permission to use tool",
					},
					{
						type: "ask",
						ask: "resume_task",
						ts: Date.now() - 1000,
						text: "Resume task?",
					},
				],
			}

			renderTaskHeader()

			// Fast-forward time by 2 minutes to trigger the upsell
			await vi.advanceTimersByTimeAsync(120_000)

			// The upsell should appear because the last relevant message (skipping resume messages) is not completion_result
			expect(screen.getByTestId("dismissible-upsell")).toBeInTheDocument()
		})
	})

	describe("SubAgent status indicators", () => {
		it("should display subagent information when provided", () => {
			const subAgentTokenUsage = [
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
			]

			renderTaskHeader({ subAgentTokenUsage })

			// Click to expand the task header
			const taskHeader = screen.getByText("Test task")
			fireEvent.click(taskHeader)

			// Should display subagent section
			expect(screen.getByText("chat:task.subAgents")).toBeInTheDocument()

			// Should display subagent names - use getAllByText since they appear in multiple places
			const contextAnalyzerElements = screen.getAllByText(/Context Analyzer/)
			expect(contextAnalyzerElements.length).toBeGreaterThan(0)
			const memoryExtractorElements = screen.getAllByText(/Memory Extractor/)
			expect(memoryExtractorElements.length).toBeGreaterThan(0)
		})

		it("should show success status icon for active subagents", () => {
			const subAgentTokenUsage = [
				{
					agentName: "Context Analyzer",
					tokensIn: 1000,
					tokensOut: 500,
					cost: 0.015,
				},
			]

			renderTaskHeader({ subAgentTokenUsage })

			// Click to expand
			const taskHeader = screen.getByText("Test task")
			fireEvent.click(taskHeader)

			// Check for success icon (codicon-check)
			const successIcons = document.querySelectorAll(".codicon-check")
			expect(successIcons.length).toBeGreaterThan(0)
		})

		it("should show inactive status icon for subagents without output", () => {
			const subAgentTokenUsage = [
				{
					agentName: "Inactive Agent",
					tokensIn: 100,
					tokensOut: 0,
					cost: 0,
				},
			]

			renderTaskHeader({ subAgentTokenUsage })

			// Click to expand
			const taskHeader = screen.getByText("Test task")
			fireEvent.click(taskHeader)

			// Check for inactive icon (codicon-circle-slash)
			const inactiveIcons = document.querySelectorAll(".codicon-circle-slash")
			expect(inactiveIcons.length).toBeGreaterThan(0)
		})

		it("should display token usage for each subagent", () => {
			const subAgentTokenUsage = [
				{
					agentName: "Context Analyzer",
					tokensIn: 1500,
					tokensOut: 750,
					cost: 0.0225,
				},
			]

			renderTaskHeader({ subAgentTokenUsage })

			// Click to expand
			const taskHeader = screen.getByText("Test task")
			fireEvent.click(taskHeader)

			// Should display subagent section
			expect(screen.getByText("chat:task.subAgents")).toBeInTheDocument()

			// Should display cost (appears in multiple places now: Tokens section and Sub-Agents section)
			const costElements = screen.getAllByText("$0.0225")
			expect(costElements.length).toBeGreaterThan(0)

			// Should display Context Analyzer (appears in multiple places)
			const contextAnalyzerElements = screen.getAllByText(/Context Analyzer/)
			expect(contextAnalyzerElements.length).toBeGreaterThan(0)
		})

		it("should always display subagent section", () => {
			renderTaskHeader({ subAgentTokenUsage: [] })

			// Click to expand
			const taskHeader = screen.getByText("Test task")
			fireEvent.click(taskHeader)

			// Should always show subagent section (even when empty)
			expect(screen.getByText("chat:task.subAgents")).toBeInTheDocument()
		})

		it("should display configuration status when subAgentCompressionEnabled is true", () => {
			renderTaskHeader({
				subAgentCompressionEnabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
				useCodeSummarizer: false,
			})

			// Click to expand
			const taskHeader = screen.getByText("Test task")
			fireEvent.click(taskHeader)

			// Should display enabled status
			expect(screen.getByText("启用")).toBeInTheDocument()
			// Should show 2/3 agents activated
			expect(screen.getByText("(2/3 子代理激活)")).toBeInTheDocument()
		})

		it("should display disabled status when subAgentCompressionEnabled is false", () => {
			renderTaskHeader({
				subAgentCompressionEnabled: false,
			})

			// Click to expand
			const taskHeader = screen.getByText("Test task")
			fireEvent.click(taskHeader)

			// Should display disabled status
			expect(screen.getByText("未启用")).toBeInTheDocument()
			// Should show settings prompt
			expect(screen.getByText("在设置中启用子代理压缩功能")).toBeInTheDocument()
		})

		it("should display prompt message when compression enabled but not yet triggered", () => {
			renderTaskHeader({
				subAgentCompressionEnabled: true,
				useContextAnalyzer: true,
				useMemoryExtractor: true,
				useCodeSummarizer: true,
				subAgentTokenUsage: undefined,
			})

			// Click to expand
			const taskHeader = screen.getByText("Test task")
			fireEvent.click(taskHeader)

			// Should show compression not triggered message
			expect(screen.getByText("尚未触发压缩。点击上方压缩按钮可触发。")).toBeInTheDocument()
		})

		it("should display total tokens and cost for all subagents", () => {
			const subAgentTokenUsage = [
				{
					agentName: "Context Analyzer",
					tokensIn: 1000,
					tokensOut: 500,
					cost: 0.015,
				},
				{
					agentName: "Memory Extractor",
					tokensIn: 800,
					tokensOut: 400,
					cost: 0.012,
				},
			]

			renderTaskHeader({ subAgentTokenUsage })

			// Click to expand
			const taskHeader = screen.getByText("Test task")
			fireEvent.click(taskHeader)

			// Should display total row with icon
			const totalIcons = document.querySelectorAll(".codicon-symbol-misc")
			expect(totalIcons.length).toBeGreaterThan(0)

			// Should display total label
			expect(screen.getByText("总计:")).toBeInTheDocument()

			// Total tokens: 1800 in, 900 out
			expect(screen.getByText("↑ 1.8K")).toBeInTheDocument()
			expect(screen.getByText("↓ 900")).toBeInTheDocument()

			// Total cost: 0.027
			expect(screen.getByText("$0.0270")).toBeInTheDocument()
		})
	})
})
