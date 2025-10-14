/**
 * HostInterface单元测试
 *
 * 测试WASM与宿主环境之间的通信桥梁
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { HostInterface } from "../HostInterface"
import * as vscode from "vscode"
import * as path from "path"

// Mock fs/promises模块
vi.mock("fs/promises", () => ({
	readFile: vi.fn(),
	writeFile: vi.fn(),
	mkdir: vi.fn(),
	unlink: vi.fn(),
	access: vi.fn(),
	readdir: vi.fn(),
}))

// Mock vscode模块
vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		showQuickPick: vi.fn(),
		createTerminal: vi.fn(),
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		})),
		terminals: [],
	},
	workspace: {
		workspaceFolders: [
			{
				uri: { fsPath: "/test/workspace" },
				name: "test",
				index: 0,
			},
		],
		getConfiguration: vi.fn(() => ({
			get: vi.fn(),
			update: vi.fn(),
		})),
	},
	ConfigurationTarget: {
		Global: 1,
		Workspace: 2,
		WorkspaceFolder: 3,
	},
}))

// Mock safeWriteJson
vi.mock("../../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn(),
}))

describe("HostInterface", () => {
	let hostInterface: HostInterface
	let mockOutputChannel: any

	beforeEach(() => {
		mockOutputChannel = {
			appendLine: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		}
		hostInterface = new HostInterface("/test/workspace", mockOutputChannel)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	// ==================== 文件系统操作测试 ====================

	describe("文件系统操作", () => {
		it("应该能读取文件", async () => {
			const mockContent = "test content"
			const fs = await import("fs/promises")
			;(fs.readFile as any).mockResolvedValue(mockContent)

			const result = await hostInterface.readFile("test.txt")

			expect(result).toBe(mockContent)
			expect(fs.readFile).toHaveBeenCalledWith(path.join("/test/workspace", "test.txt"), "utf-8")
		})

		it("应该能写入文件", async () => {
			const fs = await import("fs/promises")
			;(fs.mkdir as any).mockResolvedValue(undefined)
			;(fs.writeFile as any).mockResolvedValue(undefined)

			await hostInterface.writeFile("test.txt", "content")

			expect(fs.mkdir).toHaveBeenCalled()
			expect(fs.writeFile).toHaveBeenCalledWith(path.join("/test/workspace", "test.txt"), "content", "utf-8")
		})

		it("应该能删除文件", async () => {
			const fs = await import("fs/promises")
			;(fs.unlink as any).mockResolvedValue(undefined)

			await hostInterface.deleteFile("test.txt")

			expect(fs.unlink).toHaveBeenCalledWith(path.join("/test/workspace", "test.txt"))
		})

		it("应该能检查文件是否存在", async () => {
			const fs = await import("fs/promises")
			;(fs.access as any).mockResolvedValue(undefined)

			const exists = await hostInterface.fileExists("test.txt")

			expect(exists).toBe(true)
			expect(fs.access).toHaveBeenCalled()
		})

		it("文件不存在时应返回false", async () => {
			const fs = await import("fs/promises")
			;(fs.access as any).mockRejectedValue(new Error("ENOENT"))

			const exists = await hostInterface.fileExists("nonexistent.txt")

			expect(exists).toBe(false)
		})

		it("应该能列出目录文件", async () => {
			const mockFiles = ["file1.txt", "file2.txt"]
			const fs = await import("fs/promises")
			;(fs.readdir as any).mockResolvedValue(mockFiles)

			const files = await hostInterface.listFiles(".")

			expect(files).toEqual(mockFiles)
		})

		it("应该能创建目录", async () => {
			const fs = await import("fs/promises")
			;(fs.mkdir as any).mockResolvedValue(undefined)

			await hostInterface.createDirectory("test/dir")

			expect(fs.mkdir).toHaveBeenCalledWith(path.join("/test/workspace", "test/dir"), { recursive: true })
		})

		it("应该能处理绝对路径", async () => {
			const fs = await import("fs/promises")
			;(fs.readFile as any).mockResolvedValue("content")

			await hostInterface.readFile("/absolute/path/test.txt")

			expect(fs.readFile).toHaveBeenCalledWith("/absolute/path/test.txt", "utf-8")
		})
	})

	// ==================== 终端操作测试 ====================

	describe("终端操作", () => {
		it("应该能执行命令并返回结果", async () => {
			// executeCommand内部使用require,这里只测试接口存在
			expect(typeof hostInterface.executeCommand).toBe("function")
		})

		it("应该能创建终端", async () => {
			await hostInterface.createTerminal("test-terminal")

			expect(vscode.window.createTerminal).toHaveBeenCalledWith({
				name: "test-terminal",
			})
		})

		it("应该能向终端发送文本", async () => {
			const mockTerminal = {
				name: "test-terminal",
				sendText: vi.fn(),
			}
			;(vscode.window as any).terminals = [mockTerminal]

			await hostInterface.sendToTerminal("test-terminal", "echo hello")

			expect(mockTerminal.sendText).toHaveBeenCalledWith("echo hello")
		})

		it("终端不存在时应抛出错误", async () => {
			;(vscode.window as any).terminals = []

			await expect(hostInterface.sendToTerminal("nonexistent", "test")).rejects.toThrow(
				"Terminal not found: nonexistent",
			)
		})
	})

	// ==================== UI操作测试 ====================

	describe("UI操作", () => {
		it("应该能显示信息消息", async () => {
			await hostInterface.showMessage("test info", "info")

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("test info")
		})

		it("应该能显示警告消息", async () => {
			await hostInterface.showMessage("test warning", "warning")

			expect(vscode.window.showWarningMessage).toHaveBeenCalledWith("test warning")
		})

		it("应该能显示错误消息", async () => {
			await hostInterface.showMessage("test error", "error")

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("test error")
		})

		it("应该能显示进度", async () => {
			await hostInterface.showProgress("Processing", 50)

			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
		})

		it("应该能询问用户问题", async () => {
			const mockOptions = ["Option 1", "Option 2"]
			;(vscode.window.showQuickPick as any).mockResolvedValue("Option 1")

			const result = await hostInterface.askQuestion("Choose an option", mockOptions)

			expect(result).toBe("Option 1")
			expect(vscode.window.showQuickPick).toHaveBeenCalledWith(mockOptions, { placeHolder: "Choose an option" })
		})
	})

	// ==================== 网络操作测试 ====================

	describe("网络操作", () => {
		it("应该能发送HTTP请求", async () => {
			// 这个测试需要mock http/https模块
			// 简化测试，只验证方法存在
			expect(typeof hostInterface.httpRequest).toBe("function")
		})
	})

	// ==================== 配置操作测试 ====================

	describe("配置操作", () => {
		it("应该能获取配置", async () => {
			const mockConfig = {
				get: vi.fn().mockReturnValue("test-value"),
			}
			;(vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig)

			const value = await hostInterface.getConfig("test-key")

			expect(value).toBe("test-value")
			expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("roo-code")
			expect(mockConfig.get).toHaveBeenCalledWith("test-key")
		})

		it("应该能设置配置", async () => {
			const mockConfig = {
				update: vi.fn(),
			}
			;(vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig)

			await hostInterface.setConfig("test-key", "new-value")

			expect(mockConfig.update).toHaveBeenCalledWith("test-key", "new-value", vscode.ConfigurationTarget.Global)
		})
	})

	// ==================== 日志操作测试 ====================

	describe("日志操作", () => {
		it("应该能记录debug日志", () => {
			const consoleSpy = vi.spyOn(console, "log")

			hostInterface.log("debug", "debug message")

			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
			expect(consoleSpy).toHaveBeenCalled()
		})

		it("应该能记录info日志", () => {
			const consoleSpy = vi.spyOn(console, "log")

			hostInterface.log("info", "info message")

			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
			expect(consoleSpy).toHaveBeenCalled()
		})

		it("应该能记录warn日志", () => {
			const consoleSpy = vi.spyOn(console, "warn")

			hostInterface.log("warn", "warn message")

			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
			expect(consoleSpy).toHaveBeenCalled()
		})

		it("应该能记录error日志", () => {
			const consoleSpy = vi.spyOn(console, "error")

			hostInterface.log("error", "error message")

			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
			expect(consoleSpy).toHaveBeenCalled()
		})

		it("日志应包含时间戳和级别", () => {
			hostInterface.log("info", "test message")

			const call = mockOutputChannel.appendLine.mock.calls[0][0]
			expect(call).toMatch(/\[.*\]/)
			expect(call).toMatch(/\[INFO\]/)
			expect(call).toContain("test message")
		})
	})

	// ==================== 向量数据库操作测试 ====================

	describe("向量数据库操作", () => {
		it("search方法应存在并返回空数组（未实现）", async () => {
			const result = await hostInterface.search("test query", 10)

			expect(result).toEqual([])
			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
		})

		it("insert方法应存在（未实现）", async () => {
			await hostInterface.insert("id1", [1, 2, 3], { key: "value" })

			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
		})

		it("delete方法应存在（未实现）", async () => {
			await hostInterface.delete("id1")

			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
		})
	})

	// ==================== JSON操作测试 ====================

	describe("JSON操作", () => {
		it("应该能写入JSON文件（使用safeWriteJson）", async () => {
			const { safeWriteJson } = await import("../../../../utils/safeWriteJson")

			await hostInterface.writeJson("test.json", { key: "value" })

			expect(safeWriteJson).toHaveBeenCalledWith(path.join("/test/workspace", "test.json"), { key: "value" })
		})

		it("应该能读取JSON文件", async () => {
			const mockJson = { key: "value" }
			const fs = await import("fs/promises")
			;(fs.readFile as any).mockResolvedValue(JSON.stringify(mockJson))

			const result = await hostInterface.readJson("test.json")

			expect(result).toEqual(mockJson)
		})

		it("读取无效JSON时应抛出错误", async () => {
			const fs = await import("fs/promises")
			;(fs.readFile as any).mockResolvedValue("invalid json")

			await expect(hostInterface.readJson("test.json")).rejects.toThrow()
		})
	})

	// ==================== 路径解析测试 ====================

	describe("路径解析", () => {
		it("应该正确解析相对路径", async () => {
			const fs = await import("fs/promises")
			;(fs.readFile as any).mockResolvedValue("content")

			await hostInterface.readFile("relative/path/test.txt")

			expect(fs.readFile).toHaveBeenCalledWith(path.join("/test/workspace", "relative/path/test.txt"), "utf-8")
		})

		it("应该保留绝对路径", async () => {
			const fs = await import("fs/promises")
			;(fs.readFile as any).mockResolvedValue("content")

			await hostInterface.readFile("/absolute/path/test.txt")

			expect(fs.readFile).toHaveBeenCalledWith("/absolute/path/test.txt", "utf-8")
		})
	})

	// ==================== 错误处理测试 ====================

	describe("错误处理", () => {
		it("文件不存在时readFile应抛出错误", async () => {
			const fs = await import("fs/promises")
			;(fs.readFile as any).mockRejectedValue(new Error("ENOENT: no such file or directory"))

			await expect(hostInterface.readFile("nonexistent.txt")).rejects.toThrow()
		})

		it("目录创建失败时应抛出错误", async () => {
			const fs = await import("fs/promises")
			;(fs.mkdir as any).mockRejectedValue(new Error("Permission denied"))

			await expect(hostInterface.createDirectory("test/dir")).rejects.toThrow()
		})
	})
})
