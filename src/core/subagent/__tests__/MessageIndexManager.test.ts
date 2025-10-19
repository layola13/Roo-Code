/**
 * Unit tests for MessageIndexManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { MessageIndexManager } from "../MessageIndexManager"
import * as fs from "fs"
import * as path from "path"

describe("MessageIndexManager", () => {
	let manager: MessageIndexManager
	const testStoragePath = "./.roo/test-message-index"

	beforeEach(() => {
		manager = new MessageIndexManager({
			storagePath: testStoragePath,
			enablePersistence: false, // Disable persistence for tests
		})
	})

	afterEach(() => {
		manager.reset()
		// Clean up test storage
		if (fs.existsSync(testStoragePath)) {
			fs.rmSync(testStoragePath, { recursive: true, force: true })
		}
	})

	describe("storeMessages", () => {
		it("should assign unique indices to messages", () => {
			const messages = [
				{ role: "user" as const, content: "Hello" },
				{ role: "assistant" as const, content: "Hi there" },
				{ role: "user" as const, content: "How are you?" },
			]

			const result = manager.storeMessages(messages, "conv-1")

			expect(result).toHaveLength(3)
			expect(result[0].messageIndex).toBe(1)
			expect(result[1].messageIndex).toBe(2)
			expect(result[2].messageIndex).toBe(3)
		})

		it("should continue index sequence across multiple calls", () => {
			const batch1 = [{ role: "user" as const, content: "First" }]
			const batch2 = [{ role: "user" as const, content: "Second" }]

			const result1 = manager.storeMessages(batch1, "conv-1")
			const result2 = manager.storeMessages(batch2, "conv-1")

			expect(result1[0].messageIndex).toBe(1)
			expect(result2[0].messageIndex).toBe(2)
		})

		it("should estimate tokens correctly", () => {
			const messages = [{ role: "user" as const, content: "This is a test message with some words" }]

			const result = manager.storeMessages(messages, "conv-1")

			expect(result[0].tokens).toBeGreaterThan(0)
			// Roughly 4 chars per token (using Math.ceil, so expect exact match)
			const expectedTokens = Math.ceil(messages[0].content.length / 4)
			expect(result[0].tokens).toBe(expectedTokens)
		})

		it("should handle different message formats", () => {
			const messages = [
				{ role: "user" as const, content: "String content" },
				{
					role: "assistant" as const,
					content: [{ type: "text" as const, text: "Block content" }],
				},
			]

			const result = manager.storeMessages(messages, "conv-1")

			expect(result).toHaveLength(2)
			expect(result[0].content).toBe("String content")
			expect(result[1].content).toContain("Block content")
		})
	})

	describe("getMessagesByConversation", () => {
		it("should return all messages for a conversation", () => {
			const messages = [
				{ role: "user" as const, content: "Message 1" },
				{ role: "user" as const, content: "Message 2" },
			]

			manager.storeMessages(messages, "conv-1")
			const retrieved = manager.getMessagesByConversation("conv-1")

			expect(retrieved).toHaveLength(2)
			expect(retrieved[0].conversationId).toBe("conv-1")
			expect(retrieved[1].conversationId).toBe("conv-1")
		})

		it("should return empty array for unknown conversation", () => {
			const retrieved = manager.getMessagesByConversation("unknown")
			expect(retrieved).toEqual([])
		})

		it("should isolate messages by conversation ID", () => {
			manager.storeMessages([{ role: "user" as const, content: "Conv1 Msg" }], "conv-1")
			manager.storeMessages([{ role: "user" as const, content: "Conv2 Msg" }], "conv-2")

			const conv1Messages = manager.getMessagesByConversation("conv-1")
			const conv2Messages = manager.getMessagesByConversation("conv-2")

			expect(conv1Messages).toHaveLength(1)
			expect(conv2Messages).toHaveLength(1)
			expect(conv1Messages[0].content).toContain("Conv1")
			expect(conv2Messages[0].content).toContain("Conv2")
		})
	})

	describe("getMessagesByIndices", () => {
		it("should retrieve specific messages by indices", () => {
			const messages = [
				{ role: "user" as const, content: "Message 1" },
				{ role: "user" as const, content: "Message 2" },
				{ role: "user" as const, content: "Message 3" },
			]

			manager.storeMessages(messages, "conv-1")
			const retrieved = manager.getMessagesByIndices([1, 3])

			expect(retrieved).toHaveLength(2)
			expect(retrieved[0].messageIndex).toBe(1)
			expect(retrieved[1].messageIndex).toBe(3)
		})

		it("should handle non-existent indices gracefully", () => {
			manager.storeMessages([{ role: "user" as const, content: "Message 1" }], "conv-1")

			const retrieved = manager.getMessagesByIndices([1, 999])

			expect(retrieved).toHaveLength(1)
			expect(retrieved[0].messageIndex).toBe(1)
		})

		it("should return empty array for empty indices", () => {
			manager.storeMessages([{ role: "user" as const, content: "Message 1" }], "conv-1")

			const retrieved = manager.getMessagesByIndices([])
			expect(retrieved).toEqual([])
		})
	})

	describe("getStats", () => {
		it("should return accurate statistics", () => {
			manager.storeMessages([{ role: "user" as const, content: "Msg" }], "conv-1")
			manager.storeMessages([{ role: "user" as const, content: "Msg" }], "conv-2")

			const stats = manager.getStats()

			expect(stats.totalMessages).toBe(2)
			expect(stats.totalConversations).toBe(2)
			expect(stats.nextGlobalIndex).toBe(3)
		})

		it("should count tokens correctly", () => {
			const messages = [{ role: "user" as const, content: "A".repeat(100) }] // 100 chars ~= 25 tokens

			manager.storeMessages(messages, "conv-1")
			const stats = manager.getStats()

			expect(stats.totalTokens).toBeGreaterThan(0)
		})
	})

	describe("reset", () => {
		it("should clear all stored data", () => {
			manager.storeMessages([{ role: "user" as const, content: "Message" }], "conv-1")

			manager.reset()

			const stats = manager.getStats()
			expect(stats.totalMessages).toBe(0)
			expect(stats.totalConversations).toBe(0)
			expect(stats.nextGlobalIndex).toBe(1)
		})

		it("should allow new messages after reset", () => {
			manager.storeMessages([{ role: "user" as const, content: "Before reset" }], "conv-1")
			manager.reset()

			const result = manager.storeMessages([{ role: "user" as const, content: "After reset" }], "conv-2")

			expect(result[0].messageIndex).toBe(1)
		})
	})

	describe("edge cases", () => {
		it("should handle empty message arrays", () => {
			const result = manager.storeMessages([], "conv-1")
			expect(result).toEqual([])
		})

		it("should handle messages with no content", () => {
			const messages = [{ role: "user" as const }]

			const result = manager.storeMessages(messages as any, "conv-1")

			expect(result).toHaveLength(1)
			expect(result[0].content).toBe("")
		})

		it("should handle very long content", () => {
			const longContent = "A".repeat(100000) // 100k characters
			const messages = [{ role: "user" as const, content: longContent }]

			const result = manager.storeMessages(messages, "conv-1")

			expect(result[0].tokens).toBeGreaterThan(20000) // ~25k tokens
		})
	})
})
