# 上下文溢出自动恢复策略

## 问题背景

**症状**：

- 压缩前：246,335 tokens
- 压缩后：245,348 tokens
- 压缩率：仅 0.4%（几乎无效）
- 错误：`Input is too long for requested model`
- 结果：任务卡死，不断重试

**根本原因**：
用户开启了多文件读取功能，Roo 一次性读取了大量文件，导致：

1. 上下文迅速膨胀
2. 压缩算法无法有效减少 token（因为都是新内容）
3. 超出模型上下文窗口限制

## 现有保护机制

### 1. 文件大小限制 ✅ (已实现)

位置：`src/core/tools/helpers/fileSizeHelpers.ts`

```typescript
// 当前限制
SINGLE_FILE_MAX_BYTES: 1024 * 1024,      // 单文件 1MB
BATCH_TOTAL_MAX_BYTES: 2 * 1024 * 1024,  // 批量总计 2MB
```

**问题**：

- 这个限制还不够严格
- 2MB 的批量读取 ≈ 500K tokens，加上已有对话上下文很容易溢出

### 2. 上下文压缩 ✅ (已实现但失效)

位置：`src/core/task/Task.ts` 第3095-3549行

**问题**：

- 压缩率仅 0.4%，说明内容都是新的无法压缩
- 压缩发生在 **读取之后**，为时已晚

## 解决方案

### 方案 A：降低批量读取限制（立即实施）

**目标**：从源头防止上下文溢出

**修改文件**：`src/core/tools/helpers/fileSizeHelpers.ts`

```typescript
export const FILE_SIZE_LIMITS = {
	// 单文件限制 - 保持不变
	SINGLE_FILE_WARNING_BYTES: 100 * 1024, // 100 KB
	SINGLE_FILE_MAX_BYTES: 1024 * 1024, // 1 MB

	// ⚠️ 批量读取限制 - 大幅降低
	BATCH_TOTAL_WARNING_BYTES: 200 * 1024, // 从 500KB 降至 200KB
	BATCH_TOTAL_MAX_BYTES: 500 * 1024, // 从 2MB 降至 500KB ⭐核心改进

	// Token 估算
	BYTES_PER_TOKEN: 4,
}
```

**影响分析**：

- 500KB ≈ 125K tokens
- 加上对话历史（假设 50K），总计 ~175K tokens
- 对于 200K 上下文窗口的模型，留有 25K 的安全边距
- 对于 128K 窗口的模型，会触发警告但不会完全溢出

**优点**：
✅ 简单有效，立即生效  
✅ 不需要修改核心逻辑  
✅ 保留了批量读取能力，只是限制更严格

**缺点**：
❌ 可能需要多次读取大型代码库  
❌ 降低了一些便利性

---

### 方案 B：智能上下文预算系统（推荐）

**目标**：动态计算可用上下文，智能分配读取额度

**实现位置**：`src/core/task/Task.ts` 新增方法

```typescript
/**
 * 计算当前可用的上下文预算
 * @returns 可安全使用的 token 数量
 */
private getAvailableContextBudget(): number {
  const modelInfo = this.api.getModel().info
  const contextWindow = modelInfo.contextWindow || 128000
  const maxOutputTokens = getModelMaxOutputTokens({
    modelId: this.api.getModel().id,
    model: modelInfo,
    settings: this.apiConfiguration
  })

  // 获取当前已使用的 token
  const { contextTokens: usedTokens = 0 } = this.getTokenUsage()

  // 计算可用预算：上下文窗口 - 已用 token - 输出预留 - 安全边距
  const safetyMargin = contextWindow * 0.15 // 15% 安全边距
  const available = contextWindow - usedTokens - maxOutputTokens - safetyMargin

  return Math.max(0, available)
}

/**
 * 检查批量读取是否会导致上下文溢出
 * @param filePaths 要读取的文件路径列表
 * @returns 检查结果
 */
async checkBatchReadContextSafety(filePaths: string[]): Promise<{
  safe: boolean
  estimatedTokens: number
  availableTokens: number
  warningMessage?: string
}> {
  const available = this.getAvailableContextBudget()

  // 估算文件总大小
  const fullPaths = filePaths.map(p => path.resolve(this.cwd, p))
  const batchCheck = await checkBatchFileSizeForRead(fullPaths)

  const estimatedTokens = batchCheck.totalEstimatedTokens
  const utilizationRatio = estimatedTokens / available

  if (utilizationRatio > 1.0) {
    return {
      safe: false,
      estimatedTokens,
      availableTokens: available,
      warningMessage:
        `⛔ **上下文预算不足**\n\n` +
        `- 需要读取：~${estimatedTokens.toLocaleString()} tokens\n` +
        `- 当前可用：~${Math.floor(available).toLocaleString()} tokens\n` +
        `- 超出比例：${((utilizationRatio - 1) * 100).toFixed(0)}%\n\n` +
        `**建议**：\n` +
        `1. 减少读取的文件数量（当前 ${filePaths.length} 个）\n` +
        `2. 使用 line_range 只读取必要部分\n` +
        `3. 使用 list_code_definition_names 先了解结构\n` +
        `4. 先压缩当前对话再继续`
    }
  }

  if (utilizationRatio > 0.7) {
    return {
      safe: true,
      estimatedTokens,
      availableTokens: available,
      warningMessage:
        `⚠️ **上下文使用率较高**\n\n` +
        `- 将要读取：~${estimatedTokens.toLocaleString()} tokens\n` +
        `- 当前可用：~${Math.floor(available).toLocaleString()} tokens\n` +
        `- 使用率：${(utilizationRatio * 100).toFixed(0)}%\n\n` +
        `建议考虑是否需要读取所有这些文件`
    }
  }

  return { safe: true, estimatedTokens, availableTokens: available }
}
```

**集成到 readFileTool**：

在 `src/core/tools/readFileTool.ts` 第210行后添加：

```typescript
// 在批量读取前检查上下文预算
if (fileResults.length > 1) {
	const contextCheck = await cline.checkBatchReadContextSafety(fileResults.map((r) => r.path))

	if (!contextCheck.safe) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("read_file")
		await handleError("reading files", new Error(contextCheck.warningMessage || "Context budget exceeded"))
		pushToolResult(`<files><error>${contextCheck.warningMessage}</error></files>`)
		return
	}

	if (contextCheck.warningMessage) {
		// 显示警告但允许继续
		await cline.say("text", contextCheck.warningMessage, undefined, false, undefined, undefined, {
			isNonInteractive: true,
		})
	}
}
```

**优点**：
✅ 动态适应当前对话状态  
✅ 提供精确的上下文预算信息  
✅ 给出明确的改进建议  
✅ 在问题发生前主动预防

**缺点**：
❌ 需要更多代码改动  
❌ Token 估算可能不够精确

---

### 方案 C：上下文溢出紧急恢复（兜底方案）

**目标**：当真正发生溢出时，自动恢复到安全状态

**实现位置**：`src/core/task/Task.ts`

```typescript
// 在 Task 类中添加
private contextOverflowCount: number = 0
private readonly MAX_CONTEXT_OVERFLOW_RETRIES = 3

/**
 * 处理上下文溢出的紧急恢复
 */
private async handleContextOverflowEmergency(): Promise<void> {
  console.error(`[Task#${this.taskId}] Context overflow detected, initiating emergency recovery`)

  this.contextOverflowCount++

  if (this.contextOverflowCount > this.MAX_CONTEXT_OVERFLOW_RETRIES) {
    // 超过最大重试次数，停止任务
    await this.say('error',
      `⛔ **多次上下文溢出，任务已停止**\n\n` +
      `**原因分析**：\n` +
      `- 一次性读取了过多文件\n` +
      `- 对话历史过长无法压缩\n\n` +
      `**解决方案**：\n` +
      `1. 重新开始任务，使用更精确的文件定位\n` +
      `2. 使用 codebase_search 而不是 read_file\n` +
      `3. 使用 list_code_definition_names 先了解结构\n` +
      `4. 分多个子任务完成，避免单个任务过长`
    )
    await this.abortTask()
    return
  }

  // 激进压缩：只保留最近10条消息
  const recentMessages = this.clineMessages.slice(-10)
  const initialTask = this.clineMessages.find(m => m.type === 'say' && m.say === 'text')

  const preservedMessages = initialTask
    ? [initialTask, ...recentMessages]
    : recentMessages

  await this.overwriteClineMessages(preservedMessages)
  await this.overwriteApiConversationHistory([])

  await this.say('text',
    `⚠️ **上下文溢出已自动恢复**\n\n` +
    `**恢复措施**：\n` +
    `- 已清理对话历史，仅保留初始任务和最近10条消息\n` +
    `- 当前重试次数：${this.contextOverflowCount}/${this.MAX_CONTEXT_OVERFLOW_RETRIES}\n\n` +
    `**建议**：\n` +
    `- 避免一次性读取过多文件\n` +
    `- 使用 line_range 参数指定需要的行\n` +
    `- 优先使用 search_files 定位代码\n\n` +
    `请重新描述你的需求，我会采用更节省上下文的方式完成任务。`
  )
}
```

**在 attemptApiRequest 中集成**（第3425行附近）：

```typescript
catch (error) {
  this.isWaitingForFirstChunk = false

  // 检测上下文溢出错误
  const isContextError =
    error.message?.includes('too long') ||
    error.message?.includes('context') ||
    error.message?.includes('Input is too long') ||

```
