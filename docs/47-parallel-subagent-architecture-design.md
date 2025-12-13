# Roo Code 并行子代理架构设计文档

> **版本**: 1.0  
> **日期**: 2025-12-12  
> **状态**: 设计阶段  
> **参考文档**: SubAgentParallel_Evaluation.md, subagentParaller_ui.md

---

## 1. 架构概览

### 1.1 设计目标

实现Claude Code风格的并行子代理执行机制，支持：

- ✅ 最多10个并发子代理
- ✅ 自动队列管理（超出排队）
- ✅ 动态调度（完成即拉取）
- ✅ 独立200K上下文隔离
- ✅ LLM自主决策并行执行

### 1.2 实现方案

**采用方案A**：在现有Code模式中实现并行能力

- LLM自动判断任务是否适合并行
- 新增 `spawn_parallel_tasks` 工具
- 无需用户手动切换模式

### 1.3 系统架构图

```
┌────────────────────────────────────────────────────────────────┐
│                         Task (Code Mode)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              ParallelSubagentManager                      │  │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────────┐   │  │
│  │  │TaskQueue   │  │Concurrency │  │  ContextPool     │   │  │
│  │  │(max 100+)  │  │Ctrl(max 10)│  │  (isolated ctx)  │   │  │
│  │  └─────┬──────┘  └─────┬──────┘  └────────┬─────────┘   │  │
│  │        │                │                   │             │  │
│  │        └────────────────┼───────────────────┘             │  │
│  │                         ▼                                 │  │
│  │        ┌────────────────────────────────────┐            │  │
│  │        │     DynamicScheduler               │            │  │
│  │        │  • 完成即拉取 (不等待批次)         │            │  │
│  │        │  • 优先级调度                      │            │  │
│  │        │  • 故障恢复                        │            │  │
│  │        └────────────────────────────────────┘            │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│SubagentSlot 1│     │SubagentSlot 2│     │SubagentSlot n│
│(isolated ctx)│     │(isolated ctx)│     │(isolated ctx)│
│[model: opus] │     │[model: haiku]│     │[model: ...]  │
│[tools: [...]]│     │[tools: [...]]│     │[tools: [...]]│
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## 2. 核心组件设计

### 2.1 ParallelSubagentManager

**职责**：管理并行子代理的生命周期和调度

**接口定义**：

```typescript
// src/core/subagent/parallel/ParallelSubagentManager.ts

interface ParallelSubagentConfig {
	maxConcurrency: number // 默认 10
	maxQueueSize: number // 默认 100
	subagentTimeout: number // 单个子代理超时 (ms)
	dynamicScheduling: boolean // 启用动态调度
	contextTokenLimit: number // 每个上下文限制 (200K)
}

interface SubagentTask {
	id: string
	type: string // 任务类型描述
	priority: "high" | "medium" | "low"
	description: string // 任务描述
	context?: string // 附加上下文
	targetFiles?: string[] // 相关文件
	config: SubagentSlotConfig
	resolve: (result: SubagentResult) => void
	reject: (error: Error) => void
}

interface SubagentSlotConfig {
	model?: string // 可指定模型
	tools?: string[] // 可用工具列表
	permissionMode?: "strict" | "relaxed"
}

class ParallelSubagentManager {
	private queue: SubagentTask[] = []
	private activeSlots: Map<string, SubagentSlot> = new Map()
	private contextPool: ContextPool
	private config: ParallelSubagentConfig

	constructor(api: Anthropic, config: Partial<ParallelSubagentConfig>)

	// 运行单个子代理
	async runSubagent(params: SubagentTask, config?: SubagentSlotConfig): Promise<SubagentResult>

	// 批量运行子代理（支持并行）
	async runBatch(
		tasks: SubagentTask[],
		mode: "auto" | "wait_all" | "stream_results" = "auto",
	): Promise<SubagentResult[]>

	// 动态调度（私有）
	private processQueue(): void

	// 获取当前状态
	getStatus(): {
		running: number
		queued: number
		completed: number
		failed: number
	}
}
```

### 2.2 IsolatedContext & ContextPool

**职责**：管理独立的200K上下文窗口

```typescript
// src/core/subagent/parallel/IsolatedContext.ts

interface IsolatedContext {
	id: string
	tokenLimit: number // 200K
	messages: ApiMessage[] // 独立消息历史
	systemPrompt: string
	metadata: {
		agentName: string
		model: string
		startTime: number
		tokenUsage: { input: number; output: number }
	}
}

class ContextPool {
	private pool: IsolatedContext[] = []
	private maxSize: number = 10
	private inUse: Set<string> = new Set()

	// 获取空闲上下文
	acquire(agentName: string, model: string): IsolatedContext

	// 释放上下文
	release(ctx: IsolatedContext): void

	// 重置上下文
	reset(ctx: IsolatedContext): void

	// 获取池状态
	getStatus(): { total: number; inUse: number; available: number }
}
```

### 2.3 SubagentSlot

**职责**：单个子代理执行槽位

```typescript
// src/core/subagent/parallel/SubagentSlot.ts

class SubagentSlot {
	readonly slotId: string
	private context: IsolatedContext
	private config: SubagentSlotConfig
	private apiHandler: Anthropic
	private status: "idle" | "running" | "completed" | "failed"

	constructor(slotId: string, context: IsolatedContext, config: SubagentSlotConfig, api: Anthropic)

	// 执行任务
	async execute(task: SubagentTask): Promise<SubagentResult>

	// 生成摘要（仅返回关键结果，不返回完整上下文）
	private summarizeResult(fullResult: any): string

	// 获取槽位状态
	getStatus(): {
		slotId: string
		status: string
		progress: number
		tokenUsage: { input: number; output: number }
	}
}
```

### 2.4 DynamicScheduler

**职责**：动态调度器，实现"完成即拉取"机制

```typescript
// src/core/subagent/parallel/DynamicScheduler.ts

class DynamicScheduler {
	private queue: SubagentTask[]
	private activeSlots: Map<string, SubagentSlot>
	private maxConcurrency: number

	// 添加任务到队列
	enqueue(task: SubagentTask): void

	// 从队列取出任务（优先级排序）
	dequeue(): SubagentTask | null

	// 尝试调度下一个任务
	scheduleNext(): Promise<void>

	// 槽位完成回调
	onSlotCompleted(slotId: string): void

	// 槽位失败回调
	onSlotFailed(slotId: string, error: Error): void
}
```

---

## 3. 工具集成

### 3.1 spawn_parallel_tasks 工具

```typescript
// src/core/tools/spawnParallelTasksTool.ts

interface SpawnParallelTasksParams {
  tasks: Array<{
    id: string
    description: string           // 任务描述
    context?: string              //
```
