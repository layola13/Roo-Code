# 子代理模式改进方案

**文档编号**: 34  
**创建日期**: 2025-10-16  
**状态**: 规划中  
**优先级**: 高

## 📋 目录

1. [问题识别](#问题识别)
2. [架构对比](#架构对比)
3. [改进目标](#改进目标)
4. [技术方案](#技术方案)
5. [实施计划](#实施计划)
6. [验收标准](#验收标准)

---

## 🎯 问题识别

### 当前实现的问题

通过分析 `Task.ts` (Lines 2856-2910) 和 `docs/subagent2.md`，发现当前子代理实现与正确架构存在根本性差异：

#### ❌ 当前实现（错误）

**位置**: `Task.ts` 的 `attemptApiRequest` 方法中

```typescript
// 被动触发：只有当上下文接近满时才压缩（90-100%）
if (contextTokens > (contextWindow * autoCondenseContextPercent) / 100) {
	const truncateResult = await truncateConversationIfNeeded({
		subAgentConfig: useSubAgentCompression
			? {
					enabled: true,
					useContextAnalyzer: true,
					useMemoryExtractor: true,
					useCodeSummarizer: true,
					// ...
				}
			: undefined,
	})
}
```

**核心问题**:

1. **被动触发** - 等待上下文快满了才触发压缩
2. **强制全部执行** - 3个子代理全部运行，无法单独选择
3. **不是工具** - 子代理不是大模型可主动调用的工具
4. **目的单一** - 仅用于压缩上下文，不能用于其他分析任务
5. **缺乏可见性** - 用户不清楚子代理何时被调用

#### ✅ 正确架构（docs/subagent2.md）

子代理应该是大模型可**主动决策调用**的工具：

```
Assistant: "我需要分析代码质量，让我调用 code-reviewer 子代理"
        ↓
Tool Call: use_subagent({ name: "code-reviewer", task: "Review changes" })
        ↓
子代理在独立上下文中执行分析 → 返回结果
        ↓
Assistant: "基于子代理的分析结果，这是我的建议..."
```

---

## 📊 架构对比

| 特性           | ❌ 当前实现           | ✅ 目标架构              |
| -------------- | --------------------- | ------------------------ |
| **触发方式**   | 被动（上下文90%满时） | 主动（大模型决策调用）   |
| **调用时机**   | 强制（阈值触发）      | 灵活（任务需要时）       |
| **子代理选择** | 全部运行（3个）       | 按需选择（1个或多个）    |
| **用途**       | 单一（压缩上下文）    | 通用（各种分析任务）     |
| **可见性**     | 隐藏（自动执行）      | 可视化（UI显示调用历史） |
| **控制权**     | 系统自动              | 大模型决策               |

---

## 🎯 改进目标

### 主要目标

1. **保留现有功能** - 被动压缩作为安全后备
2. **添加主动调用** - 大模型可主动决策调用子代理
3. **提升可见性** - UI 显示详细的调用历史
4. **增强灵活性** - 支持单独或组合调用子代理

### 验收标准

1. ✅ 子代理模式有效性验证

    - 被动压缩功能正常工作
    - 主动调用机制正常工作
    - 两种模式互不干扰

2. ✅ UI 任务面板可视化

    - 显示子代理调用历史
    - 区分主动调用 vs 自动压缩
    - 显示详细数据（时间、Token、成本）

3. ✅ 代码规范

    - 遵循项目代码风格
    - 完整的 TypeScript 类型定义
    - 清晰的注释和文档

4. ✅ 测试覆盖

    - SubAgentExecutor 单元测试
    - 意图检测单元测试
    - TaskHeader UI 组件测试

5. ✅ 构建验证
    - `pnpm check-types` 通过
    - `pnpm test` 全部通过
    - `pnpm build` 构建成功

---

## 🔧 技术方案

### 方案概述

**核心原则**: 保留现有功能 + 添加新功能

我们**不删除**现有的被动压缩机制，而是在其基础上添加主动调用能力。

### 关键决策

#### 决策 1: 使用工具调用机制 ✅

**重要更正**: 原文档建议使用文本检测,但经过实际测试验证,**这是错误的**!

**正确做法**: 使用 Tool Use 机制

- ✅ 子代理必须作为标准工具注册
- ✅ LLM通过工具调用XML来调用子代理
- ✅ 系统通过工具执行器处理调用
- ✅ 参考 `docs/44-subagent-tool-based-invocation.md` 了解完整实现

**已完成实现**:

- ✅ `use_subagent` 工具已在 `src/shared/tools.ts` 中定义
- ✅ 工具描述在 `src/core/prompts/tools/use-subagent.ts`
- ✅ 执行器在 `src/core/tools/useSubagentTool.ts`
- ✅ 已注册到 `ALWAYS_AVAILABLE_TOOLS`

#### 决策 2: 复用现有执行器 ✅

**原因**: `SubAgentExecutor` 已经实现了完整的执行逻辑

**已完成实现**:

- ✅ 保留 `SubAgentExecutor.executeCompression()` 用于被动压缩
- ✅ 通过 `useSubagentTool.ts` 支持单个子代理的独立调用
- ✅ 工具执行器自动处理配置和调用逻辑

---

## 📝 实施计划

### Phase 1: 代码分析（准备阶段）

**目标**: 深入理解现有实现

#### Task 1.1: 分析 SubAgentExecutor ✅

- [x] 读取 `src/core/condense/SubAgentExecutor.ts`
- [ ] 理解执行流程和 API 调用机制
- [ ] 确认可复用的方法

**关键发现**:

- `SubAgentExecutor` 使用 `executeCompression()` 并行执行多个子代理
- `executeSubAgent()` 是私有方法，可以单独执行一个子代理
- 支持自定义提示词覆盖（contextAnalyzerPrompt, memoryExtractorPrompt, codeSummarizerPrompt）

#### Task 1.2: 分析 SYSTEM_PROMPT

- [ ] 读取 `src/core/prompts/system.ts`
- [ ] 了解当前提示结构
- [ ] 确定最佳插入位置

---

### Phase 2: 核心功能实现

#### Task 2.1: 工具描述 ✅ 已完成

**文件**: `src/core/prompts/tools/use-subagent.ts`

**状态**: ✅ 已实现完整的工具描述,包括:

- 3个子代理的详细说明
- 参数定义 (agent_name, task, context)
- 使用示例和最佳实践

#### Task 2.2: 工具执行器 ✅ 已完成

**文件**: `src/core/tools/useSubagentTool.ts`

**状态**: ✅ 已实现完整的执行逻辑:

- 参数验证
- 子代理配置
- SubAgentExecutor 调用
- 结果格式化和返回

#### Task 2.3: 工具注册 ✅ 已完成

**文件**: `src/shared/tools.ts`, `src/core/prompts/tools/index.ts`

**状态**: ✅ 已完成:

- 类型定义 `UseSubagentToolUse`
- 参数名称注册
- 工具始终可用配置
- 工具描述映射

#### Task 2.4: 修改数据结构

**文件**: `src/shared/WebviewMessage.ts` 或相关类型定义文件

**新增接口**:

```typescript
/**
 * 子代理调用记录
 */
export interface SubAgentInvocation {
	agentName: string
	timestamp: number
	triggerType: "tool_call" | "auto_compress" // 区分主动/被动
	task?: string
	tokensIn: number
	tokensOut: number
	cost: number
	success: boolean
	error?: string
}
```

#### Task 2.5: 记录调用历史

**文件**: `src/core/task/Task.ts`

**添加到 Task 类**:

```typescript
// 子代理调用历史
private subAgentInvocations: SubAgentInvocation[] = []

/**
 * 记录子代理调用
 */
private async recordSubAgentInvocation(
    invocation: SubAgentInvocation
): Promise<void> {
    this.subAgentInvocations.push(invocation)

    // 同步到 webview
    await this.providerRef.deref()?.postStateToWebview()

    // 可选：持久化到磁盘
    // await this.saveSubAgentHistory()
}

/**
 * 获取子代理调用历史（用于 webview 显示）
 */
public getSubAgentInvocations(): SubAgentInvocation[] {
    return this.subAgentInvocations
}
```

#### Task 2.6: 集成到消息处理流程
