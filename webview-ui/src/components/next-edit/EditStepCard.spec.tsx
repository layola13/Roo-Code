import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { EditStepCard } from "./EditStepCard"
import { EditStep } from "../../../../src/memory/gsw/types/next-edit"

describe("EditStepCard", () => {
	const mockStep: EditStep = {
		index: 0,
		stepId: "step-1",
		filePath: "src/test.ts",
		startLine: 10,
		endLine: 20,
		originalCode: "const old = 'old'",
		suggestedCode: "const new = 'new'",
		description: "更新变量名",
		editType: "replace",
		status: "pending",
		confidence: 0.85,
	}

	it("应该渲染步骤信息", () => {
		render(<EditStepCard step={mockStep} onAccept={vi.fn()} onReject={vi.fn()} onModify={vi.fn()} />)

		expect(screen.getByText("更新变量名")).toBeInTheDocument()
		expect(screen.getByText("src/test.ts")).toBeInTheDocument()
		expect(screen.getByText("L10-20")).toBeInTheDocument()
	})

	it("应该显示正确的编辑类型徽章", () => {
		const { rerender } = render(
			<EditStepCard step={mockStep} onAccept={vi.fn()} onReject={vi.fn()} onModify={vi.fn()} />,
		)
		expect(screen.getByText("替换")).toBeInTheDocument()

		// 测试其他编辑类型
		rerender(
			<EditStepCard
				step={{ ...mockStep, editType: "insert" }}
				onAccept={vi.fn()}
				onReject={vi.fn()}
				onModify={vi.fn()}
			/>,
		)
		expect(screen.getByText("插入")).toBeInTheDocument()

		rerender(
			<EditStepCard
				step={{ ...mockStep, editType: "delete" }}
				onAccept={vi.fn()}
				onReject={vi.fn()}
				onModify={vi.fn()}
			/>,
		)
		expect(screen.getByText("删除")).toBeInTheDocument()

		rerender(
			<EditStepCard
				step={{ ...mockStep, editType: "refactor" }}
				onAccept={vi.fn()}
				onReject={vi.fn()}
				onModify={vi.fn()}
			/>,
		)
		expect(screen.getByText("重构")).toBeInTheDocument()
	})

	it("应该显示原始代码和建议代码", () => {
		render(<EditStepCard step={mockStep} onAccept={vi.fn()} onReject={vi.fn()} onModify={vi.fn()} />)

		expect(screen.getByText("- 原始代码")).toBeInTheDocument()
		expect(screen.getByText("+ 建议代码")).toBeInTheDocument()
		expect(screen.getByText("const old = 'old'")).toBeInTheDocument()
		expect(screen.getByText("const new = 'new'")).toBeInTheDocument()
	})

	it("应该在点击接受按钮时调用onAccept", () => {
		const onAccept = vi.fn()
		render(<EditStepCard step={mockStep} onAccept={onAccept} onReject={vi.fn()} onModify={vi.fn()} />)

		const acceptButton = screen.getByLabelText("Accept edit (Tab key)")
		fireEvent.click(acceptButton)

		expect(onAccept).toHaveBeenCalledTimes(1)
	})

	it("应该在点击跳过按钮时显示原因输入并调用onReject", async () => {
		const onReject = vi.fn()
		render(<EditStepCard step={mockStep} onAccept={vi.fn()} onReject={onReject} onModify={vi.fn()} />)

		const rejectButton = screen.getByLabelText("Skip edit (Esc key)")
		fireEvent.click(rejectButton)

		// 应该显示原因输入框
		const reasonInput = screen.getByPlaceholderText(/请输入拒绝原因/)
		expect(reasonInput).toBeInTheDocument()

		// 输入原因并按Enter
		fireEvent.change(reasonInput, { target: { value: "测试原因" } })
		fireEvent.keyDown(reasonInput, { key: "Enter" })

		expect(onReject).toHaveBeenCalledWith("测试原因")
	})

	it("应该在按Esc时取消原因输入", () => {
		const onReject = vi.fn()
		render(<EditStepCard step={mockStep} onAccept={vi.fn()} onReject={onReject} onModify={vi.fn()} />)

		const rejectButton = screen.getByLabelText("Skip edit (Esc key)")
		fireEvent.click(rejectButton)

		const reasonInput = screen.getByPlaceholderText(/请输入拒绝原因/)
		fireEvent.keyDown(reasonInput, { key: "Escape" })

		// 输入框应该消失
		expect(screen.queryByPlaceholderText(/请输入拒绝原因/)).not.toBeInTheDocument()
		expect(onReject).not.toHaveBeenCalled()
	})

	it("应该进入编辑模式并保存修改", async () => {
		const onModify = vi.fn()
		render(<EditStepCard step={mockStep} onAccept={vi.fn()} onReject={vi.fn()} onModify={onModify} />)

		// 点击修改按钮
		const editButton = screen.getByLabelText("Modify code")
		fireEvent.click(editButton)

		// 应该显示编辑文本框
		const textarea = screen.getByLabelText("Edit suggested code")
		expect(textarea).toBeInTheDocument()

		// 修改代码
		fireEvent.change(textarea, { target: { value: "const modified = 'modified'" } })

		// 保存修改
		const saveButton = screen.getByLabelText("Save changes")
		fireEvent.click(saveButton)

		expect(onModify).toHaveBeenCalledWith("const modified = 'modified'")
	})

	it("应该能够取消编辑", () => {
		render(<EditStepCard step={mockStep} onAccept={vi.fn()} onReject={vi.fn()} onModify={vi.fn()} />)

		// 进入编辑模式
		const editButton = screen.getByLabelText("Modify code")
		fireEvent.click(editButton)

		const textarea = screen.getByLabelText("Edit suggested code")
		fireEvent.change(textarea, { target: { value: "const modified = 'modified'" } })

		// 取消编辑
		const cancelButton = screen.getByLabelText("Cancel editing")
		fireEvent.click(cancelButton)

		// 应该退出编辑模式
		expect(screen.queryByLabelText("Edit suggested code")).not.toBeInTheDocument()
		expect(screen.getByLabelText("Modify code")).toBeInTheDocument()
	})

	it("应该显示正确的置信度", () => {
		render(<EditStepCard step={mockStep} onAccept={vi.fn()} onReject={vi.fn()} onModify={vi.fn()} />)

		expect(screen.getByText("85%")).toBeInTheDocument()
	})

	it("应该根据置信度显示不同的颜色", () => {
		const { rerender } = render(
			<EditStepCard step={mockStep} onAccept={vi.fn()} onReject={vi.fn()} onModify={vi.fn()} />,
		)

		// 高置信度 (>= 0.8) - 绿色
		let progressBar = screen.getByRole("progressbar")
		expect(progressBar).toHaveClass("bg-green-500")

		// 中等置信度 (0.5-0.8) - 黄色
		rerender(
			<EditStepCard
				step={{ ...mockStep, confidence: 0.6 }}
				onAccept={vi.fn()}
				onReject={vi.fn()}
				onModify={vi.fn()}
			/>,
		)
		progressBar = screen.getByRole("progressbar")
		expect(progressBar).toHaveClass("bg-yellow-500")

		// 低置信度 (< 0.5) - 红色
		rerender(
			<EditStepCard
				step={{ ...mockStep, confidence: 0.3 }}
				onAccept={vi.fn()}
				onReject={vi.fn()}
				onModify={vi.fn()}
			/>,
		)
		progressBar = screen.getByRole("progressbar")
		expect(progressBar).toHaveClass("bg-red-500")
	})

	it("应该显示可访问性标签", () => {
		render(<EditStepCard step={mockStep} onAccept={vi.fn()} onReject={vi.fn()} onModify={vi.fn()} />)

		const article = screen.getByRole("article", { name: /Edit step 1: 更新变量名/ })
		expect(article).toBeInTheDocument()
	})
})
