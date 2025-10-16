# 子代理主动调用 - 调试日志部署总结

**文档编号**: 38  
**创建日期**: 2025-10-16  
**状态**: 调试日志已部署，等待用户测试  
**关联文档**:

- [34-subagent-improvement-plan.md](./34-subagent-improvement-plan.md)
- [34-subagent-todolist.md](./34-subagent-todolist.md)
- [37-subagent-active-invocation-diagnosis.md](./37-subagent-active-invocation-diagnosis.md)

---

## 📋 问题背景

根据之前的测试反馈，虽然子代理主动调用的代码已经实现并且单元测试全部通过，但在实际使用中功能未能生效。为了诊断问题，我们需要添加详细的运行时日志。

---

## ✅ 已部署的调试日志

### 1. presentAssistantMessage.ts 检测入口日志

**文件**: `src/core/assistant-message/presentAssistantMessage.ts`  
**位置**: 第156-211行  
**功能**: 在文本块处理时记录检测过程

**日志内容**:

```typescript
console.log("[SubAgent Detection] Checking text block for subagent intent...")
console.log("[SubAgent Detection] Block type:", block.type)
console.log("[SubAgent Detection] Block partial:", block.partial)
console.log("[SubAgent Detection] Content length:", content.length)
console.log("[SubAgent Detection] Content preview:", content.substring(0, 200))
console.log("[SubAgent Detection] Detection result:", detectedAgent || "null (no match)")
```

**关键检查点**:

- ✅ 确认文本块是否被处理
- ✅ 确认检测是否被调用
- ✅ 显示输入文本的内容预览
- ✅ 显示检测结果

### 2. Task.ts detectSubAgentIntent() 详细匹配日志

**文件**: `src/core/task/Task.ts`  
**位置**: 第3681-3767行  
**功能**: 记录详细的正则表达式匹配过程

**日志内容**:

```typescript
console.log("[SubAgent detectSubAgentIntent] ===== Starting detection =====")
console.log("[SubAgent detectSubAgentIntent] Input text length:", text.length)
console.log("[SubAgent detectSubAgentIntent] Input text preview:", text.substring(0, 300))
console.log(`[SubAgent detectSubAgentIntent] Testing agent: ${agent}`)
console.log(`[SubAgent detectSubAgentIntent]   explicitPattern match: ${explicitMatch}`)
console.log(`[SubAgent detectSubAgentIntent]   actionPattern match: ${actionMatch}`)
console.log(`[SubAgent detectSubAgentIntent]   contextPattern match: ${contextMatch}`)
console.log(`[SubAgent detectSubAgentIntent]   ✓ Pattern matched for ${agent}!`)
console.log(`[SubAgent detectSubAgentIntent]   isDescription: ${isDescription}`)
console.log(`[SubAgent detectSubAgentIntent] ===== Detection SUCCESS: ${agent} =====`)
console.log("[SubAgent detectSubAgentIntent] ===== Detection FAILED: no match =====")
```

**关键检查点**:

- ✅ 显示输入文本的长度和内容
- ✅ 对每个子代理测试所有匹配模式
- ✅ 显示三种正则表达式的匹配结果
- ✅ 显示描述性过滤结果
- ✅ 明确标识成功或失败

### 3. 用户可见的执行反馈

**文件**: `src/core/assistant-message/presentAssistantMessage.ts`  
**位置**: 第164-206行  
**功能**: 在UI中显示子代理执行状态

**消息格式**:

```typescript
// 检测到意图
🤖 **Detected subagent invocation intent: ${agentName}**
Automatically executing subagent...

// 执行成功
✅ **SubAgent ${agentName} execution completed successfully**
**Summary**: ${result.summary}
**Tokens**: In: ${result.tokensIn}, Out: ${result.tokensOut}
**Cost**: $${result.cost.toFixed(6)}

// 执行失败
❌ **SubAgent ${agentName} execution failed**
```

---

## 🔍 诊断策略

### 日志分析流程

当用户运行测试时，按以下顺序检查日志：

#### 步骤 1: 检查文本块是否被处理

**查找**: `[SubAgent Detection] Checking text block`

**预期**: 每个完整的文本块都应该触发一次检测

**如果没有日志**:

- 问题：`presentAssistantMessage` 可能未被调用
- 可能原因：流式处理逻辑问题

#### 步骤 2: 检查检测是否被调用

**查找**: `[SubAgent detectSubAgentIntent] ===== Starting detection =====`

**预期**: 每次文本块检测都应该调用此方法

**如果没有日志**:

- 问题：检测方法未被调用
- 可能原因：`!block.partial && content` 条件判断问题

#### 步骤 3: 检查输入文本内容

**查找**: `[SubAgent detectSubAgentIntent] Input text preview:`

**关键检查**:

- 文本是否包含子代理名称？
- 文本格式是否符合预期？
- 是否有意外的格式化或编码问题？

#### 步骤 4: 检查正则表达式匹配

**查找**: `explicitPattern match:`, `actionPattern match:`, `contextPattern match:`

**预期**: 至少一个模式应该匹配为 `true`

**如果都是 false**:

- 问题：正则表达式未能匹配大模型输出
- 可能原因：
    1. 大模型没有按预期提及子代理名称
    2. 正则表达式模式需要进一步优化
    3. 文本格式与预期不符

#### 步骤 5: 检查描述性过滤

**查找**: `isDescription:`

**预期**: 应该是 `false`（不是描述性文本）

**如果是 true**:

- 问题：被错误地识别为描述性文本
- 需要：调整描述性过滤规则

#### 步骤 6: 检查最终结果

**查找**: `Detection SUCCESS` 或 `Detection FAILED`

**预期**: 看到 `SUCCESS` 和对应的子代理名称

---

## 🎯 可能的问题场景

### 场景 A: 大模型未提及子代理名称

**症状**:

```
[SubAgent Detection] Detection result: null (no match)
[SubAgent detectSubAgentIntent] ===== Detection FAILED: no match =====
```

**原因**: SYSTEM_PROMPT 引导不够强

**解决方案**:

1. 检查 `src/core/prompts/sections/subagents.ts` 的提示词
2. 考虑添加更强制性的指令
3. 在示例中更明确地展示子代理调用语法

### 场景 B: 正则表达式未匹配

**症状**:

```
[SubAgent detectSubAgentIntent]   explicitPattern match: false
[SubAgent detectSubAgentIntent]   actionPattern match: false
[SubAgent detectSubAgentIntent]   contextPattern match: false
```

**原因**: 大模型使用了不同的表达方式

**解决方案**:

1. 从日志中提取实际的文本内容
2. 分析大模型的表达模式
3. 添加新的匹配模式或调整现有正则表达式

### 场景 C: 检测被跳过

**症状**: 没有 `[SubAgent Detection]` 日志

**原因**: `!block.partial && content` 条件不满足

**解决方案**:

1. 检查流式传输的块状态
2. 可能需要调整检测时机
3. 考虑在 `partial=false` 完成时也进行检测

### 场景 D: 执行失败

**症状**: 检测成功但执行失败

**原因**: SubAgentExecutor 内部错误

**解决方案**:

1. 检查 API 配置
2. 检查子代理提示词配置
3. 查看执行过程中的具体错误信息

---

## 📝 下一步行动

### 用户需要做的事

1. **重新编译项目**:

    ```bash
    cd /home/sonygod/projects/Roo-Code
    pnpm install
    pnpm compile
    ```

2. **打开浏览器开发者工具**:

    - 在 VSCode 中按 `F12` 或 `Ctrl+Shift+I`
    - 切换到 Console 标签页
    - 清空现有日志

3. **运行测试场景**:

    - 创建一个新任务，要求执行复杂操作
    - 示例：`"用zig和rust分别写一段代码"`
    - 观察控制台日志输出

4. **收集完整日志**:
    - 复制所有包含 `[SubAgent` 前缀的日志
    - 特别注意检测和匹配相关的日志
    - 提供给开发者进行分析

### 开发者需要做的事

1. **分析日志输出**:

    - 确定检测流程是否被正确执行
    - 识别具体的失败点
    - 提取大模型的实际输出文本

2. **根据日志调整代码**:

    - 如果是正则表达式问题：优化匹配模式
    - 如果是提示词问题：增强 SYSTEM_PROMPT
    - 如果是集成问题：调整检测时机

3. **迭代测试**:
    - 修复问题后重新部署日志
    - 继续收集用户反馈
    - 直到功能正常工作

---

## 📊 成功标准

功能正常工作时，应该看到以下完整的日志流程：

```
[SubAgent Detection] Checking text block for subagent intent...
[SubAgent Detection] Content preview: I need to use condense-context-analyzer...
[SubAgent Detection] Detection result: condense-context-analyzer

[SubAgent detectSubAgentIntent] ===== Starting detection =====
[SubAgent detectSubAgentIntent] Input text preview: I need to use condense-context-analyzer...
[SubAgent detectSubAgentIntent] Testing agent: condense-context-analyzer
[SubAgent detectSubAgentIntent]   explicitPattern match: true
[SubAgent detectSubAgentIntent]   actionPattern match: true
[SubAgent detectSubAgentIntent]   contextPattern match: false
[SubAgent detectSubAgentIntent]   ✓ Pattern matched for condense-context-analyzer!
[SubAgent detectSubAgentIntent]   isDescription: false
[SubAgent detectSubAgentIntent] ===== Detection SUCCESS: condense-context-analyzer =====
```

同时，用户界面应该显示：

```
🤖 Detected subagent invocation intent: condense-context-analyzer
Automatically executing subagent...

✅ SubAgent condense-context-analyzer execution completed successfully
Summary: [压缩结果摘要]
Tokens: In: 1234, Out: 567
Cost: $0.012345
```

---

## 🔗 相关资源

- **实现文档**: [34-subagent-improvement-plan.md](./34-subagent-improvement-plan.md)
- **任务清单**: [34-subagent-todolist.md](./34-subagent-todolist.md)
- **诊断报告**: [37-subagent-active-invocation-diagnosis.md](./37-subagent-active-invocation-diagnosis.md)
- **单元测试**: `src/core/task/__tests__/Task.subagent-intent.test.ts`
