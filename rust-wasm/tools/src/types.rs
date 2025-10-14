
//! Core type definitions for the tools system.
//!
//! This module defines all tool types, parameters, and related structures
//! used throughout the Roo-Code tools system.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;

/// Tool names enum - represents all available tools in the system
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolName {
    // Read tools
    ReadFile,
    FetchInstructions,
    SearchFiles,
    ListFiles,
    ListCodeDefinitionNames,
    CodebaseSearch,

    // Edit tools
    ApplyDiff,
    WriteToFile,
    InsertContent,
    SearchAndReplace,
    GenerateImage,

    // Command tools
    ExecuteCommand,

    // Browser tools
    BrowserAction,

    // MCP tools
    UseMcpTool,
    AccessMcpResource,

    // Mode management tools
    SwitchMode,
    NewTask,

    // Meta tools (always available)
    AskFollowupQuestion,
    AttemptCompletion,
    UpdateTodoList,
    RunSlashCommand,
}

impl ToolName {
    /// Get the display name for this tool
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::ReadFile => "read files",
            Self::FetchInstructions => "fetch instructions",
            Self::SearchFiles => "search files",
            Self::ListFiles => "list files",
            Self::ListCodeDefinitionNames => "list definitions",
            Self::CodebaseSearch => "codebase search",
            Self::ApplyDiff => "apply changes",
            Self::WriteToFile => "write files",
            Self::InsertContent => "insert content",
            Self::SearchAndReplace => "search and replace",
            Self::GenerateImage => "generate images",
            Self::ExecuteCommand => "run commands",
            Self::BrowserAction => "use a browser",
            Self::UseMcpTool => "use mcp tools",
            Self::AccessMcpResource => "access mcp resources",
            Self::SwitchMode => "switch modes",
            Self::NewTask => "create new task",
            Self::AskFollowupQuestion => "ask questions",
            Self::AttemptCompletion => "complete tasks",
            Self::UpdateTodoList => "update todo list",
            Self::RunSlashCommand => "run slash command",
        }
    }

    /// Get the tool name as a string (snake_case)
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ReadFile => "read_file",
            Self::FetchInstructions => "fetch_instructions",
            Self::SearchFiles => "search_files",
            Self::ListFiles => "list_files",
            Self::ListCodeDefinitionNames => "list_code_definition_names",
            Self::CodebaseSearch => "codebase_search",
            Self::ApplyDiff => "apply_diff",
            Self::WriteToFile => "write_to_file",
            Self::InsertContent => "insert_content",
            Self::SearchAndReplace => "search_and_replace",
            Self::GenerateImage => "generate_image",
            Self::ExecuteCommand => "execute_command",
            Self::BrowserAction => "browser_action",
            Self::UseMcpTool => "use_mcp_tool",
            Self::AccessMcpResource => "access_mcp_resource",
            Self::SwitchMode => "switch_mode",
            Self::NewTask => "new_task",
            Self::AskFollowupQuestion => "ask_followup_question",
            Self::AttemptCompletion => "attempt_completion",
            Self::UpdateTodoList => "update_todo_list",
            Self::RunSlashCommand => "run_slash_command",
        }
    }

    /// Get the tool group this tool belongs to
    pub fn group(&self) -> ToolGroup {
        match self {
            Self::ReadFile
            | Self::FetchInstructions
            | Self::SearchFiles
            | Self::ListFiles
            | Self::ListCodeDefinitionNames
            | Self::CodebaseSearch => ToolGroup::Read,

            Self::ApplyDiff
            | Self::WriteToFile
            | Self::InsertContent
            | Self::SearchAndReplace
            | Self::GenerateImage => ToolGroup::Edit,

            Self::ExecuteCommand => ToolGroup::Command,

            Self::BrowserAction => ToolGroup::Browser,

            Self::UseMcpTool | Self::AccessMcpResource => ToolGroup::Mcp,

            Self::SwitchMode | Self::NewTask => ToolGroup::Modes,

            Self::AskFollowupQuestion
            | Self::AttemptCompletion
            | Self::UpdateTodoList
            | Self::RunSlashCommand => ToolGroup::Meta,
        }
    }

    /// Check if this tool is always available (meta tools)
    pub fn is_always_available(&self) -> bool {
        matches!(
            self,
            Self::AskFollowupQuestion
                | Self::AttemptCompletion
                | Self::SwitchMode
                | Self::NewTask
                | Self::UpdateTodoList
                | Self::RunSlashCommand
        )
    }

    /// Get all tool names
    pub fn all() -> Vec<Self> {
        vec![
            Self::ReadFile,
            Self::FetchInstructions,
            Self::SearchFiles,
            Self::ListFiles,
            Self::ListCodeDefinitionNames,
            Self::CodebaseSearch,
            Self::ApplyDiff,
            Self::WriteToFile,
            Self::InsertContent,
            Self::SearchAndReplace,
            Self::GenerateImage,
            Self::ExecuteCommand,
            Self::BrowserAction,
            Self::UseMcpTool,
            Self::AccessMcpResource,
            Self::SwitchMode,
            Self::NewTask,
            Self::AskFollowupQuestion,
            Self::AttemptCompletion,
            Self::UpdateTodoList,
            Self::RunSlashCommand,
        ]
    }

    /// Parse a tool name from a string
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "read_file" => Some(Self::ReadFile),
            "fetch_instructions" => Some(Self::FetchInstructions),
            "search_files" => Some(Self::SearchFiles),
            "list_files" => Some(Self::ListFiles),
            "list_code_definition_names" => Some(Self::ListCodeDefinitionNames),
            "codebase_search" => Some(Self::CodebaseSearch),
            "apply_diff" => Some(Self::ApplyDiff),
            "write_to_file" => Some(Self::WriteToFile),
            "insert_content" => Some(Self::InsertContent),
            "search_and_replace" => Some(Self::SearchAndReplace),
            "generate_image" => Some(Self::GenerateImage),
            "execute_command" => Some(Self::ExecuteCommand),
            "browser_action" => Some(Self::BrowserAction),
            "use_mcp_tool" => Some(Self::UseMcpTool),
            "access_mcp_resource" => Some(Self::AccessMcpResource),
            "switch_mode" => Some(Self::SwitchMode),
            "new_task" => Some(Self::NewTask),
            "ask_followup_question" => Some(Self::AskFollowupQuestion),
            "attempt_completion" => Some(Self::AttemptCompletion),
            "update_todo_list" => Some(Self::UpdateTodoList),
            "run_slash_command" => Some(Self::RunSlashCommand),
            _ => None,
        }
    }
}

impl fmt::Display for ToolName {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Tool groups - logical groupings of related tools
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ToolGroup {
    /// Tools for reading files and code
    Read,
    /// Tools for editing files
    Edit,
    /// Tools for executing commands
    Command,
    /// Tools for browser interaction
    Browser,
    /// Tools for MCP server interaction
    Mcp,
    /// Tools for mode management
    Modes,
    /// Meta tools (always available)
    Meta,
}

impl ToolGroup {
    /// Get all tools in this group
    pub fn tools(&self) -> Vec<ToolName> {
        ToolName::all()
            .into_iter()
            .filter(|tool| tool.group() == *self)
            .collect()
    }

    /// Check if this group is always available
    pub fn is_always_available(&self) -> bool {
        matches!(self, Self::Meta | Self::Modes)
    }
}

impl fmt::Display for ToolGroup {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Read => write!(f, "read"),
            Self::Edit => write!(f, "edit"),
            Self::Command => write!(f, "command"),
            Self::Browser => write!(f, "browser"),
            Self::Mcp => write!(f, "mcp"),
            Self::Modes => write!(f, "modes"),
            Self::Meta => write!(f, "meta"),
        }
    }
}

/// Represents a tool invocation/usage
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolUse {
    /// The tool being used
    pub name: ToolName,
    /// Tool parameters (parameter name -> value)
    pub params: HashMap<String, String>,
    /// Whether this tool use is partial (streaming in progress)
    pub partial: bool,
}

impl ToolUse {
    /// Create a new tool use
    pub fn new(name: ToolName) -> Self {
        Self {
            name,
            params: HashMap::new(),
            partial: false,
        }
    }

    /// Add a parameter to this tool use
    pub fn with_param(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.params.insert(key.into(), value.into());
        self
    }

    /// Set whether this tool use is partial
    pub fn with_partial(mut self, partial: bool) -> Self {
        self.partial = partial;
        self
    }

    /// Get a parameter value
    pub fn get_param(&self, key: &str) -> Option<&String> {
        self.params.get(key)
    }

    /// Check if a parameter exists
    pub fn has_param(&self, key: &str) -> bool {
        self.params.contains_key(key)
    }

    /// Get the number of parameters
    pub fn param_count(&self) -> usize {
        self.params.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_name_display_name() {
        assert_eq!(ToolName::ReadFile.display_name(), "read files");
        assert_eq!(ToolName::WriteToFile.display_name(), "write files");
        assert_eq!(ToolName::ExecuteCommand.display_name(), "run commands");
    }

    #[test]
    fn test_tool_name_as_str() {
        assert_eq!(ToolName::ReadFile.as_str(), "read_file");
        assert_eq!(ToolName::WriteToFile.as_str(), "write_to_file");
        assert_eq!(ToolName::ListFiles.as_str(), "list_files");
    }

    #[test]
    fn test_tool_name_group() {
        assert_eq!(ToolName::ReadFile.group(), ToolGroup::Read);
        assert_eq!(ToolName::WriteToFile.group(), ToolGroup::Edit);
        assert_eq!(ToolName::ExecuteCommand.group(), ToolGroup::Command);
        assert_eq!(ToolName::BrowserAction.group(), ToolGroup::Browser);
        assert_eq!(ToolName::UseMcpTool.group(), ToolGroup::Mcp);
        assert_eq!(ToolName::SwitchMode.group(), ToolGroup::Modes);
        assert_eq!(ToolName::AttemptCompletion.group(), ToolGroup::Meta);
    }

    #[test]
    fn test_tool_name_is_always_available() {
        assert!(ToolName::AttemptCompletion.is_always_available());
        assert!(ToolName::AskFollowupQuestion.is_always_available());
        assert!(ToolName::SwitchMode.is_always_available());
        assert!(ToolName::UpdateTodoList.is_always_available());

        assert!(!ToolName::ReadFile.is_always_available());
        assert!(!ToolName::WriteToFile.is_always_available());
    }

    #[test]
    fn test_tool_name_all() {
        let all_tools = ToolName::all();
        assert_eq!(all_tools.len(), 21); // Total number of tools
        assert!(all_tools.contains(&ToolName::ReadFile));
        assert!(all_tools.contains(&ToolName::AttemptCompletion));
    }

    #[test]
    fn test_tool_name_from_str() {
        assert_eq!(ToolName::from_str("read_file"), Some(ToolName::ReadFile));
        assert_eq!(
            ToolName::from_str("write_to_file"),
            Some(ToolName::WriteToFile)
        );
        assert_eq!(ToolName::from_str("unknown_tool"), None);
    }

    #[test]
    fn test_tool_name_to_string() {
        assert_eq!(ToolName::ReadFile.to_string(), "read_file");
        assert_eq!(ToolName::WriteToFile.to_string(), "write_to_file");
    }

    #[test]
    fn test_tool_group_tools() {
        let read_tools = ToolGroup::Read.tools();
        assert!(read_tools.contains(&ToolName::ReadFile));
        assert!(read_tools.contains(&ToolName::SearchFiles));
        assert!(!read_tools.contains(&ToolName::WriteToFile));

        let edit_tools = ToolGroup::Edit.tools();
        assert!(edit_tools.contains(&ToolName::WriteToFile));
        assert!(edit_tools.contains(&ToolName::ApplyDiff));
        assert!(!edit_tools.contains(&ToolName::ReadFile));
    }

    #[test]
    fn test_tool_group_is_always_available() {
        assert!(ToolGroup::Meta.is_always_available());
        assert!(ToolGroup::Modes.is_always_available());
        assert!(!ToolGroup::Read.is_always_available());
        assert!(!ToolGroup::Edit.is_always_available());
    }

    #[test]
    fn test_tool_use_creation() {
        let tool_use = ToolUse::new(ToolName::ReadFile)
            .with_param("path", "test.txt")
            .with_param("start_line", "1")
            .with_partial(false);

        assert_eq!(tool_use.name, ToolName::ReadFile);
        assert_eq!(tool_use.get_param("path"), Some(&"test.txt".to_string()));
        assert_eq!(tool_use.get_param("start_line"), Some(&"1".to_string()));
        assert!(!tool_use.partial);
        assert_eq!(tool_use.param_count(), 2);
    }

    #[test]
    fn test_tool_use_params() {
        let mut tool_use = ToolUse::new(ToolName::WriteToFile);
        tool_use = tool_use.with_param("path", "output.txt");
        
        assert!(tool_use.has_param("path"));
        assert!(!tool_use.has_param("content"));
        assert_eq!(tool_use.param_count(), 1);
    }

    #[test]
    fn test_tool_use_partial() {
        let tool_use = ToolUse::new(ToolName::ReadFile).with_partial(true);
        assert!(tool_use.partial);
    }
}