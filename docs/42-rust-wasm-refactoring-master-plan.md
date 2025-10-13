# Roo Code Rust+WASM 重构主任务计划

> **项目代号**: Project Phoenix  
> **版本**: 1.0.0  
> **创建日期**: 2025-10-13  
> **项目周期**: 约 5 个月（20 周）  
> **当前分支**: `rust_wasm`  
> **架构方案**: Rust → WebAssembly + TypeScript Host Interface

---

## 📋 执行摘要

### 项目目标

将 Roo Code 的**所有非 UI 逻辑**用 Rust 重写并编译为 WASM，实现：

- ✅ **100% 代码复用**：核心逻辑只写一次
- ✅ **跨平台支持**：VSCode/Blender/Unreal/Unity/Web
- ✅ **性能提升 50-200%**：接近原生代码性能
- ✅ **安全性提升 10 倍**：WASM 沙箱隔离
- ✅ **维护成本降低 70%**：统一核心代码库

### 当前状态

- ✅ **Git 分支已创建**: `rust_wasm`
- ✅ **工作区已清理**: 准备全新开始
- ✅ **参考文档已就绪**: docs/30, docs/31
- ⏳ **当前任务**: 阶段 0 - 项目准备与评估

### 关键指标

| 指标          | 目标值   | 当前值         |
| ------------- | -------- | -------------- |
| 代码复用率    | ≥ 85%    | 0% (基准)      |
| WASM 文件大小 | < 2 MB   | N/A            |
| 性能提升      | 50-200%  | 基准 (纯 TS)   |
| 测试覆盖率    | ≥ 80%    | ~65% (现有)    |
| 构建时间      | < 5 分钟 | N/A            |
| 内存占用      | < 150 MB | ~200 MB (现有) |

---

## 🏗️ 架构设计简图

```
┌─────────────────────────────────────┐
│    Platform UI Layer (TypeScript)    │ ← 保留现有 VSCode 集成
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│   Host Interface (22 函数)           │ ← TypeScript 实现
│   文件系统(7) 终端(3) UI(4) 网络(2) │
│   配置(2) 向量DB(2) 日志(1) 工作区(1)│
└──────────────┬──────────────────────┘
               │ wasm-bindgen FFI
┌──────────────┴──────────────────────┐
│    roo-core.wasm (< 2MB)             │ ← Rust 核心逻辑
│  Task•API•Tools•Conversation•Memory │
└──────────────────────────────────────┘
```

### 技术栈

- **核心逻辑 (80%)**: Rust
- **性能关键 (5%)**: C++ (Tree-sitter)
- **集成层 (15%)**: TypeScript (Host Interface)

---

## 📅 任务阶段概览

### 阶段 0: 项目准备与评估 (Week 1-2)

**目标**: 评估代码、搭建环境、验证技术

- **0.1**: 详细评估现有 TypeScript 代码库
    - 分析 `src/api/`, `src/core/`, `src/services/`
    - 输出: 迁移范围清单、依赖关系图
- **0.2**: 确定 Rust 重构范围和优先级
    - 优先级 1: Task Engine, AI Integration
    - 优先级 2: Tools System, Conversation
    - 优先级 3: Memory System, Code Indexing
- **0.3**: 搭建 Rust 工具链和 WASM 环境
    - 安装: rustc, wasm-pack, cargo 工具
    - 创建: `roo-wasm/` 项目结构
- **0.4**: 创建 POC 验证 Host Interface 设计
    - 实现: Hello World WASM
    - 验证: 双向调用 (Rust ↔ TypeScript)
    - 测试: 性能基准 (JSON 解析、字符串处理)
- **0.5**: 编写技术规范和代码标准文档
    - Rust 代码风格指南
    - Host Interface 设计原则
    - 测试规范 (覆盖率 ≥ 80%)

**交付物**:

- [x] 评估报告 4 份
- [x] POC 演示项目
- [x] 技术规范文档 3 份

---

### 阶段 1: Rust 核心模块实现 (Week 3-12)

**目标**: 用 Rust 重新实现所有核心业务逻辑

#### 1.1 Task Engine - 任务生命周期管理 (Week 3-4)

**文件**: `roo-wasm/src/task.rs`

- [ ] 任务状态机 (7 states: Created, Running, Paused, Completed, Failed, Aborted, Interactive)
- [ ] 消息历史管理
- [ ] 工具调用跟踪
- [ ] Token 统计和成本计算
- [ ] 检查点系统
- [ ] **测试**: 49+ 单元测试
- [ ] **目标**: ~500 行代码

#### 1.2 API Integration - AI 提供商集成 (Week 5-6)

**文件**: `roo-wasm/src/api.rs`

- [ ] Anthropic Provider (Claude)
- [ ] OpenAI Provider (GPT)
- [ ] Gemini Provider
- [ ] 流式处理引擎
- [ ] 上下文管理
- [ ] **测试**: 30+ 单元测试
- [ ] **目标**: ~400 行代码

#### 1.3 Tools System - 工具系统 (Week 7-8)

**文件**: `roo-wasm/src/tools.rs`

- [ ] 21 种工具类型定义
- [ ] 36 种参数类型
- [ ] 工具验证和权限检查
- [ ] Diff 引擎 (apply_diff, multi_apply_diff)
- [ ] **测试**: 25+ 单元测试
- [ ] **目标**: ~350 行代码

#### 1.4 Conversation - 对话历史管理 (Week 9)

**文件**: `roo-wasm/src/conversation.rs`

- [ ] ApiMessage (Anthropic 格式)
- [ ] ClineMessage (UI 显示格式)
- [ ] ConversationHistory 管理器
- [ ] 内容块处理 (Text, Image, ToolUse, ToolResult)
- [ ] **测试**: 18+ 单元测试
- [ ] **目标**: ~700 行代码

#### 1.5 Memory System - 记忆系统 (Week 10)

**文件**: `roo-wasm/src/memory.rs`

- [ ] 向量存储抽象层
- [ ] 上下文记忆管理
- [ ] 文件上下文管理
- [ ] Qdrant 集成（通过 Host API）
- [ ] **测试**: 16+ 单元测试
- [ ] **目标**: ~1200 行代码

#### 1.6 Code Indexing - 代码索引 (Week 11)

**文件**: `roo-wasm/src/indexing.rs`

- [ ] Tree-sitter 集成 (C++ FFI)
- [ ] 语义搜索
- [ ] 代码定义提取
- [ ] **测试**: 12+ 单元测试
- [ ] **目标**: ~600 行代码

#### 1.7 WASM 构建和优化 (Week 12)

- [ ] 配置 `wasm-pack build --release`
- [ ] 使用 `wasm-opt -Oz` 优化
- [ ] 目标: WASM 大小 < 2MB
- [ ] 验证: 所有 97+ 测试通过

**交付物**:

- [x] `roo-core.wasm` (< 2MB)
- [x] Rust 源码 ~3800 行
- [x] 测试覆盖率 ≥ 80%

---

### 阶段 2: Host Interface + TypeScript 集成 (Week 13-16)

**目标**: 实现 TypeScript 端的 Host Interface 并集成 WASM

#### 2.1 Host Interface 完整定义 (Week 13)

**文件**: `src/core/wasm/host/HostInterface.ts`

- [ ] 定义 22 个接口函数签名
- [ ] 实现类型定义 (TypeScript interfaces)
- [ ] 错误处理机制
- [ ] **测试**: 接口契约测试

#### 2.2 WASM 加载器实现 (Week 13)

**文件**: `src/core/wasm/WasmLoader.ts`

- [ ] 加载 .wasm 文件
- [ ] 初始化 wasm-bindgen
- [ ] 注入 Host API
- [ ] 错误处理和重试
- [ ] **测试**: 加载测试

#### 2.3-2.7 各接口实现 (Week 14-15)

**文件**: `src/core/wasm/host/HostInterface.ts`

- [ ] **2.3**: 文件系统接口 (7 个函数)
    - `readFile`, `writeFile`, `fileExists`, `listDir`, `createDir`, `deleteFile`, `getFileMetadata`
- [ ] **2.4**: 终端接口 (3 个函数)
    - `executeCommand`, `getTerminalOutput`, `killProcess`
- [ ] **2.5**: UI 接口 (4 个函数)
    - `showNotification`, `askApproval`, `askInput`, `showError`
- [ ] **2.6**: 网络接口 (2 个函数)
    - `httpRequest`, `httpStream`
- [ ] **2.7**: 配置和向量数据库接口 (5 个函数)
    - `getConfig`, `setConfig`, `getWorkspacePath`, `vectorSearch`, `vectorInsert`, `log`

**每个接口组测试要求**:

- [x] 单元测试覆盖所有函数
- [x] Mock VSCode API
- [x] 错误处理测试
- [x] 异步操作测试

#### 2.8 VSCode 集成测试 (Week 16)

- [ ] 端到端测试: 创建任务 → 执行工具 → 完成
- [ ] 性能测试: 响应时间、内存占用
- [ ] 兼容性测试: 现有功能不受影响

**交付物**:

- [x] Host Interface 实现 ~1500 行
- [x] 集成测试 20+ 用例
- [x] 性能提升验证报告

---

### 阶段 3: 测试、优化与文档 (Week 17-20)

**目标**: 全面测试、性能优化、完整文档

#### 3.1 单元测试补全 (Week 17)

- [ ] Rust 测试覆盖率 ≥ 80%
- [ ] TypeScript 测试覆盖率 ≥ 80%
- [ ] 边界条件测试
- [ ] 错误路径测试

#### 3.2 集成测试 (Week 18)

- [ ] 端到端工作流测试
- [ ] 跨模块集成测试
- [ ] 回归测试套件

#### 3.3 性能基准测试和优化 (Week 18)

- [ ] 建立性能基准
- [ ] 识别性能瓶颈
- [ ] 优化热路径
- [ ] 验证性能提升 ≥ 50%

#### 3.4 完整技术文档编写 (Week 19)

- [ ] 架构文档
- [ ] API 参考文档
- [ ] 开发指南
- [ ] 迁移指南

#### 3.5 最终验收 (Week 20)

```bash
# 验收检查清单
□ 运行 pnpm check-types     # 类型检查通过
□ 运行 pnpm clean           # 清理构建产物
□ 运行 pnpm build           # 完整构建成功
□ 运行 pnpm vsix            # 打包 VSIX
□ 所有测试通过 (覆盖率 ≥ 80%)
□ WASM 文件大小 < 2MB
□ 性能提升验证 ≥ 50%
□ 文档完整性检查
```

**最终提交**:

```bash
git add .
git commit -m "feat(wasm): Complete Rust+WASM refactoring - Phase 3 final"
git push origin rust_wasm
```

**交付物**:

- [x] 完整测试套件 (覆盖率 ≥ 80%)
- [x] 性能优化报告
- [x] 完整技术文档
- [x] 可发布的 VSIX 包

---

## 📊 关键里程碑和检查点

| 周次    | 里程碑               | 验收标准                 | 状态 |
| ------- | -------------------- | ------------------------ | ---- |
| Week 2  | 阶段 0 完成          | POC 演示 + 评估报告      | ⏳   |
| Week 4  | Task Engine 完成     | 49+ 测试通过             | ⏸️   |
| Week 6  | API Integration 完成 | 30+ 测试通过             | ⏸️   |
| Week 8  | Tools System 完成    | 25+ 测试通过             | ⏸️   |
| Week 9  | Conversation 完成    | 18+ 测试通过             | ⏸️   |
| Week 10 | Memory System 完成   | 16+ 测试通过             | ⏸️   |
| Week 11 | Code Indexing 完成   | 12+ 测试通过             | ⏸️   |
| Week 12 | 阶段 1 完成          | WASM < 2MB, 所有测试通过 | ⏸️   |
| Week 13 | Host Interface 定义  | 22 个接口完整            | ⏸️   |
| Week 15 | 所有接口实现         | 集成测试通过             | ⏸️   |
| Week 16 | 阶段 2 完成          | VSCode 集成验证          | ⏸️   |
| Week 17 | 测试补全             | 覆盖率 ≥ 80%             | ⏸️   |
| Week 18 | 性能优化             | 提升 ≥ 50%               | ⏸️   |
| Week 19 | 文档完成             | 4 份文档交付             | ⏸️   |
| Week 20 | 项目完成             | 最终验收通过             | ⏸️   |

---

## 🎯 优先级和依赖关系

### P0 - 核心基础（必须优先完成）

1. **Host Interface 设计** (Week 1) → 影响所有后续开发
2. **POC 验证** (Week 2) → 技术可行性验证
3. **Task Engine** (Week 3-4) → 其他模块的基础

### P1 - 核心功能（按顺序完成）

4. **API Integration** (Week 5-6) → Task Engine 依赖
5. **Tools System** (Week 7-8) → Task Engine 依赖
6. **Conversation** (Week 9) → 独立模块
7. **Host Interface 实现** (Week 13-15) → 集成关键

### P2 - 增强功能（可并行）

8. **Memory System** (Week 10) → 可与 Host Interface 并行
9. **Code Indexing** (Week 11) → 可与 Host Interface 并行

### P3 - 优化和收尾（最后阶段）

10. **WASM 优化** (Week 12)
11. **测试和文档** (Week 17-20)

---

## 🔧 技术决策记录

### ADR-001: Host Interface 设计原则

**决策日期**: 2025-10-13
**状态**: 已批准

**上下文**: 需要设计一个通用的接口层，使 Rust WASM 代码能够在不同平台上运行。

**决策**:

- 采用 22 个函数的 Host Interface
- 所有 I/O 操作通过宿主环境
- WASM 模块保持纯计算逻辑

**后果**:

- ✅ 代码 100% 跨平台
- ✅ 易于测试（可 mock）
- ⚠️ 需要额外的 FFI 层

### ADR-002: WASM 大小控制策略

**决策日期**: 2025-10-13
**状态**: 已批准

**上下文**: WASM 文件需要通过网络加载，大小影响启动速度。

**决策**:

- 目标大小 < 2MB
- 使用 `wasm-opt -Oz` 优化
- Tree-sitter 通过 C++ FFI 动态加载

**后果**:

- ✅ 快速启动
- ✅ 降低带宽消耗
- ⚠️ 需要 Tree-sitter 运行时

### ADR-003: 测试策略

**决策日期**: 2025-10-13
**状态**: 已批准

**上下文**: 需要确保 Rust 和 TypeScript 代码的质量。

**决策**:

- Rust: `cargo test` (覆盖率 ≥ 80%)
- TypeScript: `vitest` (覆盖率 ≥ 80%)
- 集成测试: 端到端验证

**后果**:

- ✅ 高质量代码
- ✅ 快速反馈
- ⚠️ 维护成本增加

---

## 📚 参考文档

### 内部文档

- [docs/30-cross-platform-plugin-migration-evaluation.md](./30-cross-platform-plugin-migration-evaluation.md) - 架构设计详细方案
- [docs/31-cross-platform-migration-detailed-task-plan.md](./31-cross-platform-migration-detailed-task-plan.md) - 详细任务分解

### 外部资源

- [Rust and WebAssembly Book](https://rustwasm.github.io/book/)
- [wasm-bindgen Guide](https://rustwasm.github.io/wasm-bindgen/)
- [wasm-pack Documentation](https://rustwasm.github.io/wasm-pack/)
- [WebAssembly Official Site](https://webassembly.org/)

### 相关项目

- [Deno](https://github.com/denoland/deno) - Rust + TypeScript 集成参考
- [Turbopack](https://turbo.build/pack) - Rust 性能优化参考
- [swc](https://swc.rs/) - Rust + WASM 编译器参考

---

## 🚀 快速开始指南

### 开发环境要求

```bash
# 1. 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# 2. 安装 wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# 3. 安装 Node.js 依赖
pnpm install

# 4. 验证环境
rustc --version          # 应该 >= 1.70.0
wasm-pack --version      # 应该 >= 0.12.0
node --version           # 应该 >= 18.0.0
```

### 构建 WASM 模块

```bash
# 开发构建（带调试信息）
cd roo-wasm
wasm-pack build --dev --target bundler

# 生产构建（优化）
wasm-pack build --release --target bundler

# 优化 WASM 大小
wasm-opt -Oz -o pkg/roo_core_bg_optimized.wasm pkg/roo_core_bg.wasm
```

### 运行测试

```bash
# Rust 测试
cd roo-wasm
cargo test

# TypeScript 测试
cd src
npx vitest run

# 集成测试
pnpm test:integration
```

---

## ⚠️ 风险和缓解策略

### 技术风险

| 风险                 | 影响 | 概率 | 缓解策略         |
| -------------------- | ---- | ---- | ---------------- |
| WASM 性能不达预期    | 高   | 中   | Week 2 POC 验证  |
| Tree-sitter FFI 复杂 | 中   | 高   | 使用 C++ wrapper |
| WASM 文件过大        | 中   | 中   | 增量加载策略     |
| 跨平台兼容性问题     | 高   | 低   | 充分测试         |

### 进度风险

| 风险           | 影响 | 概率 | 缓解策略          |
| -------------- | ---- | ---- | ----------------- |
| 评估不准确     | 高   | 中   | Week 1-2 详细评估 |
| 测试覆盖率不足 | 中   | 中   | 持续集成检查      |
| 文档不完整     | 低   | 高   | 每周文档审查      |

---

## 📞 联系和支持

### 项目负责人

- **技术负责人**: TBD
- **架构负责人**: TBD
- **测试负责人**: TBD

### 沟通渠道

- **技术讨论**: GitHub Issues
- **架构决策**: GitHub Discussions
- **日常沟通**: Slack #rust-wasm-migration

### 更新日志

- **2025-10-13**: 初始版本 1.0.0
- **分支**: `rust_wasm`
- **状态**: ⏳ 阶段 0 进行中

---

## ✅ 下一步行动

### 立即执行（本周）

1. ✅ 创建主计划文档（当前文档）
2. ⏳ 开始任务 0.1: 评估 TypeScript 代码库
3. ⏳ 搭建 Rust 开发环境
4. ⏳ 学习 wasm-bindgen 基础

### 本周目标

- [ ] 完成代码评估报告
- [ ] 确定重构范围和优先级
- [ ] 搭建完整开发环境
- [ ] 创建 Hello World POC

### 下周计划（Week 2）

- [ ] 完善 POC 演示
- [ ] 编写技术规范文档
- [ ] 开始 Host Interface 详细设计
- [ ] 准备进入阶段 1

---

**文档结束** | 版本 1.0.0 | 2025-10-13
