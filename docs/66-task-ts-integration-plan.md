# Task.ts WASM 集成计划

**创建时间**: 2025-10-14  
**状态**: Phase 2.1.3 - 设计阶段  
**目标**: 将 TaskAdapter 集成到主 Task 类，实现 WASM/TypeScript 双模式支持

---

## 📋 执行摘要

Task.ts（3,522行）是 Roo-Code 的核心类，管理整个任务生命周期。本计划采用**最小侵入原则**，通过配置开关实现 WASM 模式，保持向后兼容。

**关键决策**:

- ✅ **配置驱动**: 通过 `enableWasm` 选项控制模式
- ✅ **Fallback机制**: TaskAdapter 内置3次重试后自动降级
- ✅ **状态隔离**: Task保持现有逻辑，TaskAdapter独立管理WASM状态
- ✅ **向后兼容**: 默认禁用WASM，现有功能零影响

---

## 🎯 集成目标

### 主要目标

1. **最小侵入**: 只在关键生命周期点集成TaskAdapter
2. **性能提升**: WASM模式下任务管理性能提升30%+
3. **零破坏**: 所有现有测试必须通过
4. **易切换**: 一个配置开关即可启用/禁用WASM

### 成功标准

- ✅ 所有现有Task测试通过（~50个测试）
- ✅ 新增TaskAdapter集成测试通过（10+测试）
- ✅ TypeScript类型检查通过
- ✅ 构建成功（pnpm build）

---

## 🔍 Task.ts 架构分析

### 核心组件结构

```typescript
export class Task extends EventEmitter<TaskEvents> implements TaskLike {
	// 身份标识
	readonly taskId: string
	readonly rootTaskId?: string
	readonly parentTaskId?: string
	childTaskId?: string

	// 生命周期状态
	abort: boolean = false
	isPaused: boolean = false
	isInitialized = false

	// 核心服务
	api: ApiHandler
	conversationMemory: ConversationMemory
	vectorMemoryStore?: VectorMemoryStore

	// 关键生命周期方法（需要集成）
	constructor(options: TaskOptions) // ⚠️ 初始化点
	private async startTask() // ⚠️ 任务启动
	private async resumeTaskFromHistory() // ⚠️ 任务恢复
	public async abortTask() // ⚠️ 任务中止
	public dispose() // ⚠️ 资源清理
}
```

### 集成点分析

| 生命周期阶段 | 现有方法                  | TaskAdapter操作      | 优先级 |
| ------------ | ------------------------- | -------------------- | ------ |
| **初始化**   | `constructor()`           | 创建TaskAdapter实例  | 🔴 高  |
| **启动**     | `startTask()`             | `adapter.start()`    | 🔴 高  |
| **恢复**     | `resumeTaskFromHistory()` | `adapter.resume()`   | 🟡 中  |
| **暂停**     | `isPaused = true`         | `adapter.pause()`    | 🟢 低  |
| **中止**     | `abortTask()`             | `adapter.abort()`    | 🔴 高  |
| **清理**     | `dispose()`               | `adapter.dispose()`  | 🔴 高  |
| **完成**     | `attempt_completion` tool | `adapter.complete()` | 🟡 中  |

---

## 🛠️ 集成设计方案

### Phase 1: 接口扩展（2.1.3.1）

**文件**: `src/core/task/Task.ts` (行 130-149)

**当前接口**:

```typescript
export interface TaskOptions extends CreateTaskOptions {
	provider: ClineProvider
	apiConfiguration: ProviderSettings
	enableDiff?: boolean
	enableCheckpoints?: boolean
	enableBridge?: boolean
	// ...其他选项
}
```

**新增配置**:

```typescript
export interface TaskOptions extends CreateTaskOptions {
	// 现有字段...

	// 🆕 WASM配置
	enableWasm?: boolean // 启用WASM模式（默认false）
	enableWasmFallback?: boolean // 启用Fallback（默认true）
	wasmPersistencePath?: string // 状态持久化路径（可选）
	wasmMaxRetries?: number // 最大重试次数（默认3）
}
```

**影响范围**:

- ✅ 向后兼容（所有新字段都是可选）
- ✅ 不影响现有构造函数调用
- ⚠️ 需要更新 `TaskOptions` 的所有使用位置（约5-10处）

---

### Phase 2: 构造函数集成（2.1.3.2）

**文件**: `src/core/task/Task.ts` (行 318-456)

**集成策略**:

```typescript
export class Task extends EventEmitter<TaskEvents> implements TaskLike {
	// 🆕 添加字段
	private taskAdapter?: TaskAdapter
	private enableWasm: boolean = false

	constructor({
		provider,
		apiConfiguration,
		enableDiff = false,
		enableCheckpoints = true,
		enableBridge = false,
		// 🆕 WASM配置
		enableWasm = false,
		enableWasmFallback = true,
		wasmPersistencePath,
		wasmMaxRetries = 3,
		// ...其他参数
	}: TaskOptions) {
		super()

		// 现有初始化逻辑...
		this.taskId = historyItem ? historyItem.id : crypto.randomUUID()
		this.apiConfiguration = apiConfiguration
		// ...

		// 🆕 初始化TaskAdapter（如果启用）
		this.enableWasm = enableWasm
		if (this.enableWasm) {
			try {
				const mode = historyItem?.mode || defaultModeSlug
				const hostInterface = new HostInterface(provider)

				this.taskAdapter = new TaskAdapter(this.taskId, mode, hostInterface, {
					enableWasm: true,
					enableFallback: enableWasmFallback,
					persistencePath:
						wasmPersistencePath || path.join(this.globalStoragePath, "wasm-tasks", this.taskId),
					maxRetries: wasmMaxRetries,
				})

				provider.log(`[Task#constructor] TaskAdapter initialized for ${this.taskId}`)
			} catch (error) {
				// 初始化失败，降级到TypeScript模式
				provider.log(`[Task#constructor] TaskAdapter init failed, falling back: ${error}`)
				this.enableWasm = false
				this.taskAdapter = undefined
			}
		}

		// 现有逻辑继续...
		if (startTask) {
			if (task || images) {
				this.startTask(task, images)
			} else if (historyItem) {
				this.resumeTaskFromHistory()
			}
		}
	}
}
```

**关键决策**:

- ✅ **懒加载**: TaskAdapter只在enableWasm=true时创建
- ✅ **错误隔离**: 初始化失败不影响Task创建
- ✅ **日志追踪**: 记录WASM模式切换

---

### Phase 3: 启动/恢复集成（2.1.3.3）

**文件**: `src/core/task/Task.ts` (行 1352-1661)

#### 3.1 startTask 集成

**当前流程**:

```typescript
private async startTask(task?: string, images?: string[]): Promise<void> {
  // 1. 订阅Bridge
  // 2. 初始化消息历史
  // 3. 发送初始消息
  // 4. 启动任务循环
  await this.initiateTaskLoop([...])
}
```

**集成方案**:

```typescript
private async startTask(task?: string, images?: string[]): Promise<void> {
  if (this.enableBridge) {
    await BridgeOrchestrator.subscribeToTask(this)
  }

  // 🆕 启动TaskAdapter（如果存在）
  if (this.taskAdapter) {
    try {
      await this.taskAdapter.start(task || '')
      this.providerRef.deref()?.log(`[Task#startTask] WASM task started: ${this.taskId}`)
    } catch (error) {
      this.providerRef.deref()?.log(`[Task#startTask] WASM start failed: ${error}`)
      // Fallback机制会自动处理，继续执行TypeScript逻辑
    }
  }

  // 现有逻辑保持不变
  this.clineMessages = []
  this.apiConversationHistory = []
  await this.providerRef.deref()?.postStateToWebview()
  await this.say("text", task, images)
  this.isInitialized = true

  let imageBlocks: Anthropic.ImageBlockParam[] = formatResponse.imageBlocks(images)
  await this.initiateTaskLoop([...])
}
```

#### 3.2 resumeTaskFromHistory 集成

```typescript
private async resumeTaskFromHistory() {
  if (this.enableBridge) {
    await BridgeOrchestrator.subscribeToTask(this)
  }

  // 🆕 恢复TaskAdapter状态
  if (this.taskAdapter) {
    try {
      await this.taskAdapter.resume()
      this.providerRef.deref()?.log(`[Task#resumeTask] WASM task resumed: ${this.taskId}`)
    } catch (error) {
      this.providerRef.deref()?.log(`[Task#resumeTask] WASM resume failed: ${error}`)
    }
  }

  // 现有历史恢复逻辑...
  const modifiedClineMessages = await this.getSavedClineMessages()
  await this.overwriteClineMessages(modifiedClineMessages)
  this.apiConversationHistory = await this.getSavedApiConversationHistory()

  // ...继续现有流程
}
```

**关键点**:

- ✅ **非阻塞**: WASM失败不阻止TypeScript逻辑
- ✅ **状态同步**: TaskAdapter状态与Task状态独立
- ✅ **日志完整**: 详细记录WASM操作结果

---

### Phase 4: 中止/清理集成（2.1.3.4）

**文件**: `src/core/task/Task.ts` (行 1663-1800)

#### 4.1 abortTask 集成

```typescript
public async abortTask(isAbandoned = false) {
  if (isAbandoned) {
    this.abandoned = true
  }

  this.abort = true
  this.emit(RooCodeEventName.TaskAborted)

  // 🆕 中止TaskAdapter
  if (this.taskAdapter) {
    try {
      await this.taskAdapter.abort()
      this.providerRef.deref()?.log(`[Task#abortTask] WASM task aborted: ${this.taskId}`)
    } catch (error) {
      console.error(`[Task#abortTask] WASM abort failed:`, error)
      // 非致命错误，继续清理
    }
  }

  try {
    this.dispose()
  } catch (error) {
    console.error(`Error during task ${this.taskId}.${this.instanceId} disposal:`, error)
  }

  try {
    await this.saveClineMessages()
  } catch (error) {
    console.error(`Error saving messages during abort:`, error)
  }
}
```

#### 4.2 dispose 集成

```typescript
public dispose(): void {
  console.log(`[Task#dispose] disposing task ${this.taskId}.${this.instanceId}`)

  // 🆕 清理TaskAdapter（最高优先级）
  if (this.taskAdapter) {
    try {
      this.taskAdapter.dispose()
      this.taskAdapter = undefined
      this.providerRef.deref()?.log(`[Task#dispose] TaskAdapter disposed`)
    } catch (error) {
      console.error('[Task#dispose] TaskAdapter dispose failed:', error)
    }
  }

  // 现有清理逻辑保持不变
  try {
    if (this.pendingSave) {
      this.flushPendingSave().catch(console.error)
    }
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer)
      this.saveDebounceTimer = undefined
    }
  } catch (error) {
    console.error("Error handling pending saves during disposal:", error)
  }

  // ...其他清理逻辑
  try {
    if (this.messageQueueStateChangedHandler) {
      this.messageQueueService.removeListener("stateChanged", this.messageQueueStateChangedHandler)
      this.messageQueueStateChangedHandler = undefined
    }
    this.messageQueueService.dispose()
  } catch (error) {
    console.error("Error disposing message queue:", error)
  }

  // ...继续清理其他资源
}
```

**清理顺序优化**:

1. **TaskAdapter** (WASM资源)
2. **消息持久化** (数据完整性)
3. **事件监听器** (防止内存泄漏)
4. **其他服务** (终端、浏览器等)

---

### Phase 5: 状态同步机制（2.1.3.5）

**设计原则**: Task和TaskAdapter状态**弱耦合**，各自维护状态，定期同步关键信息。

#### 5.1 状态映射

```typescript
// Task状态 → TaskAdapter状态映射
private syncTaskStatusToAdapter(): void {


  if (!this.taskAdapter) return

  try {
    // 根据Task状态同步到TaskAdapter
    if (this.abort) {
      await this.taskAdapter.abort()
    } else if (this.isPaused) {
      await this.taskAdapter.pause()
    } else if (this.isInitialized && !this.abort) {
      // Task运行中，确保Adapter也在运行
      const adapterStatus = this.taskAdapter.getStatus()
      if (adapterStatus === TaskStatus.Idle) {
        await this.taskAdapter.resume()
      }
    }
  } catch (error) {
    console.error('[Task#syncTaskStatusToAdapter]', error)
  }
}

// TaskAdapter状态 → Task状态监听（可选）
private setupAdapterStatusListener(): void {
  if (!this.taskAdapter) return

  // TaskAdapter可以通过HostInterface发送状态变更通知
  // Task可以选择监听这些通知并做相应处理
  // 但由于是弱耦合设计，这不是必需的
}
```

#### 5.2 状态同步时机

| 同步时机     | 触发方法                  | 同步方向       | 备注     |
| ------------ | ------------------------- | -------------- | -------- |
| **任务启动** | `startTask()`             | Task → Adapter | 必需     |
| **任务恢复** | `resumeTaskFromHistory()` | Task → Adapter | 必需     |
| **任务暂停** | `isPaused = true`         | Task → Adapter | 可选     |
| **任务中止** | `abortTask()`             | Task → Adapter | 必需     |
| **状态查询** | `getStatus()`             | Adapter → Task | 被动查询 |

**设计理念**:

- ✅ **主动推送**: Task主动调用Adapter的生命周期方法
- ✅ **被动查询**: Adapter不主动通知Task（避免复杂事件系统）
- ✅ **最终一致**: 状态可能短暂不同步，但最终会通过生命周期方法对齐

---

## 🧪 测试策略（2.1.3.6-2.1.3.7）

### 测试层次

#### Level 1: 单元测试（新增）

**文件**: `src/core/task/__tests__/Task.wasm-integration.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"
import { Task } from "../Task"
import { TaskAdapter } from "../../wasm/adapters/TaskAdapter"

describe("Task WASM Integration", () => {
	let mockProvider: any
	let mockApiConfiguration: any

	beforeEach(() => {
		// Mock setup...
	})

	describe("TaskAdapter Initialization", () => {
		it("should create TaskAdapter when enableWasm=true", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				enableWasm: true,
				startTask: false,
			})

			expect(task["taskAdapter"]).toBeDefined()
			expect(task["enableWasm"]).toBe(true)
		})

		it("should not create TaskAdapter when enableWasm=false", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				enableWasm: false,
				startTask: false,
			})

			expect(task["taskAdapter"]).toBeUndefined()
			expect(task["enableWasm"]).toBe(false)
		})

		it("should fallback to TypeScript mode if TaskAdapter init fails", async () => {
			// Mock TaskAdapter constructor to throw
			vi.spyOn(TaskAdapter.prototype, "constructor" as any).mockImplementation(() => {
				throw new Error("WASM init failed")
			})

			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				enableWasm: true,
				startTask: false,
			})

			expect(task["enableWasm"]).toBe(false)
			expect(task["taskAdapter"]).toBeUndefined()
		})
	})

	describe("Lifecycle Integration", () => {
		it("should call adapter.start() when task starts", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				enableWasm: true,
				startTask: false,
			})

			const startSpy = vi.spyOn(task["taskAdapter"]!, "start")
			await task["startTask"]("test message")

			expect(startSpy).toHaveBeenCalledWith("test message")
		})

		it("should call adapter.abort() when task aborts", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				enableWasm: true,
				startTask: false,
			})

			const abortSpy = vi.spyOn(task["taskAdapter"]!, "abort")
			await task.abortTask()

			expect(abortSpy).toHaveBeenCalled()
		})

		it("should call adapter.dispose() during cleanup", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				enableWasm: true,
				startTask: false,
			})

			const disposeSpy = vi.spyOn(task["taskAdapter"]!, "dispose")
			task.dispose()

			expect(disposeSpy).toHaveBeenCalled()
			expect(task["taskAdapter"]).toBeUndefined()
		})
	})

	describe("Error Handling", () => {
		it("should continue task execution if adapter.start() fails", async () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				enableWasm: true,
				startTask: false,
			})

			vi.spyOn(task["taskAdapter"]!, "start").mockRejectedValue(new Error("WASM start failed"))

			// Task should not throw, fallback mechanism handles it
			await expect(task["startTask"]("test message")).resolves.not.toThrow()
		})

		it("should handle adapter disposal errors gracefully", () => {
			const task = new Task({
				provider: mockProvider,
				apiConfiguration: mockApiConfiguration,
				task: "test task",
				enableWasm: true,
				startTask: false,
			})

			vi.spyOn(task["taskAdapter"]!, "dispose").mockImplementation(() => {
				throw new Error("Dispose failed")
			})

			// Should not throw
			expect(() => task.dispose()).not.toThrow()
		})
	})
})
```

**覆盖目标**:

- ✅ TaskAdapter初始化（3个测试）
- ✅ 生命周期集成（3个测试）
- ✅ 错误处理（2个测试）
- **总计**: 8个新测试

#### Level 2: 集成测试（现有测试兼容性）

**文件**: `src/core/task/__tests__/Task.spec.ts`

**验证内容**:

- ✅ 所有现有测试在enableWasm=false时保持通过（~50个测试）
- ✅ 新增enableWasm=true的对比测试（可选）
- ✅ TypeScript类型检查无错误

**执行命令**:

```bash
cd src
npx vitest run core/task/__tests__/Task.spec.ts
```

**预期结果**: `All tests passed`

---

## 📊 集成风险评估

### 高风险区域

| 风险项           | 影响                   | 缓解措施                  | 优先级 |
| ---------------- | ---------------------- | ------------------------- | ------ |
| **构造函数异常** | Task创建失败           | try-catch隔离 + fallback  | 🔴 高  |
| **状态不同步**   | Task/Adapter状态不一致 | 弱耦合设计 + 独立状态管理 | 🟡 中  |
| **内存泄漏**     | TaskAdapter未释放      | dispose()强制清理         | 🔴 高  |
| **性能下降**     | WASM初始化开销         | 懒加载 + 缓存             | 🟢 低  |
| **类型错误**     | TaskOptions接口变更    | 可选字段 + 向后兼容       | 🟢 低  |

### 回滚策略

如果集成出现严重问题：

1. **即时回滚**: 设置 `enableWasm: false` （默认值）
2. **代码回滚**: Git revert 到集成前提交
3. **渐进修复**: 保留代码但禁用功能，逐步修复
4. **特性开关**: 通过VSCode配置控制是否启用WASM

---

## 🚀 执行计划

### Week 1 Timeline

| Day         | 任务    | 子任务                | 预计时间 | 状态 |
| ----------- | ------- | --------------------- | -------- | ---- |
| **Day 1**   | 2.1.3.1 | 扩展TaskOptions接口   | 1h       | ⏳   |
| **Day 1-2** | 2.1.3.2 | 构造函数集成          | 3h       | ⏳   |
| **Day 2-3** | 2.1.3.3 | startTask/resume集成  | 4h       | ⏳   |
| **Day 3**   | 2.1.3.4 | abortTask/dispose集成 | 2h       | ⏳   |
| **Day 4**   | 2.1.3.5 | 状态同步机制          | 2h       | ⏳   |
| **Day 4-5** | 2.1.3.6 | 编写新测试            | 4h       | ⏳   |
| **Day 5**   | 2.1.3.7 | 运行所有测试 + 修复   | 2h       | ⏳   |
| **Total**   |         |                       | **18h**  |      |

### 里程碑

- ✅ **M1**: TaskOptions接口扩展完成
- ✅ **M2**: 构造函数集成完成（可创建启用WASM的Task）
- ✅ **M3**: 生命周期集成完成（start/abort/dispose）
- ✅ **M4**: 测试全部通过（现有+新增）
- 🎯 **M5**: Task.ts集成完成，进入2.1.4端到端测试

---

## 📝 验收标准

### 功能验收

- [ ] Task可以通过enableWasm选项启用WASM模式
- [ ] WASM模式下TaskAdapter正确初始化
- [ ] 生命周期方法（start/resume/abort/dispose）正确调用Adapter
- [ ] WASM失败时自动降级到TypeScript模式
- [ ] 默认情况下（enableWasm=false）行为完全不变

### 测试验收

- [ ] 所有现有Task测试通过（~50个）
- [ ] 新增TaskAdapter集成测试通过（8个）
- [ ] TypeScript类型检查通过（`pnpm check-types`）
- [ ] 无Lint错误

### 性能验收

- [ ] Task创建时间增加 <10ms（WASM模式）
- [ ] Task创建时间增加 <1ms（TypeScript模式，默认）
- [ ] 内存使用增加 <5MB（每个WASM Task）

### 代码质量

- [ ] 所有新代码有注释说明
- [ ] 关键集成点有日志记录
- [ ] 错误处理完善（不抛出未捕获异常）
- [ ] 符合现有代码风格

---

## 🔧 实现细节

### Import语句

```typescript
// 在Task.ts顶部添加
import { TaskAdapter } from "../wasm/adapters/TaskAdapter"
import { HostInterface } from "../wasm/HostInterface"
import { TaskStatus } from "@roo-code/types"
```

### 类型定义更新

确保TaskOptions的变更同步到以下位置：

1. `src/core/task/Task.ts` - 接口定义
2. `src/core/webview/ClineProvider.ts` - createTask调用
3. `@roo-code/types` - 如果需要导出类型

### 配置传递路径

```
VSCode Settings
  ↓
ClineProvider.getState()
  ↓
ClineProvider.createTask({enableWasm: ...})
  ↓
new Task({enableWasm: ...})
  ↓
new TaskAdapter(...)
```

---

## 📚 相关文档

- **TaskAdapter实现**: `docs/65-task-adapter-implementation-summary.md`
- **HostInterface规范**: `docs/64-phase2-wasm-integration-plan.md`
- **Phase 2总体规划**: `docs/63-phase2-master-plan.md`
- **Rust WASM API**: `native/roo-engine/README.md`

---

## ✅ 下一步行动

### 立即执行（按顺序）

1. **扩展TaskOptions接口** (2.1.3.1)

    - 文件: `src/core/task/Task.ts`
    - 添加4个新可选字段
    - 预计时间: 1小时

2. **构造函数集成** (2.1.3.2)

    - 添加TaskAdapter字段
    - 实现条件初始化逻辑
    - 预计时间: 3小时

3. **编写初步测试** (部分2.1.3.6)
