//! Conversation Module
//! 
//! Manages conversation history and message formatting

use serde::{Deserialize, Serialize};

/// Message role
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

/// Conversation message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationMessage {
    pub role: MessageRole,
    pub content: String,
    pub timestamp: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_creation() {
        let msg = ConversationMessage {
            role: MessageRole::User,
            content: "Hello".to_string(),
            timestamp: 1234567890,
        };
        assert_eq!(msg.content, "Hello");
    }
}