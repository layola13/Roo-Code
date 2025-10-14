//! Error types for the tools system.

use thiserror::Error;

/// Result type for tool operations
pub type ToolResult<T> = Result<T, ToolError>;

/// Errors that can occur in the tools system
#[derive(Error, Debug, Clone, PartialEq)]
pub enum ToolError {
    /// Tool not found in registry
    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    /// Tool not available in current context
    #[error("Tool not available: {0}")]
    ToolNotAvailable(String),

    /// Tool parameter validation error
    #[error("Invalid parameter '{param}' for tool '{tool}': {reason}")]
    InvalidParameter {
        tool: String,
        param: String,
        reason: String,
    },

    /// Missing required parameter
    #[error("Missing required parameter '{param}' for tool '{tool}'")]
    MissingParameter { tool: String, param: String },

    /// Tool not allowed in current mode
    #[error("Tool '{tool}' is not allowed in mode '{mode}'")]
    ToolNotAllowed { tool: String, mode: String },

    /// Tool call serialization error
    #[error("Failed to serialize tool call: {0}")]
    SerializationError(String),

    /// Tool call deserialization error
    #[error("Failed to deserialize tool call: {0}")]
    DeserializationError(String),

    /// Tool repetition detected
    #[error("Tool '{tool}' has been called {count} times with the same parameters")]
    RepetitionDetected { tool: String, count: usize },

    /// Invalid tool group
    #[error("Invalid tool group: {0}")]
    InvalidGroup(String),

    /// Tool history error
    #[error("Tool history error: {0}")]
    HistoryError(String),

    /// Generic tool error
    #[error("Tool error: {0}")]
    Other(String),
}

impl ToolError {
    /// Create a new InvalidParameter error
    pub fn invalid_param(tool: impl Into<String>, param: impl Into<String>, reason: impl Into<String>) -> Self {
        Self::InvalidParameter {
            tool: tool.into(),
            param: param.into(),
            reason: reason.into(),
        }
    }

    /// Create a new MissingParameter error
    pub fn missing_param(tool: impl Into<String>, param: impl Into<String>) -> Self {
        Self::MissingParameter {
            tool: tool.into(),
            param: param.into(),
        }
    }

    /// Create a new ToolNotAllowed error
    pub fn not_allowed(tool: impl Into<String>, mode: impl Into<String>) -> Self {
        Self::ToolNotAllowed {
            tool: tool.into(),
            mode: mode.into(),
        }
    }

    /// Create a new RepetitionDetected error
    pub fn repetition(tool: impl Into<String>, count: usize) -> Self {
        Self::RepetitionDetected {
            tool: tool.into(),
            count,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_not_found_error() {
        let err = ToolError::ToolNotFound("unknown_tool".to_string());
        assert_eq!(err.to_string(), "Tool not found: unknown_tool");
    }

    #[test]
    fn test_invalid_parameter_error() {
        let err = ToolError::invalid_param("read_file", "path", "path cannot be empty");
        assert_eq!(
            err.to_string(),
            "Invalid parameter 'path' for tool 'read_file': path cannot be empty"
        );
    }

    #[test]
    fn test_missing_parameter_error() {
        let err = ToolError::missing_param("write_to_file", "content");
        assert_eq!(
            err.to_string(),
            "Missing required parameter 'content' for tool 'write_to_file'"
        );
    }

    #[test]
    fn test_tool_not_allowed_error() {
        let err = ToolError::not_allowed("apply_diff", "architect");
        assert_eq!(
            err.to_string(),
            "Tool 'apply_diff' is not allowed in mode 'architect'"
        );
    }

    #[test]
    fn test_repetition_detected_error() {
        let err = ToolError::repetition("list_files", 5);
        assert_eq!(
            err.to_string(),
            "Tool 'list_files' has been called 5 times with the same parameters"
        );
    }

    #[test]
    fn test_error_equality() {
        let err1 = ToolError::missing_param("read_file", "path");
        let err2 = ToolError::missing_param("read_file", "path");
        let err3 = ToolError::missing_param("read_file", "content");

        assert_eq!(err1, err2);
        assert_ne!(err1, err3);
    }
}