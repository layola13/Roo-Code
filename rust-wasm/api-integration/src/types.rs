use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// API提供商类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum ApiProvider {
    Anthropic,
    OpenAi,
    OpenAiNative,
    Gemini,
    DeepSeek,
    Ollama,
    OpenRouter,
    #[serde(other)]
    Unknown,
}

/// 模型信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub max_tokens: Option<u32>,
    pub context_window: u32,
    pub supports_prompt_cache: bool,
    pub input_price: f64,
    pub output_price: f64,
    pub cache_writes_price: Option<f64>,
    pub cache_reads_price: Option<f64>,
    pub description: Option<String>,
}

/// API配置选项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiHandlerOptions {
    pub api_provider: ApiProvider,
    pub api_model_id: String,
    pub api_key: String,
    
    // Anthropic配置
    pub anthropic_base_url: Option<String>,
    pub anthropic_use_auth_token: Option<bool>,
    pub anthropic_beta_1m_context: Option<bool>,
    
    // OpenAI配置
    pub openai_base_url: Option<String>,
    pub openai_model_id: Option<String>,
    
    // 通用配置
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
}

/// 消息角色
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

/// 内容块类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Text {
        text: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        cache_control: Option<CacheControl>,
    },
    Image {
        source: ImageSource,
        #[serde(skip_serializing_if = "Option::is_none")]
        cache_control: Option<CacheControl>,
    },
    #[serde(rename = "tool_use")]
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    #[serde(rename = "tool_result")]
    ToolResult {
        tool_use_id: String,
        content: String,
        is_error: Option<bool>,
    },
}

/// 图片源
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ImageSource {
    Base64 {
        media_type: String,
        data: String,
    },
    Url {
        url: String,
    },
}

/// 缓存控制
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheControl {
    #[serde(rename = "type")]
    pub cache_type: String, // "ephemeral"
}

/// 消息参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageParam {
    pub role: MessageRole,
    pub content: MessageContent,
}

/// 消息内容（可以是字符串或内容块数组）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessageContent {
    Text(String),
    Blocks(Vec<ContentBlock>),
}

/// 创建消息的元数据
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CreateMessageMetadata {
    pub mode: Option<String>,
    pub task_id: String,
    pub previous_response_id: Option<String>,
    pub suppress_previous_response_id: Option<bool>,
    pub store: Option<bool>,
}

/// Token使用统计
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub cache_write_tokens: Option<u32>,
    pub cache_read_tokens: Option<u32>,
    pub reasoning_tokens: Option<u32>,
    pub total_cost: Option<f64>,
}

/// HTTP请求选项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequestOptions {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub timeout: Option<u32>,
}

/// HTTP响应
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
}

impl ApiHandlerOptions {
    /// 获取Anthropic的API密钥字段名
    pub fn get_anthropic_key_field(&self) -> &str {
        if self.anthropic_base_url.is_some() 
            && self.anthropic_use_auth_token.unwrap_or(false) {
            "authToken"
        } else {
            "apiKey"
        }
    }
    
    /// 检查是否启用1M上下文
    pub fn is_1m_context_enabled(&self) -> bool {
        self.anthropic_beta_1m_context.unwrap_or(false)
    }
}

impl Default for CacheControl {
    fn default() -> Self {
        Self {
            cache_type: "ephemeral".to_string(),
        }
    }
}

impl MessageParam {
    /// 创建用户消息
    pub fn user(content: impl Into<MessageContent>) -> Self {
        Self {
            role: MessageRole::User,
            content: content.into(),
        }
    }
    
    /// 创建助手消息
    pub fn assistant(content: impl Into<MessageContent>) -> Self {
        Self {
            role: MessageRole::Assistant,
            content: content.into(),
        }
    }
}

impl From<String> for MessageContent {
    fn from(text: String) -> Self {
        MessageContent::Text(text)
    }
}

impl From<&str> for MessageContent {
    fn from(text: &str) -> Self {
        MessageContent::Text(text.to_string())
    }
}

impl From<Vec<ContentBlock>> for MessageContent {
    fn from(blocks: Vec<ContentBlock>) -> Self {
        MessageContent::Blocks(blocks)
    }
}