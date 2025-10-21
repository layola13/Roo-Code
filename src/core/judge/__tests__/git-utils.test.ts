import { describe, it, expect, vi, beforeEach } from "vitest"

// Create mock function that will be returned by promisify
const mockExecAsync = vi.fn()

// Mock child_process and util before imports
vi.mock("child_process", () => ({
	exec: vi.fn(),
}))

vi.mock("util", () => ({
	promisify: vi.fn(() => mockExecAsync),
}))

// Import after mocks
const { checkGitStatus, formatGitStatus } = await import("../git-utils")

describe("git-utils", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockExecAsync.mockReset()
	})

	describe("checkGitStatus", () => {
		it("should return clean status when no changes", async () => {
			mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" })

			const result = await checkGitStatus("/test/path")

			expect(result).toEqual({
				hasChanges: false,
				modifiedFiles: [],
				summary: "工作目录干净，没有未提交的更改",
			})
		})

		it("should parse git status output correctly", async () => {
			const mockOutput = `M  src/main.ts
A  src/new-file.ts
D  src/deleted-file.ts
R  src/renamed-file.ts -> src/new-name.ts
?? src/untracked-file.ts
`

			mockExecAsync.mockResolvedValue({ stdout: mockOutput, stderr: "" })

			const result = await checkGitStatus("/test/path")

			expect(result.hasChanges).toBe(true)
			expect(result.modifiedFiles).toHaveLength(5)

			// Check modified file
			const modifiedFile = result.modifiedFiles.find((f) => f.path === "src/main.ts")
			expect(modifiedFile?.statusDescription).toContain("修改")

			// Check added file
			const addedFile = result.modifiedFiles.find((f) => f.path === "src/new-file.ts")
			expect(addedFile?.statusDescription).toContain("新增")

			// Check deleted file
			const deletedFile = result.modifiedFiles.find((f) => f.path === "src/deleted-file.ts")
			expect(deletedFile?.statusDescription).toContain("删除")

			// Check renamed file
			const renamedFile = result.modifiedFiles.find((f) => f.path === "src/renamed-file.ts")
			expect(renamedFile?.statusDescription).toContain("重命名")

			// Check untracked file
			const untrackedFile = result.modifiedFiles.find((f) => f.path === "src/untracked-file.ts")
			expect(untrackedFile?.statusDescription).toContain("未跟踪")
		})

		it("should handle git command failure gracefully", async () => {
			mockExecAsync.mockRejectedValue(new Error("git command failed"))

			const result = await checkGitStatus("/test/path")

			expect(result.hasChanges).toBe(false)
			expect(result.modifiedFiles).toEqual([])
			expect(result.summary).toContain("无法获取 Git 状态")
			expect(result.summary).toContain("git command failed")
		})

		it("should handle complex status combinations", async () => {
			const complexOutput = "MM src/important.ts\nAM src/new-modified.ts\nRM src/old.ts -> src/renamed.ts\n"

			mockExecAsync.mockResolvedValue({ stdout: complexOutput, stderr: "" })

			const result = await checkGitStatus("/test/path")

			expect(result.hasChanges).toBe(true)
			expect(result.modifiedFiles).toHaveLength(3)
			expect(result.modifiedFiles[0].statusDescription).toBe("暂存区修改, 工作区修改")
			expect(result.modifiedFiles[1].statusDescription).toBe("暂存区新增, 工作区修改")
			expect(result.modifiedFiles[2].statusDescription).toBe("暂存区重命名, 工作区修改")
		})
	})

	describe("formatGitStatus", () => {
		it("should format empty file list", () => {
			const result = formatGitStatus([])
			expect(result).toBe("没有文件改动")
		})

		it("should group files by status and format correctly", () => {
			const files = [
				{ path: "src/file1.ts", status: "M ", statusDescription: "工作区修改" },
				{ path: "src/file2.ts", status: "M ", statusDescription: "工作区修改" },
				{ path: "src/file3.ts", status: "A ", statusDescription: "新增" },
				{ path: "src/file4.ts", status: "D ", statusDescription: "删除" },
			]

			const result = formatGitStatus(files)

			const lines = result.split("\n")
			expect(lines[0]).toBe("工作区修改: 2 个文件")
			expect(lines[1]).toBe("  - src/file1.ts")
			expect(lines[2]).toBe("  - src/file2.ts")
			expect(lines[3]).toBe("新增: 1 个文件")
			expect(lines[4]).toBe("  - src/file3.ts")
			expect(lines[5]).toBe("删除: 1 个文件")
			expect(lines[6]).toBe("  - src/file4.ts")
		})

		it("should handle single file per status", () => {
			const files = [{ path: "README.md", status: "M ", statusDescription: "工作区修改" }]

			const result = formatGitStatus(files)

			const lines = result.split("\n")
			expect(lines[0]).toBe("工作区修改: 1 个文件")
			expect(lines[1]).toBe("  - README.md")
		})

		it("should handle mixed status descriptions", () => {
			const files = [
				{ path: "src/main.ts", status: "MM", statusDescription: "暂存区修改, 工作区修改" },
				{ path: "src/utils.ts", status: "A ", statusDescription: "新增" },
			]

			const result = formatGitStatus(files)

			const lines = result.split("\n")
			expect(lines[0]).toBe("暂存区修改, 工作区修改: 1 个文件")
			expect(lines[1]).toBe("  - src/main.ts")
			expect(lines[2]).toBe("新增: 1 个文件")
			expect(lines[3]).toBe("  - src/utils.ts")
		})
	})
})
