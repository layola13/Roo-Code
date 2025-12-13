# Next Edit + GSW 集成实现计划

## 目标概述

设计并实现 **Next Edit** 功能，与现有 **GSW (Generative Semantic Workspace)** 系统深度集成，最大程度复用 GSW 的记忆存储、向量搜索和知识捕获能力。

---

## 核心设计思想

### 复用 GSW 现有能力

| GSW 组件                 | 用途         | Next Edit 复用方式                    |
| ------------------------ | ------------ | ------------------------------------- |
| `DirectoryMemorySystem`  | 三元记忆存储 | 存储编辑会话、编辑步骤链              |
| `MemoryCapture`          | 知识捕获     | 捕获成功编辑模式作为 `evolution` 记忆 |
| `queryMemory` + 向量搜索 | 语义检索     | 检索相似编辑历史，辅助预测下一步      |
| `SessionSummary`         | 会话总结     | 生成编辑链摘要，跨会话持久化          |
| `WorkflowKnowledge`      | 工作流知识   | 学习重构模式、批量修改策略            |

### 与现有 Condense/SubAgent 协作

| 现有组件                    | Next Edit 集成点         |
| --------------------------- | ------------------------ |
| `RealtimeContextSummarizer` | 后台预生成下一步编辑建议 |
| `MemoryExtractorAgent`      | 提取编辑意图和决策点     |
| `CodeSummarizerAgent`       | 生成编辑后的代码摘要     |

---

## 数据模型设计

### 1. NextEditMemory 类型 (新增 GSW 记忆类型)

```typescript
// src/memory/gsw/types/next-edit.ts

import { BaseMemory } from "./common"

/**
 * 单个编辑步骤
 */
export interface EditStep {
	/** 步骤序号 */
	index: number
	/** 目标文件路径 */
	filePath: string
	/** 编辑区域起始行 */
	startLine: number
	/** 编辑区域结束行 */
	endLine: number
	/** 原始代码 */
	originalCode: string
	/** 生成的代码建议 */
	suggestedCode: string
	/** 编辑类型 */
	editType: "insert" | "replace" | "delete" | "refactor"
	/** 编辑描述 */
	description: string
	/** 置信度 0-1 */
	confidence: number
	/** 用户是否接受 */
	accepted?: boolean
	/** 编辑完成时间 */
	completedAt?: string
	/** 用户修改后的代码（如果与建议不同）*/
	userModifiedCode?: string
}

/**
 * 编辑链 - 关联的多步骤编辑序列
 */
export interface EditChain {
	/** 链ID */
	chainId: string
	/** 关联的任务描述 */
	taskDescription: string
	/** 编辑步骤列表 */
	steps: EditStep[]
	/** 当前进度 */
	currentIndex: number
	/** 涉及的文件 */
	affectedFiles: string[]
	/** 创建时间 */
	createdAt: string
	/** 最后更新时间 */
	updatedAt: string
	/** 完成状态 */
	status: "active" | "completed" | "paused" | "abandoned"
}

/**
 * Next Edit 记忆 (extends GSW reasoning memory)
 */
export interface NextEditMemory extends BaseMemory {
	version: "1.0"
	entry_id: string
	timestamp: string
	session_id: string

	/** 编辑链数据 */
	edit_chain: EditChain

	/** 语义索引用：任务意图摘要 */
	task_intent: string

	/** 关键词：用于YAML fallback搜索 */
	keywords: string[]

	/** 相关文件 */
	related_files: string[]

	/** 编辑模式标签 (e.g., "refactor", "add-feature", "fix-bug") */
	pattern_tags: string[]

	/** 成功率统计 */
	success_stats: {
		totalSteps: number
		acceptedSteps: number
		modifiedSteps: number
		rejectedSteps: number
	}
}
```

---

## 模块架构

```
src/
├── core/
│   └── next-edit/
│       ├── NextEditService.ts        # 核心服务 (新增)
│       ├── NextEditProvider.ts       # 编辑建议生成器 (新增)
│       ├── NextEditMemoryManager.ts  # GSW集成管理器 (新增)
│       ├── EditChainAnalyzer.ts      # 编辑链分析器 (新增)
│       ├── types.ts                  # 类型定义 (新增)
│       └── __tests__/                # 测试 (新增)
│
├── memory/
│   └── gsw/
│       └── types/
│           └── next-edit.ts          # Next Edit记忆类型 (新增)
│
└── webview-ui/
    └── src/
        └── components/
            └── next-edit/            # UI组件 (新增)
                ├── NextEditPanel.tsx
                ├── EditStepCard.tsx
                └── EditChainProgress.tsx
```

---

## 核心组件设计

### 1. NextEditService (核心入口)

```typescript
// src/core/next-edit/NextEditService.ts

import { DirectoryMemorySystem } from "../../memory/gsw/DirectoryMemorySystem"
import { MemoryCapture } from "../../memory/gsw/MemoryCapture"
import { ApiHandler } from "../../api"
import { EditChain, EditStep, NextEditMemory } from "./types"

export class NextEditService {
	private memorySystem: DirectoryMemorySystem
	private memoryCapture: MemoryCapture
	private apiHandler: ApiHandler

	// 当前活跃的编辑链
	private activeChain: EditChain | null = null

	// 预取队列（后台生成下一步建议）
	private prefetchQueue: EditStep[] = []

	constructor(memorySystem: DirectoryMemorySystem, memoryCapture: MemoryCapture, apiHandler: ApiHandler) {
		this.memorySystem = memorySystem
		this.memoryCapture = memoryCapture
		this.apiHandler = apiHandler
	}

	/**
	 * 🔥 启动编辑链（从任务描述生成编辑计划）
	 * 复用：GSW.queryMemory 检索相似历史
	 */
	async startEditChain(taskDescription: string, contextFiles: string[], sessionId: string): Promise<EditChain> {
		// 1. 查询GSW中的相似编辑历史
		const similarEdits = await this.queryHistoricalEdits(taskDescription)

		// 2. 调用LLM生成编辑计划
		const editPlan = await this.generateEditPlan(taskDescription, contextFiles, similarEdits)

		// 3. 创建编辑链
		this.activeChain = {
			chainId: `chain_${Date.now()}`,
			taskDescription,
			steps: editPlan,
			currentIndex: 0,
			affectedFiles: contextFiles,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			status: "active",
		}

		// 4. 保存到GSW reasoning memory
		await this.saveChainToGSW(sessionId)

		// 5. 预取第一步详细代码
		this.prefetchNextStep()

		return this.activeChain
	}

	/**
	 * 🔥 获取下一个编辑建议
	 */
	async getNextEdit(): Promise<EditStep | null> {
		if (!this.activeChain) return null
		if (this.activeChain.currentIndex >= this.activeChain.steps.length) {
			return null // 链完成
		}

		// 优先返回预取结果
		if (this.prefetchQueue.length > 0) {
			return this.prefetchQueue.shift()!
		}

		// 否则实时生成
		return this.activeChain.steps[this.activeChain.currentIndex]
	}

	/**
	 * 🔥 接受编辑建议
	 * 复用：MemoryCapture.captureCodeEvolution 捕获成功模式
	 */
	async acceptEdit(step: EditStep, userModifiedCode?: string): Promise<void> {
		step.accepted = true
		step.completedAt = new Date().toISOString()
		step.userModifiedCode = userModifiedCode

		// 推进到下一步
		this.activeChain!.currentIndex++
		this.activeChain!.updatedAt = new Date().toISOString()

		// 🔥 捕获成功的编辑模式到 GSW evolution memory
		await this.memoryCapture.captureCodeEvolution(
			step.filePath,
			this.generateDiff(step),
			null,
			this.activeChain!.chainId,
		)

		// 预取下一步
		this.prefetchNextStep()

		// 检查链是否完成
		if (this.activeChain!.currentIndex >= this.activeChain!.steps.length) {
			await this.completeChain()
		}
	}

	/**
	 * 🔥 拒绝编辑建议
	 */
	async rejectEdit(step: EditStep, reason?: string): Promise<void> {
		step.accepted = false
		step.completedAt = new Date().toISOString()

		// 可选：跳过或重新生成
		this.activeChain!.currentIndex++

		// 记录拒绝原因用于改进
		if (reason) {
			await this.memoryCapture.captureWorkflowKnowledge(
				"next_edit",
				"error_correction",
				{
					description: `User rejected edit: ${reason}`,
					context: `File: ${step.filePath}, Type: ${step.editType}`,
				},
				this.activeChain!.chainId,
			)
		}
	}

	/**
	 * 🔥 查询历史相似编辑（复用GSW向量搜索）
	 */
	private async queryHistoricalEdits(taskDescription: string): Promise<NextEditMemory[]> {
		const results = await this.memorySystem.queryMemory({
			query: taskDescription,
			types: ["reasoning"], // Next Edit存储在reasoning memory
			limit: 5,
			recentDays: 30,
			useVectorSearch: true,
		})

		// 过滤出Next Edit相关记忆
		return results.memories.filter((m) => (m.content as any).edit_chain).map((m) => m.content as NextEditMemory)
	}

	/**
	 * 保存链状态到GSW
	 */
	private async saveChainToGSW(sessionId: string): Promise<void> {
		const memory: NextEditMemory = {
			version: "1.0",
			entry_id: this.activeChain!.chainId,
			timestamp: new Date().toISOString(),
			session_id: sessionId,
			edit_chain: this.activeChain!,
			task_intent: this.activeChain!.taskDescription,
			keywords: this.extractKeywords(this.activeChain!.taskDescription),
			related_files: this.activeChain!.affectedFiles,
			pattern_tags: this.detectPatternTags(this.activeChain!),
			success_stats: {
				totalSteps: this.activeChain!.steps.length,
				acceptedSteps: 0,
				modifiedSteps: 0,
				rejectedSteps: 0,
			},
		}

		await this.memorySystem.writeMemory("reasoning", memory as any)
	}

	/**
	 * 完成编辑链（生成总结）
	 */
	private async completeChain(): Promise<void> {
		this.activeChain!.status = "completed"

		// 🔥 生成编辑链总结，保存为SessionSummary
		const summary = await this.generateChainSummary()
		await this.memorySystem.saveSessionSummary({
			session_id: this.activeChain!.chainId,
			task_type: "next_edit",
			outcome: "completed",
			key_decisions: summary.decisions,
			files_modified: this.activeChain!.affectedFiles,
			user_goals: [
				{
					goal: this.activeChain!.taskDescription,
					achieved: true,
				},
			],
			technologies_used: summary.technologies,
			lessons_learned: summary.lessons,
			last_updated: new Date().toISOString(),
		})

		this.activeChain = null
	}

	/**
	 * 后台预取下一步详细代码
	 */
	private async prefetchNextStep(): Promise<void> {
		if (!this.activeChain) return
		const nextIndex = this.activeChain.currentIndex
		if (nextIndex >= this.activeChain.steps.length) return

		// 异步生成详细代码，不阻塞主流程
		const step = this.activeChain.steps[nextIndex]
		// ... LLM调用生成详细代码
	}

	// 辅助方法省略...
	private extractKeywords(text: string): string[] {
		/*...*/
	}
	private detectPatternTags(chain: EditChain): string[] {
		/*...*/
	}
	private generateDiff(step: EditStep): string {
		/*...*/
	}
	private async generateChainSummary(): Promise<any> {
		/*...*/
	}
	private async generateEditPlan(task: string, files: string[], history: any[]): Promise<EditStep[]> {
		/*...*/
	}
}
```

### 2. NextEditProvider (代码生成器)

```typescript
// src/core/next-edit/NextEditProvider.ts

export class NextEditProvider {
	private apiHandler: ApiHandler
	private memorySystem: DirectoryMemorySystem

	/**
	 * 🔥 生成编辑计划（调用LLM，注入GSW记忆）
	 */
	async generateEditPlan(
		taskDescription: string,
		contextFiles: string[],
		historicalPatterns: NextEditMemory[],
	): Promise<EditStep[]> {
		// 1. 格式化历史模式为Prompt上下文
		const historyContext = this.formatHistoryForPrompt(historicalPatterns)

		// 2. 读取目标文件内容
		const fileContents = await this.readContextFiles(contextFiles)

		// 3. 调用LLM生成计划
		const prompt = this.buildPlanningPrompt(taskDescription, fileContents, historyContext)

		const response = await this.callLLM(prompt)

		// 4. 解析LLM响应为EditStep[]
		return this.parseEditPlan(response)
	}

	/**
	 * 🔥 生成单步编辑的详细代码
	 */
	async generateStepCode(step: EditStep, chain: EditChain): Promise<string> {
		// 读取当前文件内容
		const currentCode = await this.readFileContent(step.filePath)

		// 提取编辑区域上下文
		const regionContext = this.extractRegionContext(currentCode, step.startLine, step.endLine)

		// 查询相关的代码演进记忆
		const relatedEvolutions = await this.memorySystem.queryMemory({
			query: step.description,
			types: ["evolution"],
			limit: 3,
			relatedFiles: [step.filePath],
		})

		// 生成代码
		const prompt = this.buildCodeGenPrompt(step, regionContext, chain.taskDescription, relatedEvolutions.memories)

		return await this.callLLM(prompt)
	}

	/**
	 * 格式化历史编辑模式
	 */
	private formatHistoryForPrompt(patterns: NextEditMemory[]): string {
		if (patterns.length === 0) return ""

		return `
## 相关历史编辑模式

${patterns
	.map(
		(p, i) => `
### 模式 ${i + 1}: ${p.task_intent}
- 步骤数: ${p.edit_chain.steps.length}
- 成功率: ${((p.success_stats.acceptedSteps / p.success_stats.totalSteps) * 100).toFixed(0)}%
- 涉及文件: ${p.related_files.slice(0, 3).join(", ")}
- 模式标签: ${p.pattern_tags.join(", ")}
`,
	)
	.join("\n")}
`
	}
}
```

### 3. NextEditMemoryManager (GSW 集成层)

```typescript
// src/core/next-edit/NextEditMemoryManager.ts

export class NextEditMemoryManager {
	private memorySystem: DirectoryMemorySystem
	private memoryCapture: MemoryCapture

	/**
	 * 🔥 学习成功的编辑模式
	 * 将完成的编辑链转化为可复用知识
	 */
	async learnFromCompletedChain(chain: EditChain): Promise<void> {
		// 只学习成功率高的链
		const successRate = chain.steps.filter((s) => s.accepted).length / chain.steps.length
		if (successRate < 0.7) return

		// 提取可复用模式
		const pattern = this.extractEditPattern(chain)

		// 保存为工作流知识
		await this.memoryCapture.captureWorkflowKnowledge(
			"next_edit_pattern",
			"best_practice",
			{
				description: pattern.description,
				example: pattern.example,
				context: `编辑类型: ${pattern.editTypes.join(",")}`,
				correctParams: pattern.filePatterns,
			},
			chain.chainId,
		)
	}

	/**
	 * 🔥 查询适用于当前任务的编辑模式
	 */
	async queryApplicablePatterns(taskDescription: string, targetFiles: string[]): Promise<EditPattern[]> {
		// 使用GSW向量搜索
		const results = await this.memorySystem.queryMemory({
			query: taskDescription,
			types: ["reasoning"],
			limit: 10,
			useVectorSearch: true,
		})

		// 过滤并排序
		return results.memories
			.filter((m) => this.isEditPattern(m))
			.map((m) => this.extractPattern(m))
			.sort((a, b) => b.confidence - a.confidence)
	}

	/**
	 * 🔥 增量更新链状态（实时持久化）
	 */
	async updateChainProgress(chain: EditChain, step: EditStep): Promise<void> {
		// 更新reasoning memory
		const existingMemory = await this.memorySystem.readMemory("reasoning", chain.chainId)

		if (existingMemory) {
			const updated = {
				...existingMemory,
				edit_chain: chain,
				timestamp: new Date().toISOString(),
			}
			await this.memorySystem.writeMemory("reasoning", updated as any)
		}
	}
}
```

---

## UI 集成设计

### 1. NextEditPanel (主组件)

```tsx
// webview-ui/src/components/next-edit/NextEditPanel.tsx

interface NextEditPanelProps {
	chain: EditChain | null
	currentStep: EditStep | null
	onAccept: (step: EditStep) => void
	onReject: (step: EditStep, reason?: string) => void
	onModify: (step: EditStep, code: string) => void
}

export const NextEditPanel: React.FC<NextEditPanelProps> = ({ chain, currentStep, onAccept, onReject, onModify }) => {
	if (!chain) return null

	return (
		<div className="next-edit-panel">
			{/* 进度条 */}
			<EditChainProgress total={chain.steps.length} current={chain.currentIndex} />

			{/* 当前步骤 */}
			{currentStep && (
				<EditStepCard
					step={currentStep}
					onAccept={() => onAccept(currentStep)}
					onReject={(reason) => onReject(currentStep, reason)}
					onModify={(code) => onModify(currentStep, code)}
				/>
			)}

			{/* 步骤列表 */}
			<div className="step-list">
				{chain.steps.map((step, i) => (
					<StepListItem
						key={i}
						step={step}
						isCurrent={i === chain.currentIndex}
						isCompleted={i < chain.currentIndex}
					/>
				))}
			</div>
		</div>
	)
}
```

### 2. EditStepCard (单步编辑卡片)

```tsx
// webview-ui/src/components/next-edit/EditStepCard.tsx

export const EditStepCard: React.FC<EditStepCardProps> = ({ step, onAccept, onReject, onModify }) => {
	const [isEditing, setIsEditing] = useState(false)
	const [modifiedCode, setModifiedCode] = useState(step.suggestedCode)

	return (
		<div className="edit-step-card">
			<div className="step-header">
				<span className="step-badge">{step.editType}</span>
				<span className="file-path">{step.filePath}</span>
				<span className="line-range">
					L{step.startLine}-{step.endLine}
				</span>
			</div>

			<p className="step-description">{step.description}</p>

			<div className="code-diff">
				<DiffViewer original={step.originalCode} modified={isEditing ? modifiedCode : step.suggestedCode} />
			</div>

			<div className="actions">
				<button onClick={onAccept} className="accept-btn">
					✓ 接受 (Tab)
				</button>
				<button onClick={() => setIsEditing(!isEditing)} className="edit-btn">
					✏️ 修改
				</button>
				<button onClick={() => onReject()} className="reject-btn">
					✗ 跳过 (Esc)
				</button>
			</div>

			{/* 置信度指示器 */}
			<ConfidenceBar value={step.confidence} />
		</div>
	)
}
```

---

## 与 Task.ts 的集成

```typescript
// src/core/task/Task.ts (修改)

import { NextEditService } from "../next-edit/NextEditService"

class Task {
	private nextEditService?: NextEditService

	// 初始化时传入 GSW 系统
	async initialize() {
		// ... 现有初始化

		if (this.gswMemorySystem) {
			this.nextEditService = new NextEditService(this.gswMemorySystem, this.memoryCapture, this.api)
		}
	}

	/**
	 * 🔥 当检测到多步骤编辑任务时，自动启动 Next Edit 模式
	 */
	async handleMultiStepEdit(taskDescription: string, files: string[]) {
		if (!this.nextEditService) return

		// 启动编辑链
		const chain = await this.nextEditService.startEditChain(taskDescription, files, this.taskId)

		// 通知 UI 进入 Next Edit 模式
		await this.providerRef?.deref()?.postMessageToWebview({
			type: "nextEdit",
			chain: chain,
		})
	}
}
```

---

## 实现步骤 (task.md)

```markdown
# Next Edit + GSW 实现任务

## Phase 1: 类型定义和基础架构

- [ ] 创建 `src/memory/gsw/types/next-edit.ts` 定义 NextEditMemory 类型
- [ ] 创建 `src/core/next-edit/types.ts` 定义 EditStep, EditChain 等类型
- [ ] 更新 `src/memory/gsw/types/index.ts` 导出新类型

## Phase 2: 核心服务实现

- [ ] 创建 `src/core/next-edit/NextEditService.ts` 主服务
- [ ] 创建 `src/core/next-edit/NextEditProvider.ts` 代码生成器
- [ ] 创建 `src/core/next-edit/NextEditMemoryManager.ts` GSW集成层
- [ ] 创建 `src/core/next-edit/EditChainAnalyzer.ts` 编辑分析器

## Phase 3: GSW 集成

- [ ] 修改 `DirectoryMemorySystem.ts` 支持 next-edit 类型记忆的查询
- [ ] 修改 `MemoryCapture.ts` 添加 `captureEditPattern` 方法
- [ ] 添加向量索引支持 edit_chain 的语义搜索

## Phase 4: Task.ts 集成

- [ ] 修改 `Task.ts` 添加 NextEditService 初始化
- [ ] 添加多步骤编辑任务检测逻辑
- [ ] 添加 Next Edit 相关的消息处理

## Phase 5: UI 实现

- [ ] 创建 `webview-ui/src/components/next-edit/NextEditPanel.tsx`
- [ ] 创建 `webview-ui/src/components/next-edit/EditStepCard.tsx`
- [ ] 创建 `webview-ui/src/components/next-edit/EditChainProgress.tsx`
- [ ] 添加快捷键支持 (Tab/Esc)

## Phase 6: 测试和验证

- [ ] 创建 `NextEditService.test.ts` 单元测试
- [ ] 创建 `NextEditMemoryManager.test.ts` GSW集成测试
- [ ] 端到端手动测试：多文件重构场景
```

---

## 验证计划

### 自动化测试

#### 1. NextEditService 单元测试

```bash
# 运行测试
npm run test -- src/core/next-edit/__tests__/NextEditService.test.ts

# 测试用例
# 1. startEditChain 应正确生成编辑计划
# 2. acceptEdit 应更新链状态并触发GSW记忆捕获
# 3. rejectEdit 应记录拒绝原因
# 4. getNextEdit 应返回预取的步骤
```

#### 2. GSW 集成测试

```bash
# 运行测试
npm run test -- src/memory/gsw/__tests__/NextEditIntegration.test.ts

# 测试用例
# 1. queryHistoricalEdits 应正确检索相似编辑历史
# 2. saveChainToGSW 应正确持久化编辑链
# 3. learnFromCompletedChain 应生成可复用模式
```

### 手动验证

#### 场景 1: 基本编辑链功能

1. 在 Roo-Code 中发送任务："将所有文件中的 `console.log` 替换为 `logger.debug`"
2. 验证：
    - 应生成包含多个文件的编辑链
    - 每步显示 Diff 预览
    - Tab 键接受编辑，Esc 键跳过

#### 场景 2: GSW 记忆复用

1. 完成场景 1 的编辑链
2. 发送新任务："将所有 `console.error` 替换为 `logger.error`"
3. 验证：
    - LLM 应引用之前的编辑模式
    - 编辑步骤顺序应类似

---

## 🆕 SubAgent Parallel 集成

### 统一架构：GSW + SubAgent Parallel + Next Edit

```
用户请求
    │
    ▼
Code Mode LLM 自动决策
    │
    ├─── 单步简单 ──→ 直接执行
    │
    ├─── 多步顺序 ──→ Next Edit 链 (Tab/Esc 渐进)
    │
    └─── 多步独立 ──→ 并行 Slots (每个 Slot 运行一个 Next Edit 链)
                            │
                            ▼
                    GSW 统一记忆层
```

### 并行执行核心组件

#### 1. ParallelSubagentManager

```typescript
// src/core/subagent/parallel/ParallelSubagentManager.ts

interface ParallelSubagentConfig {
	maxConcurrency: number // 默认 10
	maxQueueSize: number // 默认 100
	dynamicScheduling: boolean // 完成即拉取
}

class ParallelSubagentManager {
	private gswSystem: DirectoryMemorySystem

	// 🔥 并行执行多个 Next Edit 链
	async runParallelEditChains(chains: EditChainSpec[], sessionId: string): Promise<ParallelEditResult> {
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

#### 2. 新增工具

```typescript
// src/core/tools/spawnParallelEditChainsTool.ts

interface SpawnParallelEditChainsParams {
	task_description: string
	chains: Array<{
		target_file: string
		steps: EditStep[]
	}>
	max_concurrent?: number // 默认 10
}
```

#### 3. 统一执行策略 Prompt

```typescript
// src/core/prompts/sections/unified-execution.ts

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

### 统一 UI 设计

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

### 新增模块结构

```
src/core/subagent/parallel/     # 🆕 并行执行核心
├── ParallelSubagentManager.ts  # 并行管理器
├── IsolatedContext.ts          # 隔离上下文
├── ContextPool.ts              # 上下文池
├── DynamicScheduler.ts         # 动态调度
└── ParallelEditChainExecutor.ts # 并行编辑链执行器

src/core/tools/                  # 🆕 新增工具
├── spawnParallelTasksTool.ts   # 并行任务工具
├── spawnEditChainTool.ts       # 编辑链工具
└── spawnParallelEditChainsTool.ts # 并行编辑链工具
```

---

## 用户审核事项

> [!IMPORTANT]
> 以下设计决策需要您确认：

1. **Next Edit 记忆类型**：建议存储在 `reasoning` memory 中（复用现有索引），还是创建独立的 `next-edit` 目录？

2. **触发方式**：Next Edit 模式如何激活？

    - A) 自动检测多文件编辑任务
    - B) 用户手动输入 `/next-edit` 命令
    - C) 两者都支持

3. **UI 位置**：编辑链面板应显示在哪里？

    - A) 右侧边栏
    - B) 底部面板
    - C) 内联显示在 Chat 消息中

4. **快捷键**：是否使用 Tab/Esc 作为接受/跳过的快捷键？（可能与编辑器冲突）

5. **并行粒度** 🆕：

    - A) 一个文件 = 一个 Slot
    - B) 一种编辑类型 = 一个 Slot

6. **失败处理** 🆕：
    - A) 自动重试 (最多 3 次)
    - B) 通知用户选择：重试/跳过/手动修复
