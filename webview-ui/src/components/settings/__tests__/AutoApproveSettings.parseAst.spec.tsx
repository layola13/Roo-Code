import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { AutoApproveSettings } from "../AutoApproveSettings"

// Mock the vscode API - must be defined before vi.mock
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock the translation hook
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Mock the ExtensionStateContext
vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		autoApprovalEnabled: true,
		setAutoApprovalEnabled: vi.fn(),
	}),
}))

// Mock the hooks
vi.mock("@/hooks/useAutoApprovalState", () => ({
	useAutoApprovalState: () => ({
		effectiveAutoApprovalEnabled: true,
	}),
}))

vi.mock("@/hooks/useAutoApprovalToggles", () => ({
	useAutoApprovalToggles: () => ({
		alwaysAllowReadOnly: false,
		alwaysAllowWrite: false,
		alwaysAllowBrowser: false,
		alwaysApproveResubmit: false,
		alwaysAllowMcp: false,
		alwaysAllowModeSwitch: false,
		alwaysAllowSubtasks: false,
		alwaysAllowExecute: false,
		alwaysAllowFollowupQuestions: false,
		alwaysAllowUpdateTodoList: false,
		alwaysAllowParseAst: false,
	}),
}))

describe("AutoApproveSettings - parseAst persistence", () => {
	const mockSetCachedStateField = vi.fn()

	beforeEach(async () => {
		vi.clearAllMocks()
		// Get the mocked vscode module
		const vscodeMod = await import("@/utils/vscode")
		vi.mocked(vscodeMod.vscode.postMessage).mockClear()
	})

	it("should send vscode.postMessage when parseAst toggle is clicked", async () => {
		const vscodeMod = await import("@/utils/vscode")

		render(
			<AutoApproveSettings
				alwaysAllowReadOnly={false}
				alwaysAllowWrite={false}
				alwaysAllowBrowser={false}
				alwaysApproveResubmit={false}
				requestDelaySeconds={5}
				alwaysAllowMcp={false}
				alwaysAllowModeSwitch={false}
				alwaysAllowSubtasks={false}
				alwaysAllowExecute={false}
				alwaysAllowFollowupQuestions={false}
				alwaysAllowUpdateTodoList={false}
				alwaysAllowParseAst={false}
				setCachedStateField={mockSetCachedStateField}
			/>,
		)

		// Find the parseAst toggle button
		const parseAstButton = screen.getByTestId("always-allow-parse-ast-toggle")
		expect(parseAstButton).toBeInTheDocument()

		// Click the button
		fireEvent.click(parseAstButton)

		// Verify both setCachedStateField and vscode.postMessage were called
		expect(mockSetCachedStateField).toHaveBeenCalledWith("alwaysAllowParseAst", true)
		expect(vscodeMod.vscode.postMessage).toHaveBeenCalledWith({
			type: "alwaysAllowParseAst",
			bool: true,
		})
	})

	it("should toggle from true to false", async () => {
		const vscodeMod = await import("@/utils/vscode")

		render(
			<AutoApproveSettings
				alwaysAllowReadOnly={false}
				alwaysAllowWrite={false}
				alwaysAllowBrowser={false}
				alwaysApproveResubmit={false}
				requestDelaySeconds={5}
				alwaysAllowMcp={false}
				alwaysAllowModeSwitch={false}
				alwaysAllowSubtasks={false}
				alwaysAllowExecute={false}
				alwaysAllowFollowupQuestions={false}
				alwaysAllowUpdateTodoList={false}
				alwaysAllowParseAst={true}
				setCachedStateField={mockSetCachedStateField}
			/>,
		)

		const parseAstButton = screen.getByTestId("always-allow-parse-ast-toggle")

		// Click to toggle off
		fireEvent.click(parseAstButton)

		// Verify the correct values were passed
		expect(mockSetCachedStateField).toHaveBeenCalledWith("alwaysAllowParseAst", false)
		expect(vscodeMod.vscode.postMessage).toHaveBeenCalledWith({
			type: "alwaysAllowParseAst",
			bool: false,
		})
	})
})
