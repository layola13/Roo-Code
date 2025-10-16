# 子代理主动调用检测时机修复

**文档编号**: 38  
**创建日期**: 2025-10-16  
**关联文档**: [34-subagent-improvement-plan.md](./34-subagent-improvement-plan.md), [37-subagent-active-invocation-diagnosis.md](./37-subagent-active-invocation-diagnosis.md)  
**状态**: ✅ 已完成

---

## 📋 问题诊断

### 根本原因

之前的实现将检测逻辑放在 [`presentAssistantMessage.ts`](../src/core/assistant-message/presentAssistantMessage.ts) 中：

```typescript
// ❌ 错误的实现位置
if (!block.partial && content) {
	const detectedAgent = cline.detectSubAgentIntent(content)
	// ...
}
```

**问题**：

1. **时机错误** - 在流式传输期间，`block.partial = true`，检测条件永远不满足
2. **标记延迟** - `block.partial = false` 只在流结束后设置（[`Task.ts:2480-2481`](../src/core/task/Task.ts:2480-2481)）
3. **检测失效** - 导致检测逻辑从未被执行

### 时间线分析

```
流式传输中:
  ├─ Block.partial = true  ❌ 检测条件不满足
  └─ presentAssistantMessage 执行检测 → 跳过

流结束后:
  ├─ Block.partial = false  ✅ 标记更新
  └─ 但检测已经错过时机
```

---

## ✅ 解决方案

### 架构改进

将检测逻辑从 `presentAssistantMessage` 移动到 [`Task.ts`](../src/core/task/Task.ts) 的流式传输完成后：

```typescript
// ✅ 正确的实现位置 (Task.ts:2499+)
// 在流结束后，所有块都已标记为 partial=false
presentAssistantMessage(this)

// 🔥 子代理主动调用检测逻辑
console.log("[SubAgent Detection] Stream completed, checking for subagent intent...")

// 合并所有文本块的内容
const allTextContent = this.assistantMessageContent
	.filter((block) => block.type === "text")
	.map((block) => block.content)
	.join("\n\n")

if (allTextContent) {
	const detectedAgent = this.detectSubAgentIntent(allTextContent)

	if (detectedAgent) {
		// 执行子代理...
	}
}
```

### 关键改进

1. **正确的时机** - 在流完成后执行检测，此时所有块都是完整的
2. **完整的内容** - 合并所有文本块，避免错过跨块的表达式
3. **简化逻辑** - 不再依赖 `partial` 标记，直接在正确时机执行
4. **清晰的流程** - 检测 → 通知 → 执行 → 返回结果

---

## 📝 代码变更

### 修改文件 1: `presentAssistantMessage.ts`

**删除**: 不正确的检测逻辑（Lines 156-206）

```diff
- // 检测子代理调用意图（仅在完整块时检测，避免在流式传输中重复检测）
- if (!block.partial && content) {
-     const detectedAgent = cline.detectSubAgentIntent(content)
-     // ... 50+ lines of detection logic
- }
```

### 修改文件 2: `Task.ts`

**添加**: 在流结束后检测（Line 2499+）

```typescript
// 🔥 子代理主动调用检测逻辑（流式传输完成后执行）
console.log("[SubAgent Detection] Stream completed, checking for subagent intent...")

const allTextContent = this.assistantMessageContent
	.filter((block) => block.type === "text")
	.map((block) => block.content)
	.join("\n\n")

if (allTextContent) {
	const detectedAgent = this.detectSubAgentIntent(allTextContent)

	if (detectedAgent) {
		// 通知用户
		await this.say("text", `\n\n🤖 **Detected subagent invocation intent: ${detectedAgent}**\n*Executing...*\n`)

		// 执行子代理
		const result = await this.executeSubAgentByIntent(detectedAgent)

		if (result && result.success) {
			// 添加结果到用户消息
			this.userMessageContent.push({
				type: "text",
				text: `\n[SubAgent ${detectedAgent} Result]\n${result.output || "(No output returned)"}`,
			})

			// 通知成功
			await this.say("text", `\n✅ **SubAgent ${detectedAgent} execution completed successfully**\n...`)
		} else {
			// 处理失败情况
			await this.say("text", `\n❌ **SubAgent ${detectedAgent} execution failed**\n`)
		}
	}
}
```

---

## 🧪 验证测试

### 类型检查

```bash
cd src && npx tsc --noEmit
# ✅ Exit code: 0 (无错误)
```

### 单元测试

现有的单元测试继续通过：

- `src/core/task/__tests__/subagent-intent-detection.spec.ts` ✅

---

## 📊 预期效果

### Before (❌ 检测失败)

```
User: "请调用 condense-context-analyzer 子代理"
  ↓
Assistant: 流式输出 "好的，让我调用 condense-context-analyzer 子代理..."
  ↓
presentAssistantMessage 执行
  ├─ block.partial = true ❌ 跳过检测
  └─ 检测从未执行
  ↓
流结束，但检测已错过
```

### After (✅ 检测成功)

```
User: "请调用 condense-context-analyzer 子代理"
  ↓
Assistant: 流式输出 "好的，让我调用 condense-context-analyzer 子代理..."
  ↓
流结束
  ├─ block.partial = false ✅ 所有块标记完整
  └─ presentAssistantMessage 完成
  ↓
检测逻辑执行 ✅
  ├─ 合并所有文本块
  ├─ 检测到: "condense-context-analyzer"
  ├─ 执行子代理
  └─ 返回结果到对话
```

---

## 🎯 核心要点

### 1. 检测时机至关重要

不能在流式传输中检测，必须等流完成后：

- 流式传输中：内容不完整，标记为 `partial=true`
- 流结束后：内容完整，标记更新为 `partial=false`

### 2. 合并所有文本块

避免跨块的表达式被遗漏：

```typescript
const allTextContent = this.assistantMessageContent
	.filter((block) => block.type === "text")
	.map((block) => block.content)
	.join("\n\n")
```

### 3. 清晰的日志记录

添加详细的 console.log 便于调试：

```typescript
console.log("[SubAgent Detection] Stream completed...")
console.log("[SubAgent Detection] Combined text length:", allTextContent.length)
console.log("[SubAgent Detection] Detection result:", detectedAgent || "null")
```

---

## 📚 相关文档

- [34-subagent-improvement-plan.md](./34-subagent-improvement-plan.md) - 整体改进方案
- [37-subagent-active-invocation-diagnosis.md](./37-subagent-active-invocation-diagnosis.md) - 问题诊断过程
- [subagent2.md](./subagent2.md) - 正确的子代理架构

---

## ✅ 完成标准

- [x] 移除 `presentAssistantMessage.ts` 中的检测逻辑
- [x] 在 `Task.ts` 流结束后添加检测逻辑
- [x] 合并所有文本块避免遗漏
- [x] 添加详细的日志记录
- [x] 通过类型检查 (`npx tsc --noEmit`)
- [x] 单元测试继续通过
- [ ] 实际运行测试验证效果

---

## 🚀 下一步

1. **手动测试** - 实际运行验证检测是否工作
2. **收集日志** - 查看控制台输出确认执行流程
3. **优化体验** - 根据测试结果调整提示和反馈
4. **更新文档** - 完善用户指南和开发文档
