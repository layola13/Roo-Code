use crate::types::{
    ApiHandlerOptions, ContentBlock, MessageParam, MessageContent, MessageRole,
    CreateMessageMetadata,
};
use crate::error::{ApiError, ApiResult};
use crate::stream::ApiStreamChunk;
use crate::client::HttpClient;
use crate::providers::base::BaseProvider;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// OpenAI Provider implementation
pub struct OpenAIProvider {
    options: ApiHandlerOptions,
    http_client: HttpClient,
}

impl OpenAIProvider {
    pub fn new(options: ApiHandlerOptions) -> Self {
        let http_client = HttpClient::new();
        Self {
            options,
            http_client,
        }
    }

    /// Convert internal message format to OpenAI format
    fn convert_messages(
        &self,
        system_prompt: &str,
        messages: &[MessageParam],
    ) -> Vec<OpenAIMessage> {
        let mut openai_messages = Vec::new();

        // Add system message if present
        if !system_prompt.is_empty() {
            openai_messages.push(OpenAIMessage {
                role: "system".to_string(),
                content: Some(serde_json::Value::String(system_prompt.to_string())),
                name: None,
            });
        }

        // Convert user and assistant messages
        for msg in messages {
            let content = match &msg.content {
                MessageContent::Text(text) => Some(serde_json::Value::String(text.clone())),
                MessageContent::Blocks(blocks) => {
                    // For simplicity, concatenate text blocks or use first block
                    let text = blocks.iter()
                        .filter_map(|block| {
                            if let ContentBlock::Text { text, .. } = block {
                                Some(text.clone())
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<_>>()
                        .join("\n");
                    Some(serde_json::Value::String(text))
                }
            };

            openai_messages.push(OpenAIMessage {
                role: match msg.role {
                    MessageRole::User => "user",
                    MessageRole::Assistant => "assistant",
                    MessageRole::System => "system",
                }
                .to_string(),
                content,
                name: None,
            });
        }

        openai_messages
    }

    /// Parse SSE stream response
    fn parse_sse_stream(&self, body: &str) -> ApiResult<Vec<ApiStreamChunk>> {
        let mut chunks = Vec::new();
        let lines: Vec<&str> = body.lines().collect();

        for line in lines {
            if line.starts_with("data: ") {
                let data = &line[6..]; // Skip "data: " prefix

                if data == "[DONE]" {
                    break;
                }

                // Parse JSON chunk
                let chunk: StreamChunk = serde_json::from_str(data).map_err(|e| {
                    ApiError::JsonError(format!(
                        "Failed to parse SSE chunk: {}",
                        e
                    ))
                })?;

                // Convert to ApiStreamChunk
                if let Some(choice) = chunk.choices.first() {
                    if let Some(delta) = &choice.delta {
                        // Text delta
                        if let Some(content) = &delta.content {
                            chunks.push(ApiStreamChunk::Text {
                                text: content.clone(),
                            });
                        }

                        // Usage info (only in last chunk)
                        if let Some(usage) = &chunk.usage {
                            chunks.push(ApiStreamChunk::Usage {
                                input_tokens: usage.prompt_tokens,
                                output_tokens: usage.completion_tokens,
                                cache_write_tokens: usage
                                    .prompt_tokens_details
                                    .as_ref()
                                    .and_then(|d| d.cached_tokens),
                                cache_read_tokens: None,
                                reasoning_tokens: None,
                                total_cost: None,
                            });
                        }
                    }
                }
            }
        }

        Ok(chunks)
    }
}

#[async_trait(?Send)]
impl BaseProvider for OpenAIProvider {
    async fn create_message(
        &self,
        system_prompt: &str,
        messages: &[MessageParam],
        _metadata: Option<&CreateMessageMetadata>,
    ) -> ApiResult<Vec<ApiStreamChunk>> {
        let openai_messages = self.convert_messages(system_prompt, messages);

        let request = OpenAIRequest {
            model: self.options.api_model_id.clone(),
            messages: openai_messages,
            temperature: Some(0.0),
            max_completion_tokens: Some(8192),
            stream: true,
            stream_options: Some(StreamOptions {
                include_usage: true,
            }),
        };

        let request_body =
            serde_json::to_string(&request).map_err(|e| {
                ApiError::JsonError(format!("Failed to serialize request: {}", e))
            })?;

        // Determine API endpoint
        let base_url = self
            .options
            .openai_base_url
            .as_deref()
            .unwrap_or("https://api.openai.com/v1");
        let url = format!("{}/chat/completions", base_url);

        // Build headers
        let mut headers = std::collections::HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());
        headers.insert(
            "Authorization".to_string(),
            format!("Bearer {}", self.options.api_key),
        );

        let response = self
            .http_client
            .post(&url, headers, request_body)
            .await?;

        self.parse_sse_stream(&response.body)
    }

    async fn complete_prompt(&self, prompt: &str) -> ApiResult<String> {
        let messages = vec![MessageParam::user(prompt.to_string())];

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
        &self.options.api_model_id
    }

    fn get_provider_name(&self) -> &str {
        "openai"
    }
}

// ============================================================================
// OpenAI-specific Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIMessage {
    role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
}

#[derive(Debug, Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_completion_tokens: Option<u32>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream_options: Option<StreamOptions>,
}

#[derive(Debug, Serialize)]
struct StreamOptions {
    include_usage: bool,
}

// SSE Response Types
#[derive(Debug, Deserialize)]
struct StreamChunk {
    id: String,
    object: String,
    created: u64,
    model: String,
    choices: Vec<Choice>,
    #[serde(skip_serializing_if = "Option::is_none")]
    usage: Option<Usage>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    index: u32,
    delta: Option<Delta>,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Delta {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    prompt_tokens_details: Option<PromptTokensDetails>,
}

#[derive(Debug, Deserialize)]
struct PromptTokensDetails {
    #[serde(skip_serializing_if = "Option::is_none")]
    cached_tokens: Option<u32>,
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_provider() -> OpenAIProvider {
        let options = ApiHandlerOptions {
            api_provider: crate::types::ApiProvider::OpenAi,
            api_model_id: "gpt-4".to_string(),
            api_key: "test-key".to_string(),
            anthropic_base_url: None,
            anthropic_use_auth_token: None,
            anthropic_beta_1m_context: None,
            openai_base_url: None,
            openai_model_id: None,
            temperature: None,
            max_tokens: None,
        };
        OpenAIProvider::new(options)
    }

    #[test]
    fn test_convert_messages_with_system_prompt() {
        let provider = create_test_provider();
        let messages = vec![
            MessageParam::user("Hello".to_string()),
            MessageParam::assistant("Hi there!".to_string()),
        ];

        let converted = provider.convert_messages("You are a helpful assistant.", &messages);

        assert_eq!(converted.len(), 3);
        assert_eq!(converted[0].role, "system");
        assert_eq!(converted[1].role, "user");
        assert_eq!(converted[2].role, "assistant");
    }

    #[test]
    fn test_convert_messages_without_system_prompt() {
        let provider = create_test_provider();
        let messages = vec![MessageParam::user("Hello".to_string())];

        let converted = provider.convert_messages("", &messages);

        assert_eq!(converted.len(), 1);
        assert_eq!(converted[0].role, "user");
    }

    #[test]
    fn test_parse_sse_stream_with_text() {
        let provider = create_test_provider();
        let sse_data = r#"data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}

data: [DONE]
"#;

        let chunks = provider.parse_sse_stream(sse_data).unwrap();

        assert_eq!(chunks.len(), 2);
        
        if let ApiStreamChunk::Text { text } = &chunks[0] {
            assert_eq!(text, "Hello");
        } else {
            panic!("Expected Text chunk");
        }
        
        if let ApiStreamChunk::Text { text } = &chunks[1] {
            assert_eq!(text, " world");
        } else {
            panic!("Expected Text chunk");
        }
    }

    #[test]
    fn test_parse_sse_stream_with_usage() {
        let provider = create_test_provider();
        let sse_data = r#"data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Test"},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15,"prompt_tokens_details":{"cached_tokens":8}}}

data: [DONE]
"#;

        let chunks = provider.parse_sse_stream(sse_data).unwrap();

        assert_eq!(chunks.len(), 2);
        
        if let ApiStreamChunk::Text { text } = &chunks[0] {
            assert_eq!(text, "Test");
        } else {
            panic!("Expected Text chunk");
        }
        
        if let ApiStreamChunk::Usage {
            input_tokens,
            output_tokens,
            cache_write_tokens,
            ..
        } = &chunks[1]
        {
            assert_eq!(*input_tokens, 10);
            assert_eq!(*output_tokens, 5);
            assert_eq!(*cache_write_tokens, Some(8));
        } else {
            panic!("Expected Usage chunk");
        }
    }

    #[test]
    fn test_get_model_id() {
        let provider = create_test_provider();
        assert_eq!(provider.get_model_id(), "gpt-4");
    }

    #[test]
    fn test_get_provider_name() {
        let provider = create_test_provider();
        assert_eq!(provider.get_provider_name(), "openai");
    }
}