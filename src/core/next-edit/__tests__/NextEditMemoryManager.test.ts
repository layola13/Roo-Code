/**
 * NextEditMemoryManager GSW集成测试
 * 测试编辑链和模式的GSW存储与检索
 */

import { NextEditMemoryManager } from "../NextEditMemoryManager"
import { DirectoryMemorySystem } from "../../../memory/gsw/DirectoryMemorySystem"
import { EditChain, EditPattern, EditStep, ParallelSessionMemory } from "../../../memory/gsw/types/next-edit"
import { PatternMatchResult } from "../types"

describe("NextEditMemoryManager", () => {
	let memoryManager: NextEditMemoryManager
	let mockGswSystem: DirectoryMemorySystem

	beforeEach(() => {
		// Mock DirectoryMemorySystem
		mockGswSystem = {
			writeMemory: vi.fn().mockResolvedValue("memory-id"),
			readMemory: vi.fn().mockResolvedValue(null),
			queryMemory: vi.fn().mockResolvedValue({ memories: [], totalFound: 0 }),
		} as any

		memoryManager = new NextEditMemoryManager(mockGswSystem)
	})

	describe("saveEditChain", () => {
		it("should save edit chain to GSW", async () => {
			const chain: EditChain = {
				chainId: "chain-123",
				sessionId: "session-1",
				taskDescription: "Add authentication",
				taskIntent: "Implement user login",
				steps: [
					{
						index: 0,
						stepId: "step-1",
						filePath: "src/auth.ts",
						startLine: 1,
						endLine: 10,
						originalCode: "old code",
						suggestedCode: "new code",
						description: "Add login function",
						editType: "insert",
						status: "accepted",
						confidence: 0.9,
					},
				],
				currentIndex: 0,
				affectedFiles: ["src/auth.ts"],
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:10:00Z",
				status: "completed",
				executionMode: "sequential",
			}

			await memoryManager.saveEditChain(chain)

			expect(mockGswSystem.writeMemory).toHaveBeenCalledWith(
				"reasoning",
				expect.objectContaining({
					version: "1.0",
					entry_id: "chain-123",
					session_id: "session-1",
					edit_chain: chain,
					task_intent: "Implement user login",
				}),
			)
		})

		it("should extract keywords from chain", async () => {
			const chain: EditChain = {
				chainId: "chain-123",
				sessionId: "session-1",
				taskDescription: "Add user authentication with JWT tokens",
				taskIntent: "Implement secure authentication",
				steps: [],
				currentIndex: -1,
				affectedFiles: ["src/auth/login.ts", "src/middleware/auth.ts"],
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:00:00Z",
				status: "planning",
				executionMode: "sequential",
			}

			await memoryManager.saveEditChain(chain)

			expect(mockGswSystem.writeMemory).toHaveBeenCalledWith(
				"reasoning",
				expect.objectContaining({
					keywords: expect.arrayContaining([expect.any(String)]),
				}),
			)
		})

		it("should extract pattern tags based on task description", async () => {
			const chain: EditChain = {
				chainId: "chain-123",
				sessionId: "session-1",
				taskDescription: "Fix bug in authentication module",
				taskIntent: "Fix auth bug",
				steps: [
					{
						index: 0,
						stepId: "step-1",
						filePath: "src/auth.ts",
						startLine: 1,
						endLine: 5,
						originalCode: "buggy code",
						suggestedCode: "fixed code",
						description: "Fix auth bug",
						editType: "replace",
						status: "accepted",
						confidence: 0.9,
					},
				],
				currentIndex: 0,
				affectedFiles: ["src/auth.ts"],
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:00:00Z",
				status: "completed",
				executionMode: "sequential",
			}

			await memoryManager.saveEditChain(chain)

			expect(mockGswSystem.writeMemory).toHaveBeenCalledWith(
				"reasoning",
				expect.objectContaining({
					pattern_tags: expect.arrayContaining(["fix-bug"]),
				}),
			)
		})

		it("should calculate success statistics", async () => {
			const chain: EditChain = {
				chainId: "chain-123",
				sessionId: "session-1",
				taskDescription: "Test task",
				taskIntent: "Test",
				steps: [
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
						originalCode: "old",
						suggestedCode: "new",
						description: "Test",
						editType: "replace",
						status: "modified",
						confidence: 0.8,
					},
					{
						index: 2,
						stepId: "step-3",
						filePath: "src/test.ts",
						startLine: 11,
						endLine: 15,
						originalCode: "old",
						suggestedCode: "new",
						description: "Test",
						editType: "replace",
						status: "rejected",
						confidence: 0.7,
					},
				],
				currentIndex: 2,
				affectedFiles: ["src/test.ts"],
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:00:00Z",
				status: "completed",
				executionMode: "sequential",
			}

			await memoryManager.saveEditChain(chain)

			expect(mockGswSystem.writeMemory).toHaveBeenCalledWith(
				"reasoning",
				expect.objectContaining({
					success_stats: {
						totalSteps: 3,
						acceptedSteps: 1,
						modifiedSteps: 1,
						rejectedSteps: 1,
					},
				}),
			)
		})
	})

	describe("loadEditChain", () => {
		it("should load edit chain from GSW", async () => {
			const mockChain: EditChain = {
				chainId: "chain-123",
				sessionId: "session-1",
				taskDescription: "Test",
				taskIntent: "Test",
				steps: [],
				currentIndex: -1,
				affectedFiles: [],
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:00:00Z",
				status: "completed",
				executionMode: "sequential",
			}

			vi.spyOn(mockGswSystem, "readMemory").mockResolvedValue({
				version: "1.0",
				entry_id: "chain-123",
				timestamp: "2024-01-01T00:00:00Z",
				session_id: "session-1",
				edit_chain: mockChain,
				task_intent: "Test",
				keywords: [],
				related_files: [],
				related_session: "session-1",
				source_file: "test.ts",
				reasoning: "Test",
				pattern_tags: [],
				success_stats: {
					totalSteps: 0,
					acceptedSteps: 0,
					modifiedSteps: 0,
					rejectedSteps: 0,
				},
			} as any)

			const chain = await memoryManager.loadEditChain("chain-123")

			expect(chain).toEqual(mockChain)
			expect(mockGswSystem.readMemory).toHaveBeenCalledWith("reasoning", "chain-123")
		})

		it("should return null for non-existent chain", async () => {
			vi.spyOn(mockGswSystem, "readMemory").mockResolvedValue(null)

			const chain = await memoryManager.loadEditChain("non-existent")

			expect(chain).toBeNull()
		})
	})

	describe("searchSimilarChains", () => {
		it("should search similar chains using vector search", async () => {
			const mockChain1: EditChain = {
				chainId: "chain-1",
				sessionId: "session-1",
				taskDescription: "Add authentication",
				taskIntent: "Add auth",
				steps: [],
				currentIndex: -1,
				affectedFiles: [],
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:00:00Z",
				status: "completed",
				executionMode: "sequential",
			}

			const mockChain2: EditChain = {
				chainId: "chain-2",
				sessionId: "session-2",
				taskDescription: "Implement login",
				taskIntent: "Add login",
				steps: [],
				currentIndex: -1,
				affectedFiles: [],
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:00:00Z",
				status: "completed",
				executionMode: "sequential",
			}

			vi.spyOn(mockGswSystem, "queryMemory").mockResolvedValue({
				memories: [
					{
						type: "reasoning",
						id: "chain-1",
						timestamp: "2024-01-01T00:00:00Z",
						summary: "Add authentication",
						content: {
							version: "1.0",
							entry_id: "chain-1",
							timestamp: "2024-01-01T00:00:00Z",
							session_id: "session-1",
							edit_chain: mockChain1,
							task_intent: "Add auth",
							keywords: [],
							related_files: [],
							related_session: "session-1",
							source_file: "auth.ts",
							reasoning: "Add auth",
							pattern_tags: [],
							success_stats: {
								totalSteps: 0,
								acceptedSteps: 0,
								modifiedSteps: 0,
								rejectedSteps: 0,
							},
						} as any,
					},
					{
						type: "reasoning",
						id: "chain-2",
						timestamp: "2024-01-01T00:00:00Z",
						summary: "Implement login",
						content: {
							version: "1.0",
							entry_id: "chain-2",
							timestamp: "2024-01-01T00:00:00Z",
							session_id: "session-2",
							edit_chain: mockChain2,
							task_intent: "Add login",
							keywords: [],
							related_files: [],
							related_session: "session-2",
							source_file: "login.ts",
							reasoning: "Add login",
							pattern_tags: [],
							success_stats: {
								totalSteps: 0,
								acceptedSteps: 0,
								modifiedSteps: 0,
								rejectedSteps: 0,
							},
						} as any,
					},
				],
				totalFound: 2,
			})

			const chains = await memoryManager.searchSimilarChains("authentication", 5)

			expect(chains).toHaveLength(2)
			expect(chains[0]).toEqual(mockChain1)
			expect(chains[1]).toEqual(mockChain2)
			expect(mockGswSystem.queryMemory).toHaveBeenCalledWith({
				query: "authentication",
				types: ["reasoning"],
				limit: 5,
				useVectorSearch: true,
			})
		})
	})

	describe("getCompletedChains", () => {
		it("should get completed chains for a session", async () => {
			const completedChain: EditChain = {
				chainId: "chain-1",
				sessionId: "session-1",
				taskDescription: "Test",
				taskIntent: "Test",
				steps: [],
				currentIndex: -1,
				affectedFiles: [],
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:00:00Z",
				completedAt: "2024-01-01T00:10:00Z",
				status: "completed",
				executionMode: "sequential",
			}

			vi.spyOn(mockGswSystem, "queryMemory").mockResolvedValue({
				memories: [
					{
						type: "reasoning",
						id: "chain-1",
						timestamp: "2024-01-01T00:00:00Z",
						summary: "Test",
						content: {
							version: "1.0",
							entry_id: "chain-1",
							timestamp: "2024-01-01T00:00:00Z",
							session_id: "session-1",
							edit_chain: completedChain,
							task_intent: "Test",
							keywords: [],
							related_files: [],
							related_session: "session-1",
							source_file: "test.ts",
							reasoning: "Test",
							pattern_tags: [],
							success_stats: {
								totalSteps: 0,
								acceptedSteps: 0,
								modifiedSteps: 0,
								rejectedSteps: 0,
							},
						} as any,
					},
				],
				totalFound: 1,
			})

			const chains = await memoryManager.getCompletedChains("session-1", 20)

			expect(chains).toHaveLength(1)
			expect(chains[0].status).toBe("completed")
			expect(chains[0].sessionId).toBe("session-1")
		})

		it("should filter out non-completed chains", async () => {
			const activeChain: EditChain = {
				chainId: "chain-1",
				sessionId: "session-1",
				taskDescription: "Test",
				taskIntent: "Test",
				steps: [],
				currentIndex: -1,
				affectedFiles: [],
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:00:00Z",
				status: "active",
				executionMode: "sequential",
			}

			vi.spyOn(mockGswSystem, "queryMemory").mockResolvedValue({
				memories: [
					{
						type: "reasoning",
						id: "chain-1",
						timestamp: "2024-01-01T00:00:00Z",
						summary: "Test",
						content: {
							version: "1.0",
							entry_id: "chain-1",
							timestamp: "2024-01-01T00:00:00Z",
							session_id: "session-1",
							edit_chain: activeChain,
							task_intent: "Test",
							keywords: [],
							related_files: [],
							related_session: "session-1",
							source_file: "test.ts",
							reasoning: "Test",
							pattern_tags: [],
							success_stats: {
								totalSteps: 0,
								acceptedSteps: 0,
								modifiedSteps: 0,
								rejectedSteps: 0,
							},
						} as any,
					},
				],
				totalFound: 1,
			})

			const chains = await memoryManager.getCompletedChains("session-1")

			expect(chains).toHaveLength(0)
		})
	})

	describe("savePattern / loadPattern", () => {
		it("should save edit pattern to GSW", async () => {
			const pattern: EditPattern = {
				patternId: "pattern-123",
				taskPatterns: ["add.*authentication", "implement.*login"],
				filePatterns: ["**/auth/*.ts", "**/*Service.ts"],
				stepTemplates: [
					{
						editType: "insert",
						descriptionTemplate: "Add {Name} function",
						codeTransform: "expand",
					},
				],
				usageCount: 5,
				successRate: 0.85,
				lastUsedAt: "2024-01-01T00:00:00Z",
			}

			await memoryManager.savePattern(pattern)

			expect(mockGswSystem.writeMemory).toHaveBeenCalledWith(
				"evolution",
				expect.objectContaining({
					version: "1.0",
					evolution_id: "pattern-123",
					change_type: "pattern_learning" as any,
					pattern_data: pattern,
				}),
			)
		})

		it("should load pattern from GSW", async () => {
			const mockPattern: EditPattern = {
				patternId: "pattern-123",
				taskPatterns: ["test"],
				filePatterns: ["*.ts"],
				stepTemplates: [],
				usageCount: 1,
				successRate: 0.9,
				lastUsedAt: "2024-01-01T00:00:00Z",
			}

			vi.spyOn(mockGswSystem, "readMemory").mockResolvedValue({
				version: "1.0",
				evolution_id: "pattern-123",
				timestamp: "2024-01-01T00:00:00Z",
				file_path: "pattern",
				change_type: "pattern_learning",
				diff_summary: "Test pattern",
				benefits: [],
				risks: [],
				mode: "code",
				pattern_data: mockPattern,
			} as any)

			const pattern = await memoryManager.loadPattern("pattern-123")

			expect(pattern).toEqual(mockPattern)
		})

		it("should cache loaded patterns", async () => {
			const mockPattern: EditPattern = {
				patternId: "pattern-123",
				taskPatterns: ["test"],
				filePatterns: ["*.ts"],
				stepTemplates: [],
				usageCount: 1,
				successRate: 0.9,
				lastUsedAt: "2024-01-01T00:00:00Z",
			}

			vi.spyOn(mockGswSystem, "readMemory").mockResolvedValue({
				version: "1.0",
				evolution_id: "pattern-123",
				timestamp: "2024-01-01T00:00:00Z",
				file_path: "pattern",
				change_type: "pattern_learning",
				diff_summary: "Test pattern",
				benefits: [],
				risks: [],
				mode: "code",
				pattern_data: mockPattern,
			} as any)

			// First load
			await memoryManager.loadPattern("pattern-123")
			// Second load (should use cache)
			const pattern = await memoryManager.loadPattern("pattern-123")

			expect(pattern).toEqual(mockPattern)
			// Should only call readMemory once
			expect(mockGswSystem.readMemory).toHaveBeenCalledTimes(1)
		})
	})

	describe("searchPatterns", () => {
		it("should search and score matching patterns", async () => {
			const mockPattern: EditPattern = {
				patternId: "pattern-1",
				taskPatterns: ["add.*authentication"],
				filePatterns: ["**/auth/*.ts"],
				stepTemplates: [],
				usageCount: 5,
				successRate: 0.9,
				lastUsedAt: "2024-01-01T00:00:00Z",
			}

			vi.spyOn(mockGswSystem, "queryMemory").mockResolvedValue({
				memories: [
					{
						type: "evolution",
						id: "pattern-1",
						timestamp: "2024-01-01T00:00:00Z",
						summary: "Pattern",
						content: {
							version: "1.0",
							evolution_id: "pattern-1",
							timestamp: "2024-01-01T00:00:00Z",
							file_path: "pattern",
							change_type: "pattern_learning",
							diff_summary: "Pattern",
							benefits: [],
							risks: [],
							mode: "code",
							pattern_data: mockPattern,
						} as any,
					},
				],
				totalFound: 1,
			})

			const matches = await memoryManager.searchPatterns("add authentication feature", ["src/auth/login.ts"])

			expect(matches.length).toBeGreaterThan(0)
			expect(matches[0].pattern).toEqual(mockPattern)
			expect(matches[0].score).toBeGreaterThan(0)
		})

		it("should filter out patterns with low scores", async () => {
			const mockPattern: EditPattern = {
				patternId: "pattern-1",
				taskPatterns: ["add.*database"],
				filePatterns: ["**/db/*.ts"],
				stepTemplates: [],
				usageCount: 5,
				successRate: 0.9,
				lastUsedAt: "2024-01-01T00:00:00Z",
			}

			vi.spyOn(mockGswSystem, "queryMemory").mockResolvedValue({
				memories: [
					{
						type: "evolution",
						id: "pattern-1",
						timestamp: "2024-01-01T00:00:00Z",
						summary: "Pattern",
						content: {
							version: "1.0",
							evolution_id: "pattern-1",
							timestamp: "2024-01-01T00:00:00Z",
							file_path: "pattern",
							change_type: "pattern_learning",
							diff_summary: "Pattern",
							benefits: [],
							risks: [],
							mode: "code",
							pattern_data: mockPattern,
						} as any,
					},
				],
				totalFound: 1,
			})

			// Search for unrelated task
			const matches = await memoryManager.searchPatterns("add authentication feature", ["src/auth/login.ts"])

			// Should filter out pattern with low score (< 0.5)
			expect(matches).toHaveLength(0)
		})

		it("should sort patterns by score", async () => {
			const pattern1: EditPattern = {
				patternId: "pattern-1",
				taskPatterns: ["add.*authentication"],
				filePatterns: ["**/auth/*.ts"],
				stepTemplates: [],
				usageCount: 5,
				successRate: 0.9,
				lastUsedAt: "2024-01-01T00:00:00Z",
			}

			const pattern2: EditPattern = {
				patternId: "pattern-2",
				taskPatterns: ["implement.*login"],
				filePatterns: ["**/auth/*.ts"],
				stepTemplates: [],
				usageCount: 3,
				successRate: 0.7,
				lastUsedAt: "2024-01-01T00:00:00Z",
			}

			vi.spyOn(mockGswSystem, "queryMemory").mockResolvedValue({
				memories: [
					{
						type: "evolution",
						id: "pattern-1",
						timestamp: "2024-01-01T00:00:00Z",
						summary: "Pattern 1",
						content: {
							version: "1.0",
							evolution_id: "pattern-1",
							timestamp: "2024-01-01T00:00:00Z",
							file_path: "pattern",
							change_type: "pattern_learning",
							diff_summary: "Pattern 1",
							benefits: [],
							risks: [],
							mode: "code",
							pattern_data: pattern1,
						} as any,
					},
					{
						type: "evolution",
						id: "pattern-2",
						timestamp: "2024-01-01T00:00:00Z",
						summary: "Pattern 2",
						content: {
							version: "1.0",
							evolution_id: "pattern-2",
							timestamp: "2024-01-01T00:00:00Z",
							file_path: "pattern",
							change_type: "pattern_learning",
							diff_summary: "Pattern 2",
							benefits: [],
							risks: [],
							mode: "code",
							pattern_data: pattern2,
						} as any,
					},
				],
				totalFound: 2,
			})

			const matches = await memoryManager.searchPatterns("add authentication", ["src/auth/login.ts"])

			// Should be sorted by score (descending)
			expect(matches.length).toBeGreaterThan(0)
			if (matches.length > 1) {
				expect(matches[0].score).toBeGreaterThanOrEqual(matches[1].score)
			}
		})
	})

	describe("saveParallelSession / loadParallelSession", () => {
		it("should save parallel session memory", async () => {
			const session: ParallelSessionMemory = {
				version: "1.0",
				entry_id: "parallel-session-123",
				timestamp: "2024-01-01T00:00:00Z",
				session_id: "session-1",
				parallel_session_id: "parallel-123",
				task_description: "Parallel editing task",
				edit_chain_ids: ["chain-1", "chain-2", "chain-3"],
				slot_count: 3,
				completed_count: 2,
				failed_count: 1,
				total_execution_time: 120000,
				created_at: "2024-01-01T00:00:00Z",
				completed_at: "2024-01-01T00:02:00Z",
			}

			await memoryManager.saveParallelSession(session)

			expect(mockGswSystem.writeMemory).toHaveBeenCalledWith("reasoning", session)
		})

		it("should load parallel session memory", async () => {
			const mockSession: ParallelSessionMemory = {
				version: "1.0",
				entry_id: "parallel-session-123",
				timestamp: "2024-01-01T00:00:00Z",
				session_id: "session-1",
				parallel_session_id: "parallel-123",
				task_description: "Test",
				edit_chain_ids: ["chain-1"],
				slot_count: 1,
				completed_count: 1,
				failed_count: 0,
				total_execution_time: 60000,
				created_at: "2024-01-01T00:00:00Z",
				completed_at: "2024-01-01T00:01:00Z",
			}

			vi.spyOn(mockGswSystem, "readMemory").mockResolvedValue(mockSession as any)

			const session = await memoryManager.loadParallelSession("parallel-session-123")

			expect(session).toEqual(mockSession)
		})
	})

	describe("clearPatternCache", () => {
		it("should clear pattern cache", async () => {
			const mockPattern: EditPattern = {
				patternId: "pattern-123",
				taskPatterns: ["test"],
				filePatterns: ["*.ts"],
				stepTemplates: [],
				usageCount: 1,
				successRate: 0.9,
				lastUsedAt: "2024-01-01T00:00:00Z",
			}

			vi.spyOn(mockGswSystem, "readMemory").mockResolvedValue({
				version: "1.0",
				evolution_id: "pattern-123",
				timestamp: "2024-01-01T00:00:00Z",
				file_path: "pattern",
				change_type: "pattern_learning",
				diff_summary: "Test pattern",
				benefits: [],
				risks: [],
				mode: "code",
				pattern_data: mockPattern,
			} as any)

			// Load pattern (will be cached)
			await memoryManager.loadPattern("pattern-123")

			// Clear cache
			memoryManager.clearPatternCache()

			// Load again (should call readMemory again)
			await memoryManager.loadPattern("pattern-123")

			// Should call readMemory twice now
			expect(mockGswSystem.readMemory).toHaveBeenCalledTimes(2)
		})
	})

	describe("getStats", () => {
		it("should return statistics about chains and patterns", async () => {
			vi.spyOn(mockGswSystem, "queryMemory")
				.mockResolvedValueOnce({
					// First call for chains
					memories: [
						{
							type: "reasoning",
							id: "chain-1",
							timestamp: "2024-01-01T00:00:00Z",
							summary: "Chain 1",
							content: {
								version: "1.0",
								entry_id: "chain-1",
								timestamp: "2024-01-01T00:00:00Z",
								session_id: "session-1",
								edit_chain: {
									chainId: "chain-1",
									sessionId: "session-1",
									taskDescription: "Test",
									taskIntent: "Test",
									steps: [],
									currentIndex: -1,
									affectedFiles: [],
									createdAt: "2024-01-01T00:00:00Z",
									updatedAt: "2024-01-01T00:00:00Z",
									status: "completed",
									executionMode: "sequential",
								},
								task_intent: "Test",
								keywords: [],
								related_files: [],
								related_session: "session-1",
								source_file: "test.ts",
								reasoning: "Test",
								pattern_tags: [],
								success_stats: {
									totalSteps: 0,
									acceptedSteps: 0,
									modifiedSteps: 0,
									rejectedSteps: 0,
								},
							} as any,
						},
					],
					totalFound: 1,
				})
				.mockResolvedValueOnce({
					// Second call for patterns
					memories: [
						{
							type: "evolution",
							id: "pattern-1",
							timestamp: "2024-01-01T00:00:00Z",
							summary: "Pattern 1",
							content: {
								version: "1.0",
								evolution_id: "pattern-1",
								timestamp: "2024-01-01T00:00:00Z",
								file_path: "pattern",
								change_type: "pattern_learning",
								diff_summary: "Pattern",
								benefits: [],
								risks: [],
								mode: "code",
								pattern_data: {
									patternId: "pattern-1",
									taskPatterns: [],
									filePatterns: [],
									stepTemplates: [],
									usageCount: 1,
									successRate: 0.9,
									lastUsedAt: "2024-01-01T00:00:00Z",
								},
							} as any,
						},
					],
					totalFound: 1,
				})

			const stats = await memoryManager.getStats()

			expect(stats.totalChains).toBe(1)
			expect(stats.completedChains).toBe(1)
			expect(stats.totalPatterns).toBe(1)
			expect(stats.cacheSize).toBeGreaterThanOrEqual(0)
		})
	})
})
