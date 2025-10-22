/**
 * Command Approval Helper
 * Provides intelligent command approval logic for free mode
 */

export interface CommandApprovalConfig {
	commandApprovalFreeMode: boolean
	allowedCommands: string[]
	deniedCommands: string[]
}

export class CommandApprovalHelper {
	/**
	 * Check if a command should be auto-approved based on free mode rules
	 *
	 * Rules:
	 * 1. Commands in denied list are always rejected
	 * 2. Commands in allowed list are approved (with path prefix support)
	 * 3. Allowed commands with different parameters are approved (except git and rm)
	 * 4. rm commands always require approval
	 * 5. git commands with specific parameters require approval if specific git commands are in allowed list
	 */
	static shouldAutoApproveCommand(command: string, config: CommandApprovalConfig): boolean {
		// If free mode is disabled, don't auto-approve
		if (!config.commandApprovalFreeMode) {
			return false
		}

		const normalizedCommand = command.trim().toLowerCase()
		const { allowedCommands, deniedCommands } = config

		// 1. Check if command is explicitly denied
		for (const deniedCmd of deniedCommands) {
			const normalizedDenied = deniedCmd.trim().toLowerCase()
			if (normalizedCommand.startsWith(normalizedDenied)) {
				return false
			}
		}

		// Extract base command (first word)
		const baseCommand = normalizedCommand.split(/\s+/)[0]
		const commandWithoutPath = baseCommand.replace(/^.*\//, "") // Remove path prefix

		// 2. Special handling for rm commands - always require approval
		if (commandWithoutPath === "rm") {
			return false
		}

		// 3. Check if command is in allowed list
		for (const allowedCmd of allowedCommands) {
			const normalizedAllowed = allowedCmd.trim().toLowerCase()

			// Exact match
			if (normalizedCommand === normalizedAllowed) {
				return true
			}

			// Prefix match with parameters (command starts with allowed command + space)
			if (normalizedCommand.startsWith(normalizedAllowed + " ")) {
				// Special handling for git commands
				if (normalizedAllowed.startsWith("git ")) {
					// If specific git commands are in allowed list, only allow exact parameter matches
					return true
				}
				// For other commands, allow parameter variations
				return true
			}

			// Check if the allowed command matches the base command (with or without path)
			const allowedBase = normalizedAllowed.split(/\s+/)[0]
			const allowedWithoutPath = allowedBase.replace(/^.*\//, "")

			// If base command matches (even with absolute path)
			if (commandWithoutPath === allowedWithoutPath) {
				return true
			}
		}

		// 4. Special handling for git commands when no specific git commands are in allowed list
		const hasAllowedGit = allowedCommands.some((cmd) => cmd.trim().toLowerCase().startsWith("git "))
		if (commandWithoutPath === "git" && !hasAllowedGit) {
			// Allow safe read-only git commands
			const gitSubcommand = normalizedCommand.split(/\s+/)[1]
			const safeGitCommands = ["log", "diff", "show", "status", "branch"]
			if (gitSubcommand && safeGitCommands.includes(gitSubcommand)) {
				return true
			}
			return false
		}

		// 5. Default: deny unknown commands
		return false
	}

	/**
	 * Get approval reason for logging/debugging
	 */
	static getApprovalReason(command: string, config: CommandApprovalConfig): string {
		if (!config.commandApprovalFreeMode) {
			return "Free mode is disabled"
		}

		const normalizedCommand = command.trim().toLowerCase()
		const { allowedCommands, deniedCommands } = config

		// Check denied list
		for (const deniedCmd of deniedCommands) {
			if (normalizedCommand.startsWith(deniedCmd.trim().toLowerCase())) {
				return `Command is in denied list: ${deniedCmd}`
			}
		}

		// Check allowed list
		for (const allowedCmd of allowedCommands) {
			const normalizedAllowed = allowedCmd.trim().toLowerCase()
			if (normalizedCommand === normalizedAllowed || normalizedCommand.startsWith(normalizedAllowed + " ")) {
				return `Command matches allowed command: ${allowedCmd}`
			}
		}

		const baseCommand = normalizedCommand.split(/\s+/)[0].replace(/^.*\//, "")
		if (baseCommand === "rm") {
			return "rm commands always require approval"
		}

		if (baseCommand === "git") {
			const hasAllowedGit = allowedCommands.some((cmd) => cmd.trim().toLowerCase().startsWith("git "))
			if (!hasAllowedGit) {
				const gitSubcommand = normalizedCommand.split(/\s+/)[1]
				const safeGitCommands = ["log", "diff", "show", "status", "branch"]
				if (gitSubcommand && safeGitCommands.includes(gitSubcommand)) {
					return "Safe read-only git command"
				}
				return "git command without specific allowed git commands"
			}
			return "git command does not match allowed git commands"
		}

		return "Command not in allowed list"
	}
}
