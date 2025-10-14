//! Error types for the memory system

use thiserror::Error;
use wasm_bindgen::JsValue;

/// Result type alias for memory operations
pub type MemoryResult<T> = Result<T, MemoryError>;

/// Memory system error types
#[derive(Error, Debug)]
pub enum MemoryError {
    /// Memory not found
    #[error("Memory not found: {0}")]
    MemoryNotFound(String),

    /// Invalid memory format
    #[error("Invalid memory format: {0}")]
    InvalidFormat(String),

    /// Serialization error
    #[error("Serialization error: {0}")]
    SerializationError(String),

    /// Deserialization error
    #[error("Deserialization error: {0}")]
    DeserializationError(String),

    /// Invalid configuration
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    /// Memory extraction failed
    #[error("Memory extraction failed: {0}")]
    ExtractionFailed(String),

    /// Pattern matching failed
    #[error("Pattern matching failed: {0}")]
    PatternMatchFailed(String),

    /// Similarity calculation failed
    #[error("Similarity calculation failed: {0}")]
    SimilarityFailed(String),

    /// Vector store operation failed
    #[error("Vector store operation failed: {0}")]
    VectorStoreFailed(String),

    /// Enhancement operation failed
    #[error("Enhancement operation failed: {0}")]
    EnhancementFailed(String),

    /// Knowledge graph operation failed
    #[error("Knowledge graph operation failed: {0}")]
    KnowledgeGraphFailed(String),

    /// Invalid priority level
    #[error("Invalid priority level: {0}")]
    InvalidPriority(String),

    /// Invalid memory type
    #[error("Invalid memory type: {0}")]
    InvalidType(String),

    /// Memory limit exceeded
    #[error("Memory limit exceeded: {0}")]
    LimitExceeded(String),

    /// Regex compilation error
    #[error("Regex error: {0}")]
    RegexError(String),
}

impl From<serde_json::Error> for MemoryError {
    fn from(err: serde_json::Error) -> Self {
        MemoryError::SerializationError(err.to_string())
    }
}

impl From<regex::Error> for MemoryError {
    fn from(err: regex::Error) -> Self {
        MemoryError::RegexError(err.to_string())
    }
}

impl From<serde_wasm_bindgen::Error> for MemoryError {
    fn from(err: serde_wasm_bindgen::Error) -> Self {
        MemoryError::SerializationError(err.to_string())
    }
}

impl From<MemoryError> for JsValue {
    fn from(err: MemoryError) -> Self {
        JsValue::from_str(&err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = MemoryError::MemoryNotFound("test-id".to_string());
        assert_eq!(err.to_string(), "Memory not found: test-id");
    }

    #[test]
    fn test_error_conversion_from_json() {
        let json_err = serde_json::from_str::<serde_json::Value>("invalid").unwrap_err();
        let mem_err: MemoryError = json_err.into();
        assert!(matches!(mem_err, MemoryError::SerializationError(_)));
    }

    #[cfg(target_arch = "wasm32")]
    #[test]
    fn test_error_to_jsvalue() {
        let err = MemoryError::InvalidFormat("bad data".to_string());
        let js_val: JsValue = err.into();
        assert!(js_val.is_string());
    }
}