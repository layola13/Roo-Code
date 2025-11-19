# 裁判任务转换为MCP服务器 - 评估与架构设计

## 📋 文档信息

- **创建时间**: 2025-11-19
- **任务类型**: 评估 + 架构设计
- **目标**: 将Task中的裁判任务转换成独立的MCP服务器，支持SSE流式输出
- **结论**: ✅ 高度可行，建议采用渐进式迁移策略

---

## 1. 现状分析

### 1.1 当前裁判系统架构

```typescript
// 核心模块位置
src/core/judge/
├── JudgeService.ts          # 裁判服务核心逻辑
├── types.ts                 # 类型定义
├── prompts.ts               # 提示词构建
└── git-utils.ts             # Git状态工具

// Task集成点
src/core/task/Task.ts
├── invokeJudge()            # 调用裁判
├── handleJudgeRejection()   # 处理拒绝
├── shouldInvokeJudge()      # 判断是否调用
└── getJudgeConfig()         # 获取配置
```

### 1.2 核心功能

1. **任务评估** - `judgeCompletion(taskContext, attemptResult)`
2. **上下文构建** - 收集任务历史、工具使用、Git状态
3. **响应解析** - 支持JSON/Markdown/纯文本
4. **配置管理** - 模式、详细级别、用户覆盖权限

---

## 2. MCP转换可行性评估

### 2.1 优势 ✅

1. **独立性强** - 裁判逻辑相对独立，边界清晰
2. **输入输出明确** - TaskContext → JudgeResult
3. **多格式支持** - JSON/Markdown/纯文本解析
4. **配置灵活** - 支持独立模型配置
5. **容错机制** - 失败时默认批准，不阻塞

### 2.2 挑战 ⚠️

1. **上下文依赖** - 需要Task的大量上下文
2. **UI集成** - 当前与VSCode UI紧密耦合
3. **状态管理** - 多次拒绝检测需要状态
4. **Git集成** - 依赖工作区Git状态

### 2.3 结论

**✅ 高度可行**，建议采用渐进式迁移

---

## 3. 架构设计

### 3.1 整体架构

```
Client (Roo-Code Task)
    ↓ MCP Protocol (JSON-RPC 2.0 + SSE)
    ↓
MCP Judge Server
├── Protocol Layer (MCP协议处理)
├── Service Layer (核心评估逻辑)
└── LLM Integration (流式API调用)
    ↓
LLM Providers (OpenAI/Anthropic)
```

### 3.2 目录结构

```
mcp-judge-server/
├── src/
│   ├── protocol/              # MCP协议层
│   │   ├── handler.ts         # JSON-RPC处理
│   │   ├── sse-stream.ts      # SSE流式管理
│   │   └── tools-registry.ts  # 工具注册
│   │
│   ├── services/              # 核心服务
│   │   ├── evaluator.ts       # 裁判评估器
│   │   ├── context-builder.ts # 上下文构建
│   │   ├── response-parser.ts # 响应解析
│   │   └── config-manager.ts  # 配置管理
│   │
│   ├── llm/                   # LLM集成
│   │   ├── stream-manager.ts  # 流式管理
│   │   └── providers/         # 多Provider支持
│   │
│   └── utils/                 # 工具函数
│       ├── git-utils.ts       # Git工具
│       └── logger.ts          # 日志
│
├── tests/                     # 测试
└── examples/                  # 使用示例
```

### 3.3 SSE流式事件

```typescript
export type JudgeStreamEvent =
	| { type: "start"; timestamp: number; taskId: string }
	| { type: "context_building"; progress: number }
	| { type: "context_built"; summary: string; tokenCount: number }
	| { type: "llm_calling"; provider: string; model: string }
	| { type: "reasoning_chunk"; text: string; accumulated: string }
	| { type: "decision_detected"; approved: boolean; confidence: number }
	| { type: "result_final"; result: JudgeResult }
	| { type: "complete"; duration: number; tokensUsed: number }
	| { type: "error"; error: string; fallbackResult?: JudgeResult }
```

---

## 4. 实现路线图

### 阶段一：核心迁移（1-2周）

- [ ] 创建MCP服务器项目
- [ ] 迁移JudgeService核心逻辑
- [ ] 实现MCP协议支持
- [ ] 实现同步评估API
- [ ] 编写单元测试

### 阶段二：流式支持（1周）

- [ ] 实现SSE流式事件
- [ ] 支持增量解析
- [ ] 实现流式评估API
- [ ] 客户端流式集成
- [ ] 性能优化

### 阶段三：生产就绪（1-2周）

- [ ] 多LLM Provider支持
- [ ] 配置热更新
- [ ] 监控和日志
- [ ] 错误恢复机制
- [ ] Docker部署

---

## 5. 技术实现细节

### 5.1 SSE流式核心实现

```typescript
export async function* streamJudgeEvaluation(
	taskContext: TaskContext,
	attemptResult: string,
): AsyncGenerator<JudgeStreamEvent> {
	yield { type: "start", timestamp: Date.now(), taskId: taskContext.taskId }

	// 构建上下文
	const context = await buildContext(taskContext)
	yield { type: "context_built", summary: summarize(context), tokenCount: count(context) }

	// 流式调用LLM
	const stream = createLLMStream(context, attemptResult)
	let accumulated = ""

	for await (const chunk of stream) {
		accumulated += chunk.text
		yield { type: "reasoning_chunk", text: chunk.text, accumulated }

		// 尝试提前检测决策
		const decision = tryDetectDecision(accumulated)
		if (decision) {
			yield { type: "decision_detected", ...decision }
		}
	}

	// 解析最终结果
	const result = parseResponse(accumulated)
	yield { type: "result_final", result }

	yield { type: "complete", duration: elapsed, tokensUsed: total }
}
```

### 5.2 客户端集成示例

```typescript
// Roo-Code Task中集成
class TaskJudgeIntegration {
	async invokeJudgeStreaming(taskContext, attemptResult) {
		const stream = await mcpClient.callToolStreaming("judge_completion", {
			taskContext: this.buildMcpContext(taskContext),
			attemptResult,
			config: { streaming: true },
		})

		for await (const event of stream) {
			switch (event.type) {
				case "context_built":
					await this.say("text", `🔍 上下文: ${event.tokenCount} tokens`)
					break
				case "reasoning_chunk":
					await this.say("reasoning", event.accumulated, undefined, true)
					break
				case "decision_detected":
					const emoji = event.approved ? "✅" : "❌"
					await this.say("text", `${emoji} 决策: ${event.approved ? "批准" : "拒绝"}`)
					break
				case "result_final":
					return event.result
			}
		}
	}
}
```

---

## 6. 性能与成本

### 6.1 性能目标

| 指标         | 目标    | 说明                  |
| ------------ | ------- | --------------------- |
| 首字节时间   | < 1秒   | SSE连接建立到首个事件 |
| 平均评估时间 | < 10秒  | 完整评估流程          |
| 并发能力     | 10+     | 同时处理请求数        |
| 内存占用     | < 512MB | 单实例                |

### 6.2 成本估算

**GPT-4评估成本**：

- 输入：~2000 tokens × $0.03/1K = $0.06
- 输出：~500 tokens × $0.06/1K = $0.03
- **单次成本**：~$0.09

**月度成本**（1000次/月）：~$90

### 6.3 优化策略

1. **上下文压缩** - 智能摘要减少token
2. **缓存策略** - 相似上下文复用结果
3. **模型选择** - 根据复杂度选择模型
4. **批处理** - 非紧急评估批量处理

---

## 7. 风险与缓解

### 7.1 技术风险

| 风险          | 影响 | 概率 | 缓解措施                   |
| ------------- | ---- | ---- | -------------------------- |
| LLM API不稳定 | 高   | 中   | 实现重试机制、回退策略     |
| 流式解析失败  | 中   | 低   | 增量解析容错、完整解析兜底 |
| 性能瓶颈      | 中   | 中   | 异步处理、连接池优化       |
| 内存泄漏      | 高   | 低   | 严格的流式清理、监控告警   |

### 7.2 业务风险

| 风险         | 影响 | 概率 | 缓解措施                 |
| ------------ | ---- | ---- | ------------------------ |
| 用户体验下降 | 高   | 中   | 保留同步模式、渐进式迁移 |
| 成本超预算   | 中   | 低   | 成本监控、使用配额限制   |
| 兼容性问题   | 中   | 中   | 充分测试、版本兼容策略   |

---

## 8. 总结与建议

### 8.1 核心结论

1. **✅ 技术可行** - MCP协议完全支持裁判功能需求
2. **✅ 架构合理** - 分层清晰，便于维护和扩展
3. **✅ 性能可控** - SSE流式提升体验，成本可接受
4. **✅ 风险可控** - 有明确的缓解措施

### 8.2 实施建议

1. **采用渐进式迁移**

    - 第一阶段：核心逻辑独立，保持现有集成
    - 第二阶段：实现流式功能，AB测试
    - 第三阶段：完全迁移，移除旧代码

2. **重点关注**

    - SSE流式体验优化
    - 错误处理和回退机制
    - 性能监控和成本控制
    - 完善的测试覆盖

3. **优先级排序**
    - P0：核心评估功能迁移
    - P0：基本流式支持
    - P1：多Provider支持
    - P2：高级功能（缓存、批处理等）

### 8.3 下一步行动

1. **技术预研**（1周）

    - MCP SDK深入研究
    - SSE流式技术验证
    - 性能基准测试

2. **详细设计**（1周）

    - API接口设计
    - 数据模型设计
    - 错误处理设计

3. **原型开发**（2周）
    - MVP版本实现
    - 核心功能验证
    - 性能测试

---

## 附录

### A. 参考资源

- [MCP协议规范](https://spec.modelcontextprotocol.io/)
- [SSE流式技术](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- 当前实现：`src/core/judge/JudgeService.ts`
- 相关文档：`docs/12-judge-mode-requirements.md`

### B. 关键文件清单

```
需要迁移的核心文件：
- src/core/judge/JudgeService.ts (核心逻辑)
- src/core/judge/types.ts (类型定义)
- src/core/judge/prompts.ts (提示词)
- src/core/judge/git-utils.ts (Git工具)

需要适配的集成点：
- src/core/task/Task.ts (Task集成)
- src/core/tools/attemptCompletionTool.ts (工具集成)
```

### C. 成功指标

- ✅ 评估准确率 >95%
- ✅
