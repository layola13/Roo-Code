/**
 * Tests for RoutingEngine
 */

import { describe, it, expect, beforeEach } from "vitest"
import { RoutingEngine } from "../routing/RoutingEngine"
import { AgentContext } from "../types"

describe("RoutingEngine", () => {
	let engine: RoutingEngine
	let mockContext: AgentContext

	beforeEach(() => {
		engine = new RoutingEngine()
		mockContext = {
			messages: [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi!" },
			],
			systemPrompt: "You are helpful",
		}
	})

	describe("route", () => {
		it("should route summary requests to context analyzer", () => {
			const decision = engine.route("Can you summarize our conversation?", mockContext)
			expect(decision.primaryAgent).toBe("condense-context-analyzer")
			expect(decision.confidence).toBeGreaterThan(0)
		})

		it("should route decision questions to memory extractor", () => {
			const decision = engine.route("What important decisions did we make?", mockContext)
			expect(decision.primaryAgent).toBe("condense-memory-extractor")
		})

		it("should route code questions to code summarizer", () => {
			const decision = engine.route("What code changes did we make?", mockContext)
			expect(decision.primaryAgent).toBe("condense-code-summarizer")
		})

		it("should provide default routing for unclear messages", () => {
			const decision = engine.route("Random text here", mockContext)
			expect(decision.primaryAgent).toBeDefined()
			expect(decision.reasoning).toContain("Default")
		})
	})

	describe("addRule", () => {
		it("should add custom routing rules", () => {
			engine.addRule({
				pattern: /special keyword/i,
				agent: "condense-context-analyzer",
				priority: 10,
			})

			const decision = engine.route("This has special keyword", mockContext)
			expect(decision.primaryAgent).toBe("condense-context-analyzer")
		})

		it("should prioritize high-priority rules", () => {
			engine.addRule({
				pattern: /test/i,
				agent: "condense-memory-extractor",
				priority: 1,
			})
			engine.addRule({
				pattern: /test/i,
				agent: "condense-context-analyzer",
				priority: 10,
			})

			const decision = engine.route("test message", mockContext)
			expect(decision.primaryAgent).toBe("condense-context-analyzer")
		})
	})

	describe("detectCompressionNeeded", () => {
		it("should not require compression for small contexts", () => {
			const result = engine.detectCompressionNeeded(mockContext)
			expect(result.needed).toBe(false)
		})

		it("should detect high message count", () => {
			const largeContext: AgentContext = {
				...mockContext,
				messages: Array(25).fill({ role: "user", content: "test" }),
			}

			const result = engine.detectCompressionNeeded(largeContext)
			expect(result.needed).toBe(true)
			expect(result.reason).toContain("Message count")
		})

		it("should detect high token count", () => {
			const highTokenContext: AgentContext = {
				...mockContext,
				messages: [
					{
						role: "user",
						content: "x".repeat(400000), // ~100k tokens
					},
				],
			}

			const result = engine.detectCompressionNeeded(highTokenContext)
			expect(result.needed).toBe(true)
			expect(result.reason).toContain("Token count")
		})
	})

	describe("suggestWorkflow", () => {
		it("should suggest multiple agents for complex queries", () => {
			const result = engine.suggestWorkflow("Summarize our code changes and important decisions", mockContext)

			expect(result.agents.length).toBeGreaterThan(0)
			expect(result.rationale).toBeDefined()
		})

		it("should return empty for no matches", () => {
			const result = engine.suggestWorkflow("xyz random text", mockContext)
			expect(result.agents).toHaveLength(0)
		})
	})

	describe("getRules", () => {
		it("should return all registered rules", () => {
			const rules = engine.getRules()
			expect(rules.length).toBeGreaterThan(0)
			expect(rules[0]).toHaveProperty("pattern")
			expect(rules[0]).toHaveProperty("agent")
			expect(rules[0]).toHaveProperty("priority")
		})
	})

	describe("clearRules", () => {
		it("should clear all rules", () => {
			engine.clearRules()
			const rules = engine.getRules()
			expect(rules).toHaveLength(0)
		})
	})
})
