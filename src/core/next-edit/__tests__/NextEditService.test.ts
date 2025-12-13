/**
 * NextEditService 单元测试
 * 测试编辑链的创建、管理和执行
 */

import { NextEditService } from "../NextEditService"
import { NextEditMemoryManager } from "../NextEditMemoryManager"
import { NextEditProvider } from "../NextEditProvider"
import { EditChainAnalyzer } from "../EditChainAnalyzer"
import { DirectoryMemorySystem } from "../../../memory/gsw/DirectoryMemorySystem"
import { EditChain, EditStep, EditStepStatus, EditChainStatus } from "../../../memory/gsw/types/next-edit"
import {
	CreateEditChainOptions,
	StepGenerationContext,
	NextEditServiceConfig,
	StepFeedback,
	EditChainEvent,
} from "../types"

describe("NextEditService", () => {
	let service: NextEditService
	let mockMemoryManager: NextEditMemoryManager
	let mockProvider: NextEditProvider
	let mockAnalyzer: EditChainAnalyzer
	let mockGswSystem: DirectoryMemorySystem

	beforeEach(() => {
		// Mock DirectoryMemorySystem
		mockGswSystem = {
			writeMemory: vi.fn().mockResolvedValue("memory-id"),
			readMemory: vi.fn().mockResolvedValue(null),
			queryMemory: vi.fn().mockResolvedValue({ memories: [], totalFound: 0 }),
		} as any

		// Mock NextEditMemoryManager
		mockMemoryManager = new NextEditMemoryManager(mockGswSystem)
		vi.spyOn(mockMemoryManager, "saveEditChain").mockResolvedValue()
		vi.spyOn(mockMemoryManager, "loadEditChain").mockResolvedValue(null)
		vi.spyOn(mockMemoryManager, "searchSimilarChains").mockResolvedValue([])
		vi.spyOn(mockMemoryManager, "getCompletedChains").mockResolvedValue([])
		vi.spyOn(mockMemoryManager, "savePattern").mockResolvedValue()
		vi.spyOn(mockMemoryManager, "loadPattern").mockResolvedValue(null)
		vi.spyOn(mockMemoryManager, "searchPatterns").mockResolvedValue([])

		// Mock NextEditProvider
		mockProvider = new NextEditProvider("test-api-key")
		vi.spyOn(mockProvider, "generateSteps").mockResolvedValue([])

		// Mock EditChainAnalyzer
		mockAnalyzer = new EditChainAnalyzer(mockMemoryManager)
		vi.spyOn(mockAnalyzer, "learnFromChain").mockResolvedValue(null)

		// 创建服务实例（启用）
		const config: Partial<NextEditServiceConfig> = {
			enabled: true,
			maxConcurrentChains: 3,
		}
		service = new NextEditService(mockMemoryManager, mockProvider, mockAnalyzer, config)
	})

	describe("createEditChain", () => {
		it("should create a new edit chain successfully", async () => {
			const options: CreateEditChainOptions = {
				taskDescription: "Add new feature",
				taskIntent: "Implement user authentication",
				files: ["src/auth.ts"],
				executionMode: "sequential",
			}

			const chain = await service.createEditChain("session-123", options)

			expect(chain).toBeDefined()
			expect(chain.chainId).toBeDefined()
			expect(chain.sessionId).toBe("session-123")
			expect(chain.taskDescription).toBe(options.taskDescription)
			expect(chain.taskIntent).toBe(options.taskIntent)
			expect(chain.status).toBe("planning")
			expect(chain.executionMode).toBe("sequential")
			expect(chain.affectedFiles).toEqual(options.files)
			expect(chain.steps).toEqual([])
			expect(chain.currentIndex).toBe(-1)
		})

		it("should throw error when service is disabled", async () => {
			const disabledService = new NextEditService(mockMemoryManager, mockProvider, mockAnalyzer, {
				enabled: false,
			})

			const options: CreateEditChainOptions = {
				taskDescription: "Test task",
			}

			await expect(disabledService.createEditChain("session-1", options)).rejects.toThrow(
				"NextEdit service is not enabled",
			)
		})

		it("should throw error when max concurrent chains exceeded", async () => {
			const options: CreateEditChainOptions = {
				taskDescription: "Test task",
			}

			// 创建3个链（达到最大限制）
			await service.createEditChain("session-1", options)
			await service.createEditChain("session-1", options)
			await service.createEditChain("session-1", options)

			// 尝试创建第4个链
			await expect(service.createEditChain("session-1", options)).rejects.toThrow("Maximum concurrent chains")
		})

		it("should use taskDescription as taskIntent when taskIntent not provided", async () => {
			const options: CreateEditChainOptions = {
				taskDescription: "Add logging functionality",
			}

			const chain = await service.createEditChain("session-1", options)

			expect(chain.taskIntent).toBe(options.taskDescription)
		})
	})

	describe("generateSteps", () => {
		it("should generate steps for a chain", async () => {
			const chain = await service.createEditChain("session-1", {
				taskDescription: "Add feature",
			})

			const mockSteps: EditStep[] = [
				{
					index: 0,
					stepId: "step-1",
					filePath: "src/test.ts",
					startLine: 1,
					endLine: 5,
					originalCode: "old code",
					suggestedCode: "new code",
					description: "Update code",
					editType: "replace",
					status: "pending",
					confidence: 0.9,
				},
			]

			vi.spyOn(mockProvider, "generateSteps").mockResolvedValue(mockSteps)

			const context: StepGenerationContext = {
				taskDescription: "Add feature",
				existingSteps: [],
				fileContents: new Map([["src/test.ts", "file content"]]),
			}

			const steps = await service.generateSteps(chain.chainId, context)

			expect(steps).toHaveLength(1)
			expect(steps[0]).toEqual(mockSteps[0])
			expect(mockProvider.generateSteps).toHaveBeenCalledWith(context)
		})

		it("should throw error for non-existent chain", async () => {
			const context: StepGenerationContext = {
				taskDescription: "Test",
				existingSteps: [],
				fileContents: new Map(),
			}

			await expect(service.generateSteps("non-existent-chain", context)).rejects.toThrow(
				"Chain non-existent-chain not found",
			)
		})

		it("should validate steps and throw in strict mode", async () => {
			const strictService = new NextEditService(mockMemoryManager, mockProvider, mockAnalyzer, {
				enabled: true,
				validationMode: "strict",
			})

			const chain = await strictService.createEditChain("session-1", {
				taskDescription: "Test",
			})

			// 生成无效步骤（缺少filePath）
			const invalidSteps: EditStep[] = [
				{
					index: 0,
					stepId: "step-1",
					filePath: "", // 无效
					startLine: 1,
					endLine: 5,
					originalCode: "old",
					suggestedCode: "new",
					description: "Test",
					editType: "replace",
					status: "pending",
					confidence: 0.9,
				},
			]

			vi.spyOn(mockProvider, "generateSteps").mockResolvedValue(invalidSteps)

			const context: StepGenerationContext = {
				taskDescription: "Test",
				existingSteps: [],
				fileContents: new Map(),
			}

			await expect(strictService.generateSteps(chain.chainId, context)).rejects.toThrow("Step validation failed")
		})
	})

	describe("validateStep", () => {
		it("should validate a correct step", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })

			const step: EditStep = {
				index: 0,
				stepId: "step-1",
				filePath: "src/test.ts",
				startLine: 1,
				endLine: 5,
				originalCode: "old code",
				suggestedCode: "new code",
				description: "Update code",
				editType: "replace",
				status: "pending",
				confidence: 0.9,
			}

			const result = await service.validateStep(step, chain)

			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it("should detect missing file path", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })

			const step: EditStep = {
				index: 0,
				stepId: "step-1",
				filePath: "",
				startLine: 1,
				endLine: 5,
				originalCode: "old",
				suggestedCode: "new",
				description: "Test",
				editType: "replace",
				status: "pending",
				confidence: 0.9,
			}

			const result = await service.validateStep(step, chain)

			expect(result.valid).toBe(false)
			expect(result.errors).toContain("Missing file path")
		})

		it("should detect invalid line range", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })

			const step: EditStep = {
				index: 0,
				stepId: "step-1",
				filePath: "src/test.ts",
				startLine: 10,
				endLine: 5, // endLine < startLine
				originalCode: "old",
				suggestedCode: "new",
				description: "Test",
				editType: "replace",
				status: "pending",
				confidence: 0.9,
			}

			const result = await service.validateStep(step, chain)

			expect(result.valid).toBe(false)
			expect(result.errors).toContain("Invalid line range")
		})

		it("should warn about low confidence", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })

			const step: EditStep = {
				index: 0,
				stepId: "step-1",
				filePath: "src/test.ts",
				startLine: 1,
				endLine: 5,
				originalCode: "old",
				suggestedCode: "new",
				description: "Test",
				editType: "replace",
				status: "pending",
				confidence: 0.3, // 低置信度
			}

			const result = await service.validateStep(step, chain)

			expect(result.valid).toBe(true)
			expect(result.warnings.length).toBeGreaterThan(0)
			expect(result.warnings[0]).toContain("Low confidence")
		})
	})

	describe("startChain", () => {
		it("should start a chain in planning state", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })

			expect(chain.status).toBe("planning")
			expect(chain.currentIndex).toBe(-1)

			await service.startChain(chain.chainId)

			const updatedChain = service.getChain(chain.chainId)
			expect(updatedChain?.status).toBe("active")
			expect(updatedChain?.currentIndex).toBe(0)
		})

		it("should throw error for non-existent chain", async () => {
			await expect(service.startChain("non-existent")).rejects.toThrow("Chain non-existent not found")
		})

		it("should throw error if chain not in planning state", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })
			await service.startChain(chain.chainId)

			// 尝试再次启动
			await expect(service.startChain(chain.chainId)).rejects.toThrow("not in planning state")
		})
	})

	describe("handleStepFeedback", () => {
		it("should accept a step", async () => {
			const chain = await service.createEditChain("session-1", {
				taskDescription: "Test",
				executionMode: "parallel", // Use parallel mode to prevent auto-advance
			})
			const steps: EditStep[] = [
				{
					index: 0,
					stepId: "step-1",
					filePath: "src/test.ts",
					startLine: 1,
					endLine: 5,
					originalCode: "old",
					suggestedCode: "new",
					description: "Test",
					editType: "replace",
					status: "pending",
					confidence: 0.9,
				},
			]

			vi.spyOn(mockProvider, "generateSteps").mockResolvedValue(steps)
			await service.generateSteps(chain.chainId, {
				taskDescription: "Test",
				existingSteps: [],
				fileContents: new Map(),
			})
			await service.startChain(chain.chainId)

			const feedback: StepFeedback = {
				stepId: "step-1",
				action: "accept",
				timestamp: new Date().toISOString(),
			}

			await service.handleStepFeedback(chain.chainId, feedback)

			const updatedChain = service.getChain(chain.chainId)
			expect(updatedChain?.steps[0].status).toBe("accepted")
		})

		it("should reject a step with reason", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })
			const steps: EditStep[] = [
				{
					index: 0,
					stepId: "step-1",
					filePath: "src/test.ts",
					startLine: 1,
					endLine: 5,
					originalCode: "old",
					suggestedCode: "new",
					description: "Test",
					editType: "replace",
					status: "pending",
					confidence: 0.9,
				},
			]

			vi.spyOn(mockProvider, "generateSteps").mockResolvedValue(steps)
			await service.generateSteps(chain.chainId, {
				taskDescription: "Test",
				existingSteps: [],
				fileContents: new Map(),
			})

			const feedback: StepFeedback = {
				stepId: "step-1",
				action: "reject",
				rejectionReason: "Not correct approach",
				timestamp: new Date().toISOString(),
			}

			await service.handleStepFeedback(chain.chainId, feedback)

			const updatedChain = service.getChain(chain.chainId)
			expect(updatedChain?.steps[0].status).toBe("rejected")
			expect(updatedChain?.steps[0].rejectionReason).toBe("Not correct approach")
		})

		it("should modify a step", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })
			const steps: EditStep[] = [
				{
					index: 0,
					stepId: "step-1",
					filePath: "src/test.ts",
					startLine: 1,
					endLine: 5,
					originalCode: "old",
					suggestedCode: "new",
					description: "Test",
					editType: "replace",
					status: "pending",
					confidence: 0.9,
				},
			]

			vi.spyOn(mockProvider, "generateSteps").mockResolvedValue(steps)
			await service.generateSteps(chain.chainId, {
				taskDescription: "Test",
				existingSteps: [],
				fileContents: new Map(),
			})

			const feedback: StepFeedback = {
				stepId: "step-1",
				action: "modify",
				modifiedCode: "user modified code",
				timestamp: new Date().toISOString(),
			}

			await service.handleStepFeedback(chain.chainId, feedback)

			const updatedChain = service.getChain(chain.chainId)
			expect(updatedChain?.steps[0].status).toBe("modified")
			expect(updatedChain?.steps[0].userModifiedCode).toBe("user modified code")
		})
	})

	describe("advanceChain", () => {
		it("should advance to next step", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })
			const steps: EditStep[] = [
				{
					index: 0,
					stepId: "step-1",
					filePath: "src/test.ts",
					startLine: 1,
					endLine: 5,
					originalCode: "old",
					suggestedCode: "new",
					description: "Test",
					editType: "replace",
					status: "accepted",
					confidence: 0.9,
				},
				{
					index: 1,
					stepId: "step-2",
					filePath: "src/test.ts",
					startLine: 6,
					endLine: 10,
					originalCode: "old2",
					suggestedCode: "new2",
					description: "Test 2",
					editType: "replace",
					status: "pending",
					confidence: 0.9,
				},
			]

			vi.spyOn(mockProvider, "generateSteps").mockResolvedValue(steps)
			await service.generateSteps(chain.chainId, {
				taskDescription: "Test",
				existingSteps: [],
				fileContents: new Map(),
			})
			await service.startChain(chain.chainId)

			const advanced = await service.advanceChain(chain.chainId)

			expect(advanced).toBe(true)
			const updatedChain = service.getChain(chain.chainId)
			expect(updatedChain?.currentIndex).toBe(1)
		})

		it("should not advance if current step is pending", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })
			const steps: EditStep[] = [
				{
					index: 0,
					stepId: "step-1",
					filePath: "src/test.ts",
					startLine: 1,
					endLine: 5,
					originalCode: "old",
					suggestedCode: "new",
					description: "Test",
					editType: "replace",
					status: "pending",
					confidence: 0.9,
				},
			]

			vi.spyOn(mockProvider, "generateSteps").mockResolvedValue(steps)
			await service.generateSteps(chain.chainId, {
				taskDescription: "Test",
				existingSteps: [],
				fileContents: new Map(),
			})
			await service.startChain(chain.chainId)

			const advanced = await service.advanceChain(chain.chainId)

			expect(advanced).toBe(false)
			const updatedChain = service.getChain(chain.chainId)
			expect(updatedChain?.currentIndex).toBe(0)
		})
	})

	describe("completeChain", () => {
		it("should complete a chain and save to memory", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })
			const steps: EditStep[] = [
				{
					index: 0,
					stepId: "step-1",
					filePath: "src/test.ts",
					startLine: 1,
					endLine: 5,
					originalCode: "old",
					suggestedCode: "new",
					description: "Test",
					editType: "replace",
					status: "accepted",
					confidence: 0.9,
				},
			]

			vi.spyOn(mockProvider, "generateSteps").mockResolvedValue(steps)
			await service.generateSteps(chain.chainId, {
				taskDescription: "Test",
				existingSteps: [],
				fileContents: new Map(),
			})

			const result = await service.completeChain(chain.chainId)

			expect(result.status).toBe("completed")
			expect(result.chainId).toBe(chain.chainId)
			expect(result.totalSteps).toBe(1)
			expect(result.acceptedSteps).toBe(1)

			expect(mockMemoryManager.saveEditChain).toHaveBeenCalledWith(
				expect.objectContaining({
					chainId: chain.chainId,
					status: "completed",
				}),
			)

			// Chain should be removed from active chains
			expect(service.getChain(chain.chainId)).toBeUndefined()
		})

		it("should trigger pattern learning on high success rate", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })
			const steps: EditStep[] = [
				{
					index: 0,
					stepId: "step-1",
					filePath: "src/test.ts",
					startLine: 1,
					endLine: 5,
					originalCode: "old",
					suggestedCode: "new",
					description: "Test",
					editType: "replace",
					status: "accepted",
					confidence: 0.9,
				},
			]

			vi.spyOn(mockProvider, "generateSteps").mockResolvedValue(steps)
			await service.generateSteps(chain.chainId, {
				taskDescription: "Test",
				existingSteps: [],
				fileContents: new Map(),
			})

			await service.completeChain(chain.chainId)

			expect(mockAnalyzer.learnFromChain).toHaveBeenCalled()
		})
	})

	describe("pauseChain / resumeChain / abandonChain", () => {
		it("should pause a chain", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })
			await service.startChain(chain.chainId)

			await service.pauseChain(chain.chainId)

			const updatedChain = service.getChain(chain.chainId)
			expect(updatedChain?.status).toBe("paused")
		})

		it("should resume a paused chain", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })
			await service.startChain(chain.chainId)
			await service.pauseChain(chain.chainId)

			await service.resumeChain(chain.chainId)

			const updatedChain = service.getChain(chain.chainId)
			expect(updatedChain?.status).toBe("active")
		})

		it("should throw error when resuming non-paused chain", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })
			await service.startChain(chain.chainId)

			await expect(service.resumeChain(chain.chainId)).rejects.toThrow("is not paused")
		})

		it("should abandon a chain", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })

			await service.abandonChain(chain.chainId, "User cancelled")

			expect(service.getChain(chain.chainId)).toBeUndefined()
			expect(mockMemoryManager.saveEditChain).toHaveBeenCalledWith(
				expect.objectContaining({
					chainId: chain.chainId,
					status: "abandoned",
				}),
			)
		})
	})

	describe("getChain / getSessionChains", () => {
		it("should get a specific chain", async () => {
			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })

			const retrieved = service.getChain(chain.chainId)

			expect(retrieved).toBeDefined()
			expect(retrieved?.chainId).toBe(chain.chainId)
		})

		it("should return undefined for non-existent chain", () => {
			const retrieved = service.getChain("non-existent")

			expect(retrieved).toBeUndefined()
		})

		it("should get all chains for a session", async () => {
			await service.createEditChain("session-1", { taskDescription: "Task 1" })
			await service.createEditChain("session-1", { taskDescription: "Task 2" })
			await service.createEditChain("session-2", { taskDescription: "Task 3" })

			const session1Chains = service.getSessionChains("session-1")

			expect(session1Chains).toHaveLength(2)
			expect(session1Chains.every((c) => c.sessionId === "session-1")).toBe(true)
		})
	})

	describe("getStats", () => {
		it("should return statistics", async () => {
			vi.spyOn(mockMemoryManager, "getCompletedChains").mockResolvedValue([])

			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })
			const steps: EditStep[] = [
				{
					index: 0,
					stepId: "step-1",
					filePath: "src/test.ts",
					startLine: 1,
					endLine: 5,
					originalCode: "old",
					suggestedCode: "new",
					description: "Test",
					editType: "replace",
					status: "accepted",
					confidence: 0.9,
				},
			]

			vi.spyOn(mockProvider, "generateSteps").mockResolvedValue(steps)
			await service.generateSteps(chain.chainId, {
				taskDescription: "Test",
				existingSteps: [],
				fileContents: new Map(),
			})

			const stats = await service.getStats()

			expect(stats.totalChains).toBeGreaterThan(0)
			expect(stats.activeChains).toBe(1)
			expect(stats.averageSteps).toBeGreaterThanOrEqual(0)
		})
	})

	describe("event listeners", () => {
		it("should add and call event listeners", async () => {
			const listener = vi.fn()
			service.addEventListener(listener)

			await service.createEditChain("session-1", { taskDescription: "Test" })

			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "chain_created",
				}),
			)
		})

		it("should remove event listeners", async () => {
			const listener = vi.fn()
			service.addEventListener(listener)
			service.removeEventListener(listener)

			await service.createEditChain("session-1", { taskDescription: "Test" })

			expect(listener).not.toHaveBeenCalled()
		})

		it("should emit events for chain lifecycle", async () => {
			const events: EditChainEvent[] = []
			const listener = (event: EditChainEvent) => {
				events.push(event)
			}

			service.addEventListener(listener)

			const chain = await service.createEditChain("session-1", { taskDescription: "Test" })
			await service.startChain(chain.chainId)
			await service.pauseChain(chain.chainId)
			await service.resumeChain(chain.chainId)

			expect(events.length).toBeGreaterThan(0)
			expect(events.map((e) => e.type)).toContain("chain_created")
			expect(events.map((e) => e.type)).toContain("chain_started")
			expect(events.map((e) => e.type)).toContain("chain_paused")
			expect(events.map((e) => e.type)).toContain("chain_resumed")
		})

		it("should get event history", async () => {
			await service.createEditChain("session-1", { taskDescription: "Test" })

			const history = service.getEventHistory()

			expect(history.length).toBeGreaterThan(0)
			expect(history[0]).toHaveProperty("type")
			expect(history[0]).toHaveProperty("chainId")
			expect(history[0]).toHaveProperty("timestamp")
		})

		it("should clear event history", async () => {
			await service.createEditChain("session-1", { taskDescription: "Test" })

			service.clearEventHistory()

			const history = service.getEventHistory()
			expect(history).toHaveLength(0)
		})
	})

	describe("config management", () => {
		it("should update config", () => {
			const newConfig = {
				maxConcurrentChains: 5,
			}

			service.updateConfig(newConfig)

			const config = service.getConfig()
			expect(config.maxConcurrentChains).toBe(5)
		})

		it("should get current config", () => {
			const config = service.getConfig()

			expect(config).toHaveProperty("enabled")
			expect(config).toHaveProperty("maxConcurrentChains")
			expect(config).toHaveProperty("validationMode")
			expect(config).toHaveProperty("patternLearning")
		})
	})

	describe("dispose", () => {
		it("should cleanup resources", async () => {
			await service.createEditChain("session-1", { taskDescription: "Test" })

			service.dispose()

			expect(service.getSessionChains("session-1")).toHaveLength(0)
			expect(service.getEventHistory()).toHaveLength(0)
		})
	})
})
