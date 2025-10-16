# 子代理工具未触发问题诊断

**文档编号**: 42  
**创建日期**: 2025-10-16  
**状态**: 诊断中  
**优先级**: 高

## 🎯 问题描述

用户报告:**即使工具已经完整注册,在实际测试中 `use_subagent` 工具也没有被触发。**

## ✅ 已确认完整的部分

通过代码检查,发现以下部分**都已正确实现**:

### 1. 类型定义 ✅

**文件**: `packages/types/src/tool.ts` Line 39

```typescript
"use_subagent",
```

### 2. 工具参数定义 ✅

**文件**: `src/shared/tools.ts`

- Lines 70-71: 参数名定义 (`agent_name`, `task`, `context`)
- Lines 181-184: `UseSubagentToolUse` 接口
- Line 214: 显示名称 "use subagents"
- Line 255: 添加到 `ALWAYS_AVAILABLE_TOOLS`

### 3. 工具描述 ✅

**文件**: `src/core/prompts/tools/use-subagent.ts`

- 完整的工具描述(Lines 1-62)
- 3个子代理的详细说明
- 参数说明
- 使用示例

### 4. 工具描述映射 ✅

**文件**: `src/core/prompts/tools/index.ts`

- Line 30: 导入 `getUseSubagentDescription`
- Line 64: 注册到 `toolDescriptionMap`

### 5. 工具执行处理 ✅

**文件**: `src/core/tools/useSubagentTool.ts`

- 完整的执行逻辑(Lines 1-123)
- 参数验证
- 用户批准
- SubAgentExecutor 调用
- 结果格式化

### 6. 执行分发 ✅

**文件**: `src/core/assistant-message/presentAssistantMessage.ts` Lines 565-567

```typescript
case "use_subagent":
    await useSubagentTool(cline, block as any, askApproval, handleError, pushToolResult, removeClosingTag)
    break
```

### 7. 系统提示 ✅

**文件**: `src/core/prompts/sections/subagents.ts`

- 完整的子代理说明(Lines 1-123)
- 但这个提示**不是工具描述**,而是额外的说明

**文件**: `src/core/prompts/system.ts` Line 116

```typescript
${getSubagentsSection()}
```

## ❓ 可能的问题

### 问题 1: 系统提示中的工具描述是否包含了 use_subagent?

需要验证: `getToolDescriptionsForMode()` 是否真的把 `use_subagent` 包含在返回的工具列表中?

**检查点**:

1. `ALWAYS_AVAILABLE_TOOLS` 是否正确工作?
2. 工具描述是否被正确生成?
3. 是否有某个配置项禁用了这个工具?

### 问题 2: LLM 是否看到了工具描述?

即使工具注册了,如果系统提示中没有包含工具描述,LLM 也不会知道如何使用。

**验证方法**:

- 打印生成的完整系统提示
- 检查是否包含 `## use_subagent` 部分

### 问题 3: 模式限制?

某些模式可能限制了可用工具。需要检查当前使用的模式是否允许 `use_subagent`。

**检查点**:

- 当前使用的是什么模式? (code/architect/ask等)
- 该模式的 `groups` 配置是什么?
- `use_subagent` 在 `ALWAYS_AVAILABLE_TOOLS` 中,理论上应该对所有模式可用

### 问题 4: 实验性功能开关?

类似 `generate_image` 和 `run_slash_command`,可能需要实验性功能开关?

**检查**: `src/core/prompts/tools/index.ts` Lines 139-146

```typescript
// Conditionally exclude generate_image if experiment is not enabled
if (!experiments?.imageGeneration) {
	tools.delete("generate_image")
}

// Conditionally exclude run_slash_command if experiment is not enabled
if (!experiments?.runSlashCommand) {
	tools.delete("run_slash_command")
}
```

需要检查是否有类似的逻辑排除了 `use_subagent`。

## 🔍 调试步骤

### Step 1: 添加调试日志

在 `src/core/prompts/tools/index.ts` 的 `getToolDescriptionsForMode()` 函数中添加日志:

```typescript
export function getToolDescriptionsForMode(...) {
    // ... existing code ...

    // Add debug logging
    console.log('[getToolDescriptionsForMode] Final tools:', Array.from(tools))
    console.log('[getToolDescriptionsForMode] use_subagent included?', tools.has('use_subagent'))

    return `# Tools\n\n${descriptions.filter(Boolean).join("\n\n")}`
}
```

### Step 2: 验证系统提示生成

在 `src/core/prompts/system.ts` 中添加日志:

```typescript
const basePrompt = `${roleDefinition}

${markdownFormattingSection()}

${getSharedToolUseSection()}

${getToolDescriptionsForMode(...)}
// ADD DEBUG HERE
console.log('[SYSTEM_PROMPT] Tool descriptions length:', toolDescriptions.length)
```

### Step 3: 测试工具调用

创建一个简单的测试,直接尝试调用工具:

```typescript
// test-use-subagent.ts
const toolUse: UseSubagentToolUse = {
    type: "tool_use",
    name: "use_subagent",
    params: {
        agent_name: "condense-context-analyzer"
    },
    partial: false
}

// 模拟调用
await useSubagentTool(mockCline, toolUse, ...)
```

## 📋 下一步行动

1. [ ] 添加调试日志确认工具是否在列表中
2. [ ] 打印完整的系统提示查看工具描述
3. [ ] 检查是否有实验性开关或配置项
4. [ ] 验证当前模式的工具权限
5. [ ] 创建单元测试验证工具执行
6. [ ] 如果工具在列表中但LLM不调用,可能是提示词问题

## 🤔 可能的根本原因

### 假设 1: 工具描述生成但LLM不理解

- 工具描述可能太复杂
- LLM 可能更倾向使用文本检测(Task.ts 中的 detectSubAgentIntent)

### 假设 2: 工具被意外排除

- 某个条件判断导致工具从最终列表中删除
- 需要逐步调试确认

### 假设 3: 系统提示冲突

- `getSubagentsSection()` 和工具描述可能产生混淆
- LLM 看到两种不同的调用方式(文本提及 vs 工具调用)

## 💡 建议

根据之前的搜索结果,发现 `Task.ts` 中已经实现了**文本检测机制**:

- Lines 3747-3836: `detectSubAgentIntent()` 方法
- Lines 3843-3913: `executeSubAgentByIntent()` 方法
- Lines 2499-2563: 流式完成后检测逻辑

**这表明系统同时支持两种方式**:

1. ✅ 文本检测(已实现,在流式完成后执行)
2. ✅ 工具调用(已实现,通过 use_subagent 工具)

**问题可能是**: LLM 在两种方式之间不知道选择哪个,或者工具描述没有被正确包含在系统提示中。

## 🎯 立即验证项

让我先验证最关键的一点:工具描述是否真的出现在系统提示中?
