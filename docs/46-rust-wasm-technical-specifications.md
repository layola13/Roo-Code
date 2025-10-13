# Rust WASM 技术规范和代码标准

**文档版本**: 1.0  
**创建日期**: 2025-10-13  
**状态**: ✅ 完成  
**任务**: 0.5 - 编写技术规范和代码标准文档

---

## 📋 目录

1. [架构规范](#架构规范)
2. [Rust 代码标准](#rust-代码标准)
3. [TypeScript 集成标准](#typescript-集成标准)
4. [Host Interface 规范](#host-interface-规范)
5. [测试标准](#测试标准)
6. [性能标准](#性能标准)
7. [文档标准](#文档标准)
8. [版本控制规范](#版本控制规范)

---

## 🏗️ 架构规范

### 1.1 分层架构

系统采用严格的三层架构：

```
┌─────────────────────────────────────────────┐
│         VSCode Extension Layer              │
│         (TypeScript)                        │
│  - 插件入口和生命周期管理                    │
│  - UI 组件 (React/Webview)                  │
│  - 命令处理器                               │
└──────────────────┬──────────────────────────┘
                   │
                   │ WASM Loader
                   │
┌──────────────────▼──────────────────────────┐
│       Host Interface Layer                  │
│       (TypeScript ⇄ Rust FFI)              │
│  - 22个接口函数                             │
│  - 异步调用管理                             │
│  - 错误处理和类型转换                        │
└──────────────────┬──────────────────────────┘
                   │
                   │ wasm-bindgen
                   │
┌──────────────────▼──────────────────────────┐
│         Rust Core Logic Layer               │
│         (WASM)                              │
│  - 任务系统                                 │
│  - API 集成                                 │
│  - 工具系统                                 │
│  - 对话管理                                 │
│  - 记忆系统                                 │
│  - 代码索引                                 │
└─────────────────────────────────────────────┘
```

**规则**:

- ✅ Rust 层只能通过 Host Interface 与外部交互
- ✅ TypeScript 层通过 WASM Loader 调用 Rust 函数
- ❌ 禁止跨层直接调用
- ❌ 禁止循环依赖

### 1.2 模块划分

#### Rust 核心模块

| 模块                | 职责                    | 文件                     | 状态        |
| ------------------- | ----------------------- | ------------------------ | ----------- |
| **task_engine**     | 任务生命周期管理        | `src/task_engine.rs`     | ✅ 骨架完成 |
| **api_integration** | AI 提供商集成           | `src/api_integration.rs` | ✅ 骨架完成 |
| **tools**           | 工具系统和调用          | `src/tools.rs`           | ✅ 骨架完成 |
| **conversation**    | 对话历史管理            | `src/conversation.rs`    | ✅ 骨架完成 |
| **memory**          | 记忆系统                | `src/memory.rs`          | ✅ 骨架完成 |
| **code_index**      | 代码索引（Tree-sitter） | `src/code_index.rs`      | ⏳ 待实现   |
| **host_interface**  | FFI 接口定义            | `src/host_interface.rs`  | ✅ 完成     |
| **utils**           | 工具函数                | `src/utils.rs`           | ✅ 完成     |

#### TypeScript 集成模块

| 模块              | 职责                | 文件                                    | 状态    |
| ----------------- | ------------------- | --------------------------------------- | ------- |
| **HostInterface** | Host Interface 实现 | `src/integration/wasm/HostInterface.ts` | ✅ 完成 |
| **WasmLoader**    | WASM 加载和初始化   | `src/integration/wasm/WasmLoader.ts`    | ✅ 完成 |
| **Tests**         | 集成测试            | `src/integration/wasm/__tests__/`       | ✅ 完成 |

---

## 🦀 Rust 代码标准

### 2.1 命名规范

#### 文件命名

- **模块文件**: 使用蛇形命名法 `snake_case`
    ```
    ✅ task_engine.rs
    ✅ api_integration.rs
    ❌ TaskEngine.rs
    ❌ apiIntegration.rs
    ```

#### 类型命名

- **结构体 (Struct)**: 使用帕斯卡命名法 `PascalCase`

    ```rust
    ✅ struct Task { ... }
    ✅ struct ApiRequest { ... }
    ❌ struct task { ... }
    ```

- **枚举 (Enum)**: 使用帕斯卡命名法

    ```rust
    ✅ enum TaskState { Created, Running, Completed }
    ✅ enum ApiProvider { Anthropic, OpenAI }
    ❌ enum task_state { ... }
    ```

- **特征 (Trait)**: 使用帕斯卡命名法
    ```rust
    ✅ trait TaskEngine { ... }
    ✅ trait Serializable { ... }
    ```

#### 函数和变量命名

- **函数**: 使用蛇形命名法

    ```rust
    ✅ fn create_task() { ... }
    ✅ fn update_task_state() { ... }
    ❌ fn createTask() { ... }
    ```

- **变量**: 使用蛇形命名法

    ```rust
    ✅ let task_id = generate_id();
    ✅ let api_response = fetch_data();
    ❌ let taskId = ...;
    ```

- **常量**: 使用全大写蛇形命名法
    ```rust
    ✅ const MAX_RETRIES: u32 = 3;
    ✅ const DEFAULT_TIMEOUT_MS: u64 = 5000;
    ❌ const maxRetries: u32 = 3;
    ```

### 2.2 代码组织

#### 模块结构

```rust
//! 模块文档注释
//!
//! 详细描述模块的职责和用法

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

// 1. 类型定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub state: TaskState,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum TaskState {
    Created,
    Running,
    Completed,
}

// 2. 实现块
impl Task {
    pub fn new(title: String) -> Self {
        Self {
            id: generate_id(),
            title,
            state: TaskState::Created,
        }
    }
}

// 3. WASM 导出函数
#[wasm_bindgen]
pub async fn create_task(title: String) -> String {
    let task = Task::new(title);
    task.id
}

// 4. 内部辅助函数
fn generate_id() -> String {
    // 实现
}

// 5. 测试模块
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_creation() {
        // 测试代码
    }
}
```

### 2.3 错误处理

#### 使用 Result 类型

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum TaskError {
    #[error("Task not found: {0}")]
    NotFound(String),

    #[error("Invalid state transition: {from} -> {to}")]
    InvalidTransition { from: String, to: String },

    #[error("Host interface error: {0}")]
    HostError(String),
}

pub type Result<T> = std::result::Result<T, TaskError>;

// 使用示例
pub fn get_task(id: &str) -> Result<Task> {
    TASKS.get(id)
        .ok_or_else(|| TaskError::NotFound(id.to_string()))
}
```

#### WASM 错误处理

```rust
#[wasm_bindgen]
pub async fn create_task_safe(title: String) -> JsValue {
    match create_task_internal(title).await {
        Ok(task_id) => serde_wasm_bindgen::to_value(&task_id).unwrap(),
        Err(e) => {
            // 记录错误
            log::error!("Failed to create task: {}", e);
            // 返回错误对象
            serde_wasm_bindgen::to_value(&json!({
                "error": e.to_string()
            })).unwrap()
        }
    }
}
```

### 2.4 异步编程

#### 使用 async/await

```rust
use wasm_bindgen_futures::JsFuture;

#[wasm_bindgen]
pub async fn fetch_data(url: String) -> Result<String> {
    // 调用 Host Interface
    let response = http_request(url, json!({
        "method": "GET"
    })).await;

    // 处理响应
    let data: HttpResponse = serde_wasm_bindgen::from_value(response)?;

    Ok(data.body)
}
```

#### 并发处理

```rust
use futures::future::join_all;

pub async fn batch_process(items: Vec<String>) -> Vec<Result<String>> {
    let futures: Vec<_> = items
        .into_iter()
        .map(|item| process_item(item))
        .collect();

    join_all(futures).await
}
```

### 2.5 序列化标准

#### Serde 配置

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")] // JavaScript 风格
pub struct Task {
    pub task_id: String,        // 序列化为 "taskId"
    pub created_at: u64,        // 序列化为 "createdAt"

    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>, // 空值时不序列化
}
```

### 2.6 文档注释

#### 公共 API 文档

````rust
/// 创建新任务
///
/// # 参数
///
/// * `title` - 任务标题
/// * `description` - 任务描述
///
/// # 返回值
///
/// 返回新创建的任务 ID
///
/// # 示例
///
/// ```
/// let task_id = create_task("My Task".to_string(), "Description".to_string()).await;
/// ```
///
/// # 错误
///
/// 如果 title 为空，返回 `TaskError::InvalidInput`
#[wasm_bindgen]
pub async fn create_task(title: String, description: String) -> Result<String> {
    // 实现
}
````

---

## 📘 TypeScript 集成标准

### 3.1 Host Interface 实现规范

#### 函数签名

```typescript
export class HostInterface {
	/**
	 * 读取文件内容
	 * @param filePath 文件路径（绝对路径或相对于工作区）
	 * @returns 文件内容
	 * @throws 如果文件不存在或无法读取
	 */
	async readFile(filePath: string): Promise<string> {
		try {
			const absolutePath = this.resolveWorkspacePath(filePath)
			const content = await fs.readFile(absolutePath, "utf-8")
			return content
		} catch (error) {
			throw new Error(`Failed to read file ${filePath}: ${error}`)
		}
	}
}
```

#### 错误处理

```typescript
// ✅ 正确：捕获并转换错误
async executeCommand(command: string): Promise<string> {
    try {
        const { stdout, stderr } = await execAsync(command)
        return stdout + (stderr ? `\nSTDERR:\n${stderr}` : "")
    } catch (error: any) {
        throw new Error(
            `Command failed: ${command}\n` +
            `Exit code: ${error.code}\n` +
            `Output: ${error.stdout}\n` +
            `Error: ${error.stderr}`
        )
    }
}

// ❌ 错误：直接抛出原始错误
async executeCommand(command: string): Promise<string> {
    const { stdout } = await execAsync(command) // 未捕获错误
    return stdout
}
```

### 3.2 WASM 加载器规范

#### 初始化

```typescript
export class WasmLoader {
	private wasmModule: RooWasmModule | null = null
	private isInitialized: boolean = false
	private initPromise: Promise<void> | null = null

	/**
	 * 初始化 WASM 模块（幂等操作）
	 */
	async initialize(options: WasmInitOptions = {}): Promise<void> {
		// 防止重复初始化
		if (this.isInitialized) {
			return
		}

		if (this.initPromise) {
			return this.initPromise
		}

		this.initPromise = this._doInitialize(options)
		await this.initPromise
	}
}
```

#### Host Interface 注入

```typescript
private injectHostInterface(wasmBindgen: any): void {
    const hostInterface = getHostInterface()

    // 注入到全局对象
    ;(globalThis as any).__HOST_INTERFACE__ = {
        // 文件系统
        readFile: (path: string) => hostInterface.readFile(path),
        writeFile: (path: string, content: string) =>
            hostInterface.writeFile(path, content),
        // ... 其他22个函数
    }
}
```

### 3.3 类型定义

#### WASM 模块接口

```typescript
/**
 * WASM 模块接口（由 wasm-bindgen 生成）
 */
export interface RooWasmModule {
    /** 初始化
```
