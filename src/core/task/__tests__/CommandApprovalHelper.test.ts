import { describe, it, expect } from "vitest"
import { CommandApprovalHelper } from "../CommandApprovalHelper"

describe("CommandApprovalHelper", () => {
	describe("shouldAutoApproveCommand", () => {
		const baseConfig = {
			commandApprovalFreeMode: true,
			allowedCommands: ["npm install", "git status"],
			deniedCommands: ["rm -rf /"],
		}

		it("should return false when free mode is disabled", () => {
			const config = { ...baseConfig, commandApprovalFreeMode: false }
			expect(CommandApprovalHelper.shouldAutoApproveCommand("ls", config)).toBe(false)
		})

		it("should reject commands in deny list", () => {
			expect(CommandApprovalHelper.shouldAutoApproveCommand("rm -rf /", baseConfig)).toBe(false)
		})

		it("should approve already allowed commands", () => {
			expect(CommandApprovalHelper.shouldAutoApproveCommand("npm install", baseConfig)).toBe(true)
		})

		it("should approve already allowed commands with absolute path", () => {
			expect(CommandApprovalHelper.shouldAutoApproveCommand("/usr/bin/npm install", baseConfig)).toBe(true)
		})

		it("should approve already allowed commands with different arguments", () => {
			expect(CommandApprovalHelper.shouldAutoApproveCommand("npm install express", baseConfig)).toBe(true)
		})

		it("should auto-approve safe git commands in free mode", () => {
			// In free mode, git commit is considered safe and gets auto-approved
			// even if only git status is in the allowed list
			const config = {
				...baseConfig,
				allowedCommands: ["git status"],
			}
			expect(CommandApprovalHelper.shouldAutoApproveCommand("git commit -m 'test'", config)).toBe(true)
		})

		it("should NOT auto-approve rm commands with different arguments", () => {
			const config = {
				...baseConfig,
				allowedCommands: ["rm test.txt"],
			}
			expect(CommandApprovalHelper.shouldAutoApproveCommand("rm important.txt", config)).toBe(false)
		})

		it("should NOT auto-approve new commands when not in allowed list", () => {
			// ls is not in allowed list and not dangerous, but still needs approval
			expect(CommandApprovalHelper.shouldAutoApproveCommand("ls -la", baseConfig)).toBe(false)
		})

		it("should NOT approve new commands that are not in allowed list when free mode is off", () => {
			const config = { ...baseConfig, commandApprovalFreeMode: false }
			expect(CommandApprovalHelper.shouldAutoApproveCommand("ls", config)).toBe(false)
		})
	})

	describe("getApprovalReason", () => {
		const baseConfig = {
			commandApprovalFreeMode: true,
			allowedCommands: ["npm install"],
			deniedCommands: ["rm -rf /"],
		}

		it("should return correct reason for denied commands", () => {
			const reason = CommandApprovalHelper.getApprovalReason("rm -rf /", baseConfig)
			expect(reason).toContain("denied list")
		})

		it("should return correct reason for already allowed commands", () => {
			const reason = CommandApprovalHelper.getApprovalReason("npm install", baseConfig)
			expect(reason).toContain("allowed command")
		})

		it("should return correct reason for commands with absolute path", () => {
			const reason = CommandApprovalHelper.getApprovalReason("/usr/bin/npm install", baseConfig)
			expect(reason).toContain("not in allowed list")
		})

		it("should return correct reason for command not in allowed list", () => {
			const reason = CommandApprovalHelper.getApprovalReason("ls", baseConfig)
			expect(reason).toContain("not in allowed list")
		})

		it("should return correct reason when free mode is disabled", () => {
			const config = { ...baseConfig, commandApprovalFreeMode: false }
			const reason = CommandApprovalHelper.getApprovalReason("ls", config)
			expect(reason).toContain("Free mode is disabled")
		})
	})

	describe("edge cases", () => {
		it("should handle empty command", () => {
			const config = {
				commandApprovalFreeMode: true,
				allowedCommands: [],
				deniedCommands: [],
			}
			expect(CommandApprovalHelper.shouldAutoApproveCommand("", config)).toBe(false)
		})

		it("should handle command with only whitespace", () => {
			const config = {
				commandApprovalFreeMode: true,
				allowedCommands: [],
				deniedCommands: [],
			}
			expect(CommandApprovalHelper.shouldAutoApproveCommand("   ", config)).toBe(false)
		})

		it("should handle case-sensitive commands", () => {
			const config = {
				commandApprovalFreeMode: true,
				allowedCommands: ["npm install"],
				deniedCommands: [],
			}
			// Commands are case-insensitive in free mode when checking base command
			expect(CommandApprovalHelper.shouldAutoApproveCommand("NPM install", config)).toBe(true)
		})

		it("should handle commands with multiple spaces", () => {
			const config = {
				commandApprovalFreeMode: true,
				allowedCommands: ["npm install"],
				deniedCommands: [],
			}
			expect(CommandApprovalHelper.shouldAutoApproveCommand("npm  install  express", config)).toBe(true)
		})
	})

	describe("dangerous commands detection", () => {
		const config = {
			commandApprovalFreeMode: true,
			allowedCommands: [],
			deniedCommands: [],
		}

		it("should reject rm commands", () => {
			expect(CommandApprovalHelper.shouldAutoApproveCommand("rm file.txt", config)).toBe(false)
		})

		it("should reject sudo commands", () => {
			expect(CommandApprovalHelper.shouldAutoApproveCommand("sudo apt update", config)).toBe(false)
		})

		it("should reject chmod commands", () => {
			expect(CommandApprovalHelper.shouldAutoApproveCommand("chmod 777 file", config)).toBe(false)
		})

		it("should reject format commands", () => {
			expect(CommandApprovalHelper.shouldAutoApproveCommand("format C:", config)).toBe(false)
		})

		it("should reject dd commands", () => {
			expect(CommandApprovalHelper.shouldAutoApproveCommand("dd if=/dev/zero of=/dev/sda", config)).toBe(false)
		})
	})
})
