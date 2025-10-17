/**
 * Subagent System - Main Entry Point
 *
 * Complete rewrite based on docs/45-subagent.md
 *
 * Architecture:
 * - Layer 1: Agents (ContextAnalyzer, MemoryExtractor, CodeSummarizer)
 * - Layer 2: Execution (SubagentExecutor with caching & retry)
 * - Layer 3: Orchestration (ConversationController with routing & scheduling)
 *
 * Features:
 * - Intelligent routing with pattern matching
 * - Task scheduling with priority queue
 * - Performance monitoring and health checks
 * - Context compression strategies
 * - Cache with TTL (5 minutes default)
 * - Retry logic with exponential backoff
 */

// Core types
export * from "./types"

// Agents
export { ContextAnalyzerAgent } from "./agents/ContextAnalyzerAgent"
export { MemoryExtractorAgent } from "./agents/MemoryExtractorAgent"
export { CodeSummarizerAgent } from "./agents/CodeSummarizerAgent"

// Executor
export { SubagentExecutor } from "./executor/SubagentExecutor"
export type { SubagentInterface } from "./executor/SubagentInterface"

// Context Management
export { ContextManager } from "./context/ContextManager"

// Routing & Scheduling
export { RoutingEngine } from "./routing/RoutingEngine"
export type { RoutingDecision, RoutingRule } from "./routing/RoutingEngine"
export { ExecutionScheduler } from "./routing/ExecutionScheduler"
export type { ScheduledTask, SchedulerOptions } from "./routing/ExecutionScheduler"

// Monitoring
export { PerformanceMonitor } from "./monitoring/PerformanceMonitor"
export type { PerformanceMetrics, ExecutionRecord } from "./monitoring/PerformanceMonitor"

// Main Controller
export { ConversationController } from "./ConversationController"
export type { ControllerOptions } from "./ConversationController"

/**
 * Quick Start Example:
 *
 * ```typescript
 * import { ConversationController } from './core/subagent'
 *
 * const controller = new ConversationController(apiHandler, {
 *   enableCache: true,
 *   enableMetrics: true,
 *   enableAutoCompression: true,
 *   compressionThreshold: 75
 * })
 *
 * // Smart routing
 * const result = await controller.smartRoute(
 *   "Summarize our conversation",
 *   context
 * )
 *
 * // Manual execution
 * const result = await controller.executeSubagent({
 *   agent_name: "condense-context-analyzer",
 *   task: "Analyze conversation flow"
 * }, context)
 *
 * // Get status
 * const status = controller.getStatus()
 * ```
 */
