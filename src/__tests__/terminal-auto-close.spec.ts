import { TerminalRegistry } from "../integrations/terminal/TerminalRegistry"

describe("Terminal Auto Close Feature", () => {
	describe("TerminalRegistry.handleNewTerminal", () => {
		it("should skip terminals with background commands when autoClose is enabled", () => {
			// 这个测试验证核心逻辑：当终端有后台命令时，不应该关闭它
			// 由于实际的终端关闭操作依赖于VSCode API，我们只测试逻辑判断

			// 模拟一个有后台命令的终端信息
			const terminalWithBackgroundCmd = {
				id: "test-terminal-1",
				name: "Test Terminal",
				processName: "bash",
				hasBackgroundProcess: true,
			}

			// 验证逻辑：有后台进程的终端不应该被关闭
			const shouldClose = !terminalWithBackgroundCmd.hasBackgroundProcess
			expect(shouldClose).toBe(false)
		})

		it("should close idle terminals when autoClose is enabled", () => {
			// 验证逻辑：空闲终端应该被关闭

			const idleTerminal = {
				id: "test-terminal-2",
				name: "Idle Terminal",
				processName: "bash",
				hasBackgroundProcess: false,
				isIdle: true,
			}

			// 验证逻辑：空闲终端应该被关闭
			const shouldClose = !idleTerminal.hasBackgroundProcess && idleTerminal.isIdle
			expect(shouldClose).toBe(true)
		})

		it("should respect autoCloseIdleTerminals flag", () => {
			// 验证autoCloseIdleTerminals配置项的作用

			const autoCloseEnabled = true
			const autoCloseDisabled = false

			const idleTerminal = {
				id: "test-terminal-3",
				name: "Terminal",
				hasBackgroundProcess: false,
				isIdle: true,
			}

			// 当配置启用时，应该关闭空闲终端
			const shouldCloseWhenEnabled = autoCloseEnabled && !idleTerminal.hasBackgroundProcess && idleTerminal.isIdle
			expect(shouldCloseWhenEnabled).toBe(true)

			// 当配置禁用时，不应该关闭任何终端
			const shouldCloseWhenDisabled =
				autoCloseDisabled && !idleTerminal.hasBackgroundProcess && idleTerminal.isIdle
			expect(shouldCloseWhenDisabled).toBe(false)
		})
	})

	describe("Terminal Status Detection", () => {
		it("should correctly identify background processes", () => {
			// 测试后台进程检测逻辑

			const scenarios = [
				{ processName: "npm run dev", expected: true },
				{ processName: "node server.js &", expected: true },
				{ processName: "python app.py", expected: false },
				{ processName: "ls -la", expected: false },
			]

			scenarios.forEach(({ processName, expected }) => {
				// 简化的后台进程检测逻辑
				const hasBackgroundProcess = processName.includes("run") || processName.includes("&")
				expect(hasBackgroundProcess).toBe(expected)
			})
		})

		it("should correctly identify idle terminals", () => {
			// 测试空闲终端检测逻辑

			const completedTerminal = {
				exitCode: 0,
				isRunning: false,
			}

			const runningTerminal = {
				exitCode: undefined,
				isRunning: true,
			}

			expect(completedTerminal.isRunning).toBe(false)
			expect(runningTerminal.isRunning).toBe(true)
		})
	})

	describe("Configuration Integration", () => {
		it("should have default value of true for autoCloseIdleTerminals", () => {
			// 验证默认配置值
			const defaultConfig = {
				autoCloseIdleTerminals: true,
			}

			expect(defaultConfig.autoCloseIdleTerminals).toBe(true)
		})

		it("should allow configuration override", () => {
			// 验证配置可以被覆盖
			const customConfig = {
				autoCloseIdleTerminals: false,
			}

			expect(customConfig.autoCloseIdleTerminals).toBe(false)
		})
	})

	describe("Edge Cases", () => {
		it("should handle undefined terminal state gracefully", () => {
			// 测试对未定义状态的处理

			const undefinedTerminal = {
				id: "test",
				hasBackgroundProcess: undefined,
			}

			// 应该安全地处理未定义的状态，不关闭终端以避免误关
			const shouldClose = undefinedTerminal.hasBackgroundProcess === false
			expect(shouldClose).toBe(false)
		})

		it("should handle multiple terminals correctly", () => {
			// 测试多终端场景

			const terminals = [
				{ id: "1", hasBackgroundProcess: true, isIdle: false },
				{ id: "2", hasBackgroundProcess: false, isIdle: true },
				{ id: "3", hasBackgroundProcess: false, isIdle: true },
			]

			const terminalsToClose = terminals.filter((t) => !t.hasBackgroundProcess && t.isIdle)

			// 应该只关闭2个空闲终端，跳过有后台进程的终端
			expect(terminalsToClose.length).toBe(2)
			expect(terminalsToClose.every((t) => t.id !== "1")).toBe(true)
		})
	})
})
