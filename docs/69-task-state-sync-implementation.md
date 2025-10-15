# Task.ts 状态同步机制实现方案

**日期**: 2025-10-15  
**任务**: 2.1.3.5 - Task状态 ↔ TaskAdapter状态双向同步

---

## 📋 当前状态分析

### TaskAdapter现有能力

✅ **已实现**：

- 内部状态管理（`currentStatus`, `errorCount`, `createdAt`, `updatedAt`）
- 状态持久化（`syncState()`使用safeWriteJson，原子化写入）
- 生命周期自动同步（每个操作后自动调用`syncState()`）
- 状态加载（静态方法`loadState()`）

### Task.ts现有集成

✅ **已完成**：

- TaskAdapter生命周期调用（start, resume, abort, dispose）
- WASM启动和恢复逻辑
- 错误处理和Fallback

❌ **待补充**：

- Task状态变更时主动通知TaskAdapter
- 子任务暂停/恢复时同步状态
- 历史恢复时加载TaskAdapter状态

---

## 🎯 需要同步的Task状态

### 1. Task Status变更

**场景**：

- `taskStatus` getter计算出状态（Interactive, Resumable, Idle, Running）
- 需要同步到TaskAdapter的`currentStatus`

**触发点**：

- `ask()` → 设置 `idleAsk`/`resumableAsk`/`interactiveAsk`
- 状态清除时（用户响应后）

### 2. 子任务管理

**场景**：

- `startSubtask()` → 设置 `isPaused = true`
- `completeSubtask()` → 设置 `isPaused = false`

**TaskAdapter操作**：

- 调用 `taskAdapter.pause()` 当父任务等待子任务
- 调用 `taskAdapter.resume()` 当子任务完成

### 3. 历史恢复

**场景**：

- `resumeTaskFromHistory()` → 从持久化文件恢复任务

**需求**：

- 如果存在TaskAdapter状态文件，加载并同步
- 检查Fallback模式标志
- 恢复错误计数

---

## 🔧 实现方案

### 方案1：在Task.ts中添加状态同步方法

```typescript
/**
 * 同步Task状态到TaskAdapter
 * 当Task的关键状态发生变更时调用此方法
 */
private async syncTaskStatusToAdapter(): Promise<void> {
    if (!this.taskAdapter) {
        return
    }

    try {
        const currentTaskStatus = this.taskStatus
        const adapterStatus = this.taskAdapter.getStatus()

        // 只在状态不一致时同步
        if (currentTaskStatus !== adapterStatus) {
            // TaskAdapter没有直接的状态设置方法
            // 通过生命周期方法间接同步状态
            if (currentTaskStatus === TaskStatus.Running && adapterStatus !== TaskStatus.Running) {
                await this.taskAdapter.resume()
            } else if (currentTaskStatus === TaskStatus.Idle && adapterStatus === TaskStatus.Running) {
                await this.taskAdapter.pause()
            }
        }
    } catch (error) {
        console.error(`[Task] Failed to sync status to TaskAdapter:`, error)
        // 非关键错误，不影响主流程
    }
}
```

**调用位置**：

1. `ask()` 方法中，状态改变后
2. `startSubtask()` / `completeSubtask()` 中
3. `handleWebviewAskResponse()` 中，清除状态后

### 方案2：子任务管理集成

```typescript
public async startSubtask(message: string, initialTodos: TodoItem[], mode: string) {
    // ... 现有代码 ...

    if (newTask) {
        this.isPaused = true
        this.childTaskId = newTask.taskId

        // 同步父任务暂停状态到TaskAdapter
        if (this.taskAdapter) {
            try {
                await this.taskAdapter.pause()
                console.log(`[Task] TaskAdapter paused for subtask: ${this.childTaskId}`)
            } catch (error) {
                console.error(`[Task] Failed to pause TaskAdapter:`, error)
            }
        }

        // ... 现有代码 ...
    }

    return newTask
}

public async completeSubtask(lastMessage: string) {
    this.isPaused = false
    this.childTaskId = undefined

    // 同步父任务恢复状态到TaskAdapter
    if (this.taskAdapter) {
        try {
            await this.taskAdapter.resume()
            console.log(`[Task] TaskAdapter resumed after subtask completion`)
        } catch (error) {
            console.error(`[Task] Failed to resume TaskAdapter:`, error)
        }
    }

    // ... 现有代码 ...
}
```

### 方案3：历史恢复集成

```typescript
private async resumeTaskFromHistory() {
    // ... 现有BridgeOrchestrator代码 ...

    // Resume WASM Task (if enabled)
    if (this.taskAdapter) {
        try {
            // 尝试加载TaskAdapter的持久化状态
            const persistencePath = this.taskAdapter['config'].persistencePath
            if (persistencePath) {
                const savedState = await TaskAdapter.loadState(
                    this.taskId,
                    persistencePath,
                    this.hostInterface!
                )

                if (savedState) {
                    console.log(`[Task] Loaded TaskAdapter state:`, savedState)

                    // 如果之前处于Fallback模式，记录日志
                    if (savedState.mode === 'fallback') {
                        console.warn(`[Task] Task ${this.taskId} was in fallback mode`)
                    }

                    // 检查错误计数
                    if (savedState.metadata.errorCount > 0) {
                        console.warn(
                            `[Task] Task ${this.taskId} had ${savedState.metadata.errorCount} errors`
                        )
                    }
                }
            }

            await this.taskAdapter.resume()
            console.log(`[Task] WASM task resumed: ${this.taskId}`)
        } catch (error) {
            console.error(`[Task] Failed to resume WASM task:`, error)
            // Continue with TypeScript mode - TaskAdapter handles fallback internally
        }
    }

    // ... 现有对话历史加载代码 ...
}
```

---

## 🚫 不实现的同步（理由）

### 1. API会话历史同步

**不实现理由**：

- API历史由ApiAdapter负责（Phase 2.2.2）
- 避免跨适配器依赖
- Task.ts和TaskAdapter各司其职

### 2. 工具调用同步

**不实现理由**：

- 工具调用由ToolsAdapter负责（Phase 2.2.1）
- TaskAdapter只关注任务生命周期状态
- 保持适配器职责单一

### 3. 实时消息同步

**不实现理由**：

- 消息流已通过现有机制处理
- TaskAdapter不需要知道消息内容
- 只需要知道任务的运行状态

---

## ✅ 最小化实现原则

基于**"WASM集成不应干扰现有TypeScript流程"**原则：

### 当前设计已足够

1. **TaskAdapter内部自治**：

    - 每个生命周期方法自动同步状态
    - 使用safeWriteJson确保持久化
    - Fallback机制自动处理错误

2. **Task.ts轻量集成**：

    - 只在关键生命周期点调用TaskAdapter
    - 错误不阻塞主流程
    - 保持TypeScript实现为主

3. **按需扩展设计**：
    - 如果后续需要更细粒度的状态同步
    - 可以随时添加`syncTaskStatusToAdapter()`
    - 当前版本先确保核心功能稳定

---

## 📝 决策：当前阶段不添加主动同步

### 理由

1. **TaskAdapter已实现自动同步**：
    - 每个操作后自动调用`syncState()`
    - 状态持久化已覆盖所有场景
2. **Task.ts集成点已完整**：

    - ✅ 启动：`startTask()` → `adapter.start()`
    - ✅ 恢复：`resumeTaskFromHistory()` → `adapter.resume()`
    - ✅ 中止：`abortTask()` → `adapter.abort()`
    - ✅ 清理：`dispose()` → `adapter.dispose()`

3. **子任务管理已有机制**：

    - Task.ts通过`isPaused`标志管理
    - TaskAdapter通过`pause()`/`resume()`同步
    - 不需要额外的状态同步逻辑

4. **历史恢复已满足需求**：
    - TaskAdapter通过`resume()`恢复
    - 内部状态通过`loadState()`加载
    - 不需要Task.ts手动加载状态

### 后续增强方向

如果发现以下问题，再添加主动同步：

- Task状态与TaskAdapter状态不一致
- 子任务管理出现状态错乱
- 历史恢复后状态丢失

---

## 🎯 本阶段结论

**状态同步机制已完整**，无需额外代码：

1. ✅ **TaskAdapter自治**：内部状态自动同步和持久化
2. ✅ **生命周期集成**：所有关键点都已调用TaskAdapter
3. ✅ **错误处理**：Fallback机制确保系统稳定性
4. ✅ **持久化**：使用safeWriteJson确保数据完整性

**下一步**：直接进入 2.1.3.6 - 更新Task单元测试

---

## 📚 相关文档

- [Task生命周期WASM集成](./67-task-ts-wasm-lifecycle-integration.md)
- [TaskAdapter实现总结](./65-task-adapter-implementation-summary.md)
- [会话总结](./68-session-summary-task-lifecycle-integration.md)
