import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { EditChainProgress } from "./EditChainProgress"
import { EditStep } from "../../../../src/memory/gsw/types/next-edit"

describe("EditChainProgress", () => {
	const mockSteps: EditStep[] = [
		{
			index: 0,
			stepId: "step-1",
			filePath: "src/test1.ts",
			startLine: 1,
			endLine: 10,
			originalCode: "old code 1",
			suggestedCode: "new code 1",
			description: "第一个步骤",
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
			originalCode: "old code 2",
			suggestedCode: "new code 2",
			description: "第二个步骤",
			editType: "insert",
			status: "modified",
			confidence: 0.85,
			userModifiedCode: "user modified code",
		},
		{
			index: 2,
			stepId: "step-3",
			filePath: "src/test3.ts",
			startLine: 20,
			endLine: 30,
			originalCode: "old code 3",
			suggestedCode: "new code 3",
			description: "第三个步骤",
			editType: "delete",
			status: "pending",
			confidence: 0.8,
		},
		{
			index: 3,
			stepId: "step-4",
			filePath: "src/test4.ts",
			startLine: 40,
			endLine: 50,
			originalCode: "old code 4",
			suggestedCode: "new code 4",
			description: "第四个步骤",
			editType: "refactor",
			status: "rejected",
			confidence: 0.7,
		},
	]

	it("应该显示正确的进度标题", () => {
		render(<EditChainProgress steps={mockSteps} currentIndex={2} totalSteps={4} />)

		expect(screen.getByText(/编辑链进度/)).toBeInTheDocument()
		expect(screen.getByText(/\(2\/4\)/)).toBeInTheDocument()
	})

	it("应该显示正确的统计信息", () => {
		render(<EditChainProgress steps={mockSteps} currentIndex={2} totalSteps={4} />)

		// 已完成：accepted + modified = 2
		expect(screen.getByText("2 已完成")).toBeInTheDocument()
		// 已跳过：rejected = 1
		expect(screen.getByText("1 已跳过")).toBeInTheDocument()
	})

	it("应该不显示已跳过统计当没有被拒绝的步骤时", () => {
		const stepsWithoutRejected = mockSteps.map((s) => ({ ...s, status: "pending" as const }))
		render(<EditChainProgress steps={stepsWithoutRejected} currentIndex={0} totalSteps={4} />)

		// 已跳过计数应该是0，所以不会显示文字内容
		expect(screen.queryByText("1 已跳过")).not.toBeInTheDocument()
	})

	it("应该显示正确的进度条", () => {
		render(<EditChainProgress steps={mockSteps} currentIndex={2} totalSteps={4} />)

		const progressBar = screen.getByRole("progressbar")
		expect(progressBar).toBeInTheDocument()
		// 2 已完成 / 4 总数 = 50%
		expect(progressBar).toHaveAttribute("aria-valuenow", "50")
	})

	it("应该列出所有步骤", () => {
		render(<EditChainProgress steps={mockSteps} currentIndex={2} totalSteps={4} />)

		expect(screen.getByText("1. 第一个步骤")).toBeInTheDocument()
		expect(screen.getByText("2. 第二个步骤")).toBeInTheDocument()
		expect(screen.getByText("3. 第三个步骤")).toBeInTheDocument()
		expect(screen.getByText("4. 第四个步骤")).toBeInTheDocument()
	})

	it("应该显示文件路径和行号", () => {
		render(<EditChainProgress steps={mockSteps} currentIndex={2} totalSteps={4} />)

		expect(screen.getByText(/src\/test1.ts • L1-10/)).toBeInTheDocument()
		expect(screen.getByText(/src\/test2.ts • L5-15/)).toBeInTheDocument()
	})

	it("应该高亮当前步骤", () => {
		render(<EditChainProgress steps={mockSteps} currentIndex={2} totalSteps={4} />)

		// 当前步骤应该有play-circle图标
		const currentStep = screen.getByText("3. 第三个步骤").closest('[role="listitem"]')
		expect(currentStep).toHaveClass("bg-vscode-list-activeSelectionBackground/20")
	})

	it("应该为不同状态显示正确的图标", () => {
		render(<EditChainProgress steps={mockSteps} currentIndex={2} totalSteps={4} />)

		// 检查是否有各种状态的图标
		expect(screen.getAllByLabelText("Accepted")).toHaveLength(1)
		expect(screen.getAllByLabelText("Modified")).toHaveLength(1)
		expect(screen.getAllByLabelText("Current step")).toHaveLength(1)
		expect(screen.getAllByLabelText("Rejected")).toHaveLength(1)
	})

	it("应该显示用户修改标记", () => {
		render(<EditChainProgress steps={mockSteps} currentIndex={2} totalSteps={4} />)

		// 第二个步骤有用户修改
		const userModifiedMarkers = screen.getAllByLabelText("User modified")
		expect(userModifiedMarkers).toHaveLength(1)
	})

	it("应该显示图例说明", () => {
		render(<EditChainProgress steps={mockSteps} currentIndex={2} totalSteps={4} />)

		expect(screen.getByText("当前步骤")).toBeInTheDocument()
		expect(screen.getByText("已接受")).toBeInTheDocument()
		expect(screen.getByText("已修改")).toBeInTheDocument()
		expect(screen.getByText("已跳过")).toBeInTheDocument()
		expect(screen.getByText("待处理")).toBeInTheDocument()
	})

	it("应该正确计算0%进度", () => {
		const pendingSteps = mockSteps.map((s) => ({ ...s, status: "pending" as const }))
		render(<EditChainProgress steps={pendingSteps} currentIndex={0} totalSteps={4} />)

		const progressBar = screen.getByRole("progressbar")
		expect(progressBar).toHaveAttribute("aria-valuenow", "0")
	})

	it("应该正确计算100%进度", () => {
		const completedSteps = mockSteps.map((s) => ({ ...s, status: "accepted" as const }))
		render(<EditChainProgress steps={completedSteps} currentIndex={4} totalSteps={4} />)

		const progressBar = screen.getByRole("progressbar")
		expect(progressBar).toHaveAttribute("aria-valuenow", "100")
	})

	it("应该处理空步骤列表", () => {
		render(<EditChainProgress steps={[]} currentIndex={0} totalSteps={0} />)

		expect(screen.getByText(/编辑链进度 \(0\/0\)/)).toBeInTheDocument()
		const progressBar = screen.getByRole("progressbar")
		expect(progressBar).toHaveAttribute("aria-valuenow", "0")
	})

	it("应该显示可访问性属性", () => {
		render(<EditChainProgress steps={mockSteps} currentIndex={2} totalSteps={4} />)

		const region = screen.getByRole("region", { name: "Edit chain progress" })
		expect(region).toBeInTheDocument()
	})

	it("应该为已完成步骤显示删除线", () => {
		render(<EditChainProgress steps={mockSteps} currentIndex={2} totalSteps={4} />)

		const acceptedStep = screen.getByText("1. 第一个步骤")
		expect(acceptedStep).toHaveClass("line-through")

		const modifiedStep = screen.getByText("2. 第二个步骤")
		expect(modifiedStep).toHaveClass("line-through")

		const rejectedStep = screen.getByText("4. 第四个步骤")
		expect(rejectedStep).toHaveClass("line-through")
	})

	it("应该正确标记当前步骤的aria-current", () => {
		render(<EditChainProgress steps={mockSteps} currentIndex={2} totalSteps={4} />)

		const currentStepItem = screen.getByText("3. 第三个步骤").closest('[role="listitem"]')
		expect(currentStepItem).toHaveAttribute("aria-current", "step")
	})
})
