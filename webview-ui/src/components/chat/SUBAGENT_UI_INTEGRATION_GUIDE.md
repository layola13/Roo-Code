# 并行子代理UI组件集成指南

## 概述

本文档说明如何将并行子代理UI组件集成到ChatView中。所有组件已创建、测试并准备就绪。

## 已完成的组件

### 1. SubagentTab (`SubagentTab.tsx`)

单个子代理Tab，显示状态、进度、模型信息。

### 2. SubagentTabBar (`SubagentTabBar.tsx`)

Tab容器，支持横向滚动、Main Task分隔、队列指示器。

### 3. SubagentContextBanner (`SubagentContextBanner.tsx`)

隔离上下文标识横幅，显示子代理信息。

## 集成步骤

### 步骤1：在ChatView中导入组件

```typescript
// 在 ChatView.tsx 顶部添加
import { SubagentTabBar } from "./SubagentTabBar"
import { SubagentContextBanner } from "./SubagentContextBanner"
import { ParallelSubAgentInfo } from "@roo/ExtensionMessage"
```

### 步骤2：添加状态管理

在ChatView组件中添加以下状态：

```typescript
// 并行子代理状态
const [activeTabId, setActiveTabId] = useState<string>("main")
const [parallelSubagents, setParallelSubagents] = useState<ParallelSubAgentInfo[]>([])
const [subagentQueueCount, setSubagentQueueCount] = useState<number>(0)
```

### 步骤3：处理来自Extension的消息

在现有的消息处理逻辑中添加：

```typescript
// 监听并行子代理消息（在useEffect或消息处理器中）
useEffect(() => {
	const handleMessage = (event: MessageEvent) => {
		const message: ExtensionMessage = event.data

		switch (message.type) {
			case "parallelSubagentStarted":
				if (message.parallelSubagent) {
					setParallelSubagents((prev) => [...prev, message.parallelSubagent!])
				}
				break

			case "parallelSubagentProgress":
				if (message.parallelSubagent) {
					setParallelSubagents((prev) =>
						prev.map((agent) =>
							agent.id === message.parallelSubagent!.id
								? { ...agent, ...message.parallelSubagent }
								: agent,
						),
					)
				}
				break

			case "parallelSubagentCompleted":
				if (message.parallelSubagent) {
					setParallelSubagents((prev) =>
						prev.map((agent) =>
							agent.id === message.parallelSubagent!.id
								? { ...agent, status: "completed", progress: 100 }
								: agent,
						),
					)
				}
				break

			case "parallelSubagentFailed":
				if (message.parallelSubagent) {
					setParallelSubagents((prev) =>
						prev.map((agent) =>
							agent.id === message.parallelSubagent!.id ? { ...agent, status: "failed" } : agent,
						),
					)
				}
				break
		}
	}

	window.addEventListener("message", handleMessage)
	return () => window.removeEventListener("message", handleMessage)
}, [])
```

### 步骤4：在JSX中渲染组件

在TaskHeader之后添加SubagentTabBar：

```typescript
{task ? (
	<>
		<TaskHeader
			task={task}
			// ... 其他props
		/>

		{/* 并行子代理Tab栏 */}
		<SubagentTabBar
			activeTabId={activeTabId}
			mainTaskName="Main Task"
			subagents={parallelSubagents}
			queueCount={subagentQueueCount}
			onTabChange={(tabId) => setActiveTabId(tabId)}
			onTabClose={(tabId) => {
				setParallelSubagents(prev =>
					prev.filter(agent => agent.id !== tabId)
				)
				if (activeTabId === tabId) {
					setActiveTabId("main")
				}
			}}
		/>

		{/* 其他内容... */}
	</>
) : (
	// 欢迎屏幕
)}
```

### 步骤5：在消息区域添加Context Banner

在Virtuoso消息列表之前添加：

```typescript
{/* 如果当前查看的是子代理上下文，显示横幅 */}
{activeTabId !== "main" && (() => {
	const activeAgent = parallelSubagents.find(a => a.id === activeTabId)
	return activeAgent ? (
		<SubagentContextBanner
			agentId={activeAgent.id}
			agentName={activeAgent.name}
			model={activeAgent.model}
			status={activeAgent.status}
			memoryLimit="200k"
		/>
	) : null
})()}

{/* 消息列表 Virtuoso */}
<Virtuoso
	// ... 现有props
/>
```

## 测试验证

所有组件都有完整的单元测试：

```bash
cd webview-ui
npx vitest run src/components/chat/__tests__/Subagent
```

## 后续工作

**重要**: 完整的并行子代理功能还需要后端支持：

1. **Task.ts修改** - 实现并行子代理执行逻辑
2. **消息发送** - 从后端发送`parallelSubagentStarted`等消息
3. **上下文隔离** - 实现子代理的独立上下文管理
4. **队列管理** - 实现子代理队列和调度

这些后端工作超出了本阶段（UI组件实现）的范围。

## 文件清单

| 文件                         | 状态    | 测试    |
| ---------------------------- | ------- | ------- |
| `SubagentTab.tsx`            | ✅ 完成 | ✅ 通过 |
| `SubagentTabBar.tsx`         | ✅ 完成 | ✅ 通过 |
| `SubagentContextBanner.tsx`  | ✅ 完成 | ✅ 通过 |
| `ExtensionMessage.ts` (扩展) | ✅ 完成 | N/A     |
| `index.css` (样式)           | ✅ 完成 | N/A     |

## 总结

- ✅ 所有UI组件已实现
- ✅ 所有组件测试通过（39个测试用例）
- ✅ 消息类型已扩展
- ✅ CSS样式已添加
- ⏳ ChatView集成需要后端支持（后续阶段）

当后端实现完成并开始发送并行子代理消息时，按照本指南的步骤即可完成完整集成。
