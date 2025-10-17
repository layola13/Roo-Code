# WASM 开发者指南

## 概述

本文档面向希望理解、修改或扩展 Roo-Code WASM 模块的开发者。涵盖架构设计、开发环境设置、构建流程、调试技巧和最佳实践。

## 📐 架构概览

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     VSCode Extension Host                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              TypeScript Extension Layer               │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────┐     │  │
│  │  │         TypeScript Adapters                 │     │  │
│  │  │  (TaskAdapter, ToolsAdapter, etc.)          │     │  │
│  │  │                                             │     │  │
│  │  │  - Fallback Logic                           │     │  │
│  │  │  - Error Handling                           │     │  │
│  │  │  - Config Management                        │     │  │
│  │  └─────────────────────────────────────────────┘     │  │
│  │              ↕ wasm-bindgen FFI                       │  │
│  │  ┌─────────────────────────────────────────────┐     │  │
│  │  │           WASM Runtime                      │     │  │
│  │  │  (task-engine.wasm, tools.wasm, etc.)       │     │  │
│  │  │                                             │     │  │
│  │  │  - Rust Logic                               │     │  │
│  │  │  - Memory Management                        │     │  │
│  │  │  - Performance Optimization                 │     │  │
│  │  └─────────────────────────────────────────────┘     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 模块层次结构

```
rust-wasm/
├── Cargo.toml              # Workspace 配置
├── task-engine/            # 任务引擎模块
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs         # WASM 导出接口
│   │   ├── engine.rs      # 核心引擎逻辑
│   │   └── state.rs       # 状态管理
├── api-integration/        # API 集成模块
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs         # WASM 导出接口
│   │   ├── anthropic.rs   # Anthropic 提供者
│   │   └── openai.rs      # OpenAI 提供者
├── tools/                  # 工具系统模块
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs         # WASM 导出接口
│   │   ├── registry.rs    # 工具注册
│   │   └── validator.rs   # 参数验证
├── conversation/           # 对话管理模块
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs         # WASM 导出接口
│   │   └── history.rs     # 历史管理
└── memory/                 # 记忆系统模块
    ├── Cargo.toml
    ├── src/
    │   ├── lib.rs         # WASM 导出接口
    │   └── store.rs       # 存储逻辑
```

## 🛠️ 开发环境设置

### 前置要求

1. **Rust 工具链** (>= 1.70.0)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
```

2. **wasm-pack** (>= 0.12.0)

```bash
cargo install wasm-pack
```

3. **Node.js & pnpm** (>= 18.0.0)

```bash
# 已安装在项目中
node --version  # v18.0.0+
pnpm --version  # v8.0.0+
```

4. **VSCode 扩展开发工具**

- 安装 `rust-analyzer` 扩展
- 安装 `Even Better TOML` 扩展

### 克隆和构建

```bash
# 1. 克隆仓库
git clone https://github.com/RooVetGit/Roo-Cline.git
cd Roo-Cline

# 2. 安装依赖
pnpm install

# 3. 构建 WASM 模块
cd rust-wasm
./build-all.sh  # 或在 Windows: build-all.bat

# 4. 构建整个项目
cd ..
pnpm build
```

### IDE 配置

**VSCode 设置** (`.vscode/settings.json`)：

```json
{
	"rust-analyzer.cargo.target": "wasm32-unknown-unknown",
	"rust-analyzer.checkOnSave.allTargets": false,
	"rust-analyzer.cargo.features": ["wasm"],
	"editor.formatOnSave": true,
	"[rust]": {
		"editor.defaultFormatter": "rust-lang.rust-analyzer"
	}
}
```

## 🏗️ 模块详解

### 1. Task Engine（任务引擎）

**位置**：`rust-wasm/task-engine/`

**职责**：

- 任务状态管理（pending, running, completed, failed）
- 任务元数据存储（taskId, mode, timestamp）
- 生命周期控制（init, start, pause, resume, complete）

**核心 API**：

```rust
#[wasm_bindgen]
pub struct TaskEngine {
    task_id: String,
    mode: String,
    state: HashMap<String, JsValue>,
}

#[wasm_bindgen]
impl TaskEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(task_id: String, mode: String) -> Result<TaskEngine, JsValue>;

    pub fn set_state(&mut self, key: String, value: JsValue) -> Result<(), JsValue>;

    pub fn get_state(&self, key: String) -> Result<JsValue, JsValue>;

    pub fn get_all_state(&self) -> Result<JsValue, JsValue>;
}
```

**TypeScript Adapter**：`src/core/wasm/adapters/TaskAdapter.ts`

**调用示例**：

```typescript
import * as TaskWasm from "../../../wasm-dist/task-engine/roo_task_engine"

const engine = new TaskWasm.TaskEngine(taskId, mode)
await engine.set_state("status", "running")
const status = await engine.get_state("status")
```

### 2. API Integration（API 集成）

**位置**：`rust-wasm/api-integration/`

**职责**：

- Anthropic Claude API 请求构造和响应解析
- OpenAI API 请求构造和响应解析
- 统一的提供者接口（Provider trait）
- 流式响应处理

**核心 API**：

```rust
#[wasm_bindgen]
pub struct ApiIntegration {
    provider: Box<dyn Provider>,
}

#[wasm_bindgen]
impl ApiIntegration {
    #[wasm_bindgen(constructor)]
    pub fn new(provider_type: String, api_key: String) -> Result<ApiIntegration, JsValue>;

    pub async fn create_request(&self, model: String, messages: JsValue) -> Result<JsValue, JsValue>;

    pub async fn parse_response(&self, response: JsValue) -> Result<JsValue, JsValue>;
}
```

**TypeScript Adapter**：`src/core/wasm/adapters/ApiAdapter.ts`（未完全迁移）

### 3. Tools System（工具系统）

**位置**：`rust-wasm/tools/`

**职责**：

- 工具注册和管理
- 工具参数验证（类型检查、必填检查）
- 工具执行追踪和日志

**核心 API**：

```rust
#[wasm_bindgen]
pub struct ToolsRegistry {
    tools: HashMap<String, Tool>,
}

#[wasm_bindgen]
impl ToolsRegistry {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ToolsRegistry;

    pub fn register_tool(&mut self, name: String, definition: JsValue) -> Result<(), JsValue>;

    pub fn validate_params(&self, tool_name: String, params: JsValue) -> Result<bool, JsValue>;

    pub fn get_tool(&self, name: String) -> Result<JsValue, JsValue>;
}
```

**TypeScript Adapter**：`src/core/wasm/adapters/ToolsAdapter.ts`

### 4. Conversation（对话管理）

**位置**：`rust-wasm/conversation/`

**职责**：

- 对话历史存储
- 消息管理（添加、删除、查询）
- 上下文压缩（token 计数）

**核心 API**：

```rust
#[wasm_bindgen]
pub struct Conversation {
    messages: Vec<Message>,
    max_history: usize,
}

#[wasm_bindgen]
impl Conversation {
    #[wasm_bindgen(constructor)]
    pub fn new(max_history: usize) -> Conversation;

    pub fn add_message(&mut self, role: String, content: String) -> Result<(), JsValue>;

    pub fn get_messages(&self, limit: Option<usize>) -> Result<JsValue, JsValue>;

    pub fn clear(&mut self);
}
```

**TypeScript Adapter**：`src/core/wasm/adapters/ConversationAdapter.ts`

### 5. Memory（记忆系统）

**位置**：`rust-wasm/memory/`

**职责**：

- 短期记忆存储（会话期间）
- 长期记忆管理（持久化）
- 记忆检索和过期

**核心 API**：

```rust
#[wasm_bindgen]
pub struct Memory {
    short_term: HashMap<String, MemoryItem>,
    long_term: HashMap<String, MemoryItem>,
}

#[wasm_bindgen]
impl Memory {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Memory;

    pub fn store(&mut self, key: String, value: JsValue, ttl: Option<u64>) -> Result<(), JsValue>;

    pub fn retrieve(&self, key: String) -> Result<JsValue, JsValue>;

    pub fn delete(&mut self, key: String) -> Result<bool, JsValue>;
}
```

**TypeScript Adapter**：`src/core/wasm/adapters/MemoryAdapter.ts`

## 🔨 构建流程

### 单个模块构建

```bash
cd rust-wasm/task-engine
wasm-pack build --target web --out-dir ../../wasm-dist/task-engine
```

### 所有模块构建

```bash
cd rust-wasm
./build-all.sh
```

**build-all.sh 内容**：

```bash
#!/bin/bash
set -e

echo "Building all WASM modules..."

# Task Engine
echo "Building task-engine..."
cd task-engine
wasm-pack build --target web --out-dir ../../wasm-dist/task-engine
cd ..

# API Integration
echo "Building api-integration..."
cd api-integration
wasm-pack build --target web --out-dir ../../wasm-dist/api-integration
cd ..

# Tools
echo "Building tools..."
cd tools
wasm-pack build --target web --out-dir ../../wasm-dist/tools
cd ..

# Conversation (如果存在)
if [ -d "conversation" ]; then
    echo "Building conversation..."
    cd conversation
    wasm-pack build --target web --out-dir ../../wasm-dist/conversation
    cd ..
fi

# Memory (如果存在)
if [ -d "memory" ]; then
    echo "Building memory..."
    cd memory
    wasm-pack build --target web --out-dir ../../wasm-dist/memory
    cd ..
fi

echo "All WASM modules built successfully!"
```

### 构建产物

构建后会生成：

```
wasm-dist/
├── task-engine/
│   ├── roo_task_engine_bg.wasm     # WASM 二进制
│   ├── roo_task_engine.js          # JS 绑定
│   ├── roo_task_engine.d.ts        # TypeScript 类型
│   └── package.json
├── api-integration/
│   ├── roo_api_integration_bg.wasm
│   ├── roo_api_integration.js
│   ├── roo_api_integration.d.ts
│   └── package.json
└── tools/
    ├── roo_tools_bg.wasm
    ├── roo_tools.js
    ├── roo_tools.d.ts
    └── package.json
```

## 🧪 测试

### Rust 单元测试

```bash
cd rust-wasm/task-engine
cargo test
```

**测试示例**：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_engine_creation() {
        let engine = TaskEngine::new("task-1".to_string(), "code".to_string());
        assert!(engine.is_ok());
    }

    #[test]
    fn test_state_management() {
        let mut engine = TaskEngine::new("task-1".to_string(), "code".to_string()).unwrap();
        engine.set_state("key".to_string(), JsValue::from_str("value")).unwrap();
        let value = engine.get_state("key".to_string()).unwrap();
        assert_eq!(value.as_string().unwrap(), "value");
    }
}
```

### TypeScript 集成测试

```bash
cd src
npx vitest run core/wasm/__tests__/integration/adapters-integration.test.ts
```

**测试示例**：

```typescript
describe("TaskAdapter Integration", () => {
  it("should initialize WASM engine", async () => {
    const adapter = new TaskAdapter("task-1", "code", mockHostInterface)
    await adapter.init()
    expect(adapter.isInitialized()).toBe(true)
  })

  it("should fallback to TypeScript on WASM failure", async () => {
    // 模拟 WASM 失败
```
