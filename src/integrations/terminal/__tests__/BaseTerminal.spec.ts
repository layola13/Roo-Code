import { describe, it, expect, beforeEach } from "vitest"
import { BaseTerminal } from "../BaseTerminal"

describe("BaseTerminal", () => {
	describe("Command Execution Timeout", () => {
		beforeEach(() => {
			// Reset to default value before each test
			BaseTerminal.setCommandExecutionTimeout(60)
		})

		it("should have default command execution timeout of 60 seconds", () => {
			const timeout = BaseTerminal.getCommandExecutionTimeout()
			expect(timeout).toBe(60)
		})

		it("should allow setting command execution timeout", () => {
			BaseTerminal.setCommandExecutionTimeout(120)
			expect(BaseTerminal.getCommandExecutionTimeout()).toBe(120)
		})

		it("should allow setting timeout to 0 (no timeout)", () => {
			BaseTerminal.setCommandExecutionTimeout(0)
			expect(BaseTerminal.getCommandExecutionTimeout()).toBe(0)
		})

		it("should persist timeout value across multiple gets", () => {
			BaseTerminal.setCommandExecutionTimeout(30)
			expect(BaseTerminal.getCommandExecutionTimeout()).toBe(30)
			expect(BaseTerminal.getCommandExecutionTimeout()).toBe(30)
			expect(BaseTerminal.getCommandExecutionTimeout()).toBe(30)
		})
	})
})
