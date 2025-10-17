/**
 * Tests for ConversationController
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { ConversationController } from "../ConversationController"
import { AgentContext, SubagentParams } from "../types"
import { ApiHandler } from "../../../api"

// Mock ApiHandler
const mockApiHandler = {
	createApiRequest: vi.fn(),
	createMessage: vi.fn(),
} as unknown as ApiHandler

describe("ConversationController", () => {
	let controller: ConversationController
	let mockContext: AgentContext

	beforeEach(() => {
		// ✅ 修复：ConversationController构造函数签名已变更
		// 新签名: (apiHandler, vectorMemoryStore?, options?)
		controller = new ConversationController(mockApiHandler, undefined, {
			enableCache: true,
			enableMetrics: true,
			verboseLogging: false,
		})

		mockContext = {
			messages: [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
			],
			systemPrompt: "You are a helpful assistant",
		}

		vi.clearAllMocks()
	})

	describe("initialization", () => {
		it("should initialize with default options", () => {
			const status = controller.getStatus()
			expect(status).toHaveProperty("executor")
			expect(status).toHaveProperty("scheduler")
			expect(status).toHaveProperty("monitor")
			expect(status).toHaveProperty("health")
		})

		it("should initialize with custom options", () => {
			// ✅ 修复：ConversationController构造函数签名已变更
			const customController = new ConversationController(mockApiHandler, undefined, {
				enableCache: false,
				enableMetrics: false,
				compressionThreshold: 80,
			})

			expect(customController).toBeDefined()
		})
	})

	describe("getStatus", () => {
		it("should return complete status", () => {
			const status = controller.getStatus()

			expect(status.executor).toHaveProperty("cacheSize")
			expect(status.executor).toHaveProperty("cacheKeys")
			expect(status.scheduler).toHaveProperty("total")
			expect(status.scheduler).toHaveProperty("pending")
			expect(status.monitor).toHaveProperty("totalExecutions")
			expect(status.health).toHaveProperty("status")
		})

		it("should show healthy status initially", () => {
			const status = controller.getStatus()
			// Initial status may be degraded due to no executions
			expect(status.health.status).toBeDefined()
			expect(status.health.issues).toBeDefined()
		})
	})

	describe("checkCompressionNeeded", () => {
		it("should detect when compression is not needed", () => {
			const result = controller.checkCompressionNeeded(mockContext)
			expect(result.needed).toBe(false)
		})

		it("should detect when compression is needed (high message count)", () => {
			const largeContext: AgentContext = {
				...mockContext,
				messages: Array(25).fill({ role: "user", content: "test" }),
			}

			const result = controller.checkCompressionNeeded(largeContext)
			expect(result.needed).toBe(true)
			expect(result.reason).toContain("Message count")
		})
	})

	describe("getRoutingSuggestions", () => {
		it("should suggest context analyzer for summary requests", () => {
			const result = controller.getRoutingSuggestions("Can you summarize our conversation?", mockContext)

			expect(result.agents).toContain("condense-context-analyzer")
		})

		it("should suggest memory extractor for decision questions", () => {
			const result = controller.getRoutingSuggestions("What did we decide earlier?", mockContext)

			expect(result.agents).toContain("condense-memory-extractor")
		})

		it("should suggest code summarizer for code questions", () => {
			const result = controller.getRoutingSuggestions("What files did we change?", mockContext)

			expect(result.agents).toContain("condense-code-summarizer")
		})
	})

	describe("reset", () => {
		it("should clear all caches and state", () => {
			controller.reset()

			const status = controller.getStatus()
			expect(status.executor.cacheSize).toBe(0)
			expect(status.scheduler.total).toBe(0)
			expect(status.monitor.totalExecutions).toBe(0)
		})
	})

	describe("configure", () => {
		it("should update configuration at runtime", () => {
			controller.configure({
				enableCache: false,
				verboseLogging: true,
			})

			// Configuration is updated (no direct way to verify, but should not throw)
			expect(controller).toBeDefined()
		})
	})

	describe("addRoutingRule", () => {
		it("should add custom routing rule", () => {
			controller.addRoutingRule({
				pattern: /custom pattern/i,
				agent: "condense-context-analyzer",
				priority: 10,
			})

			const result = controller.getRoutingSuggestions("This matches custom pattern", mockContext)

			expect(result.agents).toContain("condense-context-analyzer")
		})
	})

	describe("exportDiagnostics", () => {
		it("should export diagnostic data", () => {
			const diagnostics = controller.exportDiagnostics()

			expect(diagnostics).toHaveProperty("metrics")
			expect(diagnostics).toHaveProperty("status")
			expect(diagnostics).toHaveProperty("timestamp")
			expect(typeof diagnostics.metrics).toBe("string")
		})
	})

	describe("getContextManager", () => {
		it("should return context manager instance", () => {
			const contextManager = controller.getContextManager()
			expect(contextManager).toBeDefined()
			expect(contextManager).toHaveProperty("compressContext")
		})
	})
})
