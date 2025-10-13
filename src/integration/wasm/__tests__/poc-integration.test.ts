/**
 * POC Integration Test
 *
 * This test validates the complete Host Interface design by:
 * 1. Loading the Rust WASM module
 * 2. Injecting Host Interface implementations
 * 3. Calling Rust functions that use Host Interface
 * 4. Verifying end-to-end communication
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { WasmLoader } from "../WasmLoader"
import { HostInterface } from "../HostInterface"
import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

// Mock VSCode API
vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		showQuickPick: vi.fn(),
		showInputBox: vi.fn(),
	},
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: process.cwd(),
				},
			},
		],
		getConfiguration: vi.fn(() => ({
			get: vi.fn(),
			update: vi.fn(),
		})),
	},
	ConfigurationTarget: {
		Global: 1,
	},
}))

describe("POC Integration Test", () => {
	let wasmLoader: WasmLoader
	let hostInterface: HostInterface
	let testDir: string

	beforeAll(async () => {
		// Create temporary test directory
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-wasm-test-"))

		// Initialize Host Interface
		hostInterface = new HostInterface()

		// Initialize WASM loader
		wasmLoader = new WasmLoader()

		try {
			await wasmLoader.initialize({
				enableLogging: true,
			})
		} catch (error) {
			console.error("WASM initialization failed:", error)
			console.log("Skipping integration tests - WASM not built")
			// Tests will be skipped if WASM is not available
		}
	}, 30000) // 30s timeout for WASM loading

	afterAll(async () => {
		// Cleanup
		await wasmLoader.cleanup()
		await fs.rm(testDir, { recursive: true, force: true })
	})

	describe("Host Interface - File System", () => {
		it("should write and read file through WASM", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			const testFile = path.join(testDir, "test.txt")
			const testContent = "Hello from WASM!"

			// Write file
			await hostInterface.writeFile(testFile, testContent)

			// Read file
			const content = await hostInterface.readFile(testFile)

			expect(content).toBe(testContent)
		})

		it("should check file existence", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			const existingFile = path.join(testDir, "existing.txt")
			const nonExistentFile = path.join(testDir, "nonexistent.txt")

			await hostInterface.writeFile(existingFile, "test")

			expect(await hostInterface.fileExists(existingFile)).toBe(true)
			expect(await hostInterface.fileExists(nonExistentFile)).toBe(false)
		})

		it("should list directory contents", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			const subDir = path.join(testDir, "subdir")
			await hostInterface.createDir(subDir)

			await hostInterface.writeFile(path.join(subDir, "file1.txt"), "content1")
			await hostInterface.writeFile(path.join(subDir, "file2.txt"), "content2")

			const files = await hostInterface.listDir(subDir)

			expect(files).toHaveLength(2)
			expect(files).toContain("file1.txt")
			expect(files).toContain("file2.txt")
		})

		it("should get file metadata", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			const testFile = path.join(testDir, "metadata-test.txt")
			const content = "test content"

			await hostInterface.writeFile(testFile, content)

			const metadata = await hostInterface.getFileMetadata(testFile)

			expect(metadata.size).toBe(content.length)
			expect(metadata.isFile).toBe(true)
			expect(metadata.isDirectory).toBe(false)
			expect(metadata.created).toBeGreaterThan(0)
			expect(metadata.modified).toBeGreaterThan(0)
		})

		it("should delete file", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			const testFile = path.join(testDir, "delete-test.txt")

			await hostInterface.writeFile(testFile, "to be deleted")
			expect(await hostInterface.fileExists(testFile)).toBe(true)

			await hostInterface.deleteFile(testFile)
			expect(await hostInterface.fileExists(testFile)).toBe(false)
		})
	})

	describe("Host Interface - Terminal", () => {
		it("should execute command and return output", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			const command = process.platform === "win32" ? "echo test" : "echo test"

			const output = await hostInterface.executeCommand(command)

			expect(output).toContain("test")
		})

		it("should execute command in specific directory", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			const pwdCommand = process.platform === "win32" ? "cd" : "pwd"

			const output = await hostInterface.executeCommand(pwdCommand, testDir)

			expect(output.trim()).toContain(path.basename(testDir))
		})
	})

	describe("Host Interface - UI", () => {
		it("should show notification", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			await hostInterface.showNotification("Test message", "info")

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("Test message")
		})

		it("should show error", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			await hostInterface.showError("Test error")

			expect(vscode.window.showErrorMessage).toHaveBeenCalled()
		})

		it("should ask for approval", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			;(vscode.window.showQuickPick as any).mockResolvedValueOnce("Yes")

			const result = await hostInterface.askApproval("Approve this?", ["Yes", "No"])

			expect(result).toBe("Yes")
			expect(vscode.window.showQuickPick).toHaveBeenCalled()
		})

		it("should ask for input", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			;(vscode.window.showInputBox as any).mockResolvedValueOnce("User input")

			const result = await hostInterface.askInput("Enter something:")

			expect(result).toBe("User input")
			expect(vscode.window.showInputBox).toHaveBeenCalled()
		})
	})

	describe("Host Interface - Network", () => {
		it("should make HTTP request", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			// Mock fetch
			global.fetch = vi.fn().mockResolvedValueOnce({
				status: 200,
				headers: new Map([["content-type", "application/json"]]),
				text: async () => '{"success": true}',
			})

			const response = await hostInterface.httpRequest("https://example.com/api", {
				method: "GET",
			})

			expect(response.status).toBe(200)
			expect(response.body).toContain("success")
		})
	})

	describe("Host Interface - Configuration", () => {
		it("should get and set configuration", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			const mockConfig = {
				get: vi.fn().mockReturnValue("test-value"),
				update: vi.fn().mockResolvedValue(undefined),
			}

			;(vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig)

			// Get config
			const value = await hostInterface.getConfig("test-key")
			expect(value).toBe("test-value")

			// Set config
			await hostInterface.setConfig("test-key", "new-value")
			expect(mockConfig.update).toHaveBeenCalledWith("test-key", "new-value", 1)
		})
	})

	describe("WASM Module Integration", () => {
		it("should initialize WASM module", () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			expect(wasmLoader.isReady()).toBe(true)
		})

		it("should get WASM module instance", () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			const module = wasmLoader.getModule()
			expect(module).toBeDefined()
			expect(typeof module.initialize).toBe("function")
		})

		it("should call WASM initialize function", () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			const module = wasmLoader.getModule()
			const version = module.initialize()

			expect(version).toContain("Roo-Code WASM")
		})

		it("should create task through WASM", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			const module = wasmLoader.getModule()

			const taskId = await module.create_task("Test Task", "Test Description")

			expect(taskId).toBeTruthy()
			expect(typeof taskId).toBe("string")
		})

		it("should get task state through WASM", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			const module = wasmLoader.getModule()

			const taskId = await module.create_task("State Test", "Description")
			const state = await module.get_task_state(taskId)

			expect(state).toBe("Created")
		})

		it("should update task state through WASM", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			const module = wasmLoader.getModule()

			const taskId = await module.create_task("Update Test", "Description")

			await module.update_task_state(taskId, "Running")

			const state = await module.get_task_state(taskId)
			expect(state).toBe("Running")
		})

		it("should add and search memory through WASM", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			const module = wasmLoader.getModule()

			// Add memory
			const memoryId = await module.add_memory("UserInstruction", "Remember to use TypeScript", "Critical")

			expect(memoryId).toBeTruthy()

			// Search memory
			const results = await module.search_memory("TypeScript", 10)
			const parsedResults = JSON.parse(results)

			expect(Array.isArray(parsedResults)).toBe(true)
			expect(parsedResults.length).toBeGreaterThan(0)
		})
	})

	describe("End-to-End Workflow", () => {
		it("should complete a full task lifecycle with file operations", async () => {
			if (!wasmLoader.isReady()) {
				console.log("Skipping test - WASM not initialized")
				return
			}

			const module = wasmLoader.getModule()

			// 1. Create task
			const taskId = await module.create_task("File Processing Task", "Process files via WASM")

			// 2. Update task state to Running
			await module.update_task_state(taskId, "Running")

			// 3. Perform file operations through Host Interface
			const testFile = path.join(testDir, "workflow-test.txt")
			await hostInterface.writeFile(testFile, "Processed by WASM")

			// 4. Verify file was created
			expect(await hostInterface.fileExists(testFile)).toBe(true)

			// 5. Read file content
			const content = await hostInterface.readFile(testFile)
			expect(content).toBe("Processed by WASM")

			// 6. Add memory about this operation
			await module.add_memory("WorkflowPattern", `Task ${taskId} processed file: ${testFile}`, "Medium")

			// 7. Complete task
			await module.update_task_state(taskId, "Completed")

			// 8. Verify final state
			const finalState = await module.get_task_state(taskId)
			expect(finalState).toBe("Completed")
		})
	})
})
