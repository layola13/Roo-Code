# 裁判MCP服务与AI Agent集成架构

## 1. 核心问题

**如何让AI Agent知道在任务完成时，先压缩上下文，然后调用裁判MCP服务进行判断？**

## 2. 架构方案

### 2.1 整体流程

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI Agent                                 │
│  (Claude/GPT-4 等大模型，运行在Roo-Code扩展中)                    │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ 1. 执行任务
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│            attempt_completion Tool 触发                          │
│  - Agent认为任务完成                                              │
│  - 触发完成尝试                                                   │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ 2. 系统自动介入
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│              上下文压缩器 (Context Compressor)                    │
│  - buildEnhancedTaskDescription() - 任务描述压缩                  │
│  - buildContextSummary() - 执行历史压缩                          │
│  - buildJudgePrompt() - 构建裁判提示词                           │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ 3. 压缩后的上下文 (~2000 tokens)
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│           裁判MCP服务器 (Judge MCP Server)                        │
│  - 接收压缩的上下文                                               │
│  - 调用裁判LLM进行评估                                            │
│  - 通过SSE流式返回判断结果                                        │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ 4. 流式返回判断结果
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│              Roo-Code 扩展 (任务管理器)                           │
│  - 接收裁判结果 (通过SSE)                                         │
│  - 决定：继续 / 完成 / 需要改进                                   │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ 5. 反馈给Agent
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                     AI Agent                                     │
│  - 如果通过：任务完成                                             │
│  - 如果未通过：根据反馈继续改进                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 关键设计点

#### **Agent不需要知道"压缩"这个概念**

这是关键！Agent只需要：

1. 使用 `attempt_completion` 工具宣布任务完成
2. 系统**自动**在后台完成：上下文压缩 → 调用裁判MCP → 返回结果

```typescript
// Agent的视角（它不知道裁判MCP的存在）
<attempt_completion>
<result>
我已经完成了用户登录功能的实现，包括：
- 前端登录表单
- 后端API接口
- 数据库表结构
- 单元测试
</result>
</attempt_completion>

// 系统自动执行（对Agent透明）
// 1. 拦截 attempt_completion
// 2. 压缩上下文
// 3. 调用裁判MCP
// 4. 返回结果给Agent
```

## 3. MCP服务接口设计

### 3.1 MCP工具定义

```typescript
// 裁判MCP服务暴露的工具
{
  name: "judge_task_completion",
  description: "评估AI Agent完成的任务是否达到要求",
  inputSchema: {
    type: "object",
    properties: {
      // 压缩后的任务上下文
      context: {
        type: "object",
        properties: {
          // 任务描述（已压缩）
          taskDescription: {
            type: "string",
            description: "原始任务 + 用户意图 + 约束条件"
          },

          // 执行历史（已压缩）
          executionSummary: {
            type: "object",
            properties: {
              conversationCount: { type: "number" },
              toolUsageStats: {
                type: "object",
                description: "工具使用统计：{read_file: 5, write_to_file: 3}"
              },
              recentFeedback: {
                type: "array",
                items: { type: "string" },
                description: "最近3条用户反馈（每条截断300字符）"
              },
              completionAttempts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    result: { type: "string" },
                    feedback: { type: "string" }
                  }
                },
                description: "之前的完成尝试（最近2次）"
              }
            }
          },

          // 文件变更（Git状态）
          fileChanges: {
            type: "object",
            properties: {
              modified: { type: "array", items: { type: "string" } },
              created: { type: "array", items: { type: "string" } },
              deleted: { type: "array", items: { type: "string" } }
            }
          },

          // Agent的完成声明
          completionClaim: {
            type: "string",
            description: "Agent在attempt_completion中声明的结果"
          }
        }
      },

      // 可选：流式响应配置
      streaming: {
        type: "boolean",
        default: true,
        description: "是否使用SSE流式返回"
      }
    }
  }
}
```

### 3.2 SSE流式响应格式

```typescript
// 事件类型定义
type JudgeEvent =
  | { type: "thinking", content: string }      // 裁判思考过程
  | { type: "progress", percentage: number }   // 评估进度
  | { type: "result", data: JudgeResult }      // 最终结果

interface JudgeResult {
  // 判断结果
  decision: "approve" | "reject" | "needs_improvement",

  // 置信度 (0-100)
  confidence: number,

  // 详细反馈
  feedback: {
    summary: string,              // 总体评价
    achievements: string[],       // 已完成的部分
    issues: string[],             // 存在的问题
    suggestions: string[]         // 改进建议
  },

  // 检查项
  checklist: {
    coreRequirements: boolean,    // 核心需求是否满足
    codeQuality: boolean,         // 代码质量
    testCoverage: boolean,        // 测试覆盖
    documentation: boolean        // 文档完整性
  }
}

// SSE消息示例
// Event 1: 思考过程
data: {"type":"thinking","content":"正在检查任务核心需求..."}

// Event 2: 进度更新
data: {"type":"progress","percentage":30}

// Event 3: 思考过程
data: {"type":"thinking","content":"分析代码变更..."}

// Event 4: 进度更新
data: {"type":"progress","percentage":60}

// Event 5: 最终结果
data: {"type":"result","data":{"decision":"approve","confidence":95,...}}
```

## 4. Roo-Code扩展集成

### 4.1 拦截attempt_completion

```typescript
// 在 attemptCompletionTool.ts 中
async function executeAttemptCompletion(task: Task, result: string): Promise<void> {
	// 1. Agent调用attempt_completion
	console.log("Agent尝试完成任务:", result)

	// 2. 系统自动压缩上下文
	const compressedContext = await buildJudgeContext(task, result)

	// 3. 调用裁判MCP服务（通过SSE流式获取结果）
	const judgeResult = await callJudgeMCP(compressedContext)

	// 4. 根据裁判结果决定下一步
	if (judgeResult.decision === "approve") {
		// 任务完成
		await task.markComplete()
		notifyUser("任务已完成！", judgeResult.feedback.summary)
	} else if (judgeResult.decision === "needs_improvement") {
		// 需要改进，反馈给Agent
		await task.addSystemMessage(
			`裁判反馈：${judgeResult.feedback.summary}\n` +
				`需要改进的地方：\n${judgeResult.feedback.issues.join("\n")}\n` +
				`建议：\n${judgeResult.feedback.suggestions.join("\n")}`,
		)
	} else {
		// 拒绝
		await task.addSystemMessage(`任务未达到要求。${judgeResult.feedback.summary}`)
	}
}

// 上下文压缩函数（从现有代码迁移）
async function buildJudgeContext(task: Task, completionClaim: string): Promise<JudgeContext> {
	return {
		taskDescription: await buildEnhancedTaskDescription(task),
		executionSummary: await buildContextSummary(task),
		fileChanges: await getGitStatus(task),
		completionClaim: completionClaim,
	}
}
```

### 4.2 MCP客户端调用

```typescript
// 通过MCP协议调用裁判服务
async function callJudgeMCP(context: JudgeContext): Promise<JudgeResult> {
	// 连接到裁判MCP服务器
	const client = new MCPClient({
		serverUrl: "http://localhost:3001/sse", // 裁判MCP服务地址
		transport: "sse",
	})

	// 调用judge_task_completion工具，使用SSE流式接收
	return new Promise((resolve, reject) => {
		const eventSource = client.callTool("judge_task_completion", { context, streaming: true })

		let finalResult: JudgeResult | null = null

		eventSource.addEventListener("message", (event) => {
			const data = JSON.parse(event.data)

			switch (data.type) {
				case "thinking":
					// 显示裁判思考过程
					showProgressMessage(`裁判分析中: ${data.content}`)
					break

				case "progress":
					// 更新进度条
					updateProgress(data.percentage)
					break

				case "result":
					// 收到最终结果
					finalResult = data.data
					eventSource.close()
					resolve(finalResult)
					break
			}
		})

		eventSource.addEventListener("error", (error) => {
			reject(error)
		})
	})
}
```

## 5. 裁判MCP服务器实现

### 5.1 服务器架构

```
judge-mcp-server/
├── src/
│   ├── server.ts              # MCP服务器主入口
│   ├── tools/
│   │   └── judgeCompletion.ts # 裁判工具实现
│   ├── services/
│   │   ├── contextAnalyzer.ts # 上下文分析
│   │   ├── llmJudge.ts        # 调用LLM进行判断
│   │   └── sseManager.ts      # SSE流式管理
│   ├── prompts/
│   │   └── judgePrompt.ts     # 裁判提示词模板
│   └── types/
│       └── index.ts           # 类型定义
├── package.json
└── tsconfig.json
```

### 5.2 核心代码示例

````typescript
// src/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";

const app = express();
const mcpServer = new Server(
  {
    name: "judge-mcp-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// 注册裁判工具
mcpServer.setRequestHandler("tools/list", async () => ({
  tools: [{
    name: "judge_task_completion",
    description: "评估AI Agent完成的任务",
    inputSchema: {
      // ... (见上文)
    }
  }]
}));

// 处理工具调用
mcpServer.setRequestHandler("tools/call", async (request) => {
  if (request.params.name === "judge_task_completion") {
    const { context, streaming } = request.params.arguments;

    if (streaming) {
      // 使用SSE流式返回
      return await judgeWithStreaming(context);
    } else {
      // 一次性返回结果
      return await judgeOnce(context);
    }
  }
});

// SSE传输层
app.use("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/sse", res);
  await mcpServer.connect(transport);
});

app.listen(3001, () => {
  console.log("裁判MCP服务器运行在 http://localhost:3001");
});

// src/services/llmJudge.ts - 裁判核心逻辑
import Anthropic from "@anthropic-ai/sdk";

interface StreamCallback {
  onThinking: (content: string) => void;
  onProgress: (percentage: number) => void;
}

export async function judgeWithStreaming(
  context: JudgeContext,
  callback?: StreamCallback
): Promise<JudgeResult> {

  // 1. 构建裁判提示词（使用压缩后的上下文）
  callback?.onThinking("正在分析任务上下文...");
  callback?.onProgress(10);

  const prompt = buildJudgePrompt(context);

  // 提示词示例（约1500-2000 tokens）
  // """
  // 你是一个任务完成度评估专家。请评估AI Agent是否完成了用户的任务。
  //
  // ## 原始任务
  // ${context.taskDescription}
  //
  // ## 执行摘要
  // - 对话轮数: ${context.executionSummary.conversationCount}
  // - 工具使用: ${JSON.stringify(context.executionSummary.toolUsageStats)}
  // - 最近反馈:
  //   ${context.executionSummary.recentFeedback.join('\n')}
  //
  // ## 文件变更
  // - 修改: ${context.fileChanges.modified.join(', ')}
  // - 新增: ${context.fileChanges.created.join(', ')}
  //
  // ## Agent的完成声明
  // ${context.completionClaim}
  //
  // 请按以下格式返回JSON评估结果：
  // {
  //   "decision": "approve/reject/needs_improvement",
  //   "confidence": 0-100,
  //   "feedback": {...},
  //   "checklist": {...}
  // }
  // """

  callback?.onThinking("正在调用裁判LLM...");
  callback?.onProgress(30);

  // 2. 调用LLM（Claude或GPT-4）
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  let fullResponse = "";

  const stream = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: prompt
    }],
    stream: true
  });

  callback?.onThinking("裁判LLM正在分析...");
  callback?.onProgress(50);

  for await (const event of stream) {
    if (event.type === "content_block_delta" &&
        event.delta.type === "text_delta") {
      fullResponse += event.delta.text;

      // 实时反馈思考过程
      if (fullResponse.includes("核心需求")) {
        callback?.onThinking("检查核心需求完成度...");
        callback?.onProgress(60);
      } else if (fullResponse.includes("代码质量")) {
        callback?.onThinking("评估代码质量...");
        callback?.onProgress(70);
      } else if (fullResponse.includes("测试")) {
        callback?.onThinking("检查测试覆盖...");
        callback?.onProgress(80);
      }
    }
  }

  callback?.onThinking("解析裁判结果...");
  callback?.onProgress(90);

  // 3. 解析结果（三级回退）
  const result = parseJudgeResponse(fullResponse);

  callback?.onProgress(100);

  return result;
}

function parseJudgeResponse(response: string): JudgeResult {
  // 尝试1: JSON解析
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // 继续尝试其他方法
  }

  // 尝试2: Markdown代码块
  try {
    const codeBlockMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1]);
    }
  } catch (e) {
    // 继续尝试其他方法
  }

  // 尝试3: 纯文本解析（兜底）
  return {
    decision: response.toLowerCase().includes("approve")
      ? "approve"
      : response.toLowerCase().includes("reject")
        ? "reject"
        : "needs_improvement",
    confidence: 50,
    feedback: {
      summary: response.substring(0, 500),
      achievements: [],
      issues: [],
      suggestions: []
    },
    checklist: {
      coreRequirements: response.includes("完成"),
      codeQuality: false,
      testCoverage: false,
      documentation: false
    }
  };
}


## 6. 提示词工程：告诉AI Agent如何与裁判MCP交互

### 6.1 系统提示词中的关键部分

在Roo-Code的系统提示词中，需要向AI Agent说明：

```markdown
## TASK COMPLETION

When you believe you have completed the user's task, you must use the
`attempt_completion` tool to present your results.

**IMPORTANT**: After you call `attempt_completion`, the system will
automatically:
1. Compress the conversation context
2. Send it to an independent Judge service for evaluation
3. Return feedback to you

You do NOT need to worry about:
- How context compression works
- How the Judge evaluates your work
- The technical details of the evaluation process

You ONLY need to:
- Clearly state what you've accomplished in the `result` parameter
- List all the changes you made
- Explain how the solution meets the user's requirements

The Judge will evaluate based on:
- Whether core requirements are met
- Code quality and best practices
- Test coverage (if applicable)
- Documentation completeness

If the Judge approves: Task is complete! ✅
If the Judge requests improvements: You'll receive specific feedback and
continue working.
````

### 6.2 Agent视角的完整交互示例

```
┌─────────────────────────────────────────────────────────────┐
│ User: "请实现一个用户登录功能"                                 │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ Agent: 理解任务并开始工作                                     │
│ [使用 read_file, write_to_file, execute_command 等工具]      │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ Agent: 认为任务完成                                           │
│ <attempt_completion>                                         │
│   <result>                                                   │
│   我已完成用户登录功能的实现：                                 │
│   1. 创建了登录表单组件 (components/LoginForm.tsx)            │
│   2. 实现了登录API接口 (api/auth/login.ts)                    │
│   3. 添加了单元测试 (tests/login.test.ts)                     │
│   4. 更新了路由配置                                           │
│   </result>                                                  │
│ </attempt_completion>                                        │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ 🔄 系统自动处理（对Agent透明）
                    │
┌─────────────────────────────────────────────────────────────┐
│ System: 拦截 attempt_completion                              │
│ 1. 压缩上下文：                                               │
│    - 任务描述: "实现用户登录功能"                             │
│    - 工具使用统计: {read_file: 3, write_to_file: 4, ...}      │
│    - 文件变更: [components/LoginForm.tsx, ...]               │
│    - Agent声明: "我已完成..."                                 │
│                                                              │
│ 2. 调用裁判MCP:                                              │
│    POST http://localhost:3001/sse                            │
│    Tool: judge_task_completion                               │
│    Context: {压缩后的上下文, ~2000 tokens}                     │
│                                                              │
│ 3. SSE流式接收结果:                                           │
│    Event: thinking → "正在检查核心需求..."                     │
│    Event: progress → 30%                                     │
│    Event: thinking → "分析代码质量..."                         │
│    Event: progress → 60%                                     │
│    Event: result → {decision: "needs_improvement", ...}       │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ 📨 反馈给Agent
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ System → Agent: 裁判反馈                                      │
│                                                              │
│ "任务尚未完全达到要求。以下是详细反馈：                         │
│                                                              │
│ ✅ 已完成：                                                   │
│ - 登录表单组件实现正确                                         │
│ - API接口逻辑清晰                                             │
│                                                              │
│ ❌ 存在问题：                                                 │
│ - 缺少密码加密处理                                            │
│ - 测试用例不完整（未覆盖错误情况）                             │
│ - 缺少登录状态持久化                                          │
│                                                              │
│ 💡 建议：                                                     │
│ 1. 使用bcrypt对密码进行加密                                   │
│ 2. 添加错误场景测试（密码错误、用户不存在等）                  │
│ 3. 实现JWT token存储到localStorage                           │
│                                                              │
│ 请根据以上反馈继续改进。"                                      │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ Agent: 根据反馈继续改进                                       │
│ "我理解了裁判的反馈，现在进行以下改进..."                      │
│ [继续工作，修复问题]                                          │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ Agent: 再次尝试完成                                           │
│ <attempt_completion>                                         │
│   <result>                                                   │
│   我已根据反馈完成改进：                                       │
│   1. 添加了bcrypt密码加密                                     │
│   2. 补充了完整的测试用例                                      │
│   3. 实现了JWT token持久化                                    │
│   </result>                                                  │
│ </attempt_completion>                                        │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ 🔄 系统再次自动处理
                    │
┌─────────────────────────────────────────────────────────────┐
│ System: 再次调用裁判MCP                                       │
│ Result: {decision: "approve", confidence: 95, ...}            │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ System → User: ✅ 任务已完成！                                │
│                                                              │
│ "所有要求已满足，代码质量良好，测试覆盖完整。"                  │
└─────────────────────────────────────────────────────────────┘
```

## 7. 关键技术要点

### 7.1 为什么Agent不需要知道压缩细节？

**设计理念：关注点分离**

```
Agent的职责：
✅ 理解任务需求
✅ 编写代码和文档
✅ 运行测试
✅ 解释工作成果
❌ 不需要知道如何压缩上下文
❌ 不需要知道裁判服务的存在
❌ 不需要知道评估标准的具体实现

系统的职责：
✅ 自动压缩上下文
✅ 调用裁判服务
✅ 解析评估结果
✅ 将反馈转换为Agent可理解的消息
```

### 7.2 上下文压缩的时机

```typescript
// 压缩发生在attempt_completion被调用时
async function executeAttemptCompletion(task: Task, result: string) {
	// 🔴 关键点：此时才进行压缩
	// Agent已经完成工作，现在需要评估

	// 压缩前的上下文可能有几万tokens：
	// - 25条完整的对话历史 (每条200字符)
	// - 15次工具调用的完整输入输出
	// - 10条用户反馈的完整内容
	// - Agent的完整思考过程

	const compressedContext = await buildJudgeContext(task, result)

	// 压缩后只有约2000 tokens：
	// - 任务描述摘要
	// - 对话数量统计（不保留内容）
	// - 工具使用统计（不保留详情）
	// - 最近3条反馈（每条截断300字符）
	// - 文件变更列表
	// - Agent的完成声明

	// 压缩比：~10:1 到 15:1

	return await callJudgeMCP(compressedContext)
}
```

### 7.3 SSE流式的优势

**为什么使用SSE而不是普通HTTP请求？**

1. **实时反馈**：用户可以看到裁判的思考过程
2. **进度可视化**：显示评估进度条
3. **更好的用户体验**：不是"黑盒"等待，而是透明的过程
4. **超时处理**：长时间评估不会因为HTTP超时而失败

```typescript
// 普通HTTP（不推荐）
const result = await fetch("/judge", {
	method: "POST",
	body: JSON.stringify(context),
})
// ❌ 用户等待30秒，不知道发生了什么
// ❌ 可能超时失败

// SSE流式（推荐）
const eventSource = new EventSource("/judge")
eventSource.onmessage = (event) => {
	const data = JSON.parse(event.data)
	if (data.type === "thinking") {
		showStatus(data.content) // ✅ "正在检查核心需求..."
	}
	if (data.type === "progress") {
		updateProgress(data.percentage) // ✅ 显示进度条
	}
}
```

## 8. 实现路线图

### Phase 1: 基础MCP服务器（1周）

- [ ] 搭建MCP服务器骨架
- [ ] 实现judge_task_completion工具
- [ ] 集成SSE传输层
- [ ] 基础提示词模板

### Phase 2: 上下文压缩迁移（1周）

- [ ] 从现有代码迁移buildEnhancedTaskDescription
- [ ] 迁移buildContextSummary
- [ ] 迁移buildJudgePrompt
- [ ] 单元测试：验证压缩比

### Phase 3: Roo-Code集成（1-2周）

- [ ] 修改attemptCompletionTool.ts拦截逻辑
- [ ] 实现MCP客户端调用
- [ ] SSE事件处理和UI更新

- [ ] 错误处理和重试机制

### Phase 4: 流式优化（1周）

- [ ] 实时进度反馈
- [ ] 思考过程可视化
- [ ] 性能优化（缓存、并发控制）
- [ ] 监控和日志

### Phase 5: 测试与部署（1周）

- [ ] 端到端测试
- [ ] 性能测试（压缩效率、响应时间）
- [ ] 容器化部署
- [ ] 文档完善

**总计：5-6周**

## 9. 成本与性能评估

### 9.1 Token使用

| 组件             | Token数          | 说明                           |
| ---------------- | ---------------- | ------------------------------ |
| 压缩前上下文     | ~20,000-30,000   | 完整的对话历史、工具调用、反馈 |
| 压缩后上下文     | ~1,500-2,000     | 智能压缩后发送给裁判           |
| 裁判LLM输出      | ~500-800         | JSON格式的评估结果             |
| **单次评估总计** | **~2,000-2,800** | 输入+输出                      |

### 9.2 成本估算

**使用Claude 3.5 Sonnet**：

- 输入：$3/M tokens
- 输出：$15/M tokens

单次裁判成本：

```
输入: 2000 tokens × $3/M = $0.006
输出: 500 tokens × $15/M = $0.0075
总计: ~$0.014 per judgment
```

**月度成本（假设1000次任务完成）**：

```
1000次 × $0.014 = $14/月
```

相比现有方案（每次评估~$0.09），**节省约84%**！

### 9.3 性能指标

| 指标             | 目标值     | 说明                  |
| ---------------- | ---------- | --------------------- |
| 压缩时间         | < 100ms    | 本地CPU操作           |
| MCP调用延迟      | < 50ms     | 本地网络（localhost） |
| LLM响应时间      | 5-15秒     | Claude API流式响应    |
| **端到端总时间** | **6-16秒** | 用户等待时间          |

## 10. 对比分析：MCP vs 现有方案

### 10.1 架构对比

| 维度         | 现有方案                   | MCP方案               |
| ------------ | -------------------------- | --------------------- |
| **耦合度**   | 紧耦合（JudgeService内嵌） | 松耦合（独立服务）    |
| **可扩展性** | 难以扩展                   | 易于扩展              |
| **复用性**   | 仅限Roo-Code               | 可被其他MCP客户端使用 |
| **部署**     | 嵌入扩展                   | 独立部署              |
| **维护**     | 需要重新打包扩展           | 独立更新              |
| **监控**     | 困难                       | 容易（独立日志）      |

### 10.2 Token使用对比

```
现有方案：
┌──────────────────────────────────────┐
│ 完整上下文直接发送给LLM              │
│ 25条对话 × 200字符 = 5000字符        │
│ 15次工具调用详情 = 3000字符          │
│ 10条反馈完整内容 = 5000字符          │
│ Agent思考过程 = 7000字符             │
│ 总计：~20000字符 ≈ 5000 tokens       │
└──────────────────────────────────────┘
        ↓ 发送给裁判LLM
成本：5000 × $3/M = $0.015（仅输入）

MCP方案：
┌──────────────────────────────────────┐
│ 智能压缩后发送                        │
│ 对话统计：25条（10字符）              │
│ 工具统计：{read_file:5,...} (90字符) │
│ 最近3条反馈（截断）= 900字符          │
│ 文件变更列表 = 200字符                │
│ Agent声明 = 800字符                   │
│ 总计：~2000字符 ≈ 500 tokens          │
└──────────────────────────────────────┘
        ↓ 发送给裁判LLM
成本：500 × $3/M = $0.0015（仅输入）

节省：90% token成本！
```

## 11. 安全性考虑

### 11.1 数据隐私

```typescript
// 压缩时自动脱敏敏感信息
function sanitizeContext(context: RawContext): CompressedContext {
	return {
		taskDescription: removeSensitiveData(context.taskDescription),
		executionSummary: {
			// 只保留统计数据，不保留原始内容
			conversationCount: context.messages.length,
			toolUsageStats: getToolStats(context.toolCalls),
			// 反馈内容截断，移除可能的敏感信息
			recentFeedback: context.feedback.slice(-3).map((f) => sanitize(f.substring(0, 300))),
		},
		// API密钥、密码等敏感信息被自动过滤
		fileChanges: filterSensitiveFiles(context.gitStatus),
	}
}
```

### 11.2 访问控制

```typescript
// MCP服务器配置访问控制
const mcpServer = new Server({
	name: "judge-mcp-server",
	version: "1.0.0",
	// 仅允许本地访问
	allowedOrigins: ["http://localhost"],
	// API密钥验证
	authentication: {
		type: "api-key",
		validate: async (key) => {
			return key === process.env.JUDGE_API_KEY
		},
	},
})
```

## 12. 总结

### 12.1 核心价值

1. **Agent透明性**：Agent不需要知道裁判系统的存在，只需调用`attempt_completion`
2. **自动化压缩**：系统在后台自动压缩上下文，无需Agent干预
3. **流式反馈**：通过SSE实时展示裁判思考过程，提升用户体验
4. **成本优化**：压缩比10:1以上，大幅降低LLM API成本
5. **架构解耦**：裁判服务独立部署，易于维护和扩展

### 12.2 技术亮点

- **智能压缩算法**：时间窗口+长度截断+统计汇总
- **三级解析回退**：JSON → Markdown → 纯文本
- **SSE流式协议**：实时进度反馈，避免超时
- **MCP标准化**：符合Model Context Protocol规范，可复用

### 12.3 实施建议

**优先级排序**：

1. **高优先级**：Phase 1-2（基础服务器+压缩迁移）
2. **中优先级**：Phase 3（Roo-Code集成）
3. **低优先级**：Phase 4-5（优化和测试）

**风险缓解**：

- 先在开发环境验证压缩效果
- 保留现有JudgeService作为备份
- 渐进式迁移，分批测试

**成功指标**：

- ✅ Token使用量减少80%以上
- ✅ 评估准确率不低于现有方案
- ✅ 端到端响应时间 < 20秒
- ✅ 用户满意度提升（通过反馈收集）

---

## 附录A：完整的提示词模板

```typescript
// src/prompts/judgePrompt.ts
export function buildJudgePrompt(context: JudgeContext): string {
	return `
你是一个任务完成度评估专家。请评估AI Agent是否成功完成了用户的任务。

## 📋 原始任务描述

${context.taskDescription}

## 📊 执行摘要

- **对话轮数**: ${context.executionSummary.conversationCount}次交互
- **工具使用情况**: 
${Object.entries(context.executionSummary.toolUsageStats)
	.map(([tool, count]) => `  - ${tool}: ${count}次`)
	.join("\n")}
- **最近用户反馈**:
${context.executionSummary.recentFeedback.map((f, i) => `  ${i + 1}. ${f}`).join("\n")}

## 📁 文件变更

- **修改**: ${context.fileChanges.modified.join(", ") || "无"}
- **新增**: ${context.fileChanges.created.join(", ") || "无"}
- **删除**: ${context.fileChanges.deleted.join(", ") || "无"}

## ✅ Agent的完成声明

${context.completionClaim}

---

## 📝 评估要求

请基于以上信息，评估任务完成度。**必须**返回以下JSON格式：

\`\`\`json
{
  "decision": "approve" | "reject" | "needs_improvement",
  "confidence": 0-100,
  "feedback": {
    "summary": "总体评价（100-200字符）",
    "achievements": ["已完成项1", "已完成项2"],
    "issues": ["问题1", "问题2"],
    "suggestions": ["建议1", "建议2"]
  },
  "checklist": {
    "coreRequirements": true/false,
    "codeQuality": true/false,
    "testCoverage": true/false,
    "documentation": true/false
  }
}
\`\`\`

## 🎯 评估标准

1. **核心需求 (coreRequirements)**: 用户的主要需求是否得到满足？
2. **代码质量 (codeQuality)**: 代码是否遵循最佳实践？
3. **测试覆盖 (testCoverage)**: 是否有足够的测试？（如适用）
4. **文档完整性 (documentation)**: 是否有必要的文档？（如适用）

## 📌 决策指南

- **approve**: 所有核心需求已满足，质量良好
- **needs_improvement**: 基本功能完成但有改进空间
- **reject**: 核心需求未满足或存在严重问题

请严格按照JSON格式返回评估结果。
`
}
```

## 附录B：MCP服务器配置示例

```json
// judge-mcp-server/package.json
{
	"name": "judge-mcp-server",
	"version": "1.0.0",
	"type": "module",
	"main": "dist/server.js",
	"scripts": {
		"dev": "tsx watch src/server.ts",
		"build": "tsc",
		"start": "node dist/server.js"
	},
	"dependencies": {
		"@modelcontextprotocol/sdk": "^0.5.0",
		"@anthropic-ai/sdk": "^0.27.0",
		"express": "^4.18.2"
	},
	"devDependencies": {
		"@types/express": "^4.17.21",
		"@types/node": "^20.0.0",
		"tsx": "^4.7.0",
		"typescript": "^5.3.3"
	}
}
```

```dockerfile
# judge-mcp-server/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY dist ./dist

ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/server.js"]
```

````yaml
# judge-mcp-server/docker-compose.yml
version: '3.8'

services:
  judge-mcp:
    build: .
    ports:
      - "3001:3001"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - JUDGE_API_KEY=${JUDGE_API_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval:


## 13. MCP裁判服务配置设置

### 13.1 配置项设计

基于现有UI的裁判设置，MCP服务需要支持以下配置项：

```typescript
// MCP服务器配置接口
interface JudgeMCPConfig {
  // 1. 裁判模型选择
  modelConfig: {
    provider: "anthropic" | "openai" | "custom",
    model: string,                    // 例如: "claude-3-5-sonnet-20241022"
    apiKey?: string,                  // API密钥
    baseURL?: string,                 // 自定义API端点
    temperature: number,              // 温度参数 (0-1)
    maxTokens: number                 // 最大输出tokens
  },

  // 2. 判断严格度 (对应detailLevel)
  strictness: {
    level: "lenient" | "moderate" | "strict",
    customCriteria?: {
      coreRequirements: number,      // 权重 0-100
      codeQuality: number,            // 权重 0-100
      testCoverage: number,           // 权重 0-100
      documentation: number           // 权重 0-100
    }
  },

  // 3. 反馈详细程度
  feedbackDetail: "concise" | "detailed",

  // 4. 超时设置
  timeout: {
    compressionMs: number,           // 压缩超时 (默认5000ms)
    judgmentMs: number,              // 裁判超时 (默认30000ms)
    totalMs: number                  // 总超时 (默认40000ms)
  },

  // 5. 重试策略
  retry: {
    enabled: boolean,
    maxAttempts: number,             // 最大重试次数
    backoffMs: number                // 重试间隔
  },

  // 6. 缓存设置
  cache: {
    enabled: boolean,
    ttlSeconds: number,              // 缓存过期时间
    maxSize: number                  // 最大缓存条目
  },

  // 7. 日志和监控
  logging: {
    level: "debug" | "info" | "warn" | "error",
    includeContext: boolean,         // 是否记录完整上下文
    sensitive: boolean               // 是否记录敏感信息
  },

  // 8. 关键问题阻断 (对应blockOnCriticalIssues)
  blockOnCriticalIssues: boolean,

  // 9. 用户覆盖 (对应allowUserOverride)
  allowUserOverride: boolean,

  // 10. 子任务禁用 (对应disableForSubtasks)
  disableForSubtasks: boolean
}
````

### 13.2 UI配置到MCP配置的映射

```typescript
// Roo-Code UI配置 → MCP服务配置
function mapUIConfigToMCPConfig(uiConfig: UIJudgeConfig): JudgeMCPConfig {
	return {
		// 模型配置
		modelConfig: {
			// 如果UI指定了judgeModelConfigId，使用该配置
			// 否则使用当前对话的模型配置
			provider: getProviderFromConfigId(uiConfig.judgeModelConfigId),
			model: getModelFromConfigId(uiConfig.judgeModelConfigId),
			apiKey: getAPIKeyFromConfigId(uiConfig.judgeModelConfigId),
			temperature: 0.3, // 裁判需要更确定性的输出
			maxTokens: 2000,
		},

		// 严格度映射
		strictness: {
			level: mapDetailLevelToStrictness(uiConfig.judgeDetailLevel),
			// detailed → strict, concise → moderate
		},

		// 反馈详细度
		feedbackDetail: uiConfig.judgeDetailLevel, // "concise" | "detailed"

		// 其他配置
		blockOnCriticalIssues: uiConfig.judgeBlockOnCriticalIssues,
		allowUserOverride: uiConfig.judgeAllowUserOverride,
		disableForSubtasks: uiConfig.judgeDisableForSubtasks,

		// 默认值
		timeout: {
			compressionMs: 5000,
			judgmentMs: 30000,
			totalMs: 40000,
		},
		retry: {
			enabled: true,
			maxAttempts: 2,
			backoffMs: 1000,
		},
		cache: {
			enabled: false, // 初期禁用
			ttlSeconds: 300,
			maxSize: 100,
		},
		logging: {
			level: "info",
			includeContext: false,
			sensitive: false,
		},
	}
}
```

### 13.3 严格度等级详解

```typescript
// 严格度配置
const STRICTNESS_PRESETS = {
	lenient: {
		name: "宽松",
		description: "适合快速迭代和原型开发",
		thresholds: {
			approveScore: 60, // 60分即可通过
			rejectScore: 30, // 30分以下拒绝
			// 30-60之间返回needs_improvement
		},
		weights: {
			coreRequirements: 70, // 核心需求权重70%
			codeQuality: 10, // 代码质量权重10%
			testCoverage: 10, // 测试覆盖权重10%
			documentation: 10, // 文档权重10%
		},
		skipChecks: ["documentation"], // 跳过文档检查
	},

	moderate: {
		name: "适中",
		description: "平衡质量和速度",
		thresholds: {
			approveScore: 75,
			rejectScore: 40,
		},
		weights: {
			coreRequirements: 50,
			codeQuality: 25,
			testCoverage: 15,
			documentation: 10,
		},
		skipChecks: [],
	},

	strict: {
		name: "严格",
		description: "适合生产环境和关键任务",
		thresholds: {
			approveScore: 90,
			rejectScore: 60,
		},
		weights: {
			coreRequirements: 40,
			codeQuality: 30,
			testCoverage: 20,
			documentation: 10,
		},
		skipChecks: [],
		requireAll: true, // 所有检查项必须通过
	},
}
```

### 13.4 MCP工具接口扩展

```typescript
// 扩展后的judge_task_completion工具定义
{
  name: "judge_task_completion",
  description: "评估AI Agent完成的任务是否达到要求",
  inputSchema: {
    type: "object",
    properties: {
      context: {
        // ... (见前文)
      },

      // 新增：配置参数
      config: {
        type: "object",
        properties: {
          // 模型选择
          model: {
            type: "string",
            description: "裁判使用的LLM模型",
            enum: [
              "claude-3-5-sonnet-20241022",
              "claude-3-opus-20240229",
              "gpt-4-turbo-preview",
              "gpt-4o"
            ],
            default: "claude-3-5-sonnet-20241022"
          },

          // 严格度
          strictness: {
            type: "string",
            description: "判断严格度",
            enum: ["lenient", "moderate", "strict"],
            default: "moderate"
          },

          // 反馈详细度
          feedbackDetail: {
            type: "string",
            enum: ["concise", "detailed"],
            default: "detailed"
          },

          // 自定义权重
          customWeights: {
            type: "object",
            properties: {
              coreRequirements: { type: "number", minimum: 0, maximum: 100 },
              codeQuality: { type: "number", minimum: 0, maximum: 100 },
              testCoverage: { type: "number", minimum: 0, maximum: 100 },
              documentation: { type: "number", minimum: 0, maximum: 100 }
            }
          },

          // 阻断设置
          blockOnCriticalIssues: {
            type: "boolean",
            default: true
          },

          // 超时
          timeoutMs: {
            type: "number",
            default: 30000,
            description: "裁判超时时间(毫秒)"
          }
        }
      },

      streaming: {
        type: "boolean",
        default: true
      }
    },
    required: ["context"]
  }
}
```

### 13.5 配置持久化

```typescript
// MCP服务器配置文件
// judge-mcp-server/config/default.json
{
  "server": {
    "port": 3001,
    "host": "localhost",
    "cors": {
      "enabled": true,
      "origins": ["http://localhost"]
    }
  },

  "models": {
    "default": "claude-3-5-sonnet-20241022",
    "providers": {
      "anthropic": {
        "apiKey": "${ANTHROPIC_API_KEY}",
        "baseURL": "https://api.anthropic.com",
        "models": [
          "claude-3-5-sonnet-20241022",
          "claude-3-opus-20240229",
          "claude-3-sonnet-20240229"
        ]
      },
      "openai": {
        "apiKey": "${OPENAI_API_KEY}",
        "baseURL": "https://api.openai.com",
        "models": [
          "gpt-4-turbo-preview",
          "gpt-4o",
          "gpt-4"
        ]
      }
    }
  },

  "judgment": {
    "defaultStrictness": "moderate",
    "defaultFeedbackDetail": "detailed",
    "blockOnCriticalIssues": true,
    "allowUserOverride": true,
    "disableForSubtasks": true
  },

  "performance": {
    "timeout": {
      "compression": 5000,
      "judgment": 30000,
      "total": 40000
    },
    "retry": {
      "enabled": true,
      "maxAttempts": 2,
      "backoffMs": 1000
    },
    "cache": {
      "enabled": false,
      "ttl": 300,
      "maxSize": 100
    }
  },

  "logging": {
    "level": "info",
    "includeContext": false,
    "sensitive": false,
    "file": "./logs/judge-mcp.log",
    "console": true
  }
}
```

### 13.6 环境变量配置

```bash
# judge-mcp-server/.env.example

# 服务器配置
PORT=3001
HOST=localhost
NODE_ENV=production

# API密钥
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx

# 裁判配置
JUDGE_DEFAULT_MODEL=claude-3-5-sonnet-20241022
JUDGE_DEFAULT_STRICTNESS=moderate
JUDGE_TIMEOUT_MS=30000

# 安全
JUDGE_API_KEY=your-secret-api-key
ALLOWED_ORIGINS=http://localhost

# 日志
LOG_LEVEL=info
LOG_FILE=./logs/judge-mcp.log

# 性能
CACHE_ENABLED=false
CACHE_TTL_SECONDS=300
RETRY_ENABLED=true
RETRY_MAX_ATTEMPTS=2
```

### 13.7 运行时配置更新

```typescript
// MCP工具：更新配置
{
  name: "update_judge_config",
  description: "动态更新裁判服务配置",
  inputSchema: {
    type: "object",
    properties: {
      configPath: {
        type: "string",
        description: "配置路径，例如: 'judgment.defaultStrictness'"
      },
      value: {
        description: "新配置值"
      }
    },
    required: ["configPath", "value"]
  }
}

// 使用示例
await mcpClient.callTool("update_judge_config", {
  configPath: "judgment.defaultStrictness",
  value: "strict"
});

// 批量更新
await mcpClient.callTool("update_judge_config", {
  configPath: "judgment",
  value: {
    defaultStrictness: "strict",
    blockOnCriticalIssues: true,
    allowUserOverride: false
  }
});
```

### 13.8 UI设置面板增强建议

建议在现有UI基础上增加以下高级设置：

```typescript
// 新增UI组件：高级裁判设置
export const AdvancedJudgeSettings = () => {
  return (
    <>
      {/* 严格度自定义 */}
      <div>
        <label>判断严格度</label>
        <VSCodeDropdown value={strictness}>
          <VSCodeOption value="lenient">宽松 - 快速迭代</VSCodeOption>
          <VSCodeOption value="moderate">适中 - 平衡质量</VSCodeOption>
          <VSCodeOption value="strict">严格 - 生产就绪</VSCodeOption>
          <VSCodeOption value="custom">自定义...</VSCodeOption>
        </VSCodeDropdown>
      </div>

      {/* 自定义权重（当strictness为custom时显示） */}
      {strictness === "custom" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label>核心需求权重</label>
            <input type="range" min="0" max="100" />
          </div>
          <div>
            <label>代码质量权重</label>
            <input type="range" min="0" max="100" />
          </div>
          <div>
            <label>测试覆盖权重</label>
            <input type="range" min="0" max="100" />
          </div>
          <div>
            <label>文档完整性权重</label>
            <input type="range" min="0" max="100" />
          </div>
        </div>
      )}

      {/* 超时设置 */}
      <div>
        <label>裁判超时时间 (秒)</label>
        <VSCodeTextField
          type="number"
          value={timeoutSeconds}
          min="10"
          max="120"
        />
        <p className="text-sm text-vscode-descriptionForeground">
          建议: 10-30秒。超时后将使用备用方案。
        </p>
      </div>

      {/* MCP服务器地址 */}
      <div>
        <label>裁判MCP服务器地址</label>
        <VSCodeTextField
          value={mcpServerURL}
          placeholder="http://localhost:3001/sse"
        />
        <p className="text-sm text-vscode-descriptionForeground">
          留空使用内置裁判服务
        </p>
      </div>

      {/* 连接状态 */}
      <div className="flex items-center gap-2">

<span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm">
          {isConnected ? '已连接到MCP服务器' : '未连接'}
        </span>
        {isConnected && (
          <VSCodeButton appearance="secondary" onClick={testConnection}>
            测试连接
          </VSCodeButton>
        )}
      </div>
    </>
  );
};
```

### 13.9 配置验证与健康检查

```typescript
// MCP服务器健康检查端点
app.get("/health", (req, res) => {
	res.json({
		status: "healthy",
		version: "1.0.0",
		uptime: process.uptime(),
		config: {
			defaultModel: config.models.default,
			defaultStrictness: config.judgment.defaultStrictness,
			cacheEnabled: config.performance.cache.enabled,
		},
		stats: {
			totalJudgments: globalStats.totalJudgments,
			successRate: globalStats.successRate,
			avgResponseTimeMs: globalStats.avgResponseTimeMs,
		},
	})
})

// 配置验证端点
app.post("/validate-config", (req, res) => {
	const { config } = req.body

	const errors = []

	// 验证模型配置
	if (!config.modelConfig?.model) {
		errors.push("模型未指定")
	}

	// 验证严格度
	if (!["lenient", "moderate", "strict"].includes(config.strictness?.level)) {
		errors.push("无效的严格度等级")
	}

	// 验证权重总和
	if (config.strictness?.customCriteria) {
		const weights = config.strictness.customCriteria
		const sum = weights.coreRequirements + weights.codeQuality + weights.testCoverage + weights.documentation
		if (Math.abs(sum - 100) > 0.01) {
			errors.push(`权重总和必须为100，当前为${sum}`)
		}
	}

	if (errors.length > 0) {
		return res.status(400).json({ valid: false, errors })
	}

	res.json({ valid: true })
})
```

### 13.10 配置预设模板

```typescript
// 预定义的配置模板
export const CONFIG_PRESETS = {
	// 快速原型开发
	rapid_prototype: {
		name: "快速原型",
		description: "适合快速验证想法，宽松的评估标准",
		config: {
			strictness: { level: "lenient" },
			feedbackDetail: "concise",
			blockOnCriticalIssues: false,
			timeout: { judgmentMs: 15000 },
		},
	},

	// 日常开发
	daily_development: {
		name: "日常开发",
		description: "平衡质量和速度的标准配置",
		config: {
			strictness: { level: "moderate" },
			feedbackDetail: "detailed",
			blockOnCriticalIssues: true,
			timeout: { judgmentMs: 30000 },
		},
	},

	// 生产部署
	production_ready: {
		name: "生产就绪",
		description: "严格的质量标准，确保代码可部署",
		config: {
			strictness: {
				level: "strict",
				customCriteria: {
					coreRequirements: 40,
					codeQuality: 30,
					testCoverage: 20,
					documentation: 10,
				},
			},
			feedbackDetail: "detailed",
			blockOnCriticalIssues: true,
			disableForSubtasks: false, // 子任务也需验证
			timeout: { judgmentMs: 45000 },
		},
	},

	// 代码审查模式
	code_review: {
		name: "代码审查",
		description: "专注于代码质量和最佳实践",
		config: {
			strictness: {
				level: "strict",
				customCriteria: {
					coreRequirements: 30,
					codeQuality: 50, // 强调代码质量
					testCoverage: 15,
					documentation: 5,
				},
			},
			feedbackDetail: "detailed",
			blockOnCriticalIssues: true,
		},
	},

	// 测试优先模式
	test_driven: {
		name: "测试驱动",
		description: "强制测试覆盖，适合TDD开发",
		config: {
			strictness: {
				level: "strict",
				customCriteria: {
					coreRequirements: 30,
					codeQuality: 20,
					testCoverage: 45, // 强调测试
					documentation: 5,
				},
			},
			feedbackDetail: "detailed",
			blockOnCriticalIssues: true,
		},
	},
}
```

### 13.11 配置同步机制

```typescript
// Roo-Code → MCP服务器配置同步
class JudgeConfigSyncService {
	private mcpClient: MCPClient

	// 监听UI配置变化
	async syncConfig(uiConfig: UIJudgeConfig) {
		const mcpConfig = mapUIConfigToMCPConfig(uiConfig)

		// 推送到MCP服务器
		await this.mcpClient.callTool("update_judge_config", {
			configPath: "judgment",
			value: mcpConfig.judgment,
		})

		await this.mcpClient.callTool("update_judge_config", {
			configPath: "models",
			value: mcpConfig.modelConfig,
		})

		// 验证配置已生效
		const health = await fetch(`${this.mcpServerURL}/health`).then((r) => r.json())
		console.log("MCP服务器配置已更新:", health.config)
	}

	// 从MCP服务器拉取配置
	async fetchConfig(): Promise<JudgeMCPConfig> {
		const health = await fetch(`${this.mcpServerURL}/health`).then((r) => r.json())
		return health.config
	}
}
```

### 13.12 配置迁移策略

```typescript
// 从现有JudgeService迁移配置
function migrateExistingConfig(oldConfig: any): JudgeMCPConfig {
	return {
		modelConfig: {
			provider: "anthropic", // 默认使用Anthropic
			model: oldConfig.judgeModelId || "claude-3-5-sonnet-20241022",
			temperature: 0.3,
			maxTokens: 2000,
		},

		strictness: {
			// 现有系统没有严格度配置，默认moderate
			level: "moderate",
		},

		feedbackDetail: oldConfig.judgeDetailLevel || "detailed",

		// 保留现有设置
		blockOnCriticalIssues: oldConfig.judgeBlockOnCriticalIssues ?? true,
		allowUserOverride: oldConfig.judgeAllowUserOverride ?? true,
		disableForSubtasks: oldConfig.judgeDisableForSubtasks ?? true,

		// 新增默认值
		timeout: {
			compressionMs: 5000,
			judgmentMs: 30000,
			totalMs: 40000,
		},
		retry: {
			enabled: true,
			maxAttempts: 2,
			backoffMs: 1000,
		},
		cache: {
			enabled: false,
			ttlSeconds: 300,
			maxSize: 100,
		},
		logging: {
			level: "info",
			includeContext: false,
			sensitive: false,
		},
	}
}
```

### 13.13 配置文档总结

| 配置项                    | 类型    | 默认值            | 说明               | UI对应                     |
| ------------------------- | ------- | ----------------- | ------------------ | -------------------------- |
| **modelConfig.model**     | string  | claude-3-5-sonnet | 裁判使用的LLM模型  | judgeModelConfigId         |
| **strictness.level**      | enum    | moderate          | 判断严格度         | 映射自judgeDetailLevel     |
| **feedbackDetail**        | enum    | detailed          | 反馈详细程度       | judgeDetailLevel           |
| **blockOnCriticalIssues** | boolean | true              | 关键问题时阻断任务 | judgeBlockOnCriticalIssues |
| **allowUserOverride**     | boolean | true              | 允许用户覆盖判断   | judgeAllowUserOverride     |
| **disableForSubtasks**    | boolean | true              | 子任务禁用裁判     | judgeDisableForSubtasks    |
| **timeout.judgmentMs**    | number  | 30000             | 裁判超时(毫秒)     | 新增                       |
| **retry.maxAttempts**     | number  | 2                 | 最大重试次数       | 新增                       |
| **cache.enabled**         | boolean | false             | 是否启用缓存       | 新增                       |
| **logging.level**         | enum    | info              | 日志级别           | 新增                       |

### 13.14 配置最佳实践

**推荐配置组合**：

```typescript
// 场景1：学习和实验
const learningConfig = {
	strictness: "lenient",
	feedbackDetail: "detailed", // 详细反馈帮助学习
	blockOnCriticalIssues: false,
	timeout: { judgmentMs: 15000 },
}

// 场景2：团队协作
const teamConfig = {
	strictness: "moderate",
	feedbackDetail: "detailed",
	blockOnCriticalIssues: true,
	allowUserOverride: true, // 允许有经验的开发者覆盖
	disableForSubtasks: true,
}

// 场景3：CI/CD流水线
const cicdConfig = {
	strictness: "strict",
	feedbackDetail: "concise", // CI环境简洁输出
	blockOnCriticalIssues: true,
	allowUserOverride: false, // 禁止覆盖
	disableForSubtasks: false, // 所有任务都验证
	timeout: { judgmentMs: 60000 }, // CI可以等更久
}
```

---

## 14. 总结与更新

### 14.1 完整文档结构

本文档现包含以下完整内容：

1. ✅ **核心问题与架构** - Agent如何透明地使用裁判MCP
2. ✅ **MCP接口设计** - 工具定义、SSE流式响应
3. ✅ **Roo-Code集成** - 拦截、调用、反馈流程
4. ✅ **裁判MCP服务器实现** - 完整代码示例
5. ✅ **提示词工程** - Agent视角的说明
6. ✅ **交互示例** - 可视化的完整流程
7. ✅ **技术要点** - 压缩、SSE、透明性
8. ✅ **实施路线图** - 5个阶段，5-6周
9. ✅ **成本对比** - 节省84%成本
10. ✅ **安全性** - 数据脱敏、访问控制
11. ✅ **附录** - 提示词模板、配置文件
12. ✅ **MCP配置设置** - 10+配置项详解（新增）

### 14.2 关键设计决策

1. **Agent透明性** - Agent无需了解裁判机制
2. **自动化压缩** - 系统后台智能压缩（10:1）
3. **流式反馈** - SSE实时进度展示
4. **灵活配置** - 支持多模型、多严格度
5. **渐进迁移** - 兼容现有UI设置

### 14.3 下一步行动

优先级排序：

1. **Phase 1** - 搭建MCP服务器骨架（1周）
2. **Phase 2** - 迁移压缩逻辑（1周）
3. **配置实现** - 实现配置管理和验证（同步进行）
4. **Phase 3** - Roo-Code集成（1-2周）
5. **Phase 4-5** - 优化和测试（2周）

所有设计文档已完成，可供开发团队参考实施。
