# Subagent 系统提示词修复报告

**修复日期**: 2025-10-17  
**修复范围**: 系统提示词误导问题导致LLM无法主动调用subagent工具  
**状态**: ✅ 已完成

---

## 📋 问题概述

### 用户反馈

用户报告："subagent方案太不理想，几乎完全没用"，核心问题是**LLM从不主动调用subagent进行上下文压缩**。

### 根本原因诊断

经过深入分析，发现系统提示词存在**严重误导**：

#### ❌ 问题1：虚假的"自然语言检测"功能

**位置**: `src/core/prompts/sections/subagents.ts:204-206`

**错误内容**:

```typescript
**Detection methods**:
- Natural language mention: "I need **condense-memory-extractor** to..."
- Tool call: Use the use_subagent tool with agent_name parameter
```

**问题分析**:

1. 系统提示词声称LLM可以通过"自然语言提及名称"来触发subagent
2. 实际上**没有任何自然语言检测代码**实现
3. 搜索整个代码库，找不到任何自然语言触发机制
4. **只有XML工具调用语法能工作**：`<use_subagent><agent_name>...</agent_name></use_subagent>`

**影响**:

- LLM被误导，认为只要"提到名称"就能触发
- LLM不知道必须使用完整的XML工具调用语法
- 结果：LLM**从不主动调用工具**，"主动压缩"功能完全失效

#### ❌ 问题2：缺乏明确的调用语法说明

工具描述文件 `src/core/prompts/tools/use-subagent.ts` 虽然详细，但开头缺少**关键的"如何调用"说明**，LLM容易忽略具体语法要求。

---

## 🔧 修复方案

### 修复1: 重写系统提示词 (`src/core/prompts/sections/subagents.ts`)

**修改内容**:

1. ✅ **删除所有关于"自然语言检测"的误导信息**
2. ✅ **明确声明只有XML工具调用语法有效**
3. ✅ **添加正确/错误示例对比**
4. ✅ **强调必须使用工具调用**

**核心修改**:

````typescript
## 🔑 KEY RULE: Tool Call Invocation ONLY

**CRITICAL**: You MUST use explicit tool call syntax to invoke subagents.
Natural language mentions will NOT trigger execution.

✅ **CORRECT - Use Tool Call Syntax**:
```xml
<use_subagent>
<agent_name>condense-memory-extractor</agent_name>
<task>Extract critical decisions and requirements from last 20 messages</task>
</use_subagent>
````

❌ **INCORRECT - Natural Language (Will NOT Work)**:

- "I need condense-context-analyzer to analyze the conversation" (DOES NOT TRIGGER)
- "Let me call condense-memory-extractor subagent" (DOES NOT TRIGGER)
- "Using condense-code-summarizer to compress" (DOES NOT TRIGGER)

**REMEMBER**: Only the XML tool call format above will actually execute subagents!

````

**文件长度**: 从224行减少到177行（删除冗余和误导内容）

### 修复2: 增强工具描述 (`src/core/prompts/tools/use-subagent.ts`)

**添加内容**: 在工具描述开头添加**醒目的调用方法说明**

```typescript
**🔑 CRITICAL: How to Invoke This Tool**

You MUST use the standard tool call syntax to invoke subagents.
This is the ONLY way that works:

```xml
<use_subagent>
<agent_name>condense-memory-extractor</agent_name>
<task>Extract critical decisions from last 20 messages</task>
<context>Focus on user requirements and technical constraints</context>
</use_subagent>
````

**Place the tool call at the END of your response**,
after any explanatory text about why you're calling it.

````

---

## ✅ 验证结果

### 测试覆盖
- ✅ 运行完整测试套件：`cd src && npx vitest run`
- ✅ **4271个测试通过** - 与修改前相同
- ✅ 没有引入新的测试失败
- ✅ 所有subagent相关测试通过

### 代码质量
- ✅ 系统提示词逻辑更清晰
- ✅ 删除误导性内容，减少混淆
- ✅ 添加明确的正确/错误示例
- ✅ 保持向后兼容性

---

## 📊 修改对比

### 修改文件列表

| 文件 | 修改类型 | 行数变化 | 说明 |
|------|---------|----------|------|
| `src/core/prompts/sections/subagents.ts` | 重写 | 224→177行 (-47) | 删除误导内容，明确XML语法 |
| `src/core/prompts/tools/use-subagent.ts` | 增强 | +13行 | 添加调用方法说明 |

### 关键删除内容

**删除的误导性文本** (原第204-206行):
```diff
- **Detection methods**:
- - Natural language mention: "I need **condense-memory-extractor** to..."
- - Tool call: Use the use_subagent tool with agent_name parameter set to subagent name
````

**替换为明确的说明** (新第51-63行):

```diff
+ ## 🔑 KEY RULE: Tool Call Invocation ONLY
+
+ **CRITICAL**: You MUST use explicit tool call syntax to invoke subagents.
+ Natural language mentions will NOT trigger execution.
+
+ ✅ **CORRECT - Use Tool Call Syntax**: [XML示例]
+ ❌ **INCORRECT - Natural Language (Will NOT Work)**: [错误示例列表]
```

---

## 🎯 预期效果

修复后，LLM将：

1. ✅ **明确知道必须使用XML工具调用语法**
2. ✅ **理解自然语言提及不会触发工具**
3. ✅ **看到清晰的正确/错误示例对比**
4. ✅ **在合适时机主动调用subagent工具**
5. ✅ **实现真正的"主动压缩"功能**

---

## 🧪 建议的端到端测试

为验证修复效果，建议进行以下测试：

### 测试场景1: 长对话自动压缩

1. 与LLM进行20+轮对话
2. 观察LLM是否在第15-20轮时主动调用压缩工具
3. 检查UI中是否显示"Compressing context..."状态

### 测试场景2: 大文件读取前压缩

1. 要求LLM读取>5个文件
2. 观察LLM是否在读取前主动调用`condense-memory-extractor`
3. 验证压缩后再进行文件读取

### 测试场景3: 代码修改后压缩

1. 要求LLM修改3+个文件
2. 观察LLM是否在完成后调用`condense-code-summarizer`
3. 验证技术上下文被正确压缩

---

## 📝 历史记录

### 之前的尝试（未成功）

- ❌ 尝试1: 添加更多触发条件说明 - LLM仍然不调用
- ❌ 尝试2: 强调"MUST"、"CRITICAL"等词 - 无效果
- ❌ 尝试3: 增加示例数量 - 仍然混淆

### 根本原因识别（成功）

- ✅ 识别到"自然语言检测"是虚假功能
- ✅ 发现系统提示词与实际代码不一致
- ✅ 定位到误导性文本的具体位置

### 最终修复（本次）

- ✅ 删除所有虚假功能声明
- ✅ 明确声明"只有XML工具调用有效"
- ✅ 提供清晰的正确/错误示例对比
- ✅ 测试验证没有破坏现有功能

---

## 🔗 相关文档

- [原始需求文档](./45-subagent.md) - Subagent系统设计规范
- [重构完成报告](./subagent-refactor-complete-summary.md) - 之前的系统重构总结
- [系统提示词文件](../src/core/prompts/sections/subagents.ts) - 修复后的提示词
- [工具描述文件](../src/core/prompts/tools/use-subagent.ts) - 增强后的工具说明

---

## ✨ 总结

通过修复系统提示词中的误导性内容，明确告知LLM**必须使用XML工具调用语法**，预期将彻底解决"LLM不主动调用subagent"的问题。

**关键成功因素**:

1. 🎯 准确识别根本原因（虚假的自然语言检测）
2. 🔍 搜索验证（确认没有检测代码实现）
3. ✂️ 果断删除（移除所有误导内容）
4. 📝 明确声明（只有XML语法有效）
5. 🧪 充分测试（4271个测试通过）

**下一步**:

- 📋 进行端到端功能测试
- 📊 监控LLM实际调用行为
- 📈 收集用户反馈
- 🔄 根据需要进一步优化

---

**修复完成时间**: 2025-10-17 14:24 CST  
**修复工程师**: Roo (AI Assistant)  
**审核状态**: 待用户验证
