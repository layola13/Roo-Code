# Roo Code 实现 Claude Code 风格子代理并行机制评估报告

## 1. 现有架构分析

### 1.1 当前子代理系统架构

Roo Code 已经拥有一个相对完善的子代理系统，位于 `src/core/subagent/` 目录下：

```
src/core/subagent/
├── ConversationController.ts    # 主控制器，协调所有子代理
├── executor/
│   ├── SubagentExecutor.ts      # 子代理执行器
│   └── SubagentInterface.ts     # 子代理接口定义
├── agents/
│   ├── ContextAnalyzerAgent.ts  # 上下文分析子代理
│   ├── MemoryExtractorAgent.ts  # 记忆提取子代理
│   ├── CodeSummarizerAgent.ts   # 代码总结子代理
│   └── JudgeAgent.ts            # 裁判子代理
├── queue/
│   └── CompressionQueue.ts      # 压缩队列（有限并发）
├── routing/
│   ├── RoutingEngine.ts         # 路由引擎
│   └── ExecutionScheduler.ts    # 执行调度器
├── monitoring/
│   └── PerformanceMonitor.ts    # 性能监控
└── types.ts                     # 类型定义
```

### 1.2 现有并行执行能力

| 功能           | 当前状态                | Claude Code 对比        |
| -------------- | ----------------------- | ----------------------- |
| 子代理并行执行 | ✅ 支持 (`Promise.all`) | ✅ 支持                 |
| 并发数限制     | ❌ 无限制               | 最多 10 个              |
| 自动队列机制   | ⚠️ 仅限压缩任务         | ✅ 全局队列             |
| 动态调度       | ❌ 批处理模式           | ✅ 任务完成即拉取       |
| 独立上下文隔离 | ⚠️ 部分支持             | ✅ 完整 200K 独立上下文 |
| 结果汇总机制   | ✅ 支持                 | ✅ 摘要返回             |
| 工具权限控制   | ❌ 无                   | ✅ 可配置               |
| 模型选择       | ❌ 统一模型             | ✅ 可指定不同模型       |

---

## 2. Claude Code 子代理机制核心要素

### 2.1 需要实现的核心功能

#### A. 并行上限与队列机制

- **硬性限制**: 最多 10 个并发子代理
- **自动队列**: 超出限制自动排队
- **动态调度**: 完成即拉取，无需等待批次

#### B. 执行模式

- **自动模式 (推荐)**: 系统自主决策并行级别
- **批处理模式**: 明确指定并行数量

#### C. 上下文隔离

- 每个子代理拥有独立的 200K token 上下文窗口
- 清洁环境启动，不继承主对话污染
- 仅返回摘要，非完整上下文

#### D. 资源控制

- 工具权限限制配置
- 模型选择 (Sonnet/Opus/Haiku)
- 权限模式 (permissionMode)

---

## 3. 实现方案设计

### 3.1 架构增强方案

```
┌─────────────────────────────────────────────────────────────┐
│                    ParallelSubagentManager                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  TaskQueuePool  │  │ ConcurrencyCtrl │  │ ContextPool │ │
│  │  (max 100+)     │  │  (max 10)       │  │  (isolated) │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘ │
│           │                    │                   │        │
│           └──────────┬─────────┘                   │        │
│                      ▼                             │        │
│  ┌─────────────────────────────────────────────────┴──────┐ │
│  │              DynamicScheduler                          │ │
│  │  • 完成即拉取 (不等待批次)                              │ │
│  │  • 优先级调度                                          │ │
│  │  • 故障恢复                                            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ SubagentSlot 1│    │ SubagentSlot 2│    │ SubagentSlot n│
│ (isolated ctx)│    │ (isolated ctx)│    │ (isolated ctx)│
│ [model: opus] │    │ [model: haiku]│    │ [model: ...]  │
│ [tools: [...]]│    │ [tools: [...]]│    │ [tools: [...]]│
└───────────────┘    └───────────────┘    └───────────────┘
```

### 3.2 新增核心组件

#### 3.2.1 `ParallelSubagentManager` - 并行子代理管理器

```typescript
// src/core/subagent/parallel/ParallelSubagentManager.ts

interface ParallelSubagentConfig {
	maxConcurrency: number // 默认 10
	maxQueueSize: number // 默认 100
	subagentTimeout: number // 单个子代理超时 (ms)
	dynamicScheduling: boolean // 启用动态调度
}

interface SubagentTask {
	id: string
	type: SubagentName
	priority: "high" | "medium" | "low"
	context: IsolatedContext
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
	private config: ParallelSubagentConfig

	async runSubagent(params: SubagentParams, config?: SubagentSlotConfig): Promise<SubagentResult>

	async runBatch(tasks: SubagentParams[], mode: "auto" | "batch" = "auto"): Promise<SubagentResult[]>

	private processQueue(): void // 动态调度
	private createIsolatedContext(): IsolatedContext
}
```

#### 3.2.2 `IsolatedContext` - 隔离上下文

```typescript
// src/core/subagent/parallel/IsolatedContext.ts

interface IsolatedContext {
	id: string
	tokenLimit: number // 200K
	messages: ApiMessage[] // 独立消息历史
	systemPrompt: string
	metadata: Record<string, any>
}

class ContextPool {
	private pool: IsolatedContext[] = []
	private maxSize: number = 10

	acquire(): IsolatedContext
	release(ctx: IsolatedContext): void
	reset(ctx: IsolatedContext): void
}
```

#### 3.2.3 `SubagentSlot` - 子代理槽位

```typescript
// src/core/subagent/parallel/SubagentSlot.ts

class SubagentSlot {
	readonly slotId: string
	private context: IsolatedContext
	private config: SubagentSlotConfig
	private apiHandler: ApiHandler

	async execute(task: SubagentTask): Promise<SubagentResult>

	// 生成摘要返回主代理
	private summarizeResult(fullResult: any): string
}
```

### 3.3 与现有系统集成

#### 3.3.1 修改 `Task.ts`

```typescript
// 在 Task 类中添加

class Task {
	// ... existing code ...

	private parallelManager?: ParallelSubagentManager

	// 新增方法：启动并行子代理
	async runParallelSubagents(
		tasks: SubagentParams[],
		options?: {
			mode?: "auto" | "batch"
			priority?: "high" | "medium" | "low"
		},
	): Promise<SubagentResult[]> {
		if (!this.parallelManager) {
			this.parallelManager = new ParallelSubagentManager(this.api, {
				maxConcurrency: 10,
				dynamicScheduling: true,
			})
		}

		return this.parallelManager.runBatch(tasks, options?.mode)
	}
}
```

#### 3.3.2 新增工具 `spawn_parallel_subagent`

```typescript
// src/core/tools/spawnParallelSubagentTool.ts

interface SpawnParallelSubagentParams {
	tasks: Array<{
		agent_name: string
		task: string
		context?: string
		model?: string
		tools?: string[]
	}>
	mode?: "auto" | "batch"
	max_concurrent?: number
}

export async function spawnParallelSubagentTool(
	cline: Task,
	block: SpawnParallelSubagentToolUse,
	// ... other params
): Promise<void>
```

---

## 4. 实现优先级与工作量估算

### 4.1 实现阶段

| 阶段       | 功能           | 工作量 | 优先级 |
| ---------- | -------------- | ------ | ------ |
| **阶段 1** | 并发限制队列   | 2-3 天 | 🔴 高  |
| **阶段 2** | 动态调度机制   | 2 天   | 🔴 高  |
| **阶段 3** | 独立上下文隔离 | 3-4 天 | 🔴 高  |
| **阶段 4** | 工具权限控制   | 2 天   | 🟡 中  |
| **阶段 5** | 模型选择支持   | 1 天   | 🟡 中  |
| **阶段 6** | UI 集成与监控  | 2-3 天 | 🟢 低  |
| **阶段 7** | 测试与优化     | 3 天   | 🔴 高  |

**总计**: 约 15-18 个工作日

### 4.2 风险与挑战

| 挑战       | 描述                    | 缓解策略                     |
| ---------- | ----------------------- | ---------------------------- |
| Token 消耗 | 多代理并行增加成本      | 实现智能调度，避免不必要并行 |
| API 限流   | 多并发可能触发限流      | 实现速率限制和指数退避       |
| 上下文管理 | 200K 独立上下文内存占用 | 实现上下文池复用机制         |
| 结果聚合   | 多结果合并逻辑复杂      | 标准化摘要格式               |

---

## 5. 与现有功能的关系

### 5.1 现有组件复用

| 组件                     | 复用方式                       |
| ------------------------ | ------------------------------ |
| `SubagentExecutor`       | 作为底层执行器，包装在 Slot 内 |
| `ConversationController` | 可选用于单个 Slot 的上下文管理 |
| `CompressionQueue`       | 参考其队列实现，扩展为通用队列 |
| `PerformanceMonitor`     | 扩展监控并行执行指标           |

### 5.2 需要修改的现有代码

1. **`useSubagentTool.ts`**: 增加并行执行选项
2. **`Task.ts`**: 集成 `ParallelSubagentManager`
3. **`types.ts`**: 扩展子代理类型定义
4. **`prompts/tools/`**: 添加新工具提示

---

## 6. 建议的实现路线

### 方案 A: 渐进式实现 (推荐)

```
Week 1:
  ├── 实现 ParallelSubagentManager 核心
  ├── 实现并发限制 (10 slots)
  └── 实现基础队列

Week 2:
  ├── 实现动态调度 (完成即拉取)
  ├── 实现 IsolatedContext
  └── 实现 ContextPool

Week 3:
  ├── 实现工具权限控制
  ├── 实现模型选择
  └── 集成测试
```

### 方案 B: 最小可行产品 (MVP)

仅实现核心功能：

- 10 并发限制
- 自动队列
- 基础隔离

可在 5-7 个工作日内完成。

---

## 7. 结论

Roo Code 已有较好的子代理基础架构，实现 Claude Code 风格的并行机制是**可行且有价值的**。建议采用渐进式实现方案，优先实现核心的并发控制和队列机制，再逐步添加高级功能。

### 关键收益

1. **性能提升**: 45 分钟任务可缩短到 10 分钟
2. **资源优化**: 智能调度避免浪费
3. **用户体验**: 无需手动管理并发
4. **扩展性**: 支持 100+ 任务队列

---

## 8. UI 设计方案 - 子代理 Tab 标签页

### 8.1 设计原型

完整的 React UI 原型实现见: [subagentParaller_ui.md](file:///home/sonygod/projects/Roo-Code/todo/subagentParaller_ui.md)

### 8.2 核心布局

```
┌─────────────────────────────────────────────────────────────────────┐
│  💻 Code Mode                                         Cost: $0.14    │
│  Tokens: 4.2k / 1.1k   Context: 12%   Workers: 2/10                 │
├─────────────────────────────────────────────────────────────────────┤
│ ◀ [🔵 Main] | [🔄 ContextAnalyzer ▓▓░] [✅ SecurityScanner] +3 ▶   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─ Isolated Context Banner ─────────────────────────────────────┐  │
│  │  🔄 ContextAnalyzer Context                                    │  │
│  │  ID: agent-1 • claude-3-haiku     Isolated Memory: 200k       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  [Agent thinking logs and messages...]                               │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  Context: Isolated | Parallel Mode: Auto (Max 10)           [Send]  │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.3 关键组件实现

#### SubagentTabBar 特性

- ✅ **横向滚动**: 左右箭头按钮，隐藏滚动条
- ✅ **Main Tab 分隔**: 主任务 Tab 与子代理 Tab 之间有分隔线
- ✅ **队列指示器**: 右侧显示 "+N in Queue" 并带脉冲动画

#### SubagentTab 特性

- ✅ **状态图标**: 🔄 running / ✅ completed / ⏳ queued / ❌ failed
- ✅ **内嵌进度条**: 仅运行中 Tab 显示 2px 进度条
- ✅ **模型徽章**: 显示使用的模型 (如 claude-3-haiku)
- ✅ **关闭动画**: 完成后 3 秒自动淡出 + 向上滑出效果#

#### 隔离上下文视图

- ✅ **Context Banner**: 切换到子代理时显示蓝色渐变横幅
- ✅ **Memory 标识**: 显示 "Isolated Memory: 200k"
- ✅ **独立日志流**: 每个子代理有独立的消息历史

### 8.4 调度器模拟逻辑

```typescript
// 核心状态流转 (来自原型 line 328-399)
useEffect(() => {
	const interval = setInterval(() => {
		setSubagents((currentAgents) => {
			let runningCount = currentAgents.filter((a) => a.status === "running").length

			return currentAgents.map((agent) => {
				// 1. queued → running (如果有空闲槽位)
				if (agent.status === "queued" && runningCount < MAX_CONCURRENCY) {
					runningCount++
					return { ...agent, status: "running" }
				}

				// 2. running → 更新进度 → completed
				if (agent.status === "running") {
					const newProgress = agent.progress + 2.5
					if (newProgress >= 100) {
						return { ...agent, status: "completed", progress: 100 }
					}
					return { ...agent, progress: newProgress }
				}

				return agent
			})
		})
	}, 100)
	return () => clearInterval(interval)
}, [])
```

### 8.5 原型文件结构

| 组件               | 行号    | 功能                                        |
| ------------------ | ------- | ------------------------------------------- |
| `SubagentTabBar`   | 79-202  | Tab 容器 + 滚动控制                         |
| `SubagentTab`      | 208-303 | 单个 Tab + 状态图标 + 自动关闭              |
| `RooCodeSimulator` | 311-640 | 主界面 + 调度器模拟                         |
| 类型定义           | 25-43   | `AgentStatus`, `SubagentInfo`, `LogMessage` |

### 8.6 实现工作量 (基于原型)

| 组件                 | 天数   | 说明                   |
| -------------------- | ------ | ---------------------- |
| `SubagentTabBar.tsx` | 0.5 天 | 原型已实现 80%         |
| `SubagentTab.tsx`    | 0.5 天 | 原型已实现 90%         |
| Tailwind → CSS 转换  | 0.5 天 | 转换为 VSCode 兼容样式 |
| ChatView 集成        | 1 天   | 状态管理 + 消息路由    |
| 后端消息协议         | 0.5 天 | ExtensionMessage 扩展  |
| 测试                 | 1 天   | 单元测试 + E2E         |

**UI 总计**: 约 **4 个工作日** (比预估减少 0.5 天，因原型已完成)

---

## 9. 实现方式分析：现有 Code 模式 vs 新增 Parallel 模式

### 9.1 现有模式架构分析

Roo Code 内置 5 种模式 (`packages/types/src/mode.ts`)：

| 模式            | Slug           | 工具组                            | 职责     |
| --------------- | -------------- | --------------------------------- | -------- |
| 🏗️ Architect    | `architect`    | read, edit(仅.md), browser, mcp   | 规划设计 |
| 💻 Code         | `code`         | read, edit, browser, command, mcp | 编写代码 |
| ❓ Ask          | `ask`          | read, browser, mcp                | 问答解释 |
| 🪲 Debug        | `debug`        | read, edit, browser, command, mcp | 调试修复 |
| 🪃 Orchestrator | `orchestrator` | (无)                              | 任务协调 |

### 9.2 方案对比

#### 方案 A: 在现有 Code 模式中实现

```diff
// mode.ts - 无需修改
{
  slug: "code",
  name: "💻 Code",
  groups: ["read", "edit", "browser", "command", "mcp"],
+ // 并行功能通过设置开关控制
}
```

**优点**:
| 优点 | 说明 |
|------|------|
| ✅ 无缝升级 | 用户无需学习新模式 |
| ✅ 设置集中 | 并行开关在 Settings 中控制 |
| ✅ 减少认知负担 | 不增加模式选择复杂度 |
| ✅ 渐进式启用 | 可通过 feature flag 逐步推出 |

**缺点**:
| 缺点 | 说明 |
|------|------|
| ❌ 功能混杂 | Code 模式职责变重 |
| ❌ 系统提示膨胀 | system prompt 更臃肿 |
| ❌ 调试困难 | 问题定位更复杂 |

---

#### 方案 B: 新增独立 Parallel 模式

```typescript
// 新模式定义
{
  slug: "parallel",
  name: "⚡ Parallel Agent",
  roleDefinition: "You are Roo, a parallel task coordinator that executes multiple sub-agents concurrently...",
  whenToUse: "Use when you need to parallelize complex tasks across multiple agents for faster execution.",
  description: "Execute tasks in parallel with up to 10 concurrent agents",
  groups: ["read", "edit", "browser", "command", "mcp"],
  customInstructions: `
    You have access to parallel sub-agent execution:
    - Maximum 10 concurrent agents
    - Automatic queue management
    - Each agent has isolated 200K context
    ...
  `
}
```

**优点**:
| 优点 | 说明 |
|------|------|
| ✅ 职责清晰 | 单一模式单一职责 |
| ✅ 独立系统提示 | 并行相关指令集中 |
| ✅ 易于测试 | 模式边界明确 |
| ✅ 用户意图明确 | 选择此模式即表示需要并行 |

**缺点**:
| 缺点 | 说明 |
|------|------|
| ❌ 学习成本 | 用户需了解何时使用 |
| ❌ 模式切换 | 需要手动或自动切换 |
| ❌ 与 Orchestrator 重叠 | 协调职责有交叉 |

---

#### 方案 C: 增强 Orchestrator 模式 (推荐 ✅)

```typescript
// 增强现有 Orchestrator
{
  slug: "orchestrator",
  name: "🪃 Orchestrator",  // 保持不变
  roleDefinition: "You are Roo, a strategic workflow orchestrator who coordinates complex tasks by delegating them to appropriate specialized modes. You can execute up to 10 sub-agents in parallel...",
  groups: ["read", "edit", "browser", "command", "mcp"],  // 添加工具组
  customInstructions: `
    # 并行执行能力
    You have access to parallel sub-agent execution:
    - spawn_parallel_subagent: 启动并行子代理 (最多10个)
    - 动态队列管理：超出限制自动排队
    - 独立上下文隔离：每个子代理 200K 上下文

    # 执行策略
    1. 分析任务，识别可并行的子任务
    2. 使用 spawn_parallel_subagent 启动并行执行
    3. 监控各子代理进度
    4. 汇总结果返回主任务
    ...
  `
}
```

### 9.3 推荐方案：增强 Orchestrator + 可选开关

**推荐理由**:

1. **语义匹配**: Orchestrator 本身就是"任务协调者"，并行执行是其自然扩展
2. **无需新增模式**: 减少用户认知负担
3. **可控启用**: 通过设置开关决定是否启用并行能力
4. **向后兼容**: 不启用并行时，Orchestrator 行为不变

**实现架构**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户请求                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestrator 模式                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            ParallelExecutionEnabled? (设置开关)          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                   │                           │                  │
│            [启用并行]                    [禁用/默认]             │
│                   ▼                           ▼                  │
│  ┌─────────────────────────┐   ┌─────────────────────────────┐  │
│  │ spawn_parallel_subagent │   │     new_task (顺序)         │  │
│  │ (最多10个并发)           │   │   (原有子任务机制)           │  │
│  └─────────────────────────┘   └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.4 设置界面设计

在 Settings > Orchestrator 下添加：

```
┌─────────────────────────────────────────────────────────────────┐
│  🪃 Orchestrator Mode Settings                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ☑️ Enable Parallel Execution                                    │
│     Allow Orchestrator to run up to 10 sub-agents in parallel   │
│                                                                  │
│  Max Concurrent Agents: [10 ▼]                                   │
│     Limit the maximum number of concurrent sub-agents           │
│                                                                  │
│  Auto-Close Completed Tabs: [After 3 seconds ▼]                  │
│     When to close tabs of completed sub-agents                  │
│                                                                  │
│  Default Sub-Agent Model: [Same as main ▼]                       │
│     Model to use for sub-agents (or inherit from main task)     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.5 总结建议

| 方案                        | 推荐度     | 理由                            |
| --------------------------- | ---------- | ------------------------------- |
| **方案 A (现有 Code 模式)** | ⭐⭐⭐⭐⭐ | **用户选择** - LLM 自主决策并行 |
| 方案 B (新增 Parallel 模式) | ⭐⭐       | 增加用户认知负担                |
| 方案 C (增强 Orchestrator)  | ⭐⭐⭐⭐   | 语义匹配但需切换模式            |

**最终决定**: 采用 **方案 A - 在 Code 模式中实现**，由 LLM 自动判断是否适合并行执行并分配任务。

---

## 10. Code 模式并行实现详细方案

### 10.1 核心设计理念

**LLM 自主决策**：让大模型自行判断当前任务是否适合并行执行，无需用户手动切换模式。

```
用户请求 ──→ Code 模式 LLM ──→ 分析任务特征
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              [顺序执行]      [部分并行]       [全面并行]
              (简单任务)      (混合任务)       (可拆分任务)
                    │               │               │
                    └───────────────┴───────────────┘
                                    │
                                    ▼
                          ParallelSubagentManager
```

### 10.2 并行决策触发条件

LLM 应在以下场景自动启用并行执行：

| 场景               | 触发条件               | 并行策略           |
| ------------------ | ---------------------- | ------------------ |
| **多文件独立操作** | 修改多个互不依赖的文件 | 每个文件一个子代理 |
| **批量代码分析**   | 分析大型代码库结构     | 按模块/目录并行    |
| **多组件重构**     | 重构多个独立组件       | 每个组件一个子代理 |
| **测试执行**       | 运行多个独立测试套件   | 并行测试执行       |
| **文档生成**       | 为多个模块生成文档     | 并行文档生成       |

### 10.3 新增工具定义

#### 10.3.1 `spawn_parallel_tasks` 工具

```typescript
// src/core/tools/spawnParallelTasksTool.ts

interface SpawnParallelTasksParams {
	tasks: Array<{
		id: string // 任务ID
		description: string // 任务描述
		context?: string // 可选附加上下文
		target_files?: string[] // 相关文件列表
		priority?: "high" | "medium" | "low"
	}>
	execution_mode?: "auto" | "wait_all" | "stream_results"
	max_concurrent?: number // 默认 10
}

// 工具提示词
const SPAWN_PARALLEL_TASKS_PROMPT = `
## spawn_parallel_tasks

Use this tool when you identify multiple independent subtasks that can be executed concurrently.

### When to Use
- Multiple files need independent modifications
- Code analysis across different modules
- Batch operations on unrelated components
- Tasks with no data dependencies between them

### Parameters
- tasks: Array of task definitions
  - id: Unique identifier for tracking
  - description: Clear, actionable task description
  - context: Additional context from parent task
  - target_files: Files this task will operate on
  - priority: Execution priority (high > medium > low)
- execution_mode: 
  - 'auto': System decides optimal execution (recommended)
  - 'wait_all': Wait for all tasks to complete
  - 'stream_results': Stream results as they complete
- max_concurrent: Maximum parallel agents (1-10, default: 10)

### Example
<spawn_parallel_tasks>
<tasks>
[
  {"id": "task-1", "description": "Add error handling to AuthService", "target_files": ["src/services/AuthService.ts"]},
  {"id": "task-2", "description": "Add error handling to UserService", "target_files": ["src/services/UserService.ts"]},
  {"id": "task-3", "description": "Add error handling to PaymentService", "target_files": ["src/services/PaymentService.ts"]}
]
</tasks>
<execution_mode>auto</execution_mode>
</spawn_parallel_tasks>
`
```

### 10.4 System Prompt 增强

在 Code 模式的 system prompt 中添加并行执行指导：

```typescript
// src/core/prompts/sections/parallel-execution.ts

export const PARALLEL_EXECUTION_INSTRUCTIONS = `
## 并行任务执行能力

你具备并行执行多个子任务的能力。当你识别出以下情况时，应考虑使用 spawn_parallel_tasks 工具：

### 适合并行的场景
1. **多文件独立修改**: 需要对多个互不依赖的文件进行类似操作
2. **批量分析**: 需要分析项目中多个独立模块
3. **重复性任务**: 对多个类似组件执行相同类型的操作
4. **独立测试**: 需要运行多个互不干扰的测试

### 不适合并行的场景
1. **存在依赖关系**: 后续任务依赖前一个任务的结果
2. **共享状态**: 多个任务操作同一个文件或资源
3. **顺序逻辑**: 任务必须按特定顺序执行
4. **简单任务**: 单一文件的简单修改

### 并行执行规则
- 最多 10 个并发子代理
- 每个子代理拥有独立的上下文窗口
- 超出限制的任务自动排队
- 结果会汇总返回给你

### 决策流程
1. 分析用户请求，识别子任务
2. 评估子任务之间的依赖关系
3. 对于独立的子任务，使用 spawn_parallel_tasks
4. 对于有依赖的子任务，按顺序执行
`
```

### 10.5 工具组更新

无需修改 Code 模式的工具组，只需在工具列表中添加新工具：

```typescript
// src/shared/tools.ts

export const ALWAYS_AVAILABLE_TOOLS = [
	// ... existing tools
	"spawn_parallel_tasks", // 新增
] as const
```

### 10.6 LLM 决策示例

**用户请求**:

> "为 src/services/ 目录下的所有 Service 文件添加统一的错误处理"

**LLM 分析过程**:

```
思考：
1. 用户需要修改多个 Service 文件
2. 这些文件相互独立，没有依赖关系
3. 可以并行处理以提高效率

让我先检查有哪些 Service 文件...
(使用 list_files 工具)

发现 5 个 Service 文件:
- AuthService.ts
- UserService.ts
- PaymentService.ts
- NotificationService.ts
- AnalyticsService.ts

这些修改相互独立，我将使用并行执行：
```

**LLM 输出**:

```xml
<spawn_parallel_tasks>
<tasks>
[
  {"id": "auth", "description": "为 AuthService.ts 添加 try-catch 错误处理和统一错误日志", "target_files": ["src/services/AuthService.ts"]},
  {"id": "user", "description": "为 UserService.ts 添加 try-catch 错误处理和统一错误日志", "target_files": ["src/services/UserService.ts"]},
  {"id": "payment", "description": "为 PaymentService.ts 添加 try-catch 错误处理和统一错误日志", "target_files": ["src/services/PaymentService.ts"]},
  {"id": "notification", "description": "为 NotificationService.ts 添加 try-catch 错误处理和统一错误日志", "target_files": ["src/services/NotificationService.ts"]},
  {"id": "analytics", "description": "为 AnalyticsService.ts 添加 try-catch 错误处理和统一错误日志", "target_files": ["src/services/AnalyticsService.ts"]}
]
</tasks>
<execution_mode>auto</execution_mode>
</spawn_parallel_tasks>
```

### 10.7 UI 交互流程

```
┌─────────────────────────────────────────────────────────────────────┐
│  💻 Code Mode                                         Cost: $0.12    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User: 为所有 Service 文件添加错误处理                                │
│                                                                      │
│  ┌─ Roo 分析中... ─────────────────────────────────────────────────┐ │
│  │ 检测到 5 个独立文件，启动并行执行...                             │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│ [🔵 Main] [🔄 Auth ▓▓▓░░] [🔄 User ▓▓░░░] [🔄 Payment ▓░░░░] +2    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ⚡ 并行执行中 (3/5 运行, 2 队列)                                    │
│                                                                      │
│  Auth: 正在添加 try-catch 块...                                      │
│  User: 正在分析现有错误处理...                                       │
│  Payment: 等待开始...                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.8 实现检查清单

#### 阶段 1: 核心并行机制 (5 天)

- [ ] 实现 `ParallelSubagentManager`
- [ ] 实现并发限制 (10 slots)
- [ ] 实现自动队列机制
- [ ] 实现动态调度 (完成即拉取)

#### 阶段 2: 工具和Prompt (3 天)

- [ ] 实现 `spawnParallelTasksTool.ts`
- [ ] 添加工具提示词到 Code 模式
- [ ] 更新 system prompt 添加并行指导
- [ ] 添加工具到 ALWAYS_AVAILABLE_TOOLS

#### 阶段 3: 上下文隔离 (3 天)

- [ ] 实现 `IsolatedContext` 类
- [ ] 实现 `ContextPool` 复用机制
- [ ] 实现结果摘要汇总

#### 阶段 4: UI 集成 (4.5 天)

- [ ] 实现 `SubagentTabBar` 组件
- [ ] 实现 `SubagentTab` 组件
- [ ] 集成到 `ChatView.tsx`
- [ ] 实现自动关闭动画
- [ ] 添加后端消息协议

#### 阶段 5: 测试与优化 (3 天)

- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能优化
- [ ] 文档更新

**总计**: 约 18.5 个工作日

---

## 11. 下一步行动

1. ✅ 确认实现方式：在 Code 模式中实现，LLM 自主决策
2. 创建详细技术规格文档
3. 开始阶段 1: 核心并行机制实现
4. 设计 `spawn_parallel_tasks` 工具 API
