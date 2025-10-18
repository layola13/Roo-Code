# 上下文智能系统实现差距分析

## 📋 对比：设计文档 vs 当前实现

### 设计文档要求（docs/newagent.md）

#### 🎯 核心四层架构

1. **历史消息持久化层** - 向量数据库 + 原始日志
2. **调度裁判层（Orchestrator）** - 智能分析、任务分发、结果汇总
3. **领域专家Sub-Agent层** - 多agent并行筛选
4. **主回答模型层** - 基于精选上下文生成回答

#### 🔄 期望工作流程

```
用户输入新消息
    ↓
裁判Agent分析（意图识别、领域分类、时间敏感度）
    ↓
并行调用多个sub-agent检索历史相关消息
    ├─ 技术专家agent → 返回技术相关历史（带序列号）
    ├─ 产品专家agent → 返回产品相关历史（带序列号）
    └─ 情感支持agent → 返回情感相关历史（带序列号）
    ↓
裁判汇总、去重、加权排序、对比分析
    ├─ agent1返回: [msg#5, msg#12, msg#18]
    ├─ agent2返回: [msg#12, msg#20, msg#25]
    └─ 裁判去重合并: [msg#5, msg#12, msg#18, msg#20, msg#25]
    ↓
构造精选上下文（带消息索引号、相关性分数）
    ↓
发给主模型生成回答
```

### 当前实现状态

#### ✅ 已实现

- [x] SubagentExecutor - 基础执行器
- [x] RoutingEngine - 简单路由（关键词匹配）
- [x] ExecutionScheduler - 任务调度
- [x] PerformanceMonitor - 性能监控
- [x] 3个压缩agent（context-analyzer, memory-extractor, code-summarizer）
- [x] VectorMemoryStore集成
- [x] UI可视化（TaskHeader显示subagent调用）

#### ❌ 缺失核心功能

##### 1. **裁判Agent（Orchestrator）智能决策**

**设计要求：**

```typescript
interface OrchestratorDecision {
	domains: string[] // ['technical', 'billing']
	intent: string // 'problem_solving'
	timeScope: string // 'last_7_days'
	crossDomain: boolean // true
	tokenBudget: TokenBudget[] // 动态分配各agent预算
	suggestedAgents: SubagentName[]
}
```

**当前实现：**

```typescript
// RoutingEngine.route() - 仅做简单关键词匹配
route(userMessage: string, context: AgentContext): RoutingDecision {
  // ❌ 没有意图分析
  // ❌ 没有领域分类
  // ❌ 没有时间敏感度判断
  // ❌ 没有动态token预算分配
  return { primaryAgent: ..., confidence: ... }
}
```

##### 2. **向量检索历史摘要**

**设计要求：**

- 每个sub-agent从向量库检索相关历史
- 返回带序列号的消息列表
- 支持语义相似度搜索

**当前实现：**

```typescript
// MemoryExtractorAgent有VectorMemoryStore集成
// ✅ 但仅在memory-extractor中使用
// ❌ 其他agent（context-analyzer, code-summarizer）未使用向量检索
// ❌ 没有统一的历史消息检索接口
```

##### 3. **多Agent并行执行 + 结果对比**

**设计要求：**

```typescript
// 并行调用多个agent
const results = await Promise.all([
	techAgent.search(userMsg), // 返回 [msg#5, msg#12]
	productAgent.search(userMsg), // 返回 [msg#12, msg#20]
	emotionAgent.search(userMsg), // 返回 [msg#18, msg#25]
])

// 裁判对比去重
const merged = orchestrator.mergeAndDeduplicate(results)
// 结果: [msg#5, msg#12, msg#18, msg#20, msg#25]
```

**当前实现：**

```typescript
// ConversationController.smartRoute()
// ❌ 仅执行单个agent
const result = await this.executeSubagent(params, context)
// ❌ 没有并行多agent执行
// ❌ 没有结果对比和去重
```

##### 4. **消息索引号系统**

**设计要求：**

- 每条历史消息有全局唯一序列号（msg#1, msg#2, ...）
- Agent返回结果包含序列号
- UI显示时可追溯到具体消息

**当前实现：**

```typescript
// ❌ AgentContext.messages 没有序列号字段
interface AgentContext {
	messages: Array<{
		role: string
		content: string
		// ❌ 缺少: messageIndex?: number
		// ❌ 缺少: globalId?: string
	}>
}
```

##### 5. **冲突消息处理**

**设计要求：**

```
[历史参考 - 已过期]
2024-01-10: API限流为1000次/天

[历史参考 - 当前有效]
2025-10-01: API限流已升级为5000次/天
```

**当前实现：**

```typescript
// ❌ 没有时间线分析
// ❌ 没有冲突检测
// ❌ 没有"已过期"标注
```

##### 6. **动态Token预算分配**

**设计要求：**

```
总可用: 120K tokens
- 技术领域: 60K (主要相关)
- 账单领域: 30K (次要相关)
- 时间序列: 20K (最近3轮)
- 应急池: 10K
```

**当前实现：**

```typescript
// ❌ RoutingEngine没有token预算分配逻辑
// ❌ 所有agent使用相同上下文，没有按需分配
```

### UI显示差距

#### 设计要求的UI显示

```
┌─ 上下文分析 ─────────────────────┐
│ 🎯 裁判分析结果                  │
│   领域: [技术问题, API错误]       │
│   意图: 问题解决                 │
│   时间范围: 最近7天              │
│                                  │
│ 🤖 Agent检索结果对比             │
│   技术专家: msg#5, msg#12, msg#18│
│   产品专家: msg#12, msg#20       │
│   合并结果: 5条消息 (去重后)     │
│                                  │
│ 📊 相关性分数                    │
│   msg#12: 0.95 ⭐⭐⭐⭐⭐         │
│   msg#18: 0.87 ⭐⭐⭐⭐           │
│   msg#5:  0.75 ⭐⭐⭐             │
└──────────────────────────────────┘
```

#### 当前UI实现

```typescript
// TaskHeader.tsx - 仅显示基础信息
<tr>
  <th>Sub-agents</th>
  <td>
    {subAgentTokenUsage.map(agent => (
      <div>{agent.agentName}: ↑{tokensIn} ↓{tokensOut}</div>
    ))}
  </td>
</tr>
// ❌ 没有显示裁判分析结果
// ❌ 没有显示消息序列号
// ❌ 没有显示agent结果对比
// ❌ 没有显示相关性分数
```

## 🛠️ 需要补充的功能清单

### 高优先级（P0 - 核心流程）

1. [ ] **裁判Agent实现**

    - 意图分析（intent recognition）
    - 领域分类（domain classification）
    - 时间敏感度判断（time-scope detection）
    - 动态Token预算分配

2. [ ] **消息索引系统**

    - 为所有历史消息添加全局序列号
    - Agent返回结果包含序列号
    - 支持序列号追溯

3. [ ] **多Agent并行执行 + 结果汇总**

    - 并行调用多个sub-agent
    - 裁判汇总、去重、加权排序
    - 结果对比可视化

4. [ ] **向量检索集成**
    - 所有agent统一使用VectorMemoryStore
    - 支持语义相似度搜索
    - 返回相关性分数

### 中优先级（P1 - 增强功能）

5. [ ] **冲突消息处理**

    - 时间线分析
    - 冲突检测
    - "已过期"标注

6. [ ] **UI可视化增强**

    - 显示裁判分析结果
    - 显示消息序列号
    - 显示agent结果对比
    - 显示相关性分数

7. [ ] **性能优化**
    - 缓存检索结果
    - 批量向量检索
    - 超时熔断

### 低优先级（P2 - 进阶功能）

8. [ ] **A/B测试框架**
9. [ ] **记忆图谱系统**
10. [ ] **主动上下文补充**

## 📊 实现进度

```
核心四层架构: ████████░░ 80%
├─ 持久化层: ██████████ 100% ✅
├─ 裁判层:   ███░░░░░░░  30% ❌ (简单路由，缺智能决策)
├─ Agent层:  ████████░░  80% ✅ (3个agent已实现)
└─ 主模型层: ██████████ 100% ✅

关键功能实现:
├─
```
