# 主动压缩提示词优化

**文档编号**: 35
**创建日期**: 2025-10-16
**状态**: ✅ 已完成
**优先级**: 高
**关联文档**:

- [34-subagent-improvement-plan.md](./34-subagent-improvement-plan.md)
- [34-subagent-todolist.md](./34-subagent-todolist.md)

---

## 📋 问题背景

### 用户反馈的核心问题

在实际使用中发现，即使上下文使用率达到 **44.1k/120k (36.75%)**，子代理压缩仍未被主动触发。这说明：

1. **触发阈值过晚**: 原有的 AUTO-TRIGGER 条件设置为 "Context > 8000 tokens"，这个条件太简单且不够明确
2. **缺乏主动性**: LLM不清楚应该在什么时候主动调用压缩
3. **被动等待**: 往往等到系统强制触发（90-100%）才压缩，导致上下文质量下降

### 期望目标

让LLM能够**更早、更主动**地触发上下文压缩，建议在 **75-85%** 上下文使用率时就主动调用压缩子代理。

---

## 🎯 改进方案

### 核心思路

**不修改代码逻辑，而是优化LLM的提示词**，让它更清楚地理解：

- 何时应该主动调用压缩（75-85% 阈值）
- 为什么要主动调用（避免被动压缩质量下降）
- 如何主动调用（使用 use_subagent 工具）

---

## 📝 具体改进内容

### 1. 优化 AUTO-TRIGGER CONDITIONS

**文件**: `src/core/prompts/tools/use-subagent.ts`

**改进前**:

```
**AUTO-TRIGGER CONDITIONS:**
- Context > 8000 tokens OR conversation > 15 messages
- User explicitly requests summary/analysis
- Before complex multi-factor decisions
- When you need structured extraction
```

**改进后**:

```
**AUTO-TRIGGER CONDITIONS:**

🔴 **CRITICAL - Proactive Compression (High Priority)**:
- Context reaches 75-85% of context window (e.g., 90k/120k tokens)
- Before context exceeds safe threshold to prevent forced truncation
- When you notice conversation history growing large (>15-20 messages)
- Proactively compress BEFORE hitting limits, not after

🟡 **HIGH PRIORITY - Context Management**:
- Complex multi-step tasks with >20 messages exchanged
- Before making important decisions that require full context review
- When working memory feels cluttered with older information
- After completing a major phase of work (design → implementation → testing)

🟢 **RECOMMENDED - Analysis & Summarization**:
- User explicitly requests summary/analysis
- Need structured extraction from lengthy technical discussions
- Preparing status updates or completion reports
- Reviewing what's been accomplished so far

**💡 PROACTIVE STRATEGY**:
Don't wait for the system to force compression at 90-100%! Call compression
subagents when context reaches 75-85% to:
- Maintain conversation quality
- Preserve important context
- Avoid emergency truncation
- Keep responses coherent and contextually aware
```

**关键改进点**:

1. ✅ 添加三级优先级系统（🔴 CRITICAL / 🟡 HIGH / 🟢 RECOMMENDED）
2. ✅ 明确 75-85% 上下文阈值
3. ✅ 强调"主动"而非"被动"
4. ✅ 说明预防性压缩的好处

---

### 2. 优化 COMBINATION STRATEGIES

**改进前**:

```
**COMBINATION STRATEGIES:**

Strategy 1 - Full Context Compression:
1. Call condense-context-analyzer
2. Call condense-memory-extractor
3. Synthesize results

Strategy 2 - Focused Technical Analysis:
1. Call condense-code-summarizer
2. Use summary

Strategy 3 - Progressive Memory Management:
- Every ~20 messages: call condense-memory-extractor
- Store extracted memories
```

**改进后**:

```
**COMBINATION STRATEGIES:**

Strategy 1 - Proactive Context Compression (🔴 RECOMMENDED for long tasks):
**When**: Context reaches 75-85% (e.g., 90k/120k tokens)
1. Call condense-memory-extractor → preserve critical decisions
2. Call condense-context-analyzer → understand conversation flow
3. Synthesize results → maintain compressed context
4. Continue working with cleaner context, avoiding forced truncation
**Benefit**: Prevents quality degradation from emergency compression

Strategy 2 - Full Context Compression (for user-requested summaries):
**When**: User asks "what have we done?" or requests recap
1. Call condense-context-analyzer
2. Call condense-memory-extractor
3. Call condense-code-summarizer (if applicable)
4. Synthesize all results

Strategy 3 - Focused Technical Analysis:
**When**: Need to review specific code changes
1. Call condense-code-summarizer
2. Use summary for decision making

Strategy 4 - Progressive Memory Management (for multi-session tasks):
**When**: Working on complex projects spanning conversations
- Every ~20 messages: call condense-memory-extractor
- Store extracted memories
- Keep only critical decisions + recent 10 messages

Strategy 5 - Before Large Codebase Analysis:
**When**: About to parse or analyze large amounts of code
- Before reading multiple files (>5 files)
- Before deep codebase exploration

Strategy 6 - After Major Code Improvements:
**When**: Completed significant refactoring or feature implementation
- After modifying >3 files
- After implementing a complete feature

Strategy 7 - Before Adding Terminal Context:
**When**: About to add large terminal output to context
- Before adding long command output (>100 lines)
- Before analyzing extensive logs

Strategy 8 - After Terminal Command Issues:
**When**: After debugging or fixing terminal command problems
- After multiple command execution attempts
- After troubleshooting environment issues

Strategy 9 - Before Parsing Complex Terminal Output:
**When**: Need to analyze lengthy terminal results
- Before parsing test results (>50 lines)
- Before analyzing error stack traces

Strategy 10 - Starting New Task Phase:
**When**: Transitioning between major task phases
- Moving from planning → implementation
- Switching from implementation → testing
```

**关键改进点**:

1. ✅ Strategy 1 标记为推荐策略（🔴 RECOMMENDED）
2. ✅ 每个策略都明确"何时使用"（**When**）
3. ✅ 强调主动压缩的好处（**Benefit**）
4. ✅ 提供具体的触发场景
5. ✅ **新增6个实用场景策略**（Strategy 5-10），覆盖代码分析、终端处理、任务切换等常见情况

---

## 📊 改进效果

### 提示词清晰度提升

| 方面           | 改进前                  | 改进后                       |
| -------------- | ----------------------- | ---------------------------- |
| **触发阈值**   | "Context > 8000 tokens" | "75-85% of context window"   |
| **优先级**     | 无明确优先级            | 三级优先级系统               |
| **主动性强调** | 无                      | 明确强调主动调用的重要性     |
| **策略指导**   | 简单列举                | 详细说明何时使用每个策略     |
| **视觉标记**   | 无                      | 使用图标（🔴🟡🟢）增强可读性 |

### 预期效果

通过这些改进，LLM应该能够：

1. ✅ **更早触发**: 在75-85%上下文使用率时主动调用压缩
2. ✅ **更明确决策**: 知道何时应该使用哪个策略
3. ✅ **更好理解**: 理解主动压缩的重要性和好处
4. ✅ **更高质量**: 避免等到90-100%被动压缩导致的质量下降

---

## 🧪 测试验证

### 单元测试

**文件**: `src/core/tools/__tests__/useSubagentTool.test.ts`

**测试结果**: ✅ 所有 9 个测试通过

```
Test Files  1 passed (1)
Tests       9 passed (9)
Duration    439ms
```

测试覆盖：

- ✅ 工具基本执行功能
- ✅ 参数验证
- ✅ 错误处理
- ✅ 主动调用记录（triggerType: "tool_call"）
- ✅ Token和成本记录

### 实际验证建议

建议在真实场景中测试：

1. **长对话场景**: 进行20-30轮对话，观察LLM是否在75-85%时主动调用
2. **复杂任务场景**: 执行多步骤任务，观察是否在阶段完成时主动压缩
3. **上下文监控**: 检查LLM是否能正确判断上下文使用率并及时压缩

---

## 📁 修改文件清单

| 文件                                           | 操作 | 说明                                                |
| ---------------------------------------------- | ---- | --------------------------------------------------- |
| `src/core/prompts/tools/use-subagent.ts`       | 修改 | 优化AUTO-TRIGGER CONDITIONS和COMBINATION STRATEGIES |
| `docs/34-subagent-todolist.md`                 | 更新 | 添加Phase 2.8改进说明                               |
| `docs/35-proactive-compression-improvement.md` | 新增 | 本文档                                              |

---

## 🔄 与现有系统的关系

### 保持兼容

1. ✅ **不影响现有功能**: 被动压缩机制（90-100%触发）保持不变
2. ✅ **不修改代码逻辑**: 仅优化提示词，不改变执行流程
3. ✅ **工具已存在**: `use_subagent` 工具早已完整实现并注册

### 协同工作

```
┌─────────────────────────────────────────────────┐
│              LLM 决策层                          │
│  "上下文达到80%，我应该主动调用压缩"            │
│                    ↓                             │
│  使用 use_subagent 工具主动调用子代理           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│          use_subagent 工具层                     │
│  - 参数验证                                      │
│  - 子代理配置                                    │
│  - 记录调用历史 (triggerType: "tool_call")      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│       SubAgentExecutor 执行层                    │
│  - 执行压缩子代理                                │
│  - 返回压缩结果                                  │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│            系统保护层                            │
│  如果上下文达到90-100%仍未压缩                   │
│  → 被动触发压缩 (triggerType: "auto_compress")  │
└─────────────────────────────────────────────────┘
```

**设计理念**:

- **主动优先**: 鼓励LLM在75-85%时主动压缩（高质量）
- **被动保底**: 如果LLM没有主动调用，系统在90-100%强制压缩（保证安全）

---

## 📚 相关文档

1. [34-subagent-improvement-plan.md](./34-subagent-improvement-plan.md) - 子代理改进总体方案
2. [34-subagent-todolist.md](./34-subagent-todolist.md) - 详细任务清单
3. [subagent2.md](./subagent2.md) - 子代理系统架构
4. [44-subagent-tool-based-invocation.md](./44-subagent-tool-based-invocation.md) - 工具调用机制

---

## ✅ 完成标准

- [x] 优化 AUTO-TRIGGER CONDITIONS 提示词
- [x] 优化 COMBINATION STRATEGIES 说明
- [x] 添加三级优先级系统（🔴🟡🟢）
- [x] 明确 75-85% 触发阈值
- [x] 强调主动压缩的重要性
- [x] 所有单元测试通过
- [x] 更新相关文档

---

## 🎉 总结

本次改进通过优化 `use_subagent` 工具的提示词，成功让LLM能够更清楚地理解：

### 核心改进

1. **明确触发阈值**: 从模糊的"Context > 8000 tokens"升级为具体的"75-85%上下文使用率"
2. **三级优先级**: 添加🔴 CRITICAL、🟡 HIGH、🟢 RECOMMENDED三级优先级系统
3. **强调主动性**: 明确说明主动压缩优于被动压缩的好处
4. **详细策略**: 为每个策略提供清晰的使用场景和时机

### 设计理念

**预防优于治疗**: 鼓励LLM在上下文达到75-85%时就主动压缩，而不是等到90-100%被动触发。这样可以：

- ✅ 保持对话质量
- ✅ 保留重要上下文
- ✅ 避免紧急截断
- ✅ 提升响应连贯性

### 技术特点

- ✅ **零代码侵入**: 仅修改提示词，不改变执行逻辑
- ✅ **完全兼容**: 不影响现有的被动压缩机制
- ✅ **测试覆盖**: 所有9个单元测试通过
- ✅ **文档完善**: 更新了相关文档说明

### 实际效果验证

需要在真实场景中验证LLM是否能：

1. 在75-85%上下文使用率时主动调用压缩
2. 根据任务阶段（设计→实现→测试）主动压缩
3. 在复杂多步骤任务中主动管理上下文

---

## 📈 后续建议

### 可选优化

1. **降低系统默认阈值** (可选)

    - 当前 `autoCondenseContextPercent` 默认值为 100%
    - 可考虑降至 85-90%，作为更早的保护阈值
    - 文件: `src/core/task/Task.ts`

2. **添加上下文使用率提示** (可选)

    - 在响应中显示当前上下文使用率
    - 帮助LLM更好地判断何时需要压缩

3. **UI可视化增强** (已规划)
    - 在 TaskHeader 中显示子代理调用历史
    - 区分主动调用（🤖）vs 自动压缩（⚡）
    - 参考: `docs/34-subagent-todolist.md` Phase 3

### 监控建议

建议添加以下监控指标：

- 主动压缩触发次数 vs 被动压缩触发次数
- 主动压缩时的平均上下文使用率
- 压缩后的上下文质量评估

---

**完成日期**: 2025-10-16
**改进状态**: ✅ 已完成
**测试状态**: ✅ 所有测试通过
