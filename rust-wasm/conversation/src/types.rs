//! Conversation System Types
//! 
//! 对话系统的核心类型定义，包括消息、内容块等

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Message role in conversation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
}

/// Content block types for messages
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    /// Text content
    Text { 
        text: String 
    },
    /// Image content (base64 encoded)
    Image { 
        source: ImageSource 
    },
    /// Tool use request
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    /// Tool result
    ToolResult {
        tool_use_id: String,
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        is_error: Option<bool>,
    },
}

/// Image source for content blocks
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

/// API Message - compatible with Anthropic MessageParam
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiMessage {
    /// Role of the message sender
    pub role: MessageRole,
    
    /// Content of the message (can be string or array of content blocks)
    #[serde(with = "message_content")]
    pub content: MessageContent,
    
    /// Optional timestamp (milliseconds since epoch)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ts: Option<i64>,
    
    /// Whether this message is a summary
    #[serde(skip_serializing_if = "Option::is_none", rename = "isSummary")]
    pub is_summary: Option<bool>,
    
    /// Optional name field for function calling
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

/// Message content - can be a simple string or structured content blocks
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessageContent {
    Text(String),
    Blocks(Vec<ContentBlock>),
}

// Custom serialization for MessageContent to handle both string and array
mod message_content {
    use super::*;
    use serde::{Deserializer, Serializer};

    pub fn serialize<S>(content: &MessageContent, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match content {
            MessageContent::Text(s) => s.serialize(serializer),
            MessageContent::Blocks(blocks) => blocks.serialize(serializer),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<MessageContent, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = serde_json::Value::deserialize(deserializer)?;
        
        if let Some(s) = value.as_str() {
            Ok(MessageContent::Text(s.to_string()))
        } else if value.is_array() {
            let blocks: Vec<ContentBlock> = serde_json::from_value(value)
                .map_err(serde::de::Error::custom)?;
            Ok(MessageContent::Blocks(blocks))
        } else {
            Err(serde::de::Error::custom("Expected string or array for message content"))
        }
    }
}

/// Cline Message - UI-specific message format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClineMessage {
    /// Timestamp
    pub ts: i64,
    
    /// Message type
    #[serde(rename = "type")]
    pub msg_type: String,
    
    /// Say type (for "say" messages)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub say: Option<String>,
    
    /// Message text
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    
    /// Image IDs associated with this message
    #[serde(skip_serializing_if = "Option::is_none", rename = "imageIds")]
    pub image_ids: Option<Vec<String>>,
    
    /// Whether this is a partial message (streaming)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub partial: Option<bool>,
    
    /// Additional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Conversation statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationStats {
    /// Total number of messages
    pub total_messages: usize,
    
    /// Number of user messages
    pub user_messages: usize,
    
    /// Number of assistant messages
    pub assistant_messages: usize,
    
    /// Number of summary messages
    pub summary_messages: usize,
    
    /// Estimated token count (approximate)
    pub estimated_tokens: usize,
}

/// Conversation summary result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryResult {
    /// The summarized messages
    pub messages: Vec<ApiMessage>,
    
    /// Summary text
    pub summary: String,
    
    /// Cost of summarization (if applicable)
    pub cost: f64,
    
    /// New context token count
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_context_tokens: Option<usize>,
    
    /// Error message if summarization failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Configuration for conversation condensing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CondenseConfig {
    /// Number of recent messages to keep
    pub keep_count: usize,
    
    /// Minimum context percentage to trigger condensing
    pub min_condense_threshold: f64,
    
    /// Maximum context percentage to trigger condensing
    pub max_condense_threshold: f64,
    
    /// Whether to use memory enhancement
    pub use_memory_enhancement: bool,
}

impl Default for CondenseConfig {
    fn default() -> Self {
        Self {
            keep_count: 3,
            min_condense_threshold: 5.0,
            max_condense_threshold: 100.0,
            use_memory_enhancement: true,
        }
    }
}

impl ApiMessage {
    /// Create a new user message
    pub fn user(content: impl Into<MessageContent>) -> Self {
        Self {
            role: MessageRole::User,
            content: content.into(),
            ts: Some(chrono::Utc::now().timestamp_millis()),
            is_summary: None,
            name: None,
        }
    }
    
    /// Create a new assistant message
    pub fn assistant(content: impl Into<MessageContent>) -> Self {
        Self {
            role: MessageRole::Assistant,
            content: content.into(),
            ts: Some(chrono::Utc::now().timestamp_millis()),
            is_summary: None,
            name: None,
        }
    }
    
    /// Create a summary message
    pub fn summary(content: impl Into<MessageContent>, ts: i64) -> Self {
        Self {
            role: MessageRole::Assistant,
            content: content.into(),
            ts: Some(ts),
            is_summary: Some(true),
            name: None,
        }
    }
    
    /// Get the text content of the message
    pub fn get_text(&self) -> String {
        match &self.content {
            MessageContent::Text(s) => s.clone(),
            MessageContent::Blocks(blocks) => {
                blocks.iter()
                    .filter_map(|block| {
                        if let ContentBlock::Text { text } = block {
                            Some(text.as_str())
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("\n")
            }
        }
    }
    
    /// Check if this message is a summary
    pub fn is_summary(&self) -> bool {
        self.is_summary.unwrap_or(false)
    }
    
    /// Estimate token count for this message (rough approximation)
    pub fn estimate_tokens(&self) -> usize {
        let text = self.get_text();
        // Rough approximation: 1 token ≈ 4 characters
        (text.len() + 3) / 4
    }
}

impl From<String> for MessageContent {
    fn from(s: String) -> Self {
        MessageContent::Text(s)
    }
}

impl From<&str> for MessageContent {
    fn from(s: &str) -> Self {
        MessageContent::Text(s.to_string())
    }
}

impl From<Vec<ContentBlock>> for MessageContent {
    fn from(blocks: Vec<ContentBlock>) -> Self {
        MessageContent::Blocks(blocks)
    }
}

impl ClineMessage {
    /// Create a new Cline message
    pub fn new(msg_type: String, text: Option<String>) -> Self {
        Self {
            ts: chrono::Utc::now().timestamp_millis(),
            msg_type,
            say: None,
            text,
            image_ids: None,
            partial: None,
            metadata: None,
        }
    }
    
    /// Create a user feedback message
    pub fn user_feedback(text: String) -> Self {
        Self {
            ts: chrono::Utc::now().timestamp_millis(),
            msg_type: "say".to_string(),
            say: Some("user_feedback".to_string()),
            text: Some(text),
            image_ids: None,
            partial: None,
            metadata: None,
        }
    }
    
    /// Create an assistant text message
    pub fn assistant_text(text: String) -> Self {
        Self {
            ts: chrono::Utc::now().timestamp_millis(),
            msg_type: "say".to_string(),
            say: Some("text".to_string()),
            text: Some(text),
            image_ids: None,
            partial: None,
            metadata: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_message_creation() {
        let msg = ApiMessage::user("Hello, world!");
        assert_eq!(msg.role, MessageRole::User);
        assert_eq!(msg.get_text(), "Hello, world!");
        assert!(!msg.is_summary());
    }

    #[test]
    fn test_summary_message() {
        let msg = ApiMessage::summary("Summary content", 12345);
        assert!(msg.is_summary());
        assert_eq!(msg.ts, Some(12345));
    }

    #[test]
    fn test_message_serialization() {
        let msg = ApiMessage::user("Test message");
        let json = serde_json::to_string(&msg).unwrap();
        let deserialized: ApiMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(msg.get_text(), deserialized.get_text());
    }

    #[test]
    fn test_content_block_text() {
        let block = ContentBlock::Text {
            text: "Hello".to_string(),
        };
        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"text\""));
    }

    #[test]
    fn test_cline_message_creation() {
        let msg = ClineMessage::user_feedback("User input".to_string());
        assert_eq!(msg.msg_type, "say");
        assert_eq!(msg.say.as_deref(), Some("user_feedback"));
        assert_eq!(msg.text.as_deref(), Some("User input"));
    }

    #[test]
    fn test_token_estimation() {
        let msg = ApiMessage::user("This is a test message");
        let tokens = msg.estimate_tokens();
        assert!(tokens > 0);
        assert!(tokens < 100); // Should be reasonable for short text
    }

    #[test]
    fn test_message_content_variants() {
        // Test string content
        let content1: MessageContent = "Simple text".into();
        matches!(content1, MessageContent::Text(_));
        
        // Test block content
        let blocks = vec![
            ContentBlock::Text { text: "Block 1".to_string() },
            ContentBlock::Text { text: "Block 2".to_string() },
        ];
        let content2: MessageContent = blocks.into();
        matches!(content2, MessageContent::Blocks(_));
    }
}