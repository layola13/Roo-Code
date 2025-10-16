# 子代理主动调用功能 - 诊断报告

**文档编号**: 37  
**创建日期**: 2025-10-16  
**状态**: 功能说明与故障排查  
**关联文档**: [34-subagent-improvement-plan.md](./34-subagent-improvement-plan.md), [34-subagent-todolist.md](./34-subagent-todolist.md)

---

## 📋 问题现象

用户测试后发现TaskHeader显示:

```
子代理: 启用 (3/3 子代理激活)
尚未触发压缩。点击上方压缩按钮可触发。
```

**用户疑问**: 为什么主动调用功能没有触发?

---

## ✅ 实现状态确认

所有代码已正确实现:

| 模块          | 位置                                                   | 状态      |
| ------------- | ------------------------------------------------------ | --------- |
| 意图检测      | `Task.ts:3681-3704`                                    | ✅ 已实现 |
| 主动执行      | `Task.ts:3711-3781`                                    | ✅ 已实现 |
| 消息集成      | `presentAssistantMessage.ts:156-192`                   | ✅ 已实现 |
| 被动记录位置1 | `Task.ts:1238-1250` (condenseContext)                  | ✅ 已实现 |
| 被动记录位置2 | `Task.ts:2773-2786` (handleContextWindowExceededError) | ✅ 已实现 |
| 被动记录位置3 | `Task.ts:2927-2939` (attemptApiRequest)                | ✅ 已实现 |
| UI可视化      | `TaskHeader.tsx`                                       | ✅ 已实现 |
| 单元测试      | 24/24 tests passed                                     | ✅ 已验证 |

---

## 🔍 根因分析

### 子代理有两种触发方式

#### 1. 被动压缩 (auto_compress) ❌ 未触发

**触发条件**:

- 上下文使用率达到阈值(默认80-90%)
- 或发生上下文窗口溢出错误

**用户当前状态**:

```
上下文长度: 16.6k / 120.0k = 13.8%
```

**结论**: 上下文使用率仅13.8%,远未达到触发阈值,所以系统**不会**自动触发被动压缩。

**代码位置**:

- `Task.ts:2891-2921` - 在`attemptApiRequest()`中检查阈值
- 只有当`contextTokens / contextWindow > threshold`时才会触发

#### 2. 主动调用 (tool_call) ❌ 未触发

**触发条件**:

- 大模型在输出文本中**明确提到**要调用子代理
- 例如: "Let me call the condense-context-analyzer subagent..."

**检测逻辑** (`Task.ts:3681-3704`):

```typescript
public detectSubAgentIntent(text: string): string | null {
    const subagents = [
        'condense-context-analyzer',
        'condense-memory-extractor',
        'condense-code-summarizer'
    ]

    for (const agent of subagents) {
        // 匹配: "call/invoke/use ... agent"
        const regex = new RegExp(
            `(?:call(?:ing)?|invok(?:e|ed|ing)|us(?:e|ing)).*?${agent}|${agent}.*?(?:subagent|agent)`,
            'i'
        )
        if (regex.test(text)) {
            return agent
        }
    }
    return null
}
```

**用户当前状态**:

- 大模型在这次任务的输出中**没有提到**任何子代理名称
- `detectSubAgentIntent()`返回`null`
- 主动调用**不会**触发

**结论**: 这是**大模型的决策**,不是代码bug。大模型认为当前任务不需要调用子代理。

---

## 🎯 这是正常行为

**是的,完全正常!** 原因:

### 设计理念: 按需调用

子代理的设计目标是"智能按需调用",而不是"强制每次调用":

1. **被动压缩**: 只在上下文快满时触发(节省成本)
2. **主动调用**: 只在大模型认为需要时触发(智能决策)

### 与其他工具的对比

| 工具类型          | 触发方式       | 是否每次都执行 |
| ----------------- | -------------- | -------------- |
| `write_to_file`   | 大模型决定使用 | ❌ 按需        |
| `read_file`       | 大模型决定使用 | ❌ 按需        |
| `execute_command` | 大模型决定使用 | ❌ 按需        |
| **子代理压缩**    | 大模型决定使用 | ❌ 按需        |

子代理的行为与其他工具**完全一致** - 都是按需使用,不是强制执行。

### 为什么大模型没有调用?

可能的原因:

1. **任务太简单**: 不需要分析上下文就能完成
2. **上下文尚未复杂**: 对话还不够长(13.8%使用率)
3. **任务类型不匹配**: 子代理设计用于长对话、复杂任务、多阶段项目
4. **提示词优先级**: 大模型优先完成任务,而不是先分析上下文

---

## ✅ 如何验证功能正常?

### 方法1: 单元测试(已验证)

运行测试确认代码逻辑正确:

```bash
cd src && npx vitest run core/task/__tests__/Task.subagent-intent.test.ts
```

**结果**: ✅ 24/24 tests passed

### 方法2: 手动测试检测逻辑

在Node环境或浏览器控制台测试:

```javascript
const text1 = "Let me call the condense-context-analyzer subagent"
const text2 = "I will invoke condense-memory-extractor"
const text3 = "Using condense-code-summarizer to compress"
const text4 = "Completing the task now" // 不应触发

// 测试正则表达式
const detectIntent = (text) => {
	const agents = ["condense-context-analyzer", "condense-memory-extractor", "condense-code-summarizer"]
	for (const agent of agents) {
		const regex = new RegExp(
			`(?:call(?:ing)?|invok(?:e|ed|ing)|us(?:e|ing)).*?${agent}|${agent}.*?(?:subagent|agent)`,
			"i",
		)
		if (regex.test(text)) return agent
	}
	return null
}

console.log(detectIntent(text1)) // 应返回 'condense-context-analyzer'
console.log(detectIntent(text2)) // 应返回 'condense-memory-extractor'
console.log(detectIntent(text3)) // 应返回 'condense-code-summarizer'
console.log(detectIntent(text4)) // 应返回 null
```

### 方法3: 创建能触发主动调用的任务

**推荐测试场景**:

```
任务: 重构整个项目的架构

步骤:
1. 阅读所有核心文件(至少20个文件)
2. 分析当前架构的优缺点
3. 设计新的架构方案
4. 逐步重构代码
5. 验证改进效果

要求: 在每个阶段结束时,明确调用相应的子代理来整理信息:
- 阶段1-2结束: 调用 condense-context-analyzer 分析对话结构
- 阶段3结束: 调用 condense-memory-extractor 保存设计决策
- 阶段4结束: 调用 condense-code-summarizer 总结代码变更
```

**为什么这个任务能触发**:

- 多阶段,对话会很长
- 明确要求在特定时机调用子代理
- 复杂度高,大模型更可能主动分析上下文

### 方法4: 直接命令大模型调用

在对话中输入:

```
请调用 condense-context-analyzer 子代理来分析我们当前对话的结构。
```

或英文:

```
Please call the condense-context-analyzer subagent to analyze our conversation structure.
```

**预期行为**:

1. 大模型输出包含"call condense-context-analyzer"
2. `detectSubAgentIntent()`检测到意图
3. 执行子代理
4. UI显示调用记录(带"🛠 工具调用"标签)

### 方法5: 触发被动压缩

点击TaskHeader中的压缩按钮:

- 手动触发`condenseContext()`
- 执行所有启用的子代理
- UI显示调用记录(带"⚡ 自动压缩"标签)

---

## 📊 功能设计理念

### 主动调用 vs 被动压缩

| 特性     | 主动调用 (tool_call)     | 被动压缩 (auto_compress) |
| -------- | ------------------------ | ------------------------ |
| 触发方式 | 大模型主动决策           | 系统自动触发             |
| 时机     | 任何时候(如果大模型选择) | 达到阈值时               |
| 频率     | 低(可选)                 | 低(仅在需要时)           |
| 可见性   | 高(显示执行过程)         | 中(后台执行)             |
| 灵活性   | 高(可选择特定子代理)     | 中(执行所有启用的)       |
| 智能性   | 高(大模型判断时机)       | 中(基于阈值)             |

### 设计目标

1. **成本效益**: 不在每次对话都压缩,避免不必要的API调用
2. **智能决策**: 让大模型决定何时需要分析上下文
3. **用户控制**: 用户可以手动触发压缩
4. **透明度**: 所有调用都记录并可视化

---

## 🚀 下一步建议

### 对于用户

1. **继续使用**: 功能正常,等待自然触发
2. **手动测试**: 使用方法4直接命令大模型调用
3. **复杂任务**: 尝试方法3的多阶段任务
4. **手动压缩**: 点击UI中的压缩按钮验证被动压缩

### 对于开发

1. ✅ **核心功能**: 已完成并测试通过
2. ⚠️ **文档补充**: 需要在用户手册中说明触发机制
3. ⚠️ **提示词优化**: 考虑在SYSTEM_PROMPT中更明确地引导大模型使用子代理
4. 💡 **配置选项**: 考虑添加"主动调用频率"配置

---

## 📝 总结

**核心结论**:

1. ✅ 代码实现正确,所有功能已按计划完成
2. ✅ 单元测试全部通过(24/24)
3. ✅ 用户看到的"尚未触发"是**正常行为**,不是bug
4. ✅ 子代理是"按需调用",不是"强制调用"

**用户反馈**:

"尚未触发"是因为:

- 上下文使用率太低(13.8% < 80%阈值)
- 大模型在这次任务中没有选择调用子代理

**这是完全符合设计预期的行为!**
