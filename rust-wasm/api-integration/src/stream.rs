use serde::{Deserialize, Serialize};
use crate::types::TokenUsage;

/// API Stream块类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ApiStreamChunk {
    /// 文本内容
    Text { text: String },
    
    /// 推理内容（thinking）
    Reasoning { text: String },
    
    /// Token使用统计
    Usage {
        #[serde(rename = "inputTokens")]
        input_tokens: u32,
        #[serde(rename = "outputTokens")]
        output_tokens: u32,
        #[serde(rename = "cacheWriteTokens", skip_serializing_if = "Option::is_none")]
        cache_write_tokens: Option<u32>,
        #[serde(rename = "cacheReadTokens", skip_serializing_if = "Option::is_none")]
        cache_read_tokens: Option<u32>,
        #[serde(rename = "reasoningTokens", skip_serializing_if = "Option::is_none")]
        reasoning_tokens: Option<u32>,
        #[serde(rename = "totalCost", skip_serializing_if = "Option::is_none")]
        total_cost: Option<f64>,
    },
    
    /// Grounding源（用于Gemini等）
    Grounding { sources: Vec<GroundingSource> },
    
    /// 错误
    Error { error: String, message: String },
}

/// Grounding数据源
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroundingSource {
    pub title: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub snippet: Option<String>,
}

/// Stream累加器 - 用于累积streaming数据
#[derive(Debug, Default)]
pub struct StreamAccumulator {
    /// 文本内容
    pub text: String,
    
    /// 推理内容
    pub reasoning: String,
    
    /// Token统计
    pub usage: TokenUsage,
    
    /// Grounding源
    pub grounding_sources: Vec<GroundingSource>,
    
    /// 是否有错误
    pub has_error: bool,
    
    /// 错误消息
    pub error_message: Option<String>,
}

impl StreamAccumulator {
    pub fn new() -> Self {
        Self::default()
    }
    
    /// 处理Stream块
    pub fn process_chunk(&mut self, chunk: ApiStreamChunk) {
        match chunk {
            ApiStreamChunk::Text { text } => {
                self.text.push_str(&text);
            }
            ApiStreamChunk::Reasoning { text } => {
                self.reasoning.push_str(&text);
            }
            ApiStreamChunk::Usage {
                input_tokens,
                output_tokens,
                cache_write_tokens,
                cache_read_tokens,
                reasoning_tokens,
                total_cost,
            } => {
                self.usage.input_tokens += input_tokens;
                self.usage.output_tokens += output_tokens;
                
                if let Some(cache_write) = cache_write_tokens {
                    *self.usage.cache_write_tokens.get_or_insert(0) += cache_write;
                }
                
                if let Some(cache_read) = cache_read_tokens {
                    *self.usage.cache_read_tokens.get_or_insert(0) += cache_read;
                }
                
                if let Some(reasoning) = reasoning_tokens {
                    *self.usage.reasoning_tokens.get_or_insert(0) += reasoning;
                }
                
                if let Some(cost) = total_cost {
                    *self.usage.total_cost.get_or_insert(0.0) += cost;
                }
            }
            ApiStreamChunk::Grounding { sources } => {
                self.grounding_sources.extend(sources);
            }
            ApiStreamChunk::Error { error, message } => {
                self.has_error = true;
                self.error_message = Some(format!("{}: {}", error, message));
            }
        }
    }
    
    /// 获取完整的文本内容
    pub fn get_full_text(&self) -> String {
        if !self.reasoning.is_empty() {
            format!("{}\n\n{}", self.reasoning, self.text)
        } else {
            self.text.clone()
        }
    }
    
    /// 检查是否有内容
    pub fn has_content(&self) -> bool {
        !self.text.is_empty() || !self.reasoning.is_empty()
    }
}

impl ApiStreamChunk {
    /// 创建文本块
    pub fn text(text: impl Into<String>) -> Self {
        Self::Text { text: text.into() }
    }
    
    /// 创建推理块
    pub fn reasoning(text: impl Into<String>) -> Self {
        Self::Reasoning { text: text.into() }
    }
    
    /// 创建使用统计块
    pub fn usage(
        input_tokens: u32,
        output_tokens: u32,
        cache_write_tokens: Option<u32>,
        cache_read_tokens: Option<u32>,
    ) -> Self {
        Self::Usage {
            input_tokens,
            output_tokens,
            cache_write_tokens,
            cache_read_tokens,
            reasoning_tokens: None,
            total_cost: None,
        }
    }
    
    /// 创建带成本的使用统计块
    pub fn usage_with_cost(
        input_tokens: u32,
        output_tokens: u32,
        cache_write_tokens: Option<u32>,
        cache_read_tokens: Option<u32>,
        total_cost: f64,
    ) -> Self {
        Self::Usage {
            input_tokens,
            output_tokens,
            cache_write_tokens,
            cache_read_tokens,
            reasoning_tokens: None,
            total_cost: Some(total_cost),
        }
    }
    
    /// 创建错误块
    pub fn error(error: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Error {
            error: error.into(),
            message: message.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_stream_accumulator_text() {
        let mut acc = StreamAccumulator::new();
        
        acc.process_chunk(ApiStreamChunk::text("Hello"));
        acc.process_chunk(ApiStreamChunk::text(" "));
        acc.process_chunk(ApiStreamChunk::text("World"));
        
        assert_eq!(acc.text, "Hello World");
        assert_eq!(acc.get_full_text(), "Hello World");
    }
    
    #[test]
    fn test_stream_accumulator_reasoning() {
        let mut acc = StreamAccumulator::new();
        
        acc.process_chunk(ApiStreamChunk::reasoning("Thinking..."));
        acc.process_chunk(ApiStreamChunk::text("Response"));
        
        assert_eq!(acc.reasoning, "Thinking...");
        assert_eq!(acc.text, "Response");
        assert_eq!(acc.get_full_text(), "Thinking...\n\nResponse");
    }
    
    #[test]
    fn test_stream_accumulator_usage() {
        let mut acc = StreamAccumulator::new();
        
        acc.process_chunk(ApiStreamChunk::usage(100, 50, Some(20), Some(30)));
        acc.process_chunk(ApiStreamChunk::usage(50, 25, None, Some(10)));
        
        assert_eq!(acc.usage.input_tokens, 150);
        assert_eq!(acc.usage.output_tokens, 75);
        assert_eq!(acc.usage.cache_write_tokens, Some(20));
        assert_eq!(acc.usage.cache_read_tokens, Some(40));
    }
    
    #[test]
    fn test_stream_accumulator_error() {
        let mut acc = StreamAccumulator::new();
        
        acc.process_chunk(ApiStreamChunk::error("RateLimitError", "Too many requests"));
        
        assert!(acc.has_error);
        assert_eq!(acc.error_message, Some("RateLimitError: Too many requests".to_string()));
    }
}