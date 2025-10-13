# Rust + WASM 迁移范围与优先级确认

**文档版本**: 1.0  
**创建日期**: 2025-10-13  
**基于**: [docs/43-codebase-evaluation-for-rust-wasm-migration.md](./43-codebase-evaluation-for-rust-wasm-migration.md)

---

## 📋 执行摘要

本文档基于详细的代码库评估（文档43），明确定义Rust + WASM重构项目的**迁移范围**和**优先级**，作为项目执行的指导文件。

### 核心决策

✅ **迁移范围**: 核心业务逻辑（~8,000行Rust代码）  
✅ **不迁移**: UI层、VSCode API集成层  
✅ **目标**: 代码复用率 ≥85%，WASM文件大小 <2MB  
✅ **时间**: 20周（5个月）

---

## 🎯 迁移优先级矩阵

### P0 - 关键路径（必须迁移）

#### 1. Task Engine - 任务引擎

**优先级**: P0 (最高)  
**复杂度**: ⭐⭐⭐⭐⭐  
**代码量**: 3,522 行 TypeScript → ~2,500 行 Rust  
**预估工时**: 3-4 周  
**开始时间**: Week 3

**迁移范围**:

- ✅ 任务生命周期管理（7个状态）
- ✅ 消息管理（API消息 + UI消息）
- ✅ 子任务系统
- ✅ 状态机实现
- ✅ 检查点和恢复机制
- ❌ VSCode API调用（通过Host Interface）
- ❌ EventEmitter（使用Rust事件系统）

**关键依赖**:

- Host Interface: 文件系统、UI交互、配置
- 异步运行时: tokio

**成功标准**:

- [ ] 所有7个任务状态正确转换
- [ ] 子任务创建和恢复功能正常
- [ ] 消息历史持久化和恢复
- [ ] 单元测试覆盖率 ≥80%
- [ ] 性能不低于TypeScript版本的80%

---

#### 2. API Integration - API集成层

**优先级**: P0 (最高)  
**复杂度**: ⭐⭐⭐⭐  
**代码量**: 1,500+ 行 TypeScript → ~1,000 行 Rust  
**预估工时**: 2-3 周  
**开始时间**: Week 6（与Task Engine并行）

**迁移范围**:

- ✅ 多提供商抽象（trait ApiProvider）
- ✅ Anthropic Claude集成
- ✅ OpenAI集成
- ✅ Google Gemini集成
- ✅ 流式响应处理
- ✅ Token统计
- ✅ Prompt Caching支持
- ✅ 错误处理和重试逻辑
- ❌ HTTP客户端（通过Host Interface）

**关键依赖**:

- Host Interface: HTTP请求、HTTP流
- Serde: JSON序列化

**成功标准**:

- [ ] 支持至少3个AI提供商（Anthropic, OpenAI, Gemini）
- [ ] 流式响应正确处理
- [ ] Token计数准确
- [ ] 错误重试机制工作正常
- [ ] 单元测试覆盖率 ≥80%

---

#### 3. Tools System - 工具系统

**优先级**: P0 (最高)  
**复杂度**: ⭐⭐⭐⭐  
**代码量**: 2,000+ 行 TypeScript → ~1,500 行 Rust  
**预估工时**: 3 周  
**开始时间**: Week 9

**迁移范围（21个工具）**:

**✅ 必须迁移** (15个核心工具):

1. `listFilesTool` - 列出文件
2. `readFileTool` - 读取文件
3. `writeToFileTool` - 写入文件
4. `applyDiffTool` - 应用差异
5. `multiApplyDiffTool` - 批量差异
6. `searchAndReplaceTool` - 搜索替换
7. `insertContentTool` - 插入内容
8. `searchFilesTool` - 正则搜索
9. `codebaseSearchTool` - 语义搜索
10. `executeCommandTool` - 执行命令
11. `attemptCompletionTool` - 完成任务
12. `askFollowupQuestionTool` - 提问
13. `newTaskTool` - 创建子任务
14. `updateTodoListTool` - 更新TODO
15. `listCodeDefinitionNamesTool` - 代码定义

**⚠️ 可选迁移** (6个高级工具): 16. `browserActionTool` - 浏览器操作 17. `generateImageTool` - 生成图片 18. `accessMcpResourceTool` - MCP资源19. `useMcpToolTool` - MCP工具20. `switchModeTool` - 模式切换 21. `fetchInstructionsTool` - 指令获取

**关键依赖**:

- Host Interface: 文件系统、终端、UI、网络
- Tool Registry: 工具注册和执行框架

**成功标准**:

- [ ] 15个核心工具全部实现
- [ ] 工具注册和调用机制完善
- [ ] 错误处理统一
- [ ] 单元测试覆盖率 ≥80%
- [ ] 工具执行性能 ≥当前版本

---

#### 4. Conversation - 对话管理

**优先级**: P0 (最高)  
**复杂度**: ⭐⭐⭐  
**代码量**: 800 行 TypeScript → ~600 行 Rust  
**预估工时**: 1-2 周  
**开始时间**: Week 5（与API Integration并行）

**迁移范围**:

- ✅ ApiMessage数据结构
- ✅ ClineMessage数据结构
- ✅ ContentBlock枚举（Text, Image, ToolUse, ToolResult）
- ✅ 消息序列化/反序列化
- ✅ 消息历史管理
- ❌ 消息持久化（通过Host Interface）

**关键依赖**:

- Serde: JSON序列化
- Host Interface: 文件读写

**成功标准**:

- [ ] 所有消息类型正确序列化
- [ ] 与TypeScript版本完全兼容
- [ ] 消息转换无损
- [ ] 单元测试覆盖率 ≥90%

---

### P1 - 高优先级（建议迁移）

#### 5. Memory System - 记忆系统

**优先级**: P1 (高)  
**复杂度**: ⭐⭐⭐⭐  
**代码量**: 1,500 行 TypeScript → ~1,000 行 Rust  
**预估工时**: 2 周  
**开始时间**: Week 12

**迁移范围**:

**✅ ConversationMemory** (完全迁移):

- ✅ 记忆提取（正则匹配）
- ✅ 记忆去重（Jaccard相似度）
- ✅ 记忆合并
- ✅ 记忆老化机制
- ✅ 记忆优先级管理
- ✅ 记忆摘要生成

**⚠️ VectorMemoryStore** (部分迁移):

- ✅ 数据结构定义
- ✅ 记忆序列化
- ❌ Qdrant客户端（通过Host Interface）
- ❌ Embedder调用（通过Host Interface）

**关键依赖**:

- regex crate: 正则表达式
- Host Interface: 向量搜索、向量插入
- Serde: 序列化

**成功标准**:

- [ ] 记忆提取准确率 ≥95%
- [ ] 相似度计算正确
- [ ] 记忆老化机制工作
- [ ] 单元测试覆盖率 ≥80%

---

### P2 - 中优先级（可选迁移）

#### 6. Code Indexing - 代码索引

**优先级**: P2 (中)  
**复杂度**: ⭐⭐⭐⭐⭐ (最高)  
**代码量**: 3,000+ 行 TypeScript  
**预估工时**: 2-3 周  
**开始时间**: Week 15（如果时间允许）

**迁移策略**: **最小化迁移**

**✅ 迁移部分**:

- ✅ 索引数据结构
- ✅ 缓存管理逻辑
- ✅ 文件哈希计算

**❌ 保持TypeScript**:

- ❌ Tree-sitter集成（C++ FFI复杂度太高）
- ❌ Embedder多提供商（OpenAI, Ollama, Gemini）
- ❌ Qdrant客户端
- ❌ 文件监控（跨平台复杂）

**理由**:

1. Tree-sitter C++ FFI在WASM中极其复杂
2. 代码索引不在关键路径
3. 保持TypeScript实现不影响跨平台目标
4. 时间和收益比不高

**成功标准**:

- [ ] 核心数据结构可在Rust中使用
- [ ] TypeScript实现保持稳定
- [ ] 通过Host Interface集成（如需要）

---

## 📊 迁移范围总结

### 代码量统计

| 模块            | TypeScript行数 | 预估Rust行数 | 迁移百分比      | 优先级 |
| --------------- | -------------- | ------------ | --------------- | ------ |
| Task Engine     | 3,522          | 2,500        | 100%            | P0     |
| API Integration | 1,500+         | 1,000        | 90%             | P0     |
| Tools System    | 2,000+         | 1,500        | 75% (15/21工具) | P0     |
| Conversation    | 800            | 600          | 100%            | P0     |
| Memory System   | 1,500          | 1,000        | 70%             | P1     |
| Code Indexing   | 3,000+         | 500          | 15%             | P2     |
| **总计**        | **~12,300**    | **~7,100**   | **~58%**        | -      |

### 功能迁移矩阵

| 功能类别     | 迁移到Rust | 保持TypeScript    | 通过Host Interface |
| ------------ | ---------- | ----------------- | ------------------ |
| 任务生命周期 | ✅ 100%    | -                 | 文件I/O, UI        |
| API通信      | ✅ 90%     | -                 | HTTP客户端         |
| 工具执行     | ✅ 75%     | ❌ 25% (高级工具) | 文件/终端/UI       |
| 对话管理     | ✅ 100%    | -                 | 持久化             |
| 记忆管理     | ✅ 70%     | ❌ 30% (向量存储) | 向量DB             |
| 代码索引     | ❌ 15%     | ✅ 85%            | -                  |
| UI层         | -          | ✅ 100%           | -                  |
| VSCode集成   | -          | ✅ 100%           | -                  |

---

## 🎯 目标与指标

### 技术目标

1. **代码复用率**: ≥85%

    - P0模块: 90%
    - P1模块: 70%
    - P2模块: 15%
    - **加权平均**: 87% ✅

2. **WASM文件大小**: <2MB

    - 未优化: ~1.75MB
    - 优化后: ~1.2-1.5MB ✅

3. **性能提升**: 50-200%

    - 纯计算逻辑: +100-200%
    - 包含I/O: +50-100%

4. **测试覆盖率**: ≥80%

    - P0模块: ≥85%
    - P1模块: ≥80%
    - P2模块: ≥70%

5. **构建时间**: <5分钟
    - Rust编译: <3分钟
    - WASM优化: <1分钟
    - TypeScript构建: <1分钟

### 业务目标

1. **跨平台支持**:

    - ✅ VSCode (主要)
    - ✅ Blender (未来)
    - ✅ Unreal Engine (未来)
    - ✅ Unity (未来)

2. **开发效率**:

    - 单一代码库维护
    - 减少平台特定代码
    - 降低维护成本

3. **用户体验**:
    - 性能提升 50%+
    - 响应更快
    - 内存占用更低

---

## ⚠️ 不迁移的范围（明确排除）

### 1. UI层（100%保持TypeScript）

- React组件
- Webview UI
- VSCode侧边栏
- 设置界面

**理由**: React生态系统完善，无迁移必要

### 2. VSCode API集成（100%保持TypeScript）

- Extension activation
- Command registration
- Tree view providers
- Status bar items
- Notifications

**理由**: VSCode API本身就是TypeScript，直接调用最高效

### 3. 开发工具链

- 构建脚本
- 测试框架（vitest）
- Linting工具（ESLint）
- 打包工具（esbuild, vsce）

**理由**: 成熟稳定，无需更改

### 4. 第三方集成

- MCP (Model Context Protocol)
- Browser tools
- 图像生成工具

**理由**: 可选功能，优先级低

---

## 📅 分阶段迁移计划

### 阶段0: 准备（Week 1-2）✅

**目标**: 完成评估和环境搭建

- [x] 代码库详细评估
- [x] 确定迁移范围和优先级
- [ ] 搭建Rust + WASM工具链
- [ ] 创建POC项目
- [ ] 编写技术规范

**交付物**:

- ✅ 评估报告（文档43）
- ✅ 范围确认文档（本文档）
- ⏳ POC项目代码
- ⏳ 技术规范文档

---

### 阶段1: 核心模块（Week 3-12）

#### Phase 1.1: Task Engine + Conversation（Week 3-6）

**优先级**: P0  
**并行开发**: 2个子模块

**Week 3-4**: Task Engine核心

- 状态机实现
- 消息管理
- 基础Host Interface

**Week 5-6**: Conversation + Task Engine集成

- 消息数据结构
- 序列化/反序列化
- 集成测试

**里程碑**: ✅ Task Engine第一版可运行

---

#### Phase 1.2: API Integration（Week 6-9）

**优先级**: P0  
**依赖**: Host Interface网络层

**Week 6-7**: 提供商抽象

- ApiProvider trait
- Anthropic实现
- 流式处理

**Week 8-9**: 多提供商支持

- OpenAI集成
- Gemini集成
- 错误处理和重试

**里程碑**: ✅ AI对话功能完整

---

#### Phase 1.3: Tools System（Week 9-12）

**优先级**: P0  
**依赖**: Task Engine, API Integration

**Week 9-10**: 核心工具（8个）

- 文件操作工具（4个）
- 代码编辑工具（4个）

**Week 11**: 搜索和执行工具（5个）

- 搜索工具（3个）
- 执行工具（1个）
- 交互工具（1个）

**Week 12**: 任务管理工具（2个）

- newTaskTool
- updateTodoListTool
- 集成测试

**里程碑**: ✅ 15个核心工具全部可用

---

### 阶段2: Host Interface + 集成（Week 9-16）

**注意**: 与阶段1部分重叠（并行开发）

#### Phase 2.1: Host Interface完整实现（Week 9-12）

**优先级**: P0  
**并行**: 与Tools System开发

**Week 9-10**: 基础接口

- 文件系统接口（7个）
- 终端接口（3个）
- UI接口（4个）

**Week 11-12**: 高级接口

- 网络接口（2个）
- 配置接口（2个）
- 向量数据库接口（2个）
- 日志和工作区接口（2个）

**里程碑**: ✅ 22个Host Interface函数全部实现

---

#### Phase 2.2: Memory System（Week 12-14）

**优先级**: P1

**Week 12-13**: ConversationMemory

- 记忆提取
- 去重和合并
- 老化机制

**Week 14**: VectorMemoryStore集成

- 数据结构
- Host Interface集成
- 测试

**里程碑**: ✅ 记忆系统基本可用

---

#### Phase 2.3: WASM构建优化（Week 15-16）

**优先级**: P0

**Week 15**: 构建流程

- wasm-pack配置
- 优化编译选项
- 文件大小优化

**Week 16**: 集成测试

- VSCode插件集成
- 端到端测试
- 性能基准测试

**里程碑**: ✅ WASM模块完全集成到VSCode

---

### 阶段3: 测试和文档（Week 17-20）

#### Phase 3.1: 测试补全（Week 17-18）

**目标**: 测试覆盖率 ≥80%

- 单元测试补全
- 集成测试
- 边界条件测试
- 错误处理测试

---

#### Phase 3.2: 性能优化（Week 18-19）

**目标**: 性能提升 ≥50%

- 性能基准测试
- 瓶颈识别
- 优化关键路径
- 内存优化

---

#### Phase 3.3: 文档和验收（Week 19-20）

**交付物**:

- 完整技术文档
- API文档
- 架构文档
- 迁移指南
- 最终验收测试

**验收标准**:

- [ ] `pnpm check-types` 通过
- [ ] `pnpm clean` 成功
- [ ] `pnpm build` 成功
- [ ] `pnpm test` 全部通过
- [ ] `vsce package` 生成.vsix
- [ ] 手动测试通过
- [ ] 性能基准达标
- [ ] WASM文件大小 <2MB

**里程碑**: ✅ 项目完成，可发布

---

## 🎯 成功标准检查清单

### 技术标准

- [ ] **代码复用率 ≥85%**: \_\_\_% 实际达成
- [ ] **WASM文件大小 <2MB**: \_\_\_MB 实际大小
- [ ] **性能提升 ≥50%**: \_\_\_% 实际提升
- [ ] **测试覆盖率 ≥80%**: \_\_\_% 实际覆盖
- [ ] **构建时间 <5分钟**: \_\_\_分钟 实际时间
- [ ] **内存占用 <150MB**: \_\_\_MB 实际占用

### 功能标准

- [ ] **Task Engine**: 所有7个状态正常工作
- [ ] **API Integration**: 至少3个提供商可用
- [ ] **Tools System**: 15个核心工具全部可用
- [ ] **Conversation**: 消息序列化无损
- [ ] **Memory System**: 记忆提取准确率 ≥95%
- [ ] **跨平台**: VSCode集成成功

### 质量标准

- [ ] **无严重bug**: 0个P0 bug
- [ ] **文档完整**: 100%覆盖
- [ ] **代码审查**: 全部通过
- [ ] **安全审计**: 无安全问题
- [ ] **性能基准**: 全部达标

---

## 📊 风险管理矩阵

| 风险类别 | 风险描述         | 优先级 | 缓解措施           | 应急方案     |
| -------- | ---------------- | ------ | ------------------ | ------------ |
| **技术** | WASM文件大小超标 | 🔴 高  | -Oz优化 + wasm-opt | 代码分割     |
| **技术** | 异步性能瓶颈     | 🟡 中  | 批量操作           | 降低调用频率 |
| **技术** | Tree-sitter集成  | 🔴 高  | 保持TypeScript     | 降级P2优先级 |
| **项目** | 时间延长         | 🟡 中  | 分阶段交付         | 调整范围     |
| **项目** | 测试覆盖不足     | 🟡 中  | 测试驱动开发       | 延长测试阶段 |
| **业务** | 向后兼容性       | 🟢 低  | 稳定Host Interface | 保留旧代码   |

---

## 📝 决策记录

### ADR-001: Code Indexing保持TypeScript

**日期**: 2025-10-13  
**状态**: 已接受  
**决策**: Code Indexing模块保持TypeScript实现

**理由**:

1. Tree-sitter C++ FFI在WASM中极其复杂（4-5周开发时间）
2. 不在关键路径，不影响跨平台核心目标
3. TypeScript实现已经稳定
4. 投资回报率低

**影响**:

- 代码复用率从预期95%降至87%（仍超过85%目标）
- 节省3-4周开发时间
- 降低技术风险

---

### ADR-002: 高级工具（6个）可选迁移

**日期**: 2025-10-13  
**状态**: 已接受  
**决策**: browserActionTool等6个高级工具为可选迁移

**理由**:

1. 不在核心业务流程中
2. 使用频率低
3. 可在后续版本迁移

**影响**:

- 工具迁移率从100%降至71% (15/21)
- 节省1-2周开发时间
- 不影响核心功能

---

### ADR-003: Memory System分阶段迁移

**日期**: 2025-10-13  
**状态**: 已接受  
**决策**: ConversationMemory完全迁移，VectorMemoryStore部分迁移

**理由**:

1. ConversationMemory逻辑清晰，易于迁移
2. VectorMemoryStore依赖Qdrant客户端（复杂）
3. 通过Host Interface可实现向量存储功能

**影响**:

- Memory System迁移率70%
- 保持功能完整性
- 降低技术复杂度

---

## 🚀 下一步行动

### 立即行动（本周）

1. **完成文档审查** ✅

    - [x] 评估报告（文档43）
    - [x] 范围确认文档（本文档）

2. **搭建Rust工具链** ⏳

    - [ ] 安装Rust（rustup）
    - [ ] 安装wasm-pack
    - [ ] 配置VSCode Rust插件
    - [ ] 验证工具链完整性

3. **创建POC项目** ⏳
    - [ ] 创建最小化Rust+WASM项目
    - [ ] 实现Host Interface原型
    - [ ] 测试WASM<->TypeScript通信
    - [ ] 性能基准测试

### Week 2任务

4. **编写技术规范**

    - [ ] Host Interface完整定义
    - [ ] Rust代码风格指南
    - [ ] WASM构建流程文档
    - [ ] 错误处理规范

5. **团队准备**
    - [ ] 技术分享会
    - [ ] 代码审查流程
    - [ ] 开发环境统一

---

## 📚 参考文档

### 项目文档

1. [docs/42-rust-wasm-refactoring-master-plan.md](./42-rust-wasm-refactoring-master-plan.md) - 总体计划
2. [docs/43-codebase-evaluation-for-rust-wasm-migration.md](./43-codebase-evaluation-for-rust-wasm-migration.md) - 代码库评估
3. [docs/30-cross-platform-plugin-migration-evaluation.md](./30-cross-platform-plugin-migration-evaluation.md) - 跨平台评估
4. [docs/31-cross-platform-migration-detailed-task-plan.md](./31-cross-platform-migration-detailed-task-plan.md) - 详细任务计划

### 技术文档

1. [Rust WASM Book](https://rustwasm.github.io/docs/book/)
2. [wasm-bindgen Guide](https://rustwasm.github.io/docs/wasm-bindgen/)
3. [Tokio Documentation](https://tokio.rs/)
4. [Serde Documentation](https://serde.rs/)

---

## 📊 项目度量指标

### 开发进度跟踪

| 阶段    | 计划周     | 实际周 | 状态   | 完成度 |
| ------- | ---------- | ------ | ------ | ------ |
| 阶段0   | Week 1-2   | -      | 进行中 | 50%    |
| 阶段1.1 | Week 3-6   | -      | 未开始 | 0%     |
| 阶段1.2 | Week 6-9   | -      | 未开始 | 0%     |
| 阶段1.3 | Week 9-12  | -      | 未开始 | 0%     |
| 阶段2.1 | Week 9-12  | -      | 未开始 | 0%     |
| 阶段2.2 | Week 12-14 | -      | 未开始 | 0%     |
| 阶段2.3 | Week 15-16 | -      | 未开始 | 0%     |
| 阶段3   | Week 17-20 | -      | 未开始 | 0%     |

### 代码统计

| 指标         | 目标     | 当前 | 达成率 |
| ------------ | -------- | ---- | ------ |
| Rust代码量   | ~7,100行 | 0行  | 0%     |
| 测试代码量   | ~4,000行 | 0行  | 0%     |
| 测试覆盖率   | ≥80%     | 0%   | 0%     |
| WASM文件大小 | <2MB     | -    | -      |
| 代码复用率   | ≥85%     | -    | -      |

### 质量指标

| 指标           | 目标 | 当前 | 状态 |
| -------------- | ---- | ---- | ---- |
| P0 Bug数量     | 0    | 0    | ✅   |
| P1 Bug数量     | <5   | 0    | ✅   |
| 代码审查通过率 | 100% | -    | -    |
| 性能基准达标率 | 100% | -    | -    |

---

## ✅ 批准与签署

### 技术评审

- **评审人**: ******\_******
- **日期**: ******\_******
- **评审意见**: ******\_******
- **签名**: ******\_******

### 项目批准

- **批准人**: ******\_******
- **日期**: ******\_******
- **批准意见**: ******\_******
- **签名**: ******\_******

---

**文档版本**: 1.0  
**最后更新**: 2025-10-13  
**下次审查**: Week 2结束（完成POC后）

---

## 附录A: 模块依赖关系图

```
┌─────────────────────────────────────────────────┐
│           Host Interface (22 functions)         │
│  FileSystem│Terminal│UI│Network│Config│Vector  │
└────────────┬────────────────────────────────────┘
             │
     ┌───────┴────────┐
     │                │
┌────▼─────┐    ┌────▼─────┐
│  Task    │    │   API    │
│  Engine  │◄───│Integration│
└────┬─────┘    └──────────┘
     │
┌────▼─────┐    ┌──────────┐
│  Tools   │    │Conversation│
│  System  │◄───│            │
└────┬─────┘    └──────────┘
     │
┌────▼─────┐
│  Memory  │
│  System  │
└──────────┘
```

## 附录B: 关键路径分析

**关键路径**: Task Engine → API Integration → Tools System

- Task Engine: 4周
- API Integration: 3周（部分并行）
- Tools System: 3周
- **总计**: 10周（考虑并行）

**非关键路径**:

- Conversation: 2周（可并行）
- Memory System: 2周（后期）
- Code Indexing: 可选（P2）

---

**文档结束**
