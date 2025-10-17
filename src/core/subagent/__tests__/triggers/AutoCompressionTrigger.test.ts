/**
 * Tests for AutoCompressionTrigger
 */

import { AutoCompressionTrigger } from "../../triggers/AutoCompressionTrigger"
import { AgentContext } from "../../types"
import { ApiMessage } from "../../../task-persistence/apiMessages"

// Helper to create test messages
function createMessages(count: number): ApiMessage[] {
	const messages: ApiMessage[] = []
	for (let i = 0; i < count; i++) {
		messages.push({
			role: i % 2 === 0 ? "user" : "assistant",
			content: `Test message ${i} with some content to simulate token usage. This message is part of a longer conversation that will help test threshold detection mechanisms.`,
		} as ApiMessage)
	}
	return messages
}

// Helper to create context
function createContext(messageCount: number): AgentContext {
	return {
		messages: createMessages(messageCount),
		conversationMeta: {
			conversationId: "test-conversation-123",
			userId: "test-user",
		},
	}
}

describe("AutoCompressionTrigger", () => {
	describe("Message Count Threshold", () => {
		it("should not trigger below message threshold", async () => {
			const trigger = new AutoCompressionTrigger({ messageCount: 20 })
			const context = createContext(15)

			const task = await trigger.checkAndTrigger(context)
			expect(task).toBeNull()
		})

		it("should trigger at message threshold", async () => {
			const trigger = new AutoCompressionTrigger({ messageCount: 20 })
			const context = createContext(20)

			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
			expect(task?.priority).toBe("medium")
			expect(task?.trigger).toContain("Message count")
		})

		it("should trigger above message threshold", async () => {
			const trigger = new AutoCompressionTrigger({ messageCount: 20 })
			const context = createContext(30)

			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
			expect(task?.priority).toBe("medium")
		})

		it("should reset after compression", async () => {
			const trigger = new AutoCompressionTrigger({ messageCount: 20 })

			// First trigger
			let context = createContext(20)
			let task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()

			// Mark as completed
			trigger.markCompressionCompleted(20)

			// Should not trigger again with same count
			context = createContext(20)
			task = await trigger.checkAndTrigger(context)
			expect(task).toBeNull()

			// Should trigger with additional messages
			context = createContext(40)
			task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
		})
	})

	describe("Token Count Threshold", () => {
		it("should trigger on high token count", async () => {
			const trigger = new AutoCompressionTrigger({ tokenCount: 1000 })
			// Create enough messages to exceed token threshold
			const context = createContext(50)

			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
			expect(task?.priority).toBe("high")
			expect(task?.trigger).toContain("Token count")
		})

		it("should not trigger below token threshold", async () => {
			const trigger = new AutoCompressionTrigger({
				tokenCount: 100000,
				messageCount: 1000,
			})
			const context = createContext(10)

			const task = await trigger.checkAndTrigger(context)
			expect(task).toBeNull()
		})
	})

	describe("Time Elapsed Threshold", () => {
		it("should not trigger before time threshold", async () => {
			const trigger = new AutoCompressionTrigger({
				timeSinceLastCompression: 60000, // 1 minute
				messageCount: 1000, // High threshold to avoid message count trigger
			})
			const context = createContext(15)

			const task = await trigger.checkAndTrigger(context)
			expect(task).toBeNull()
		})

		it("should trigger after time threshold with enough messages", async () => {
			const trigger = new AutoCompressionTrigger({
				timeSinceLastCompression: 0, // Immediate
				messageCount: 1000,
			})
			const context = createContext(15)

			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
			expect(task?.priority).toBe("low")
			expect(task?.trigger).toContain("Time elapsed")
		})

		it("should not trigger with insufficient messages", async () => {
			const trigger = new AutoCompressionTrigger({
				timeSinceLastCompression: 0,
				messageCount: 1000,
			})
			const context = createContext(5) // Less than 10 messages

			const task = await trigger.checkAndTrigger(context)
			expect(task).toBeNull()
		})
	})

	describe("Context Usage Threshold", () => {
		it("should trigger on high context usage", async () => {
			const trigger = new AutoCompressionTrigger({
				contextUsagePercentage: 0.1, // 0.1% threshold - very low
				messageCount: 1000, // High to avoid message count trigger
				tokenCount: 1000000, // Very high to avoid token count trigger
			})
			// Create many messages to get enough tokens
			const context = createContext(100)

			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
			expect(task?.priority).toBe("high")
		})
	})

	describe("Priority Selection", () => {
		it("should select highest priority trigger", async () => {
			const trigger = new AutoCompressionTrigger({
				messageCount: 10,
				tokenCount: 500,
				timeSinceLastCompression: 0,
				contextUsagePercentage: 1,
			})
			const context = createContext(20)

			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
			// Token count and context usage are high priority
			expect(task?.priority).toBe("high")
		})
	})

	describe("Strategy Selection", () => {
		it("should use full compression for high priority", async () => {
			const trigger = new AutoCompressionTrigger({ tokenCount: 500 })
			const context = createContext(20)

			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
			expect(task?.priority).toBe("high")
			expect(task?.strategy.steps.length).toBeGreaterThanOrEqual(2)
			expect(task?.strategy.steps.some((s) => s.agent === "condense-context-analyzer")).toBe(true)
			expect(task?.strategy.steps.some((s) => s.agent === "condense-memory-extractor")).toBe(true)
		})

		it("should use quick compression for medium priority", async () => {
			const trigger = new AutoCompressionTrigger({ messageCount: 10 })
			const context = createContext(15)

			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
			expect(task?.priority).toBe("medium")
			expect(task?.strategy.steps.length).toBe(1)
			expect(task?.strategy.steps[0].agent).toBe("condense-memory-extractor")
		})

		it("should use minimal compression for low priority", async () => {
			const trigger = new AutoCompressionTrigger({
				timeSinceLastCompression: 0,
				messageCount: 1000,
			})
			const context = createContext(15)

			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
			expect(task?.priority).toBe("low")
			expect(task?.strategy.steps.length).toBe(1)
			expect(task?.strategy.steps[0].agent).toBe("condense-context-analyzer")
			expect(task?.strategy.steps[0].options?.depth).toBe("quick")
		})
	})

	describe("Message Range Determination", () => {
		it("should preserve recent messages for high priority", async () => {
			const trigger = new AutoCompressionTrigger({ tokenCount: 500 })
			const context = createContext(20)

			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
			// Should compress all but last 5
			expect(task?.messageRange[1]).toBe(15)
		})

		it("should preserve more messages for medium priority", async () => {
			const trigger = new AutoCompressionTrigger({ messageCount: 10 })
			const context = createContext(20)

			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
			// Should compress all but last 10
			expect(task?.messageRange[1]).toBe(10)
		})

		it("should preserve most messages for low priority", async () => {
			const trigger = new AutoCompressionTrigger({
				timeSinceLastCompression: 0,
				messageCount: 1000,
			})
			const context = createContext(20)

			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
			// Should compress all but last 15
			expect(task?.messageRange[1]).toBe(5)
		})
	})

	describe("Configuration Management", () => {
		it("should allow threshold updates", () => {
			const trigger = new AutoCompressionTrigger({ messageCount: 20 })

			trigger.updateThresholds({ messageCount: 30 })
			const thresholds = trigger.getThresholds()

			expect(thresholds.messageCount).toBe(30)
		})

		it("should preserve other thresholds on partial update", () => {
			const trigger = new AutoCompressionTrigger({
				messageCount: 20,
				tokenCount: 90000,
			})

			trigger.updateThresholds({ messageCount: 30 })
			const thresholds = trigger.getThresholds()

			expect(thresholds.messageCount).toBe(30)
			expect(thresholds.tokenCount).toBe(90000)
		})

		it("should track time since last compression", async () => {
			const trigger = new AutoCompressionTrigger()

			expect(trigger.getTimeSinceLastCompression()).toBeGreaterThanOrEqual(0)

			// Simulate compression
			await new Promise((resolve) => setTimeout(resolve, 10))
			trigger.markCompressionCompleted(10)

			expect(trigger.getTimeSinceLastCompression()).toBeGreaterThanOrEqual(0)
			expect(trigger.getTimeSinceLastCompression()).toBeLessThan(100)
		})

		it("should reset state correctly", async () => {
			const trigger = new AutoCompressionTrigger({ messageCount: 10 })
			const context = createContext(15)

			// Trigger once
			await trigger.checkAndTrigger(context)
			trigger.markCompressionCompleted(15)

			// Reset
			trigger.reset()

			// Should trigger again immediately
			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
		})
	})

	describe("Task Generation", () => {
		it("should generate unique task IDs", async () => {
			const trigger = new AutoCompressionTrigger({ messageCount: 10 })
			const context = createContext(15)

			const task1 = await trigger.checkAndTrigger(context)
			trigger.reset()
			const task2 = await trigger.checkAndTrigger(context)

			expect(task1?.id).not.toBe(task2?.id)
		})

		it("should include conversation metadata", async () => {
			const trigger = new AutoCompressionTrigger({ messageCount: 10 })
			const context = createContext(15)

			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
			expect(task?.conversationId).toBe("test-conversation-123")
		})

		it("should include timestamp", async () => {
			const trigger = new AutoCompressionTrigger({ messageCount: 10 })
			const context = createContext(15)

			const now = Date.now()
			const task = await trigger.checkAndTrigger(context)

			expect(task).not.toBeNull()
			expect(task?.createdAt).toBeGreaterThanOrEqual(now)
			expect(task?.createdAt).toBeLessThanOrEqual(Date.now())
		})
	})

	describe("Edge Cases", () => {
		it("should handle empty message array", async () => {
			const trigger = new AutoCompressionTrigger()
			const context = createContext(0)

			const task = await trigger.checkAndTrigger(context)
			expect(task).toBeNull()
		})

		it("should handle missing conversation metadata", async () => {
			const trigger = new AutoCompressionTrigger({ messageCount: 10 })
			const context: AgentContext = {
				messages: createMessages(15),
			}

			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
			expect(task?.conversationId).toBe("unknown")
		})

		it("should handle very large message counts", async () => {
			const trigger = new AutoCompressionTrigger({ messageCount: 10 })
			const context = createContext(1000)

			const task = await trigger.checkAndTrigger(context)
			expect(task).not.toBeNull()
			expect(task?.messageRange[1]).toBeGreaterThan(0)
		})
	})
})
