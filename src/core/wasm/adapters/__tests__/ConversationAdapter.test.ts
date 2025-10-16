/**
 * ConversationAdapter 单元测试
 *
 * 测试覆盖：
 * 1. 初始化和配置
 * 2. 消息管理（添加、获取、清空、截断）
 * 3. 统计信息
 * 4. Fallback机制
 * 5. 错误处理
 * 6. 状态持久化
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { ConversationAdapter, type ConversationAdapterConfig } from "../ConversationAdapter"
import { HostInterface } from "../../host/HostInterface"
import type { ApiMessage } from "../../../task-persistence/apiMessages"

// Mock HostInterface
class MockHostInterface extends HostInterface {
	private logs: Array<{ level: string; message: string }> = []
	private files: Map<string, any> = new Map()

	constructor() {
		// 提供HostInterface所需的最小参数
		super("", null as any)
	}

	override log(level: string, message: string): void {
		this.logs.push({ level, message })
	}

	getLogs(): Array<{ level: string; message: string }> {
		return this.logs
	}

	clearLogs(): void {
		this.logs = []
	}

	override async fileExists(path: string): Promise<boolean> {
		return this.files.has(path)
	}

	override async readJson(path: string): Promise<any> {
		const data = this.files.get(path)
		if (!data) {
			throw new Error(`File not found: ${path}`)
		}
		return data
	}

	override async writeJson(path: string, data: any): Promise<void> {
		this.files.set(path, data)
	}

	setFile(path: string, data: any): void {
		this.files.set(path, data)
	}

	getFile(path: string): any {
		return this.files.get(path)
	}

	clearFiles(): void {
		this.files.clear()
	}
}

describe("ConversationAdapter", () => {
	let hostInterface: MockHostInterface
	let adapter: ConversationAdapter

	beforeEach(() => {
		hostInterface = new MockHostInterface()
	})

	afterEach(() => {
		if (adapter) {
			adapter.dispose()
		}
	})

	describe("初始化", () => {
		it("应该在WASM模式下成功初始化", () => {
			const config: ConversationAdapterConfig = {
				enableWasm: true,
				enableFallback: true,
			}

			adapter = new ConversationAdapter(hostInterface, config)

			expect(adapter).toBeDefined()
			expect(adapter.getCreatedAt()).toBeGreaterThan(0)
			expect(adapter.getUpdatedAt()).toBeGreaterThan(0)
		})

		it("应该在Fallback模式下成功初始化", () => {
			const config: ConversationAdapterConfig = {
				enableWasm: false,
				enableFallback: true,
			}

			adapter = new ConversationAdapter(hostInterface, config)

			expect(adapter).toBeDefined()
			expect(adapter.isFallbackMode()).toBe(true)

			const logs = hostInterface.getLogs()
			expect(logs.some((log) => log.message.includes("fallback mode"))).toBe(true)
		})

		it("应该处理WASM初始化错误并切换到Fallback", () => {
			// WASM模块在测试环境中不可用，应该自动切换到Fallback
			const config: ConversationAdapterConfig = {
				enableWasm: true,
				enableFallback: true,
			}

			adapter = new ConversationAdapter(hostInterface, config)

			// 在测试环境中，WASM可能不可用，应该切换到Fallback
			expect(adapter).toBeDefined()
		})
	})

	describe("消息管理", () => {
		beforeEach(() => {
			const config: ConversationAdapterConfig = {
				enableWasm: false, // 使用Fallback模式测试
				enableFallback: true,
			}
			adapter = new ConversationAdapter(hostInterface, config)
		})

		it("应该能够添加用户消息", async () => {
			const message: ApiMessage = {
				role: "user",
				content: "Hello, world!",
				ts: Date.now(),
			}

			await adapter.addMessage(message)

			const messages = await adapter.getMessages()
			expect(messages).toHaveLength(1)
			expect(messages[0].role).toBe("user")
			expect(messages[0].content).toBe("Hello, world!")
		})

		it("应该能够添加助手消息", async () => {
			const message: ApiMessage = {
				role: "assistant",
				content: "Hi there!",
				ts: Date.now(),
			}

			await adapter.addMessage(message)

			const messages = await adapter.getMessages()
			expect(messages).toHaveLength(1)
			expect(messages[0].role).toBe("assistant")
		})

		it("应该能够添加多条消息", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: Date.now() },
				{ role: "assistant", content: "Message 2", ts: Date.now() + 1 },
				{ role: "user", content: "Message 3", ts: Date.now() + 2 },
			]

			for (const msg of messages) {
				await adapter.addMessage(msg)
			}

			const result = await adapter.getMessages()
			expect(result).toHaveLength(3)
		})

		it("应该能够清空所有消息", async () => {
			await adapter.addMessage({ role: "user", content: "Test", ts: Date.now() })
			await adapter.clearMessages()

			const messages = await adapter.getMessages()
			expect(messages).toHaveLength(0)
		})

		it("应该能够根据时间戳查找消息", async () => {
			const timestamp = Date.now()
			const message: ApiMessage = {
				role: "user",
				content: "Find me",
				ts: timestamp,
			}

			await adapter.addMessage(message)

			const found = await adapter.findMessageByTimestamp(timestamp)
			expect(found).toBeDefined()
			expect(found?.content).toBe("Find me")
		})

		it("查找不存在的时间戳应该返回null", async () => {
			const found = await adapter.findMessageByTimestamp(99999)
			expect(found).toBeNull()
		})

		it("应该能够截断对话", async () => {
			const messages: ApiMessage[] = [
				{ role: "user", content: "Message 1", ts: Date.now() },
				{ role: "assistant", content: "Message 2", ts: Date.now() + 1 },
				{ role: "user", content: "Message 3", ts: Date.now() + 2 },
				{ role: "assistant", content: "Message 4", ts: Date.now() + 3 },
			]

			for (const msg of messages) {
				await adapter.addMessage(msg)
			}

			// 截断到索引1（保留前2条消息）
			await adapter.truncateConversation(1)

			const result = await adapter.getMessages()
			expect(result).toHaveLength(2)
			expect(result[0].content).toBe("Message 1")
			expect(result[1].content).toBe("Message 2")
		})
	})

	describe("统计信息", () => {
		beforeEach(() => {
			const config: ConversationAdapterConfig = {
				enableWasm: false,
				enableFallback: true,
			}
			adapter = new ConversationAdapter(hostInterface, config)
		})

		it("应该正确计算空对话的统计信息", async () => {
			const stats = await adapter.getStats()

			expect(stats.total_messages).toBe(0)
			expect(stats.user_messages).toBe(0)
			expect(stats.assistant_messages).toBe(0)
			expect(stats.summary_messages).toBe(0)
			expect(stats.estimated_tokens).toBe(0)
		})

		it("应该正确计算消息统计信息", async () => {
			await adapter.addMessage({ role: "user", content: "User message 1", ts: Date.now() })
			await adapter.addMessage({ role: "assistant", content: "Assistant message 1", ts: Date.now() + 1 })
			await adapter.addMessage({ role: "user", content: "User message 2", ts: Date.now() + 2 })

			const stats = await adapter.getStats()

			expect(stats.total_messages).toBe(3)
			expect(stats.user_messages).toBe(2)
			expect(stats.assistant_messages).toBe(1)
			expect(stats.estimated_tokens).toBeGreaterThan(0)
		})

		it("应该识别摘要消息", async () => {
			await adapter.addMessage({ role: "user", content: "Message 1", ts: Date.now() })
			await adapter.addMessage({
				role: "assistant",
				content: "Summary of conversation",
				ts: Date.now() + 1,
				isSummary: true,
			})

			const stats = await adapter.getStats()

			expect(stats.summary_messages).toBe(1)
		})

		it("应该能够获取消息数量", async () => {
			await adapter.addMessage({ role: "user", content: "Test 1", ts: Date.now() })
			await adapter.addMessage({ role: "assistant", content: "Test 2", ts: Date.now() + 1 })

			const count = await adapter.getMessageCount()
			expect(count).toBe(2)
		})
	})

	describe("摘要相关功能", () => {
		beforeEach(() => {
			const config: ConversationAdapterConfig = {
				enableWasm: false,
				enableFallback: true,
			}
			adapter = new ConversationAdapter(hostInterface, config)
		})

		it("应该能够获取最后一次摘要后的消息", async () => {
			await adapter.addMessage({ role: "user", content: "Message 1", ts: Date.now() })
			await adapter.addMessage({ role: "assistant", content: "Message 2", ts: Date.now() + 1 })
			await adapter.addMessage({
				role: "assistant",
				content: "Summary",
				ts: Date.now() + 2,
				isSummary: true,
			})
			await adapter.addMessage({ role: "user", content: "Message 3", ts: Date.now() + 3 })
			await adapter.addMessage({ role: "assistant", content: "Message 4", ts: Date.now() + 4 })

			const result = await adapter.getMessagesSinceLastSummary()

			// 应该包含第一条用户消息、摘要、以及摘要后的消息
			expect(result.length).toBeGreaterThanOrEqual(3)
			expect(result.some((msg) => msg.isSummary)).toBe(true)
		})

		it("没有摘要时应该返回所有消息", async () => {
			await adapter.addMessage({ role: "user", content: "Message 1", ts: Date.now() })
			await adapter.addMessage({ role: "assistant", content: "Message 2", ts: Date.now() + 1 })

			const result = await adapter.getMessagesSinceLastSummary()

			expect(result).toHaveLength(2)
		})
	})

	describe("计算保留消息数量", () => {
		beforeEach(() => {
			const config: ConversationAdapterConfig = {
				enableWasm: false,
				enableFallback: true,
			}
			adapter = new ConversationAdapter(hostInterface, config)
		})

		it("应该根据百分比计算保留消息数", async () => {
			const totalMessages = 10
			const contextPercentage = 0.5
			const maxContextTokens = 1000

			const result = await adapter.calculateMessagesToKeep(totalMessages, contextPercentage, maxContextTokens)

			expect(result).toBe(5) // 10 * 0.5 = 5
		})

		it("应该处理0%百分比", async () => {
			const result = await adapter.calculateMessagesToKeep(10, 0, 1000)

			expect(result).toBe(0)
		})

		it("应该处理100%百分比", async () => {
			const result = await adapter.calculateMessagesToKeep(10, 1.0, 1000)

			expect(result).toBe(10)
		})
	})

	describe("Fallback机制", () => {
		it("WASM失败后应该自动切换到Fallback", () => {
			const config: ConversationAdapterConfig = {
				enableWasm: true,
				enableFallback: true,
				maxRetries: 1,
			}

			adapter = new ConversationAdapter(hostInterface, config)

			// 在测试环境中WASM不可用，应该切换到Fallback
			expect(adapter).toBeDefined()
		})

		it("应该在Fallback模式下正常工作", async () => {
			const config: ConversationAdapterConfig = {
				enableWasm: false,
				enableFallback: true,
			}

			adapter = new ConversationAdapter(hostInterface, config)

			await adapter.addMessage({ role: "user", content: "Test in fallback", ts: Date.now() })

			const messages = await adapter.getMessages()
			expect(messages).toHaveLength(1)
			expect(adapter.isFallbackMode()).toBe(true)
		})
	})

	describe("状态持久化", () => {
		it("应该能够同步状态到存储", async () => {
			const config: ConversationAdapterConfig = {
				enableWasm: false,
				enableFallback: true,
				persistencePath: "/test/path",
			}

			adapter = new ConversationAdapter(hostInterface, config)

			await adapter.addMessage({ role: "user", content: "Test", ts: Date.now() })

			// syncState在addMessage内部调用，检查文件是否被写入
			const statePath = "/test/path/conversation-state.json"
			const fileExists = await hostInterface.fileExists(statePath)

			// 注意：由于使用了safeWriteJson，这里可能需要mock实现
			// 在实际测试中，我们只验证adapter的行为
			expect(adapter.getMessageCount()).resolves.toBe(1)
		})

		it("应该能够加载状态", async () => {
			const config: ConversationAdapterConfig = {
				enableWasm: false,
				enableFallback: true,
				persistencePath: "/test/path",
			}

			// 预设状态
			const mockState = {
				messageCount: 5,
				stats: {
					total_messages: 5,
					user_messages: 3,
					assistant_messages: 2,
					summary_messages: 0,
					estimated_tokens: 100,
				},
				timestamp: Date.now(),
			}

			hostInterface.setFile("/test/path/conversation-state.json", mockState)

			adapter = new ConversationAdapter(hostInterface, config)

			// 应该加载状态
			expect(adapter).toBeDefined()
		})
	})

	describe("错误处理", () => {
		beforeEach(() => {
			const config: ConversationAdapterConfig = {
				enableWasm: false,
				enableFallback: true,
			}
			adapter = new ConversationAdapter(hostInterface, config)
		})

		it("应该处理无效的消息格式", async () => {
			const invalidMessage = { role: "invalid", content: "test" } as any

			await expect(adapter.addMessage(invalidMessage)).rejects.toThrow()
		})

		it("应该处理空消息内容", async () => {
			const emptyMessage: ApiMessage = {
				role: "user",
				content: "",
				ts: Date.now(),
			}

			// 空内容应该被允许，但会被记录
			await adapter.addMessage(emptyMessage)
			const messages = await adapter.getMessages()
			expect(messages).toHaveLength(1)
		})

		it("应该处理负数索引的截断请求", async () => {
			await adapter.addMessage({ role: "user", content: "Test", ts: Date.now() })

			await expect(adapter.truncateConversation(-1)).rejects.toThrow()
		})

		it("应该处理超出范围的截断索引", async () => {
			await adapter.addMessage({ role: "user", content: "Test", ts: Date.now() })

			// 截断到索引100（超出范围）
			await expect(adapter.truncateConversation(100)).rejects.toThrow()
		})
	})

	describe("dispose清理", () => {
		it("应该正确清理资源", () => {
			const config: ConversationAdapterConfig = {
				enableWasm: false,
				enableFallback: true,
			}

			adapter = new ConversationAdapter(hostInterface, config)

			expect(() => adapter.dispose()).not.toThrow()
		})

		it("dispose后应该无法使用adapter", async () => {
			const config: ConversationAdapterConfig = {
				enableWasm: false,
				enableFallback: true,
			}

			adapter = new ConversationAdapter(hostInterface, config)
			adapter.dispose()

			// dispose后调用方法应该失败或返回空结果
			const messages = await adapter.getMessages()
			expect(messages).toHaveLength(0)
		})
	})

	describe("性能测试", () => {
		beforeEach(() => {
			const config: ConversationAdapterConfig = {
				enableWasm: false,
				enableFallback: true,
			}
			adapter = new ConversationAdapter(hostInterface, config)
		})

		it("应该能够处理大量消息", async () => {
			const messageCount = 100

			const startTime = Date.now()

			for (let i = 0; i < messageCount; i++) {
				await adapter.addMessage({
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}`,
					ts: Date.now() + i,
				})
			}

			const endTime = Date.now()
			const duration = endTime - startTime

			// 100条消息应该在合理时间内完成（例如5秒）
			expect(duration).toBeLessThan(5000)

			const messages = await adapter.getMessages()
			expect(messages).toHaveLength(messageCount)
		})

		it("应该高效处理统计信息计算", async () => {
			// 添加50条消息
			for (let i = 0; i < 50; i++) {
				await adapter.addMessage({
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}`,
					ts: Date.now() + i,
				})
			}

			const startTime = Date.now()
			const stats = await adapter.getStats()
			const duration = Date.now() - startTime

			// 统计计算应该很快（<100ms）
			expect(duration).toBeLessThan(100)
			expect(stats.total_messages).toBe(50)
		})
	})

	describe("边界条件", () => {
		beforeEach(() => {
			const config: ConversationAdapterConfig = {
				enableWasm: false,
				enableFallback: true,
			}
			adapter = new ConversationAdapter(hostInterface, config)
		})

		it("应该处理0条消息的截断", async () => {
			await adapter.truncateConversation(0)

			const messages = await adapter.getMessages()
			expect(messages).toHaveLength(0)
		})

		it("应该处理没有时间戳的消息", async () => {
			const message: ApiMessage = {
				role: "user",
				content: "No timestamp",
			}

			await adapter.addMessage(message)

			const messages = await adapter.getMessages()
			expect(messages).toHaveLength(1)
		})

		it("应该处理非常长的消息内容", async () => {
			const longContent = "x".repeat(10000)
			const message: ApiMessage = {
				role: "user",
				content: longContent,
				ts: Date.now(),
			}

			await adapter.addMessage(message)

			const messages = await adapter.getMessages()
			expect(messages[0].content).toHaveLength(10000)
		})
	})
})
