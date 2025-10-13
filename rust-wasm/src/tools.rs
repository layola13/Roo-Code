//! Tools System Module
//! 
//! Manages tool execution and tool lifecycle

use serde::{Deserialize, Serialize};

/// Tool type enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ToolType {
    ReadFile,
    WriteFile,
    ApplyDiff,
    ExecuteCommand,
    SearchFiles,
    AskQuestion,
}

/// Tool execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_result_success() {
        let result = ToolResult {
            success: true,
            output: "File read successfully".to_string(),
            error: None,
        };
        assert!(result.success);
        assert!(result.error.is_none());
    }
}