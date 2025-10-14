# OpenAI Provider 实现问题追踪

## 文档信息

- **创建时间**: 2025-10-13
- **状态**: 进行中
- **优先级**: 高

## 当前问题

### 1. 编译错误

#### 1.1 缺少依赖

```
error[E0433]: failed to resolve: use of unresolved module or unlinked crate `tokio`
```

**原因**: `tokio` 仅在 `dev-dependencies` 中，但在源代码中使用了 `tokio::sync::mpsc`

**解决方案**:

- 选项A: 将tokio添加到dependencies（但WASM不支持tokio的运行时）
- 选项B: 使用futures crate的channel
- **推荐**: 使用`futures::channel::mpsc`替代`tokio::sync::mpsc`

#### 1.2 缺少HttpRequest类型

```
error[E0432]: unresolved import `crate::client::HttpRequest`
```

**原因**: `client.rs`中没有导出`HttpRequest`结构体

**解决方案**: 在`client.rs`中创建`HttpRequest`结构体或使用现有的`HttpRequestOptions`

#### 1.3 缺少ToolUseBlock和ToolResultBlock

```
error[E0432]: unresolved imports `crate::types::ToolUseBlock`, `crate::types::ToolResultBlock`
```

**原因**: `types.rs`中ContentBlock枚举包含ToolUse和ToolResult，但没有单独的结构体

**解决方案**:

```rust
// 修改 openai.rs 的导入
use crate::types::{..., ContentBlock};

// 在代码中匹配ContentBlock枚举
match block {
    ContentBlock::ToolUse { id, name, input } => { ... }
    ContentBlock::ToolResult { tool_use_id, content, is_error } => { ... }
}
```

#### 1.4 ApiHandlerOptions缺少字段

```
error[E0609]: no field `openai_r1_format_enabled` on type `ApiHandlerOptions`
```

**缺少的字段**:

- `openai_r1_format_enabled`
- `openai_legacy_format`
- `openai_streaming_enabled`
- `openai_api_key`
- `openai_headers`
- `model_info`
- `model_temperature`
- `model_max_tokens`
- `include_max_tokens`

**解决方案**: 扩展`ApiHandlerOptions`结构体

### 2. 语法错误

#### 2.1 测试代码截断

**位置**: Line 828-830

```rust
provider.apply_prompt
                        non_tool_
_caching(&mut messages);
```

**原因**: 文件写入时被截断

**解决方案**: 重写测试代码或删除损坏的测试

### 3. 架构问题

#### 3.1 WASM环境限制

- **问题**: WASM不支持tokio运行时
- **影响**: 异步代码需要使用wasm-bindgen-futures
- **解决方案**:
    - 使用`futures::channel::mpsc`
    - 使用`wasm_bindgen_futures::spawn_local`

#### 3.2 HttpClient接口不匹配

- **当前**: `client.request(method, url, headers, body, timeout)`
- **OpenAI需要**: 结构化的HttpRequest
- **解决方案**: 创建HttpRequest适配器或修改client API

## 实现策略

### 阶段1: 修复类型系统（立即）

1. 扩展`ApiHandlerOptions`添加所有OpenAI相关字段
2. 在`client.rs`创建`HttpRequest`结构体
3. 修复`openai.rs`的导入语句

### 阶段2: 替换异步运行时（立即）

1. 将`tokio::sync::mpsc`替换为`futures::channel::mpsc`
2. 更新所有channel相关代码
3. 使用`wasm_bindgen_futures::spawn_local`替代`tokio::spawn`

### 阶段3: 简化实现（短期）

1. 移除O3/O1特殊处理（可后续添加）
2. 移除R1格式支持（可后续添加）
3. 移除XmlMatcher（可后续添加）
4. 专注核心功能：基础消息转换+SSE解析

### 阶段4: 完善功能（中期）

1. 添加Prompt Caching支持
2. 添加工具调用支持
3. 添加特殊模型支持（O3/R1）
4. 添加XML reasoning解析

### 阶段5: 测试和优化（中期）

1. 编写单元测试
2. 编写集成测试
3. 性能优化
4. WASM大小优化

## 代码修复清单

### types.rs

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiHandlerOptions {
    // ... 现有字段 ...

    // OpenAI扩展
    pub openai_api_key: Option<String>,
    pub openai_headers: Option<HashMap<String, String>>,
    pub openai_r1_format_enabled: Option<bool>,
    pub openai_legacy_format: Option<bool>,
    pub openai_streaming_enabled: Option<bool>,
    pub openai_use_azure: Option<bool>,
    pub azure_api_version: Option<String>,

    // Model配置
    pub model_info: Option<ModelInfo>,
    pub model_temperature: Option<f64>,
    pub model_max_tokens: Option<u32>,
    pub include_max_tokens: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub max_tokens: Option<u32>,
    pub context_window: u32,
    pub supports_prompt_cache: bool,
    pub reasoning_effort: Option<String>,
    // ... 其他字段 ...
}
```

### client.rs

```rust
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
    pub timeout_ms: u32,
}

impl HttpClient {
    pub async fn request(&self, req: HttpRequest) -> ApiResult<HttpResponse> {
        let mut headers_map = HashMap::new();
        for (k, v) in req.headers {
            headers_map.insert(k, v);
        }

        self.request_internal(
            &req.method,
            &req.url,
            headers_map,
            Some(req.body),
            Some(req.timeout_ms)
        ).await
    }
}
```

### openai.rs

```rust
// 替换所有 tokio::sync::mpsc 为 futures::channel::mpsc
use futures::channel::mpsc;

// 替换 tokio::spawn 为 wasm_bindgen_futures::spawn_local
wasm_bindgen_futures::spawn_local(async move {
    if let Err(e) = Self::parse_sse_stream(response.body, tx).await {
        let _ = tx.try_send(ApiStreamChunk::Error {
            error: e.to_string(),
        });
    }
});

// 修复ContentBlock匹配
match block {
    ContentBlock::Text { text, .. } => { ... }
    ContentBlock::Image { source, .. } => { ... }
    ContentBlock::ToolUse { id, name, input } => { ... }
    ContentBlock::ToolResult { tool_use_id, content, .. } => { ... }
}
```

## 时间估算

- **阶段1-2修复**: 2-3小时
- **阶段3简化**: 1-2小时
- **阶段4完善**: 4-6小时
- **阶段5测试**: 3-4小时
- **总计**: 10-15小时

## 备注

由于上下文大小限制（120K）和文件复杂度，建议采用增量方式：

1. 先修复核心编译错误
2. 实现简化版本（仅基础功能）
3. 逐步添加高级功能
4. 最后进行全面测试

当前已完成约60%的OpenAI Provider实现，主要是数据结构和核心逻辑。需要重点修复异步运行时和类型系统问题。
