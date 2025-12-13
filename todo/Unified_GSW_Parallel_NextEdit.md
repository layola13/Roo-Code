# GSW + SubAgent Parallel + Next Edit 统一架构设计

## 🎯 目标

将三个独立系统整合为一个协同工作的智能编程助手：

| 系统                  | 核心能力            | 整合价值                 |
| --------------------- | ------------------- | ------------------------ |
| **GSW**               | 三元记忆 + 向量搜索 | 为所有操作提供持久化知识 |
| **SubAgent Parallel** | 10并发 + 动态调度   | 并行执行多个编辑任务     |
| **Next Edit**         | 编辑链 + 渐进式引导 | 用户友好的多步骤编辑体验 |

---

## 📐 统一架构图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           用户请求 (User Request)                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Code Mode LLM (自动决策)                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  分析任务特征 → 选择执行策略：                                               │  │
│  │  • 单步简单任务 → 直接执行                                                  │  │
│  │  • 多步骤顺序任务 → Next Edit 模式                                          │  │
│  │  • 多步骤独立任务 → SubAgent Parallel + Next Edit 混合                       │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                    │                            │
          [多步骤顺序]                      [多步骤并行]
                    │                            │
                    ▼                            ▼
┌────────────────────────────┐    ┌────────────────────────────────────────────┐
│     NextEditService        │    │      ParallelSubagentManager              │
│  ┌──────────────────────┐  │    │  ┌──────────────────────────────────────┐  │
│  │ EditChain            │  │    │  │ TaskQueuePool (max 100+)              │  │
│  │ • 步骤1 → 步骤2 → ...│  │    │  │ ConcurrencyCtrl (max 10)              │  │
│  │ • Tab/Esc 渐进式     │  │    │  │ DynamicScheduler (完成即拉取)          │  │
│  └──────────────────────┘  │    │  └──────────────────────────────────────┘  │
└────────────────────────────┘    │                  │                         │
              │                   │      ┌───────────┼───────────────┐        │
              │                   │      ▼           ▼               ▼        │
              │                   │  ┌────────┐ ┌────────┐     ┌────────┐    │
              │                   │  │ Slot 1 │ │ Slot 2 │ ... │ Slot 10│    │
              │                   │  │NextEdit│ │NextEdit│     │NextEdit│    │
              │                   │  │ Chain  │ │ Chain  │     │ Chain  │    │
              │                   │  └────────┘ └────────┘     └────────┘    │
              │                   └────────────────────────────────────────────┘
              │                                      │
              └──────────────┬───────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       GSW DirectoryMemorySystem                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   interaction   │  │    reasoning    │  │    evolution    │                  │
│  │   (用户交互)     │  │   (LLM推理)     │  │   (代码演进)    │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  🔥 扩展: edit_chains 存入 reasoning (Next Edit 链持久化)                 │    │
│  │  🔥 扩展: parallel_sessions 存入 reasoning (并行会话历史)                 │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  GSWVectorMemoryStore (向量语义搜索)                                      │    │
│  │  • 检索相似编辑历史 → 指导 Next Edit 规划                                  │    │
│  │  • 检索并行执行模式 → 优化 SubAgent 调度                                   │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 四大协同点

### 1. 共享记忆层 (GSW as Foundation)

```typescript
// Task.ts 初始化时创建统一实例
class Task {
	private gswSystem: DirectoryMemorySystem
	private nextEditService: NextEditService
	private parallelManager: ParallelSubagentManager

	async initialize() {
		// 1. 初始化 GSW (核心)
		this.gswSystem = new DirectoryMemorySystem(workspacePath, config, embedder, vectorStore)

		// 2. 初始化 NextEdit (注入 GSW)
		this.nextEditService = new NextEditService(this.gswSystem, this.api)

		// 3. 初始化 ParallelManager (注入 GSW)
		this.parallelManager = new ParallelSubagentManager(this.api, this.gswSystem)
	}
}
```

### 2. 并行编辑链执行 (Parallel + Next Edit)

每个 SubAgent Slot 可以执行一个独立的编辑链：

```typescript
class ParallelSubagentManager {
	async runParallelEditChains(chains: EditChainSpec[]): Promise<ParallelEditResult> {
		// 1. 查询 GSW 获取相似历史模式
		const patterns = await this.gswSystem.queryMemory({
			query: chains.map((c) => c.taskDescription).join(" "),
			types: ["reasoning"],
			useVectorSearch: true,
		})

		// 2. 每个链分配一个 Slot 并行执行
		return this.runBatch(
			chains.map((chain) => ({
				id: chain.chainId,
				type: "next-edit-executor",
				editChain: chain,
			})),
		)
	}
}
```

### 3. LLM 自动决策框架

```typescript
// 统一执行策略 Prompt
const UNIFIED_EXECUTION_INSTRUCTIONS = `
## 任务执行策略选择

### 策略 1: 直接执行 (单文件)
### 策略 2: Next Edit 链 (多步骤顺序)
### 策略 3: 并行 + Next Edit (多步骤独立)

<spawn_parallel_edit_chains>
<task_description>为所有 Service 添加错误处理</task_description>
<chains>
[
  {"target_file": "AuthService.ts", "steps": [...]},
  {"target_file": "UserService.ts", "steps": [...]}
]
</chains>
</spawn_parallel_edit_chains>
`
```

### 4. 统一 UI

```
┌─────────────────────────────────────────────────────────────────────┐
│ 💻 Code Mode                                         Cost: $0.14    │
├─────────────────────────────────────────────────────────────────────┤
│ [🔵 Main] | [🔄 Auth ▓▓░] [✅ User] [⏳ Payment] | +2 in Queue      │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─ Next Edit Chain (3/5) ───────────────────────────────────────┐  │
│  │  ✓ 步骤1: 创建 ErrorHandler.ts                                │  │
│  │  ▶ 步骤2: 更新 AuthService.ts  ← [Tab 接受] [Esc 跳过]         │  │
│  │  ○ 步骤3: 更新 UserService.ts                                 │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 组件复用矩阵

| GSW 组件                   | NextEdit 使用 | Parallel 使用 |
| -------------------------- | ------------- | ------------- |
| `writeMemory`              | 保存编辑链    | 保存并行会话  |
| `queryMemory`              | 检索相似历史  | 优化调度策略  |
| `captureCodeEvolution`     | 学习成功模式  | -             |
| `captureWorkflowKnowledge` | 学习编辑模式  | 学习调度模式  |
| `GSWVectorMemoryStore`     | 语义搜索      | 语义搜索      |

---

## 📅 实施阶段 (共 3 周)

### Week 1: GSW 扩展 + Next Edit 核心

- 定义 NextEditMemory 类型
- 实现 NextEditService
- 实现 EditChainAnalyzer

### Week 2: 并行增强 + 整合

- 实现 ParallelSubagentManager
- 实现 ParallelEditChainExecutor
- 统一执行策略 Prompt

### Week 3: UI + 测试

- SubagentTabBar, SubagentTab
- NextEditPanel, EditStepCard
- UnifiedTaskView 整合

---

## 🔥 核心价值

**旧模式 (30+ 分钟)**: 用户 → AI → 改一个文件 → 确认 → 下一个...

**新模式 (3 分钟)**:

```
用户: "为所有 API 路由添加错误处理"
  → AI 分析 → 启动 10 个并行编辑链
  → [Slot 1] Tab, Tab, Tab ✓
  → [Slot 2] Tab, Tab, Tab ✓
  → ...完成
```

---

## ❓ 待确认

1. 并行粒度：一个文件 = 一个 Slot？
2. GSW 存储：编辑链存入 `reasoning/`？
3. 失败处理：自动重试还是通知用户？
4. 快捷键：Tab 是否与缩进冲突？
