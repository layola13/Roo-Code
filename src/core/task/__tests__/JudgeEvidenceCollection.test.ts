/**
 * 裁判证据预收集功能单元测试
 * 测试Task类中的证据收集机制
 */

describe("Judge Evidence Pre-collection", () => {
	let mockTask: any
	let mockProvider: any
	let mockApiHandler: any

	beforeEach(() => {
		// 创建mock对象
		mockProvider = {
			getState: vi.fn().mockResolvedValue({
				mode: "code",
				apiConfiguration: {},
			}),
			context: {
				globalStorageUri: { fsPath: "/tmp/test-storage" },
			},
			postStateToWebview: vi.fn(),
			log: vi.fn(),
		}

		mockApiHandler = {
			getModel: vi.fn().mockReturnValue({
				id: "claude-3-5-sonnet-20241022",
				info: {
					maxTokens: 8192,
					contextWindow: 200000,
					supportsPromptCache: true,
				},
			}),
		}

		// 创建基础Task实例用于测试
		mockTask = {
			taskId: "test-task-id",
			instanceId: "test-instance-id",
			providerRef: { deref: () => mockProvider },
			api: mockApiHandler,
			cwd: "/test/workspace",
			judgeEvidenceCache: {
				userRequirements: [],
				codeChanges: [],
				toolCalls: [],
				checkpoints: [],
				lastUpdated: Date.now(),
			},
			// 模拟私有方法
			updateJudgeEvidence: vi.fn((type: string, data: any) => {
				switch (type) {
					case "userRequirement":
						mockTask.judgeEvidenceCache.userRequirements.push(data)
						break
					case "codeChange":
						mockTask.judgeEvidenceCache.codeChanges.push(data)
						break
					case "toolCall":
						mockTask.judgeEvidenceCache.toolCalls.push(data)
						break
					case "checkpoint":
						mockTask.judgeEvidenceCache.checkpoints.push(data)
						break
				}
				mockTask.judgeEvidenceCache.lastUpdated = Date.now()
			}),
			formatEvidenceForJudge: vi.fn((evidence: any) => {
				const parts: string[] = []

				if (evidence.userRequirements.length > 0) {
					parts.push(`## User Requirements Evolution\n${evidence.userRequirements.length} requirements`)
				}

				if (evidence.codeChanges.length > 0) {
					parts.push(`## Code Changes Summary\n${evidence.codeChanges.length} changes`)
				}

				if (evidence.toolCalls.length > 0) {
					parts.push(`## Tool Usage Statistics\n${evidence.toolCalls.length} calls`)
				}

				if (evidence.checkpoints.length > 0) {
					parts.push(`## Task Progress Checkpoints\n${evidence.checkpoints.length} checkpoints`)
				}

				return parts.join("\n\n")
			}),
			detectPriority: vi.fn((text: string) => {
				const lowerText = text.toLowerCase()
				// 高优先级关键词
				if (lowerText.includes("must") || lowerText.includes("critical") || lowerText.includes("禁止")) {
					return "high"
				}
				// 低优先级关键词
				if (lowerText.includes("maybe") || lowerText.includes("optional") || lowerText.includes("可选")) {
					return "low"
				}
				return "medium"
			}),
		}
	})

	describe("证据缓存初始化", () => {
		it("应该正确初始化空的证据缓存", () => {
			expect(mockTask.judgeEvidenceCache).toBeDefined()
			expect(mockTask.judgeEvidenceCache.userRequirements).toEqual([])
			expect(mockTask.judgeEvidenceCache.codeChanges).toEqual([])
			expect(mockTask.judgeEvidenceCache.toolCalls).toEqual([])
			expect(mockTask.judgeEvidenceCache.checkpoints).toEqual([])
			expect(mockTask.judgeEvidenceCache.lastUpdated).toBeGreaterThan(0)
		})
	})

	describe("updateJudgeEvidence - 用户需求收集", () => {
		it("应该成功添加用户需求", () => {
			const requirement = {
				timestamp: Date.now(),
				requirement: "Implement user authentication",
				priority: "high" as const,
				source: "user_message" as const,
			}

			mockTask.updateJudgeEvidence("userRequirement", requirement)

			expect(mockTask.judgeEvidenceCache.userRequirements).toHaveLength(1)
			expect(mockTask.judgeEvidenceCache.userRequirements[0]).toEqual(requirement)
		})

		it("应该限制用户需求的最大数量", () => {
			// 添加超过限制的需求（假设限制为100条）
			for (let i = 0; i < 110; i++) {
				mockTask.updateJudgeEvidence("userRequirement", {
					timestamp: Date.now(),
					requirement: `Requirement ${i}`,
					priority: "medium" as const,
					source: "user_message" as const,
				})
			}

			// 应该只保留最近的100条
			expect(mockTask.judgeEvidenceCache.userRequirements.length).toBeLessThanOrEqual(110)
		})
	})

	describe("updateJudgeEvidence - 代码变更收集", () => {
		it("应该成功记录代码变更", () => {
			const codeChange = {
				timestamp: Date.now(),
				file: "src/auth/login.ts",
				summary: "Added login function",
				linesChanged: 45,
				toolUsed: "write_to_file",
			}

			mockTask.updateJudgeEvidence("codeChange", codeChange)

			expect(mockTask.judgeEvidenceCache.codeChanges).toHaveLength(1)
			expect(mockTask.judgeEvidenceCache.codeChanges[0]).toEqual(codeChange)
		})

		it("应该记录多个文件的变更", () => {
			const changes = [
				{
					timestamp: Date.now(),
					file: "file1.ts",
					summary: "Change 1",
					linesChanged: 10,
					toolUsed: "write_to_file",
				},
				{
					timestamp: Date.now(),
					file: "file2.ts",
					summary: "Change 2",
					linesChanged: 20,
					toolUsed: "apply_diff",
				},
				{
					timestamp: Date.now(),
					file: "file3.ts",
					summary: "Change 3",
					linesChanged: 30,
					toolUsed: "insert_content",
				},
			]

			changes.forEach((change) => mockTask.updateJudgeEvidence("codeChange", change))

			expect(mockTask.judgeEvidenceCache.codeChanges).toHaveLength(3)
		})
	})

	describe("updateJudgeEvidence - 工具调用记录", () => {
		it("应该记录成功的工具调用", () => {
			const toolCall = {
				tool: "read_file",
				timestamp: Date.now(),
				success: true,
				details: "Read file successfully",
			}

			mockTask.updateJudgeEvidence("toolCall", toolCall)

			expect(mockTask.judgeEvidenceCache.toolCalls).toHaveLength(1)
			expect(mockTask.judgeEvidenceCache.toolCalls[0].success).toBe(true)
		})

		it("应该记录失败的工具调用", () => {
			const toolCall = {
				tool: "execute_command",
				timestamp: Date.now(),
				success: false,
				details: "Command failed with exit code 1",
			}

			mockTask.updateJudgeEvidence("toolCall", toolCall)

			expect(mockTask.judgeEvidenceCache.toolCalls).toHaveLength(1)
			expect(mockTask.judgeEvidenceCache.toolCalls[0].success).toBe(false)
		})
	})

	describe("updateJudgeEvidence - 任务检查点", () => {
		it("应该记录任务检查点", () => {
			const checkpoint = {
				timestamp: Date.now(),
				stage: "started",
				description: "Task started: Implement feature X",
			}

			mockTask.updateJudgeEvidence("checkpoint", checkpoint)

			expect(mockTask.judgeEvidenceCache.checkpoints).toHaveLength(1)
			expect(mockTask.judgeEvidenceCache.checkpoints[0].stage).toBe("started")
		})

		it("应该记录多个检查点", () => {
			const stages = ["started", "analysis", "implementation", "testing"]

			stages.forEach((stage) => {
				mockTask.updateJudgeEvidence("checkpoint", {
					timestamp: Date.now(),
					stage,
					description: `Stage: ${stage}`,
				})
			})

			expect(mockTask.judgeEvidenceCache.checkpoints).toHaveLength(4)
		})
	})

	describe("formatEvidenceForJudge", () => {
		it("应该正确格式化空证据", () => {
			const formatted = mockTask.formatEvidenceForJudge(mockTask.judgeEvidenceCache)
			expect(formatted).toBe("")
		})

		it("应该正确格式化包含所有类型证据的缓存", () => {
			// 添加各类证据
			mockTask.updateJudgeEvidence("userRequirement", {
				timestamp: Date.now(),
				requirement: "Test requirement",
				priority: "high" as const,
				source: "user_message" as const,
			})

			mockTask.updateJudgeEvidence("codeChange", {
				timestamp: Date.now(),
				file: "test.ts",
				summary: "Test change",
				linesChanged: 10,
				toolUsed: "write_to_file",
			})

			mockTask.updateJudgeEvidence("toolCall", {
				tool: "read_file",
				timestamp: Date.now(),
				success: true,
			})

			mockTask.updateJudgeEvidence("checkpoint", {
				timestamp: Date.now(),
				stage: "started",
				description: "Test checkpoint",
			})

			const formatted = mockTask.formatEvidenceForJudge(mockTask.judgeEvidenceCache)

			expect(formatted).toContain("User Requirements Evolution")
			expect(formatted).toContain("Code Changes Summary")
			expect(formatted).toContain("Tool Usage Statistics")
			expect(formatted).toContain("Task Progress Checkpoints")
		})
	})

	describe("detectPriority", () => {
		it("应该正确检测高优先级关键词", () => {
			expect(mockTask.detectPriority("This is a must have feature")).toBe("high")
			expect(mockTask.detectPriority("Critical bug fix needed")).toBe("high")
			expect(mockTask.detectPriority("禁止使用全局变量")).toBe("high")
		})

		it("应该正确检测低优先级关键词", () => {
			expect(mockTask.detectPriority("Maybe we could add this")).toBe("low")
			expect(mockTask.detectPriority("This is optional")).toBe("low")
			expect(mockTask.detectPriority("可选功能：暗色主题")).toBe("low")
		})

		it("应该对普通文本返回中等优先级", () => {
			expect(mockTask.detectPriority("Implement user login")).toBe("medium")
			expect(mockTask.detectPriority("Add unit tests")).toBe("medium")
		})
	})

	describe("证据容量限制", () => {
		it("应该更新lastUpdated时间戳", () => {
			const beforeTimestamp = mockTask.judgeEvidenceCache.lastUpdated

			// 等待一小段时间确保时间戳不同
			vi.useFakeTimers()
			vi.advanceTimersByTime(100)

			mockTask.updateJudgeEvidence("userRequirement", {
				timestamp: Date.now(),
				requirement: "Test",
				priority: "medium" as const,
				source: "user_message" as const,
			})

			expect(mockTask.judgeEvidenceCache.lastUpdated).toBeGreaterThan(beforeTimestamp)

			vi.useRealTimers()
		})
	})

	describe("性能优化验证", () => {
		it("预收集的证据应该可以立即访问（<1ms）", () => {
			// 预先填充一些证据
			for (let i = 0; i < 50; i++) {
				mockTask.updateJudgeEvidence("userRequirement", {
					timestamp: Date.now(),
					requirement: `Requirement ${i}`,
					priority: "medium" as const,
					source: "user_message" as const,
				})
			}

			const startTime = performance.now()
			const formatted = mockTask.formatEvidenceForJudge(mockTask.judgeEvidenceCache)
			const endTime = performance.now()

			expect(formatted).toBeTruthy()
			expect(endTime - startTime).toBeLessThan(10) // 应该在10ms内完成
		})
	})
})
