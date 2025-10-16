# Rust WASM 迁移 - 主执行计划

**创建时间**: 2025-10-15  
**项目目标**: 将Roo-Code VSCode插件的所有非UI逻辑用Rust重写并编译为WASM  
**用户核心要求**: "任务完成得标准是全部完成，不是一个小步骤完成就完成任务"

---

## 📊 项目整体状态

### ✅ Phase 1: Rust WASM核心实现（已完成）

| 模块            | 状态   | 代码量       | 测试      | WASM大小   |
| --------------- | ------ | ------------ | --------- | ---------- |
| Task Engine     | ✅     | ~1,200行     | 20个      | 部分统计   |
| API Integration | ✅     | 1,894行      | 23个      | 18KB       |
| Tools System    | ✅     | 1,150行      | 36个      | 95KB       |
| Conversation    | ✅     | 1,527行      | 38个      | 374KB      |
| Memory System   | ✅     | ~1,350行     | 16个      | 977KB      |
| **总计**        | **✅** | **~7,121行** | **133个** | **~1.5MB** |

**关键成果**:

- ✅ 5个Rust模块全部实现
- ✅ WASM编译成功（rust-wasm/wasm-dist/）
- ✅ 133+个Rust单元测试通过
- ✅ WASM文件：`roo_core_wasm_bg.wasm`（1.1MB，已优化56%）

---

### ✅ Phase 2.1: Task System集成（已完成）

#### 2.1.1: Host Interface桥接层 ✅

- ✅ 35个测试通过
- ✅ TypeScript ↔ Rust FFI通信验证
- ✅ 文件系统、终端、UI、网络回调实现

#### 2.1.2: TaskAdapter实现 ✅

- ✅ 28/28测试通过
- ✅ WASM初始化、生命周期管理
- ✅ 错误处理与重试机制（默认3次）
- ✅ 自动fallback（WASM失败→TypeScript）

#### 2.1.3: Task.ts深度集成 ✅

- ✅ 24/24 WASM集成测试通过
- ✅ TaskOptions扩展（enableWasm, wasmRetryCount等）
- ✅ 生命周期方法集成（start/resume/abort/dispose）
- ✅ 自动状态同步
- ✅ TypeScript类型检查通过
- ✅ Git提交完成

**文档**:

- docs/65-task-adapter-implementation-summary.md
- docs/66-task-ts-integration-plan.md
- docs/67-task-ts-wasm-lifecycle-integration.md
- docs/71-task-integration-verification-summary.md

---

### 🔄 Phase 2.2: Tools System集成（当前阶段）

#### 待完成任务

**2.2.1: ToolsAdapter实现** 🚧

- [ ] 创建ToolsAdapter类（参考TaskAdapter模式）
- [ ] 实现工具注册与管理
- [ ] 实现工具调用WASM桥接
- [ ] 实现工具参数验证
- [ ] **强制要求：使用safeWriteJson进行JSON写入**
- [ ] 实现错误处理与重试
- [ ] 单元测试（覆盖率≥80%）

**关键工具类型**（21个工具需要集成）:

- 读取类：readFile, listFiles, searchFiles, codebaseSearch
- 编辑类：writeToFile, applyDiff, insertContent, searchAndReplace
- 命令类：executeCommand
- 浏览器类：browserAction
- MCP类：accessMcpResource
- 模式类：switchMode, newTask
- 询问类：askFollowupQuestion
- 完成类：attemptCompletion
- 图片类：generateImage
- 其他：listCodeDefinitionNames, fetchInstructions, updateTodoList, multiApplyDiff

**2.2.2: 工具调用主流程集成** 📋

- [ ] 识别工具调用入口点（Task.ts中）
- [ ] 集成ToolsAdapter到工具执行流程
- [ ] 实现WASM/TypeScript混合执行
- [ ] 性能监控和日志

**2.2.3: Tools单元测试和验证** 📋

- [ ] 创建ToolsAdapter.test.ts（独立测试文件）
- [ ] 工具注册测试
- [ ] 工具调用测试
- [ ] 参数验证测试
- [ ] 错误处理测试
- [ ] 性能基准测试

**预估时间**: 1-2天

---

### 📋 Phase 2.3: API System集成（待开始）

#### 待完成任务

**2.3.1: ApiAdapter实现** 📋

- [ ] 创建ApiAdapter类
- [ ] 实现多Provider支持（Anthropic, OpenAI, Gemini等）
- [ ] 实现流式响应处理
- [ ] 实现Prompt Caching
- [ ] 实现Extended Thinking
- [ ] 单元测试（覆盖率≥80%）

**2.3.2: API请求主流程集成** 📋

- [ ] 识别API调用入口点
- [ ] 集成ApiAdapter到请求处理流程
- [ ] 实现流式输出桥接
- [ ] Token计算和成本追踪

**2.3.3: API单元测试和验证** 📋

- [ ] 创建ApiAdapter.test.ts
- [ ] Provider切换测试
- [ ] 流式响应测试
- [ ] 缓存机制测试
- [ ] 错误处理测试

**预估时间**: 2-3天

---

### 📋 Phase 2.4: Conversation & Memory集成（待开始）

#### 待完成任务

**2.4.1: ConversationAdapter实现** 📋

- [ ] 创建ConversationAdapter类
- [ ] 实现消息历史管理
- [ ] 实现消息序列化/反序列化
- [ ] 实现上下文压缩集成
- [ ] 单元测试（覆盖率≥80%）

**2.4.2: MemoryAdapter实现** 📋

- [ ] 创建MemoryAdapter类
- [ ] 实现ConversationMemory集成
- [ ] 实现VectorMemoryStore集成
- [ ] 实现记忆提取和摘要
- [ ] 单元测试（覆盖率≥80%）

**2.4.3: 对话和记忆单元测试** 📋

- [ ] 创建ConversationAdapter.test.ts
- [ ] 创建MemoryAdapter.test.ts
- [ ] 消息管理测试
- [ ] 记忆系统测试
- [ ] 集成测试

**预估时间**: 2-3天

---

### ⚠️ 代码索引模块

根据文档58和60的决策，代码索引模块采用不同策略：

**当前状态**: TypeScript实现（使用web-tree-sitter WASM）
**原因**: Tree-sitter核心无法编译到纯Rust WASM
**未来计划**: Phase 3使用C++ + Emscripten方案（需3-4周）

**决策**: 先完成其他模块的WASM集成，代码索引延后到Phase 3

---

### 📋 Phase 2.5: 完整验收流程（最后阶段）

#### 验收标准

**2.5.1: 运行pnpm check-types** 📋

- [ ] 确保所有TypeScript类型检查通过
- [ ] 无类型错误
- [ ] 所有泛型正确推断

**2.5.2: 运行pnpm clean** 📋

- [ ] 清理所有构建产物
- [ ] 确认清理脚本正常工作

**2.5.3: 运行pnpm build** 📋

- [ ] 完整构建项目
- [ ] 所有包成功编译
- [ ] WASM模块正确集成

**2.5.4: 运行pnpm vsix** 📋

- [ ] 生成VSCode插件VSIX文件
- [ ] 验证文件大小合理
- [ ] 验证所有资源正确打包

**2.5.5: Git提交所有Phase 2更改** 📋

- [ ] 清晰的commit message
- [ ] 包含所有修改文件
- [ ] 更新文档

**预估时间**: 1天

---

## 🎯 总体进度

### 已完成（60%）

- ✅ Phase 1: Rust WASM核心实现（5个模块）
- ✅ Phase 2.1: Task System完整集成

### 进行中（10%）

- 🔄 Phase 2.2: Tools System集成（刚开始）

### 待完成（30%）

- 📋 Phase 2.3: API System集成
- 📋 Phase 2.4: Conversation & Memory集成
- 📋 Phase 2.5: 完整验收流程

---

## 📈 关键指标

### 代码量统计

- **Rust代码**: ~7,121行（已完成）
- **TypeScript适配器**: ~2,000行（部分完成）
- **测试代码**: ~5,000行（部分完成）

### 测试覆盖

- **Rust单元测试**: 133个（全部通过）
- **TypeScript集成测试**: 52个（Task相关，全部通过）
- **待添加测试**: ~100个（Tools/API/Conversation/Memory）

### WASM性能

- **文件大小**: 1.1MB（优化56%，目标<2MB）✅
- **初始化时间**: <100ms ✅
- **方法调用延迟**: <10ms ✅
- **内存占用**: 减少40% ✅

---

## ⚠️ 关键约束和注意事项

### 1. 上下文限制

- **限制**: 120K tokens
- **策略**:
    - 不要一次性读取太多文件
    - 优先使用codebase_search语义搜索
    - 每次只读取5个文件（工具限制）
    - 使用list_code_definition_names概览
    - 分批处理大型重构

### 2. 代码质量强制规则

- ✅ **safeWriteJson**: 所有JSON写入必须使用原子化方法（Tools System关键）
- ✅ **测试覆盖**: 所有代码更改必须有测试（覆盖率≥80%）
- ✅ **测试运行**: 必须在正确目录执行（`cd src && npx vitest run ...`）
- ✅ **类型安全**: TypeScript类型检查必须通过
- ✅ **Lint规则**: 不得禁用任何lint规则

### 3. 测试框架规则

```bash
# ✅ 正确
cd src && npx vitest run core/tools/__tests__/ToolsAdapter.test.ts

# ❌ 错误
npx vitest run src/core/tools/__tests__/ToolsAdapter.test.ts
```

**关键**:
