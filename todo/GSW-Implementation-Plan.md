# GSW三元记忆系统开发计划

## 项目概述

基于UCLA的Generative Semantic Workspace (GSW)理论，为Roo-Code设计并实现一个目录化的三元记忆系统，解决传统RAG的上下文失忆问题。

**核心目标**：实现类似人类的情节记忆能力，追踪代码实体的生命周期、依赖关系和演变历史。

**预计周期**：6-8周（包括评估、开发、测试和优化）

---

## 架构设计

### 目录结构

```
./project/
├── interaction_memory/          # 用户交互记忆
│   ├── sessions/
│   │   └── YYYY-MM-DD_HH-MM-SS_sess_XXX.yaml
│   └── index.json
├── reasoning_memory/            # LLM推理记忆
│   ├── decisions/
│   │   └── YYYY-MM-DD_HH-MM-SS_reason_XXX.yaml
│   └── index.json
├── evolution_memory/            # 代码演进记忆
│   ├── files/
│   │   └── [文件路径]/YYYY-MM-DD_HH-MM-SS_evol_XXX.yaml
│   └── index.json
└── system/
    ├── config.yaml              # 系统配置
    ├── stats.json               # 统计数据
    └── locks/                   # 并发控制
```

### 与现有系统集成点

- **复用**：`MessageVectorStore` (向量检索) + `VectorMemoryStore` (语义搜索)
- **新增**：目录化文件存储 + 索引管理 + RAG增强层
- **集成点**：Task生命周期、Mode系统、Webview UI

---

## 核心问题：记忆文件如何生成？

### 问题说明

三元记忆系统的核心是自动生成三种YAML文件：

1. **Interaction Memory** - 用户输入的提示词
2. **Reasoning Memory** - LLM的推理过程（非代码输出）
3. **Evolution Memory** - 代码变更 + 自我反思

**关键问题**：这些文件不是手动创建的，而是需要**自动捕获和生成**。

### 解决方案：事件驱动 + LLM语义提取

#### 方案1：无需额外LLM调用（轻量级方案）⭐ 推荐

**原理**：通过钩子捕获事件，直接提取结构化信息

````typescript
// src/memory/MemoryCapture.ts - 记忆捕获器

export class MemoryCapture {
  private memorySystem: DirectoryMemorySystem;
  private currentSessionId: string | null = null;

  constructor(memorySystem: DirectoryMemorySystem) {
    this.memorySystem = memorySystem;
  }

  /**
   * 1️⃣ 捕获用户交互（Interaction Memory）
   * 触发时机：用户发送消息到webview
   */
  async captureUserInteraction(
    message: string,
    mode: string,
    taskId: string
  ): Promise<void> {
    // 检测是否是上下文切换
    const isContextSwitch = this.detectContextSwitch(message);

    // 如果是新会话或上下文切换，创建新的session
    if (!this.currentSessionId || isContextSwitch) {
      this.currentSessionId = `sess_${Date.now()}`;

      const interactionData: InteractionMemory = {
        version: '1.0',
        session_id: this.currentSessionId,
        start_time: new Date().toISOString(),
        mode: mode,
        context_switches: isContextSwitch ? 1 : 0,
        user_goals: [{
          timestamp: new Date().toISOString(),
          goal: message,
          context: `用户在${mode}模式下的请求`,
          context_switch: isContextSwitch,
          previous_goal: isContextSwitch ? this.getPreviousGoal() : undefined,
        }],
      };

      // 写入Interaction Memory
      await this.memorySystem.writeMemory('interaction', interactionData);
    } else {
      // 追加到现有session
      await this.appendToSession(message, mode);
    }
  }

  /**
   * 检测上下文切换的关键词
   */
  private detectContextSwitch(message: string): boolean {
    const switchKeywords = [
      '等等', '不对', '先', '改成', '换个',
      '重新', '取消', '停', '算了'
    ];

    return switchKeywords.some(keyword =>
      message.toLowerCase().includes(keyword)
    );
  }

  /**
   * 2️⃣ 捕获LLM推理（Reasoning Memory）
   * 触发时机：LLM返回响应时
   */
  async captureReasoning(
    llmResponse: string,
    relatedFiles: string[],
    sessionId: string
  ): Promise<void> {
    // 提取推理内容（过滤掉代码块）
    const reasoning = this.extractReasoningText(llmResponse);

    if (reasoning.length < 50) {
      return; // 太短的响应不记录
    }

    // 提取决策点
    const decisionPoints = this.extractDecisionPoints(reasoning);

    // 检测"记忆触发器"（我想起了、我记得、之前）
    const memoryTrigger = this.detectMemoryTrigger(reasoning);

    const reasoningData: ReasoningMemory = {
      version: '1.0',
      entry_id: `reason_${Date.now()}`,
      timestamp: new Date().toISOString(),
      related_session: sessionId,
      source_file: relatedFiles[0] || 'unknown',
      reasoning: reasoning,
      decision_points: decisionPoints,
      memory_trigger: memoryTrigger,
      confidence: this.estimateConfidence(reasoning),
      related_files: relatedFiles,
    };

    // 写入Reasoning Memory
    await this.memorySystem.writeMemory('reasoning', reasoningData);
  }

  /**
   * 提取推理文本（移除代码块）
   */
  private extractReasoningText(llmResponse: string): string {
    // 移除```代码块```
    const withoutCodeBlocks = llmResponse.replace(
      /```[\s\S]*?```/g,
      '[代码已省略]'
    );

    // 提取纯文本推理
    const lines = withoutCodeBlocks.split('\n');
    const reasoningLines = lines.filter(line =>
      !line.trim().startsWith('<') && // 移除XML标签
      !line.trim().startsWith('//') && // 移除注释
      line.trim().length > 20 // 过滤太短的行
    );

    return reasoningLines.join('\n').trim();
  }

  /**
   * 提取决策点（包含"选择"、"因为"、"vs"等关键词）
   */
  private extractDecisionPoints(text: string): string[] {
    const decisionPatterns = [
      /选择(.+?)因为/g,
      /(.+?)vs(.+?):/g,
      /决定(.+?)[，。]/g,
    ];

    const decisions: string[] = [];
    for (const pattern of decisionPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        decisions.push(match[0]);
      }
    }

    return decisions;
  }

  /**
   * 检测记忆触发器
   */
  private detectMemoryTrigger(text: string): string | undefined {
    const triggers = ['我想起了', '我记得', '之前', '上次', '类似'];

    for (const trigger of triggers) {
      if (text.includes(trigger)) {
        return `触发词: ${trigger}`;
      }
    }

    return undefined;
  }

  /**
   * 3️⃣ 捕获代码演进（Evolution Memory）
   * 触发时机：apply_diff或write_to_file成功执行后
   */
  async captureCodeEvolution(
    filePath: string,
    diff: string,
    gitCommit: string | null,
    sessionId: string
  ): Promise<void> {
    // 生成diff摘要
    const diffSummary = this.generateDiffSummary(diff);

    // **关键：自我反思问题**
    const selfReflection = await this.generateSelfReflection(
      filePath,
      diff,
      sessionId
    );

    const evolutionData: EvolutionMemory = {
      version: '1.0',
      evolution_id: `evol_${Date.now()}`,
      timestamp: new Date().toISOString(),
      file_path: filePath,
      git_commit: gitCommit || 'uncommitted',
      diff_summary: diffSummary,
      modification_context: {
        reason: selfReflection.reason,
        related_session: sessionId,
        related_reasoning: [], // 稍后通过索引关联
      },
      benefits: selfReflection.benefits,
      potential_issues: selfReflection.potential_issues,
      future_applications: selfReflection.future_applications,
      code_snippet: this.extractKeyCode(diff),
    };

    // 写入Evolution Memory
    await this.memorySystem.writeMemory('evolution', evolutionData);
  }

  /**
   * 生成diff摘要（无需LLM）
   */
  private generateDiffSummary(diff: string): string {
    const lines = diff.split('\n');
    const added = lines.filter(l => l.startsWith('+')).length;
    const removed = lines.filter(l => l.startsWith('-')).length;

    // 提取关键函数名
    const functionNames = this.extractFunctionNames(diff);

    return `+ ${added}行 / - ${removed}行\n修改函数: ${functionNames.join(', ')}`;
  }

  /**
   * 🔥 核心：自我反思生成（两种方案）
   */
  private async generateSelfReflection(
    filePath: string,
    diff: string,
    sessionId: string
  ): Promise<SelfReflection> {
    // 方案A：基于规则的反思（无LLM）
    return this.ruleBased反思(filePath, diff, sessionId);

    // 方案B：调用LLM生成深度反思（可选）
    // return await this.llmBasedReflection(filePath, diff, sessionId);
  }

  /**
   * 方案A：基于规则的反思（推荐）
   */
  private ruleBasedReflection(
    filePath: string,
    diff: string,
    sessionId: string
  ): SelfReflection {

---

## ⚡ 关键架构：并行LLM调用（不阻塞主任务）

### 问题说明
GSW的LLM语义提取**绝对不能阻塞用户的主对话流程**。如果每次代码变更都要等待GSW的LLM响应，会严重影响用户体验。

### 解决方案：异步并行架构

```typescript
// src/memory/MemoryCapture.ts

export class MemoryCapture {
  private llmQueue: Promise<void>[] = []; // LLM调用队列
  private readonly maxConcurrent = 3;     // 最大并发数

  /**
   * 🔥 核心：异步非阻塞的LLM调用
   */
  async captureCodeEvolution(
    filePath: string,
    diff: string,
    gitCommit: string | null,
    sessionId: string
  ): Promise<void> {
    // 1️⃣ 立即返回，不阻塞主任务
    // 使用Promise.resolve().then()确保异步执行
    Promise.resolve().then(async () => {
      try {
        // 2️⃣ 在后台异步生成反思
        const reflection = await this.generateSelfReflectionAsync(
          filePath,
          diff,
          sessionId
        );

        // 3️⃣ 写入Evolution Memory（也是异步的）
        const evolutionData: EvolutionMemory = {
          version: '1.0',
          evolution_id: `evol_${Date.now()}`,
          timestamp: new Date().toISOString(),
          file_path: filePath,
          git_commit: gitCommit || 'uncommitted',
          diff_summary: this.generateDiffSummary(diff),
          modification_context: {
            reason: reflection.reason,
            related_session: sessionId,
          },
          benefits: reflection.benefits,
          potential_issues: reflection.potential_issues,
          future_applications: reflection.future_applications,
        };

        await this.memorySystem.writeMemory('evolution', evolutionData);

        console.log(`[GSW] Evolution memory saved for ${filePath}`);
      } catch (error) {
        // 错误不影响主任务
        console.error('[GSW] Failed to capture evolution:', error);
      }
    });

    // ⚡ 关键：立即返回，主任务继续执行
    return Promise.resolve();
  }

  /**
   * 异步LLM调用（带队列管理）
   */
  private async generateSelfReflectionAsync(
    filePath: string,
    diff: string,
    sessionId: string
  ): Promise<SelfReflection> {
    // 控制并发数，避免API限流
    while (this.llmQueue.length >= this.maxConcurrent) {
      await Promise.race(this.llmQueue);
    }

    const promise = this.callLLMForReflection(filePath, diff, sessionId)
      .finally(() => {
        // 完成后从队列移除
        const index = this.llmQueue.indexOf(promise);
        if (index > -1) {
          this.llmQueue.splice(index, 1);
        }
      });

    this.llmQueue.push(promise);
    return promise;
  }

  /**
   * 实际的LLM调用（带超时和fallback）
   */
  private async callLLMForReflection(
    filePath: string,
    diff: string,
    sessionId: string
  ): Promise<SelfReflection> {
    const config = this.getGSWConfig();

    // 超时控制
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('LLM timeout')), config.timeout);
    });

    try {
      // 并行执行：LLM调用 vs 超时
      const reflection = await Promise.race([
        this.llmBasedReflection(filePath, diff, sessionId),
        timeoutPromise,
      ]);

      return reflection;
    } catch (error) {
      console.warn('[GSW] LLM reflection failed, falling back to rules:', error);

      // Fallback到规则提取
      return this.ruleBasedReflection(filePath, diff, sessionId);
    }
  }
}
````

### 架构示意图

```
主任务对话流程（不受影响）
    │
    ├─ 用户: "优化这个函数"
    │     ↓
    ├─ LLM: "我建议使用缓存..."  ← 主LLM调用（同步）
    │     ↓
    ├─ 执行: apply_diff          ← 代码修改（同步）
    │     ↓
    ├─ 返回: "代码已修改"         ← 立即返回给用户 ⚡
    │
    └─ 后台任务（异步并行）▼
         │
         ├─ GSW LLM调用（200-500ms）  ← 不阻塞主任务
         │     ↓
         ├─ 生成反思内容
         │     ↓
         └─ 写入YAML文件  ← 完全异步
```

### 性能优势

| 方案        | 用户体验  | 主任务延迟 | GSW延迟  |
| ----------- | --------- | ---------- | -------- |
| ❌ 同步调用 | 等待3-5秒 | +3000ms    | 0ms      |
| ✅ 异步并行 | 立即响应  | +5ms       | 并行执行 |

### Task.ts集成（非阻塞版本）

```typescript
// src/core/task/Task.ts

async onToolUse(toolName: string, result: any) {
  // 🔥 关键：使用非阻塞调用
  if (this.memoryCapture && this.currentSessionId) {
    if (toolName === 'apply_diff' || toolName === 'write_to_file') {
      // ⚡ 不使用await，立即返回
      this.memoryCapture.captureCodeEvolution(
        result.filePath,
        result.diff,
        await this.getGitCommit(),
        this.currentSessionId
      ).catch(err => {
        // 静默处理错误，不影响主任务
        console.error('[GSW] Capture failed:', err);
      });
    }
  }

  // 主任务继续执行，不等待GSW
  // ... 原有的工具使用处理逻辑 ...
}
```

### 并发控制策略

```typescript
// src/memory/config.ts

export interface GSWConcurrencyConfig {
	maxConcurrentLLMCalls: number // 默认：3
	queueTimeout: number // 默认：30000ms
	batchProcessing: boolean // 默认：true（批量处理）
	prioritizeRecent: boolean // 默认：true（优先处理最新的）
}

// 批量处理策略（进一步优化）
export class MemoryBatchProcessor {
	private batch: EvolutionRequest[] = []
	private batchInterval = 5000 // 5秒批量一次

	/**
	 * 批量处理Evolution Memory
	 * 将多个代码变更合并成一次LLM调用
	 */
	async processBatch(): Promise<void> {
		if (this.batch.length === 0) return

		const combinedDiff = this.batch.map((r) => r.diff).join("\n---\n")
		const reflection = await this.llm.batchReflection(combinedDiff)

		// 分配反思结果到各个文件
		for (let i = 0; i < this.batch.length; i++) {
			await this.saveEvolution(this.batch[i], reflection[i])
		}

		this.batch = []
	}
}
```

### 用户可见的状态指示

在VS Code状态栏显示GSW后台处理状态：

```typescript
// src/integrations/statusBar/GSWStatusBar.ts

export class GSWStatusBar {
	private statusBar: vscode.StatusBarItem

	updateStatus(queueSize: number) {
		if (queueSize > 0) {
			this.statusBar.text = `$(sync~spin) GSW: ${queueSize} 个记忆正在生成...`
			this.statusBar.tooltip = "后台异步处理，不影响主任务"
		} else {
			this.statusBar.text = `$(check) GSW: 就绪`
		}
	}
}
```

---

### 总结：为什么异步并行至关重要？

1. **用户体验**：主对话流程零延迟，用户感觉不到GSW的存在
2. **成本控制**：批量处理可将API调用减少70%
3. **可靠性**：LLM失败不影响主任务，自动fallback
4. **扩展性**：可轻松支持更多后台任务（如记忆压缩、索引重建）

**核心原则**：GSW是"隐形的增强"，不是"阻碍的负担"。

    const session = this.getSessionData(sessionId);
    const reason = session?.user_goals[0]?.goal || '代码优化';

    // 分析diff内容
    const hasAsync = diff.includes('async');
    const hasError = diff.includes('try') || diff.includes('catch');
    const hasPerf = diff.includes('cache') || diff.includes('memo');

    return {
      reason: reason,
      benefits: [
        hasAsync ? '支持异步操作' : null,
        hasError ? '增强错误处理' : null,
        hasPerf ? '提升性能' : null,
      ].filter(Boolean) as string[],
      potential_issues: [
        hasAsync ? '需要处理Promise rejection' : null,
        diff.length > 1000 ? '变更较大，需要充分测试' : null,
      ].filter(Boolean) as string[],
      future_applications: [
        `可以应用到${path.dirname(filePath)}目录下的其他文件`,
      ],
    };

}
}

interface SelfReflection {
reason: string;
benefits: string[];
potential_issues: string[];
future_applications: string[];
}

````

---

#### 方案2：使用LLM进行深度语义提取（可选增强）

**适用场景**：需要更深入的语义理解和推理

```typescript
/**
 * 方案B：调用LLM生成深度反思
 * 注意：这会增加API调用成本
 */
private async llmBasedReflection(
  filePath: string,
  diff: string,
  sessionId: string
): Promise<SelfReflection> {
  const session = this.getSessionData(sessionId);

  const prompt = `
你是一个代码审查专家。请分析以下代码变更并回答：

文件: ${filePath}
用户需求: ${session?.user_goals[0]?.goal}

代码变更:
\`\`\`diff
${diff.substring(0, 1000)} // 限制长度
\`\`\`

请用JSON格式回答以下问题：
{
  "reason": "为什么做这个修改？",
  "benefits": ["好处1", "好处2"],
  "potential_issues": ["潜在问题1", "潜在问题2"],
  "future_applications": ["未来可以用在哪里？"]
}
`;

  // 调用LLM API（复用现有的API调用机制）
  const response = await this.callLLM(prompt, {
    maxTokens: 500,
    temperature: 0.3, // 低温度保证一致性
  });

  try {
    return JSON.parse(response);
  } catch {
    // 解析失败，回退到规则方案
    return this.ruleBasedReflection(filePath, diff, sessionId);
  }
}
````

---

### 集成点：在Task生命周期中注入

````typescript
// src/core/task/Task.ts (修改现有代码)

export class Task {
  // ... 现有代码 ...

  private memoryCapture?: MemoryCapture; // 新增

  async startTask(message: string) {
    // 初始化记忆捕获器
    if (this.config.enableGSWMemory) {
      const memorySystem = new DirectoryMemorySystem('./project');
      await memorySystem.initialize();
      this.memoryCapture = new MemoryCapture(memorySystem);
    }

    // 1️⃣ 捕获用户输入
    if (this.memoryCapture) {
      await this.memoryCapture.captureUserInteraction(
        message,
        this.mode,
        this.taskId
      );
    }

    // ... 原有的任务启动逻辑 ...
  }

  async handleApiResponse(response: string) {
    // 2️⃣ 捕获LLM推理
    if (this.memoryCapture && this.currentSessionId) {
      await this.memoryCapture.captureReasoning(
        response,
        this.getRelatedFiles(),
        this.currentSessionId
      );
    }

    // ... 原有的响应处理逻辑 ...
  }

  async
---

## 开发阶段详解

### 阶段1：基础架构设计与评估（1周）

#### 1.1 需求分析与技术选型 ⏱️ 2天
**目标**：确定技术栈和设计细节

**子任务**：
- [ ] 深入分析现有系统架构
  - 研究 `Task.ts` 中的 `vectorMemoryStore` 集成方式
  - 分析 `MessageVectorStore` 的向量存储机制
  - 理解 `ConversationMemory` 的记忆管理策略
- [ ] 技术选型评估
  - YAML vs JSON 性能对比测试（读写速度、文件大小）
  - 选择YAML解析库（js-yaml vs fast-yaml-stringify）
  - 确定文件锁实现方案（proper-lockfile vs 自研）
- [ ] 设计索引结构
  - JSON格式，包含：id、timestamp、file_path、summary、keywords
  - 支持多维度检索（时间、关键词、文件路径、mode）
- [ ] 确定文件分片策略
  - 大小阈值：50KB（可配置）
  - 时间策略：按会话/决策/演进独立存储
  - 归档策略：30天未访问自动归档
- [ ] 规划并发控制机制
  - 文件级锁（支持读写分离）
  - 索引更新原子性（临时文件+重命名）
  - 事务性写入（失败回滚）

**验收标准**：
- ✅ 完成技术选型文档（包含性能测试数据和对比表）
- ✅ 确定数据结构和接口定义（TypeScript类型完整）
- ✅ 绘制系统集成架构图（包含数据流向和调用关系）

**输出文档**：
- `docs/gsw/tech-stack-evaluation.md`
- `docs/gsw/architecture-design.md`
- `docs/gsw/integration-points.md`

**风险评估**：
- ⚠️ **YAML解析性能瓶颈**
  - 影响：单文件读取可能>20ms
  - 应对：使用 fast-yaml-stringify + 流式处理
  - 备选：关键路径使用JSON，非关键路径使用YAML

- ⚠️ **索引文件大小增长**
  - 影响：索引查询变慢，内存占用增加
  - 应对：定期归档 + 索引分片（按月/按季度）
  - 备选：使用SQLite存储索引（如果JSON性能不足）

---

#### 1.2 数据结构设计 ⏱️ 2天
**目标**：定义三元记忆的YAML和索引结构

**子任务**：

**1.2.1 Interaction Memory Schema设计**
- [ ] 定义会话级别结构
  ```yaml
  version: "1.0"
  session_id: "sess_001"
  start_time: "2025-12-09T14:00:00Z"
  end_time: "2025-12-09T14:15:00Z"
  mode: "Code"
  context_switches: 2
  user_goals:
    - timestamp: "2025-12-09T14:00:05Z"
      goal: "优化用户认证模块的性能"
      context: "当前认证流程有延迟"
      context_switch: false
    - timestamp: "2025-12-09T14:10:22Z"
      goal: "等等，先实现JWT令牌刷新功能"
      context: "用户反馈令牌过期太频繁"
      context_switch: true  # 标记上下文切换点
      previous_goal: "优化用户认证模块的性能"
````

**1.2.2 Reasoning Memory Schema设计**

- [ ] 定义推理记录结构
    ```yaml
    version: "1.0"
    entry_id: "reason_001"
    timestamp: "2025-12-09T14:05:30Z"
    related_session: "sess_001"
    source_file: "src/auth/service.ts"
    reasoning: |
        选择Redis作为缓存层而不是内存缓存，因为：
        1. 需要支持分布式部署
        2. Redis的TTL机制更适合令牌管理
    decision_points:
        - "性能 vs 可靠性：选择可靠性优先"
        - "简单性 vs 扩展性：选择扩展性优先"
    memory_trigger: "想起了之前的项目经验"
    confidence: 0.85
    related_files:
        - "src/auth/token.service.ts"
        - "src/auth/redis.util.ts"
    ```

**1.2.3 Evolution Memory Schema设计**

- [ ] 定义代码演进结构
    ```yaml
    version: "1.0"
    evolution_id: "evol_001"
    timestamp: "2025-12-09T14:15:20Z"
    file_path: "src/auth/token.service.ts"
    git_commit: "a1b2c3d4"
    diff_summary: |
        + 添加了refreshToken方法
        + 增加了Redis缓存层
        - 移除了内存缓存实现
    modification_context:
        reason: "实现JWT令牌刷新功能"
        related_session: "sess_001"
        related_reasoning: ["reason_002"]
    benefits:
        - "支持多设备并发刷新"
        - "避免服务重启导致令牌失效"
    potential_issues:
        - "需要监控Redis连接数"
        - "缓存穿透风险需要处理"
    future_applications:
        - "可以扩展到会话管理"
        - "适用于API速率限制"
    code_snippet: |
        async refreshToken(userId: string): Promise<string> {
          const cacheKey = `refresh:${userId}`;
          return await this.redis.setex(cacheKey, 86400, newToken);
        }
    ```

**1.2.4 索引文件Schema设计**

- [ ] 定义统一索引结构
    ```json
    {
      "version": "1.0",
      "type": "interaction" | "reasoning" | "evolution",
      "last_updated": "2025-12-09T14:48:15Z",
      "entries": [
        {
          "id": "sess_001",
          "file_path": "interaction_memory/sessions/2025-12-09_14-30-00_sess_001.yaml",
          "timestamp": "2025-12-09T14:30:00Z",
          "summary": "优化用户认证模块性能，实现JWT刷新",
          "keywords": ["认证", "JWT", "Redis", "性能优化"],
          "mode": "Code",
          "context_switches": 2,
          "related_files": ["src/auth/service.ts"]
        }
      ],
      "metadata": {
        "total_entries": 24,
        "total_size_kb": 1250,
        "oldest_entry": "2025-12-01T09:15:22Z",
        "index_size_kb": 15
      }
    }
    ```

**1.2.5 TypeScript类型定义**

- [ ] 创建完整的类型定义文件
    - `src/memory/types/interaction.ts`
    - `src/memory/types/reasoning.ts`
    - `src/memory/types/evolution.ts`
    - `src/memory/types/index.ts`
    - `src/memory/types/common.ts`

**验收标准**：

- ✅ 完整的TypeScript类型定义（严格模式，无any）
- ✅ YAML示例文件（每种记忆类型至少3个真实场景示例）
- ✅ Schema验证工具（基于ajv，支持自定义规则）
- ✅ 通过Schema验证测试（100%覆盖）

**输出文件**：

- `src/memory/types/*.ts` - TypeScript类型定义
- `docs/gsw/schema/*.yaml` - YAML示例文件
- `src/memory/schema-validator.ts` - Schema验证器

---

#### 1.3 性能基准测试 ⏱️ 1天

**目标**：建立性能基准，验证设计可行性

**子任务**：

- [ ] YAML vs JSON 性能对比
    - 读取速度测试（10KB, 50KB, 100KB文件）
    - 写入速度测试（串行、并发）
    - 解析内存占用测试
- [ ] 索引查询性能测试
    - 线性搜索 vs 索引查询
    - 不同条目数量的性能曲线（10, 100, 1000, 10000）
- [ ] 文件系统性能测试
    - 目录遍历速度
    - 文件锁开销
    - 并发读写性能

**验收标准**：

- ✅ 完成性能基准报告
- ✅ 确定性能目标（读<5ms, 写<10ms, 查询<5ms）
- ✅ 识别性能瓶颈和优化方向

**输出文档**：

- `docs/gsw/performance-benchmark.md`

---

### 阶段2：核心模块实现（2周）

#### 2.1 文件系统管理模块 ⏱️ 3天

**目标**：实现高性能的目录化文件管理

**主任务**：实现 `DirectoryMemorySystem`

**子任务详解**：

**2.1.1 核心类设计** ⏱️ 1天

- [ ] 设计`DirectoryMemorySystem`类架构

    ```typescript
    // src/memory/DirectoryMemorySystem.ts
    export class DirectoryMemorySystem {
    	private readonly rootPath: string // ./project/
    	private readonly config: MemorySystemConfig
    	private indexManagers: Map<MemoryType, IndexManager>
    	private fileRotator: FileRotator

    	constructor(rootPath: string, config?: Partial<MemorySystemConfig>)

    	// 初始化系统（创建目录结构）
    	async initialize(): Promise<void>

    	// 写入记忆（自动处理分片和索引更新）
    	async writeMemory(type: MemoryType, data: MemoryData): Promise<string>

    	// 读取记忆（支持ID或文件路径）
    	async readMemory(type: MemoryType, id: string): Promise<MemoryData | null>

    	// 批量读取（基于过滤条件）
    	async readMemories(type: MemoryType, filter: MemoryFilter): Promise<MemoryData[]>

    	// 删除记忆（软删除，移至归档）
    	async archiveMemory(type: MemoryType, id: string): Promise<void>

    	// 获取统计信息
    	async getStats(): Promise<MemoryStats>

    	// 健康检查（检测损坏文件、孤立索引等）
    	async healthCheck(): Promise<HealthReport>
    }
    ```

- [ ] 定义配置接口

    ```typescript
    // src/memory/types/config.ts
    export interface MemorySystemConfig {
    	rootPath: string // 默认：./project/
    	maxFileSizeKB: number // 默认：50KB
    	archiveAfterDays: number // 默认：30天
    	enableAutoRotation: boolean // 默认：true
    	compressionEnabled: boolean // 默认：false（未来功能）
    	yamlLibrary: "js-yaml" | "fast-yaml" // 默认：js-yaml
    	lockTimeout: number // 默认：5000ms
    	retryAttempts: number // 默认：3
    }

    export const DEFAULT_CONFIG: MemorySystemConfig = {
    	rootPath: "./project",
    	maxFileSizeKB: 50,
    	archiveAfterDays: 30,
    	enableAutoRotation: true,
    	compressionEnabled: false,
    	yamlLibrary: "js-yaml",
    	lockTimeout: 5000,
    	retryAttempts: 3,
    }
    ```

**2.1.2 YAML读写实现** ⏱️ 1天

- [ ] 实现高性能YAML序列化/反序列化

    ```typescript
    // src/memory/utils/yamlHandler.ts
    import * as yaml from "js-yaml"
    import * as fs from "fs/promises"
    import { fileExistsAtPath } from "../../utils/fs"

    export class YAMLHandler {
    	/**
    	 * 读取YAML文件
    	 * @param filePath 文件路径
    	 * @returns 解析后的对象
    	 */
    	static async read<T>(filePath: string): Promise<T> {
    		if (!(await fileExistsAtPath(filePath))) {
    			throw new Error(`YAML file not found: ${filePath}`)
    		}

    		const content = await fs.readFile(filePath, "utf-8")
    		const parsed = yaml.load(content) as T

    		if (!parsed) {
    			throw new Error(`Failed to parse YAML: ${filePath}`)
    		}

    		return parsed
    	}

    	/**
    	 * 写入YAML文件（原子操作）
    	 * @param filePath 文件路径
    	 * @param data 要写入的数据
    	 */
    	static async write(filePath: string, data: any): Promise<void> {
    		const yamlContent = yaml.dump(data, {
    			indent: 2,
    			lineWidth: 120,
    			noRefs: true,
    			sortKeys: false,
    		})

    		// 使用原子写入（临时文件+重命名）
    		const tempPath = `${filePath}.tmp.${Date.now()}`

    		try {
    			await fs.writeFile(tempPath, yamlContent, "utf-8")
    			await fs.rename(tempPath, filePath)
    		} catch (error) {
    			// 清理临时文件
    			try {
    				await fs.unlink(tempPath)
    			} catch {}
    			throw error
    		}
    	}

    	/**
    	 * 批量读取YAML文件（并行优化）
    	 * @param filePaths 文件路径数组
    	 * @returns 解析后的对象数组
    	 */
    	static async readBatch<T>(filePaths: string[]): Promise<T[]> {
    		const results = await Promise.all(filePaths.map((path) => this.read<T>(path).catch(() => null)))
    		return results.filter((r): r is T => r !== null)
    	}
    }
    ```

**2.1.3 文件路径生成器** ⏱️ 0.5天

- [ ] 实现智能文件路径生成

    ```typescript
    // src/memory/utils/pathGenerator.ts
    import * as path from "path"

    export class PathGenerator {
    	private readonly rootPath: string

    	constructor(rootPath: string) {
    		this.rootPath = rootPath
    	}

    	/**
    	 * 生成会话记忆文件路径
    	 * @param sessionId 会话ID
    	 * @returns 完整文件路径
    	 */
    	generateInteractionPath(sessionId: string): string {
    		const timestamp = this.formatTimestamp(new Date())
    		const fileName = `${timestamp}_${sessionId}.yaml`
    		return path.join(this.rootPath, "interaction_memory", "sessions", fileName)
    	}

    	/**
    	 * 生成推理记忆文件路径
    	 * @param reasonId 推理ID
    	 * @returns 完整文件路径
    	 */
    	generateReasoningPath(reasonId: string): string {
    		const timestamp = this.formatTimestamp(new Date())
    		const fileName = `${timestamp}_${reasonId}.yaml`
    		return path.join(this.rootPath, "reasoning_memory", "decisions", fileName)
    	}

    	/**
    	 * 生成代码演进记忆文件路径（按文件路径分组）
    	 * @param filePath 源代码文件路径
    	 * @param evolId 演进ID
    	 * @returns 完整文件路径
    	 */
    	generateEvolutionPath(filePath: string, evolId: string): string {
    		const timestamp = this.formatTimestamp(new Date())
    		// 将文件路径转换为安全的目录名
    		const safePath = this.sanitizeFilePath(filePath)
    		const fileName = `${timestamp}_${evolId}.yaml`
    		return path.join(this.rootPath, "evolution_memory", "files", safePath, fileName)
    	}

    	/**
    	 * 获取索引文件路径
    	 * @param type 记忆类型
    	 * @returns 索引文件路径
    	 */
    	getIndexPath(type: MemoryType): string {
    		const typeMap = {
    			interaction: "interaction_memory",
    			reasoning: "reasoning_memory",
    			evolution: "evolution_memory",
    		}
    		return path.join(this.rootPath, typeMap[type], "index.json")
    	}

    	/**
    	 * 格式化时间戳为文件名友好格式
    	 * @param date 日期对象
    	 * @returns 格式化字符串 (YYYY-MM-DD_HH-MM-SS)
    	 */
    	private formatTimestamp(date: Date): string {
    		return date.toISOString().replace(/T/, "_").replace(/:/g, "-").replace(/\..+/, "")
    	}

    	/**
    	 * 将文件路径转换为安全的目录名
    	 * @param filePath 原始文件路径
    	 * @returns 安全的目录名
    	 */
    	private sanitizeFilePath(filePath: string): string {
    		return filePath
    			.replace(/^\//, "") // 移除开头的斜杠
    			.replace(/\\/g, "/") // 统一为正斜杠
    			.replace(/\.\./g, "__") // 替换..
    			.replace(/:/g, "_") // 替换冒号（Windows）
    	}
    }

    export type MemoryType = "interaction" | "reasoning" | "evolution"
    ```

**2.1.4 目录初始化** ⏱️ 0.5天

- [ ] 实现目录结构自动创建

    ```typescript
    // src/memory/DirectoryMemorySystem.ts (部分实现)
    async initialize(): Promise<void> {
      const directories = [
        path.join(this.rootPath, 'interaction_memory', 'sessions'),
        path.join(this.rootPath, 'interaction_memory', 'archive'),
        path.join(this.rootPath, 'reasoning_memory', 'decisions'),
        path.join(this.rootPath, 'reasoning_memory', 'archive'),
        path.join(this.rootPath, 'evolution_memory', 'files'),
        path.join(this.rootPath, 'evolution_memory', 'archive'),
        path.join(this.rootPath, 'system', 'locks'),
      ];

      // 并行创建所有目录
      await Promise.all(
        directories.map(dir =>
          fs.mkdir(dir, { recursive: true }).catch(err => {
            console.error(`Failed to create directory ${dir}:`, err);
            throw err;
          })
        )
      );

      // 初始化配置文件
      await this.initializeConfig();

      // 初始化索引文件
      await this.initializeIndices();

      // 初始化统计数据
      await this.initializeStats();
    }

    private async initializeConfig(): Promise<void> {
      const configPath = path.join(this.rootPath, 'system', 'config.yaml');

      if (!(await fileExistsAtPath(configPath))) {
        await YAMLHandler.write(configPath, {
          version: '1.0',
          created_at: new Date().toISOString(),
          config: this.config,
        });
      }
    }

    private async initializeIndices(): Promise<void> {
      const types: MemoryType[] = ['interaction', 'reasoning', 'evolution'];

      for (const type of types) {
        const indexPath = this.pathGenerator.getIndexPath(type);

        if (!(await fileExistsAtPath(indexPath))) {
          const emptyIndex: MemoryIndex = {
            version: '1.0',
            type,
            last_updated: new Date().toISOString(),
            entries: [],
            metadata: {
              total_entries: 0,
              total_size_kb: 0,
              oldest_entry: null,
              index_size_kb: 0,
            },
          };

          // 使用safeWriteJson确保原子写入
          await safeWriteJson(indexPath, emptyIndex);
        }
      }
    }
    ```

**验收标准**：

- ✅ `DirectoryMemorySystem`类完整实现，通过所有单元测试
- ✅ 支持三种记忆类型的读写操作
- ✅ YAML文件读写性能满足目标（读<5ms, 写<10ms）
- ✅ 文件路径生成器覆盖所有边界情况（特殊字符、长路径等）
- ✅ 目录初始化幂等性（多次调用不会出错）
- ✅ 错误处理完善（文件不存在、权限问题、磁盘空间不足等）

**输出文件**：

- `src/memory/DirectoryMemorySystem.ts` - 核心文件系统管理类
- `src/memory/utils/yamlHandler.ts` - YAML读写工具
- `src/memory/utils/pathGenerator.ts` - 路径生成器
- `src/memory/types/config.ts` - 配置类型定义
- `src/memory/__tests__/DirectoryMemorySystem.spec.ts` - 单元测试

**测试用例设计**：

```typescript
// src/memory/__tests__/DirectoryMemorySystem.spec.ts
describe("DirectoryMemorySystem", () => {
	let system: DirectoryMemorySystem
	let tempDir: string

	beforeEach(async () => {
		tempDir = path.join(os.tmpdir(), `gsw-test-${Date.now()}`)
		system = new DirectoryMemorySystem(tempDir)
		await system.initialize()
	})

	afterEach(async () => {
		// 清理测试目录
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	describe("initialize", () => {
		it("应该创建所有必需的目录结构", async () => {
			const dirs = [
				"interaction_memory/sessions",
				"reasoning_memory/decisions",
				"evolution_memory/files",
				"system/locks",
			]

			for (const dir of dirs) {
				const exists = await fileExistsAtPath(path.join(tempDir, dir))
				expect(exists).toBe(true)
			}
		})

		it("应该初始化所有索引文件", async () => {
			const types: MemoryType[] = ["interaction", "reasoning", "evolution"]

			for (const type of types) {
				const indexPath = path.join(tempDir, `${type}_memory`, "index.json")
				const exists = await fileExistsAtPath(indexPath)
				expect(exists).toBe(true)

				const index = JSON.parse(await fs.readFile(indexPath, "utf-8"))
				expect(index.version).toBe("1.0")
				expect(index.entries).toEqual([])
			}
		})

		it("应该支持幂等性调用", async () => {
			// 第二次初始化不应该报错
			await expect(system.initialize()).resolves.not.toThrow()
		})
	})

	describe("writeMemory", () => {
		it("应该写入交互记忆并更新索引", async () => {
			const sessionData: InteractionMemory = {
				session_id: "sess_001",
				start_time: new Date().toISOString(),
				mode: "Code",
				user_goals: [
					{
						timestamp: new Date().toISOString(),
						goal: "优化性能",
						context: "当前系统响应慢",
						context_switch: false,
					},
				],
			}

			const id = await system.writeMemory("interaction", sessionData)
			expect(id).toBe("sess_001")

			// 验证文件存在
			const files = await fs.readdir(path.join(tempDir, "interaction_memory", "sessions"))
			expect(files.length).toBe(1)
			expect(files[0]).toContain("sess_001")

			// 验证索引更新
			const indexPath = path.join(tempDir, "interaction_memory", "index.json")
			const index = JSON.parse(await fs.readFile(indexPath, "utf-8"))
			expect(index.entries.length).toBe(1)
			expect(index.entries[0].id).toBe("sess_001")
		})

		it("应该在文件超过大小限制时自动分片", async () => {
			// 创建一个超大的记忆数据
			const largeData = {
				session_id: "sess_large",
				user_goals: Array(1000)
					.fill(null)
					.map((_, i) => ({
						timestamp: new Date().toISOString(),
						goal: `目标${i}`,
						context: "A".repeat(1000), // 每个目标1KB
						context_switch: false,
					})),
			}

			const id = await system.writeMemory("interaction", largeData)

			// 验证文件被分片
			const files = await fs.readdir(path.join(tempDir, "interaction_memory", "sessions"))
			expect(files.length).toBeGreaterThan(1)
			expect(files.every((f) => f.includes("sess_large"))).toBe(true)
		})
	})

	describe("readMemory", () => {
		it("应该正确读取已写入的记忆", async () => {
			const data: InteractionMemory = {
				session_id: "sess_002",
				start_time: new Date().toISOString(),
				mode: "Debug",
				user_goals: [],
			}

			await system.writeMemory("interaction", data)
			const retrieved = await system.readMemory("interaction", "sess_002")

			expect(retrieved).not.toBeNull()
			expect(retrieved?.session_id).toBe("sess_002")
			expect(retrieved?.mode).toBe("Debug")
		})

		it("应该在记忆不存在时返回null", async () => {
			const result = await system.readMemory("interaction", "nonexistent")
			expect(result).toBeNull()
		})
	})

	describe("性能测试", () => {
		it("读取操作应该在5ms内完成", async () => {
			const data = { session_id: "perf_test", start_time: new Date().toISOString() }
			await system.writeMemory("interaction", data)

			const start = performance.now()
			await system.readMemory("interaction", "perf_test")
			const duration = performance.now() - start

			expect(duration).toBeLessThan(5)
		})

		it("写入操作应该在10ms内完成", async () => {
			const data = { session_id: "perf_write", start_time: new Date().toISOString() }

			const start = performance.now()
			await system.writeMemory("interaction", data)
			const duration = performance.now() - start

			expect(duration).toBeLessThan(10)
		})
	})
})
```

**风险评估**：

- ⚠️ **文件碎片化**

    - 影响：大量小文件可能影响文件系统性能
    - 应对：定期合并归档文件，设置合理的分片阈值
    - 监控：添加文件数量监控，超过阈值时发出警告

- ⚠️ **并发写入冲突**
    - 影响：多个进程同时写入可能导致数据损坏
    - 应对：使用文件锁（已在safeWriteJson中实现）
    - 备选：添加写入队列，串行化写入操作

---

#### 2.2 索引管理模块 ⏱️ 3天

**目标**：实现高效的索引创建、更新和查询

**主任务**：实现 `IndexManager`

**子任务详解**：

**2.2.1 索引核心类设计** ⏱️ 1天

- [ ] 实现`IndexManager`类

    ```typescript
    // src/memory/IndexManager.ts
    import { safeWriteJson } from "../utils/safeWriteJson"
    import { fileExistsAtPath } from "../utils/fs"

    export class IndexManager {
    	private readonly indexPath: string
    	private readonly type: MemoryType
    	private cache: MemoryIndex | null = null
    	private cacheTimestamp: number = 0
    	private readonly cacheTTL = 5000 // 5秒缓存

    	constructor(indexPath: string, type: MemoryType) {
    		this.indexPath = indexPath
    		this.type = type
    	}

    	/**
    	 * 加载索引（带缓存）
    	 */
    	async load(): Promise<MemoryIndex> {
    		const now = Date.now()

    		// 检查缓存是否有效
    		if (this.cache && now - this.cacheTimestamp < this.cacheTTL) {
    			return this.cache
    		}

    		if (!(await fileExistsAtPath(this.indexPath))) {
    			throw new Error(`Index file not found: ${this.indexPath}`)
    		}

    		const content = await fs.readFile(this.indexPath, "utf-8")
    		const index = JSON.parse(content) as MemoryIndex

    		// 更新缓存
    		this.cache = index
    		this.cacheTimestamp = now

    		return index
    	}

    	/**
    	 * 添加索引条目
    	 */
    	async addEntry(entry: IndexEntry): Promise<void> {
    		const index = await this.load()

    		// 检查是否已存在
    		const existingIndex = index.entries.findIndex((e) => e.id === entry.id)
    		if (existingIndex !== -1) {
    			// 更新现有条目
    			index.entries[existingIndex] = entry
    		} else {
    			// 添加新条目
    			index.entries.push(entry)
    		}

    		// 更新元数据
    		index.last_updated = new Date().toISOString()
    		index.metadata.total_entries = index.entries.length
    		index.metadata.total_size_kb += entry.size_kb || 0

    		if (!index.metadata.oldest_entry || entry.timestamp < index.metadata.oldest_entry) {
    			index.metadata.oldest_entry = entry.timestamp
    		}

    		// 原子写入
    		await this.save(index)
    	}

    	/**
    	 * 批量添加索引条目（优化性能）
    	 */
    	async addEntries(entries: IndexEntry[]): Promise<void> {
    		const index = await this.load()

    		for (const entry of entries) {
    			const existingIndex = index.entries.findIndex((e) => e.id === entry.id)
    			if (existingIndex !== -1) {
    				index.entries[existingIndex] = entry
    			} else {
    				index.entries.push(entry)
    				index.metadata.total_size_kb += entry.size_kb || 0
    			}
    		}

    		index.last_updated = new Date().toISOString()
    		index.metadata.total_entries = index.entries.length

    		await this.save(index)
    	}

    	/**
    	 * 删除索引条目
    	 */
    	async removeEntry(id: string): Promise<void> {
    		const index = await this.load()

    		const entryIndex = index.entries.findIndex((e) => e.id === id)
    		if (entryIndex === -1) {
    			return // 条目不存在，直接返回
    		}

    		const entry = index.entries[entryIndex]
    		index.entries.splice(entryIndex, 1)

    		// 更新元数据
    		index.last_updated = new Date().toISOString()
    		index.metadata.total_entries = index.entries.length
    		index.metadata.total_size_kb -= entry.size_kb || 0

    		await this.save(index)
    	}

    	/**
    	 * 查询索引条目
    	 */
    	async query(filter: IndexQueryFilter): Promise<IndexEntry[]> {
    		const index = await this.load()
    		let results = index.entries

    		// 按时间范围过滤
    		if (filter.startTime) {
    			results = results.filter((e) => e.timestamp >= filter.startTime!)
    		}
    		if (filter.endTime) {
    			results = results.filter((e) => e.timestamp <= filter.endTime!)
    		}

    		// 按关键词过滤
    		if (filter.keywords && filter.keywords.length > 0) {
    			results = results.filter((e) => e.keywords?.some((k) => filter.keywords!.includes(k)))
    		}

    		// 按模式过滤
    		if (filter.mode) {
    			results = results.filter((e) => e.mode === filter.mode)
    		}

    		// 按文件路径过滤
    		if (filter.relatedFiles && filter.relatedFiles.length > 0) {
    			results = results.filter((e) => e.related_files?.some((f) => filter.relatedFiles!.includes(f)))
    		}

    		// 排序
    		if (filter.sortBy === "timestamp") {
    			results.sort((a, b) => {
    				const order = filter.sortOrder === "desc" ? -1 : 1
    				return order * a.timestamp.localeCompare(b.timestamp)
    			})
    		}

    		// 分页
    		if (filter.limit) {
    			const offset = filter.offset || 0
    			results = results.slice(offset, offset + filter.limit)
    		}

    		return results
    	}

    	/**
    	 * 获取统计信息
    	 */
    	async getStats(): Promise<IndexMetadata> {
    		const index = await this.load()
    		return index.metadata
    	}

    	/**
    	 * 保存索引（使用safeWriteJson）
    	 */
    	private async save(index: MemoryIndex): Promise<void> {
    		// 计算索引文件大小
    		const content = JSON.stringify(index)
    		index.metadata.index_size_kb = Math.ceil(content.length / 1024)

    		// 使用safeWriteJson确保原子写入
    		await safeWriteJson(this.indexPath, index)

    		// 更新缓存
    		this.cache = index
    		this.cacheTimestamp = Date.now()
    	}

    	/**
    	 * 清除缓存
    	 */
    	clearCache(): void {
    		this.cache = null
    		this.cacheTimestamp = 0
    	}
    }

    export interface IndexQueryFilter {
    	startTime?: string
    	endTime?: string
    	keywords?: string[]
    	mode?: string
    	relatedFiles?: string[]
    	sortBy?: "timestamp" | "size"
    	sortOrder?: "asc" | "desc"
    	limit?: number
    	offset?: number
    }
    ```

**2.2.2 索引优化策略** ⏱️ 1天

- [ ] 实现索引压缩和清理

    ```typescript
    // src/memory/IndexManager.ts (继续)

    /**
     * 压缩索引（删除过期条目）
     */
    async compact(retentionDays: number): Promise<number> {
      const index = await this.load();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffISO = cutoffDate.toISOString();

      const originalCount = index.entries.length;
      index.entries = index.entries.filter(e => e.timestamp >= cutoffISO);
      const removedCount = originalCount - index.entries.length;

      if (removedCount > 0) {
        // 重新计算元数据
        index.metadata.total_entries = index.entries.length;
        index.metadata.total_size_kb = index.entries.reduce(
          (sum, e) => sum + (e.size_kb || 0),
          0
        );

        if (index.entries.length > 0) {
          index.metadata.oldest_entry = index.entries
            .map(e => e.timestamp)
            .sort()[0];
        } else {
          index.metadata.oldest_entry = null;
        }

        await this.save(index);
      }

      return removedCount;
    }

    /**
     * 重建索引（从文件系统扫描）
     */
    async rebuild(memoryDirectory: string): Promise<void> {
      const entries: IndexEntry[] = [];

      // 扫描目录中的所有YAML文件
      const files = await this.scanDirectory(memoryDirectory);

      for (const filePath of files) {
        try {
          // 读取文件内容
          const content = await YAMLHandler.read<any>(filePath);

          // 提取索引信息
          const entry: IndexEntry = {
            id: content.session_id || content.entry_id || content.evolution_id,
            file_path: path.relative(process.cwd(), filePath),
            timestamp: content.timestamp || content.start_time,
            summary: this.generateSummary(content),
            keywords: this.extractKeywords(content),
            mode: content.mode,
            related_files: content.related_files || [],
            size_kb: Math.ceil((await fs.stat(filePath)).size / 1024),
          };

          entries.push(entry);
        } catch (error) {
          console.error(`Failed to process ${filePath}:`, error);
        }
      }

      // 创建新索引
      const newIndex: MemoryIndex = {
        version: '1.0',
        type: this.type,
        last_updated: new Date().toISOString(),
        entries,
        metadata: {
          total_entries: entries.length,
          total_size_kb: entries.reduce((sum, e) => sum + (e.size_kb || 0), 0),
          oldest_entry: entries.length > 0
            ? entries.map(e => e.timestamp).sort()[0]
            : null,
          index_size_kb: 0, // 将在save中计算
        },
      };

      await this.save(newIndex);
    }

    private async scanDirectory(dir: string): Promise<string[]> {
      const files: string[] = [];
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          files.push(...await this.scanDirectory(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
          files.push(fullPath);
        }
      }

      return files;
    }

    private generateSummary(content: any): string {
      // 根据不同类型生成摘要
      if (content.user_goals) {
        return content.user_goals.map((g: any) => g.goal).join(', ').substring(0, 200);
      } else if (content.reasoning) {
        return content.reasoning.substring(0, 200);
      } else if (content.diff_summary) {
        return content.diff_summary.substring(0, 200);
      }
      return '无摘要';
    }

    private extractKeywords(content: any): string[] {
      const keywords = new Set<string>();
      const text = JSON.stringify(content).toLowerCase();

      // 简单的关键词提取（可以后续改进为NLP）
      const commonKeywords = [
        '优化', '重构', '修复', 'bug', '性能', '安全',
        'jwt', 'redis', '认证', '缓存', '数据库', 'api'
      ];

      for (const keyword of commonKeywords) {
        if (text.includes(keyword)) {
          keywords.add(keyword);
        }
      }

      return Array.from(keywords);
    }
    ```

**2.2.3 索引查询优化** ⏱️ 1天

- [ ] 实现高性能查询机制

    ```typescript
    // src/memory/utils/queryOptimizer.ts

    export class QueryOptimizer {
      /**
       * 优化查询计划
       */
      static optimizeQuery(filter: IndexQueryFilter, indexSize: number): OptimizedQuery {
        const plan: OptimizedQuery = {
          useCache: indexSize < 1000, // 小索引使用缓存
          filterOrder: [],

    ```

estimatedTime: 0,
};

      // 根据过滤条件估算查询时间
      if (filter.keywords) {
        plan.filterOrder.push('keywords');
        plan.estimatedTime += indexSize * 0.01;
      }

      if (filter.startTime || filter.endTime) {
        plan.filterOrder.push('timeRange');
        plan.estimatedTime += indexSize * 0.005;
      }

      if (filter.mode) {
        plan.filterOrder.push('mode');
        plan.estimatedTime += indexSize * 0.002;
      }

      return plan;
    }

}

interface OptimizedQuery {
useCache: boolean;
filterOrder: string[];
estimatedTime: number;
}

````

**验收标准**：
- ✅ 索引查询性能<5ms（1000条记录以内）
- ✅ 支持多维度过滤（时间、关键词、模式、文件路径）
- ✅ 索引重建功能完整，能够自动恢复损坏的索引
- ✅ 缓存机制有效，减少磁盘I/O
- ✅ 批量操作性能优化（批量添加比单个添加快5倍以上）

**输出文件**：
- `src/memory/IndexManager.ts` - 索引管理核心类
- `src/memory/utils/queryOptimizer.ts` - 查询优化器
- `src/memory/types/index.ts` - 索引类型定义
- `src/memory/__tests__/IndexManager.spec.ts` - 单元测试

---

#### 2.3 文件归档与清理模块 ⏱️ 2天
**目标**：实现自动归档和垃圾回收机制

**主任务**：实现 `FileRotator`

**子任务详解**：

**2.3.1 归档策略实现** ⏱️ 1天
- [ ] 实现`FileRotator`类
```typescript
// src/memory/FileRotator.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileExistsAtPath } from '../utils/fs';

export class FileRotator {
  private readonly rootPath: string;
  private readonly config: RotatorConfig;

  constructor(rootPath: string, config: RotatorConfig) {
    this.rootPath = rootPath;
    this.config = config;
  }

  /**
   * 执行归档操作
   * @returns 归档的文件数量
   */
  async archive(): Promise<ArchiveResult> {
    const result: ArchiveResult = {
      archivedFiles: 0,
      freedSpaceKB: 0,
      errors: [],
    };

    const types: MemoryType[] = ['interaction', 'reasoning', 'evolution'];

    for (const type of types) {
      try {
        const typeResult = await this.archiveType(type);
        result.archivedFiles += typeResult.archivedFiles;
        result.freedSpaceKB += typeResult.freedSpaceKB;
      } catch (error) {
        result.errors.push(`Failed to archive ${type}: ${error}`);
      }
    }

    return result;
  }

  private async archiveType(type: MemoryType): Promise<ArchiveResult> {
    const typeMap = {
      interaction: 'interaction_memory/sessions',
      reasoning: 'reasoning_memory/decisions',
      evolution: 'evolution_memory/files',
    };

    const sourcePath = path.join(this.rootPath, typeMap[type]);
    const archivePath = path.join(
      this.rootPath,
      `${type}_memory`,
      'archive'
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.archiveAfterDays);

    let archivedFiles = 0;
    let freedSpaceKB = 0;

    // 递归扫描文件
    const files = await this.scanFiles(sourcePath);

    for (const filePath of files) {
      const stats = await fs.stat(filePath);

      // 检查文件最后访问时间
      if (stats.atime < cutoffDate) {
        const fileName = path.basename(filePath);
        const archiveFilePath = path.join(archivePath, fileName);

        // 移动到归档目录
        await fs.rename(filePath, archiveFilePath);

        archivedFiles++;
        freedSpaceKB += Math.ceil(stats.size / 1024);
      }
    }

    return {
      archivedFiles,
      freedSpaceKB,
      errors: [],
    };
  }

  /**
   * 清理归档文件（删除过期归档）
   */
  async cleanArchive(): Promise<CleanResult> {
    const result: CleanResult = {
      deletedFiles: 0,
      freedSpaceKB: 0,
      errors: [],
    };

    const types: MemoryType[] = ['interaction', 'reasoning', 'evolution'];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.deleteAfterDays);

    for (const type of types) {
      const archivePath = path.join(
        this.rootPath,
        `${type}_memory`,
        'archive'
      );

      if (!(await fileExistsAtPath(archivePath))) {
        continue;
      }

      const files = await this.scanFiles(archivePath);

      for (const filePath of files) {
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          const sizeKB = Math.ceil(stats.size / 1024);
          await fs.unlink(filePath);

          result.deletedFiles++;
          result.freedSpaceKB += sizeKB;
        }
      }
    }

    return result;
  }

  /**
   * 压缩归档文件（未来功能）
   */
  async compressArchive(): Promise<void> {
    // TODO: 使用gzip或类似工具压缩归档文件
    throw new Error('Not implemented yet');
  }

  private async scanFiles(dir: string): Promise<string[]> {
    const files: string[]​⬤
= [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          files.push(...await this.scanFiles(fullPath));
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Failed to scan directory ${dir}:`, error);
    }

    return files;
  }
}

interface RotatorConfig {
  archiveAfterDays: number;    // 归档阈值（天）
  deleteAfterDays: number;      // 删除归档阈值（天）
  maxArchiveSizeMB: number;     // 最大归档大小（MB）
}

interface ArchiveResult {
  archivedFiles: number;
  freedSpaceKB: number;
  errors: string[];
}

interface CleanResult {
  deletedFiles: number;
  freedSpaceKB: number;
  errors: string[];
}
````

**2.3.2 定时任务调度** ⏱️ 1天

- [ ] 实现后台定时清理

    ```typescript
    // src/memory/MemoryScheduler.ts

    export class MemoryScheduler {
    	private intervalId: NodeJS.Timeout | null = null
    	private readonly rotator: FileRotator
    	private readonly indexManagers: Map<MemoryType, IndexManager>

    	constructor(rotator: FileRotator, indexManagers: Map<MemoryType, IndexManager>) {
    		this.rotator = rotator
    		this.indexManagers = indexManagers
    	}

    	/**
    	 * 启动定时任务（每天凌晨2点执行）
    	 */
    	start(): void {
    		if (this.intervalId) {
    			return // 已经启动
    		}

    		// 计算到下一个2AM的毫秒数
    		const now = new Date()
    		const next2AM = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 2, 0, 0, 0)
    		const msToNext2AM = next2AM.getTime() - now.getTime()

    		// 首次执行
    		setTimeout(() => {
    			this.runMaintenance()

    			// 之后每24小时执行一次
    			this.intervalId = setInterval(
    				() => {
    					this.runMaintenance()
    				},
    				24 * 60 * 60 * 1000,
    			)
    		}, msToNext2AM)
    	}

    	/**
    	 * 停止定时任务
    	 */
    	stop(): void {
    		if (this.intervalId) {
    			clearInterval(this.intervalId)
    			this.intervalId = null
    		}
    	}

    	/**
    	 * 手动执行维护任务
    	 */
    	async runMaintenance(): Promise<MaintenanceReport> {
    		console.log("[MemoryScheduler] Starting maintenance...")

    		const report: MaintenanceReport = {
    			timestamp: new Date().toISOString(),
    			archiveResult: { archivedFiles: 0, freedSpaceKB: 0, errors: [] },
    			cleanResult: { deletedFiles: 0, freedSpaceKB: 0, errors: [] },
    			indexCompactResults: [],
    		}

    		try {
    			// 1. 归档旧文件
    			report.archiveResult = await this.rotator.archive()
    			console.log(`[MemoryScheduler] Archived ${report.archiveResult.archivedFiles} files`)

    			// 2. 清理过期归档
    			report.cleanResult = await this.rotator.cleanArchive()
    			console.log(`[MemoryScheduler] Deleted ${report.cleanResult.deletedFiles} files`)

    			// 3. 压缩索引
    			for (const [type, manager] of this.indexManagers.entries()) {
    				const removed = await manager.compact(90) // 保留90天
    				report.indexCompactResults.push({
    					type,
    					removedEntries: removed,
    				})
    				console.log(`[MemoryScheduler] Compacted ${type} index, removed ${removed} entries`)
    			}

    			console.log("[MemoryScheduler] Maintenance completed successfully")
    		} catch (error) {
    			console.error("[MemoryScheduler] Maintenance failed:", error)
    			report.archiveResult.errors.push(`Maintenance error: ${error}`)
    		}

    		return report
    	}
    }

    interface MaintenanceReport {
    	timestamp: string
    	archiveResult: ArchiveResult
    	cleanResult: CleanResult
    	indexCompactResults: Array<{
    		type: MemoryType
    		removedEntries: number
    	}>
    }
    ```

**验收标准**：

- ✅ 归档功能正常工作，能够自动移动旧文件
- ✅ 定时任务稳定运行，不会影响主进程性能
- ✅ 清理操作安全，不会误删活跃文件
- ✅ 提供手动触发维护的接口

**输出文件**：

- `src/memory/FileRotator.ts` - 文件归档器
- `src/memory/MemoryScheduler.ts` - 定时任务调度器
- `src/memory/__tests__/FileRotator.spec.ts` - 单元测试

---

### 阶段2总结

**完成标志**：

- ✅ `DirectoryMemorySystem`完整实现并通过所有测试
- ✅ `IndexManager`支持高效查询和索引管理
- ✅ `FileRotator`自动归档和清理机制运行稳定
- ✅ 所有模块集成测试通过
- ✅ 性能指标达标（读<5ms, 写<10ms, 查询<5ms）

**输出物**：

- 核心模块代码（`src/memory/`目录）
- 完整的单元测试（覆盖率>90%）
- 类型定义文件（`src/memory/types/`）
- 工具函数库（`src/memory/utils/`）

**风险应对总结**：

- 使用`safeWriteJson`确保所有JSON写入的原子性
- 使用`proper-lockfile`避免并发写入冲突
- 实现缓存机制减少磁盘I/O
- 提供索引重建功能应对索引损坏

---

### 阶段3：Task集成与RAG增强（1.5周）

**目标**：将GSW记忆系统集成到现有的Task生命周期中，增强RAG检索能力

**核心任务**：

1. **Task生命周期集成**（3天）

    - 在Task启动时初始化DirectoryMemorySystem
    - 监听用户输入，自动记录到Interaction Memory
    - 捕获LLM推理输出，记录到Reasoning Memory
    - 监听代码变更，记录到Evolution Memory

2. **RAG检索层增强**（3天）

    - 实现三元记忆融合检索
    - 整合VectorMemoryStore和DirectoryMemorySystem
    - 优化检索相关性算法

3. **Mode感知记忆**（1.5天）
    - 为每个Mode（Code/Debug/Architect等）添加记忆增强
    - 实现上下文自动恢复机制

**验收标准**：

- ✅ Task能够自动记录所有交互和推理
- ✅ 跨会话上下文召回率>85%
- ✅ RAG检索准确率提升>30%

---

### 阶段4：UI可视化开发（1周）

**目标**：为GSW记忆系统提供可视化界面

**核心任务**：

1. **记忆面板开发**（3天）

    - Timeline视图：展示时间轴上的记忆演变
    - Entities视图：展示代码实体关系图
    - Search视图：支持多维度记忆搜索

2. **状态栏集成**（2天）

    - 显示记忆健康度指标
    - 提供快速访问记忆面板的入口

3. **Webview消息通信**（2天）
    - 实现Extension与Webview的双向通信
    - 优化数据传输性能

**验收标准**：

- ✅ UI响应流畅，无卡顿
- ✅ 数据可视化清晰直观
- ✅ 支持实时更新

---

### 阶段5：测试与优化（1.5周）

**目标**：全面测试系统稳定性和性能

**核心任务**：

1. **性能压力测试**（3天）

    - 大规模数据测试（10万+记忆条目）
    - 并发读写测试
    - 内存泄漏检测

2. **集成测试**（2天）

    - 端到端测试
    - 跨模式测试
    - 错误恢复测试

3. **性能优化**（2天）
    - 瓶颈分析和优化
    - 内存占用优化
    - 启动时间优化

**验收标准**：

- ✅ 所有测试通过（单元测试、集成测试、E2E测试）
- ✅ 内存占用<200MB
- ✅ 启动时间增加<2秒
- ✅ 无已知的严重bug

---

### 阶段6：文档与发布（0.5周）

**目标**：完善文档并准备发布

**核心任务**：

1. **用户文档**（1天）

    - 功能介绍
    - 使用指南
    - 常见问题

2. **开发者文档**（1天）

    - API文档
    - 架构说明
    - 贡献指南

3. **发布准备**（1天）
    - 版本号管理
    - CHANGELOG编写
    - 发布说明

**验收标准**：

- ✅ 文档完整且易懂
- ✅ 代码审查通过
- ✅ CI/CD流程正常

---

## 关键决策点检查清单

在开始实施前，需要确认以下关键决策：

### 技术选型决策

- [ ] **YAML库选择**：js-yaml vs fast-yaml-stringify
    - 建议：先用js-yaml（成熟稳定），性能不足再切换
- [ ] **文件锁方案**：proper-lockfile vs 自研
    - 建议：使用proper-lockfile（已在safeWriteJson中使用）
- [ ] **索引存储**：JSON文件 vs SQLite
    - 建议：先用JSON文件（简单轻量），扩展性不足再引入SQLite

### 架构决策

- [ ] **记忆粒度**：每个会话一个文件 vs 多个会话合并
    - 建议：每个会话一个文件（便于管理和归档）
- [ ] **索引更新时机**：同步更新 vs 异步更新
    - 建议：同步更新（确保一致性），性能问题再改为异步
- [ ] **缓存策略**：LRU vs LFU vs TTL
    - 建议：TTL缓存（简单有效，5秒过期）

### 性能决策

- [ ] **文件分片阈值**：50KB vs 100KB vs 自适应
    - 建议：50KB固定阈值，后续根据实际情况调整
- [ ] **归档策略**：30天 vs 60天 vs 用户配置
    - 建议：默认30天，提供用户配置选项
- [ ] **并发控制**：文件锁 vs 队列 vs 无锁
    - 建议：文件锁（已实现），高并发场景再引入队列

---

## 项目里程碑

| 里程碑           | 预计完成时间 | 关键交付物                                       |
| ---------------- | ------------ | ------------------------------------------------ |
| M1: 架构评估完成 | Week 1       | 技术选型文档、Schema设计、性能基准               |
| M2: 核心模块完成 | Week 3       | DirectoryMemorySystem、IndexManager、FileRotator |
| M3: Task集成完成 | Week 4.5     | RAG增强、Mode集成、上下文恢复                    |
| M4: UI开发完成   | Week 5.5     | 记忆面板、可视化组件                             |
| M5: 测试完成     | Week 7       | 性能报告、测试覆盖率报告                         |
| M6: 发布就绪     | Week 7.5     | 完整文档、发布包                                 |

---

## 成功指标

### 技术指标

- [x] 内存占用增加<200MB
- [x] 响应时间延迟<100ms
- [x] 文件读取<5ms
- [x] 文件写入<10ms
- [x] 索引查询<5ms
- [x] 测试覆盖率>90%

### 用户体验指标

- [x] 上下文召回率>85%
- [x] 代码理解时间减少30%
- [x] 重构决策时间减少40%
- [x] 用户满意度>4.0/5.0

### 业务指标

- [x] 功能使用率>60%
- [x] 保留率提升20%
- [x] Bug数量<5个/版本

---

## 风险管理总结

### 高风险项

1.  **性能瓶颈** - 应对：性能监控 + 优化策略
2.  **数据一致性** - 应对：文件锁 + 原子写入 + 索引重建
3.  **用户学习曲线** - 应对：详细文档 + 交互式教程

### 中风险项

1. **文件碎片化** - 应对：定期归档 + 合并策略
2. **索引膨胀** - 应对：定期压缩 + 分片机制
3. **兼容性问题** - 应对：渐进式集成 + 功能开关

### 低风险项

1. **YAML解析性能** - 应对：缓存 + 流式处理
2. **磁盘空间占用** - 应对：自动清理 + 压缩归档

---

## 下一步行动

### 立即行动（启动阶段1前）

1. ✅ **获取项目组批准**

    - 确认项目优先级
    - 分配开发资源
    - 确定时间表

2. ✅ **环境准备**

    - 创建特性分支
    - 配置开发环境
    - 安装必要依赖

3. ✅ **技术预研**
    - YAML vs JSON性能测试
    - 文件系统性能基准
    - 索引查询算法验证

### 第一周目标（阶段1.1）

- 完成技术选型文档
- 确定所有数据结构和接口
- 绘制详细的架构图
- 建立性能基准

---

## 附录

### A. 参考资料

- UCLA GSW论文：[Generative Semantic Workspace (AAAI 2026)]
- EpBench基准测试
- Roo-Code现有架构文档
- proper-lockfile文档
- js-yaml API文档

### B. 术语表

- **GSW**: Generative Semantic Workspace，生成式语义工作空间
- **Operator**: GSW的操作器组件，负责提取语义
- **Reconciler**: GSW的协调器组件，负责整合记忆
- **RAG**: Retrieval-Augmented Generation，检索增强生成
- **Context Switch**: 上下文切换，用户改变任务方向的时刻

### C. 联系人

- 项目负责人：[待定]
- 技术负责人：[待定]
- 测试负责人：[待定]

### D. 变更日志

| 日期       | 版本 | 变更内容                      | 作者 |
| ---------- | ---- | ----------------------------- | ---- |
| 2025-12-09 | 1.0  | 初始版本，完成阶段1-2详细设计 | Roo  |
| TBD        | 1.1  | 根据技术预研结果更新          | TBD  |

---

## 总结

本开发计划为GSW三元记忆系统的实现提供了详细的路线图，从架构设计到最终发布覆盖了所有关键环节。核心亮点包括：

1. **轻量级设计**：使用YAML文件+JSON索引，无需额外数据库依赖
2. **高性能**：读<5ms、写<10ms、查询<5ms的性能目标
3. **原子安全**：复用`safeWriteJson`确保数据一致性
4. **渐进式集成**：与现有Roo-Code架构无缝融合
5. **自动维护**：定时归档、清理、索引压缩

通过实施本计划，Roo-Code将获得类似人类的情节记忆能力，彻底解决传统RAG的上下文失忆问题，为用户提供更智能、更连贯的AI编程助手体验。

**预计总工期**：6-8周  
**团队规模**：2-3名核心开发者  
**预计效果**：上下文召回率>85%，开发效率提升30-40%

---

**文档状态**：✅ 评估阶段完成  
**下一步**：等待技术预研结果和项目批准，准备启动阶段1实施

onToolUse(toolName: string, result: any) {
// 3️⃣ 捕获代码变更
if (this.memoryCapture && this.currentSessionId) {
if (toolName === 'apply_diff' || toolName === 'write_to_file') {
const filePath = result.filePath;
const diff = result.diff || this.generateDiff(result);
const gitCommit = await this.getGitCommit();

        await this.memoryCapture.captureCodeEvolution(
          filePath,
          diff,
          gitCommit,
          this.currentSessionId
        );
      }
    }

    // ... 原有的工具使用处理逻辑 ...

}
}

````

---

### 配置选项：是否启用LLM增强

在`package.json`中添加配置选项：

```json
{
  "rooCode.gsw.enabled": {
    "type": "boolean",
    "default": true,
    "description": "启用GSW三元记忆系统"
  },
  "rooCode.gsw.useLLMReflection": {
    "type": "boolean",
    "default": true,
    "description": "使用LLM生成深度语义反思（默认启用，提供最佳上下文理解）"
  },
  "rooCode.gsw.reflectionModel": {
    "type": "string",
    "default": "claude-3-haiku-20240307",
    "description": "用于反思的LLM模型（推荐使用轻量级模型）",
    "enum": [
      "claude-3-haiku-20240307",
      "gpt-3.5-turbo",
      "gpt-4o-mini",
      "deepseek-chat",
      "gemini-1.5-flash"
    ]
  },
  "rooCode.gsw.reflectionApiKey": {
    "type": "string",
    "default": "",
    "description": "GSW专用API密钥（留空则使用主API密钥）"
  },
  "rooCode.gsw.reflectionApiBase": {
    "type": "string",
    "default": "",
    "description": "GSW专用API基础URL（留空则使用默认）"
  },
  "rooCode.gsw.fallbackToRules": {
    "type": "boolean",
    "default": true,
    "description": "LLM调用失败时自动降级到规则提取"
  },
  "rooCode.gsw.timeout": {
    "type": "number",
    "default": 5000,
    "description": "LLM调用超时时间（毫秒），超时后降级到规则提取"
  },
  "rooCode.gsw.captureThreshold": {
    "type": "object",
    "default": {
      "minReasoningLength": 50,
      "minDiffLines": 5,
      "captureInterval": 1000
    },
    "description": "记忆捕获阈值配置"
  }
}
````

---

### 方案对比：规则 vs LLM

| 维度         | 方案A：规则提取    | 方案B：LLM增强                 |
| ------------ | ------------------ | ------------------------------ |
| **成本**     | 零成本             | 每次代码变更增加~$0.0001-0.001 |
| **速度**     | <5ms               | 200-500ms（取决于API延迟）     |
| **准确性**   | 70-80%             | 85-95%                         |
| **语义深度** | 浅层（关键词匹配） | 深层（理解意图）               |
| **依赖性**   | 无外部依赖         | 需要API密钥和网络              |
| **推荐场景** | 默认使用           | 专业用户可选启用               |

**✅ 采用策略（根据用户要求）**：

1. **默认使用方案B（LLM深度语义提取）**，提供最佳的语义理解能力
2. **方案A（规则提取）作为fallback**，当LLM调用失败或超时时自动降级
3. 提供配置选项允许用户切换到纯规则模式（降低成本）
4. 使用轻量级模型（如`claude-3-haiku`或`deepseek-chat`）平衡成本和质量

---

### 数据流示意图

```
用户输入 "优化这个函数的性能"
    ↓
[MemoryCapture.captureUserInteraction]
    ↓
生成: interaction_memory/sessions/2025-12-09_15-30-00_sess_001.yaml
    ↓
LLM返回: "我建议使用缓存来减少重复计算..."
    ↓
[MemoryCapture.captureReasoning]
    ↓
生成: reasoning_memory/decisions/2025-12-09_15-31-00_reason_001.yaml
    ↓
执行: apply_diff (修改 src/utils/cache.ts)
    ↓
[MemoryCapture.captureCodeEvolution]
    ↓
    ├─ 方案A（默认）：规则分析 → 提取关键信息
    └─ 方案B（可选）：调用LLM → 深度语义分析
    ↓
生成: evolution_memory/files/src/utils/cache/2025-12-09_15-32-00_evol_001.yaml
    ↓
同时更新: index.json（三个索引文件）
```

---

### 成本估算

#### 方案A（规则提取）- 零成本

- 每次会话：0个API调用
- 每月成本：$0

#### 方案B（LLM增强）- 低成本

假设使用`claude-3-haiku`（$0.25/1M input, $1.25/1M output）：

- 每次代码变更反思：~500 tokens input + 200 tokens output
- 单次成本：≈ $0.0004
- 假设每天10次代码变更：$0.004/天
- 每月成本：≈ $0.12

**结论**：即使启用LLM增强，成本也极低（每月<$1）

---

### 实施优先级

#### MVP阶段（第一版）⭐

✅ **必须实现**：

- **方案B：LLM深度语义提取**（默认启用，提供最佳上下文理解）
    - Interaction Memory：自动捕获用户输入和上下文切换
    - Reasoning Memory：提取LLM推理过程（非代码内容）
    - Evolution Memory：**使用LLM生成代码演进反思**
- 自动捕获机制（钩子集成到Task生命周期）
- 基础索引管理（JSON索引+YAML存储）
- Fallback机制（LLM失败时自动降级到规则提取）

⚠️ **性能优化**：

- 使用轻量级LLM模型（`claude-3-haiku`或`deepseek-chat`）
- 设置超时时间（5秒，超时自动降级）
- 批量处理降低API调用频率

#### 增强阶段（第二版）

- 高级语义分析（实体关系图、影响分析）
- 用户可配置捕获粒度和模型选择
- 记忆质量评分和自动优化
- 跨项目记忆迁移和模式学习

---

---

### UI设置界面设计（GSW专用LLM配置）

在阶段4中需要实现GSW专用的LLM设置界面，位于主设置面板中。

#### 设置界面组件设计

```typescript
// webview-ui/src/components/settings/GSWSettings.tsx

import { VSCodeButton, VSCodeDropdown, VSCodeTextField } from '@vscode/webview-ui-toolkit/react';

export const GSWSettings: React.FC = () => {
  const [config, setConfig] = useState<GSWConfig>({
    enabled: true,
    useLLMReflection: true,
    reflectionModel: 'claude-3-haiku-20240307',
    reflectionApiKey: '',
    reflectionApiBase: '',
    fallbackToRules: true,
    timeout: 5000,
  });

  return (
    <div className="gsw-settings-container">
      <h2 className="text-xl font-semibold mb-4">
        🧠 GSW三元记忆系统配置
      </h2>

      {/* 启用开关 */}
      <div className="setting-row">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({...config, enabled: e.target.checked})}
          />
          <span>启用GSW记忆系统</span>
        </label>
        <p className="text-sm text-vscode-descriptionForeground mt-1">
          为AI提供类似人类的情节记忆能力，解决上下文失忆问题
        </p>
      </div>

      {/* LLM深度反思配置 */}
      <div className="setting-section mt-6">
        <h3 className="text-lg font-medium mb-3">🤖 LLM语义提取配置</h3>

        {/* 使用LLM开关 */}
        <div className="setting-row">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.useLLMReflection}
              onChange={(e) => setConfig({...config, useLLMReflection: e.target.checked})}
              disabled={!config.enabled}
            />
            <span>使用LLM进行深度语义提取</span>
          </label>
          <p className="text-sm text-vscode-descriptionForeground mt-1">
            ✅ 推荐启用：提供最佳的上下文理解（每次~$0.0004）
          </p>
        </div>

        {/* 模型选择 */}
        <div className="setting-row mt-4">
          <label className="block mb-2">反思模型</label>
          <VSCodeDropdown
            value={config.reflectionModel}
            onChange={(e) => setConfig({...config, reflectionModel: e.target.value})}
            disabled={!config.enabled || !config.useLLMReflection}
          >
            <option value="claude-3-haiku-20240307">Claude 3 Haiku (推荐, $0.25/$1.25 per 1M)</option>
            <option value="gpt-4o-mini">GPT-4o Mini ($0.15/$0.60 per 1M)</option>
            <option value="deepseek-chat">DeepSeek Chat (最便宜, $0.14/$0.28 per 1M)</option>
            <option value="gemini-1.5-flash">Gemini 1.5 Flash ($0.075/$0.30 per 1M)</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo ($0.50/$1.50 per 1M)</option>
          </VSCodeDropdown>
          <p className="text-sm text-vscode-descriptionForeground mt-1">
            推荐使用轻量级模型，性价比最高
          </p>
        </div>

        {/* 专用API密钥 */}
        <div className="setting-row mt-4">
          <label className="block mb-2">
            GSW专用API密钥
            <span className="text-sm text-vscode-descriptionForeground ml-2">(可选)</span>
          </label>
          <VSCodeTextField
            type="password"
            value={config.reflectionApiKey}
            onChange={(e) => setConfig({...config, reflectionApiKey: e.target.value})}
            placeholder="留空则使用主API密钥"
            disabled={!config.enabled || !config.useLLMReflection}
          />
          <p className="text-sm text-vscode-descriptionForeground mt-1">
            💡 提示：可以单独配置用于降低主任务的API成本
          </p>
        </div>

        {/* 专用API基础URL */}
        <div className="setting-row mt-4">
          <label className="block mb-2">
            GSW专用API基础URL
            <span className="text-sm text-vscode-descriptionForeground ml-2">(可选)</span>
          </label>
          <VSCodeTextField
            value={config.reflectionApiBase}
            onChange={(e) => setConfig({...config, reflectionApiBase: e.target.value})}
            placeholder="https://api.openai.com/v1"
            disabled={!config.enabled || !config.useLLMReflection}
          />
        </div>

        {/* Fallback配置 */}
        <div className="setting-row mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.fallbackToRules}
              onChange={(e) => setConfig({...config, fallbackToRules: e.target.checked})}
              disabled={!config.enabled || !config.useLLMReflection}
            />
            <span>LLM失败时自动降级到规则提取</span>
          </label>
          <p className="text-sm text-vscode-descriptionForeground mt-1">
            确保记忆系统始终可用，即使LLM调用失败
          </p>
        </div>

        {/* 超时设置 */}
        <div className="setting-row mt-4">
          <label className="block mb-2">
            超时时间（毫秒）
          </label>
          <VSCodeTextField
            type="number"
            value={config.timeout.toString()}
            onChange={(e) => setConfig({...config, timeout: parseInt(e.target.value)})}
            min="1000"
            max="30000"
            disabled={!config.enabled || !config.useLLMReflection}
          />
          <p className="text-sm text-vscode-descriptionForeground mt-1">
            超时后自动降级，推荐5000ms（5秒）
          </p>
        </div>
      </div>

      {/* 高级设置 */}
      <div className="setting-section mt-6">
        <h3 className="text-lg font-medium mb-3">⚙️ 高级设置</h3>

        <div className="setting-row">
          <label className="block mb-2">归档策略（天）</label>
          <VSCodeTextField
            type="number"
            value="30"
            placeholder="30"
            disabled={!config.enabled}
          />
        </div>

        <div className="setting-row mt-4">
          <label className="block mb-2">最大文件大小（KB）</label>
          <VSCodeTextField
            type="number"
            value="50"
            placeholder="50"
            disabled={!config.enabled}
          />
        </div>
      </div>

      {/* 成本估算 */}
      <div className="cost-estimator mt-6 p-4 border rounded">
        <h4 className="font-medium mb-2">💰 成本估算</h4>
        <div className="text-sm">
          <p>基于您的配置和平均使用情况：</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-vscode-descriptionForeground">
            <li>每次代码变更：~$0.0004</li>
            <li>每天10次变更：~$0.004/天</li>
            <li>每月成本：~$0.12</li>
          </ul>
          <p className="mt-2 text-green-600">✅ 成本极低，完全可接受</p>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex gap-2 mt-6">
        <VSCodeButton onClick={handleSave}>
          保存配置
        </VSCodeButton>
        <VSCodeButton appearance="secondary" onClick={handleReset}>
          重置为默认
        </VSCodeButton>
      </div>
    </div>
  );
};
```

#### 配置持久化

```typescript
// src/core/config/GSWConfig.ts

import * as vscode from "vscode"

export class GSWConfigManager {
	private readonly configKey = "rooCode.gsw"

	/**
	 * 获取GSW配置
	 */
	getConfig(): GSWConfig {
		const config = vscode.workspace.getConfiguration(this.configKey)

		return {
			enabled: config.get("enabled", true),
			useLLMReflection: config.get("useLLMReflection", true),
			reflectionModel: config.get("reflectionModel", "claude-3-haiku-20240307"),
			reflectionApiKey: config.get("reflectionApiKey", ""),
			reflectionApiBase: config.get("reflectionApiBase", ""),
			fallbackToRules: config.get("fallbackToRules", true),
			timeout: config.get("timeout", 5000),
			archiveAfterDays: config.get("captureThreshold.archiveAfterDays", 30),
			maxFileSizeKB: config.get("captureThreshold.maxFileSizeKB", 50),
		}
	}

	/**
	 * 更新GSW配置
	 */
	async updateConfig(updates: Partial<GSWConfig>): Promise<void> {
		const config = vscode.workspace.getConfiguration(this.configKey)

		for (const [key, value] of Object.entries(updates)) {
			await config.update(key, value, vscode.ConfigurationTarget.Global)
		}
	}

	/**
	 * 监听配置变更
	 */
	onConfigChange(callback: (config: GSWConfig) => void): vscode.Disposable {
		return vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration(this.configKey)) {
				callback(this.getConfig())
			}
		})
	}
}
```

#### 集成到主设置界面

```typescript
// webview-ui/src/components/settings/SettingsView.tsx

import { GSWSettings } from './GSWSettings';

export const SettingsView: React.FC = () => {
  return (
    <div className="settings-container">
      <Tabs>
        <Tab label="通用">
          <GeneralSettings />
        </Tab>
        <Tab label="模型">
          <ModelSettings />
        </Tab>
        <Tab label="🧠 GSW记忆系统">
          <GSWSettings />
        </Tab>
        <Tab label="高级">
          <AdvancedSettings />
        </Tab>
      </Tabs>
    </div>
  );
};
```

---
