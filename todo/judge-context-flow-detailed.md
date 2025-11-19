# 裁判任务上下文处理详细流程说明

## 📋 文档目的

详细说明裁判系统如何构建上下文、压缩信息，并最终调用大模型判断任务是否完成。

---

## 1. 完整调用流程图

```
用户任务执行
    ↓
attempt_completion 工具调用
    ↓
检查是否启用裁判 (shouldInvokeJudge)
    ↓ [已启用]
开始构建上下文
    ↓
┌─────────────────────────────────────────┐
│  阶段1: 构建增强任务描述                  │
│  - 收集父任务/根任务信息（如果是子任务）   │
│  - 提取原始任务描述                       │
│  - 构建上下文总结（智能压缩）              │
│    • 用户反馈（最近3条，每条截断200字符）  │
│    • 完成尝试（最近2次，每次截断150字符）  │
│    • 工具使用统计（只保存计数）            │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  阶段2: 收集执行历史                      │
│  - 对话历史（只统计数量，不保存内容）      │
│  - 工具调用记录（统计类型和次数）          │
│  - 文件变更记录（列出文件路径）            │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  阶段3: 获取Git状态                       │
│  - 检查实际文件改动                       │
│  - 验证声称的修改是否真实存在              │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  阶段4: 组装TaskContext                   │
│  {                                       │
│    originalTask: string,                │
│    conversationHistory: array,          │
│    toolCalls: array,                    │
│    fileChanges: array,                  │
│    gitStatus: string,                   │
│    isSubtask: boolean                   │
│  }                                      │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  阶段5: 构建裁判提示词                    │
│  - 压缩对话历史（只保留轮数）              │
│  - 压缩工具调用（统计摘要）                │
│  - 压缩文件修改（列表）                    │
│  - 提取最近反馈（最近3条）                 │
│  - 添加Git状态（防止虚假声称）             │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  阶段6: 调用LLM                          │
│  - 发送压缩后的提示词                     │
│  - 等待LLM响应                           │
│  - Token使用：约2000 input + 500 output │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  阶段7: 解析响应                          │
│  - 尝试JSON解析                          │
│  - 回退到Markdown解析                    │
│  - 最终回退到纯文本解析                   │
└─────────────────────────────────────────┘
    ↓
返回JudgeResult
{
  approved: boolean,
  reasoning: string,
  suggestions: string[],
  missingItems: string[],
  criticalIssues: string[]
}
```

---

## 2. 上下文压缩策略详解

### 2.1 增强任务描述构建（buildEnhancedTaskDescription）

```typescript
// 输入：Task实例的完整状态
// 输出：压缩后的任务描述字符串

private buildEnhancedTaskDescription(): string {
  let desc = "";

  // 1️⃣ 如果是子任务，添加父任务上下文
  if (this.parentTask) {
    desc += "## Root Task Context\n";
    desc += this.rootTask.metadata.task || "";  // 只保留任务描述文本
    desc += "\n\n## Current Subtask\n";
  }

  // 2️⃣ 当前任务原始描述（完整保留）
  desc += this.metadata.task || "";

  // 3️⃣ 上下文总结（智能压缩）
  const summary = this.buildContextSummary();
  if (summary) {
    desc += "\n\n## Context Summary\n" + summary;
  }

  return desc;
}
```

**压缩效果示例**：

```
原始数据量：
- 父任务描述：500字符
- 当前任务描述：300字符
- 对话历史：25条消息 × 200字符 = 5000字符
- 工具调用：15次 × 50字符 = 750字符

压缩后：
- 父任务描述：500字符（保留）
- 当前任务描述：300字符（保留）
- 对话摘要：只取最近3条反馈 × 200字符 = 600字符
- 工具统计：90字符（只保存统计）

总量：500 + 300 + 600 + 90 = 1490字符
压缩比：(500+300+5000+750) / 1490 ≈ 4.4:1
```

### 2.2 上下文总结智能压缩（buildContextSummary）

```typescript
private buildContextSummary(): string {
  const parts: string[] = [];

  // 📝 用户反馈压缩策略
  const feedbacks = this.clineMessages
    .filter(m => m.type === "say" && m.say === "user_feedback")
    .map(m => m.text!)
    .slice(-3)  // ⚡ 时间窗口：只保留最近3条
    .map((fb, i) =>
      `${i+1}. ${fb.substring(0, 200)}...`  // ⚡ 长度限制：截断到200字符
    );

  if (feedbacks.length > 0) {
    parts.push("### User Feedback:\n" + feedbacks.join("\n"));
  }

  // 📝 完成尝试压缩策略
  const attempts = this.clineMessages
    .filter(m => m.say === "completion_result")
    .slice(-2)  // ⚡ 时间窗口：只保留最近2次
    .map((a, i) =>
      `${i+1}. ${a.text!.substring(0, 150)}...`  // ⚡ 长度限制：截断到150字符
    );

  if (attempts.length > 0) {
    parts.push("### Recent Attempts:\n" + attempts.join("\n"));
  }

  // 📝 工具使用压缩策略
  const toolStats = {};
  for (const msg of this.clineMessages) {
    // 统计工具类型和次数，不保存详细内容
    if (msg.text?.includes("write_to_file")) {
      toolStats["write_to_file"] = (toolStats["write_to_file"] || 0) + 1;
    }
    // ... 其他工具
  }

  const toolSummary = Object.entries(toolStats)
    .map(([tool, count]) => `- ${tool}: ${count}×`)  // ⚡ 极简格式
    .join("\n");

  if (toolSummary) {
    parts.push("### Tool Usage:\n" + toolSummary);
  }

  return parts.join("\n\n");
}
```

**压缩原理**：

1. **时间窗口过滤** - 只保留最近的N条记录
2. **长度截断** - 每条记录限制最大字符数
3. **统计汇总** - 工具使用只保存类型和次数
4. **去重合并** - 相同类型的信息合并显示

### 2.3 提示词构建压缩（buildJudgePrompt）

```typescript
// prompts.ts
export function buildJudgePrompt(
	taskContext: TaskContext,
	attemptResult: string,
	detailLevel: JudgeDetailLevel,
): string {
	// 1️⃣ 对话历史压缩：只统计数量
	const convSummary = summarizeConversationHistory(taskContext.conversationHistory)
	// 返回：{ rounds: 25, summary: "共25条消息" }
	// 原始：5000字符 → 压缩后：10字符
	// 压缩比：500:1

	// 2️⃣ 工具调用压缩：统计类型和次数
	const toolSummary = summarizeToolCalls(taskContext.toolCalls)
	// 返回："总计15次：\n- write_to_file: 5次\n- read_file: 8次"
	// 原始：750字符 → 压缩后：90字符
	// 压缩比：8:1

	// 3️⃣ 文件变更压缩：只列出路径
	const fileSummary = summarizeFileChanges(taskContext.fileChanges)
	// 返回："修改3个文件：\n- src/a.ts\n- src/b.ts"
	// 原始：600字符 → 压缩后：80字符
	// 压缩比：7.5:1

	// 4️⃣ 用户反馈压缩：最近3条，每条300字符
	const feedback = extractRecentUserFeedback(taskContext.conversationHistory)
	// 原始：5000字符 → 压缩后：900字符
	// 压缩比：5.5:1

	// 5️⃣ 组装最终提示词
	return `
你是任务审查员。

## 任务描述
${taskContext.originalTask}  // ~500字符

${feedback ? `## 用户反馈\n${feedback}` : ""}  // ~900字符

## 执行历史
对话：${convSummary.rounds}轮  // ~10字符
工具：${toolSummary}  // ~90字符
文件：${fileSummary}  // ~80字符

${taskContext.gitStatus ? `## Git状态\n${taskContext.gitStatus}` : ""}  // ~200字符

## 完成声明
${attemptResult}  // ~300字符

## 评判标准
...（固定模板 ~800字符）

请以JSON格式回复...
`
}
```

**最终Token统计**：

| 部分       | 字符数   | 估算Token       |
| ---------- | -------- | --------------- |
| 系统提示词 | 800      | ~200            |
| 任务描述   | 500      | ~125            |
| 用户反馈   | 900      | ~225            |
| 执行历史   | 180      | ~45             |
| Git状态    | 200      | ~50             |
| 完成声明   | 300      | ~75             |
| 评判标准   | 800      | ~200            |
| **总计**   | **3680** | **~920 tokens** |

加上实际内容的详细描述，最终输入约 **1500-2000 tokens**。

---

## 3. 压缩函数实现细节

### 3.1 对话历史压缩

```typescript
function summarizeConversationHistory(history: ClineMessage[]): {
	rounds: number
	summary: string
} {
	// ⚡ 极致压缩：完全不保留消息内容，只统计数量
	return {
		rounds: history.length,
		summary: `共 ${history.length} 条消息`,
	}
}
```

**为什么不保留内容？**

- 对话内容已经通过"用户反馈提取"保留了关键部分
- 完整保留会导致token激增（25条×200字符=5000字符）
- 裁判只需要知道交互的频繁程度，不需要每条详情

### 3.2 工具调用压缩

```typescript
function summarizeToolCalls(toolCalls: string[]): string {
	if (toolCalls.length === 0) return "无工具调用"

	// ⚡ 统计式压缩
	const stats: Record<string, number> = {}
	for (const tool of toolCalls) {
		stats[tool] = (stats[tool] || 0) + 1
	}

	const lines = Object.entries(stats)
		.map(([tool, count]) => `- ${tool}: ${count} 次`)
		.join("\n")

	return `总计 ${toolCalls.length} 次工具调用：\n${lines}`
}
```

**示例**：

```
输入：
["write_to_file", "read_file", "write_to_file", "execute_command",
 "read_file", "read_file", "write_to_file", ...]

输出：
"总计 15 次工具调用：
- write_to_file: 5 次
- read_file: 8 次
- execute_command: 2 次"
```

### 3.3 用户反馈提取

```typescript
function extractRecentUserFeedback(history: ClineMessage[]): string {
  // 收集所有用户反馈
  const feedbacks = history
    .filter(m => m.type === "say" && m.say === "user_feedback" && m.text)
    .map(m => m.text!);

  if (feedbacks.length === 0) return "";

  // ⚡ 双重压缩：时间窗口 + 长度限制
  const recent = feedbacks.slice(-3);  // 只取最近3条

  return recent
    .map((fb, i) => {
      const truncated
```
