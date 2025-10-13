# Rust WASM 编码标准

本文档定义了 Roo-Code Rust WASM 项目的编码标准。

## 📋 快速参考

### 命名规范

| 类型   | 规则                 | 示例                |
| ------ | -------------------- | ------------------- |
| 文件   | snake_case           | `task_engine.rs`    |
| 结构体 | PascalCase           | `struct Task`       |
| 枚举   | PascalCase           | `enum TaskState`    |
| 函数   | snake_case           | `fn create_task()`  |
| 变量   | snake_case           | `let task_id`       |
| 常量   | SCREAMING_SNAKE_CASE | `const MAX_RETRIES` |

### 代码组织

```rust
// 1. 模块文档
//! 模块描述

// 2. 导入
use wasm_bindgen::prelude::*;

// 3. 类型定义
pub struct Task { ... }

// 4. 实现
impl Task { ... }

// 5. WASM 导出
#[wasm_bindgen]
pub async fn create_task() { ... }

// 6. 测试
#[cfg(test)]
mod tests { ... }
```

### 错误处理

```rust
// ✅ 使用 Result
pub fn get_task(id: &str) -> Result<Task, TaskError> {
    TASKS.get(id)
        .ok_or_else(|| TaskError::NotFound(id.to_string()))
}

// ✅ WASM 边界错误处理
#[wasm_bindgen]
pub async fn safe_operation() -> JsValue {
    match operation().await {
        Ok(result) => to_value(&result).unwrap(),
        Err(e) => to_value(&json!({ "error": e.to_string() })).unwrap()
    }
}
```

### 异步编程

```rust
// ✅ 使用 async/await
#[wasm_bindgen]
pub async fn fetch_data(url: String) -> Result<String> {
    let response = http_request(url).await;
    Ok(response)
}

// ✅ 并发处理
use futures::future::join_all;

pub async fn batch_process(items: Vec<String>) -> Vec<Result<String>> {
    let futures: Vec<_> = items
        .into_iter()
        .map(|item| process_item(item))
        .collect();

    join_all(futures).await
}
```

### 序列化

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")] // JavaScript 风格
pub struct Task {
    pub task_id: String,        // → "taskId"
    pub created_at: u64,        // → "createdAt"

    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>, // 空值时不序列化
}
```

### 文档注释

```rust
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
/// # 错误
///
/// 如果 title 为空，返回 `TaskError::InvalidInput`
#[wasm_bindgen]
pub async fn create_task(title: String, description: String) -> Result<String> {
    // 实现
}
```

## 🧪 测试标准

### 单元测试

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_creation() {
        let task = Task::new("Test".to_string());
        assert_eq!(task.state, TaskState::Created);
    }

    #[test]
    fn test_error_handling() {
        let result = get_task("nonexistent");
        assert!(result.is_err());
    }
}
```

### 测试覆盖率

- **目标**: ≥ 80%
- **运行**: `cargo test`
- **覆盖率**: `cargo tarpaulin --out Html`

## ⚡ 性能标准

| 指标          | 目标    | 测量方法               |
| ------------- | ------- | ---------------------- |
| WASM 文件大小 | < 2 MB  | `ls -lh pkg/*.wasm`    |
| 构建时间      | < 30s   | `time wasm-pack build` |
| 初始化时间    | < 500ms | 性能测试               |
| FFI 调用开销  | < 1ms   | 基准测试               |

### 优化配置

```toml
[profile.release]
opt-level = "z"      # 大小优化
lto = true           # 链接时优化
codegen-units = 1    # 更好的优化
strip = true         # 删除符号
panic = "abort"      # 更小的 panic
```

## 📝 提交规范

### Commit Message 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型**:

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建/工具

**示例**:

```
feat(task_engine): 实现任务状态转换

- 添加 TaskState 枚举
- 实现状态验证
- 添加单元测试

Closes #123
```

## 🔍 代码审查清单

- [ ] 遵循命名规范
- [ ] 添加文档注释
- [ ] 错误处理完整
- [ ] 测试覆盖率 ≥ 80%
- [ ] 无 clippy 警告
- [ ] 性能符合标准
- [ ] WASM 大小 < 2MB

## 📚 参考资源

- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- [wasm-bindgen Guide](https://rustwasm.github.io/wasm-bindgen/)
- [Rust Book](https://doc.rust-lang.org/book/)
