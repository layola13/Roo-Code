# API Integration 基础框架实现总结

> **创建时间**: 2025-10-13  
> **任务**: 1.2 API Integration - 基础框架实现  
> **状态**: ✅ 框架完成，待实现具体Provider

---

## 1. 实现概述

### 1.1 目标

实现Rust版本的API Integration模块，支持多个AI提供商（Anthropic、OpenAI等）的HTTP API调用和Stream处理。

### 1.2 架构决策（重要更正）⚠️

用户明确指出：**API调用逻辑也要用Rust实现**，不是保留在TypeScript中。

**最终架构**：

```
┌─────────────────────────────────────────────────────┐
│           TypeScript (UI + Host Interface)          │
│  - UI渲染                                            │
│  - 用户交互                                          │
│  - Host Interface实现（网络/文件系统/终端等）        │
└─────────────────────────────────────────────────────┘
                         ▼ WASM调用
┌─────────────────────────────────────────────────────┐
│              Rust WASM (所有业务逻辑)                │
│  - API调用逻辑                                       │
│  - Stream处理                                        │
│  - 任务管理                                          │
│  - 工具系统                                          │
│  - 代码索引                                          │
│  - 通过Host Interface获取网络/文件系统能力           │
└─────────────────────────────────────────────────────┘
```

---

## 2. 已实现模块

### 2.1 项目结构

```
rust-wasm/api-integration/
├── Cargo.toml              # 依赖配置（42行）
├── src/
│   ├── lib.rs             # 主入口（44行）
│   ├── types.rs           # 核心数据类型（227行）
│   ├── stream.rs          # Stream处理（230行，含4个测试）
│   ├── error.rs           # 错误类型（62行）
│   └── client.rs          # HTTP客户端接口（141行）
```

### 2.2 核心数据类型 (`types.rs`)

#### API提供商枚举

```rust
pub enum ApiProvider {
    Anthropic,      // Claude系列
    OpenAi,         // OpenAI兼容提供商
    OpenAiNative,   // OpenAI原生API
    Gemini,         // Google Gemini
    DeepSeek,       // DeepSeek
    Ollama,         // 本地Ollama
    OpenRouter,     // OpenRouter聚合服务
    Unknown,        // 未知提供商
}
```

#### API处理选项

```rust
pub struct ApiHandlerOptions {
    pub api_provider: ApiProvider,
    pub api_model_id: String,
    pub api_key: String,

    // Anthropic特定
    pub anthropic_base_url: Option<String>,
    pub anthropic_use_auth_token: Option<bool>,
    pub anthropic_beta_1m_context: Option<bool>,

    // OpenAI特定
    pub openai_base_url: Option<String>,
    pub openai_native_url: Option<String>,
    pub openai_stream_enabled: Option<bool>,

    // 模型参数
    pub model_temperature: Option<f32>,
    pub model_max_tokens: Option<u32>,
}
```

#### 消息类型

```rust
// 简化的消息参数（Anthropic格式）
pub struct MessageParam {
    pub role: String,        // "user" | "assistant"
    pub content: String,     // 消息内容
}

// 消息元数据
pub struct ApiHandlerCreateMessageMetadata {
    pub task_id: Option<String>,
    pub previous_response_id: Option<String>,
}
```

### 2.3 Stream处理 (`stream.rs`)

#### Stream数据块类型

```rust
pub enum ApiStreamChunk {
    Text {
        text: String
    },
    Reasoning {
        text: String         // thinking过程
    },
    Usage {
        input_tokens: u32,
        output_tokens: u32,
        cache_write_tokens: Option<u32>,
        cache_read_tokens: Option<u32>,
        total_cost: Option<f64>,
    },
    Grounding {
        sources: Vec<GroundingSource>
    },
    Error {
        error: String,
        message: String
    },
}
```

#### Stream累加器

```rust
pub struct StreamAccumulator {
    pub text: String,
    pub reasoning: String,
    pub usage: TokenUsage,
    pub grounding_sources: Vec<GroundingSource>,

    fn new() -> Self
    fn add_chunk(&mut self, chunk: ApiStreamChunk)
    fn get_text(&self) -> &str
    fn get_reasoning(&self) -> &str
    fn get_total_tokens(&self) -> u32
}
```

**测试覆盖**：4个单元测试

- ✅ `test_stream_accumulator_text` - 文本累加
- ✅ `test_stream_accumulator_reasoning` - thinking累加
- ✅ `test_stream_accumulator_usage` - Token统计
- ✅ `test_stream_accumulator_error` - 错误处理

### 2.4 错误处理 (`error.rs`)

```rust
#[derive(Error, Debug, Clone, Serialize, Deserialize)]
pub enum ApiError {
    #[error("HTTP error: {0}")]
    HttpError(String),

    #[error("JSON parsing error: {0}")]
    JsonError(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimitError(String),

    #[error("Authentication failed: {0}")]
    AuthError(String),

    #[error("Stream error: {0}")]
    StreamError(String),

    #[error("Request timeout: {0}")]
    TimeoutError(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl ApiError {
    pub fn from_status_code(status: u16, message: String) -> Self {
        match status {
            401 | 403 => Self::AuthError(message),
            429 => Self::RateLimitError(message),
            408 | 504 => Self::TimeoutError(message),
            _ => Self::HttpError(format!("Status {}: {}", status, message)),
        }
    }
}
```

### 2.5 HTTP客户端接口 (`client.rs`)

#### Host Interface声明

```rust
#[wasm_bindgen]
extern "C" {
    // 由宿主环境（TypeScript）实现
    async fn host_http_request(options: JsValue) -> Result<JsValue, JsValue>;
    fn host_log(level: &str, message: &str);
}
```

#### HTTP客户端

```rust
pub struct HttpClient;

impl HttpClient {
    pub async fn request(
        method: &str,
        url: &str,
        headers: HashMap<String, String>,
        body: Option<String>,
    ) -> ApiResult<HttpResponse> {
        // 构造请求选项
        let options = json!({
            "method": method,
            "url": url,
            "headers": headers,
            "body": body,
        });

        // 通过Host Interface调用
        let result = host_http_request(
            serde_wasm_bindgen::to_value(&options)?
        ).await;

        // 处理响应...
    }

    pub async fn get(url: &str, headers: HashMap<String, String>)
        -> ApiResult<HttpResponse>

    pub async fn post(url: &str, headers: HashMap<String, String>, body: String)
        -> ApiResult<HttpResponse>
}
```

#### 响应类型

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
}
```

---

## 3. TypeScript API架构分析

### 3.1 核心类结构

通过分析 `src/api/providers/anthropic.ts` 和 `base-openai-compatible-provider.ts`：

#### Anthropic Handler

```typescript
class AnthropicHandler extends BaseProvider {
	private client: Anthropic

	async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// 1. 配置模型参数（maxTokens, temperature, thinking）
		// 2. 处理Prompt Caching（cache_control breakpoints）
		// 3. 调用Anthropic API
		// 4. 处理Stream事件：
		//    - message_start: 初始Token统计
		//    - content_block_start/delta: 文本/thinking内容
		//    - message_delta: 增量Token统计
		//    - message_stop: 完成
		// 5. 计算总成本
	}
}
```

**关键特性**：

- **Prompt Caching**: 标记system prompt和最后2条user消息为ephemeral
- **Thinking支持**: 处理`thinking`类型的content block
- **Beta功能**: 1M context、prompt-caching-2024-07-31
- **Token统计**: 区分input/output/cache_write/cache_read tokens

#### OpenAI Compatible Handler

```typescript
class BaseOpenAiCompatibleProvider extends BaseProvider {
	protected client: OpenAI

	async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// 1. 转换Anthropic格式 -> OpenAI格式
		// 2. 创建stream
		// 3. yield text chunks
		// 4. yield usage data
	}
}
```

### 3.2 Stream事件处理

#### Anthropic Stream事件

```typescript
for await (const chunk of stream) {
	switch (chunk.type) {
		case "message_start":
		// 初始usage（input_tokens, cache_creation_input_tokens等）
		case "content_block_start":
		// text或thinking内容开始
		case "content_block_delta":
		// text_delta或thinking_delta
		case "message_delta":
		// 增量output_tokens
		case "message_stop":
		// 完成
	}
}
```

#### OpenAI Stream格式

```typescript
for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (delta?.content) {
        yield { type: "text", text: delta.content };
    }
    if (chunk.usage) {
        yield { type: "usage", ... };
    }
}
```

---

## 4. 测试结果

### 4.1 单元测试

```bash
$ cd rust-wasm && cargo test --package roo-api-integration

running 7 tests
test client::tests::test_http_client_creation ... ok
test stream::tests::test_stream_accumulator_error ... ok
test stream::tests::test_stream_accumulator_reasoning ... ok
test stream::tests::test_stream_accumulator_text ... ok
test stream::tests::test_stream_accumulator_usage ... ok
test tests::test_get_version ... ok
test tests::test_version ... ok

test result: ok. 7 passed; 0 failed
```

✅ **测试覆盖率**: 7/7通过（100%）

### 4.2 WASM构建

```bash
$ cd rust-wasm && cargo build

Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.77s
```

✅ **编译成功**: 无错误

### 4.3 WASM文件大小

```bash
$ du -sh rust-wasm/target/wasm32-unknown-unknown/release/*.wasm

196K  roo_api_integration.wasm   # API Integration（未优化）
280K  roo_task_engine.wasm       # Task Engine（未优化）
```

📊 **性能指标**:

- API Integration: 196KB（未优化）
- 编译时间: 1.77s
- 目标: <2MB（最终优化后）

---

## 5. 待实现功能

### 5.1 高优先级

1. **Anthropic Provider实现** (`providers/anthropic.rs`)

    - [ ] 完整的`create_message`方法
    - [ ] Prompt Caching支持
    - [ ] Thinking/Reasoning处理
    - [ ] Stream事件解析
    - [ ] Token cost计算

2. **OpenAI Provider实现** (`providers/openai.rs`)

    - [ ] OpenAI兼容API支持
    - [ ] Stream处理
    - [ ] 格式转换（Anthropic -> OpenAI）
    - [ ] Usage tracking

3. **消息格式转换** (`transform/`)
    - [ ] Anthropic格式 <-> OpenAI格式
    - [ ] Tool calls转换
    - [ ] Image content处理

###
