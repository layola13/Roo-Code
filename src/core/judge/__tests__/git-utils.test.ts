import { describe, it, expect, beforeEach, vi } from "vitest"
import { formatGitStatus, GitStatusResult } from "../git-utils"

describe("git-utils", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	// 注意：checkGitStatus 的测试需要真实的 git 环境，所以我们只测试 formatGitStatus
	// 在实际使用中，git-utils会在真实的git仓库环境中运行

	describe("checkGitStatus", () => {
		it("should be defined", async () => {
			const { checkGitStatus } = await import("../git-utils")
			expect(checkGitStatus).toBeDefined()
			expect(typeof checkGitStatus).toBe("function")
		})
	})

	describe("formatGitStatus", () => {
		it("should format error status", () => {
			const status: GitStatusResult = {
				success: false,
				error: "Not a git repository",
				files: [],
				hasChanges: false,
				changedFilesCount: 0,
			}

			const formatted = formatGitStatus(status)

			expect(formatted).toContain("Git status check failed")
			expect(formatted).toContain("Not a git repository")
		})

		it("should format no changes status", () => {
			const status: GitStatusResult = {
				success: true,
				files: [],
				hasChanges: false,
				changedFilesCount: 0,
			}

			const formatted = formatGitStatus(status)

			expect(formatted).toContain("No uncommitted changes")
		})

		it("should format staged changes", () => {
			const status: GitStatusResult = {
				success: true,
				files: [
					{
						path: "src/file1.ts",
						status: "M",
						staged: true,
						lastModified: Date.now() - 60000, // 1 minute ago
						tracked: true,
					},
				],
				hasChanges: true,
				changedFilesCount: 1,
			}

			const formatted = formatGitStatus(status)

			expect(formatted).toContain("Staged Changes")
			expect(formatted).toContain("src/file1.ts")
			expect(formatted).toContain("[M]")
			expect(formatted).toContain("Modified")
		})

		it("should format unstaged changes", () => {
			const status: GitStatusResult = {
				success: true,
				files: [
					{
						path: "src/file1.ts",
						status: "M",
						staged: false,
						lastModified: Date.now() - 3600000, // 1 hour ago
						tracked: true,
					},
				],
				hasChanges: true,
				changedFilesCount: 1,
			}

			const formatted = formatGitStatus(status)

			expect(formatted).toContain("Unstaged Changes")
			expect(formatted).toContain("src/file1.ts")
			expect(formatted).toContain("1 hour")
		})

		it("should format untracked files", () => {
			const status: GitStatusResult = {
				success: true,
				files: [
					{
						path: "src/newfile.ts",
						status: "??",
						staged: false,
						lastModified: Date.now(),
						tracked: false,
					},
				],
				hasChanges: true,
				changedFilesCount: 1,
			}

			const formatted = formatGitStatus(status)

			expect(formatted).toContain("Untracked Files")
			expect(formatted).toContain("src/newfile.ts")
			expect(formatted).toContain("[??]")
			expect(formatted).toContain("just now")
		})

		it("should group files by their status", () => {
			const status: GitStatusResult = {
				success: true,
				files: [
					{
						path: "src/staged.ts",
						status: "M",
						staged: true,
						tracked: true,
					},
					{
						path: "src/unstaged.ts",
						status: "M",
						staged: false,
						tracked: true,
					},
					{
						path: "src/untracked.ts",
						status: "??",
						staged: false,
						tracked: false,
					},
				],
				hasChanges: true,
				changedFilesCount: 3,
			}

			const formatted = formatGitStatus(status)

			expect(formatted).toContain("Staged Changes")
			expect(formatted).toContain("Unstaged Changes")
			expect(formatted).toContain("Untracked Files")
			expect(formatted).toContain("src/staged.ts")
			expect(formatted).toContain("src/unstaged.ts")
			expect(formatted).toContain("src/untracked.ts")
		})
	})
})
