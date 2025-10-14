//! Error types for the conversation system

use thiserror::Error;
use wasm_bindgen::JsValue;

/// Result type for conversation operations
pub type Result<T> = std::result::Result<T, ConversationError>;

/// Errors that can occur in conversation operations
#[derive(Error, Debug, Clone)]
pub enum ConversationError {
    /// Message not found
    #[error("Message not found with timestamp: {0}")]
    MessageNotFound(i64),
    
    /// Invalid message format
    #[error("Invalid message format: {0}")]
    InvalidMessageFormat(String),
    
    /// Serialization error
    #[error("Serialization error: {0}")]
    SerializationError(String),
    
    /// Deserialization error
    #[error("Deserialization error: {0}")]
    DeserializationError(String),
    
    /// Empty conversation
    #[error("Conversation is empty")]
    EmptyConversation,
    
    /// Invalid configuration
    #[error("Invalid configuration: {0}")]
    InvalidConfiguration(String),
    
    /// Condensing error
    #[error("Condensing error: {0}")]
    CondensingError(String),
    
    /// Not enough messages to condense
    #[error("Not enough messages to condense (minimum: {0}, current: {1})")]
    NotEnoughMessages(usize, usize),
    
    /// Recently condensed
    #[error("Conversation was recently condensed")]
    RecentlyCondensed,
    
    /// Context size error
    #[error("Context size error: {0}")]
    ContextSizeError(String),
    
    /// Invalid timestamp
    #[error("Invalid timestamp: {0}")]
    InvalidTimestamp(i64),
    
    /// Invalid role
    #[error("Invalid role: {0}")]
    InvalidRole(String),
    
    /// Message index out of bounds
    #[error("Message index out of bounds: {0}")]
    IndexOutOfBounds(usize),
    
    /// Generic error
    #[error("Conversation error: {0}")]
    Generic(String),
}

impl ConversationError {
    /// Create an invalid message format error
    pub fn invalid_message(msg: impl Into<String>) -> Self {
        Self::InvalidMessageFormat(msg.into())
    }
    
    /// Create a serialization error
    pub fn serialization(msg: impl Into<String>) -> Self {
        Self::SerializationError(msg.into())
    }
    
    /// Create a deserialization error
    pub fn deserialization(msg: impl Into<String>) -> Self {
        Self::DeserializationError(msg.into())
    }
    
    /// Create a condensing error
    pub fn condensing(msg: impl Into<String>) -> Self {
        Self::CondensingError(msg.into())
    }
    
    /// Create a generic error
    pub fn generic(msg: impl Into<String>) -> Self {
        Self::Generic(msg.into())
    }
}

// Conversion to JsValue for WASM interop
impl From<ConversationError> for JsValue {
    fn from(err: ConversationError) -> Self {
        JsValue::from_str(&err.to_string())
    }
}

// Conversion from serde_json errors
impl From<serde_json::Error> for ConversationError {
    fn from(err: serde_json::Error) -> Self {
        if err.is_data() {
            Self::DeserializationError(err.to_string())
        } else {
            Self::SerializationError(err.to_string())
        }
    }
}

// Conversion from serde_wasm_bindgen errors
impl From<serde_wasm_bindgen::Error> for ConversationError {
    fn from(err: serde_wasm_bindgen::Error) -> Self {
        Self::SerializationError(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_messages() {
        let err = ConversationError::MessageNotFound(12345);
        assert!(err.to_string().contains("12345"));
        
        let err = ConversationError::NotEnoughMessages(5, 3);
        assert!(err.to_string().contains("5"));
        assert!(err.to_string().contains("3"));
    }

    #[test]
    fn test_error_creation() {
        let err = ConversationError::invalid_message("Bad format");
        matches!(err, ConversationError::InvalidMessageFormat(_));
        
        let err = ConversationError::serialization("Failed to serialize");
        matches!(err, ConversationError::SerializationError(_));
    }

    #[test]
    fn test_serde_error_conversion() {
        let json_err = serde_json::from_str::<i32>("invalid")
            .unwrap_err();
        let conv_err: ConversationError = json_err.into();
        matches!(conv_err, ConversationError::DeserializationError(_));
    }
}