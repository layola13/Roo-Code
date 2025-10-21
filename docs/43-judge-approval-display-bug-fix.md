# 裁判系统判断显示错误修复

## 问题描述

用户报告了一个严重的 bug：裁判系统返回 `"approved": false`（表示拒绝任务完成），但 UI 却显示 `✅ Judge Approval`（表示批准通过）。

### 问题示例

````
✅ Judge Approval
Decision: Task completion approved

Reasoning: ```json
{
"approved": false,
"reasoning": "任务完全未完成。"
}
````

````

虽然 JSON 中明确显示 `"approved": false`，但系统仍然显示为批准状态。

## 根本原因分析

问题出在 [`JudgeService.ts`](../src/core/judge/JudgeService.ts) 的 `parseMarkdownResponse()` 方法中。

### 原始代码逻辑（第 140-155 行）

```typescript
const decisionMatch = response.match(/Decision:\s*(.+?)(?:\n|$)/i)
if (decisionMatch) {
    const decision = decisionMatch[1].toLowerCase()
    approved = decision.includes("approved") || decision.includes("批准")
} else {
    // 回退逻辑...
}
````

**问题**：代码只检查 Decision 字段是否包含 "approved" 词，但**没有检查是否有 "not approved" 或 "rejected"**。

当 Decision 为 "Task completion approved" 时，即使 JSON 中 `approved: false`，Markdown 解析逻辑也会错误地将其识别为批准。

## 修复方案

### 1. 改进判断逻辑

修改 `parseMarkdownResponse()` 方法，**优先检查拒绝关键词**，然后再检查批准关键词：

```typescript
if (decisionMatch) {
	const decision = decisionMatch[1].toLowerCase()
	// 必须先检查拒绝关键词，因为可能会出现 "not approved" 或 "rejected" 的情况
	if (
		decision.includes("rejected") ||
		decision.includes("拒绝") ||
		decision.includes("not approved") ||
		decision.includes("denied")
	) {
		approved = false
	} else if (decision.includes("approved") || decision.includes("批准")) {
		approved = true
	} else {
		// 如果 Decision 字段既不包含批准也不包含拒绝关键词，默认为拒绝
		approved = false
	}
}
```

### 2. 安全默认值

当无法明确判断时，**默认为拒绝（`approved = false`）**，这样更安全，避免误判导致未完成的任务被错误批准。

## 修改文件

- **主要修改**：[`src/core/judge/JudgeService.ts`](../src/core/judge/JudgeService.ts) 第 140-169 行
- **测试增强**：[`src/core/judge/__tests__/JudgeService.test.ts`](../src/core/judge/__tests__/JudgeService.test.ts) 添加了 4 个新测试用例

## 测试用例

### 新增测试用例

1. **Bug 场景复现测试**：测试 Decision 包含 "approved" 但 JSON 显示 `approved: false` 的情况
2. **"not approved" 测试**：测试 Decision 为 "not approved" 的情况
3. **"denied" 测试**：测试 Decision 为 "denied" 的情况
4. **模糊判断测试**：测试 Decision 字段模糊不清时，默认拒绝的行为

### 测试结果

```bash
✓ Test Files  1 passed (1)
✓ Tests  30 passed (30)
```

所有测试通过，包括新增的 4 个针对性测试用例。

## 影响范围

### 受影响的功能

- 裁判模式 (Judge Mode) 的任务完成判断
- Markdown 格式响应的解析逻辑

### 向后兼容性

- ✅ 完全兼容，不影响现有正确的判断逻辑
- ✅ JSON 格式响应优先级不变（JSON 解析优先于 Markdown）
- ✅ 只修复了 Markdown 解析中的判断错误

### 用户体验改进

- ✅ 修复了误将拒绝显示为批准的严重 bug
- ✅ 提高了判断准确性，避免误判
- ✅ 增强了系统的安全性（默认拒绝而非默认批准）

## 关键改进点

1. **优先级正确**：先检查拒绝关键词，再检查批准关键词
2. **关键词完整**：支持 "rejected"、"not approved"、"denied" 等多种拒绝表达
3. **安全默认**：无法判断时默认为拒绝，避免误判
4. **测试覆盖**：添加了针对性测试用例，确保修复有效

## 验证步骤

1. 运行单元测试：

    ```bash
    cd src && npx vitest run core/judge/__tests__/JudgeService.test.ts
    ```

2. 手动测试场景：
    - 创建一个会被裁判拒绝的任务
    - 确认 UI 正确显示拒绝状态（❌ 或 ⚠️）
    - 确认不会出现 ✅ Judge Approval 的错误显示

## 相关文档

- [裁判模式 Markdown 解析修复](./22-judge-markdown-parsing-fix.md)
- [裁判模式需求文档](./12-judge-mode-requirements.md)
- [裁判模式 Bug 修复](./20-judge-mode-bug-fixes.md)

## 总结

这次修复解决了一个严重的用户体验问题：裁判系统的判断结果显示错误。通过改进 Markdown 解析逻辑，正确处理拒绝关键词的优先级，并添加全面的测试覆盖，确保了裁判系统的判断准确性和可靠性。
