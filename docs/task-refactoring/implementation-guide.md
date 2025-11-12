# Task.ts 拆分实施指南

## 📋 快速导航

- [拆分顺序总览](#拆分顺序总览)
- [每个模块的详细步骤](#每个模块的详细步骤)
- [编译验证清单](#编译验证清单)
- [常见问题解决](#常见问题解决)

---

## 拆分顺序总览

### 推荐顺序（从简单到复杂）

```
1. 工具管理模块 (2-3天) ✅ 最简单
2. 资源管理模块 (3-4天)
3. 检查点管理模块 (2-3天)
4. 裁判模式模块 (3-4天)
5. 消息管理模块 (5-7天) ⚠️ 中等复杂
6. 状态管理模块 (4-5天)
7. API交互模块 (7-10天) ⚠️ 高复杂度
8. 生命周期管理模块 (5-7天) ⚠️ 最核心
```

---

## 每个模块的详细步骤

### 模块 1: 工具管理模块 (ToolExecutionTracker)

**影响范围**: 约 100 行代码
**难度**: ⭐ (最简单)
**预计时间**: 2-3 天

#### 步骤 1: 创建新模块

```bash
# 创建目录和文件
mkdir -p src/core/task/tools
touch src/core/task/tools/{ToolExecutionTracker.ts,types.ts,index.ts}
```

#### 步骤 2: 实现 ToolExecutionTracker

```typescript
// src/core/task/tools/ToolExecutionTracker.ts
import type { ToolName, ToolUsage } from "@roo-code/types"
import { EventEmitter } from "events"
import { RooCodeEventName } from "@roo-code/types"

export class ToolExecutionTracker extends EventEmitter {
	private toolUsage: ToolUsage = {}
	private readonly taskId: string

	constructor(taskId: string) {
		super()
		this.taskId = taskId
	}

	recordToolUsage(toolName: ToolName): void {
		if (!this.toolUsage[toolName]) {
			this.toolUsage[toolName] = { attempts: 0, failures: 0 }
		}
		this.toolUsage[toolName].attempts++
	}

	recordToolError(toolName: ToolName, error?: string): void {
		if (!this.toolUsage[toolName]) {
			this.toolUsage[toolName] = { attempts: 0, failures: 0 }
		}
		this.toolUsage[toolName].failures++

		if (error) {
			this.emit(RooCodeEventName.TaskToolFailed, this.taskId, toolName, error)
		}
	}

	getToolUsage(): ToolUsage {
		return { ...this.toolUsage }
	}

	reset(): void {
		this.toolUsage = {}
	}
}
```

#### 步骤 3: 在 Task.ts 中集成

```typescript
// Task.ts - 找到以下行并修改

// 旧代码 (删除)
// toolUsage: ToolUsage = {}

// 新代码 (添加)
import { ToolExecutionTracker } from "./tools/ToolExecutionTracker"

export class Task extends EventEmitter<TaskEvents> {
	// 添加新属性
	private toolTracker: ToolExecutionTracker

	constructor(options: TaskOptions) {
		super()

		// 在构造函数中初始化
		this.toolTracker = new ToolExecutionTracker(this.taskId)

		// 转发事件到 Task
		this.toolTracker.on(RooCodeEventName.TaskToolFailed, (...args) => {
			this.emit(RooCodeEventName.TaskToolFailed, ...args)
		})
	}

	// 修改现有方法
	public recordToolUsage(toolName: ToolName) {
		this.toolTracker.recordToolUsage(toolName)
	}

	public recordToolError(toolName: ToolName, error?: string) {
		this.toolTracker.recordToolError(toolName, error)
	}

	// 如果有 getter，也要修改
	public get toolUsage(): ToolUsage {
		return this.toolTracker.getToolUsage()
	}
}
```

#### 步骤 4: 编译验证

```bash
# 编译检查
cd src
npm run build

# 如果有类型错误，检查：
# 1. 导入路径是否正确
# 2. 类型定义是否匹配
# 3. EventEmitter 的使用是否正确
```

#### 步骤 5: 运行测试

```bash
# 运行现有测试
cd src
npx vitest run tests/

# 如果测试失败：
# 1. 检查是否有测试直接访问 toolUsage 属性
# 2. 更新测试以使用新的 getter
```

#### 步骤 6: 添加单元测试

```typescript
// src/core/task/tools/ToolExecutionTracker.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import { ToolExecutionTracker } from "./ToolExecutionTracker"
import { RooCodeEventName } from "@roo-code/types"

describe("ToolExecutionTracker", () => {
	let tracker: ToolExecutionTracker

	beforeEach(() => {
		tracker = new ToolExecutionTracker("test-task-id")
	})

	it("should initialize with empty usage", () => {
		expect(tracker.getToolUsage()).toEqual({})
	})

	it("should record tool usage", () => {
		tracker.recordToolUsage("read_file")
		const usage = tracker.getToolUsage()

		expect(usage["read_file"]).toEqual({
			attempts: 1,
			failures: 0,
		})
	})

	it("should accumulate multiple tool uses", () => {
		tracker.recordToolUsage("read_file")
		tracker.recordToolUsage("read_file")
		tracker.recordToolUsage("read_file")

		const usage = tracker.getToolUsage()
		expect(usage["read_file"].attempts).toBe(3)
	})

	it("should record tool errors", () => {
		tracker.recordToolUsage("write_to_file")
		tracker.recordToolError("write_to_file", "Permission denied")

		const usage = tracker.getToolUsage()
		expect(usage["write_to_file"]).toEqual({
			attempts: 1,
			failures: 1,
		})
	})

	it("should emit event on tool failure", () => {
		const listener = vi.fn()
		tracker.on(RooCodeEventName.TaskToolFailed, listener)

		tracker.recordToolError("execute_command", "Command not found")

		expect(listener).toHaveBeenCalledWith("test-task-id", "execute_command", "Command not found")
	})

	it("should reset usage statistics", () => {
		tracker.recordToolUsage("read_file")
		tracker.reset()

		expect(tracker.getToolUsage()).toEqual({})
	})
})
```

```bash
# 运行新测试
cd src
npx vitest run core/task/tools/ToolExecutionTracker.test.ts
```

---

### 模块 2: 资源管理模块 (ResourceManager)

**影响范围**: 约 300 行代码
**难度**: ⭐⭐ (简单-中等)
**预计时间**: 3-4 天

#### 步骤 1: 创建模块结构

```bash
mkdir -p src/core/task/resources
touch src/core/task/resources/{ResourceManager.ts,BrowserResourceManager.ts,TerminalResourceManager.ts,types.ts,index.ts}
```

#### 步骤 2: 实现 ResourceManager

```typescript
// src/core/task/resources/ResourceManager.ts
import type * as vscode from "vscode"
import type { TaskContext } from "../types"
import { BrowserSession } from "../../../services/browser/BrowserSession"
import { UrlContentFetcher } from "../../../services/browser/UrlContentFetcher"
import { FileContextTracker } from "../../context-tracking/FileContextTracker"
import { TerminalRegistry } from "../../../integrations/terminal/TerminalRegistry"
import type { ClineProvider } from "../../webview/ClineProvider"

export class ResourceManager {
	private browserSession: BrowserSession
	private urlContentFetcher: UrlContentFetcher
	private fileContextTracker: FileContextTracker
	private readonly taskId: string

	constructor(taskId: string, providerContext: vscode.ExtensionContext, providerRef: WeakRef<ClineProvider>) {
		this.taskId = taskId
		this.browserSession = new BrowserSession(providerContext)
		this.urlContentFetcher = new UrlContentFetcher(providerContext)
		this.fileContextTracker = new FileContextTracker(providerRef.deref()!, taskId)
	}

	getBrowserSession(): BrowserSession {
		return this.browserSession
	}

	getUrlContentFetcher(): UrlContentFetcher {
		return this.urlContentFetcher
	}

	getFileContextTracker(): FileContextTracker {
		return this.fileContextTracker
	}

	async dispose(): Promise<void> {
		try {
			await this.urlContentFetcher.closeBrowser()
		} catch (error) {
			console.error("Error closing URL content fetcher:", error)
		}

		try {
			await this.browserSession.closeBrowser()
		} catch (error) {
			console.error("Error closing browser session:", error)
		}

		try {
			this.fileContextTracker.dispose()
		} catch (error) {
			console.error("Error disposing file context tracker:", error)
		}

		try {
			TerminalRegistry.releaseTerminalsForTask(this.taskId)
		} catch (error) {
			console.error("Error releasing terminals:", error)
		}
	}
}
```

#### 步骤 3: 在 Task.ts 中集成

```typescript
// Task.ts 修改

import { ResourceManager } from "./resources/ResourceManager"

export class Task extends EventEmitter<TaskEvents> {
	// 旧属性（删除或注释）
	// browserSession: BrowserSession
	// urlContentFetcher: UrlContentFetcher
	// fileContextTracker: FileContextTracker

	// 新属性
	private resourceManager: ResourceManager

	constructor(options: TaskOptions) {
		super()

		// 初始化资源管理器
		this.resourceManager = new ResourceManager(this.taskId, provider.context, this.providerRef)

		// ... 其他初始化
	}

	// 添加 getter 保持兼容性
	get browserSession(): BrowserSession {
		return this.resourceManager.getBrowserSession()
	}

	get urlContentFetcher(): UrlContentFetcher {
		return this.resourceManager.getUrlContentFetcher()
	}

	get fileContextTracker(): FileContextTracker {
		return this.resourceManager.getFileContextTracker()
	}

	// 修改 dispose 方法
	public dispose(): void {
		console.log(`[Task#dispose] disposing task ${this.taskId}.${this.instanceId}`)

		// ... 其他清理代码

		// 使用资源管理器清理
		this.resourceManager.dispose().catch((error) => {
			console.error("Error disposing resources:", error)
		})

		// ... 其他清理代码
	}
}
```

---

### 模块 3: 消息管理模块 (MessageManager)

**影响范围**: 约 800 行代码
**难度**: ⭐⭐⭐ (中等)
**预计时间**: 5-7 天

#### 步骤 1: 创建模块结构

```bash
mkdir -p src/core/task/messages
touch src/core/task/messages/{MessageManager.ts,ApiMessageStore.ts,ClineMessageStore.ts,MessagePersistence.ts,types.ts,index.ts}
```

#### 步骤 2: 实现 MessagePersistence

```typescript
// src/core/task/messages/MessagePersistence.ts
import type { ClineMessage, ApiMessage } from "@roo-code/types"
import { readApiMessages, saveApiMessages, readTaskMessages, saveTaskMessages } from "../../task-persistence"

export class MessagePersistence {
	constructor(
		private readonly taskId: string,
		private readonly globalStoragePath: string,
	) {}

	async loadApiMessages(): Promise<ApiMessage[]> {
		return readApiMessages({
			taskId: this.taskId,
			globalStoragePath: this.globalStoragePath,
		})
	}

	async saveApiMessages(messages: ApiMessage[]): Promise<void> {
		await saveApiMessages({
			messages,
			taskId: this.taskId,
			globalStoragePath: this.globalStoragePath,
		})
	}

	async loadClineMessages(): Promise<ClineMessage[]> {
		return readTaskMessages({
			taskId: this.taskId,
			globalStoragePath: this.globalStoragePath,
		})
	}

	async saveClineMessages(messages: ClineMessage[]): Promise<void> {
		await saveTaskMessages({
			messages,
			taskId: this.taskId,
			globalStoragePath: this.globalStoragePath,
		})
	}
}
```

#### 步骤 3: 实现 MessageManager

```typescript
// src/core/task/messages/MessageManager.ts
import type { ClineMessage, ApiMessage } from "@roo-code/types"
import type { ClineProvider } from "../../webview/ClineProvider"
import { MessagePersistence } from "./MessagePersistence"
import { EventEmitter } from "events"
import { RooCodeEventName } from "@roo-code/types"

export class MessageManager extends EventEmitter {
	private apiMessages: ApiMessage[] = []
	private clineMessages: ClineMessage[] = []
	private persistence: MessagePersistence
	private nextMessageIndex: number = 1

	// 防抖保存
	private readonly SAVE_DEBOUNCE_MS = 1000
	private saveDebounceTimer?: NodeJS.Timeout
	private pendingSave: boolean = false

	constructor(
		private readonly taskId: string,
		globalStoragePath: string,
		private readonly providerRef: WeakRef<ClineProvider>,
	) {
		super()
		this.persistence = new MessagePersistence(taskId, globalStoragePath)
	}

	async initialize(): Promise<void> {
		this.apiMessages = await this.persistence.loadApiMessages()
		this.clineMessages = await this.persistence.loadClineMessages()

		// 计算下一个消息索引
		const maxIndex = Math.max(0, ...this.clineMessages.filter((m) => m.messageIndex).map((m) => m.messageIndex!))
		this.nextMessageIndex = maxIndex + 1
	}

	async addClineMessage(message: ClineMessage): Promise<void> {
		// 自动分配 messageIndex
		if (!message.messageIndex) {
			message.messageIndex = this.nextMessageIndex++
		}

		this.clineMessages.push(message)

		// 通知 provider 更新 webview
		const provider = this.providerRef.deref()
		await provider?.postStateToWebview()

		// 触发事件
		this.emit(RooCodeEventName.Message, {
			action: "created",
			message,
		})

		// 保存（防抖）
		await this.saveClineMessagesDebounced()
	}

	async addApiMessage(message: ApiMessage): Promise<void> {
		const messageWithTs = { ...message, ts: Date.now() }
		this.apiMessages.push(messageWithTs)
		await this.saveApiMessages()
	}

	getClineMessages(): ClineMessage[] {
		return this.clineMessages
	}

	getApiMessages(): ApiMessage[] {
		return this.apiMessages
	}

	async overwriteClineMessages(messages: ClineMessage[]): Promise<void> {
		// 确保所有消息都有 messageIndex
		let maxIndex = 0
		for (const msg of messages) {
			if (msg.messageIndex) {
				maxIndex = Math.max(maxIndex, msg.messageIndex)
			}
		}

		let nextIndex = maxIndex + 1
		for (const msg of messages) {
			if (!msg.messageIndex) {
				msg.messageIndex = nextIndex++
			}
		}

		this.nextMessageIndex = Math.max(this.nextMessageIndex, nextIndex)
		this.clineMessages = messages

		await this.saveClineMessages()
	}

	async overwriteApiMessages(messages: ApiMessage[]): Promise<void> {
		this.apiMessages = messages
		await this.saveApiMessages()
	}

	private async saveClineMessagesDebounced(): Promise<void> {
		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer)
		}

		this.pendingSave = true

		this.saveDebounceTimer = setTimeout(async () => {
			await this.saveClineMessages()
			this.pendingSave = false
			this.saveDebounceTimer = undefined
		}, this.SAVE_DEBOUNCE_MS)
	}

	private async saveClineMessages(): Promise<void> {
		try {
			await this.persistence.saveClineMessages(this.clineMessages)
		} catch (error) {
			console.error("Failed to save Cline messages:", error)
		}
	}

	private async saveApiMessages(): Promise<void> {
		try {
			await this.persistence.saveApiMessages(this.apiMessages)
		} catch (error) {
			console.error("Failed to save API messages:", error)
		}
	}

	async flushPendingSave(): Promise<void> {
		if (!this.pendingSave) {
			return
		}

		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer)
			this.saveDebounceTimer = undefined
		}

		await this.saveClineMessages()
		this.pendingSave = false
	}
}
```

---

## 编译验证清单

### 每次拆分后必须检查的项目

```bash
# 1.
```
