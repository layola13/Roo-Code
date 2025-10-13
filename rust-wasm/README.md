# Roo-Code Rust+WASM Core

这是Roo-Code VSCode插件的Rust核心逻辑，编译为WebAssembly以实现跨平台兼容性。

## 项目结构

```
rust-wasm/
├── src/
│   ├── lib.rs                  # 主入口文件
│   ├── host_interface.rs       # Host Interface定义（22个函数）
│   ├── task_engine.rs          # 任务引擎
│   ├── api_integration.rs      # API集成
│   ├── tools.rs                # 工具系统
│   ├── conversation.rs         # 对话管理
│   ├── memory.rs               # 记忆系统
│   └── utils.rs                # 工具函数
├── Cargo.toml                  # Rust项目配置
├── pkg/                        # WASM构建输出
│   ├── roo_core_bg.wasm       # WASM二进制文件 (57KB)
│   ├── roo_core.js            # JavaScript绑定
│   └── roo_core.d.ts          # TypeScript类型定义
└── README.md                   # 本文件
```

## 工具链要求

- Rust 1.90.0+
- cargo 1.90.0+
- wasm-pack 0.13.1+
- rustup target: `wasm32-unknown-unknown`

## 快速开始

### 1. 安装依赖

```bash
# 安装Rust（如果尚未安装）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 添加WASM目标
rustup target add wasm32-unknown-unknown

# 安装wasm-pack
cargo install wasm-pack
```

### 2. 构建项目

```bash
# 开发构建（未优化）
cargo build

# 运行测试
cargo test

# 构建WASM
wasm-pack build --target web
```

### 3. 发布构建

```bash
# 优化构建
cargo build --release

# WASM发布构建
wasm-pack build --target web --release
```

## 核心模块

### Host Interface

定义了WASM与宿主环境（TypeScript/VSCode）之间的22个接口函数：

- **文件系统** (7): `readFile`, `writeFile`, `fileExists`, `listDir`, `createDir`, `deleteFile`, `getFileMetadata`
- **终端操作** (3): `executeCommand`, `getTerminalOutput`, `killProcess`
- **UI交互** (4): `showNotification`, `askApproval`, `askInput`, `showError`
- **网络** (2): `httpRequest`, `httpStream`
- **配置** (2): `getConfig`, `setConfig`
- **向量数据库** (2): `vectorSearch`, `vectorInsert`

### Task Engine

任务生命周期管理：

- 9种任务状态：`Created`, `Running`, `Paused`, `Interactive`, `Resumable`, `Idle`, `Completed`, `Failed`, `Aborted`
- 子任务支持
- 状态机实现

### API Integration

AI提供商集成：

- Anthropic (Claude)
- OpenAI (GPT)
- Gemini
- Ollama

### Tools System

工具执行和管理：

- 文件操作工具
- 代码编辑工具
- 搜索工具
- 执行工具

### Conversation

对话历史管理：

- 消息角色：`User`, `Assistant`, `System`
- 消息持久化
- 格式转换

### Memory System

记忆系统：

- 6种记忆类型：`UserInstruction`, `TechnicalDecision`, `Configuration`, `ImportantError`, `ProjectContext`, `WorkflowPattern`
- 4种优先级：`Critical`, `High`, `Medium`, `Low`

## 测试

```bash
# 运行所有测试
cargo test

# 运行特定测试
cargo test test_task_engine

# 显示测试输出
cargo test -- --nocapture
```

## 性能指标

- WASM文件大小：57KB（未优化）
- 构建时间：< 25秒
- 测试通过率：100% (8/8 passed)

## 开发状态

✅ **已完成** (任务0.3):

- Rust工具链搭建
- WASM构建环境配置
- 核心模块骨架实现
- Host Interface定义
- 单元测试框架

⏳ **进行中**:

- POC验证（任务0.4）

📋 **待完成**:

- 完整功能实现（阶段1）
- TypeScript集成（阶段2）
- 测试和优化（阶段3）

## 技术债务

1. **WASM优化暂时禁用**: 由于wasm-opt需要额外的特性标志，当前禁用了优化。后续需要配置正确的特性标志以启用优化。
2. **WASM专用测试**: 某些测试（如`test_create_task`, `test_generate_id`）需要在WASM环境中运行，已使用`#[cfg(target_arch = "wasm32")]`标记。

## 参考文档

- [Rust WASM Book](https://rustwasm.github.io/docs/book/)
- [wasm-bindgen Guide](https://rustwasm.github.io/docs/wasm-bindgen/)
- [项目评估文档](../docs/43-codebase-evaluation-for-rust-wasm-migration.md)
- [迁移范围文档](../docs/44-rust-wasm-migration-scope-and-priorities.md)

## 贡献指南

1. 遵循Rust代码风格（`rustfmt`）
2. 所有新功能必须包含测试
3. 保持WASM文件大小 < 2MB
4. 确保跨平台兼容性

## 许可证

MIT
