//! Task Message Management
//! 
//! Handles message creation, storage, and persistence

use crate::error::{TaskError, TaskResult};
use crate::types::ContentBlock;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// Message type for UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskMessage {
    /// Message ID
    pub id: String,
    /// Message type
    pub msg_type: MessageType,
    /// Message timestamp
    pub timestamp: i64,
    /// Message content
    pub content: Vec<ContentBlock>,
    /// Associated metadata
    pub metadata: Option<serde_json::Value>,
}

/// Message type enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageType {
    /// User message
    User,
    /// Assistant/AI message
    Assistant,
    /// System message
    System,
    /// Tool use message
    Tool,
    /// Error message
    Error,
    /// Info message
    Info,
}

impl TaskMessage {
    /// Create a new message
    pub fn new(msg_type: MessageType, content: Vec<ContentBlock>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            msg_type,
            timestamp: chrono::Utc::now().timestamp_millis(),
            content,
            metadata: None,
        }
    }
    
    /// Create a user message
    pub fn user(text: String) -> Self {
        Self::new(
            MessageType::User,
            vec![ContentBlock::Text { text }]
        )
    }
    
    /// Create an assistant message
    pub fn assistant(text: String) -> Self {
        Self::new(
            MessageType::Assistant,
            vec![ContentBlock::Text { text }]
        )
    }
    
    /// Create a system message
    pub fn system(text: String) -> Self {
        Self::new(
            MessageType::System,
            vec![ContentBlock::Text { text }]
        )
    }
    
    /// Create an error message
    pub fn error(text: String) -> Self {
        Self::new(
            MessageType::Error,
            vec![ContentBlock::Text { text }]
        )
    }
    
    /// Add metadata to the message
    pub fn with_metadata(mut self, metadata: serde_json::Value) -> Self {
        self.metadata = Some(metadata);
        self
    }
    
    /// Get message as JSON string
    pub fn to_json(&self) -> TaskResult<String> {
        serde_json::to_string(self).map_err(TaskError::from)
    }
    
    /// Parse message from JSON string
    pub fn from_json(json: &str) -> TaskResult<Self> {
        serde_json::from_str(json).map_err(TaskError::from)
    }
}

/// Message history manager
#[derive(Debug, Clone)]
pub struct MessageHistory {
    messages: Vec<TaskMessage>,
    max_messages: Option<usize>,
}

impl MessageHistory {
    /// Create a new message history
    pub fn new() -> Self {
        Self {
            messages: Vec::new(),
            max_messages: None,
        }
    }
    
    /// Create with maximum message limit
    pub fn with_limit(max_messages: usize) -> Self {
        Self {
            messages: Vec::new(),
            max_messages: Some(max_messages),
        }
    }
    
    /// Add a message to history
    pub fn add(&mut self, message: TaskMessage) {
        self.messages.push(message);
        
        // Trim if necessary
        if let Some(max) = self.max_messages {
            if self.messages.len() > max {
                self.messages.drain(0..self.messages.len() - max);
            }
        }
    }
    
    /// Get all messages
    pub fn messages(&self) -> &[TaskMessage] {
        &self.messages
    }
    
    /// Get message by ID
    pub fn get(&self, id: &str) -> Option<&TaskMessage> {
        self.messages.iter().find(|m| m.id == id)
    }
    
    /// Get latest message
    pub fn latest(&self) -> Option<&TaskMessage> {
        self.messages.last()
    }
    
    /// Clear all messages
    pub fn clear(&mut self) {
        self.messages.clear();
    }
    
    /// Get message count
    pub fn count(&self) -> usize {
        self.messages.len()
    }
    
    /// Filter messages by type
    pub fn filter_by_type(&self, msg_type: &MessageType) -> Vec<&TaskMessage> {
        self.messages
            .iter()
            .filter(|m| std::mem::discriminant(&m.msg_type) == std::mem::discriminant(msg_type))
            .collect()
    }
    
    /// Export to JSON
    pub fn to_json(&self) -> TaskResult<String> {
        serde_json::to_string(&self.messages).map_err(TaskError::from)
    }
    
    /// Import from JSON
    pub fn from_json(json: &str) -> TaskResult<Self> {
        let messages: Vec<TaskMessage> = serde_json::from_str(json)?;
        Ok(Self {
            messages,
            max_messages: None,
        })
    }
}

impl Default for MessageHistory {
    fn default() -> Self {
        Self::new()
    }
}

/// Host interface for message persistence
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["globalThis", "rooHost"], js_name = saveMessages, catch)]
    async fn host_save_messages(task_id: &str, messages_json: &str) -> Result<JsValue, JsValue>;
    
    #[wasm_bindgen(js_namespace = ["globalThis", "rooHost"], js_name = loadMessages, catch)]
    async fn host_load_messages(task_id: &str) -> Result<JsValue, JsValue>;
}

/// Message persistence manager
pub struct MessagePersistence {
    task_id: String,
    pending_save: bool,
}

impl MessagePersistence {
    /// Create a new persistence manager
    pub fn new(task_id: String) -> Self {
        Self {
            task_id,
            pending_save: false,
        }
    }
    
    /// Save messages to persistent storage
    pub async fn save(&mut self, history: &MessageHistory) -> TaskResult<()> {
        let json = history.to_json()?;
        
        host_save_messages(&self.task_id, &json)
            .await
            .map_err(|e| TaskError::Io(format!("Failed to save messages: {:?}", e)))?;
        
        self.pending_save = false;
        Ok(())
    }
    
    /// Load messages from persistent storage
    pub async fn load(&self) -> TaskResult<MessageHistory> {
        let js_value = host_load_messages(&self.task_id)
            .await
            .map_err(|e| TaskError::Io(format!("Failed to load messages: {:?}", e)))?;
        
        let json = js_value.as_string()
            .ok_or_else(|| TaskError::Io("Invalid message data".to_string()))?;
        
        MessageHistory::from_json(&json)
    }
    
    /// Mark that save is pending (debounced save)
    pub fn mark_pending(&mut self) {
        self.pending_save = true;
    }
    
    /// Check if save is pending
    pub fn is_pending(&self) -> bool {
        self.pending_save
    }
    
    /// Flush pending save immediately
    pub async fn flush(&mut self, history: &MessageHistory) -> TaskResult<()> {
        if self.pending_save {
            self.save(history).await?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_create_messages() {
        let user_msg = TaskMessage::user("Hello".to_string());
        assert!(matches!(user_msg.msg_type, MessageType::User));
        
        let assistant_msg = TaskMessage::assistant("Hi there".to_string());
        assert!(matches!(assistant_msg.msg_type, MessageType::Assistant));
        
        let error_msg = TaskMessage::error("Something went wrong".to_string());
        assert!(matches!(error_msg.msg_type, MessageType::Error));
    }
    
    #[test]
    fn test_message_history() {
        let mut history = MessageHistory::new();
        
        assert_eq!(history.count(), 0);
        
        history.add(TaskMessage::user("Message 1".to_string()));
        history.add(TaskMessage::assistant("Message 2".to_string()));
        
        assert_eq!(history.count(), 2);
        
        let latest = history.latest().unwrap();
        assert!(matches!(latest.msg_type, MessageType::Assistant));
    }
    
    #[test]
    fn test_message_history_limit() {
        let mut history = MessageHistory::with_limit(2);
        
        history.add(TaskMessage::user("Message 1".to_string()));
        history.add(TaskMessage::user("Message 2".to_string()));
        history.add(TaskMessage::user("Message 3".to_string()));
        
        assert_eq!(history.count(), 2);
        
        // Should only have the last 2 messages
        let messages = history.messages();
        assert!(messages[0].content[0].to_string().contains("Message 2"));
    }
    
    #[test]
    fn test_message_filter_by_type() {
        let mut history = MessageHistory::new();
        
        history.add(TaskMessage::user("User 1".to_string()));
        history.add(TaskMessage::assistant("Assistant 1".to_string()));
        history.add(TaskMessage::user("User 2".to_string()));
        
        let user_messages = history.filter_by_type(&MessageType::User);
        assert_eq!(user_messages.len(), 2);
        
        let assistant_messages = history.filter_by_type(&MessageType::Assistant);
        assert_eq!(assistant_messages.len(), 1);
    }
    
    #[test]
    fn test_message_json_serialization() {
        let msg = TaskMessage::user("Test message".to_string());
        
        let json = msg.to_json().unwrap();
        let parsed = TaskMessage::from_json(&json).unwrap();
        
        assert_eq!(msg.id, parsed.id);
        assert!(matches!(parsed.msg_type, MessageType::User));
    }
}

// Helper trait for ContentBlock display
impl std::fmt::Display for ContentBlock {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ContentBlock::Text { text } => write!(f, "{}", text),
            ContentBlock::Image { .. } => write!(f, "[Image]"),
            ContentBlock::ToolUse { name, .. } => write!(f, "[Tool: {}]", name),
            ContentBlock::ToolResult { .. } => write!(f, "[Tool Result]"),
        }
    }
}