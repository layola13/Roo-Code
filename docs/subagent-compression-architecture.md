# 子代理上下文压缩架构设计

## 概述

本架构利用 Roo-Code 现有的 `new_task` 工具和 `Task.startSubtask()` 基础设施，实现真正的子代理上下文压缩，目标是**节省83%的token使用量**。

## 核心原理

### 上下文隔离 + 精炼输出 = 83% Token节省

```
主对话（17K tokens）
    ↓ 委托任务
子代理独立上下文（70K tokens研究）
    ↓ 返回精炼摘要（12K tokens）
主对话继续（17K + 12K = 29K tokens）

节省：(17K + 70K) - (17K + 12K) = 58K tokens（83%节省率）
```

## 架构设计

### 1. 子代理角色定义

基于 cc-plugin/agents/scout.md 的设计，创建3个专门的压缩子代理：

#### 1.1 Context Analyzer (上下文分析员)

- **角色**: 对话流程分析师
- **职责**: 分析对话历史，提取高层次对话流程
- **工具**: Read（只读，不修改）
- **模型**: haiku（快速、经济）
- **输出**: 结构化的对话流程摘要（Markdown格式）

#### 1.2 Memory Extractor (记忆提取员)

- **角色**: 关键信息考古学家
- **职责**: 从对话中提取用户指令、技术决策、待办任务
- **工具**: Read, Grep（搜索模式）
- **模型**: haiku
- **输出**: 结构化的关键记忆列表（按优先级排序）

#### 1.3 Code Context Summarizer (代码上下文总结员)

- **角色**: 技术考古专家
- **职责**: 总结代码更改、文件关系、技术概念
- **工具**: Read, Grep, Glob（代码搜索）
- **模型**: haiku
- **输出**: 结构化的技术上下文摘要

### 2. 集成点设计

#### 2.1 在 `summarizeConversation` 中集成

修改 `src/core/condense/index.ts` 的 `summarizeConversation` 函数：

```typescript
export async function summarizeConversation(
	messages: ApiMessage[],
	apiHandler: ApiHandler,
	systemPrompt: string,
	taskId: string,
	prevContextTokens: number,
	isAutomaticTrigger?: boolean,
	customCondensingPrompt?: string,
	condensingApiHandler?: ApiHandler,
	conversationMemory?: ConversationMemory,
	useMemoryEnhancement: boolean = true,
	vectorMemoryStore?: VectorMemoryStore,
	useSubAgentCompression: boolean = false, // 新增参数
	task?: Task, // 新增：需要Task实例来调用startSubtask
): Promise<SummarizeResponse>
```

#### 2.2 调用流程

```
summarizeConversation()
  ↓ (if useSubAgentCompression && task)
  ├─→ task.startSubtask("context-analyzer", messages)
  │     ↓ 独立上下文中分析
  │     ↓ 返回精炼摘要
  ├─→ task.startSubtask("memory-extractor", messages)
  │     ↓ 独立上下文中提取
  │     ↓ 返回关键记忆
  └─→ task.startSubtask("code-context-summarizer", messages)
        ↓ 独立上下文中总结
        ↓ 返回技术摘要
  ↓
合并3个子代理的输出 → 生成最终摘要
```

### 3. 子代理输出格式

每个子代理都必须返回**结构化的Markdown输出**：

#### Context Analyzer 输出格式

```markdown
# 对话流程分析

## 对话阶段

1. **初始需求**: [描述]
2. **设计阶段**: [描述]
3. **实现阶段**: [描述]

## 当前状态

- 正在进行: [任务描述]
- 已完成: [列表]
- 待处理: [列表]
```

#### Memory Extractor 输出格式

```markdown
# 关键记忆提取

## 🔴 Critical（必须保留）

- "[用户指令原文]" (Message #X)
- "[技术决策原文]" (Message #Y)

## 🟡 Important（应该保留）

- [配置要求]
- [架构决策]

## 🟢 Context（可选）

- [背景信息]
```

#### Code Context Summarizer 输出格式

```markdown
# 技术上下文总结

## 修改的文件

- `src/file1.ts`: [修改原因] [关键更改]
- `src/file2.ts`: [修改原因] [关键更改]

## 技术概念

- **概念1**: [描述] [使用位置]
- **概念2**: [描述] [使用位置]

## 依赖关系

- [文件A] → [文件B]: [关系描述]
```

### 4. 实现步骤

1. ✅ 删除错误的 SubAgentCompressionEngine 实现
2. ⏳ 创建3个子代理配置文件到 `.roo/agents/condense/`
3. ⏳ 修改 `summarizeConversation` 添加子代理调用逻辑
4. ⏳ 实现子代理输出解析器（`parseSubAgentOutput`）
5. ⏳ 添加测试覆盖
6. ⏳ 验收测试

### 5. 关键技术细节

#### 5.1 如何调用子代理

利用现有的 `new_task` 工具机制：

```typescript
// 在 Task 实例中
const subAgentResult = await this.startSubtask({
	mode: "context-analyzer", // 子代理名称（模式）
	message: `分析以下对话消息并提取高层次流程：\n\n${JSON.stringify(messages)}`,
	todos: [], // 不需要待办列表
})

// startSubtask 会：
// 1. 创建新的子任务（独立上下文）
// 2. 暂停当前任务（this.isPaused = true）
// 3. 子任务完成后通过 completeSubtask 返回结果
// 4. 恢复当前任务（this.isPaused = false）
```

#### 5.2 同步等待子代理结果

由于 `startSubtask` 是异步的，我们需要：

```typescript
// 创建Promise来等待子代理完成
const waitForSubAgent = new Promise<string>((resolve) => {
  // 监听子任务完成事件
  task.once('subtaskCompleted', (result) => {
    resolve(result.output)
  })
})

await task.startSubtask(...)
const subAgentOutput = await waitForSubAgent
```

#### 5.3 Token统计

每个子代理调用都会产生token使用：

- 输入token：传递给子代理的消息
- 输出token：子代理返回的摘要

这些都需要记录在 `SummarizeResponse.subAgentTokenUsage` 中。

### 6. 配置选项

在用户设置中添加：

```typescript
interface CondenseSettings {
	useSubAgentCompression: boolean // 默认 false（实验性功能）
	subAgentTimeout: number // 默认 60000ms
	subAgentModel: "haiku" | "sonnet" // 默认 haiku
}
```

## 性能目标

- **Token节省率**: ≥ 80%
- **响应时间**: < 30秒（3个子代理并行）
- **成本**: 使用 haiku 模型降低成本
- **准确性**: 不丢失关键信息（用户指令、技术决策）

## 测试策略

1. **单元测试**: 每个子代理输出解析器
2. **集成测试**: `summarizeConversation` 调用子代理流程
3. **E2E测试**: 完整压缩流程，验证token节省率
4. **回归测试**: 确保不影响现有压缩功能

## 参考文档

- `docs/improve.md`: 子代理概念和配置
- `cc-plugin/agents/scout.md`: Scout子代理实现参考
- `src/core/tools/newTaskTool.ts`: new_task工具实现
- `src/core/Task.ts`: startSubtask方法实现
