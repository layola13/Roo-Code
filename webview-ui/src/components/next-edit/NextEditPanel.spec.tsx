import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { NextEditPanel } from "./NextEditPanel"
import { EditChain, EditStep } from "../../../../src/memory/gsw/types/next-edit"

describe("NextEditPanel", () => {
	const mockChain: EditChain = {
		chainId: "test-chain-1",
		sessionId: "test-session-1",
		taskDescription: "测试任务",
		taskIntent: "测试意图",
		steps: [
			{
				index: 0,
				stepId: "step-1",
				filePath: "src/test.ts",
				startLine: 1,
				endLine: 10,
				originalCode: "const old = 'old'",
				suggestedCode: "const new = 'new'",
				description: "更新变量名",
				editType: "replace",
				status: "accepted",
				confidence: 0.9,
			},
			{
				index: 1,
				stepId: "step-2",
				filePath: "src/test2.ts",
				startLine: 5,
				endLine: 15,
				originalCode: "function old() {}",
				suggestedCode: "function new() {}",
				description: "更新函数名",
				editType: "replace",
				status: "pending",
				confidence: 0.85,
			},
		],
		currentIndex: 1,
		affectedFiles: ["src/test.ts", "src/test2.ts"],
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-01T00:00:00Z",
		status: "active",
		executionMode: "sequential",
	}

	const mockCurrentStep: EditStep = mockChain.steps[1]

	it("应该在没有编辑链时不渲染任何内容", () => {
		const { container } = render(
			<NextEditPanel chain={null} currentStep={null} onAccept={vi.fn()} onReject={vi.fn()} onModify={vi.fn()} />,
		)
		expect(container.firstChild).toBeNull()
	})

	it("应该渲染编辑链进度和当前步骤", () => {
		render(
			<NextEditPanel
				chain={mockChain}
				currentStep={mockCurrentStep}
				onAccept={vi.fn()}
				onReject={vi.fn()}
				onModify={vi.fn()}
			/>,
		)

		// 检查进度标题
		expect(screen.getByText(/编辑链进度/)).toBeInTheDocument()
		expect(screen.getByText(/\(1\/2\)/)).toBeInTheDocument()

		// 检查当前步骤描述
		expect(screen.getByText("更新函数名")).toBeInTheDocument()
	})

	it("应该在Tab键时调用onAccept", () => {
		const onAccept = vi.fn()
		render(
			<NextEditPanel
				chain={mockChain}
				currentStep={mockCurrentStep}
				onAccept={onAccept}
				onReject={vi.fn()}
				onModify={vi.fn()}
			/>,
		)

		fireEvent.keyDown(window, { key: "Tab" })
		expect(onAccept).toHaveBeenCalledWith(mockCurrentStep)
	})

	it("应该在Esc键时调用onReject", () => {
		const onReject = vi.fn()
		render(
			<NextEditPanel
				chain={mockChain}
				currentStep={mockCurrentStep}
				onAccept={vi.fn()}
				onReject={onReject}
				onModify={vi.fn()}
			/>,
		)

		fireEvent.keyDown(window, { key: "Escape" })
		expect(onReject).toHaveBeenCalledWith(mockCurrentStep)
	})

	it("应该不在没有当前步骤时响应快捷键", () => {
		const onAccept = vi.fn()
		const onReject = vi.fn()
		render(
			<NextEditPanel
				chain={mockChain}
				currentStep={null}
				onAccept={onAccept}
				onReject={onReject}
				onModify={vi.fn()}
			/>,
		)

		fireEvent.keyDown(window, { key: "Tab" })
		fireEvent.keyDown(window, { key: "Escape" })

		expect(onAccept).not.toHaveBeenCalled()
		expect(onReject).not.toHaveBeenCalled()
	})

	it("应该在有修饰键时不响应Tab快捷键", () => {
		const onAccept = vi.fn()
		render(
			<NextEditPanel
				chain={mockChain}
				currentStep={mockCurrentStep}
				onAccept={onAccept}
				onReject={vi.fn()}
				onModify={vi.fn()}
			/>,
		)

		// Shift+Tab 不应该触发
		fireEvent.keyDown(window, { key: "Tab", shiftKey: true })
		expect(onAccept).not.toHaveBeenCalled()

		// Ctrl+Tab 不应该触发
		fireEvent.keyDown(window, { key: "Tab", ctrlKey: true })
		expect(onAccept).not.toHaveBeenCalled()
	})

	it("应该显示正确的可访问性属性", () => {
		render(
			<NextEditPanel
				chain={mockChain}
				currentStep={mockCurrentStep}
				onAccept={vi.fn()}
				onReject={vi.fn()}
				onModify={vi.fn()}
			/>,
		)

		const panel = screen.getByRole("region", { name: "Next Edit Panel" })
		expect(panel).toBeInTheDocument()
	})
})
