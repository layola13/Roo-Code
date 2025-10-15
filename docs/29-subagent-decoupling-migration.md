# 子代理系统解耦迁移指南

## 概述

本文档描述了子代理（SubAgent）系统从与 Task 类紧耦合迁移到独立执行架构的重构过程。

## 重构日期

2025-10-15

## 问题背景

### 原有架构问题

1. **紧耦合 Task 类**: 旧的 `subagent-caller.ts` 依赖 `Task.startSubtask()`, `Task.waitForSubtask()`, `Task.completeSubtask()` 方法
2. **与 Judge Mode 混淆**: 子代理系统复用了判断模式的子任务机制，导致概念混淆
3. **难以独立测试**: 必须模拟整个 Task 类才能测试子代理功能
4. **职责不清**: Task 类承担了过多的责任

### 新架构优势

1. **完全解耦**: 不依赖 Task 生命周期，直接通过 ApiHandler 执行
2. **清晰职责**: SubAgentExecutor 专注于子代理压缩逻辑
3. **易于测试**: 只需模拟 ApiHandler 即可完整测试
4. **更好的可维护性**: 独立的类更容易理解和修改

## 架构变更

### 文件变更

#### 新增文件

- `src/core/condense/SubAgentExecutor.ts` (360行)
- `src/core/condense/__tests__/SubAgentExecutor.spec.ts` (424行)

#### 删除文件

- `src/core/condense/subagent-caller.ts` (367行) - 已弃用
- `src/core/condense/__tests__/subagent-caller.spec.ts` (390行) - 已弃用

#### 修改文件

- `src/core/condense/index.ts`
- `src/core/task/Task.ts`
- `src/core/sliding-window/index.ts`

## API 变更

### SubAgentExecutor 类

新的 API:

- `SubAgentExecutor` 类构造函数接受 `config` 和 `apiHandler`
- `executeCompression(messages)` 方法执行压缩
- `executeSubAgentCompression(messages, config, apiHandler)` 便捷函数
- `shouldUseSubAgentCompression(config)` 判断函数

旧 API (已弃用):

- 之前需要传递 `Task` 实例，现在改为 `ApiHandler`

## 迁移步骤

### 对于调用方代码

之前:

```typescript
import { executeSubAgentCompression } from "./condense/subagent-caller"
const result = await executeSubAgentCompression(messages, config, task)
```

之后:

```typescript
import { executeSubAgentCompression } from "./condense/SubAgentExecutor"
const result = await executeSubAgentCompression(messages, config, apiHandler)
```

## 实现细节变更

### 执行机制

之前使用 Task.startSubtask，现在直接使用 ApiHandler.createMessage

## 测试变更

之前需要模拟 Task 类，现在只需模拟 ApiHandler

## 性能影响

预期改进:

1. 减少间接调用
2. 更少的状态管理
3. 更快的测试

## 兼容性

### 向后兼容

- API 导出函数签名基本保持一致
- 返回类型完全相同
- 配置结构不变

### 破坏性变更

- 必须传递 ApiHandler 而不是 Task 实例
- 旧文件已删除

## 下一步计划

1. 隐藏子代理消息
2. 配置 UI
3. 统计信息显示
4. 改进 UI 体验

## 相关文档

- 子代理系统概述: docs/14-multi-agent-implementation-summary.md
- 上下文压缩机制: docs/03-context-compression.md
- 任务生命周期: docs/07-task-lifecycle.md
