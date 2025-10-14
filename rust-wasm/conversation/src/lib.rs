//! Conversation System for Roo Code
//! 
//! This module provides conversation history management, message handling,
//! and conversation condensing functionality for the Roo Code AI assistant.

use wasm_bindgen::prelude::*;
use serde_wasm_bindgen::{from_value, to_value};

pub mod error;
pub mod types;
pub mod manager;
pub mod condense;

pub use error::{ConversationError, Result};
pub use types::*;
pub use manager::ConversationManager;
pub use condense::*;

/// Initialize the conversation system
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Create a new conversation manager
#[wasm_bindgen]
pub fn create_conversation_manager() -> Result<JsValue> {
    let manager = ConversationManager::new();
    to_value(&manager).map_err(ConversationError::from)
}

/// Add a message to the conversation
#[wasm_bindgen]
pub fn add_message(
    manager_js: JsValue,
    message_js: JsValue,
) -> Result<JsValue> {
    let mut manager: ConversationManager = from_value(manager_js)?;
    let message: ApiMessage = from_value(message_js)?;
    
    manager.add_message(message);
    to_value(&manager).map_err(ConversationError::from)
}

/// Get all messages from the conversation
#[wasm_bindgen]
pub fn get_messages(manager_js: JsValue) -> Result<JsValue> {
    let manager: ConversationManager = from_value(manager_js)?;
    let messages = manager.get_messages();
    to_value(&messages).map_err(ConversationError::from)
}

/// Get conversation statistics
#[wasm_bindgen]
pub fn get_stats(manager_js: JsValue) -> Result<JsValue> {
    let manager: ConversationManager = from_value(manager_js)?;
    let stats = manager.get_stats();
    to_value(&stats).map_err(ConversationError::from)
}

/// Find a message by timestamp
#[wasm_bindgen]
pub fn find_message_by_timestamp(
    manager_js: JsValue,
    timestamp: i64,
) -> Result<JsValue> {
    let manager: ConversationManager = from_value(manager_js)?;
    match manager.find_by_timestamp(timestamp) {
        Some(msg) => to_value(&msg).map_err(ConversationError::from),
        None => Err(ConversationError::MessageNotFound(timestamp)),
    }
}

/// Clear all messages from the conversation
#[wasm_bindgen]
pub fn clear_messages(manager_js: JsValue) -> Result<JsValue> {
    let mut manager: ConversationManager = from_value(manager_js)?;
    manager.clear();
    to_value(&manager).map_err(ConversationError::from)
}

/// Get messages since last summary
#[wasm_bindgen]
pub fn get_messages_since_last_summary(
    messages_js: JsValue,
) -> Result<JsValue> {
    let messages: Vec<ApiMessage> = from_value(messages_js)?;
    let result = get_messages_since_summary(&messages);
    to_value(&result).map_err(ConversationError::from)
}

/// Truncate conversation to a specific index
#[wasm_bindgen]
pub fn truncate_conversation(
    manager_js: JsValue,
    index: usize,
) -> Result<JsValue> {
    let mut manager: ConversationManager = from_value(manager_js)?;
    manager.truncate_to_index(index)?;
    to_value(&manager).map_err(ConversationError::from)
}

/// Calculate how many messages to keep during condensing
#[wasm_bindgen]
pub fn calculate_messages_to_keep(
    total_messages: usize,
    context_usage_percent: f64,
) -> usize {
    condense::calculate_keep_count(total_messages, context_usage_percent)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manager_creation() {
        let manager = ConversationManager::new();
        assert_eq!(manager.get_messages().len(), 0);
    }

    #[test]
    fn test_add_message() {
        let mut manager = ConversationManager::new();
        let msg = ApiMessage::user("Test message");
        manager.add_message(msg);
        assert_eq!(manager.get_messages().len(), 1);
    }

    #[test]
    fn test_find_by_timestamp() {
        let mut manager = ConversationManager::new();
        let msg = ApiMessage::user("Test");
        let ts = msg.ts.unwrap();
        manager.add_message(msg);
        
        let found = manager.find_by_timestamp(ts);
        assert!(found.is_some());
    }

    #[test]
    fn test_clear() {
        let mut manager = ConversationManager::new();
        manager.add_message(ApiMessage::user("Test"));
        manager.clear();
        assert_eq!(manager.get_messages().len(), 0);
    }

    #[test]
    fn test_stats() {
        let mut manager = ConversationManager::new();
        manager.add_message(ApiMessage::user("User msg"));
        manager.add_message(ApiMessage::assistant("Assistant msg"));
        
        let stats = manager.get_stats();
        assert_eq!(stats.total_messages, 2);
        assert_eq!(stats.user_messages, 1);
        assert_eq!(stats.assistant_messages, 1);
    }
}