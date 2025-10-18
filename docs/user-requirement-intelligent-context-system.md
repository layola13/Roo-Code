# 智能上下文筛选系统 - 用户需求文档

## 🎯 核心需求

用户在与大模型对话时，每次新增对话需要经过智能上下文筛选流程，确保主模型接收到最相关的历史信息，从而生成高质量回答。

## 🔄 完整工作流程

### 流程图

```
用户输入新消息
    ↓
【步骤1】上下文裁判介入分析
    - 分析用户最后一条消息的意图
    - 判断需要哪些历史信息
    ↓
【步骤2】从历史摘要库检索
    - 裁判从向量数据库/历史库检索相关摘要
    - 获取候选历史消息列表（带索引号）
    ↓
【步骤3】分发给专业Agent判断
    - 并行调用多个领域专家Agent
    - 每个Agent独立判断哪些历史消息相关
    - 各Agent返回: 消息索引号数组
    ↓
【步骤4】裁判汇总对比结果
    - 收集各Agent返回的索引号列表
    - 对比分析:
      * Agent1: [msg#5, msg#12, msg#18]
      * Agent2: [msg#12, msg#20, msg#25]
      * 裁判决策: [msg#5, msg#12, msg#18, msg#20, msg#25]
    - 去重、排序、加权
    ↓
【步骤5】构造精选上下文
    - 按索引号提取完整消息内容
    - 添加相关性标注
    - 控制token总量
    ↓
【步骤6】发给主线大模型
    - 主模型接收: 用户新消息 + 精选历史上下文
    - 生成最终回答
```

## 📊 关键数据结构

### 1. 消息索引号系统

每条历史消息必须有全局唯一索引号，用于追溯和对比。

```typescript
interface HistoricalMessage {
	// 全局唯一索引号
	messageIndex: number // 例如: 1, 2, 3, ...
	globalId: string // 例如: "msg#1", "msg#2", ...

	// 消息内容
	role: "user" | "assistant"
	content: string
	timestamp: number

	// 元数据
	conversationId: string
	tokens: number
	summary?: string // 消息摘要（用于快速检索）
}
```

### 2. Agent检索结果

每个Agent返回它认为相关的消息索引号列表。

```typescript
interface AgentSearchResult {
	agentName: string // Agent名称
	selectedIndices: number[] // 选中的消息索引号: [5, 12, 18]
	relevanceScores: Map<number, number> // 每个索引的相关性分数
	reasoning: string // 选择理由
	executionTime: number // 执行耗时
}
```

### 3. 裁判分析决策

裁判汇总各Agent结果后做出最终决策。

```typescript
interface JudgeDecision {
	// 裁判分析
	intent: string // 用户意图: "问题解决", "信息查询", "延续对话"
	domains: string[] // 涉及领域: ["技术", "产品", "账单"]
	timeScope: string // 时间范围: "最近7天", "上次会话", "全部历史"

	// Agent对比结果
	agentResults: AgentSearchResult[] // 各Agent返回结果

	// 最终决策
	selectedIndices: number[] // 去重后的索引号列表: [5, 12, 18, 20, 25]
	conflictResolution?: {
		// 冲突处理（如果有）
		conflictedIndices: number[]
		resolution: string
	}

	// Token预算
	totalTokenBudget: number // 总可用token
	allocatedTokens: number // 实际分配token
	reservedForResponse: number // 为回复保留的token
}
```

## 🎨 UI显示需求

### TaskHeader组件增强

#### 显示内容1: 裁判分析结果

```
┌─ 🎯 上下文裁判分析 ──────────────┐
│ 用户意图: 问题解决               │
│ 涉及领域: 技术问题, API错误      │
│ 时间范围: 最近7天                │
│ Token预算: 85K / 120K            │
└────────────────────────────────┘
```

#### 显示内容2: Agent检索结果对比

```
┌─ 🤖 Agent检索结果对比 ───────────┐
│                                  │
│ 技术专家Agent:                   │
│   选中: msg#5, msg#12, msg#18    │
│   理由: 这些消息包含API错误讨论  │
│   耗时: 234ms                    │
│                                  │
│ 产品专家Agent:                   │
│   选中: msg#12, msg#20, msg#25   │
│   理由: 涉及产品功能变更        │
│   耗时: 189ms                    │
│                                  │
│ 裁判最终决策:                    │
│   合并结果: 5条消息 (去重后)     │
│   msg#5, msg#12, msg#18,         │
│   msg#20, msg#25                 │
│                                  │
│   重复消息: msg#12               │
│   (2个Agent都选中，相关性高)    │
└────────────────────────────────┘
```

#### 显示内容3: 消息相关性评分

```
┌─ 📊 选中消息详情 ────────────────┐
│                                  │
│ msg#12 (技术+产品共选)           │
│   ⭐⭐⭐⭐⭐ 0.95               │
│   "用户报告API 403错误..."      │
│   [点击查看完整消息]            │
│                                  │
│ msg#18 (技术选中)                │
│   ⭐⭐⭐⭐ 0.87                 │
│   "尝试重置API密钥解决..."      │
│   [点击查看完整消息]            │
│                                  │
│ msg#5 (技术选中)                 │
│   ⭐⭐⭐ 0.75                   │
│   "API配置相关讨论..."          │
│   [点击查看完整消息]            │
└────────────────────────────────┘
```

### ChatRow组件增强

每条对话消息显示其索引号，方便追溯。

```
┌─ 消息 #12 ──────────────────────┐
│ 👤 用户 (2025-10-10 14:30)       │
│                                  │
│ 我的API调用返回403错误,怎么解决?│
│                                  │
│ 🤖 助手 (2025-10-10 14:31)       │
│                                  │
│ 403错误通常是权限问题...         │
│                                  │
│ 📎 相关性: ⭐⭐⭐⭐⭐ (0.95)     │
│    被2个Agent选中                │
└────────────────────────────────┘
```

## 🔧 技术实现要点

### 1. 消息索引号管理

- **全局计数器**: 从1开始递增，永不重复
- **持久化**: 存储在数据库/文件中
- **向后兼容**: 旧消息自动分配索引号

### 2. 裁判Agent实现

```typescript
class JudgeAgent {
	/**
	 * 分析用户消息，返回裁判决策
	 */
	async analyze(userMessage: string, context: AgentContext): Promise<JudgeDecision>

	/**
	 * 并行调用多个专家Agent
	 */
	async executeAgentsInParallel(
		userMessage: string,
		candidateMessages: HistoricalMessage[],
	): Promise<AgentSearchResult[]>

	/**
	 * 对比合并各Agent结果
	 */
	mergeAndDeduplicate(results: AgentSearchResult[]): {
		finalIndices: number[]
		duplicates: Map<number, string[]> // 哪些消息被多个Agent选中
	}
}
```

### 3. 专家Agent增强

每个专家Agent需要实现统一接口：

```typescript
interface ExpertAgent {
	/**
	 * 从候选消息中选择相关的
	 * @param userMessage 用户当前问题
	 * @param candidates 候选历史消息
	 * @returns 选中的消息索引号 + 相关性分数
	 */
	selectRelevantMessages(userMessage: string, candidates: HistoricalMessage[]): Promise<AgentSearchResult>
}
```

### 4. 向量检索集成

```typescript
class VectorMemoryStore {
	/**
	 * 语义搜索历史消息
	 * @returns 候选消息列表（带相似度分数）
	 */
	async semanticSearch(
		query: string,
		topK: number,
	): Promise<
		Array<{
			message: HistoricalMessage
			similarityScore: number
		}>
	>
}
```

## 📋 实现优先级

### P0 - 核心流程（必须实现）

1. ✅ 消息索引号系统
2. ✅ 裁判Agent基础实现
3. ✅ 多Agent并行执行
4. ✅ 结果对比和去重逻辑
5. ✅ UI显示增强（TaskHeader + ChatRow）

### P1 - 增强功能

6. ⚠️ 向量检索优化
7. ⚠️ 相关性评分算法
8. ⚠️ Token预算动态分配
9. ⚠️ 冲突消息处理

### P2 - 进阶功能

10. 🔮 A/B测试框架
11. 🔮 记忆图谱系统
12. 🔮 主动上下文补充

## ✅ 验收标准

### 功能验收

- [ ] 用户发送新消息时，能看到"裁判分析中..."状态
- [ ] TaskHeader显示裁判分析结果（意图、领域、时间范围）
- [ ] TaskHeader显示各Agent检索结果对比
- [ ] 能看到哪些消息被多个Agent共同选中
- [ ] 每条历史消息显示索引号（msg#1, msg#2, ...）
- [ ] 点击消息索引号能追溯到原始对话
- [ ] 主模型回答质量提升（使用精选上下文后）

### 性能验收

- [ ] 裁判分析 + Agent检索总耗时 < 3秒
- [ ] 并行Agent执行，无串行等待
- [ ] Token使用率 > 80%（精选后的上下文利用率高）
- [ ] 缓存命中率 > 50%（重复查询不重复计算）
