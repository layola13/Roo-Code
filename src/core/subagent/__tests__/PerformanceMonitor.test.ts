/**
 * Tests for PerformanceMonitor
 */

import { describe, it, expect, beforeEach } from "vitest"
import { PerformanceMonitor } from "../monitoring/PerformanceMonitor"
import { SubagentResult } from "../types"

describe("PerformanceMonitor", () => {
	let monitor: PerformanceMonitor

	beforeEach(() => {
		monitor = new PerformanceMonitor({ maxRecords: 100 })
	})

	describe("recordExecution", () => {
		it("should record successful execution", () => {
			const result: SubagentResult = {
				agentName: "condense-context-analyzer",
				output: "Test output",
				tokensUsed: 100,
				executionTime: 1000,
				success: true,
			}

			monitor.recordExecution(result)

			const metrics = monitor.getMetrics("condense-context-analyzer")
			expect(metrics).toBeDefined()
			expect(metrics?.totalExecutions).toBe(1)
			expect(metrics?.successfulExecutions).toBe(1)
			expect(metrics?.totalTokensUsed).toBe(100)
		})

		it("should record failed execution", () => {
			const result: SubagentResult = {
				agentName: "condense-memory-extractor",
				output: "",
				tokensUsed: 0,
				executionTime: 500,
				success: false,
				error: "Test error",
			}

			monitor.recordExecution(result)

			const metrics = monitor.getMetrics("condense-memory-extractor")
			expect(metrics?.failedExecutions).toBe(1)
			expect(metrics?.successfulExecutions).toBe(0)
		})

		it("should track cached results", () => {
			const result: SubagentResult = {
				agentName: "condense-code-summarizer",
				output: "Cached output",
				tokensUsed: 50,
				executionTime: 10,
				success: true,
				cachedResult: true,
			}

			monitor.recordExecution(result)

			const metrics = monitor.getMetrics("condense-code-summarizer")
			expect(metrics?.cacheHits).toBe(1)
			expect(metrics?.cacheHitRate).toBe(1)
		})
	})

	describe("getMetrics", () => {
		it("should return undefined for unknown agent", () => {
			const metrics = monitor.getMetrics("condense-context-analyzer")
			expect(metrics).toBeUndefined()
		})

		it("should calculate averages correctly", () => {
			const agent = "condense-context-analyzer"

			// Record multiple executions
			for (let i = 0; i < 5; i++) {
				monitor.recordExecution({
					agentName: agent,
					output: "Test",
					tokensUsed: 100,
					executionTime: 1000,
					success: true,
				})
			}

			const metrics = monitor.getMetrics(agent)
			expect(metrics?.totalExecutions).toBe(5)
			expect(metrics?.averageTokensPerExecution).toBe(100)
			expect(metrics?.averageExecutionTime).toBe(1000)
		})
	})

	describe("getAllMetrics", () => {
		it("should return metrics for all agents", () => {
			monitor.recordExecution({
				agentName: "condense-context-analyzer",
				output: "Test",
				tokensUsed: 100,
				executionTime: 1000,
				success: true,
			})

			monitor.recordExecution({
				agentName: "condense-memory-extractor",
				output: "Test",
				tokensUsed: 200,
				executionTime: 2000,
				success: true,
			})

			const allMetrics = monitor.getAllMetrics()
			expect(allMetrics.size).toBe(2)
		})
	})

	describe("getRecentRecords", () => {
		it("should return most recent records", () => {
			for (let i = 0; i < 15; i++) {
				monitor.recordExecution({
					agentName: "condense-context-analyzer",
					output: `Test ${i}`,
					tokensUsed: 100,
					executionTime: 1000,
					success: true,
				})
			}

			const recent = monitor.getRecentRecords(10)
			expect(recent).toHaveLength(10)
		})
	})

	describe("getRecordsByAgent", () => {
		it("should filter records by agent name", () => {
			monitor.recordExecution({
				agentName: "condense-context-analyzer",
				output: "Test",
				tokensUsed: 100,
				executionTime: 1000,
				success: true,
			})

			monitor.recordExecution({
				agentName: "condense-memory-extractor",
				output: "Test",
				tokensUsed: 200,
				executionTime: 2000,
				success: true,
			})

			const records = monitor.getRecordsByAgent("condense-context-analyzer")
			expect(records).toHaveLength(1)
			expect(records[0].agentName).toBe("condense-context-analyzer")
		})
	})

	describe("getTrends", () => {
		it("should calculate performance trends", () => {
			const agent = "condense-context-analyzer"

			// Record several executions
			for (let i = 0; i < 5; i++) {
				monitor.recordExecution({
					agentName: agent,
					output: "Test",
					tokensUsed: 100,
					executionTime: 1000,
					success: i < 4, // 4 successes, 1 failure
				})
			}

			const trends = monitor.getTrends(agent, 60000)
			expect(trends.successRate).toBe(0.8) // 4/5
			expect(trends.averageResponseTime).toBe(1000)
		})
	})

	describe("getSummary", () => {
		it("should return overall summary", () => {
			monitor.recordExecution({
				agentName: "condense-context-analyzer",
				output: "Test",
				tokensUsed: 100,
				executionTime: 1000,
				success: true,
			})

			monitor.recordExecution({
				agentName: "condense-memory-extractor",
				output: "Test",
				tokensUsed: 200,
				executionTime: 2000,
				success: true,
			})

			const summary = monitor.getSummary()
			expect(summary.totalExecutions).toBe(2)
			expect(summary.totalTokensUsed).toBe(300)
			expect(summary.overallSuccessRate).toBe(1)
			expect(summary.mostUsedAgent).toBeDefined()
		})
	})

	describe("detectAnomalies", () => {
		it("should detect slow executions", () => {
			const agent = "condense-context-analyzer"

			// Normal executions
			for (let i = 0; i < 5; i++) {
				monitor.recordExecution({
					agentName: agent,
					output: "Test",
					tokensUsed: 100,
					executionTime: 1000,
					success: true,
				})
			}

			// Slow execution
			monitor.recordExecution({
				agentName: agent,
				output: "Test",
				tokensUsed: 100,
				executionTime: 5000,
				success: true,
			})

			const anomalies = monitor.detectAnomalies(agent)
			expect(anomalies.slowExecutions.length).toBeGreaterThan(0)
		})

		it("should detect high token usage", () => {
			const agent = "condense-memory-extractor"

			// Normal executions
			for (let i = 0; i < 5; i++) {
				monitor.recordExecution({
					agentName: agent,
					output: "Test",
					tokensUsed: 100,
					executionTime: 1000,
					success: true,
				})
			}

			// High token usage
			monitor.recordExecution({
				agentName: agent,
				output: "Test",
				tokensUsed: 1000,
				executionTime: 1000,
				success: true,
			})

			const anomalies = monitor.detectAnomalies(agent)
			expect(anomalies.highTokenUsage.length).toBeGreaterThan(0)
		})
	})

	describe("getHealthStatus", () => {
		it("should report healthy status", () => {
			// Record successful executions
			for (let i = 0; i < 10; i++) {
				monitor.recordExecution({
					agentName: "condense-context-analyzer",
					output: "Test",
					tokensUsed: 100,
					executionTime: 1000,
					success: true,
				})
			}

			const health = monitor.getHealthStatus()
			expect(health.status).toBe("healthy")
			expect(health.issues).toHaveLength(0)
		})

		it("should report degraded status for low success rate", () => {
			const agent = "condense-context-analyzer"

			// Mostly failures
			for (let i = 0; i < 10; i++) {
				monitor.recordExecution({
					agentName: agent,
					output: "",
					tokensUsed: 0,
					executionTime: 1000,
					success: i < 2, // Only 2 successes
				})
			}

			const health = monitor.getHealthStatus()
			expect(health.status).not.toBe("healthy")
			expect(health.issues.length).toBeGreaterThan(0)
		})
	})

	describe("exportMetrics", () => {
		it("should export metrics as JSON", () => {
			monitor.recordExecution({
				agentName: "condense-context-analyzer",
				output: "Test",
				tokensUsed: 100,
				executionTime: 1000,
				success: true,
			})

			const exported = monitor.exportMetrics()
			expect(typeof exported).toBe("string")

			const parsed = JSON.parse(exported)
			expect(parsed).toHaveProperty("metrics")
			expect(parsed).toHaveProperty("summary")
			expect(parsed).toHaveProperty("timestamp")
		})
	})

	describe("clear", () => {
		it("should clear all records and metrics", () => {
			monitor.recordExecution({
				agentName: "condense-context-analyzer",
				output: "Test",
				tokensUsed: 100,
				executionTime: 1000,
				success: true,
			})

			monitor.clear()

			const metrics = monitor.getMetrics("condense-context-analyzer")
			expect(metrics).toBeUndefined()

			const summary = monitor.getSummary()
			expect(summary.totalExecutions).toBe(0)
		})
	})
})
