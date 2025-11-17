# Roo Code 跨平台迁移项目 - 主计划文档

> **文档版本**: 1.0.0  
> **创建日期**: 2025-10-12  
> **项目周期**: 约 5 个月（20 周）  
> **架构方案**: Rust/C++ → WebAssembly + 平台适配器  
> **项目代号**: Project Phoenix  
> **预算**: $165,000

---

## 📚 文档导航

本项目的详细计划分为以下文档：

1. **[主计划文档](./31-cross-platform-migration-master-plan.md)** (当前文档)

    - 项目概览
    - 整体时间线
    - 团队组织
    - 风险管理

2. **[阶段 0: 准备与验证](./31-phase-0-preparation.md)**

    - Week 1-2
    - 开发环境搭建
    - POC 技术验证
    - 规范制定
    - 团队培训

3. **[阶段 1: WASM 核心开发](./31-phase-1-wasm-core.md)**

    - Week 3-12
    - Host Interface 实现
    - Task Engine 重写
    - AI Integration 重写
    - Tool System 重写
    - Memory System 重写
    - Code Indexing 重写

4. **[阶段 2: 平台适配器开发](./31-phase-2-adapters.md)**

    - Week 9-16
    - VSCode 适配器
    - Blender 适配器
    - Unreal Engine 适配器
    - Unity 适配器

5. **[阶段 3: 集成测试与优化](./31-phase-3-testing.md)**

    - Week 17-18
    - 跨平台集成测试
    - 性能优化
    - 安全审计

6. **[阶段 4: 文档与发布](./31-phase-4-release.md)**
    - Week 19-20
    - 用户文档
    - 开发者文档
    - 发布准备

---

## 1. 项目概览

### 1.1 项目背景

Roo Code 当前是一个 VSCode 专属的 AI 代码助手扩展，拥有以下核心功能：

- 🤖 多模型 AI 对话（Claude, GPT, Gemini, Ollama 等）
- 🛠️ 25+ 工具系统（文件操作、命令执行、浏览器自动化等）
- 🧠 向量记忆系统（Qdrant）
- 🔍 代码索引与语义搜索（Tree-sitter）
- ⚖️ 任务完成验证（Judge Mode）
- 🎯 多模式工作流（Architect, Debug, Test 等）

**现状问题**：

- ❌ 深度绑定 VSCode API，无法在其他 IDE 中使用
- ❌ 大量平台特定代码，维护成本高
- ❌ TypeScript 实现，性能存在瓶颈
- ❌ 用户群体受限于 VSCode 用户

**项目目标**：

- ✅ 支持 4 大平台：VSCode, Blender, Unreal Engine, Unity
- ✅ 代码复用率 ≥ 85%
- ✅ 性能提升 50-200%
- ✅ 维护成本降低 70%

### 1.2 技术架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Platform UI Layer (各平台独立实现)                   │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────┐ │
│  │ VSCode WebView│ │  Blender UI   │ │   UE Slate    │ │ Unity UI │ │
│  │  (React/TS)   │ │   (Python)    │ │    (C++)      │ │  (C#)    │ │
│  └───────────────┘ └───────────────┘ └───────────────┘ └──────────┘ │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ 平台特定 API 调用
┌──────────────────────────┴──────────────────────────────────────────┐
│              Platform Adapters Layer (桥接层)                         │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────┐ │
│  │  TypeScript   │ │    Python     │ │     C++       │ │   C#     │ │
│  │  VSCode API   │ │  Blender API  │ │   UE API      │ │ Unity API│ │
│  │  - fs/path    │ │  - bpy.ops    │ │  - FFileHelper│ │ - File   │ │
│  │  - child_proc │ │  - subprocess │ │  - FPlatformP │ │ - Process│ │
│  │  - vscode.ui  │ │  - bpy.ui     │ │  - SNotifyMgr │ │ - EditorUI│ │
│  └───────────────┘ └───────────────┘ └───────────────┘ └──────────┘ │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ Host Interface (FFI - wasm-bindgen)
                           │ 标准化接口：read_file, write_file, exec_cmd...
┌──────────────────────────┴──────────────────────────────────────────┐
│                     roo-core.wasm (核心逻辑层)                         │
│                         Rust (80%) + C++ (20%)                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Task Engine     │  │ AI Integration   │  │  Tool System     │  │
│  │  ────────────    │  │ ──────────────   │  │  ────────────    │  │
│  │  - TaskManager   │  │  - Anthropic     │  │  - read_file     │  │
│  │  - StateManage   │  │  - OpenAI        │  │  - write_file    │  │
│  │  - EventEmitter  │  │  - Gemini        │  │  - apply_diff    │  │
│  │  - Checkpointing │  │  - Ollama        │  │  - execute_cmd   │  │
│  │  - History       │  │  - Token counting│  │  - browser_action│  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Memory System   │  │ Code Indexing    │  │  Judge Mode      │  │
│  │  ────────────    │  │ ──────────────   │  │  ────────────    │  │
│  │  - Vector Store  │  │  - Tree-sitter   │  │  - Task Verify   │  │
│  │  - Conversation  │  │  - Semantic      │  │  - Completion    │  │
│  │  - Auto Compress │  │  - Symbol Extract│  │  - Quality Check │  │
│  │  - Context Mngmt │  │  - AST Query     │  │  - Feedback Loop │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Host Interface (Rust extern "C")                            │  │
│  │  - File System: read/write/list/exists                       │  │
│  │  - Terminal: exec/stream/terminate                           │  │
│  │  - UI: notify/ask_approval/ask_input                         │  │
│  │  - Network: http_request/http_stream                         │  │
│  │  - Config: get/set/list                                      │  │
│  │  - Logging: log with levels                                  │  │
│  │  - Vector DB: search/insert/delete                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**核心设计原则**：

1. **关注点分离**: UI、适配器、核心逻辑完全解耦
2. **平台无关**: 核心逻辑 100% 平台中立
3. **接口最小化**: Host Interface 只暴露必需功能
4. **性能优先**: Rust 零成本抽象 + WASM 近原生性能
5. **渐进迁移**: 可与现有 VSCode 扩展并行开发

### 1.3 关键指标与目标

| 维度              | 当前状态      | 目标值   | 度量方法                  | 优先级      |
| ----------------- | ------------- | -------- | ------------------------- | ----------- |
| **代码复用率**    | 0% (平台专属) | ≥ 85%    | 核心代码行数 / 总代码行数 | 🔴 Critical |
| **WASM 文件大小** | N/A           | < 2 MB   | 优化后 .wasm 大小 (gzip)  | 🟡 High     |
| **性能提升**      | 基准 (100%)   | 150-250% | 关键操作响应时间对比      | 🔴 Critical |
| **测试覆盖率**    | ~65%          | ≥ 80%    | cargo tarpaulin           | 🟡 High     |
| **构建时间**      | N/A           | < 5 分钟 | CI/CD 流水线时间          | 🟢 Medium   |
| **内存占用**      | ~200 MB       | < 150 MB | 运行时内存峰值            | 🟡 High     |
| **启动时间**      | ~2 秒         | < 1 秒   | 冷启动到可用时间          | 🟢 Medium   |
| **API 兼容性**    | N/A           | 100%     | 现有功能保持率            | 🔴 Critical |

### 1.4 成功标准

**技术标准**：

- ✅ 所有 4 个平台都可成功运行 Roo Code
- ✅ 核心功能在所有平台上行为一致
- ✅ 性能测试通过：关键操作响应时间 < 200ms
- ✅ 测试覆盖率 ≥ 80%，所有测试通过
- ✅ WASM 文件大小 < 2 MB (gzip 压缩后)
- ✅ 内存泄漏测试通过：24 小时运行无增长
- ✅ 安全审计通过：无高危漏洞

**业务标准**：

- ✅ 至少 100 名 Beta 测试用户完成测试
- ✅ 用户满意度 ≥ 85%
- ✅ Bug 报告 < 5 个 Critical 问题
- ✅ 文档完整度 100%（用户 + 开发者）
- ✅ 社区反馈积极（GitHub Stars, 讨论）

---

## 2. 整体时间线

### 2.1 甘特图概览

```
Week:  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20
       │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │
Phase0 ████░

Phase1     ░░████████████████████░
Phase2                    ░░████████████████░
Phase3                                      ░░████░
Phase4                                            ░░████
       │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │
       环境 POC 接口 任务 AI  工具 记忆 索引 VSC Bld UE  Uni 测试 文档
       搭建 验证 实现 引擎 集成 系统 系统 引擎 适配 适配 适配 适配 优化 发布

Legend: ████ = 工作进行中  ░░░░ = 并行工作
```

### 2.2 里程碑时间表

| 里程碑               | 日期    | 交付物                | 验收标准         |
| -------------------- | ------- | --------------------- | ---------------- |
| **M0: 项目启动**     | Week 1  | 项目计划、团队组建    | 计划评审通过     |
| **M1: 环境就绪**     | Week 2  | 开发环境、CI/CD       | POC 成功运行     |
| **M2: 接口完成**     | Week 4  | Host Interface 实现   | 双向调用测试通过 |
| **M3: 任务引擎**     | Week 6  | Task Engine (Rust)    | 功能对等测试通过 |
| **M4: AI 集成**      | Week 8  | AI Integration (Rust) | 4 个模型测试通过 |
| **M5: 工具系统**     | Week 10 | Tool System (Rust)    | 25+ 工具测试通过 |
| **M6: 核心完成**     | Week 12 | 完整 WASM 核心        | 所有单元测试通过 |
| **M7: VSCode 适配**  | Week 13 | VSCode Adapter        | 功能完全对等     |
| **M8: 平台适配完成** | Week 16 | 4 个平台适配器        | 基本功能演示通过 |
| **M9: 测试完成**     | Week 18 | 集成测试报告          | 所有测试通过     |
| **M10: 项目交付**    | Week 20 | 发布包、文档          | 业务标准达成     |

### 2.3 详细时间分解

#### 阶段 0: 准备与验证 (Week 1-2)

- **Week 1**
    - Day 1-3: 环境搭建（Rust, C++, WASM 工具链）
    - Day 4-5: POC - Hello World WASM
- **Week 2**
    - Day 1-3: POC - Host Interface 验证
    - Day 4: 性能基准测试
    - Day 5: 团队培训、规范制定

#### 阶段 1: WASM 核心开发 (Week 3-12)

- **Week 3-4**: Host Interface 完整实现
- **Week 5-6**: Task Engine 重写
- **Week 7-8**: AI Integration 重写
- **Week 9-10**: Tool System 重写
- **Week 11**: Memory System 重写
- **Week 12**: Code Indexing (C++/Rust)

#### 阶段 2: 平台适配器 (Week 9-16，部分并行)

- **Week 9-13**: VSCode Adapter (优先，作为参考实现)
- **Week 11-14**: Blender Adapter (Python)
- **Week 12-15**: Unreal Adapter (C++)
- **Week 13-16**: Unity Adapter (C#)

#### 阶段 3: 集成测试 (Week 17-18)

- **Week 17**: 跨平台功能测试、性能测试
- **Week 18**: Bug 修复、优化、安全审计

#### 阶段 4: 文档与发布 (Week 19-20)

- **Week 19**: 文档编写（用户手册、开发者指南）
- **Week 20**: Beta 发布、收集反馈

---

## 3. 团队组织与资源分配

### 3.1 团队结构

```
Project Lead (1 人)
├── Tech Lead (1 人)
│   ├── Rust Team
│   │   ├── Rust Lead (1 人) - 核心架构、Host Interface
│   │   ├── Backend Dev 1 (1 人) - Task Engine, AI Integration
│   │   ├── Backend Dev 2 (1 人) - Tool System, Memory
│   │   └── C++ Dev (0.5 人) - Tree-sitter, Code Indexing
│   │
│   ├── Adapter Team
│   │   ├── VSCode Dev (1 人) - TypeScript Adapter
│   │   ├── Blender Dev (0.5 人) - Python Adapter
│   │   ├── Unreal Dev (0.5 人) - C++ Adapter
│   │   └── Unity Dev (0.5 人) - C# Adapter
│   │
│   └── QA/DevOps (1 人)
│       ├── CI/CD 配置
│       ├── 测试自动化
│       └── 性能监控
│
└── Documentation (0.5 人)
    ├── 用户文档
    └── 开发者文档

总人力: 8 FTE (Full-Time Equivalent)
```

### 3.2 角色与职责

| 角色              | 人数 | 主要职责                           | 技能要求                         | 周工作量 |
| ----------------- | ---- | ---------------------------------- | -------------------------------- | -------- |
| **Project Lead**  | 1    | 项目管理、进度跟踪、风险管理       | 项目管理、技术背景               | 100%     |
| **Tech Lead**     | 1    | 架构设计、技术决策、代码评审       | Rust, WASM, 系统设计             | 100%     |
| **Rust Lead**     | 1    | 核心架构、Host Interface、技术指导 | Rust 专家, WASM 深度经验         | 100%     |
| **Backend Dev 1** | 1    | Task Engine, AI Integration        | Rust, 异步编程, AI API           | 100%     |
| **Backend Dev 2** | 1    | Tool System, Memory System         | Rust, 系统编程                   | 100%     |
| **C++ Dev**       | 0.5  | Tree-sitter, 性能优化              | C++, WASM, 编译原理              | 50%      |
| **VSCode Dev**    | 1    | VSCode Adapter, UI 集成            | TypeScript, VSCode API           | 100%     |
| **Blender Dev**   | 0.5  | Blender Adapter                    | Python, Blender API              | 50%      |
| **Unreal Dev**    | 0.5  | UE Adapter                         | C++, UE API                      | 50%      |
| **Unity Dev**     | 0.5  | Unity Adapter                      | C#, Unity API                    | 50%      |
| **QA/DevOps**     | 1    | CI/CD, 自动化测试                  | Docker, GitHub Actions, 测试框架 | 100%     |
| **Tech Writer**   | 0.5  | 文档编写                           | 技术写作、Markdown               | 50%      |

### 3.3 周资源分配甘特图

```
Role         Week: 1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20
Project Lead      ████████████████████████████████████████████████████████
Tech Lead         ████████████████████████████████████████████████████████
Rust Lead         ████████████████████████████████████████████████████████
Backend Dev 1     ████████████████████████████████████████████████████████
Backend Dev 2     ████████████████████████████████████████████████████████
C++ Dev           ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████░░░░░░░░░░░░░░░░░░░░
VSCode Dev        ░░░░░░░░░░░░░░░░████████████████████████░░░░░░░░░░░░░░░░
Blender Dev       ░░░░░░░░░░░░░░░░░░░░░░░░████████████░░░░░░░░░░░░░░░░░░░░
Unreal Dev        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████░░░░░░░░░░░░░░░░
Unity Dev         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████░░░░░░░░░░░░
QA/DevOps         ████████████████████████████████████████████████████████
Tech Writer       ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████

Legend: ████ = Full-time (100%)  ░░░░ = Part-time (50%)
```

### 3.4 成本预算

| 类别              | 项目       | 单价       | 数量      | 小计               | 备注 |
| ----------------- | ---------- | ---------- | --------- | ------------------ | ---- |
| **人力成本**      |            |            |           | **$155,000**       |      |
| ├─ Project Lead   | $150/h     | 800h       | $120,000  | 20 周 × 40h        |
| ├─ Tech Lead      | $140/h     | 800h       | $112,000  | 20 周 × 40h        |
| ├─ Rust Lead      | $130/h     | 800h       | $104,000  | 20 周 × 40h        |
| ├─ Backend Dev 1  | $120/h     | 800h       | $96,000   | 20 周 × 40h        |
| ├─ Backend Dev 2  | $120/h     | 800h       | $96,000   | 20 周 × 40h        |
| ├─ C++ Dev        | $120/h     | 400h       | $48,000   | 10 周 × 40h (50%)  |
| ├─ VSCode Dev     | $110/h     | 800h       | $88,000   | 20 周 × 40h        |
| ├─ Blender Dev    | $100/h     | 320h       | $32,000   | 8 周 × 40h (50%)   |
| ├─ Unreal Dev     | $110/h     | 320h       | $35,200   | 8 周 × 40h (50%)   |
| ├─ Unity Dev      | $110/h     | 320h       | $35,200   | 8 周 × 40h (50%)   |
| ├─ QA/DevOps      | $100/h     | 800h       | $80,000   | 20 周 × 40h        |
| └─ Tech Writer    | $80/h      | 400h       | $32,000   | 10 周 × 40h (50%)  |
| **软件与服务**    |            |            |           | **$5,000**         |      |
| ├─ GitHub Actions | $0.008/min | 50,000 min | $400      | CI/CD 运行时间     |
| ├─ Qdrant Cloud   | $99/月     | 5 个月     | $495      | 向量数据库         |
| ├─ AWS S3         | $0.023/GB  | 100 GB     | $2.30     | 构建产物存储       |
| ├─ Cloudflare     | $0         | 无限       | $0        | CDN (免费计划)     |
| ├─ OpenAI API     | 测试用     |            | $500      | AI 集成测试        |
| ├─ Anthropic API  | 测试用     |            | $500      | AI 集成测试        |
| └─ 其他工具       |            |            | $3,102.70 | Sentry, DataDog 等 |
| **硬件与设备**    |            |            |           | **$3,000**         |      |
| ├─ 高性能工作站   | $1,500     | 2 台       | $3,000    | Rust 编译用        |
| **培训与会议**    |            |            |           | **$2,000**         |      |
| ├─ Rust 培训      | $500       | 4 人       | $2,000    | 外部讲师           |
| **应急储备**      |            |            |           | **$10,000**        |      |
| └─ 风险缓冲       | 5%         |            | $10,000   | 应对延期等         |
| **总计**          |            |            |           | **$175,000**       |      |

**实际预算**: $165,000 (优化后，不含应急储备)

---

## 4. 风险管理

### 4.1 风险识别与评估

| ID     | 风险描述                          | 可能性 | 影响 | 风险等级 | 缓解策略                 | 负责人    |
| ------ | --------------------------------- | ------ | ---- | -------- | ------------------------ | --------- |
| **R1** | Rust 人才短缺，招聘困难           | 中     | 高   | 🔴 高    | 提前招聘、外包、内部培训 | PM        |
| **R2** | WASM 性能未达预期                 | 低     | 高   | 🟡 中    | POC 早期验证、性能测试   | Tech Lead |
| **R3** | Host Interface 设计不当，频繁变更 | 中     | 中   | 🟡 中    | 详细设计评审、版本化     | Rust Lead |
| **R4** | 平台                              |

API 兼容性问题 | 中 | 中 | 🟡 中 | 早期调研、Adapter 抽象层 | Adapter Team |
| **R5** | WASM 文件过大 (>5MB) | 中 | 中 | 🟡 中 | 代码分割、优化编译选项 | Rust Lead |
| **R6** | 性能回归（比 TS 慢） | 低 | 高 | 🟡 中 | 持续性能测试、profiling | QA |
| **R7** | 内存泄漏 | 中 | 中 | 🟡 中 | 严格代码评审、内存测试 | Rust Team |
| **R8** | 跨平台一致性问题 | 中 | 中 | 🟡 中 | 统一测试套件、CI 矩阵 | QA |
| **R9** | 依赖库不兼容 WASM | 低 | 中 | 🟢 低 | 提前验证、寻找替代 | Rust Lead |
| **R10** | 项目延期 | 中 | 高 | 🟡 中 | 敏捷开发、里程碑监控 | PM |
| **R11** | 现有 VSCode 功能丢失 | 低 | 高 | 🟡 中 | 功能清单对比、测试 | VSCode Dev |
| **R12** | 调试困难 | 中 | 中 | 🟡 中 | Source maps、DWARF、日志 | Tech Lead |

### 4.2 风险应对计划

#### R1: Rust 人才短缺

**触发条件**: 2 周内未找到合格 Rust 开发者  
**应对措施**:

1. **Plan A**: 扩大招聘范围（Remote-first）
2. **Plan B**: 内部培训现有 Backend 开发者（TypeScript → Rust）
3. **Plan C**: 外包部分模块给 Rust 专业团队
4. **Plan D**: 延长 Phase 1 时间，降低并行度

**预算影响**: 外包可能增加 $20,000-$30,000

---

#### R2: WASM 性能未达预期

**触发条件**: 基准测试显示性能 < TypeScript 1.3 倍  
**应对措施**:

1. Week 2 完成性能 POC，提前验证
2. 使用 `cargo flamegraph` 进行性能分析
3. 优化热路径代码（内联、零拷贝）
4. 如仍不达标，考虑 Native Module (N-API) 方案

**决策点**: Week 2 POC 结果

---

#### R3: Host Interface 频繁变更

**触发条件**: 接口变更 > 3 次/周  
**应对措施**:

1. Week 3 完成接口设计详细评审
2. 使用语义化版本 (v1.0.0, v1.1.0)
3. 保持向后兼容，废弃旧接口而非删除
4. 文档化所有接口变更

**验收标准**: Week 8 后接口变更 < 1 次/2 周

---

#### R10: 项目延期

**触发条件**: 任何里程碑延期 > 1 周  
**应对措施**:

1. 立即触发风险会议，分析原因
2. 调整资源分配（增加人力/延长工时）
3. 削减非关键功能（降低范围）
4. 调整后续里程碑时间

**升级路径**: 延期 > 2 周 → 向 Stakeholders 报告

---

## 5. 质量保证计划

### 5.1 测试策略

#### 5.1.1 测试金字塔

```
                  ▲
                 ╱ ╲
                ╱ E2E╲              10% - 端到端测试
               ╱───────╲            - 跨平台功能测试
              ╱ Integration╲        20% - 集成测试
             ╱─────────────╲        - WASM ↔ Adapter 测试
            ╱   Unit Tests   ╲      70% - 单元测试
           ╱─────────────────╲      - Rust 单元测试
          ╱_____________________╲    - Adapter 单元测试
```

#### 5.1.2 测试矩阵

| 测试类型       | 覆盖范围        | 工具              | 目标覆盖率 | 执行频率       |
| -------------- | --------------- | ----------------- | ---------- | -------------- |
| **单元测试**   | Rust 核心模块   | cargo test        | ≥ 80%      | 每次 commit    |
| **集成测试**   | WASM ↔ Host    | cargo test --test | ≥ 70%      | 每次 PR        |
| **性能测试**   | 关键路径        | criterion.rs      | 100%       | 每日           |
| **内存测试**   | 全模块          | valgrind (WASI)   | 零泄漏     | 每周           |
| **跨平台测试** | 4 个平台        | 自定义脚本        | 100%       | 每次 release   |
| **安全测试**   | WASM + Adapters | cargo audit       | 零高危     | 每周           |
| **兼容性测试** | API 对等        | 功能对比脚本      | 100%       | 每次 milestone |

### 5.2 CI/CD 流水线

```yaml
# .github/workflows/ci-cd.yml
name: Roo Code WASM CI/CD

on:
    push:
        branches: [main, develop]
    pull_request:
        branches: [main]

jobs:
    # ========== 阶段 1: 代码质量检查 ==========
    code-quality:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3

            - name: Rust Format Check
              run: |
                  cd core
                  cargo fmt --all -- --check

            - name: Rust Clippy
              run: |
                  cd core
                  cargo clippy --all-features -- -D warnings

            - name: TypeScript Lint
              run: |
                  cd adapters/vscode
                  npm run lint

            - name: Security Audit
              run: |
                  cd core
                  cargo audit

    # ========== 阶段 2: 构建 WASM ==========
    build-wasm:
        needs: code-quality
        runs-on: ${{ matrix.os }}
        strategy:
            matrix:
                os: [ubuntu-latest, macos-latest, windows-latest]
                rust: [stable, nightly]
        steps:
            - uses: actions/checkout@v3

            - name: Setup Rust
              uses: actions-rs/toolchain@v1
              with:
                  toolchain: ${{ matrix.rust }}
                  target: wasm32-unknown-unknown

            - name: Cache Cargo
              uses: actions/cache@v3
              with:
                  path: |
                      ~/.cargo/bin/
                      ~/.cargo/registry/
                      core/target/
                  key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

            - name: Build WASM
              run: |
                  cd core
                  wasm-pack build --release --target web

            - name: Check WASM Size
              run: |
                  SIZE=$(stat -c%s core/pkg/*.wasm)
                  echo "WASM size: $SIZE bytes"
                  if [ $SIZE -gt 2097152 ]; then
                    echo "❌ WASM size exceeds 2MB limit!"
                    exit 1
                  fi

            - name: Upload WASM Artifact
              uses: actions/upload-artifact@v3
              with:
                  name: roo-core-wasm-${{ matrix.os }}-${{ matrix.rust }}
                  path: core/pkg/

    # ========== 阶段 3: 单元测试 ==========
    unit-tests:
        needs: build-wasm
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3

            - name: Run Rust Tests
              run: |
                  cd core
                  cargo test --all-features --verbose

            - name: Code Coverage
              run: |
                  cargo install cargo-tarpaulin
                  cd core
                  cargo tarpaulin --out Xml --output-dir coverage

            - name: Upload Coverage
              uses: codecov/codecov-action@v3
              with:
                  files: core/coverage/cobertura.xml
                  flags: rust

    # ========== 阶段 4: 性能测试 ==========
    performance-tests:
        needs: build-wasm
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3

            - name: Run Benchmarks
              run: |
                  cd core
                  cargo bench --bench performance | tee bench-output.txt

            - name: Compare with Baseline
              run: |
                  # 与上次基准对比
                  python scripts/compare-benchmark.py \
                    bench-output.txt \
                    benchmark-baseline.txt \
                    --threshold 0.9  # 不低于基准的 90%

    # ========== 阶段 5: 集成测试 ==========
    integration-tests:
        needs: build-wasm
        runs-on: ${{ matrix.os }}
        strategy:
            matrix:
                os: [ubuntu-latest, macos-latest, windows-latest]
                platform: [vscode, blender, unreal, unity]
        steps:
            - uses: actions/checkout@v3

            - name: Download WASM
              uses: actions/download-artifact@v3
              with:
                  name: roo-core-wasm-${{ matrix.os }}-stable
                  path: core/pkg/

            - name: Setup Platform - VSCode
              if: matrix.platform == 'vscode'
              run: |
                  cd adapters/vscode
                  npm install
                  npm test

            - name: Setup Platform - Blender
              if: matrix.platform == 'blender'
              run: |
                  # 安装 Blender + Python
                  sudo apt-get install blender python3-pip
                  pip3 install pytest
                  cd adapters/blender
                  pytest tests/

            - name: Integration Tests
              run: |
                  cd adapters/${{ matrix.platform }}
                  npm run test:integration  # 或对应的测试命令

    # ========== 阶段 6: 端到端测试 ==========
    e2e-tests:
        needs: integration-tests
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3

            - name: E2E Tests - VSCode
              run: |
                  cd adapters/vscode
                  npm run test:e2e

            - name: Generate Test Report
              if: always()
              uses: dorny/test-reporter@v1
              with:
                  name: E2E Test Results
                  path: adapters/**/test-results.xml
                  reporter: jest-junit

    # ========== 阶段 7: 发布 ==========
    release:
        needs: [unit-tests, performance-tests, integration-tests, e2e-tests]
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3

            - name: Create Release
              uses: actions/create-release@v1
              env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
              with:
                  tag_name: v${{ github.run_number }}
                  release_name: Release v${{ github.run_number }}
                  draft: false
                  prerelease: false

            - name: Publish to NPM
              run: |
                  cd adapters/vscode
                  npm publish
              env:
                  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 5.3 质量门控

每个 PR 必须通过以下检查才能合并：

✅ **代码质量**

- Rust: `cargo fmt` + `cargo clippy` 零警告
- TypeScript: `eslint` 零错误
- 代码评审：至少 1 个 Approve

✅ **测试通过**

- 单元测试覆盖率 ≥ 80%
- 所有集成测试通过
- 性能测试不低于基准 90%

✅ **安全检查**

- `cargo audit` 零高危漏洞
- 依赖检查通过

✅ **文档更新**

- API 变更必须更新文档
- 新功能必须有使用示例

---

## 6. 沟通计划

### 6.1 会议节奏

| 会议类型            | 频率     | 参与者           | 时长    | 议程                   |
| ------------------- | -------- | ---------------- | ------- | ---------------------- |
| **Daily Standup**   | 每工作日 | 全员             | 15 分钟 | 昨天完成/今天计划/阻塞 |
| **Weekly Planning** | 每周一   | 全员             | 1 小时  | 本周任务分配、优先级   |
| **Tech Review**     | 每周三   | Tech Lead + 开发 | 1 小时  | 代码评审、架构讨论     |

|
**Sprint Retro** | 每 2 周 | 全员 | 1 小时 | 回顾、改进点 |
| **Milestone Review** | 每个里程碑 | PM + Stakeholders | 2 小时 | 交付物评审、决策 |
| **Risk Review** | 每周五 | PM + Tech Lead | 30 分钟 | 风险更新、应对 |

### 6.2 沟通渠道

| 渠道                       | 用途                       | 响应时间   |
| -------------------------- | -------------------------- | ---------- |
| **Slack #roo-wasm**        | 日常沟通、快速问答         | < 1 小时   |
| **Slack #roo-wasm-alerts** | CI/CD 通知、监控告警       | 实时       |
| **GitHub Issues**          | Bug 跟踪、功能请求         | < 1 工作日 |
| **GitHub Discussions**     | 技术讨论、RFC              | < 2 工作日 |
| **Confluence**             | 文档、设计方案             | 异步       |
| **Email**                  | 正式沟通、Stakeholder 更新 | < 1 工作日 |

### 6.3 报告机制

#### 周报（每周五）

**收件人**: Stakeholders, 团队  
**内容**:

- 本周进度（已完成任务、进度百分比）
- 下周计划
- 风险与阻塞
- 需要的支持

#### 里程碑报告

**收件人**: Stakeholders, 管理层  
**内容**:

- 里程碑交付物清单
- 验收标准达成情况
- 预算使用情况
- 下个里程碑计划

---

## 7. 知识管理

### 7.1 文档结构

```
docs/
├── 00-README.md                    # 文档导航
├── 01-project-overview.md          # 项目概览
├── 30-cross-platform-evaluation.md # 评估报告
├── 31-cross-platform-master-plan.md # 主计划（本文档）
├── 31-phase-0-preparation.md       # 阶段 0 详细计划
├── 31-phase-1-wasm-core.md         # 阶段 1 详细计划
├── 31-phase-2-adapters.md          # 阶段 2 详细计划
├── 31-phase-3-testing.md           # 阶段 3 详细计划
├── 31-phase-4-release.md           # 阶段 4 详细计划
├── architecture/
│   ├── host-interface-spec.md      # Host Interface 规范
│   ├── wasm-module-design.md       # WASM 模块设计
│   └── platform-adapter-guide.md   # 适配器开发指南
├── development/
│   ├── rust-coding-standards.md    # Rust 代码规范
│   ├── dev-setup-guide.md          # 开发环境搭建
│   ├── testing-guidelines.md       # 测试指南
│   └── debugging-guide.md          # 调试指南
├── api/
│   ├── host-interface-api.md       # Host Interface API 参考
│   ├── core-api.md                 # 核心 API 参考
│   └── adapter-api.md              # Adapter API 参考
└── user/
    ├── installation-guide.md       # 安装指南
    ├── quick-start.md              # 快速开始
    └── migration-guide.md          # 迁移指南（从旧版）
```

### 7.2 知识共享机制

#### 技术分享会（每 2 周）

- **时间**: 每周五下午 4:00-5:00
- **形式**: 轮流分享
- **主题示例**:
    - "Rust 所有权机制深度解析"
    - "WASM 性能优化技巧"
    - "Host Interface 设计模式"
    - "跨平台调试最佳实践"

#### 代码评审清单

```markdown
## Rust Code Review Checklist

### 代码质量

- [ ] 遵循 Rust 命名约定
- [ ] 避免 `unwrap()` 和 `panic!()`，使用 `Result`
- [ ] 文档注释完整（所有公共 API）
- [ ] 无 `unsafe` 代码（除非有充分理由）

### 性能

- [ ] 避免不必要的克隆
- [ ] 使用 `&str` 而非 `String` 作为参数
- [ ] 考虑使用 `Cow<str>` 处理可能的拷贝

### WASM 特定

- [ ] wasm-bindgen 类型正确导出
- [ ] 避免大量小的 FFI 调用
- [ ] 考虑批量操作减少边界穿越

### 测试

- [ ] 单元测试覆盖核心逻辑
- [ ] 错误路径有测试
- [ ] 性能关键路径有基准测试
```

---

## 8. 附录

### 8.1 术语表

| 术语               | 全称                       | 说明                               |
| ------------------ | -------------------------- | ---------------------------------- |
| **WASM**           | WebAssembly                | 可移植、高性能的二进制指令格式     |
| **FFI**            | Foreign Function Interface | 外部函数接口，用于跨语言调用       |
| **Host Interface** | -                          | WASM 模块与宿主环境的桥接接口      |
| **Adapter**        | Platform Adapter           | 平台适配器，实现 Host Interface    |
| **Tree-sitter**    | -                          | 增量式语法解析库                   |
| **wasm-bindgen**   | -                          | Rust/WASM 与 JavaScript 互操作工具 |
| **wasm-pack**      | -                          | WASM 项目构建工具                  |
| **Qdrant**         | -                          | 向量数据库，用于语义搜索           |
| **POC**            | Proof of Concept           | 概念验证                           |
| **FTE**            | Full-Time Equivalent       | 全职当量                           |

### 8.2 参考资源

#### 官方文档

- [Rust Book](https://doc.rust-lang.org/book/)
- [wasm-bindgen Guide](https://rustwasm.github.io/wasm-bindgen/)
- [WebAssembly Spec](https://webassembly.github.io/spec/)

#### 社区资源

- [Rust WASM Working Group](https://rustwasm.github.io/)
- [awesome-wasm](https://github.com/mbasso/awesome-wasm)
- [Rust Performance Book](https://nnethercote.github.io/perf-book/)

#### 相关项目

- [Figma - WASM in Production](https://www.figma.com/blog/webassembly-cut-figmas-load-time-by-3x/)
- [1Password - Rust + WASM](https://blog.1password.com/1password-8-the-story-so-far/)
- [Pyodide - Python in WASM](https://github.com/pyodide/pyodide)

### 8.3 决策记录（ADR）

#### ADR-001: 选择 Rust 作为核心语言

**日期**: 2025-10-12  
**状态**: ✅ Accepted  
**背景**: 需要选择 WASM 核心语言  
**决策**: 使用 Rust（80%）+ C++（20%）  
**理由**:

- Rust 拥有最成熟的 WASM 工具链
- 内存安全，无垃圾回收
- 性能接近 C++
- 生态丰富（serde, tokio 等）
  **后果**:
- 需要 Rust 培训
- 初期开发速度较慢
- 长期维护成本低

---

#### ADR-002: Host Interface 采用异步设计

**日期**: 2025-10-12  
**状态**: ✅ Accepted  
**背景**: Host Interface 中的 I/O 操作可能耗时  
**决策**: 所有 I/O 操作使用 `async fn`  
**理由**:

- 避免阻塞主线程
- 更好的性能（并发 I/O）
- 符合现代异步编程范式
  **后果**:
- 需要使用 `wasm-bindgen-futures`
- 增加复杂度
- 更好的用户体验

---

#### ADR-003: 采用 JSON 作为数据交换格式

**日期**: 2025-10-12  
**状态**: ✅ Accepted  
**背景**: WASM 与 Host 需要传递复杂数据结构  
**决策**: 统一使用 JSON 序列化  
**理由**:

- 跨语言通用
- 易于调试
- 工具支持好（jq, JSON.parse 等）
  **后果**:
- 性能略低于二进制格式
- 需要 Schema 验证
- 可后期优化为 MessagePack

---

### 8.4 快速链接

| 资源           | 链接                                           |
| -------------- | ---------------------------------------------- |
| **项目仓库**   | https://github.com/RooCodeInc/Roo-Code         |
| **项目看板**   | https://github.com/orgs/RooCodeInc/projects/5  |
| **CI/CD**      | https://github.com/RooCodeInc/Roo-Code/actions |
| **文档站**     | https://docs.roocode.com                       |
| **Slack**      | https://roocode.slack.com/archives/C05WASM     |
| **Confluence** | https://roocode.atlassian.net/wiki/spaces/WASM |

---

## 9. 版本历史

| 版本  | 日期       | 作者   | 变更说明               |
| ----- | ---------- | ------ | ---------------------- |
| 1.0.0 | 2025-10-12 | Roo AI | 初始版本，完整项目计划 |

---

## 10. 批准与签名

| 角色           | 姓名             | 签名             | 日期             |
| -------------- | ---------------- | ---------------- | ---------------- |
| **项目发起人** | \***\*\_\_\*\*** | \***\*\_\_\*\*** | \***\*\_\_\*\*** |
| **技术负责人** | \***\*\_\_\*\*** | \***\*\_\_\*\*** | \***\*\_\_\*\*** |
| **项目经理**   | \***\*\_\_\*\*** | \***\*\_\_\*\*** | \***\*\_\_\*\*** |

---

**文档结束**

下一步：请阅读各阶段详细计划文档：

- [阶段 0: 准备与验证](./31-phase-0-preparation.md)
- [阶段 1: WASM 核心开发](./31-phase-1-wasm-core.md)
- [阶段 2: 平台适配器开发](./31-phase-2-adapters.md)
- [阶段 3: 集成测试与优化](./31-phase-3-testing.md)
- [阶段 4: 文档与发布](./31-phase-4-release.md)
