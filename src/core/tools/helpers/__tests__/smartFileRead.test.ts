import { describe, it, expect, beforeEach, vi } from "vitest"
import {
	estimateFileTokens,
	checkContextAvailability,
	isSupportedByAstParser,
	decideFileReadStrategy,
	decideBatchReadStrategy,
} from "../smartFileRead"
import type { Task } from "../../../task/Task"
import { getApiMetrics } from "../../../../shared/getApiMetrics"
import { getModelMaxOutputTokens } from "../../../../shared/api"

// Mock dependencies
vi.mock("../../../../shared/getApiMetrics")
vi.mock("../../../../shared/api")

describe("smartFileRead", () => {
	describe("estimateFileTokens", () => {
		it("should estimate tokens for code files with higher density", () => {
			const tsFileSize = 3000 // 3KB
			const tokens = estimateFileTokens("test.ts", tsFileSize)

			// Code files: 3 chars/token
			// Lines: 3000/50 = 60 lines
			// Line overhead: 60 * 5 = 300 chars
			// Total: (3000 + 300) / 3 = 1100 tokens
			expect(tokens).toBe(1100)
		})

		it("should estimate tokens for text files with lower density", () => {
			const txtFileSize = 4000 // 4KB
			const tokens = estimateFileTokens("test.txt", txtFileSize)

			// Text files: 4 chars/token
			// Lines: 4000/50 = 80 lines
			// Line overhead: 80 * 5 = 400 chars
			// Total: (4000 + 400) / 4 = 1100 tokens
			expect(tokens).toBe(1100)
		})

		it("should handle small files correctly", () => {
			const smallFileSize = 100
			const tokens = estimateFileTokens("small.js", smallFileSize)

			// Should still calculate correctly for small files
			expect(tokens).toBeGreaterThan(0)
			expect(tokens).toBeLessThan(100)
		})
	})

	describe("isSupportedByAstParser", () => {
		it("should return true for supported code extensions", () => {
			expect(isSupportedByAstParser("test.ts")).toBe(true)
			expect(isSupportedByAstParser("test.js")).toBe(true)
			expect(isSupportedByAstParser("test.py")).toBe(true)
			expect(isSupportedByAstParser("test.rs")).toBe(true)
			expect(isSupportedByAstParser("test.go")).toBe(true)
		})

		it("should return false for unsupported extensions", () => {
			expect(isSupportedByAstParser("test.txt")).toBe(false)
			expect(isSupportedByAstParser("test.md")).toBe(false)
			expect(isSupportedByAstParser("test.pdf")).toBe(false)
		})

		it("should be case-insensitive", () => {
			expect(isSupportedByAstParser("test.TS")).toBe(true)
			expect(isSupportedByAstParser("test.JS")).toBe(true)
		})
	})

	describe("checkContextAvailability", () => {
		let mockTask: Partial<Task>

		beforeEach(() => {
			// Mock Task object
			mockTask = {
				clineMessages: [],
				api: {
					getModel: () => ({
						id: "claude-3-5-sonnet-20241022",
						info: {
							contextWindow: 200000,
							maxTokens: 8192,
							supportsImages: true,
							supportsPromptCache: true,
						},
					}),
				},
				apiConfiguration: {
					apiProvider: "anthropic",
				},
			} as any

			// Mock getApiMetrics to return current token usage
			vi.mocked(getApiMetrics).mockReturnValue({
				totalTokensIn: 50000,
				totalTokensOut: 20000,
				totalCacheWrites: 0,
				totalCacheReads: 0,
				totalCost: 0.5,
				contextTokens: 70000, // 50k in + 20k out
				subAgentTokenUsage: [],
			})

			// Mock getModelMaxOutputTokens
			vi.mocked(getModelMaxOutputTokens).mockReturnValue(8192)
		})

		it("should correctly calculate available context space", async () => {
			const estimatedTokens = 10000
			const result = await checkContextAvailability(mockTask as Task, estimatedTokens)

			// contextWindow: 200000
			// currentTokens: 70000
			// reservedTokens: 8192
			// availableTokens: 200000 - 70000 - 8192 = 121808
			expect(result.contextWindow).toBe(200000)
			expect(result.currentTokens).toBe(70000)
			expect(result.reservedTokens).toBe(8192)
			expect(result.availableTokens).toBe(121808)
			expect(result.contextUsagePercent).toBeCloseTo(35, 0) // 70000/200000 * 100 = 35%
		})

		it("should determine if there is enough space with safety factor", async () => {
			const estimatedTokens = 10000
			const safetyFactor = 1.2
			const result = await checkContextAvailability(mockTask as Task, estimatedTokens, safetyFactor)

			// Required: 10000 * 1.2 = 12000 tokens
			// Available: 121808 tokens
			// Should have enough space
			expect(result.hasEnoughSpace).toBe(true)
		})

		it("should detect insufficient space", async () => {
			const estimatedTokens = 150000 // Very large file
			const result = await checkContextAvailability(mockTask as Task, estimatedTokens)

			// Required: 150000 * 1.2 = 180000 tokens
			// Available: 121808 tokens
			// Should NOT have enough space
			expect(result.hasEnoughSpace).toBe(false)
		})

		it("should handle high context usage scenarios", async () => {
			// Mock high usage scenario
			vi.mocked(getApiMetrics).mockReturnValue({
				totalTokensIn: 150000,
				totalTokensOut: 30000,
				totalCacheWrites: 0,
				totalCacheReads: 0,
				totalCost: 1.5,
				contextTokens: 180000, // 90% usage
				subAgentTokenUsage: [],
			})

			const estimatedTokens = 5000
			const result = await checkContextAvailability(mockTask as Task, estimatedTokens)

			expect(result.contextUsagePercent).toBeCloseTo(90, 0)
			expect(result.availableTokens).toBe(11808) // 200000 - 180000 - 8192
			expect(result.hasEnoughSpace).toBe(true) // 11808 > 5000 * 1.2 = 6000
		})
	})

	describe("decideFileReadStrategy", () => {
		let mockTask: Partial<Task>

		beforeEach(() => {
			mockTask = {
				clineMessages: [],
				api: {
					getModel: () => ({
						id: "claude-3-5-sonnet-20241022",
						info: {
							contextWindow: 200000,
							maxTokens: 8192,
							supportsImages: true,
							supportsPromptCache: true,
						},
					}),
				},
				apiConfiguration: {
					apiProvider: "anthropic",
				},
			} as any

			// Default: moderate usage (35%)
			vi.mocked(getApiMetrics).mockReturnValue({
				totalTokensIn: 50000,
				totalTokensOut: 20000,
				totalCacheWrites: 0,
				totalCacheReads: 0,
				totalCost: 0.5,
				contextTokens: 70000,
				subAgentTokenUsage: [],
			})

			vi.mocked(getModelMaxOutputTokens).mockReturnValue(8192)
		})

		it("should use full read when smart read is disabled", async () => {
			const decision = await decideFileReadStrategy(
				mockTask as Task,
				"test.ts",
				50000, // 50KB file
				false, // disabled
			)

			expect(decision.mode).toBe("full")
			expect(decision.reason).toContain("disabled")
		})

		it("should use full read when sufficient space and low usage", async () => {
			const decision = await decideFileReadStrategy(
				mockTask as Task,
				"test.ts",
				10000, // 10KB file (~3300 tokens)
				true,
				75, // threshold 75%
			)

			// Current usage: 35%, threshold: 75%, has enough space
			expect(decision.mode).toBe("full")
			expect(decision.reason).toContain("Sufficient context space")
		})

		it("should use AST summary when space limited and file supported", async () => {
			// Mock high usage scenario
			vi.mocked(getApiMetrics).mockReturnValue({
				totalTokensIn: 140000,
				totalTokensOut: 40000,
				totalCacheWrites: 0,
				totalCacheReads: 0,
				totalCost: 1.5,
				contextTokens: 180000, // 90% usage
				subAgentTokenUsage: [],
			})

			const decision = await decideFileReadStrategy(
				mockTask as Task,
				"test.ts", // Supported by AST
				50000, // Large file
				true,
				75, // threshold
			)

			expect(decision.mode).toBe("ast_summary")
			expect(decision.reason).toContain("Limited context space")
			expect(decision.reason).toContain("AST summary")
		})

		it("should use line preview when AST not supported", async () => {
			// Mock high usage
			vi.mocked(getApiMetrics).mockReturnValue({
				totalTokensIn: 140000,
				totalTokensOut: 40000,
				totalCacheWrites: 0,
				totalCacheReads: 0,
				totalCost: 1.5,
				contextTokens: 180000,
				subAgentTokenUsage: [],
			})

			const decision = await decideFileReadStrategy(
				mockTask as Task,
				"test.txt", // NOT supported by AST
				50000,
				true,
				75,
			)

			expect(decision.mode).toBe("line_preview")
			expect(decision.reason).toContain("not supported by AST")
		})
	})

	describe("decideBatchReadStrategy", () => {
		let mockTask: Partial<Task>

		beforeEach(() => {
			mockTask = {
				clineMessages: [],
				api: {
					getModel: () => ({
						id: "claude-3-5-sonnet-20241022",
						info: {
							contextWindow: 200000,
							maxTokens: 8192,
							supportsImages: true,
							supportsPromptCache: true,
						},
					}),
				},
				apiConfiguration: {
					apiProvider: "anthropic",
				},
			} as any

			vi.mocked(getApiMetrics).mockReturnValue({
				totalTokensIn: 50000,
				totalTokensOut: 20000,
				totalCacheWrites: 0,
				totalCacheReads: 0,
				totalCost: 0.5,
				contextTokens: 70000,
				subAgentTokenUsage: [],
			})

			vi.mocked(getModelMaxOutputTokens).mockReturnValue(8192)
		})

		it("should prioritize small files for full read", async () => {
			const files = [
				{ path: "large.ts", size: 100000 }, // ~33k tokens
				{ path: "small.ts", size: 5000 }, // ~1.6k tokens
				{ path: "medium.ts", size: 30000 }, // ~10k tokens
			]

			const decisions = await decideBatchReadStrategy(mockTask as Task, files, true)

			// Small file should get full read
			expect(decisions.get("small.ts")?.mode).toBe("full")
		})

		it("should disable smart read for all files when disabled", async () => {
			const files = [
				{ path: "file1.ts", size: 10000 },
				{ path: "file2.ts", size: 20000 },
			]

			const decisions = await decideBatchReadStrategy(mockTask as Task, files, false)

			expect(decisions.get("file1.ts")?.mode).toBe("full")
			expect(decisions.get("file2.ts")?.mode).toBe("full")
		})

		it("should use AST summary for large files when space limited", async () => {
			// High usage scenario
			vi.mocked(getApiMetrics).mockReturnValue({
				totalTokensIn: 150000,
				totalTokensOut: 40000,
				totalCacheWrites: 0,
				totalCacheReads: 0,
				totalCost: 1.5,
				contextTokens: 190000, // 95% usage
				subAgentTokenUsage: [],
			})

			const files = [
				{ path: "file1.ts", size: 50000 },
				{ path: "file2.ts", size: 60000 },
			]

			const decisions = await decideBatchReadStrategy(mockTask as Task, files, true)

			// Both should use AST summary due to limited space
			expect(decisions.get("file1.ts")?.mode).toBe("ast_summary")
			expect(decisions.get("file2.ts")?.mode).toBe("ast_summary")
		})
	})
})
