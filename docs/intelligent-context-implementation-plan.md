# 智能上下文系统实现方案

## 📋 实现总结

基于用户需求 `docs/user-requirement-intelligent-context-system.md`，我已经：

### ✅ 已完成

1. **需求文档** - `docs/user-requirement-intelligent-context-system.md`

    - 清晰定义了6步工作流程
    - 定义了UI显示需求
    - 明确了验收标准

2. **差距分析** - `docs/implementation-gap-analysis.md`

    - 对比了设计文档vs当前实现
    - 列出了所有缺失功能
    - 提供了优先级排序

3. **核心类型定义** - `src/core/subagent/types-intelligent-context.ts`
    - `HistoricalMessage` - 带索引号的历史消息
    - `AgentSearchResult` - Agent检索结果
    - `JudgeDecision` - 裁判决策结果
    - 统一的Agent接口定义

### 🚀 下一步实现计划

#### 第1阶段：核心基础设施 (P0)

**目标**：建立消息索引系统和裁判Agent骨架

1. **消息索引管理器** - `src/core/subagent/MessageIndexManager.ts`

    ```typescript
    class MessageIndexManager {
      - assignIndex(conversationId): number
      - getMessageByIndex(index): HistoricalMessage
      - getMessagesByIndices(indices[]): HistoricalMessage[]
    }
    ```

2. **裁判Agent** - `src/core/subagent/agents/JudgeAgent.ts`

    ```typescript
    class JudgeAgent {
      - analyze(userMessage, context): JudgeDecision
      - executeAgentsInParallel(...): AgentSearchResult[]
      - mergeAndDeduplicate(results): {finalIndices, duplicates}
    }
    ```

3. **更新ConversationController集成裁判**
    - 在用户发送新消息时触发裁判分析
    - 并行执行多个专家Agent
    - 汇总结果并构造精选上下文

#### 第2阶段：Agent增强 (P0)

**目标**：让所有专家Agent支持消息索引和向量检索

4. **增强现有Agent**

    - `ContextAnalyzerAgent` - 添加 `selectRelevantMessages()` 方法
    - `MemoryExtractorAgent` - 添加 `selectRelevantMessages()` 方法
    - `CodeSummarizerAgent` - 添加 `selectRelevantMessages()` 方法

5. **统一向量检索接口**
    - 所有Agent使用VectorMemoryStore进行语义搜索
    - 返回带索引号和相关性分数的结果

#### 第3阶段：UI增强 (P0)

**目标**：在UI中显示裁判分析和Agent对比结果

6. **TaskHeader组件增强**

    ```tsx
    // 显示裁判分析结果
    <JudgeAnalysisPanel decision={judgeDecision} />

    // 显示Agent对比结果
    <AgentComparisonPanel agentResults={agentResults} />

    // 显示消息相关性评分
    <MessageRelevancePanel selectedMessages={messages} />
    ```

7. **ChatRow组件增强**

    ```tsx
    // 每条消息显示索引号
    <div className="message-index">msg#{messageIndex}</div>

    // 点击索引号可追溯
    <button onClick={() => scrollToMessage(messageIndex)}>
      msg#{messageIndex}
    </button>
    ```

8. **WebviewMessage类型扩展**
    - 添加 `judgeDecision?: JudgeDecision`
    - 添加 `messageIndex?: number`
    - 更新消息传递协议

#### 第4阶段：高级功能 (P1)

**目标**：Token预算分配和冲突处理

9. **Token预算分配器**

    ```typescript
    class TokenBudgetAllocator {
      - calculateBudget(decision): TokenBudgetAllocation[]
      - allocateToAgents(agents, totalBudget): Map<string, number>
    }
    ```

10. **冲突消息检测器**
    ```typescript
    class ConflictDetector {
      - detectConflicts(messages): ConflictInfo[]
      - resolveConflicts(conflicts): Resolution
    }
    ```

#### 第5阶段：测试和验证 (P0)

11. **单元测试**

    - MessageIndexManager测试
    - JudgeAgent测试
    - Agent增强功能测试

12. **集成测试**

    - 完整流程端到端测试
    - UI交互测试

13. **性能测试**
    - 并行Agent执行性能
    - 向量检索性能
    - 总耗时 < 3秒

## 🎯 关键设计决策

### 1. 消息索引号生成策略

**方案A**: 全局递增计数器（推荐）

- ✅ 简单可靠
- ✅ 易于实现
- ✅ 支持分布式（使用数据库序列）
- ❌ 可能泄露消息总量信息

**方案B**: UUID + 序列号混合

- ✅ 更强的隐私保护
- ❌ 实现复杂
- ❌ 不易于人类阅读

**决定**: 使用方案A（全局递增），privacy考虑可在UI层做脱敏处理

### 2. 裁判Agent调用时机

**选项1**: 每次用户发送消息时自动触发
**选项2**: 当上下文超过阈值时触发
**选项3**: 用户手动触发

**决定**:

- 默认：选项1（自动触发）
- 提供选项3（手动触发）作为备用
- 可通过配置禁用自动触发

### 3. Agent并行执行策略

```typescript
// Promise.all - 所有Agent必须完成
const results = await Promise.all([
  agent1.select(...),
  agent2.select(...),
  agent3.select(...)
])

// Promise.allSettled - 容错，部分失败也继续
const results = await Promise.allSettled([...])
```

**决定**: 使用 `Promise.allSettled` + 超时控制

- 单个Agent失败不影响其他
- 超时3秒自动熔断
- 记录失败原因供调试

### 4. UI实时反馈

用户发送消息后，UI应显示：

```
1. "🔍 裁判分析中..." (0-500ms)
2. "🤖 Agent检索中..." (500-2000ms)
3. "📊 结果汇总中..." (2000-2500ms)
4. "✅ 上下文已优化" (2500ms+)
```

每个阶段使用WebviewMessage实时推送进度。

## 📊 数据流图

```
用户输入新消息
    ↓
[MessageIndexManager]
    ├─ 为新消息分配索引号 (msg#123)
    └─ 存储到历史库
    ↓
[JudgeAgent.analyze()]
    ├─ 分析用户意图
    ├─ 判断涉及领域
    └─ 确定时间范围
    ↓
[VectorMemoryStore.semanticSearch()]
    ├─ 语义检索相关历史 (top-50)
    └─ 返回候选消息列表
    ↓
[JudgeAgent.executeAgentsInParallel()]
    ├─ ContextAnalyzerAgent.selectRelevantMessages()
    │   └─ 返回: [msg#5, msg#12, msg#18]
    ├─ MemoryExtractorAgent.selectRelevantMessages()
    │   └─ 返回: [msg#12, msg#20, msg#25]
    └─ CodeSummarizerAgent.selectRelevantMessages()
        └─ 返回: [msg#18, msg#30]
    ↓
[JudgeAgent.mergeAndDeduplicate()]
    ├─ 合并: [5, 12, 18, 20, 25, 30]
    ├─ 标记重复: msg#12(2个Agent), msg#18(2个Agent)
    └─ 计算相关性分数
    ↓
[构造精选上下文]
    ├─ 按索引号提取完整消息
    ├─ 添加相关性标注
    └─ 控制token总量
    ↓
[发送给主模型]
    └─ 用户新消息 + 精选历史上下文
    ↓
[主模型生成回答]
    └─ 返回高质量回答
    ↓
[UI显示]
    ├─ TaskHeader显示裁判分析
    ├─ TaskHeader显示Agent对比
    └─ 消息显示索引号和相关性
```

## ⚠️ 注意事项

### 性能考虑

1. **向量检索优化**

    - 使用批量检索接口
    - 缓存频繁查询的结果
    - 设置合理的topK值（50-100）

2. **Agent并行执行**

    - 设置超时3秒
    - 使用连接池控制并发
    - 失败重试最多2次

3. **Token计算**
    - 使用tiktoken精确计算
    - 预留10%buffer
    - 动态调整每条消息的token配额

### 兼容性考虑

1. **向后兼容**

    - 旧消息自动分配索引号
    - 无索引号时使用时间戳排序
    - UI优雅降级

2. **配置灵活性**
    - 允许禁用裁判Agent
    - 允许选择性启用专家Agent
    - 支持自定义Token预算

### 安全性考虑

1. **隐私保护**

    - 索引号不暴露用户信息
    - 向量embedding本地计算
    - 敏感消息可标记为不检索

2. **错误处理**
    - Agent失败不影响对话流程
    - 裁判失败回退到简单上下文
    - 所有错误记录到日志

## 🎬 实现顺序建议

### Week 1: 核心基础设施

- [ ] Day 1-2: MessageIndexManager + 单元测试
- [ ] Day 3-4: JudgeAgent骨架 + 基础逻辑
- [ ] Day 5: 集成到ConversationController

### Week 2: Agent增强

- [ ] Day 1-2: 增强3个现有Agent
- [ ] Day 3: 统一向量检索接口
- [ ] Day 4-5: Agent并行执行 + 测试

### Week 3: UI增强

- [ ] Day 1-2: TaskHeader组件增强
- [ ] Day 3: ChatRow组件增强
- [ ] Day 4-5: WebviewMessage协议更新 + 测试

### Week 4: 高级功能 + 测试

- [ ] Day 1-2: Token预算分配 + 冲突检测
- [ ] Day 3-4: 集成测试 + 性能测试
- [ ] Day 5: 文档更新 + Code Review

## ✅ 验收检查清单

### 功能验收

- [ ] 用户发送新消息时，UI显示"裁判分析中..."
- [ ] TaskHeader显示裁判分析结果（意图、领域、时间范围）
- [ ] TaskHeader显示各Agent检索结果对比
- [ ] 能看到哪些消息被多个Agent共同选中
- [ ] 每条历史消息显示索引号（msg#1, msg#2, ...）
- [ ] 点击消息索引号能跳转到原始对话
- [ ] 主模型回答质量提升（对比测试）

### 性能验收

- [ ] 裁判分析 + Agent检索总耗时 < 3秒
- [ ] Agent并行执行，无串行等待
- [ ] Token使用率 > 80%
- [ ] 缓存命中率 > 50%（重复查询）

### 代码质量验收

- [ ] 所有核心模块有单元测试
- [ ] 测试覆盖率 > 80%
- [ ] 所有TypeScript类型完整
- [ ]
