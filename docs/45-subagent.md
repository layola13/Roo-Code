# 详细需求 + 解决方案文档

## 📋 需求背景

### 核心问题

在长对话场景中，AI Agent 面临**上下文窗口限制**，导致：

1. 超过 token 限制后自动截断，丢失关键历史信息
2. 响应质量下降，无法理解完整对话背景
3. 成本上升（重复传输冗余历史）
   4 无法处理复杂的多轮任务

### 目标

- **扩展有效上下文**：从 4K tokens 扩展到 20K+ 有效信息量
- **保持响应质量**：不因压缩而丢失关键决策信息
- **控制成本**：减少冗余 token 传输
- **提升用户体验**：支持更长、更复杂的对话流程

---

## 🏗️ 整体架构方案

### 三层架构设计

```
┌─────────────────────────────────────────────────────┐
│                   主 Agent (协调层)                    │
│  - 对话管理                                            │
│  - 路由决策                                            │
│  - 上下文预算控制                                       │
└─────────────┬───────────────────────────────────────┘
              │
      ┌───────┴────────┬──────────────┬────────────┐
      ▼                ▼              ▼            ▼
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ 子Agent 1 │   │ 子Agent 2 │   │ 子Agent 3 │   │ 外部记忆 │
│ 上下文    │   │ 记忆     │   │ 代码     │   │ 向量库   │
│ 分析器    │   │ 提取器    │   │ 总结器    │   │          │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
      │                │              │            │
      └────────────────┴──────────────┴────────────┘
                         │
                    ┌────▼─────┐
                    │ 持久化层  │
                    │ - Redis  │
                    │ - Vector │
                    │ - SQLite │
                    └──────────┘
```

---

## 🎯 详细解决方案

## 方案 1：子 Agent 分流系统

### 1.1 子 Agent 设计

#### A. **Context Analyzer（上下文分析器）**

**职责：**

- 分析对话流程和阶段划分
- 识别话题转折点
- 生成对话结构图谱

**输入：**

```typescript
interface AnalyzerInput {
	messages: Message[] // 最近 N 条消息
	currentTopic?: string // 当前话题
	analysisDepth: "quick" | "deep"
}
```

**输出：**

```typescript
interface AnalyzerOutput {
	stages: Array<{
		stageNumber: number
		topic: string
		messageRange: [number, number]
		keyPoints: string[]
		importance: "critical" | "normal" | "low"
	}>
	transitionPoints: number[] // 话题转折的消息索引
	overallFlow: string // 整体流程描述（50-100词）
	recommendation: "compress" | "preserve" | "archive"
}
```

**触发条件：**

- 对话 > 15 轮
- 用户请求总结
- 准备进入新的主题讨论

#### B. **Memory Extractor（记忆提取器）**

**职责：**

- 提取关键决策、需求、约束条件
- 分类存储重要信息
- 优先级排序

**输入：**

```typescript
interface ExtractorInput {
	messages: Message[]
	focusCategories?: ("decision" | "requirement" | "technical" | "constraint")[]
	timeRange?: [Date, Date]
}
```

**输出：**

```typescript
interface ExtractorOutput {
  criticalItems: Array<{
    id: string;
    category: 'decision' | 'requirement' | 'technical' | 'constraint';
    content: string;
    context: string;           // 相关上下文
    importance: 1-10;          // 重要性评分
    timestamp: Date;
    relatedMessageIds: string[];
  }>;
  summary: string;             // 100-200 词总结
  keyEntities: Array<{         // 关键实体
    name: string;
    type: 'person' | 'system' | 'concept';
    mentions: number;
  }>;
}
```

**触发条件：**

- 每 20 轮对话自动触发
- 用户明确请求："记住这个决定"
- 检测到关键词：决定、要求、必须、不能等

#### C. **Code Summarizer（代码总结器）**

**职责：**

- 压缩代码变更历史
- 分析技术实现影响
- 风险评估

**输入：**

```typescript
interface CodeSummarizerInput {
	codeChanges: Array<{
		file: string
		diff: string
		type: "create" | "modify" | "delete"
	}>
	context?: string
	focusArea?: "security" | "performance" | "architecture"
}
```

**输出：**

```typescript
interface CodeSummarizerOutput {
  changes: Array<{
    file: string;
    changeType: string;
    summary: string;           // 单个文件摘要
    linesChanged: number;
    impactScore: 1-10;
  }>;
  overallImpact: string;       // 整体影响分析
  riskLevel: 'low' | 'medium' | 'high';
  dependencies: string[];      // 受影响的依赖
  recommendations: string[];   // 建议
}
```

---

### 1.2 Tool Call 实现

#### 核心工具定义

```typescript
// tools/subagent.ts
export const subagentTool = {
	name: "use_subagent",
	description: "Delegate specialized analysis to subagents for context management",

	parameters: {
		type: "object",
		properties: {
			agent_name: {
				type: "string",
				enum: ["condense-context-analyzer", "condense-memory-extractor", "condense-code-summarizer"],
				description: "Name of the subagent to invoke",
			},
			task: {
				type: "string",
				description: "Specific task or question (optional)",
			},
			context: {
				type: "string",
				description: "Additional context to help the subagent (optional)",
			},
			options: {
				type: "object",
				properties: {
					depth: {
						type: "string",
						enum: ["quick", "deep"],
						default: "quick",
					},
					messageRange: {
						type: "array",
						items: { type: "number" },
						description: "[startIndex, endIndex]",
					},
					categories: {
						type: "array",
						items: { type: "string" },
					},
				},
			},
		},
		required: ["agent_name"],
	},
}
```

#### 执行器实现

```typescript
// services/subagentExecutor.ts
export class SubagentExecutor {
	private vectorStore: VectorStore
	private cache: Cache

	async execute(params: SubagentParams): Promise<SubagentResult> {
		const { agent_name, task, context, options } = params

		// 1. 准备子 Agent 上下文
		const agentContext = await this.prepareContext(agent_name, options)

		// 2. 检查缓存
		const cacheKey = this.getCacheKey(agent_name, task, agentContext)
		const cached = await this.cache.get(cacheKey)
		if (cached && this.isCacheValid(cached)) {
			return cached
		}

		// 3. 选择执行器
		const executor = this.getExecutor(agent_name)

		// 4. 执行子 Agent
		const startTime = Date.now()
		const result = await executor.run({
			context: agentContext,
			task: task || executor.defaultTask,
			userContext: context,
			options: options || {},
		})

		// 5. 记录性能指标
		const metrics = {
			agent_name,
			execution_time: Date.now() - startTime,
			tokens_used: result.tokensUsed,
			cache_hit: false,
		}

		await this.logMetrics(metrics)

		// 6. 缓存结果
		await this.cache.set(cacheKey, result, { ttl: 300 })

		return result
	}

	private async prepareContext(agentName: string, options: any): Promise<AgentContext> {
		const messages = await this.getRelevantMessages(options.messageRange)

		switch (agentName) {
			case "condense-context-analyzer":
				return {
					messages,
					conversationMeta: await this.getConversationMeta(),
				}

			case "condense-memory-extractor":
				return {
					messages,
					existingMemories: await this.loadExistingMemories(),
					categories: options.categories || ["all"],
				}

			case "condense-code-summarizer":
				return {
					messages,
					codeChanges: await this.extractCodeChanges(messages),
					focusArea: options.focusArea,
				}

			default:
				throw new Error(`Unknown agent: ${agentName}`)
		}
	}

	private getExecutor(agentName: string): SubagentInterface {
		const executors = {
			"condense-context-analyzer": new ContextAnalyzerAgent(this.llm),
			"condense-memory-extractor": new MemoryExtractorAgent(this.llm, this.vectorStore),
			"condense-code-summarizer": new CodeSummarizerAgent(this.llm),
		}

		return executors[agentName]
	}
}
```

---

## 方案 2：上下文压缩策略

### 2.1 滚动窗口 + 摘要

```typescript
// services/contextManager.ts
export class ContextManager {
	private readonly WINDOW_SIZE = 10 // 保留最近 10 条完整消息
	private readonly SUMMARY_THRESHOLD = 20 // 每 20 条消息生成摘要

	async manageContext(messages: Message[]): Promise<ManagedContext> {
		if (messages.length <= this.WINDOW_SIZE) {
			return { fullMessages: messages, summaries: [] }
		}

		// 分段处理
		const oldMessages = messages.slice(0, -this.WINDOW_SIZE)
		const recentMessages = messages.slice(-this.WINDOW_SIZE)

		// 生成旧消息摘要
		const summaries = await this.generateSummaries(oldMessages)

		return {
			fullMessages: recentMessages,
			summaries: summaries,
			totalOriginalTokens: this.countTokens(messages),
			compressedTokens: this.countTokens(recentMessages) + this.countTokens(summaries),
		}
	}

	private async generateSummaries(messages: Message[]): Promise<Summary[]> {
		const summaries: Summary[] = []

		for (let i = 0; i < messages.length; i += this.SUMMARY_THRESHOLD) {
			const chunk = messages.slice(i, i + this.SUMMARY_THRESHOLD)

			const summary = await this.llm.generate({
				prompt: `Summarize this conversation segment (${chunk.length} messages) in 100-150 words. Focus on:
1. Key decisions made
2. Important requirements identified
3. Technical approaches discussed
4. Unresolved questions

Messages:
${chunk.map((m) => `${m.role}: ${m.content}`).join("\n")}`,
				maxTokens: 200,
			})

			summaries.push({
				messageRange: [i, i + chunk.length - 1],
				content: summary,
				timestamp: chunk[chunk.length - 1].timestamp,
			})
		}

		return summaries
	}
}
```

### 2.2 语义分段压缩

````typescript
// services/semanticCompressor.ts
export class SemanticCompressor {
  private vectorStore: VectorStore;

  async compress(messages: Message[]): Promise<CompressedContext> {
    // 1. 语义相似度聚类
    const embeddings = await this.generateEmbeddings(messages);
    const clusters = this.clusterBySimilarity(embeddings, messages);

    // 2. 每个簇生成代表性摘要
    const summaries = await Promise.all(
      clusters.map(cluster => this.summarizeCluster(cluster))
    );

    // 3. 保留高重要性的原始消息
    const criticalMessages = this.extractCriticalMessages(messages);

    return {
      summaries,
      criticalMessages,
      compressionRatio: this.calculateRatio(messages, { summaries, criticalMessages })
    };
  }

  private clusterBySimilarity(
    embeddings: number[][],
    messages: Message[]
  ): MessageCluster[] {
    // 使用 DBSCAN 或 K-means 聚类
    const clusters: MessageCluster[] = [];
    const threshold = 0.7; // 相似度阈值

    for (let i = 0; i < embeddings.length; i++) {
      let assigned = false;

      for (const cluster of clusters) {
        const similarity = this.cosineSimilarity(
          embeddings[i],
          cluster.centroid
        );

        if (similarity > threshold) {
          cluster.messages.push(messages[i]);
          cluster.updateCentroid(embeddings[i]);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        clusters.push(new MessageCluster([messages[i]], embeddings[i]));
      }
    }

    return clusters;
  }

  private extractCriticalMessages(messages: Message[]): Message[] {
    return messages.filter(msg => {
      // 关键词检测
      const keywords = [
        '决定', '要求', '必须', '不能', '重要',
        'decision', 'requirement', 'must', 'critical'
      ];

      const hasKeyword = keywords.some(kw =>
        msg.content.toLowerCase().includes(kw)
      );

      // 长度过滤（通常重要消息较长）
      const isSubstantial = msg.content.length > 100;

      # 详细需求 + 解决方案文档（续）

## 方案 2：上下文压缩策略（续）

### 2.2 语义分段压缩（续）

```typescript
  private extractCriticalMessages(messages: Message[]): Message[] {
    return messages.filter(msg => {
      // 关键词检测
      const keywords = [
        '决定', '要求', '必须', '不能', '重要',
        'decision', 'requirement', 'must', 'critical'
      ];

      const hasKeyword = keywords.some(kw =>
        msg.content.toLowerCase().includes(kw)
      );

      // 长度过滤（通常重要消息较长）
      const isSubstantial = msg.content.length > 100;

      // 用户确认消息
      const isConfirmation = /^(yes|ok|确认|同意|好的)/i.test(msg.content);

      // 代码块消息
      const hasCode = msg.content.includes('```');

      return (hasKeyword && isSubstantial) || isConfirmation || hasCode;
    });
  }

  private async summarizeCluster(cluster: MessageCluster): Promise<string> {
    const messages = cluster.messages.map(m =>
      `[${m.role}]: ${m.content}`
    ).join('\n');

    return await this.llm.generate({
      prompt: `这些消息讨论同一个主题。用2-3句话总结核心内容：\n${messages}`,
      maxTokens: 100
    });
  }
}
````

### 2.3 优先级队列管理

````typescript
// services/priorityContextManager.ts
export class PriorityContextManager {
	private priorityQueue: PriorityQueue<Message>

	constructor() {
		this.priorityQueue = new PriorityQueue((a, b) => this.calculatePriority(b) - this.calculatePriority(a))
	}

	async optimize(messages: Message[], budgetTokens: number): Promise<Message[]> {
		// 1. 计算每条消息的优先级
		messages.forEach((msg) => {
			msg.priority = this.calculatePriority(msg)
			this.priorityQueue.enqueue(msg)
		})

		// 2. 按优先级填充上下文预算
		const selectedMessages: Message[] = []
		let currentTokens = 0

		// 最近3条消息必须保留
		const recentMessages = messages.slice(-3)
		recentMessages.forEach((msg) => {
			selectedMessages.push(msg)
			currentTokens += this.countTokens(msg.content)
		})

		// 从队列中选择高优先级消息
		while (!this.priorityQueue.isEmpty() && currentTokens < budgetTokens) {
			const msg = this.priorityQueue.dequeue()

			// 跳过已选择的最近消息
			if (recentMessages.includes(msg)) continue

			const msgTokens = this.countTokens(msg.content)
			if (currentTokens + msgTokens <= budgetTokens) {
				selectedMessages.push(msg)
				currentTokens += msgTokens
			}
		}

		// 3. 按时间顺序排序
		return selectedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
	}

	private calculatePriority(msg: Message): number {
		let score = 0

		// 1. 时间衰减（越新越重要）
		const ageMinutes = (Date.now() - msg.timestamp.getTime()) / 60000
		score += Math.max(0, 100 - ageMinutes * 2) // 每分钟衰减2分

		// 2. 角色权重
		const roleWeights = {
			user: 10, // 用户消息优先
			assistant: 5,
			system: 15, // 系统指令最重要
		}
		score += roleWeights[msg.role] || 0

		// 3. 内容特征
		if (msg.content.includes("```")) score += 20 // 代码
		if (msg.content.length > 500) score += 15 // 长内容
		if (/\d+\.\s/.test(msg.content)) score += 10 // 列表

		// 4. 关键词加权
		const criticalKeywords = [
			"决定",
			"要求",
			"问题",
			"错误",
			"重要",
			"bug",
			"error",
			"critical",
			"must",
			"requirement",
		]
		criticalKeywords.forEach((kw) => {
			if (msg.content.toLowerCase().includes(kw)) score += 25
		})

		// 5. 引用关系（被引用的消息更重要）
		if (msg.referencedBy && msg.referencedBy.length > 0) {
			score += msg.referencedBy.length * 10
		}

		// 6. 用户反馈
		if (msg.userFeedback === "helpful") score += 30
		if (msg.userFeedback === "unhelpful") score -= 20

		return score
	}
}
````

---

## 方案 3：外部记忆系统

### 3.1 向量数据库集成

```typescript
// services/vectorMemory.ts
import { Pinecone } from "@pinecone-database/pinecone"
import { OpenAIEmbeddings } from "langchain/embeddings/openai"

export class VectorMemoryStore {
	private pinecone: Pinecone
	private embeddings: OpenAIEmbeddings
	private indexName = "conversation-memory"

	constructor() {
		this.pinecone = new Pinecone({
			apiKey: process.env.PINECONE_API_KEY,
		})
		this.embeddings = new OpenAIEmbeddings({
			modelName: "text-embedding-3-small",
		})
	}

	async store(memory: MemoryItem): Promise<void> {
		// 1. 生成向量
		const vector = await this.embeddings.embedQuery(memory.content)

		// 2. 构建元数据
		const metadata = {
			conversationId: memory.conversationId,
			userId: memory.userId,
			timestamp: memory.timestamp.toISOString(),
			category: memory.category,
			importance: memory.importance,
			messageIds: memory.relatedMessageIds,
			tags: memory.tags,
		}

		// 3. 存储到 Pinecone
		const index = this.pinecone.index(this.indexName)
		await index.upsert([
			{
				id: memory.id,
				values: vector,
				metadata,
			},
		])
	}

	async search(query: string, options: SearchOptions = {}): Promise<MemoryItem[]> {
		const { topK = 5, filter = {}, minScore = 0.7 } = options

		// 1. 生成查询向量
		const queryVector = await this.embeddings.embedQuery(query)

		// 2. 搜索
		const index = this.pinecone.index(this.indexName)
		const results = await index.query({
			vector: queryVector,
			topK,
			filter,
			includeMetadata: true,
		})

		// 3. 过滤和转换
		return results.matches
			.filter((match) => match.score >= minScore)
			.map(
				(match) =>
					({
						id: match.id,
						content: match.metadata.content as string,
						score: match.score,
						...match.metadata,
					}) as MemoryItem,
			)
	}

	async getRelatedMemories(messageId: string, limit: number = 3): Promise<MemoryItem[]> {
		// 通过 message ID 查找相关记忆
		const index = this.pinecone.index(this.indexName)
		const results = await index.query({
			filter: {
				messageIds: { $in: [messageId] },
			},
			topK: limit,
			includeMetadata: true,
		})

		return results.matches.map((match) => this.parseMemoryItem(match))
	}
}
```

### 3.2 分层存储架构

```typescript
// services/tieredStorage.ts
export class TieredStorageManager {
	private hotCache: Redis // L1: Redis (最近访问)
	private warmStorage: SQLite // L2: SQLite (近期会话)
	private coldStorage: VectorStore // L3: Vector DB (长期记忆)

	async store(memory: MemoryItem): Promise<void> {
		// 1. 写入 L1 缓存 (TTL: 1小时)
		await this.hotCache.setex(`mem:${memory.id}`, 3600, JSON.stringify(memory))

		// 2. 写入 L2 存储 (保留7天)
		await this.warmStorage.run(
			`INSERT INTO memories (id, content, metadata, created_at)
       VALUES (?, ?, ?, ?)`,
			[memory.id, memory.content, JSON.stringify(memory.metadata), Date.now()],
		)

		// 3. 异步写入 L3 (永久存储 + 向量索引)
		this.coldStorage.store(memory).catch((err) => console.error("Cold storage failed:", err))
	}

	async retrieve(query: string, context: RetrievalContext): Promise<MemoryItem[]> {
		const results: MemoryItem[] = []

		// 1. 先查 L1 缓存 (精确匹配)
		const cacheKey = `query:${this.hashQuery(query)}`
		const cached = await this.hotCache.get(cacheKey)
		if (cached) {
			return JSON.parse(cached)
		}

		// 2. 查 L2 近期记忆 (SQL 全文搜索)
		const recentMemories = await this.warmStorage.all(
			`SELECT * FROM memories 
       WHERE conversation_id = ? 
       AND created_at > ?
       ORDER BY created_at DESC
       LIMIT 10`,
			[context.conversationId, Date.now() - 7 * 24 * 3600 * 1000],
		)
		results.push(...recentMemories.map((row) => this.parseMemory(row)))

		// 3. 查 L3 长期记忆 (向量语义搜索)
		const longTermMemories = await this.coldStorage.search(query, {
			topK: 5,
			filter: { userId: context.userId },
		})
		results.push(...longTermMemories)

		// 4. 去重、排序、缓存结果
		const uniqueResults = this.deduplicateAndRank(results)
		await this.hotCache.setex(cacheKey, 300, JSON.stringify(uniqueResults))

		return uniqueResults
	}

	// 后台清理任务
	async cleanupTask(): Promise<void> {
		// L2 -> L3 迁移 (7天前的数据)
		const oldMemories = await this.warmStorage.all(`SELECT * FROM memories WHERE created_at < ?`, [
			Date.now() - 7 * 24 * 3600 * 1000,
		])

		for (const memory of oldMemories) {
			await this.coldStorage.store(this.parseMemory(memory))
			await this.warmStorage.run(`DELETE FROM memories WHERE id = ?`, [memory.id])
		}
	}
}
```

---

## 方案 4：智能路由决策

### 4.1 主 Agent 决策引擎

````typescript
// services/routingEngine.ts
export class RoutingEngine {
  private contextManager: ContextManager;
  private subagentExecutor: SubagentExecutor;
  private memoryStore: VectorMemoryStore;

  async decide(request: UserRequest): Promise<ExecutionPlan> {
    const context = await this.analyzeContext(request);

    // 决策树
    if (context.tokenCount > 8000) {
      return this.handleLargeContext(request, context);
    }

    if (context.requiresHistoricalKnowledge) {
      return this.handleMemoryRetrieval(request, context);
    }

    if (context.isComplexTask) {
      return this.handleComplexTask(request, context);
    }

    // 默认：直接处理
    return {
      strategy: 'direct',
      actions: [{
        type: 'respond',
        withContext: context.recentMessages
      }]
    };
  }

  private async handleLargeContext(
    request: UserRequest,
    context: ContextAnalysis
  ): Promise<ExecutionPlan> {
    return {
      strategy: 'compress-then-respond',
      actions: [
        // 步骤1: 调用上下文分析器
        {
          type: 'subagent',
          agent: 'condense-context-analyzer',
          task: 'Identify conversation stages and transitions',
          output: 'stageAnalysis'
        },
        // 步骤2: 提取关键记忆
        {
          type: 'subagent',
          agent: 'condense-memory-extractor',
          task: 'Extract critical decisions and requirements',
          dependsOn: 'stageAnalysis',
          output: 'criticalMemories'
        },
        // 步骤3: 存储到外部记忆
        {
          type: 'store',
          target: 'vectorMemory',
          data: 'criticalMemories'
        },
        // 步骤4: 用压缩后的上下文回复
        {
          type: 'respond',
          withContext: {
            recentMessages: context.recentMessages.slice(-5),
            summaries: ['stageAnalysis', 'criticalMemories']
          }
        }
      ]
    };
  }

  private async handleMemoryRetrieval(
    request: UserRequest,
    context: ContextAnalysis
  ): Promise<ExecutionPlan> {
    return {
      strategy: 'retrieve-then-respond',
      actions: [
        // 步骤1: 语义搜索相关记忆
        {
          type: 'memory-search',
          query: request.content,
          topK: 3,
          output: 'relevantMemories'
        },
        // 步骤2: 结合记忆回复
        {
          type: 'respond',
          withContext: {
            recentMessages: context.recentMessages.slice(-5),
            memories: 'relevantMemories'
          }
        }
      ]
    };
  }

  private async handleComplexTask(
    request: UserRequest,
    context: ContextAnalysis
  ): Promise<ExecutionPlan> {
    # 详细需求 + 解决方案文档（续）

## 方案 4：智能路由决策（续）

### 4.1 主 Agent 决策引擎（续）

```typescript
  private async handleComplexTask(
    request: UserRequest,
    context: ContextAnalysis
  ): Promise<ExecutionPlan> {
    // 复杂任务：分解为多个子任务
    return {
      strategy: 'multi-agent-collaboration',
      actions: [
        // 步骤1: 如果涉及代码，先总结代码变更
        ...(context.hasCodeChanges ? [{
          type: 'subagent',
          agent: 'condense-code-summarizer',
          task: 'Summarize recent code changes',
          output: 'codeSummary'
        }] : []),

        // 步骤2: 检索相关历史决策
        {
          type: 'memory-search',
          query: this.extractKeyTerms(request.content),
          filter: { category: 'decision' },
          topK: 3,
          output: 'pastDecisions'
        },

        // 步骤3: 综合分析后回复
        {
          type: 'respond',
          withContext: {
            recentMessages: context.recentMessages.slice(-3),
            summaries: ['codeSummary', 'pastDecisions']
          },
          instructions: 'Consider past decisions and code changes when responding'
        }
      ]
    };
  }

  private async analyzeContext(request: UserRequest): Promise<ContextAnalysis> {
    const messages = await this.contextManager.getMessages(request.conversationId);

    return {
      tokenCount: this.countTokens(messages),
      messageCount: messages.length,
      recentMessages: messages,

      // 判断是否需要历史知识
      requiresHistoricalKnowledge: this.detectHistoricalReference(request),

      // 判断是否复杂任务
      isComplexTask: this.detectComplexity(request),

      // 判断是否有代码变更
      hasCodeChanges: messages.some(m => m.content.includes('```')),

      // 当前话题
      currentTopic: await this.extractTopic(messages)
    };
  }

  private detectHistoricalReference(request: UserRequest): boolean {
    const historicalKeywords = [
      '之前', '刚才', '前面', '上次', 'earlier', 'previous',
      'before', 'we discussed', '我们说过', '记得'
    ];

    return historicalKeywords.some(kw =>
      request.content.toLowerCase().includes(kw)
    );
  }

  private detectComplexity(request: UserRequest): boolean {
    const complexitySignals = [
      request.content.length > 500,                    // 长请求
      (request.content.match(/\?/g) || []).length > 2, // 多个问题
      /比较|对比|分析|评估|建议/.test(request.content),  // 分析性词汇
      /architecture|design|refactor|optimize/.test(request.content)
    ];

    return complexitySignals.filter(Boolean).length >= 2;
  }
}
````

### 4.2 执行计划调度器

```typescript
// services/executionScheduler.ts
export class ExecutionScheduler {
	async execute(plan: ExecutionPlan): Promise<ExecutionResult> {
		const outputs: Record<string, any> = {}
		const timings: Record<string, number> = {}

		for (const action of plan.actions) {
			// 检查依赖
			if (action.dependsOn && !outputs[action.dependsOn]) {
				throw new Error(`Dependency ${action.dependsOn} not satisfied`)
			}

			const startTime = Date.now()

			try {
				switch (action.type) {
					case "subagent":
						outputs[action.output] = await this.executeSubagent(action, outputs)
						break

					case "memory-search":
						outputs[action.output] = await this.executeMemorySearch(action)
						break

					case "store":
						await this.executeStore(action, outputs)
						break

					case "respond":
						const response = await this.executeRespond(action, outputs)
						outputs["finalResponse"] = response
						break
				}

				timings[action.type] = Date.now() - startTime
			} catch (error) {
				console.error(`Action ${action.type} failed:`, error)

				// 降级策略
				if (action.fallback) {
					outputs[action.output] = await this.executeFallback(action.fallback)
				} else {
					throw error
				}
			}
		}

		return {
			success: true,
			outputs,
			timings,
			totalTime: Object.values(timings).reduce((a, b) => a + b, 0),
		}
	}

	private async executeSubagent(action: SubagentAction, outputs: Record<string, any>): Promise<any> {
		const context = action.dependsOn ? outputs[action.dependsOn] : undefined

		return await this.subagentExecutor.execute({
			agent_name: action.agent,
			task: action.task,
			context: JSON.stringify(context),
		})
	}

	private async executeMemorySearch(action: MemorySearchAction): Promise<MemoryItem[]> {
		return await this.memoryStore.search(action.query, {
			topK: action.topK || 5,
			filter: action.filter || {},
			minScore: 0.7,
		})
	}

	private async executeStore(action: StoreAction, outputs: Record<string, any>): Promise<void> {
		const data = outputs[action.data]

		if (action.target === "vectorMemory") {
			// 批量存储到向量数据库
			if (Array.isArray(data)) {
				await Promise.all(data.map((item) => this.memoryStore.store(item)))
			} else {
				await this.memoryStore.store(data)
			}
		}
	}

	private async executeRespond(action: RespondAction, outputs: Record<string, any>): Promise<string> {
		// 构建增强上下文
		let contextString = ""

		// 添加最近消息
		if (action.withContext.recentMessages) {
			contextString += "## Recent Conversation:\n"
			contextString += action.withContext.recentMessages.map((m) => `${m.role}: ${m.content}`).join("\n\n")
		}

		// 添加摘要
		if (action.withContext.summaries) {
			contextString += "\n\n## Relevant Context:\n"
			action.withContext.summaries.forEach((key) => {
				const summary = outputs[key]
				contextString += `\n### ${key}:\n${JSON.stringify(summary, null, 2)}\n`
			})
		}

		// 添加检索到的记忆
		if (action.withContext.memories) {
			const memories = outputs[action.withContext.memories]
			contextString += "\n\n## Relevant Past Information:\n"
			memories.forEach((mem: MemoryItem, idx: number) => {
				contextString += `${idx + 1}. [${mem.category}] ${mem.content}\n`
			})
		}

		// 调用主 LLM 生成回复
		return await this.llm.generate({
			systemPrompt: action.instructions || "You are a helpful assistant.",
			context: contextString,
			userMessage: this.currentUserMessage,
		})
	}
}
```

---

## 方案 5：渐进式压缩流程

### 5.1 自动触发机制

```typescript
// services/autoCompressionTrigger.ts
export class AutoCompressionTrigger {
	private readonly THRESHOLDS = {
		messageCount: 20, // 每20条消息触发
		tokenCount: 8000, // 超过8K tokens触发
		timeSinceLastCompression: 3600000, // 1小时未压缩触发
	}

	private lastCompressionTime: number = Date.now()

	async checkAndTrigger(conversationState: ConversationState): Promise<CompressionTask | null> {
		const checks = [
			this.checkMessageCount(conversationState),
			this.checkTokenCount(conversationState),
			this.checkTimeElapsed(conversationState),
		]

		const triggeredCheck = checks.find((check) => check.shouldTrigger)

		if (triggeredCheck) {
			console.log(`Compression triggered by: ${triggeredCheck.reason}`)
			return this.createCompressionTask(triggeredCheck, conversationState)
		}

		return null
	}

	private checkMessageCount(state: ConversationState): TriggerCheck {
		const count = state.messages.length
		return {
			shouldTrigger: count >= this.THRESHOLDS.messageCount,
			reason: `Message count (${count}) exceeded threshold`,
			priority: "medium",
		}
	}

	private checkTokenCount(state: ConversationState): TriggerCheck {
		const tokens = this.countTokens(state.messages)
		return {
			shouldTrigger: tokens >= this.THRESHOLDS.tokenCount,
			reason: `Token count (${tokens}) exceeded threshold`,
			priority: "high",
		}
	}

	private checkTimeElapsed(state: ConversationState): TriggerCheck {
		const elapsed = Date.now() - this.lastCompressionTime
		return {
			shouldTrigger: elapsed >= this.THRESHOLDS.timeSinceLastCompression && state.messages.length > 10,
			reason: `Time elapsed (${elapsed}ms) since last compression`,
			priority: "low",
		}
	}

	private async createCompressionTask(check: TriggerCheck, state: ConversationState): Promise<CompressionTask> {
		return {
			id: generateId(),
			conversationId: state.conversationId,
			trigger: check.reason,
			priority: check.priority,
			messageRange: this.determineMessageRange(state, check),
			strategy: this.selectStrategy(check),
			createdAt: Date.now(),
		}
	}

	private selectStrategy(check: TriggerCheck): CompressionStrategy {
		switch (check.priority) {
			case "high":
				// 高优先级：完整压缩（分析+提取+总结）
				return {
					steps: [
						{ agent: "condense-context-analyzer", weight: 1 },
						{ agent: "condense-memory-extractor", weight: 1 },
						{ agent: "condense-code-summarizer", weight: 0.5 },
					],
				}

			case "medium":
				// 中优先级：快速压缩（只提取记忆）
				return {
					steps: [{ agent: "condense-memory-extractor", weight: 1 }],
				}

			case "low":
				// 低优先级：最小压缩（只总结）
				return {
					steps: [{ agent: "condense-context-analyzer", weight: 1, options: { depth: "quick" } }],
				}
		}
	}
}
```

### 5.2 后台压缩队列

```typescript
// services/compressionQueue.ts
import Bull from "bull"

export class CompressionQueue {
	private queue: Bull.Queue<CompressionTask>
	private executor: SubagentExecutor
	private storage: TieredStorageManager

	constructor() {
		this.queue = new Bull("compression-tasks", {
			redis: {
				host: process.env.REDIS_HOST,
				port: parseInt(process.env.REDIS_PORT),
			},
		})

		this.setupProcessors()
	}

	private setupProcessors(): void {
		// 根据优先级设置不同的并发数
		this.queue.process("high", 3, (job) => this.processTask(job.data))
		this.queue.process("medium", 2, (job) => this.processTask(job.data))
		this.queue.process("low", 1, (job) => this.processTask(job.data))
	}

	async enqueue(task: CompressionTask): Promise<void> {
		await this.queue.add(task.priority, task, {
			priority: this.getPriorityValue(task.priority),
			attempts: 3,
			backoff: {
				type: "exponential",
				delay: 2000,
			},
		})
	}

	private async processTask(task: CompressionTask): Promise<CompressionResult> {
		console.log(`Processing compression task ${task.id}`)

		const results: any[] = []

		// 执行压缩策略中的每个步骤
		for (const step of task.strategy.steps) {
			try {
				const result = await this.executor.execute({
					agent_name: step.agent,
					task: `Compress messages ${task.messageRange[0]} to ${task.messageRange[1]}`,
					options: step.options || {},
				})

				results.push({
					agent: step.agent,
					output: result,
					weight: step.weight,
				})
			} catch (error) {
				console.error(`Step ${step.agent} failed:`, error)
				// 继续执行其他步骤
			}
		}

		// 合并结果并存储
		const compressedContext = this.mergeResults(results)
		await this.storage.store({
			id: generateId(),
			conversationId: task.conversationId,
			type: "compressed-context",
			content: compressedContext,
			originalMessageRange: task.messageRange,
			compressionRatio: this.calculateCompressionRatio(task, compressedContext),
			timestamp: new Date(),
		})

		return {
			taskId: task.id,
			success: true,
			compressedContext,
			tokensReduced: this.calculateTokenReduction(task, compressedContext),
		}
	}

	private mergeResults(results: any[]): string {
		// 按权重合并多个子 Agent 的输出
		let merged = "# Compressed Context\n\n"

		results.forEach(({ agent, output, weight }) => {
			merged += `## ${agent} (weight: ${weight})\n`

			if (typeof output === "string") {
				merged += output + "\n\n"
			} else {
				merged += JSON.stringify(output, null, 2) + "\n\n"
			}
		})

		return merged
	}

	private getPriorityValue(priority: string): number {
		const map = { high: 1, medium: 2, low: 3 }
		return map[priority] || 3
	}
}
```

---

## 方

# 详细需求 + 解决方案文档（续）

## 方案 6：实时监控与优化

### 6.1 性能监控仪表板

```typescript
// services/performanceMonitor.ts
export class PerformanceMonitor {
	private metrics: MetricsCollector
	private alerts: AlertManager

	async trackConversation(conversationId: string): Promise<ConversationMetrics> {
		return {
			tokenUsage: {
				input: await this.getInputTokens(conversationId),
				output: await this.getOutputTokens(conversationId),
				total: 0,
				trend: this.calculateTrend(conversationId),
			},

			compressionMetrics: {
				originalTokens: 0,
				compressedTokens: 0,
				ratio: 0,
				timeSaved: 0,
			},

			memoryOperations: {
				stores: await this.countMemoryStores(conversationId),
				retrievals: await this.countMemoryRetrievals(conversationId),
				cacheHitRate: await this.calculateCacheHitRate(conversationId),
			},

			subagentCalls: {
				analyzer: 0,
				extractor: 0,
				summarizer: 0,
				totalTime: 0,
			},

			qualityScores: {
				coherence: await this.assessCoherence(conversationId),
				completeness: await this.assessCompleteness(conversationId),
				userSatisfaction: await this.getUserFeedback(conversationId),
			},
		}
	}

	async detectAnomalies(conversationId: string): Promise<Anomaly[]> {
		const anomalies: Anomaly[] = []
		const metrics = await this.trackConversation(conversationId)

		// 检测 Token 爆炸
		if (metrics.tokenUsage.total > 15000) {
			anomalies.push({
				type: "token-explosion",
				severity: "high",
				message: `Token count (${metrics.tokenUsage.total}) exceeds safe threshold`,
				recommendation: "Trigger aggressive compression or archive old messages",
			})
		}

		// 检测压缩失效
		if (metrics.compressionMetrics.ratio < 0.3) {
			anomalies.push({
				type: "poor-compression",
				severity: "medium",
				message: `Compression ratio (${metrics.compressionMetrics.ratio}) is below expected`,
				recommendation: "Review compression strategy or switch to semantic clustering",
			})
		}

		// 检测缓存未命中
		if (metrics.memoryOperations.cacheHitRate < 0.5) {
			anomalies.push({
				type: "low-cache-hit",
				severity: "low",
				message: `Cache hit rate (${metrics.memoryOperations.cacheHitRate}) is low`,
				recommendation: "Increase cache TTL or review caching strategy",
			})
		}

		// 检测质量下降
		if (metrics.qualityScores.coherence < 0.6) {
			anomalies.push({
				type: "quality-degradation",
				severity: "high",
				message: `Response coherence (${metrics.qualityScores.coherence}) has degraded`,
				recommendation: "Preserve more context or reduce compression aggressiveness",
			})
		}

		return anomalies
	}

	// 自动调优
	async autoTune(conversationId: string): Promise<OptimizationPlan> {
		const anomalies = await this.detectAnomalies(conversationId)
		const plan: OptimizationPlan = { actions: [] }

		for (const anomaly of anomalies) {
			switch (anomaly.type) {
				case "token-explosion":
					plan.actions.push({
						type: "adjust-compression-threshold",
						params: { threshold: 6000 }, // 降低触发阈值
					})
					plan.actions.push({
						type: "increase-compression-frequency",
						params: { interval: 15 }, // 每15条消息压缩
					})
					break

				case "poor-compression":
					plan.actions.push({
						type: "switch-compression-strategy",
						params: { strategy: "semantic-clustering" },
					})
					break

				case "quality-degradation":
					plan.actions.push({
						type: "preserve-more-context",
						params: { windowSize: 15 }, // 增加保留窗口
					})
					plan.actions.push({
						type: "increase-memory-retrieval",
						params: { topK: 5 }, // 检索更多相关记忆
					})
					break
			}
		}

		return plan
	}
}
```

### 6.2 A/B 测试框架

```typescript
// services/experimentManager.ts
export class ExperimentManager {
	private experiments: Map<string, Experiment> = new Map()

	async createExperiment(config: ExperimentConfig): Promise<string> {
		const experiment: Experiment = {
			id: generateId(),
			name: config.name,
			variants: config.variants,
			allocation: config.allocation || { control: 0.5, treatment: 0.5 },
			metrics: [],
			startDate: new Date(),
			status: "active",
		}

		this.experiments.set(experiment.id, experiment)
		return experiment.id
	}

	// 示例实验：对比不同压缩策略
	async runCompressionStrategyExperiment(): Promise<void> {
		const experimentId = await this.createExperiment({
			name: "compression-strategy-comparison",
			variants: [
				{
					name: "control",
					description: "Rolling window + basic summarization",
					config: {
						strategy: "rolling-window",
						windowSize: 10,
						summaryThreshold: 20,
					},
				},
				{
					name: "semantic-clustering",
					description: "Semantic clustering with priority queue",
					config: {
						strategy: "semantic-clustering",
						similarityThreshold: 0.7,
						priorityWeights: {
							recency: 0.3,
							importance: 0.5,
							relevance: 0.2,
						},
					},
				},
				{
					name: "hybrid",
					description: "Hybrid: clustering + subagent extraction",
					config: {
						strategy: "hybrid",
						useSubagents: true,
						aggressiveness: "medium",
					},
				},
			],
			allocation: {
				control: 0.33,
				"semantic-clustering": 0.33,
				hybrid: 0.34,
			},
		})

		// 在后续对话中自动分配变体
		console.log(`Experiment ${experimentId} created`)
	}

	async assignVariant(userId: string, experimentId: string): Promise<string> {
		const experiment = this.experiments.get(experimentId)
		if (!experiment) throw new Error("Experiment not found")

		// 一致性哈希：同一用户始终获得相同变体
		const hash = this.hashUserId(userId, experimentId)
		const allocation = experiment.allocation

		let cumulativeProbability = 0
		for (const [variant, probability] of Object.entries(allocation)) {
			cumulativeProbability += probability
			if (hash < cumulativeProbability) {
				return variant
			}
		}

		return "control"
	}

	async recordMetric(experimentId: string, variant: string, metric: MetricRecord): Promise<void> {
		const experiment = this.experiments.get(experimentId)
		if (!experiment) return

		experiment.metrics.push({
			variant,
			timestamp: new Date(),
			...metric,
		})
	}

	async analyzeResults(experimentId: string): Promise<ExperimentResults> {
		const experiment = this.experiments.get(experimentId)
		if (!experiment) throw new Error("Experiment not found")

		const results: ExperimentResults = {
			experimentId,
			variants: {},
		}

		for (const variant of experiment.variants) {
			const variantMetrics = experiment.metrics.filter((m) => m.variant === variant.name)

			results.variants[variant.name] = {
				sampleSize: variantMetrics.length,
				metrics: {
					avgTokensSaved: this.calculateAverage(variantMetrics, "tokensSaved"),
					avgCompressionRatio: this.calculateAverage(variantMetrics, "compressionRatio"),
					avgResponseTime: this.calculateAverage(variantMetrics, "responseTime"),
					qualityScore: this.calculateAverage(variantMetrics, "qualityScore"),
					userSatisfaction: this.calculateAverage(variantMetrics, "userSatisfaction"),
				},
				statisticalSignificance: this.calculateSignificance(
					variantMetrics,
					experiment.metrics.filter((m) => m.variant === "control"),
				),
			}
		}

		// 推荐最佳变体
		results.recommendation = this.selectWinner(results.variants)

		return results
	}

	private selectWinner(variants: Record<string, VariantResult>): string {
		let bestScore = -Infinity
		let winner = "control"

		for (const [name, result] of Object.entries(variants)) {
			// 综合评分：50% 压缩效果 + 30% 质量 + 20% 速度
			const score =
				result.metrics.avgCompressionRatio * 0.5 +
				result.metrics.qualityScore * 0.3 +
				(1 / result.metrics.avgResponseTime) * 0.2

			// 必须有统计显著性
			if (score > bestScore && result.statisticalSignificance.pValue < 0.05) {
				bestScore = score
				winner = name
			}
		}

		return winner
	}
}
```

---

## 方案 7：完整系统集成

### 7.1 主控制器

````typescript
// controllers/conversationController.ts
export class ConversationController {
  private routingEngine: RoutingEngine;
  private executionScheduler: ExecutionScheduler;
  private contextManager: ContextManager;
  private compressionTrigger: AutoCompressionTrigger;
  private compressionQueue: CompressionQueue;
  private performanceMonitor: PerformanceMonitor;
  private experimentManager: ExperimentManager;

  async handleUserMessage(request: UserMessageRequest): Promise<AssistantResponse> {
    const { conversationId, userId, content } = request;

    // 1. 加载会话状态
    const conversationState = await this.loadConversationState(conversationId);

    // 2. 检查是否需要压缩（后台触发）
    const compressionTask = await this.compressionTrigger.checkAndTrigger(conversationState);
    if (compressionTask) {
      this.compressionQueue.enqueue(compressionTask).catch(err =>
        console.error('Compression queue error:', err)
      );
    }

    // 3. 获取实验变体（如果在实验中）
    const activeExperiment = await this.getActiveExperiment(userId);
    if (activeExperiment) {
      const variant = await this.experimentManager.assignVariant(userId, activeExperiment.id);
      conversationState.experimentConfig = activeExperiment.variants.find(v => v.name === variant)?.config;
    }

    // 4. 智能路由决策
    const executionPlan = await this.routingEngine.decide({
      conversationId,
      userId,
      content,
      conversationState
    });

    // 5. 执行计划
    const executionResult = await this.executionScheduler.execute(executionPlan);

    // 6. 记录性能指标
    await this.performanceMonitor.trackConversation(conversationId);

    // 7. 检测并自动调优
    const anomalies = await this.performanceMonitor.detectAnomalies(conversationId);
    if (anomalies.some(a => a.severity === 'high')) {
      const optimizationPlan = await this.performanceMonitor.autoTune(conversationId);
      await this.applyOptimizations(conversationId, optimizationPlan);
    }

    // 8. 记录实验指标
    if (activeExperiment) {
      await this.experimentManager.recordMetric(activeExperiment.id, conversationState.experimentConfig.strategy, {
        tokensSaved: executionResult.outputs.compressionMetrics?.tokensSaved || 0,
        compressionRatio: executionResult.outputs.compressionMetrics?.ratio || 1,
        responseTime: executionResult.totalTime,
        qualityScore: await this.assessResponseQuality(executionResult.outputs.finalResponse),
        userSatisfaction: 0 // 后续用户反馈时更新
      });
    }

    // 9. 更新会话状态
    await this.updateConversationState(conversationId, {
      messages: [
        ...conversationState.messages,
        { role: 'user', content, timestamp: new Date() },
        { role: 'assistant', content: executionResult.outputs.finalResponse, timestamp: new Date() }
      ]
    });

    // 10. 返回响应
    return {
      content: executionResult.outputs.finalResponse,
      metadata: {
        tokensUsed: executionResult.outputs.tokensUsed,
        executionTime: executionResult.totalTime,
        compressionApplied: !!compressionTask,
        subagentsCalled: Object.keys(executionResult.outputs).filter(k => k.includes('Agent')).length
      }
    };
  }

  private async loadConversationState(conversationId: string): Promise<ConversationState> {
    // 从分层存储加载
    const recentMessages = await this.contextManager.getMessages(conversationId);
    const compressedContext = await this.contextManager.getCompressedContext(conversationId);

    return {
      conversationId,
      messages: recentMessages,
      compressedContext,
      metadata: await this.contextManager.getMetadata(conversationId)
    };
  }

  private async applyOptimizations(
    conversationId: string,
    plan: OptimizationPlan
  ): Promise<void> {
    for (const action of plan.actions) {
      try {
        switch (action.type) {
          case 'adjust-compression-threshold':
            await this.compressionTrigger.updateThreshold(conversationId, action.params.threshold);
            break;

          case 'increase-compression-frequency':
            await this.compressionTrigger.updateInterval(conversationId, action.params.interval);
            break;

          case 'switch-compression-strategy':
            await this.contextManager.updateStrategy(conversationId, action.params.strategy);
            break;

          case 'preserve-more-context':
            await this.contextManager.updateWindowSize(conversationId, action.params.windowSize);
            break;
        }
      } catch (error) {
        # 详细需求 + 解决方案文档（续）

## 方案 7：完整系统集成（续）

### 7.1 主控制器（续）

```typescript
        }
      } catch (error) {
        console.error(`Failed to apply optimization ${action.type}:`, error);
      }
    }
  }

  private async assessResponseQuality(response: string): Promise<number> {
    // 简单的质量评估（可以后续用 LLM 评估）
    let score = 0.5;

    // 长度合理性
    if (response.length > 100 && response.length < 5000) score += 0.1;

    // 结构化内容
    if (response.includes('\n') || response.includes('- ') || response.includes('1.')) score += 0.1;

    // 代码示例
    if (response.includes('```')) score += 0.1;

    // 具体性（避免过于笼统）
    const vagueWords = ['maybe', 'perhaps', 'possibly', '可能', '也许'];
    const vagueCount = vagueWords.filter(w => response.toLowerCase().includes(w)).length;
    score -= vagueCount * 0.05;

    return Math.max(0, Math.min(1, score));
  }
}
````

### 7.2 API 端点

```typescript
// routes/api.ts
import express from "express"

const router = express.Router()
const controller = new ConversationController()

// 主对话端点
router.post("/conversations/:id/messages", async (req, res) => {
	try {
		const { id: conversationId } = req.params
		const { content, userId } = req.body

		const response = await controller.handleUserMessage({
			conversationId,
			userId,
			content,
		})

		res.json(response)
	} catch (error) {
		res.status(500).json({ error: error.message })
	}
})

// 获取会话摘要
router.get("/conversations/:id/summary", async (req, res) => {
	try {
		const { id } = req.params
		const summary = await controller.getConversationSummary(id)
		res.json(summary)
	} catch (error) {
		res.status(500).json({ error: error.message })
	}
})

// 手动触发压缩
router.post("/conversations/:id/compress", async (req, res) => {
	try {
		const { id } = req.params
		const { strategy = "auto" } = req.body

		const result = await controller.manualCompress(id, strategy)
		res.json(result)
	} catch (error) {
		res.status(500).json({ error: error.message })
	}
})

// 获取性能指标
router.get("/conversations/:id/metrics", async (req, res) => {
	try {
		const { id } = req.params
		const metrics = await controller.getMetrics(id)
		res.json(metrics)
	} catch (error) {
		res.status(500).json({ error: error.message })
	}
})

// 搜索历史记忆
router.post("/memory/search", async (req, res) => {
	try {
		const { query, userId, topK = 5 } = req.body

		const memories = await controller.searchMemories(query, {
			userId,
			topK,
		})

		res.json(memories)
	} catch (error) {
		res.status(500).json({ error: error.message })
	}
})

export default router
```

---

## 方案 8：用户界面增强

### 8.1 前端上下文可视化

```typescript
// components/ContextVisualizer.tsx
import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';

interface ContextVisualizerProps {
  conversationId: string;
}

export const ContextVisualizer: React.FC<ContextVisualizerProps> = ({ conversationId }) => {
  const [metrics, setMetrics] = useState<ConversationMetrics | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      const response = await fetch(`/api/conversations/${conversationId}/metrics`);
      const data = await response.json();
      setMetrics(data);
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // 每5秒刷新

    return () => clearInterval(interval);
  }, [conversationId]);

  if (!metrics) return <div>Loading...</div>;

  return (
    <div className="context-visualizer">
      <h3>对话上下文状态</h3>

      {/* Token 使用趋势 */}
      <div className="metric-section">
        <h4>Token 使用量</h4>
        <div className="token-gauge">
          <div className="gauge-bar" style={{ width: `${(metrics.tokenUsage.total / 12000) * 100}%` }}>
            {metrics.tokenUsage.total} / 12,000
          </div>
        </div>
        {metrics.tokenUsage.total > 8000 && (
          <div className="warning">
            ⚠️ Token 使用率过高，系统将自动触发压缩
          </div>
        )}
      </div>

      {/* 压缩效果 */}
      {metrics.compressionMetrics.ratio > 0 && (
        <div className="metric-section">
          <h4>压缩效果</h4>
          <p>
            原始: {metrics.compressionMetrics.originalTokens} tokens →
            压缩后: {metrics.compressionMetrics.compressedTokens} tokens
          </p>
          <p>
            压缩率: {(metrics.compressionMetrics.ratio * 100).toFixed(1)}%
          </p>
          <p>
            节省时间: ~{metrics.compressionMetrics.timeSaved}ms
          </p>
        </div>
      )}

      {/* 记忆操作 */}
      <div className="metric-section">
        <h4>记忆系统</h4>
        <ul>
          <li>存储次数: {metrics.memoryOperations.stores}</li>
          <li>检索次数: {metrics.memoryOperations.retrievals}</li>
          <li>缓存命中率: {(metrics.memoryOperations.cacheHitRate * 100).toFixed(1)}%</li>
        </ul>
      </div>

      {/* 子 Agent 调用 */}
      <div className="metric-section">
        <h4>子 Agent 调用统计</h4>
        <ul>
          <li>上下文分析器: {metrics.subagentCalls.analyzer} 次</li>
          <li>记忆提取器: {metrics.subagentCalls.extractor} 次</li>
          <li>代码总结器: {metrics.subagentCalls.summarizer} 次</li>
          <li>总耗时: {metrics.subagentCalls.totalTime}ms</li>
        </ul>
      </div>

      {/* 质量评分 */}
      <div className="metric-section">
        <h4>对话质量</h4>
        <div className="quality-scores">
          <div className="score-item">
            <span>连贯性</span>
            <div className="score-bar" style={{ width: `${metrics.qualityScores.coherence * 100}%` }} />
            <span>{(metrics.qualityScores.coherence * 100).toFixed(0)}%</span>
          </div>
          <div className="score-item">
            <span>完整性</span>
            <div className="score-bar" style={{ width: `${metrics.qualityScores.completeness * 100}%` }} />
            <span>{(metrics.qualityScores.completeness * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### 8.2 记忆检索提示

```typescript
// components/MemoryHints.tsx
import React, { useState } from 'react';

interface MemoryHintsProps {
  conversationId: string;
  currentMessage: string;
}

export const MemoryHints: React.FC<MemoryHintsProps> = ({
  conversationId,
  currentMessage
}) => {
  const [relevantMemories, setRelevantMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 实时搜索相关记忆
  useEffect(() => {
    if (currentMessage.length < 10) {
      setRelevantMemories([]);
      return;
    }

    const searchMemories = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/memory/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: currentMessage,
            conversationId,
            topK: 3
          })
        });
        const memories = await response.json();
        setRelevantMemories(memories);
      } catch (error) {
        console.error('Memory search failed:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchMemories, 500);
    return () => clearTimeout(debounce);
  }, [currentMessage, conversationId]);

  if (relevantMemories.length === 0) return null;

  return (
    <div className="memory-hints">
      <div className="hint-header">
        💡 相关历史上下文
      </div>
      <ul>
        {relevantMemories.map(memory => (
          <li key={memory.id} className="memory-item">
            <span className="memory-category">[{memory.category}]</span>
            <span className="memory-content">{memory.content.substring(0, 100)}...</span>
            <span className="memory-timestamp">
              {new Date(memory.timestamp).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

---

## 方案 9：配置与部署

### 9.1 环境配置

```bash
# .env
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# Subagents
CONDENSE_CONTEXT_ANALYZER_URL=http://localhost:8001
CONDENSE_MEMORY_EXTRACTOR_URL=http://localhost:8002
CONDENSE_CODE_SUMMARIZER_URL=http://localhost:8003

# Vector Database (Pinecone)
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=conversation-memory

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=...

# SQLite (L2 Storage)
SQLITE_DB_PATH=./data/conversations.db

# Performance
MAX_CONTEXT_TOKENS=12000
COMPRESSION_THRESHOLD_TOKENS=8000
COMPRESSION_THRESHOLD_MESSAGES=20
AUTO_COMPRESSION_INTERVAL_MS=3600000

# Monitoring
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_AB_TESTING=true
METRICS_EXPORT_INTERVAL_MS=60000

# Logging
LOG_LEVEL=info
LOG_SUBAGENT_CALLS=true
```

### 9.2 Docker 部署

```yaml
# docker-compose.yml
version: "3.8"

services:
    # 主应用
    main-app:
        build: .
        ports:
            - "3000:3000"
        environment:
            - NODE_ENV=production
        env_file:
            - .env
        depends_on:
            - redis
            - postgres
            - subagent-analyzer
            - subagent-extractor
            - subagent-summarizer
        volumes:
            - ./data:/app/data

    # Redis (L1 缓存 + 任务队列)
    redis:
        image: redis:7-alpine
        ports:
            - "6379:6379"
        volumes:
            - redis-data:/data

    # PostgreSQL (会话元数据)
    postgres:
        image: postgres:15-alpine
        environment:
            POSTGRES_DB: conversations
            POSTGRES_USER: admin
            POSTGRES_PASSWORD: ${DB_PASSWORD}
        volumes:
            - postgres-data:/var/lib/postgresql/data

    # Subagent: Context Analyzer
    subagent-analyzer:
        build:
            context: ./subagents
            dockerfile: Dockerfile.analyzer
        ports:
            - "8001:8000"
        environment:
            - AGENT_NAME=condense-context-analyzer
            - MODEL=gpt-4-turbo-preview

    # Subagent: Memory Extractor
    subagent-extractor:
        build:
            context: ./subagents
            dockerfile: Dockerfile.extractor
        ports:
            - "8002:8000"
        environment:
            - AGENT_NAME=condense-memory-extractor
            - MODEL=gpt-4-turbo-preview

    # Subagent: Code Summarizer
    subagent-summarizer:
        build:
            context: ./subagents
            dockerfile: Dockerfile.summarizer
        ports:
            - "8003:8000"
        environment:
            - AGENT_NAME=condense-code-summarizer
            - MODEL=gpt-3.5-turbo

    # 监控面板
    grafana:
        image: grafana/grafana:latest
        ports:
            - "3001:3000"
        volumes:
            - grafana-data:/var/lib/grafana
            - ./monitoring/dashboards:/etc/grafana/provisioning/dashboards

    # 指标收集
    prometheus:
        image: prom/prometheus:latest
        ports:
            - "9090:9090"
        volumes:
            - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
            - prometheus-data:/prometheus

volumes:
    redis-data:
    postgres-data:
    grafana-data:
    prometheus-data:
```

### 9.3 Kubernetes 配置（可选）

```yaml
# k8s/deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
    name: conversation-manager
spec:
    replicas: 3
    selector:
        matchLabels:
            app: conversation-manager
    template:
        metadata:
            labels:
                app: conversation-manager
        spec:
            containers:
                - name: app
                  image: your-registry/conversation-manager:latest
                  ports:
                      - containerPort: 3000
                  env:
                      - name: REDIS_HOST
                        value: "redis-service"
                      - name: POSTGRES_HOST
                        value: "postgres-service"
                  resources:
                      requests:
                          memory: "512Mi"
                          cpu: "500m"
                      limits:
                          memory: "1Gi"
                          cpu: "1000m"
                  livenessProbe:
```
