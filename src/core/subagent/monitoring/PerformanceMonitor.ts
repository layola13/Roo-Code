/**
 * PerformanceMonitor - Tracks and analyzes subagent performance
 *
 * Features:
 * - Execution time tracking
 * - Token usage monitoring
 * - Success/failure rates
 * - Cache hit rates
 * - Performance trends
 */

import { SubagentResult, SubagentName } from "../types"

export interface PerformanceMetrics {
	agentName: SubagentName
	totalExecutions: number
	successfulExecutions: number
	failedExecutions: number
	totalTokensUsed: number
	totalExecutionTime: number
	averageExecutionTime: number
	averageTokensPerExecution: number
	cacheHits: number
	cacheHitRate: number
	lastExecutionTime?: number
}

export interface ExecutionRecord {
	agentName: SubagentName
	timestamp: number
	executionTime: number
	tokensUsed: number
	success: boolean
	cached: boolean
	error?: string
}

/**
 * PerformanceMonitor - Monitors subagent performance
 */
export class PerformanceMonitor {
	private records: ExecutionRecord[] = []
	private metrics: Map<SubagentName, PerformanceMetrics> = new Map()
	private readonly maxRecords: number

	constructor(options: { maxRecords?: number } = {}) {
		this.maxRecords = options.maxRecords || 1000
	}

	/**
	 * Record a subagent execution
	 */
	recordExecution(result: SubagentResult): void {
		const record: ExecutionRecord = {
			agentName: result.agentName as SubagentName,
			timestamp: Date.now(),
			executionTime: result.executionTime,
			tokensUsed: result.tokensUsed,
			success: result.success,
			cached: result.cachedResult || false,
			error: result.error,
		}

		this.records.push(record)

		// Trim old records if needed
		if (this.records.length > this.maxRecords) {
			this.records.shift()
		}

		// Update metrics
		this.updateMetrics(record)
	}

	/**
	 * Update metrics for an agent
	 */
	private updateMetrics(record: ExecutionRecord): void {
		const existing = this.metrics.get(record.agentName)

		if (!existing) {
			this.metrics.set(record.agentName, {
				agentName: record.agentName,
				totalExecutions: 1,
				successfulExecutions: record.success ? 1 : 0,
				failedExecutions: record.success ? 0 : 1,
				totalTokensUsed: record.tokensUsed,
				totalExecutionTime: record.executionTime,
				averageExecutionTime: record.executionTime,
				averageTokensPerExecution: record.tokensUsed,
				cacheHits: record.cached ? 1 : 0,
				cacheHitRate: record.cached ? 1 : 0,
				lastExecutionTime: record.timestamp,
			})
		} else {
			const total = existing.totalExecutions + 1
			const cacheHits = existing.cacheHits + (record.cached ? 1 : 0)

			this.metrics.set(record.agentName, {
				...existing,
				totalExecutions: total,
				successfulExecutions: existing.successfulExecutions + (record.success ? 1 : 0),
				failedExecutions: existing.failedExecutions + (record.success ? 0 : 1),
				totalTokensUsed: existing.totalTokensUsed + record.tokensUsed,
				totalExecutionTime: existing.totalExecutionTime + record.executionTime,
				averageExecutionTime: (existing.totalExecutionTime + record.executionTime) / total,
				averageTokensPerExecution: (existing.totalTokensUsed + record.tokensUsed) / total,
				cacheHits,
				cacheHitRate: cacheHits / total,
				lastExecutionTime: record.timestamp,
			})
		}
	}

	/**
	 * Get metrics for a specific agent
	 */
	getMetrics(agentName: SubagentName): PerformanceMetrics | undefined {
		return this.metrics.get(agentName)
	}

	/**
	 * Get metrics for all agents
	 */
	getAllMetrics(): Map<SubagentName, PerformanceMetrics> {
		return new Map(this.metrics)
	}

	/**
	 * Get recent execution records
	 */
	getRecentRecords(count: number = 10): ExecutionRecord[] {
		return this.records.slice(-count)
	}

	/**
	 * Get records for a specific agent
	 */
	getRecordsByAgent(agentName: SubagentName): ExecutionRecord[] {
		return this.records.filter((r) => r.agentName === agentName)
	}

	/**
	 * Get performance trends over time
	 */
	getTrends(
		agentName: SubagentName,
		windowSizeMs: number = 60000, // 1 minute default
	): {
		executionsPerMinute: number
		averageResponseTime: number
		successRate: number
		tokenUsageRate: number
	} {
		const now = Date.now()
		const cutoff = now - windowSizeMs

		const recentRecords = this.records.filter((r) => r.agentName === agentName && r.timestamp >= cutoff)

		if (recentRecords.length === 0) {
			return {
				executionsPerMinute: 0,
				averageResponseTime: 0,
				successRate: 0,
				tokenUsageRate: 0,
			}
		}

		const totalTime = recentRecords.reduce((sum, r) => sum + r.executionTime, 0)
		const totalTokens = recentRecords.reduce((sum, r) => sum + r.tokensUsed, 0)
		const successCount = recentRecords.filter((r) => r.success).length

		return {
			executionsPerMinute: (recentRecords.length / windowSizeMs) * 60000,
			averageResponseTime: totalTime / recentRecords.length,
			successRate: successCount / recentRecords.length,
			tokenUsageRate: (totalTokens / windowSizeMs) * 60000, // tokens per minute
		}
	}

	/**
	 * Get performance summary
	 */
	getSummary(): {
		totalExecutions: number
		totalTokensUsed: number
		averageExecutionTime: number
		overallSuccessRate: number
		mostUsedAgent: SubagentName | null
		slowestAgent: SubagentName | null
	} {
		const allMetrics = Array.from(this.metrics.values())

		if (allMetrics.length === 0) {
			return {
				totalExecutions: 0,
				totalTokensUsed: 0,
				averageExecutionTime: 0,
				overallSuccessRate: 0,
				mostUsedAgent: null,
				slowestAgent: null,
			}
		}

		const totalExecutions = allMetrics.reduce((sum, m) => sum + m.totalExecutions, 0)
		const totalTokens = allMetrics.reduce((sum, m) => sum + m.totalTokensUsed, 0)
		const totalTime = allMetrics.reduce((sum, m) => sum + m.totalExecutionTime, 0)
		const totalSuccesses = allMetrics.reduce((sum, m) => sum + m.successfulExecutions, 0)

		const mostUsed = allMetrics.reduce((max, m) => (m.totalExecutions > max.totalExecutions ? m : max))

		const slowest = allMetrics.reduce((max, m) => (m.averageExecutionTime > max.averageExecutionTime ? m : max))

		return {
			totalExecutions,
			totalTokensUsed: totalTokens,
			averageExecutionTime: totalTime / totalExecutions,
			overallSuccessRate: totalSuccesses / totalExecutions,
			mostUsedAgent: mostUsed.agentName,
			slowestAgent: slowest.agentName,
		}
	}

	/**
	 * Detect performance anomalies
	 */
	detectAnomalies(agentName: SubagentName): {
		slowExecutions: ExecutionRecord[]
		highTokenUsage: ExecutionRecord[]
		recentFailures: ExecutionRecord[]
	} {
		const metrics = this.metrics.get(agentName)
		if (!metrics) {
			return { slowExecutions: [], highTokenUsage: [], recentFailures: [] }
		}

		const records = this.getRecordsByAgent(agentName)
		const avgTime = metrics.averageExecutionTime
		const avgTokens = metrics.averageTokensPerExecution

		// Define thresholds (2x average is considered anomalous)
		const slowThreshold = avgTime * 2
		const tokenThreshold = avgTokens * 2

		return {
			slowExecutions: records.filter((r) => r.executionTime > slowThreshold),
			highTokenUsage: records.filter((r) => r.tokensUsed > tokenThreshold),
			recentFailures: records.filter((r) => !r.success).slice(-5),
		}
	}

	/**
	 * Export metrics to JSON
	 */
	exportMetrics(): string {
		return JSON.stringify(
			{
				metrics: Array.from(this.metrics.entries()),
				summary: this.getSummary(),
				timestamp: Date.now(),
			},
			null,
			2,
		)
	}

	/**
	 * Clear all metrics and records
	 */
	clear(): void {
		this.records = []
		this.metrics.clear()
	}

	/**
	 * Get health status
	 */
	getHealthStatus(): {
		status: "healthy" | "degraded" | "critical"
		issues: string[]
		recommendations: string[]
	} {
		const summary = this.getSummary()
		const issues: string[] = []
		const recommendations: string[] = []

		// Check success rate
		if (summary.overallSuccessRate < 0.8) {
			issues.push(`Low success rate: ${(summary.overallSuccessRate * 100).toFixed(1)}%`)
			recommendations.push("Investigate recent failures and error patterns")
		}

		// Check execution time
		if (summary.averageExecutionTime > 5000) {
			issues.push(`Slow average response time: ${summary.averageExecutionTime}ms`)
			recommendations.push("Consider optimizing prompts or increasing cache TTL")
		}

		// Check cache effectiveness
		for (const [name, metrics] of this.metrics) {
			if (metrics.cacheHitRate < 0.2 && metrics.totalExecutions > 10) {
				issues.push(`Low cache hit rate for ${name}: ${(metrics.cacheHitRate * 100).toFixed(1)}%`)
				recommendations.push(`Review caching strategy for ${name}`)
			}
		}

		let status: "healthy" | "degraded" | "critical" = "healthy"
		if (issues.length > 2) {
			status = "critical"
		} else if (issues.length > 0) {
			status = "degraded"
		}

		return { status, issues, recommendations }
	}
}
