# Task.ts 模块化拆分重构方案

## 📋 目录

1. [当前问题分析](#当前问题分析)
2. [拆分原则](#拆分原则)
3. [模块划分方案](#模块划分方案)
4. [详细实施步骤](#详细实施步骤)
5. [迁移路径](#迁移路径)
6. [测试策略](#测试策略)
7. [编译验证清单](#编译验证清单)
8. [注意事项](#注意事项)

---

## 当前问题分析

### 文件现状

- **总行数**: 4131 行
- **主要问题**:
    - 单一文件过大，难以维护
    - 职责过多，违反单一职责原则
    - 代码耦合度高
    - 测试困难
    - 新功能难以添加

### 主要功能模块识别

通过分析代码，Task.ts 包含以下主要功能：

1. **生命周期管理** (约 500 行)
    - 任务创建、启动、暂停、恢复、中止
    - 子任务管理
2. **消息管理** (约 800 行)
    - API 消息历史
    - Cline 消息历史
    - 消息持久化
3. **API 交互** (约 900 行)
    - API 请求处理
    - 流式响应处理
    - 错误重试机制
    - 上下文管理和压缩
4. **工具执行** (约 400 行)
    - 工具调用追踪
    - 错误处理
    - 使用统计
5. **状态管理** (约 300 行)
    - 任务状态
    - 暂停/恢复状态
    - Ask/Say 状态
6. **裁判模式** (约 400 行)
    - 裁判服务集成
    - 任务完成验证
7. **检查点管理** (约 200 行)
    - 保存/恢复检查点
    - 差异对比
8. **资源管理** (约 300 行)
    - 浏览器会话
    - 终端进程
    - 文件追踪
    - 内存管理

---

## 拆分原则

### 1. 单一职责原则

每个模块只负责一个明确的功能领域

### 2. 最小依赖原则

模块之间通过接口通信，减少直接依赖

### 3. 向后兼容原则

保持公共 API 不变，内部实现逐步重构

### 4. 渐进式迁移

逐个模块拆分，每次拆分后确保编译通过且测试通过

### 5. 可测试性优先

拆分后的模块必须易于单元测试

---

## 模块划分方案

### 目录结构

```
src/core/task/
├── Task.ts                          # 主入口（精简后约 500 行）
├── types.ts                         # 类型定义
├── interfaces.ts                    # 接口定义
│
├── lifecycle/                       # 生命周期管理
│   ├── TaskLifecycleManager.ts     # 生命周期管理器
│   ├── TaskInitializer.ts          # 任务初始化
│   ├── SubtaskManager.ts           # 子任务管理
│   └── types.ts
│
├── messages/                        # 消息管理
│   ├── MessageManager.ts           # 消息管理器
│   ├── ApiMessageStore.ts          # API 消息存储
│   ├── ClineMessageStore.ts        # Cline 消息存储
│   ├── MessagePersistence.ts       # 消息持久化
│   └── types.ts
│
├── api/                            # API 交互
│   ├── ApiRequestManager.ts        # API 请求管理
│   ├── StreamProcessor.ts          # 流处理
│   ├── ContextManager.ts           # 上下文管理
│   ├── RetryStrategy.ts            # 重试策略
│   └── types.ts
│
├── state/                          # 状态管理
│   ├── TaskStateManager.ts         # 任务状态管理
│   ├── AskStateManager.ts          # Ask 状态管理
│   ├── StreamStateManager.ts       # 流状态管理
│   └── types.ts
│
├── tools/                          # 工具管理
│   ├── ToolExecutionTracker.ts     # 工具执行追踪
│   ├── ToolUsageStats.ts           # 工具使用统计
│   └── types.ts
│
├── judge/                          # 裁判模式
│   ├── TaskJudgeManager.ts         # 裁判管理器
│   ├── JudgeConfigProvider.ts      # 裁判配置提供者
│   └── types.ts
│
├── checkpoints/                    # 检查点
│   ├── CheckpointManager.ts        # 检查点管理器
│   └── types.ts
│
└── resources/                      # 资源管理
    ├── ResourceManager.ts          # 资源管理器
    ├── BrowserResourceManager.ts   # 浏览器资源
    ├── TerminalResourceManager.ts  # 终端资源
    └── types.ts
```

---

## 详细实施步骤

### 🎯 推荐拆分顺序

**原则**: 从最独立、依赖最少的模块开始，逐步向核心模块推进

1. **工具管理模块** - 最独立，只统计数据
2. **资源管理模块** - 相对独立，管理外部资源
3. **检查点管理模块** - 相对独立
4. **裁判模式模块** - 功能相对独立
5. **消息管理模块** - 中等依赖
6. **状态管理模块** - 中等依赖
7. **API 交互模块** - 复杂度高
8. **生命周期管理模块** - 最核心，最后拆分

---

### 阶段 1: 准备工作（第 1 周）

#### 1.1 创建目录结构

```bash
# 创建所有模块目录
mkdir -p src/core/task/{lifecycle,messages,api,state,tools,judge,checkpoints,resources}

# 在每个目录创建 types.ts
for dir in lifecycle messages api state tools judge checkpoints resources; do
  touch src/core/task/$dir/types.ts
done
```

#### 1.2 提取共享类型定义

创建 `src/core/task/types.ts`:

```typescript
// src/core/task/types.ts
import type { ClineProvider } from "../webview/ClineProvider"
import type { ApiHandler } from "../../api"
import type { ClineMessage, ApiMessage, TokenUsage, ToolUsage, TodoItem } from "@roo-code/types"

/**
 * 任务上下文 - 包含任务的基本信息和依赖
 */
export interface TaskContext {
	readonly taskId: string
	readonly instanceId: string
	readonly workspacePath: string
	readonly globalStoragePath: string
	readonly rootTaskId?: string
	readonly parentTaskId?: string
}

/**
 * 任务依赖 - 外部服务和引用
 */
export interface TaskDependencies {
	providerRef: WeakRef<ClineProvider>
	api: ApiHandler
	apiConfiguration: ProviderSettings
}

/**
 * 任务元数据
 */
export interface TaskMetadata {
	task?: string
	images?: string[]
}
```

#### 1.3 创建接口定义

创建 `src/core/task/interfaces.ts`:

```typescript
// src/core/task/interfaces.ts
import type { ClineMessage, ApiMessage, TokenUsage, ToolName } from "@roo-code/types"

/**
 * 消息管理器接口
 */
export interface IMessageManager {
	addClineMessage(message: ClineMessage): Promise<void>
	addApiMessage(message: ApiMessage): Promise<void>
	getClineMessages(): ClineMessage[]
	getApiMessages(): ApiMessage[]
	overwriteClineMessages(messages: ClineMessage[]): Promise<void>
	overwriteApiMessages(messages: ApiMessage[]): Promise<void>
}

/**
 * API 请求管理器接口
 */
export interface IApiRequestManager {
	attemptRequest(retryAttempt?: number): AsyncIterable<StreamChunk>
	handleError(error: Error): Promise<void>
}

/**
 * 生命周期管理器接口
 */
export interface ILifecycleManager {
	startTask(task?: string, images?: string[]): Promise<void>
	resumeTask(): Promise<void>
	abortTask(isAbandoned?: boolean): Promise<void>
}

/**
 * 状态管理器接口
 */
export interface IStateManager {
	getTaskStatus(): TaskStatus
	setAskResponse(response: ClineAskResponse, text?: string, images?: string[]): void
	clearTemporaryState(): void
}

/**
 * 工具追踪器接口
 */
export interface IToolTracker {
	recordToolUsage(toolName: ToolName): void
	recordToolError(toolName: ToolName, error?: string): void
	getToolUsage(): ToolUsage
}
```

---

### 阶段 2: 工具管理模块拆分（第 2 周）

**为什么先拆分**: 工具管理是最独立的模块，只负责统计，没有复杂的依赖

#### 2.1 创建 ToolExecutionTracker

```typescript
// src/core/task/tools/ToolExecutionTracker.ts
import type { ToolName, ToolUsage } from "@roo-code/types"
import { EventEmitter } from "events"
import { RooCodeEventName } from "@roo-code/types"

export class ToolExecutionTracker extends EventEmitter {
	private toolUsage: ToolUsage = {}
	private taskId: string

	constructor(taskId: string) {
		super()
		this.taskId = taskId
	}

	/**
	 * 记录工具使用
	 */
	recordToolUsage(toolName: ToolName): void {
		if (!this.toolUsage[toolName]) {
			this.toolUsage[toolName] = { attempts: 0, failures: 0 }
		}
		this.toolUsage[toolName].attempts++
	}

	/**
	 * 记录工具错误
	 */
	recordToolError(toolName: ToolName, error?: string): void {
		if (!this.toolUsage[toolName]) {
			this.toolUsage[toolName] = { attempts: 0, failures: 0 }
		}
		this.toolUsage[toolName].failures++

		if (error) {
			this.emit(RooCodeEventName.TaskToolFailed, this.taskId, toolName, error)
		}
	}

	/**
	 * 获取工具使用统计
	 */
	getToolUsage(): ToolUsage {
		return { ...this.toolUsage }
	}

	/**
	 * 重置统计
	 */
	reset(): void {
		this.toolUsage = {}
	}
}
```

#### 2.2 在 Task.ts 中集成

```typescript
// Task.ts
import { ToolExecutionTracker } from "./tools/ToolExecutionTracker"

export class Task extends EventEmitter<TaskEvents> implements TaskLike {
	// ... 其他属性

	// 替换原有的 toolUsage
	private toolTracker: ToolExecutionTracker

	constructor(options: TaskOptions) {
		super()

		// 初始化工具追踪器
		this.toolTracker = new ToolExecutionTracker(this.taskId)

		// 转发事件
		this.toolTracker.on(RooCodeEventName.TaskToolFailed, (...args) => {
			this.emit(RooCodeEventName.TaskToolFailed, ...args)
		})

		// ... 其他初始化
	}

	// 替换原有方法
	public recordToolUsage(toolName: ToolName) {
		this.toolTracker.recordToolUsage(toolName)
	}

	public recordToolError(toolName: ToolName, error?: string) {
		this.toolTracker.recordToolError(toolName, error)
	}

	// 如果有 getter
	public get toolUsage(): ToolUsage {
		return this.toolTracker.getToolUsage()
	}
}
```

#### 2.3 测试工具模块

创建 `src/core/task/tools/ToolExecutionTracker.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { ToolExecutionTracker } from "./ToolExecutionTracker"

describe("ToolExecutionTracker", () => {
	let tracker: ToolExecutionTracker

	beforeEach(() => {
		tracker = new ToolExecutionTracker("test-task-id")
	})

	it("should record tool usage", () => {
		tracker.recordToolUsage("read_file")
		const usage = tracker.getToolUsage()

		expect(usage["read_file"]).toEqual({
			attempts: 1,
			failures: 0,
		})
	})

	it("should record tool errors", () => {
		tracker.recordToolUsage("write_to_file")
		tracker.recordToolError("write_to_file", "File not found")

		const usage = tracker.getToolUsage()
		expect(usage["write_to_file"]).toEqual({
			attempts: 1,
			failures: 1,
		})
	})

	it("should emit event on tool failure", (done) => {
		tracker.on("TaskToolFailed", (taskId, toolName, error) => {
			expect(taskId).toBe("test-task-id")
			expect(toolName).toBe("execute_command")
			expect(error).toBe("Command failed")
			done()
		})

		tracker.recordToolError("execute_command", "Command failed")
	})
})
```

---

### 阶段 3: 资源管理模块拆分（第 3 周）

#### 3.1 创建 ResourceManager

```typescript
// src/core/task/resources/ResourceManager.ts
import type { TaskContext } from "../types"
import { BrowserResourceManager } from "./BrowserResourceManager"
import { TerminalResourceManager } from "./TerminalResourceManager"
import { FileTrackingManager } from "./FileTrackingManager"

export class ResourceManager {
	private browserManager: BrowserResourceManager
	private terminalManager: TerminalResourceManager
	private fileTrackingManager: FileTrackingManager

	constructor(context: TaskContext, providerContext: vscode.ExtensionContext) {
		this.browserManager = new BrowserResourceManager(providerContext)
		this.terminalManager = new TerminalResourceManager(context.taskId)
		this.fileTrackingManager = new FileTrackingManager(context)
	}

	/**
	 * 获取浏览器会话
	 */
	getBrowserSession() {
		return this.browserManager.getSession()
	}

	/**
	 * 获取URL内容抓取器
	 */
	getUrlContentFetcher() {
		return this.browserManager.getContentFetcher()
	}

	/**
	 * 获取文件上下文追踪器
	 */
	getFileContextTracker() {
		return this.fileTrackingManager.getTracker()
	}

	/**
	 * 释放所有资源
	 */
	async dispose(): Promise<void> {
		await this.browserManager.dispose()
		await this.terminalManager.dispose()
		await this.fileTrackingManager.dispose()
	}
}
```

#### 3.2 创建 BrowserResourceManager

```typescript
// src/core/task/resources/BrowserResourceManager.ts
import { BrowserSession } from "../../../services/browser/BrowserSession"
import { UrlContentFetcher } from "../../../services/browser/UrlContentFetcher"
import type * as vscode from
```
