# Next Edit 设计原理文档

## 1. 设计背景与动机

### 1.1 当前 AI 编程助手的痛点

传统的对话式 AI 编程助手存在以下问题：

```
用户: "重构这个模块，添加错误处理"
        │
        ▼
┌─────────────────────────────────────────┐
│  AI 生成一大段代码                        │
│  用户需要：                               │
│  • 理解全部内容                           │
│  • 手动应用到多个文件                      │
│  • 确认每处修改是否正确                    │
│  • 重复对话处理遗漏                        │
└─────────────────────────────────────────┘
        │
        ▼
    效率低，容易出错，用户疲劳
```

### 1.2 Augment Code 的 Next Edit 创新

Augment Code 通过 **Next Edit** 解决了这个问题：

| 传统模式     | Next Edit 模式       |
| ------------ | -------------------- |
| 一次生成全部 | 分步骤渐进引导       |
| 用户手动定位 | 自动跳转到下一编辑点 |
| 无明确进度   | 可视化编辑链进度     |
| 难以回退     | 可跳过/修改任意步骤  |
| 无历史学习   | 学习并复用编辑模式   |

---

## 2. 核心设计原则

### 2.1 渐进式编辑 (Progressive Editing)

**原则**：将复杂任务拆解为可管理的小步骤，用户逐一确认。

```
大任务
    │
    ▼
┌─────────────────────────────────────┐
│           EditChain                  │
│  ┌─────────┐  ┌─────────┐  ┌─────┐ │
│  │ Step 1  │→ │ Step 2  │→ │ ... │ │
│  │ (确认)  │  │ (确认)  │  │     │ │
│  └─────────┘  └─────────┘  └─────┘ │
└─────────────────────────────────────┘
```

**好处**：

- 🎯 **聚焦**：用户一次只关注一处修改
- 🔍 **可审查**：每步都可以详细检查
- ↩️ **可回退**：错误步骤不影响后续
- 📊 **可追踪**：清晰的完成进度

### 2.2 预测式生成 (Predictive Generation)

**原则**：在用户审阅当前步骤时，后台预生成下一步骤。

```
┌─────────────────────────────────────────────┐
│                   时间线                      │
├─────────────────────────────────────────────┤
│                                              │
│  用户审阅 Step 1    用户审阅 Step 2          │
│  ████████████████    ████████████████        │
│                                              │
│  后台生成 Step 2    后台生成 Step 3          │
│      ▓▓▓▓▓▓▓▓            ▓▓▓▓▓▓▓▓           │
│                                              │
│  ← 零等待切换 →    ← 零等待切换 →            │
└─────────────────────────────────────────────┘
```

**实现**：

```typescript
class NextEditService {
  private prefetchQueue: EditStep[] = []

  async acceptEdit(step: EditStep) {
    // 用户接受当前步骤
    await this.applyEdit(step)

    // 返回预取的下一步（无需等待）
    return this.prefetchQueue.shift()
  }

  private async prefetchNextStep() {
    // 后台异步生成，不阻塞用户
    const nextStep = await this.generateStepCode(...)
    this.prefetchQueue.push(nextStep)
  }
}
```

### 2.3 上下文隔离 (Context Isolation)

**原则**：每个编辑步骤有独立的上下文，避免污染。

```
┌─────────────────────────────────────────────┐
│              主对话上下文                     │
│  [用户请求] [历史消息] [项目信息]             │
└─────────────────────────────────────────────┘
         │
         ▼ 派生
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Step 1  │  │ Step 2  │  │ Step 3  │
│ Context │  │ Context │  │ Context │
│ (隔离)  │  │ (隔离)  │  │ (隔离)  │
└─────────┘  └─────────┘  └─────────┘
     │            │            │
     ▼            ▼            ▼
  只包含       只包含       只包含
  相关文件     相关文件     相关文件
```

**好处**：

- 减少 token 消耗（每步只加载相关文件）
- 避免上下文污染
- 支持并行执行

### 2.4 模式学习 (Pattern Learning)

**原则**：从成功的编辑链中提取可复用模式。

```
编辑链 1: "添加日志到 AuthService"
  Step 1: 导入 logger
  Step 2: 添加函数入口日志
  Step 3: 添加函数出口日志
  Step 4: 添加错误日志
  ✅ 完成，保存模式
         │
         ▼
┌─────────────────────────────────────┐
│      GSW Reasoning Memory           │
│  ┌─────────────────────────────┐    │
│  │ Pattern: "添加日志"          │    │
│  │ Steps: [导入, 入口, 出口, 错误]│    │
│  │ Success Rate: 100%          │    │
│  │ Files: *Service.ts          │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
         │
         ▼
编辑链 2: "添加日志到 UserService"
  → 自动参考模式，生成相似步骤
```

---

## 3. 数据模型设计

### 3.1 核心实体

```typescript
/**
 * 编辑步骤 - 最小编辑单元
 */
interface EditStep {
	// 标识
	index: number // 步骤序号
	stepId: string // 唯一ID

	// 位置
	filePath: string // 目标文件
	startLine: number // 起始行
	endLine: number // 结束行

	// 内容
	originalCode: string // 原始代码
	suggestedCode: string // 建议代码
	description: string // 编辑描述（给用户看）

	// 类型
	editType: "insert" | "replace" | "delete" | "refactor"

	// 依赖（可选）
	dependsOn?: string[] // 依赖的步骤ID

	// 状态
	status: "pending" | "accepted" | "rejected" | "modified"
	confidence: number // 0-1 置信度

	// 用户反馈
	userModifiedCode?: string // 用户修改后的代码
	rejectionReason?: string // 拒绝原因
}

/**
 * 编辑链 - 关联的步骤序列
 */
interface EditChain {
	// 标识
	chainId: string
	sessionId: string // 所属会话

	// 任务
	taskDescription: string // 用户原始请求
	taskIntent: string // 提取的意图（用于向量搜索）

	// 步骤
	steps: EditStep[]
	currentIndex: number // 当前进度

	// 文件
	affectedFiles: string[]

	// 时间
	createdAt: string
	updatedAt: string
	completedAt?: string

	// 状态
	status: "planning" | "active" | "completed" | "paused" | "abandoned"

	// 执行模式
	executionMode: "sequential" | "parallel"
	parallelSessionId?: string // 如果是并行执行
}

/**
 * 编辑模式 - 从成功链中提取的可复用知识
 */
interface EditPattern {
	patternId: string

	// 匹配条件
	taskPatterns: string[] // 任务描述正则
	filePatterns: string[] // 文件名模式 (e.g., "*Service.ts")

	// 模式内容
	stepTemplates: Array<{
		editType: EditStep["editType"]
		descriptionTemplate: string
		codeTransform?: string // 代码转换逻辑
	}>

	// 统计
	usageCount: number
	successRate: number
	lastUsedAt: string
}
```

### 3.2 与 GSW 的映射

```
┌─────────────────────────────────────────────────┐
│               GSW Memory Types                   │
├─────────────────────────────────────────────────┤
│                                                  │
│  interaction/                                    │
│  └── 用户请求 → 触发 EditChain 创建              │
│                                                  │
│  reasoning/                                      │
│  ├── EditChain 数据 (as NextEditMemory)         │
│  ├── EditPattern 模式 (as WorkflowKnowledge)    │
│  └── 步骤决策记录                                │
│                                                  │
│  evolution/                                      │
│  └── 每个 EditStep 完成后的代码演进              │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 4. 执行流程设计

### 4.1 编辑链生命周期

```
              ┌─────────────────────────────────────────────────────────────┐
              │                        用户请求                              │
              └─────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
              ┌─────────────────────────────────────────────────────────────┐
              │                    1️⃣ 任务分析阶段                          │
              │  • 解析用户意图                                              │
              │  • 查询 GSW 相似历史                                         │
              │  • 识别目标文件                                              │
              └─────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
              ┌─────────────────────────────────────────────────────────────┐
              │                    2️⃣ 计划生成阶段                          │
              │  • LLM 生成编辑计划                                          │
              │  • 注入历史模式上下文                                         │
              │  • 分析步骤依赖关系                                           │
              │  • 决定执行模式（顺序/并行）                                   │
              └─────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
              ┌─────────────────────────────────────────────────────────────┐
              │                    3️⃣ 执行阶段                              │
              │                                                              │
              │   ┌─────────┐    ┌─────────┐    ┌─────────┐                │
              │   │ Step N  │ →  │ Step N+1│ →  │  ...    │                │
              │   └────┬────┘    └────┬────┘    └─────────┘                │
              │        │              │                                      │
              │   [用户操作]     [后台预取]                                   │
              │   • Tab 接受                                                 │
              │   • Esc 跳过                                                 │
              │   • 修改后接受                                               │
              └─────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
              ┌─────────────────────────────────────────────────────────────┐
              │                    4️⃣ 完成阶段                              │
              │  • 生成编辑链总结                                            │
              │  • 提取成功模式 → GSW                                        │
              │  • 更新统计数据                                              │
              └─────────────────────────────────────────────────────────────┘
```

### 4.2 单步执行流程

```typescript
async function executeStep(step: EditStep): Promise<StepResult> {
	// 1. 展示给用户
	await ui.showEditPreview(step)

	// 2. 等待用户操作
	const action = await ui.waitForUserAction()

	switch (action.type) {
		case "accept":
			// 直接应用
			await applyEdit(step.filePath, step.suggestedCode)
			step.status = "accepted"
			break

		case "modify":
			// 应用用户修改版本
			await applyEdit(step.filePath, action.modifiedCode)
			step.userModifiedCode = action.modifiedCode
			step.status = "modified"
			break

		case "reject":
			// 跳过
			step.status = "rejected"
			step.rejectionReason = action.reason
			break
	}

	// 3. 记录到 GSW
	await gswCapture.captureStepExecution(step)

	// 4. 触发下一步预取
	prefetchNextStep(chain, step.index + 1)

	return { success: true, step }
}
```

---

## 5. 与并行执行的协同

### 5.1 三种执行模式

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         执行模式决策树                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                       检测任务特征 │
                                   ▼
                    ┌──────────────────────────────┐
                    │     涉及多少个独立文件？       │
                    └──────────────────────────────┘
                         /         |          \
                        /          |           \
                    1个         2-3个         4+个
                      │            │             │
                      ▼            ▼             ▼
              ┌───────────┐ ┌───────────┐ ┌───────────┐
              │   直接    │ │ 顺序链    │ │ 并行链    │
              │   执行    │ │ (Next Edit)│ │ (Parallel │
              │           │ │           │ │ + Next    │
              │           │ │           │ │   Edit)   │
              └───────────┘ └───────────┘ └───────────┘
```

### 5.2 并行编辑链架构

```
用户: "为所有 Service 添加日志"
              │
              ▼
     ┌─────────────────────────────────────────────┐
     │        ParallelSubagentManager              │
     │  ┌─────────────────────────────────────┐    │
     │  │         DynamicScheduler            │    │
     │  │  (完成即拉取，最多 10 并发)          │    │
     │  └─────────────────────────────────────┘    │
     └─────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   ┌─────────┐       ┌─────────┐       ┌─────────┐
   │ Slot 1  │       │ Slot 2  │       │ Slot 3  │
   │ Auth    │       │ User    │       │ Payment │
   │ Service │       │ Service │       │ Service │
   └────┬────┘       └────┬────┘       └────┬────┘
        │                 │                 │
        ▼                 ▼                 ▼
   ┌─────────┐       ┌─────────┐       ┌─────────┐
   │EditChain│       │EditChain│       │EditChain│
   │ Step 1  │       │ Step 1  │       │ Step 1  │
   │ Step 2  │       │ Step 2  │       │ Step 2  │
   │ ...     │       │ ...     │       │ ...     │
   └─────────┘       └─────────┘       └─────────┘
        │                 │                 │
        └─────────────────┴─────────────────┘
                          │
                          ▼
              ┌─────────────────────────────┐
              │     统一 UI 展示             │
              │ [Main] [Auth▓▓] [User▓░] +1 │
              └─────────────────────────────┘
```

### 5.3 并行 Slot 与 EditChain 的关系

```typescript
interface ParallelSlot {
	slotId: string

	// 隔离上下文
	context: IsolatedContext

	// 内部运行一个完整的 EditChain
	editChain: EditChain

	// Slot 状态 (tab 显示用)
	status: "queued" | "running" | "completed" | "failed"

	// 当前正在执行的步骤
	currentStep: EditStep | null
}

// 用户可以：
// 1. 点击 Tab 切换到特定 Slot
// 2. 在该 Slot 的 EditChain 中 Tab/Esc 操作步骤
// 3. 或者让所有 Slot 自动执行（无需逐步确认）
```

---

## 6. UI 交互设计

### 6.1 视觉层次

```
┌─────────────────────────────────────────────────────────────────────┐
│ 💻 Code Mode                                         Cost: $0.14    │
│ Tokens: 4.2k/1.1k    Context: 12%    Workers: 3/10                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🔹 Layer 1: Parallel Slot Tabs (如果有并行任务)                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ [🔵 Main] | [🔄 Auth ▓▓░] [✅ User] [⏳ Payment] | +2 Queue  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  🔹 Layer 2: Edit Chain Progress (当前 Slot 的链进度)                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 编辑链进度 (3/5)                                               │   │
│  │ ✓ 1. 导入 logger 模块                                         │   │
│  │ ✓ 2. 添加构造函数日志                                          │   │
│  │ ▶ 3. 添加方法入口日志 ← 当前                                    │   │
│  │ ○ 4. 添加错误处理日志                                          │   │
│  │ ○ 5. 更新测试文件                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  🔹 Layer 3: Current Step Card (当前步骤详情)                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 📝 Step 3: 添加方法入口日志                                     │   │
│  │ 文件: src/services/AuthService.ts  行: 45-52                   │   │
│  │                                                                │   │
│  │ ┌─ Diff ─────────────────────────────────────────────────┐    │   │
│  │ │ - async login(username: string, password: string) {    │    │   │
│  │ │ + async login(username: string, password: string) {    │    │   │
│  │ │ +   this.logger.info('Login attempt', { username });   │    │   │
│  │ └────────────────────────────────────────────────────────┘    │   │
│  │                                                                │   │
│  │         [✓ 接受 Tab]    [✏️ 修改]    [✗ 跳过 Esc]              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  💬 Chat Input...                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 快捷键设计

| 快捷键             | 功能               | 作用域    |
| ------------------ | ------------------ | --------- |
| `Tab`              | 接受当前步骤       | Step Card |
| `Esc`              | 跳过当前步骤       | Step Card |
| `Cmd/Ctrl + E`     | 进入编辑模式       | Step Card |
| `Cmd/Ctrl + Enter` | 保存修改并接受     | 编辑模式  |
| `Cmd/Ctrl + [1-9]` | 切换到第 N 个 Slot | Tab Bar   |
| `Cmd/Ctrl + ← →`   | 切换 Slot          | Tab Bar   |

### 6.3 状态指示器

```
Slot 状态图标:
  ⏳ queued    - 黄色时钟，等待执行
  🔄 running   - 蓝色旋转，正在执行
  ✅ completed - 绿色勾选，已完成
  ❌ failed    - 红色叉，执行失败

Step 状态图标:
  ○ pending   - 空心圆，待执行
  ▶ current   - 实心箭头，当前步骤
  ✓ accepted  - 绿色勾，已接受
  ✗ rejected  - 红色叉，已跳过
  ✎ modified  - 铅笔图标，已修改后接受
```

---

## 7. 错误处理设计

### 7.1 步骤失败处理

```typescript
async function handleStepFailure(step: EditStep, error: Error): Promise<FailureAction> {
	// 1. 记录失败
	await gswCapture.captureStepFailure(step, error)

	// 2. 分析失败原因
	const failureType = analyzeFailure(error)

	switch (failureType) {
		case "file_not_found":
			// 文件不存在 - 可能已被删除
			return { action: "skip", reason: "文件不存在" }

		case "conflict":
			// 代码冲突 - 需要用户介入
			return { action: "user_resolve", showDiff: true }

		case "syntax_error":
			// 生成的代码有语法错误 - 尝试重新生成
			return { action: "retry", maxRetries: 2 }

		case "rate_limit":
			// API 限流 - 等待后重试
			return { action: "wait_retry", delayMs: 30000 }

		default:
			// 未知错误 - 通知用户
			return { action: "notify_user", error }
	}
}
```

### 7.2 链失败恢复

```
编辑链执行中断
        │
        ▼
┌─────────────────────────────────────────┐
│  保存当前状态到 GSW                       │
│  status: 'paused'                        │
│  currentIndex: 3                         │
│  steps[0-2]: completed                   │
│  steps[3]: failed (with error)           │
│  steps[4+]: pending                      │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  用户下次进入时                           │
│  "检测到未完成的编辑链，是否继续？"        │
│  [继续] [放弃] [查看详情]                 │
└─────────────────────────────────────────┘
```

---

## 8. 性能优化策略

### 8.1 预取策略

```typescript
class PrefetchStrategy {
	// 预取窗口大小
	windowSize = 2 // 预取当前步骤后的 2 步

	// 智能预取：根据用户行为调整
	adjustWindow(avgReviewTime: number) {
		// 用户审阅快 → 增加预取窗口
		if (avgReviewTime < 5000) {
			this.windowSize = Math.min(this.windowSize + 1, 5)
		}
		// 用户审阅慢 → 减少预取（节省资源）
		else if (avgReviewTime > 30000) {
			this.windowSize = Math.max(this.windowSize - 1, 1)
		}
	}
}
```

### 8.2 上下文复用

```typescript
class ContextPool {
	private pool: IsolatedContext[] = []
	private maxSize = 10

	acquire(): IsolatedContext {
		// 复用已释放的上下文
		const available = this.pool.find((c) => !c.inUse)
		if (available) {
			available.reset()
			available.inUse = true
			return available
		}
		// 创建新上下文
		return this.createNew()
	}

	release(ctx: IsolatedContext) {
		ctx.inUse = false
		// 保留在池中供复用
	}
}
```

### 8.3 增量 Diff 生成

```typescript
// 不重新生成整个文件，只生成变更部分
async function generateIncrementalEdit(step: EditStep): Promise<string> {
	// 只读取相关行的上下文
	const context = await readFileLines(
		step.filePath,
		step.startLine - 10, // 上文 10 行
		step.endLine + 10, // 下文 10 行
	)

	// 生成最小化的代码变更
	return await llm.generate({
		task: "incremental_edit",
		context,
		instruction: step.description,
	})
}
```

---

## 9. 总结

### 核心创新点

1. **渐进式 vs 一次性**：将大任务分解为可审查的小步骤
2. **预测式生成**：后台预取消除等待时间
3. **模式学习**：从成功编辑中提取可复用知识
4. **并行协同**：与 SubAgent Parallel 无缝集成
5. **GSW 驱动**：所有数据持久化到三元记忆系统

### 用户价值

| 维度 | 改进                          |
| ---- | ----------------------------- |
| 效率 | 多文件重构从 30 分钟 → 3 分钟 |
| 控制 | 每步可审查、可修改、可跳过    |
| 学习 | 系统越用越智能（模式复用）    |
| 体验 | 零等待、可视化进度            |
