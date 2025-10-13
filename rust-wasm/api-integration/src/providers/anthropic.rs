use crate::client::HttpClient;
use crate::error::{ApiError, ApiResult};
use crate::providers::base::BaseProvider;
use crate::stream::ApiStreamChunk;
use crate::types::{
    CacheControl, ContentBlock, CreateMessageMetadata, ImageSource, MessageContent, MessageParam,
    MessageRole, TokenUsage,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

const ANTHROPIC_DEFAULT_API_URL: &str = "https://api.anthropic.com";
const ANTHROPIC_API_VERSION: &str = "2023-06-01";
const DEFAULT_MAX_TOKENS: u32 = 8192;

/// Anthropic API provider implementation
pub struct AnthropicProvider {
    api_key: String,
    model_id: String,
    base_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnthropicMessage {
    role: String,
    content: Vec<AnthropicContent>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum AnthropicContent {
    Text {
        text: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        cache_control: Option<CacheControl>,
    },
    Image {
        source: AnthropicImageSource,
    },
}

#[derive(Debug, Serialize, Deserialize)]
struct AnthropicImageSource {
    #[serde(rename = "type")]
    source_type: String,
    media_type: String,
    data: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    system: Vec<AnthropicContent>,
    messages: Vec<AnthropicMessage>,
    stream: bool,
}

// Stream event types
#[derive(Debug, Deserialize)]
struct StreamEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(flatten)]
    data: Value,
}

#[derive(Debug, Deserialize)]
struct MessageStart {
    message: MessageInfo,
}

#[derive(Debug, Deserialize)]
struct MessageInfo {
    usage: UsageInfo,
}

#[derive(Debug, Deserialize)]
struct UsageInfo {
    input_tokens: u32,
    output_tokens: u32,
    #[serde(default)]
    cache_creation_input_tokens: u32,
    #[serde(default)]
    cache_read_input_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct ContentBlockStart {
    content_block: ContentBlockInfo,
}

#[derive(Debug, Deserialize)]
struct ContentBlockInfo {
    #[serde(rename = "type")]
    block_type: String,
    #[serde(default)]
    text: String,
    #[serde(default)]
    thinking: String,
}

#[derive(Debug, Deserialize)]
struct ContentBlockDelta {
    delta: DeltaContent,
}

#[derive(Debug, Deserialize)]
struct DeltaContent {
    #[serde(rename = "type")]
    delta_type: String,
    #[serde(default)]
    text: String,
    #[serde(default)]
    thinking: String,
}

#[derive(Debug, Deserialize)]
struct MessageDelta {
    usage: UsageInfo,
}

impl AnthropicProvider {
    pub fn new(api_key: String, model_id: String) -> Self {
        Self {
            api_key,
            model_id,
            base_url: ANTHROPIC_DEFAULT_API_URL.to_string(),
        }
    }

    pub fn with_base_url(mut self, base_url: String) -> Self {
        self.base_url = base_url;
        self
    }

    /// Convert MessageParam to Anthropic format
    fn convert_messages(&self, messages: &[MessageParam]) -> Vec<AnthropicMessage> {
        let mut result = Vec::new();

        for msg in messages {
            let role_str = match msg.role {
                MessageRole::User => "user",
                MessageRole::Assistant => "assistant",
                MessageRole::System => "system",
            };

            let content = match &msg.content {
                MessageContent::Text(text) => {
                    vec![AnthropicContent::Text {
                        text: text.clone(),
                        cache_control: None,
                    }]
                }
                MessageContent::Blocks(blocks) => blocks
                    .iter()
                    .filter_map(|block| match block {
                        ContentBlock::Text { text, .. } => Some(AnthropicContent::Text {
                            text: text.clone(),
                            cache_control: None,
                        }),
                        ContentBlock::Image { source, .. } => {
                            if let ImageSource::Base64 { media_type, data } = source {
                                Some(AnthropicContent::Image {
                                    source: AnthropicImageSource {
                                        source_type: "base64".to_string(),
                                        media_type: media_type.clone(),
                                        data: data.clone(),
                                    },
                                })
                            } else {
                                None
                            }
                        }
                        _ => None,
                    })
                    .collect(),
            };

            result.push(AnthropicMessage {
                role: role_str.to_string(),
                content,
            });
        }

        result
    }

    /// Apply prompt caching to system prompt and last 2 user messages
    fn apply_prompt_caching(
        &self,
        system: &mut [AnthropicContent],
        messages: &mut [AnthropicMessage],
    ) {
        // Mark last item in system prompt for caching
        if let Some(last) = system.last_mut() {
            if let AnthropicContent::Text { cache_control, .. } = last {
                *cache_control = Some(CacheControl::default());
            }
        }

        // Mark last 2 user messages for caching
        let mut user_count = 0;
        for msg in messages.iter_mut().rev() {
            if msg.role == "user" {
                if let Some(last_content) = msg.content.last_mut() {
                    if let AnthropicContent::Text { cache_control, .. } = last_content {
                        *cache_control = Some(CacheControl::default());
                    }
                }
                user_count += 1;
                if user_count >= 2 {
                    break;
                }
            }
        }
    }

    /// Parse SSE stream response
    fn parse_stream_response(&self, body: &str) -> ApiResult<Vec<ApiStreamChunk>> {
        let mut chunks = Vec::new();
        let mut input_tokens = 0u32;
        let mut output_tokens = 0u32;
        let mut cache_write_tokens = 0u32;
        let mut cache_read_tokens = 0u32;

        for line in body.lines() {
            let line = line.trim();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    continue;
                }

                let event: StreamEvent = serde_json::from_str(data)
                    .map_err(|e| ApiError::JsonError(format!("Failed to parse event: {}", e)))?;

                match event.event_type.as_str() {
                    "message_start" => {
                        let msg_start: MessageStart = serde_json::from_value(event.data)
                            .map_err(|e| {
                                ApiError::JsonError(format!("Failed to parse message_start: {}", e))
                            })?;

                        input_tokens = msg_start.message.usage.input_tokens;
                        cache_write_tokens = msg_start.message.usage.cache_creation_input_tokens;
                        cache_read_tokens = msg_start.message.usage.cache_read_input_tokens;

                        chunks.push(ApiStreamChunk::Usage {
                            input_tokens,
                            output_tokens: 0,
                            cache_write_tokens: Some(cache_write_tokens),
                            cache_read_tokens: Some(cache_read_tokens),
                            reasoning_tokens: None,
                            total_cost: None,
                        });
                    }
                    "content_block_start" => {
                        let block_start: ContentBlockStart = serde_json::from_value(event.data)
                            .map_err(|e| {
                                ApiError::JsonError(format!(
                                    "Failed to parse content_block_start: {}",
                                    e
                                ))
                            })?;

                        match block_start.content_block.block_type.as_str() {
                            "thinking" => {
                                let text = block_start.content_block.thinking;
                                chunks.push(ApiStreamChunk::Reasoning { text });
                            }
                            "text" => {
                                let text = block_start.content_block.text;
                                chunks.push(ApiStreamChunk::Text { text });
                            }
                            _ => {}
                        }
                    }
                    "content_block_delta" => {
                        let block_delta: ContentBlockDelta = serde_json::from_value(event.data)
                            .map_err(|e| {
                                ApiError::JsonError(format!(
                                    "Failed to parse content_block_delta: {}",
                                    e
                                ))
                            })?;

                        match block_delta.delta.delta_type.as_str() {
                            "thinking_delta" => {
                                let text = block_delta.delta.thinking;
                                chunks.push(ApiStreamChunk::Reasoning { text });
                            }
                            "text_delta" => {
                                let text = block_delta.delta.text;
                                chunks.push(ApiStreamChunk::Text { text });
                            }
                            _ => {}
                        }
                    }
                    "message_delta" => {
                        let msg_delta: MessageDelta = serde_json::from_value(event.data)
                            .map_err(|e| {
                                ApiError::JsonError(format!("Failed to parse message_delta: {}", e))
                            })?;

                        output_tokens = msg_delta.usage.output_tokens;
                        chunks.push(ApiStreamChunk::Usage {
                            input_tokens: 0,
                            output_tokens,
                            cache_write_tokens: None,
                            cache_read_tokens: None,
                            reasoning_tokens: None,
                            total_cost: None,
                        });
                    }
                    "message_stop" => {
                        // Calculate total cost
                        let usage = TokenUsage {
                            input_tokens,
                            output_tokens,
                            cache_write_tokens: Some(cache_write_tokens),
                            cache_read_tokens: Some(cache_read_tokens),
                            reasoning_tokens: None,
                            total_cost: None,
                        };
                        let cost = self.calculate_cost(&usage);
                        chunks.push(ApiStreamChunk::Usage {
                            input_tokens: 0,
                            output_tokens: 0,
                            cache_write_tokens: None,
                            cache_read_tokens: None,
                            reasoning_tokens: None,
                            total_cost: Some(cost),
                        });
                    }
                    "error" => {
                        let error_msg = event
                            .data
                            .get("error")
                            .and_then(|e| e.get("message"))
                            .and_then(|m| m.as_str())
                            .unwrap_or("Unknown error");

                        return Err(ApiError::InvalidResponse(error_msg.to_string()));
                    }
                    _ => {}
                }
            }
        }

        Ok(chunks)
    }

    /// Calculate token cost based on model pricing
    fn calculate_cost(&self, usage: &TokenUsage) -> f64 {
        // Pricing per 1M tokens (MTok)
        let (input_price, cache_write_price, cache_read_price, output_price) =
            if self.model_id.contains("claude-3-5-sonnet") {
                (3.0, 3.75, 0.30, 15.0)
            } else if self.model_id.contains("claude-3-opus") {
                (15.0, 18.75, 1.50, 75.0)
            } else if self.model_id.contains("claude-3-sonnet") {
                (3.0, 3.75, 0.30, 15.0)
            } else if self.model_id.contains("claude-3-haiku") {
                (0.25, 0.30, 0.03, 1.25)
            } else {
                (3.0, 3.75, 0.30, 15.0)
            };

        let input_cost = (usage.input_tokens as f64 / 1_000_000.0) * input_price;
        let cache_write_cost =
            (usage.cache_write_tokens.unwrap_or(0) as f64 / 1_000_000.0) * cache_write_price;
        let cache_read_cost =
            (usage.cache_read_tokens.unwrap_or(0) as f64 / 1_000_000.0) * cache_read_price;
        let output_cost = (usage.output_tokens as f64 / 1_000_000.0) * output_price;

        input_cost + cache_write_cost + cache_read_cost + output_cost
    }
}

#[async_trait::async_trait(?Send)]
impl BaseProvider for AnthropicProvider {
    async fn create_message(
        &self,
        system_prompt: &str,
        messages: &[MessageParam],
        _metadata: Option<&CreateMessageMetadata>,
    ) -> ApiResult<Vec<ApiStreamChunk>> {
        // Build system prompt
        let mut system_content = vec![AnthropicContent::Text {
            text: system_prompt.to_string(),
            cache_control: None,
        }];

        // Convert messages
        let mut anthropic_messages = self.convert_messages(messages);

        // Apply prompt caching
        self.apply_prompt_caching(&mut system_content, &mut anthropic_messages);

        // Build request
        let request = AnthropicRequest {
            model: self.model_id.clone(),
            max_tokens: DEFAULT_MAX_TOKENS,
            temperature: None,
            system: system_content,
            messages: anthropic_messages,
            stream: true,
        };

        let body = serde_json::to_string(&request)
            .map_err(|e| ApiError::JsonError(e.to_string()))?;

        // Build headers
        let mut headers = HashMap::new();
        headers.insert("x-api-key".to_string(), self.api_key.clone());
        headers.insert(
            "anthropic-version".to_string(),
            ANTHROPIC_API_VERSION.to_string(),
        );
        headers.insert("content-type".to_string(), "application/json".to_string());

        // Add beta features
        headers.insert(
            "anthropic-beta".to_string(),
            "max-tokens-3-5-sonnet-2024-07-15,prompt-caching-2024-07-31".to_string(),
        );

        // Make HTTP request
        let url = format!("{}/v1/messages", self.base_url);
        let client = HttpClient::new();
        let response = client.post(&url, headers, body).await?;

        if response.status != 200 {
            return Err(ApiError::from_status_code(response.status, response.body));
        }

        // Parse stream response
        self.parse_stream_response(&response.body)
    }

    async fn complete_prompt(&self, prompt: &str) -> ApiResult<String> {
        let messages = vec![MessageParam {
            role: MessageRole::User,
            content: MessageContent::Text(prompt.to_string()),
        }];

        let chunks = self.create_message("", &messages, None).await?;

        let mut result = String::new();
        for chunk in chunks {
            if let ApiStreamChunk::Text { text } = chunk {
                result.push_str(&text);
            }
        }

        Ok(result)
    }

    fn get_model_id(&self) -> &str {
        &self.model_id
    }

    fn get_provider_name(&self) -> &str {
        "Anthropic"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_messages() {
        let provider = AnthropicProvider::new(
            "test-key".to_string(),
            "claude-3-5-sonnet-20241022".to_string(),
        );

        let messages = vec![
            MessageParam {
                role: MessageRole::User,
                content: MessageContent::Text("Hello".to_string()),
            },
            MessageParam {
                role: MessageRole::Assistant,
                content: MessageContent::Text("Hi there!".to_string()),
            },
        ];

        let result = provider.convert_messages(&messages);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].role, "user");
        assert_eq!(result[1].role, "assistant");
    }

    #[test]
    fn test_calculate_cost_sonnet() {
        let provider = AnthropicProvider::new(
            "test-key".to_string(),
            "claude-3-5-sonnet-20241022".to_string(),
        );

        let usage = TokenUsage {
            input_tokens: 1000,
            output_tokens: 500,
            cache_write_tokens: Some(200),
            cache_read_tokens: Some(100),
            reasoning_tokens: None,
            total_cost: None,
        };

        let cost = provider.calculate_cost(&usage);
        // (1000/1M * 3.0) + (200/1M * 3.75) + (100/1M * 0.30) + (500/1M * 15.0)
        // = 0.003 + 0.00075 + 0.00003 + 0.0075
        // = 0.01128
        assert!((cost - 0.01128).abs() < 0.0001);
    }

    #[test]
    fn test_calculate_cost_haiku() {
        let provider = AnthropicProvider::new(
            "test-key".to_string(),
            "claude-3-haiku-20240307".to_string(),
        );

        let usage = TokenUsage {
            input_tokens: 1000,
            output_tokens: 500,
            cache_write_tokens: None,
            cache_read_tokens: None,
            reasoning_tokens: None,
            total_cost: None,
        };

        let cost = provider.calculate_cost(&usage);
        // (1000/1M * 0.25) + (500/1M * 1.25)
        // = 0.00025 + 0.000625
        // = 0.000875
        assert!((cost - 0.000875).abs() < 0.0001);
    }

    #[test]
    fn test_apply_prompt_caching() {
        let provider = AnthropicProvider::new(
            "test-key".to_string(),
            "claude-3-5-sonnet-20241022".to_string(),
        );

        let mut system = vec![
            AnthropicContent::Text {
                text: "You are a helpful assistant.".to_string(),
                cache_control: None,
            },
            AnthropicContent::Text {
                text: "Always be polite.".to_string(),
                cache_control: None,
            },
        ];

        let mut messages = vec![
            AnthropicMessage {
                role: "user".to_string(),
                content: vec![AnthropicContent::Text {
                    text: "First message".to_string(),
                    cache_control: None,
                }],
            },
            AnthropicMessage {
                role: "user".to_string(),
                content: vec![AnthropicContent::Text {
                    text: "Second message".to_string(),
                    cache_control: None,
                }],
            },
            AnthropicMessage {
                role: "user".to_string(),
                content: vec![AnthropicContent::Text {
                    text: "Third message".to_string(),
                    cache_control: None,
                }],
            },
        ];

        provider.apply_prompt_caching(&mut system, &mut messages);

        // Check system prompt caching
        if let AnthropicContent::Text { cache_control, .. } = &system[1] {
            assert!(cache_control.is_some());
        } else {
            panic!("Expected Text content");
        }

        // Check last 2 user messages have caching
        let mut cached_count = 0;
        for msg in &messages {
            if let Some(AnthropicContent::Text { cache_control, .. }) = msg.content.last() {
                if cache_control.is_some() {
                    cached_count += 1;
                }
            }
        }
        assert_eq!(cached_count, 2);
    }
}