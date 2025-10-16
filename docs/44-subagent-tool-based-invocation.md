# 子代理工具调用实现说明

**文档编号**: 44  
**创建日期**: 2025-10-16  
**状态**: 已实施  
**优先级**: 高

## 📋 概述

本文档说明子代理的**正确**调用方式,纠正docs/34中的错误建议。

## ❌ 错误方式:文本检测

docs/34-subagent-improvement-plan.md (Lines 128-135) 建议使用文本模式识别:

```
决策 1: 不创建新的 Tool Use Block
原因: 当前系统使用 XML prompt 而不是 Tool Use blocks
正确做法:
- 在系统提示中添加子代理可用性说明
- 让大模型在对话中主动提到需要调用子代理
- 通过文本模式识别来检测调用意图
```

**这是错误的!** 经过实际测试验证,文本检测方式**无法可靠触发**。

## ✅ 正确方式:工具调用

子代理必须通过**Tool Use机制**调用,已完整实现:

### 1. 工具定义

**文件**: `src/shared/tools.ts`

```typescript
// Line 181-184: 类型定义
export interface UseSubagentToolUse extends ToolUse {
	name: "use_subagent"
	params: Partial<Pick<Record<ToolParamName, string>, "agent_name" | "task" | "context">>
}

// Line 70-71: 参数定义
	"agent_name",
	"context",

// Line 255: 始终可用
export const ALWAYS_AVAILABLE_TOOLS: ToolName[] = [
	"ask_followup_question",
	"attempt_completion",
	"switch_mode",
	"new_task",
	"update_todo_list",
	"run_slash_command",
	"use_subagent",  // ← 子代理工具
] as const
```

### 2. 工具描述

**文件**: `src/core/prompts/tools/use-subagent.ts`

```typescript
export function getUseSubagentDescription(args: ToolArgs): string {
	return `## use_subagent
Description: Request to delegate specialized analysis tasks to a subagent...

Available subagents:
1. condense-context-analyzer - 分析对话流程
2. condense-memory-extractor - 提取关键信息
3. condense-code-summarizer - 总结代码变更

Parameters:
- agent_name: (required) 子代理名称
- task: (optional) 具体任务描述
- context: (optional) 额外上下文

Usage:
<use_subagent>
<agent_name>condense-context-analyzer</agent_name>
<task>分析对话阶段</task>
</use_subagent>`
}
```

### 3. 工具执行器

**文件**: `src/core/tools/useSubagentTool.ts`

```typescript
export async function useSubagentTool(
	cline: Task,
	block: UseSubagentToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	const { agent_name: agentName, task, context } = block.params

	// 验证agent_name
	const validAgents = ["condense-context-analyzer", "condense-memory-extractor", "condense-code-summarizer"]

	// 执行子代理
	const executor = new SubAgentExecutor(cline.api, config)
	const result = await executor.executeCompression(messagesWithTask)

	// 返回结果
	await pushToolResult(resultText)
}
```

### 4. 工具注册

**文件**: `src/core/prompts/tools/index.ts`

```typescript
// Line 64: 工具描述映射
export const toolDescriptionMap: Record<ToolName, (args: ToolArgs) => string> = {
	// ...其他工具
	use_subagent: getUseSubagentDescription,
}
```

### 5. 工具分发

**文件**: `src/core/assistant-message/presentAssistantMessage.ts`

```typescript
// Lines 565-567: 分发到执行器
case "use_subagent": {
	await useSubagentTool(cline, block as UseSubagentToolUse, askApproval, handleError, pushToolResult, removeClosingTag)
	break
}
```

## 🔍 为什么文本检测无效?

1. **LLM不会主动提及子代理名称** - 除非在Tool描述中明确说明
2. **正则检测不可靠** - 容易产生false positive和false negative
3. **UI显示问题** - 文本方式无法在UI中正确标记工具调用
4. **缺乏结构化** - 无法传递参数(task, context)

## 📊 对比

| 特性           | ❌ 文本检测      | ✅ 工具调用        |
| -------------- | ---------------- | ------------------ |
| **触发可靠性** | 低(测试无法触发) | 高(系统保证)       |
| **参数传递**   | 困难             | 完整支持           |
| **UI显示**     | 无法正确标记     | 完整工具UI         |
| **类型安全**   | 无               | 完整TypeScript类型 |
| **测试覆盖**   | 困难             | 易于测试           |
| **文档清晰**   | 模糊             | 标准工具文档       |

## 🎯 正确的调用流程

```
LLM看到工具描述中的use_subagent
    ↓
LLM决定需要子代理帮助
    ↓
LLM生成工具调用XML:
<use_subagent>
<agent_name>condense-context-analyzer</agent_name>
<task>分析当前对话结构</task>
</use_subagent>
    ↓
系统解析工具调用
    ↓
调用useSubagentTool()执行
    ↓
SubAgentExecutor执行子代理
    ↓
返回结构化结果给LLM
    ↓
LLM整合结果继续工作
```

## 📝 需要删除的错误代码

以下代码基于错误的文本检测方式,**应该删除**:

1. ❌ `src/core/prompts/sections/subagents.ts` - 整个文件(文本检测提示)
2. ❌ `src/core/task/Task.ts`:
    - `detectSubAgentIntent()` 方法
    - `executeSubAgentByIntent()` 方法
    - 调用这两个方法的代码
3. ❌ `src/core/task/__tests__/Task.subagent-intent.test.ts` - 整个测试文件

## ✅ 保留的正确代码

以下代码是正确的工具调用实现,**必须保留**:

1. ✅ `src/shared/tools.ts` - 工具类型和参数定义
2. ✅ `src/core/prompts/tools/use-subagent.ts` - 工具描述
3. ✅ `src/core/tools/useSubagentTool.ts` - 工具执行器
4. ✅ `src/core/prompts/tools/index.ts` - 工具注册
5. ✅ `src/core/assistant-message/presentAssistantMessage.ts` - 工具分发

## 🔧 后续改进

### 短期(已完成):

- ✅ 工具完整实现
- ✅ 始终可用配置
- ✅ 执行器和分发器

### 中期(建议):

- 删除错误的文本检测代码
- 删除错误的系统提示
- 更新文档34纠正错误
- 添加UI显示子代理调用历史

### 长期(可选):

- 支持自定义子代理
- 子代理结果缓存
- 并行执行多个子代理

## 📚 相关文档

- ✅ **本文档(44)** - 正确的工具调用方式
- ❌ **docs/34-subagent-improvement-plan.md** - 包含错误建议,需要更新
- ✅ **docs/subagent2.md** - 原始正确架构
- ✅ **src/core/prompts/tools/use-subagent.ts** - 工具描述实现

## 🎉 结论

**use_subagent工具已完整实现且正确注册**。

问题不在实现,而在于:

1. 文档34的错误建议导致混淆
2. 存在无效的文本检测代码干扰

正确做法是:

- ✅ 使用工具调用机制(已实现)
- ❌ 不要使用文本检测(应删除)

## 验证清单

- [x] use_subagent在ALWAYS_AVAILABLE_TOOLS中
- [x] 工具描述已注册到toolDescriptionMap
- [x] 执行器useSubagentTool已实现
- [x] 分发器已添加case处理
- [x] 类型定义完整
- [x] 参数定义完整
- [ ] 删除错误的文本检测代码
- [ ] 更新文档34
- [ ] 添加UI显示支持
