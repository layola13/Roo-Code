# 子代理数据流验证报告

## 📋 概述

本文档详细记录了子代理（Sub-Agent）系统的完整数据流验证过程，包括数据如何从后端传递到前端UI，以及用户可能看不到子代理信息的原因分析。

**验证日期**: 2025-01-15  
**验证范围**: 子代理token使用数据的完整传递链路

---

## 🔍 数据流完整路径

### 1. 后端数据生成（Backend - Task.ts）

#### 1.1 子代理执行 (`Task.ts:2148-2182`)

```typescript
// 在 summarizeConversation() 中调用子代理
const result = await SubAgentExecutor.executeCompression(
    apiConfig,
    customInstructions,
    conversationToCompress
)

// 返回结构：SubAgentCompressionResult
{
    summary: string,
    cost: number,
    subAgentTokenUsage: SubAgentTokenUsage[]  // 3个子代理的使用数据
}
```

**关键点**：

- 子代理并行执行，返回包含3个子代理数据的数组
- 每个子代理记录：agentName, tokensIn, tokensOut, cost

#### 1.2 上下文压缩 (`Task.ts:1235-1251`)

```typescript
const contextCondense: ContextCondense = {
	summary,
	cost,
	newContextTokens,
	prevContextTokens,
	subAgentTokenUsage, // 传递子代理数据
}

await this.say(
	"condense_context",
	undefined,
	undefined,
	false,
	undefined,
	undefined,
	{ isNonInteractive: true },
	contextCondense, // 包含子代理数据的完整对象
)
```

**关键点**：

- `contextCondense` 对象作为 `say()` 方法的最后一个参数传递
- 生成类型为 `condense_context` 的消息

#### 1.3 消息存储 (`Task.ts:994-1023`)

```typescript
async say(
    type: ClineSay,
    text?: string,
    images?: string[],
    sayWithImgPath?: boolean,
    apiReqStartedAt?: number,
    apiReqRetry?: number,
    sayOptions?: ClineSayOptions,
    contextCondense?: ContextCondense  // 子代理数据在这里
): Promise<void> {
    const message: ClineMessage = {
        ts: sayOptions?.ts ?? this.say.ts ?? Date.now(),
        type: "say",
        say: type,
        text,
        images,
        contextCondense,  // 存储到消息中
        // ...
    }
    // 存储消息到 clineMessages 数组
}
```

**关键点**：

- `contextCondense` 字段直接存储在 `ClineMessage` 对象中
- 消息被添加到任务的 `clineMessages` 数组中

---

### 2. 前端数据聚合（Frontend - getApiMetrics.ts）

#### 2.1 消息处理 (`getApiMetrics.ts:76-92`)

```typescript
messages.forEach((message) => {
	if (message.type === "say" && message.say === "condense_context") {
		result.totalCost += message.contextCondense?.cost ?? 0

		// 聚合所有 condense_context 消息中的子代理数据
		if (message.contextCondense?.subAgentTokenUsage) {
			message.contextCondense.subAgentTokenUsage.forEach((usage) => {
				const existing = subAgentMap.get(usage.agentName)
				if (existing) {
					// 累加同一子代理的多次使用
					existing.tokensIn += usage.tokensIn
					existing.tokensOut += usage.tokensOut
					existing.cost += usage.cost
				} else {
					subAgentMap.set(usage.agentName, { ...usage })
				}
			})
		}
	}
})

// 转换为数组
if (subAgentMap.size > 0) {
	result.subAgentTokenUsage = Array.from(subAgentMap.values())
}
```

**关键点**：

- 遍历所有消息，寻找 `condense_context` 类型
- 使用 Map 聚合相同子代理的多次使用数据
- 支持累积统计（如果多次触发压缩）

#### 2.2 数据结构

```typescript
export type ApiMetricsWithSubAgents = TokenUsage & {
	subAgentTokenUsage?: SubAgentTokenUsage[] // 可选字段
}

// SubAgentTokenUsage 定义在 @roo-code/types
interface SubAgentTokenUsage {
	agentName: string
	tokensIn: number
	tokensOut: number
	cost: number
}
```

---

### 3. UI层数据传递（ChatView.tsx）

#### 3.1 计算API指标 (`ChatView.tsx:169-172`)

```typescript
const modifiedMessages = useMemo(() => combineApiRequests(combineCommandSequences(messages.slice(1))), [messages])

const apiMetrics = useMemo(() => getApiMetrics(modifiedMessages), [modifiedMessages])
```

**关键点**：

- `apiMetrics` 包含 `subAgentTokenUsage` 字段
- 每次消息更新时重新计算

#### 3.2 传递给TaskHeader (`ChatView.tsx:1798-1810`)

```typescript
<TaskHeader
    task={task}
    tokensIn={apiMetrics.totalTokensIn}
    tokensOut={apiMetrics.totalTokensOut}
    cacheWrites={apiMetrics.totalCacheWrites}
    cacheReads={apiMetrics.totalCacheReads}
    totalCost={apiMetrics.totalCost}
    contextTokens={apiMetrics.contextTokens}
    buttonsDisabled={sendingDisabled}
    handleCondenseContext={handleCondenseContext}
    todos={latestTodos}
    subAgentTokenUsage={apiMetrics.subAgentTokenUsage}  // 传递子代理数据
/>
```

---

### 4. UI渲染（TaskHeader.tsx）

#### 4.1 条件渲染 (`TaskHeader.tsx:327-400`)

```typescript
{subAgentTokenUsage && subAgentTokenUsage.length > 0 && (
    <>
        {/* 子代理信息行 */}
        <div className="flex items-center justify-between text-sm">
            <span className="text-vscode-descriptionForeground">
                Sub Agents
            </span>
            <div className="flex flex-col gap-1">
                {subAgentTokenUsage.map((agent, index) => {
                    // 显示每个子代理的状态和token使用
                })}
            </div>
        </div>

        {/* 展开时显示详细信息 */}
        {isExpanded && (
            <div className="flex flex-col gap-2">
                {subAgentTokenUsage.map((agent, index) => {
                    // 显示详细的token统计
                })}
            </div>
        )}

        {/* Token节省信息 */}
        <div className="flex items-center justify-between text-sm">
            <span className="text-vscode-descriptionForeground">
                Sub Agent Savings
            </span>
            <span className="tabular-nums">
                -{totalSavedTokens.toLocaleString()}
            </span>
        </div>
    </>
)}
```

**关键点**：

- **显示条件**：`subAgentTokenUsage && subAgentTokenUsage.length > 0`
- 只有当数组存在且非空时才显示
- 提供折叠/展开功能

---

## ❌ 用户看不到子代理信息的根本原因

### 原因1：未触发上下文压缩 ⚠️ **最常见**

**问题描述**：

- 子代理只在**上下文压缩操作**时才会执行
- 如果从未触发压缩，就不会有 `condense_context` 消息
- `getApiMetrics` 会返回空的 `subAgentTokenUsage` 数组
- UI条件 `subAgentTokenUsage.length > 0` 不满足，不显示任何内容

**触发压缩的方式**：

1. **手动触发**：

    - 点击TaskHeader中的"压缩"按钮（FoldVertical图标）
    - 调用 `handleCondenseContext(taskId)`

2. **自动触发**（满足以下任一条件）：
    - **上下文接近限制**：`contextTokens > contextWindow * autoCondenseContextPercent / 100`
    - **API返回上下文窗口错误**：收到上下文超限错误时强制触发
    - 代码位置：
        - `Task.ts:2686-2767` - 常规检查
        - `Task.ts:2856-2886` - 错误处理触发

**验证方法**：

```typescript
// 检查消息历史中是否存在 condense_context 消息
const hasCondenseMessage = messages.some((msg) => msg.type === "say" && msg.say === "condense_context")
```

---

### 原因2：子代理功能未启用 ⚠️

**问题描述**：

- 配置中的 `useSubAgentCompression` 设置为 `false`
- 即使触发压缩，也不会调用子代理
- 代码位置：
    - `Task.ts:2152` - 读取配置
    - `Task.ts:2704` - 自动压缩检查
    - `Task.ts:2850` - 错误触发检查

**检查代码**：

```typescript
const useSubAgentCompression = state?.useSubAgentCompression ?? false

if (useSubAgentCompression && customInstructions.customSubAgentPrompts) {
    // 使用子代理压缩
    result = await SubAgentExecutor.executeCompression(...)
} else {
    // 使用单一API压缩
    result = await this.compressConversationLegacy(...)
}
```

**解决方法**：

- 在VSCode设置中启用 `roo-code.useSubAgentCompression`
- 可选：配置自定义子代理提示词

---

### 原因3：对话历史太短

**问题描述**：

- 新任务刚开始，对话轮次很少
- 上下文token数量远未达到阈值
- 自动压缩不会触发

**典型场景**：

- 用户期望立即看到子代理信息
- 但实际需要等对话足够长才会自动触发

**解决方法**：

- 手动点击压缩按钮进行测试
- 或者降低 `autoCondenseContextPercent` 配置值

---

## ✅ 验证清单

### 开发者验证步骤

1. **确认配置启用**

    ```bash
    # 检查 VSCode 设置
    "roo-code.useSubAgentCompression": true
    ```

2. **触发压缩操作**

    - 方法1：手动点击TaskHeader中的压缩按钮
    - 方法2：进行长对话直到自动触发

3. **检查消息历史**

    ```typescript
    // 在浏览器开发者工具中
    console.log(messages.filter((m) => m.say === "condense_context"))
    // 应该能看到 contextCondense.subAgentTokenUsage
    ```

4. **验证UI渲染**
    - 打开TaskHeader（如果折叠）
    - 查找"Sub Agents"行
    - 确认显示3个子代理的统计信息

### 用户验证步骤

1. ✅ 创建新任务并进行多轮对话（至少10-15轮）
2. ✅ 点击TaskHeader中的压缩按钮（折叠图标）
3. ✅ 展开TaskHeader，查看是否显示"Sub Agents"行
4. ✅ 确认显示3个子代理（Analyzer、Summarizer、Extractor）
5. ✅ 检查每个子代理的token使用情况
6. ✅ 查看"Sub Agent Savings"显示的节省token数

---

## 📊 数据流状态图

```
[子代理执行]
    ↓ SubAgentCompressionResult
[Task.condenseContext()]

```
