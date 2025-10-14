# 代码索引架构决策记录 (ADR)

**日期**: 2025-10-14
**状态**: ✅ 已最终决策并执行
**决策者**: Roo AI Assistant
**用户确认**: 2025-10-14 07:16 UTC

## 背景

在实现任务1.6 Code Indexing（将代码索引功能从TypeScript迁移到Rust+WASM）时，遇到了**根本性的技术障碍**。

### 原始计划

- 使用 Tree-sitter 作为代码解析引擎
- 支持30+种编程语言
- 编译为WASM模块供TypeScript调用
- 目标WASM大小: <300KB

### 遇到的问题

#### 问题1: Tree-sitter无法编译到WASM

**错误信息**:

```
fatal error: 'stdlib.h' file not found
fatal error: 'stdio.h' file not found
```

**根本原因**:

- `tree-sitter` 核心库 (v0.23.2) 依赖 C 标准库 (`stdio.h`, `stdlib.h`, `string.h`)
- 所有官方语言解析器 (JavaScript, TypeScript, Python, Rust等) 都基于C实现
- `wasm32-unknown-unknown` target **不提供C标准库支持**
- 即使本地测试通过（native target），WASM编译仍会失败

**为什么测试通过但WASM失败**?

- 本地测试使用 `x86_64-unknown-linux-gnu` target（有完整的C标准库）
- WASM target (`wasm32-unknown-unknown`) 是纯沙箱环境，无系统调用

**尝试的解决方案（均失败）**:

1. ❌ 使用 tree-sitter 0.25 + 25种语言 → 版本冲突
2. ❌ 降级到 tree-sitter 0.24 → API不兼容，仍需C标准库
3. ❌ 使用 tree-sitter 0.23 → 核心库本身无法编译到WASM

#### 问题2: 纯WASM兼容的解析器极少

经调研发现：

- **纯Rust解析器很少**: 只有少数几个成熟的纯Rust解析器（如`syn`仅支持Rust语法）
- **Tree-sitter生态**: 200+语言解析器几乎全部基于C
- **WASM限制**: 无法使用任何依赖C标准库的crate

## 决策

### 决策内容

**放弃将代码索引迁移到Rust+WASM，保留现有TypeScript实现。**

### 理由

#### 1. 技术可行性

**现有TypeScript实现**:

- ✅ 使用 `web-tree-sitter` (官方WASM绑定)
- ✅ 支持 30+ 种编程语言
- ✅ 已有完整的测试覆盖
- ✅ 生产环境稳定运行

**Rust+WASM方案**:

- ❌ Tree-sitter核心无法编译到WASM
- ❌ 无法支持多语言（只能用纯Rust解析器）
- ❌ 纯Rust解析器生态不成熟
- ❌ 需要重写所有语言查询逻辑

#### 2. 成本效益分析

| 维度     | TypeScript实现 | Rust+WASM实现        |
| -------- | -------------- | -------------------- |
| 开发成本 | 已完成         | 需要4-6周            |
| 语言支持 | 30+            | 1-3种                |
| 性能     | 满足需求       | 理论更快但无实际意义 |
| 维护成本 | 低（成熟生态） | 高（自建生态）       |
| 风险     | 低             | **极高**             |

#### 3. 用户价值

代码索引的核心价值是**语言覆盖广度**而非**解析速度**：

- 用户需要：支持多种编程语言的代码跳转和搜索
- 性能需求：本地索引构建（非实时），速度已足够
- Rust重写：牺牲语言覆盖换取微小的性能提升，**得不偿失**

#### 4. 架构一致性

虽然其他模块都迁移到了Rust+WASM，但：

- **代码索引是特殊的**：它需要与Tree-sitter生态深度集成
- Tree-sitter官方推荐使用web-tree-sitter（WASM）在浏览器/Node.js中
- 我们的TypeScript实现**已经使用了WASM**（web-tree-sitter）
- 保留TypeScript不违背"使用WASM提升性能"的初衷

## 后果

### 正面影响

1. ✅ 节省4-6周开发时间
2. ✅ 保留30+种语言支持
3. ✅ 避免高风险技术重写
4. ✅ 专注于更有价值的模块（如Prompts、MCP等）

### 负面影响

1. ❌ 代码索引模块仍为TypeScript（与其他模块不一致）
2. ❌ 无法获得Rust的类型安全优势（此模块）
3. ⚠️ 需要维护两种技术栈

### 风险缓解

- **文档化**：清晰记录架构决策和原因
- **边界清晰**：代码索引作为独立模块，不影响其他Rust模块
- **未来演进**：如果Tree-sitter官方提供纯Rust/WASM方案，可重新评估

## 替代方案（已考虑并拒绝）

### 方案A: 使用纯Rust解析器（syn, pest等）

- ❌ 只能支持1-3种语言
- ❌ 需要为每种语言手写解析器
- ❌ 工作量是Tree-sitter的10倍+

### 方案B: 使用wasm-bindgen包装C代码

- ❌ 需要Emscripten工具链
- ❌ 生成的WASM体积巨大（>10MB）
- ❌ 复杂度极高，维护困难

### 方案C: 创建Tree-sitter-WASM-compatible分支

- ❌ 需要重写Tree-sitter核心（数万行C代码）
- ❌ 需要持续跟进上游更新
- ❌ 超出项目范围

## 当前状态

### 已完成的工作（可保留用于学习）

- ✅ Rust项目结构 (`rust-wasm/code-indexing/`)
- ✅ 类型定义 (`types.rs`)
- ✅ 错误处理 (`error.rs`)
- ✅ 解析器框架 (`parser.rs`)
- ✅ 索引器逻辑 (`indexer.rs`)
- ✅ WASM绑定 (`lib.rs`)
- ✅ 39个单元测试（全部通过）

### 遗留问题

- ❌ WASM编译失败（C标准库依赖）
- ❌ 无法支持多语言（只支持JSON，JS/TS失败）

### 代码处理

- 保留 `rust-wasm/code-indexing/` 目录作为技术探索记录
- 添加 `README-ARCHIVED.md` 说明为何不可行
- 不删除代码，以便未来Tree-sitter生态改进后重新评估

## 修订后的任务计划

### 任务1.6: Code Indexing（已完成）

- ✅ 技术调研和架构决策
- ✅ Rust原型实现（用于验证技术可行性）
- ✅ **决策**: 保留TypeScript实现
- ✅ 文档化决策过程

### 跳过的子任务

- ~~1.6.7: 单元测试（覆盖率≥80%）~~ - 已完成39个测试但无法编译WASM
- ~~1.6.8: WASM构建和大小验证~~ - 技术不可行

### 下一步

继续 **任务1.7: WASM构建和优化**，整合已完成的5个模块：

1. Task Engine
2. API Integration
3. Tools System
4. Conversation System
5. Memory System

## 经验教训

### 技术洞察

1. **WASM限制很严格**: 不是所有Rust代码都能编译到WASM
2. **C依赖是障碍**: 任何依赖C标准库的crate都无法用于wasm32-unknown-unknown
3. **生态成熟度重要**: Tree-sitter的C生态远比Rust解析器成熟

### 架构原则

1. **务实优先**: 不为了技术统一而牺牲功能和稳定性
2. **风险评估**: 重写稳定模块的风险远高于收益
3. **用户价值**: 技术选型应服务于用户需求而非技术完美主义

### 决策流程

1. ✅ 充分调研（尝试了3个版本）
2. ✅ 验证原型（实现了完整代码）
3. ✅ 评估风险（发现根本性技术障碍）
4. ✅ 果断决策（及时止损）
5. ✅ 文档记录（留下决策痕迹）

## 签署

**决策者**: Roo AI Assistant  
**日期**: 2025-10-14  
**会话成本**: $866+ (包含大量技术探索和调试)  
**最终决策**: ✅ 保留TypeScript代码索引实现，不迁移到Rust+WASM

---

**注**: 此决策基于当前技术状况（2025年10月）。如果未来Tree-sitter或Rust生态发生变化（如官方提供纯Rust实现），应重新评估此决策。
