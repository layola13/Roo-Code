//! Tool registry for managing available tools and their capabilities.
//!
//! The registry maintains the set of available tools and provides
//! methods to query and validate tool usage.

use crate::error::{ToolError, ToolResult};
use crate::types::{ToolGroup, ToolName};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Tool registry that manages available tools
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolRegistry {
    /// Available tools (tool name -> tool info)
    tools: HashMap<ToolName, ToolInfo>,
    /// Available groups
    groups: HashSet<ToolGroup>,
}

/// Information about a tool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInfo {
    /// Tool name
    pub name: ToolName,
    /// Tool display name
    pub display_name: String,
    /// Tool group
    pub group: ToolGroup,
    /// Whether this tool is always available
    pub always_available: bool,
    /// Tool description
    pub description: String,
}

impl ToolInfo {
    /// Create tool info from a tool name
    pub fn from_name(name: ToolName) -> Self {
        Self {
            name,
            display_name: name.display_name().to_string(),
            group: name.group(),
            always_available: name.is_always_available(),
            description: Self::get_description(name),
        }
    }

    /// Get the description for a tool
    fn get_description(name: ToolName) -> String {
        match name {
            ToolName::ReadFile => "Read the contents of one or more files".to_string(),
            ToolName::FetchInstructions => "Fetch instructions for a specific task".to_string(),
            ToolName::SearchFiles => "Search for files using regex patterns".to_string(),
            ToolName::ListFiles => "List files and directories".to_string(),
            ToolName::ListCodeDefinitionNames => {
                "List code definition names from source files".to_string()
            }
            ToolName::CodebaseSearch => "Search the codebase using semantic search".to_string(),
            ToolName::ApplyDiff => "Apply precise modifications to existing files".to_string(),
            ToolName::WriteToFile => "Write content to a file".to_string(),
            ToolName::InsertContent => "Insert content at a specific line in a file".to_string(),
            ToolName::SearchAndReplace => {
                "Find and replace text or regex patterns in files".to_string()
            }
            ToolName::GenerateImage => "Generate images using AI".to_string(),
            ToolName::ExecuteCommand => "Execute a CLI command".to_string(),
            ToolName::BrowserAction => "Interact with a browser".to_string(),
            ToolName::UseMcpTool => "Use an MCP server tool".to_string(),
            ToolName::AccessMcpResource => "Access an MCP server resource".to_string(),
            ToolName::SwitchMode => "Switch to a different mode".to_string(),
            ToolName::NewTask => "Create a new task instance".to_string(),
            ToolName::AskFollowupQuestion => "Ask the user a follow-up question".to_string(),
            ToolName::AttemptCompletion => "Complete the current task".to_string(),
            ToolName::UpdateTodoList => "Update the todo list".to_string(),
            ToolName::RunSlashCommand => "Run a slash command".to_string(),
        }
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl ToolRegistry {
    /// Create a new tool registry with all available tools
    pub fn new() -> Self {
        let tools: HashMap<ToolName, ToolInfo> = ToolName::all()
            .into_iter()
            .map(|name| (name, ToolInfo::from_name(name)))
            .collect();

        let groups: HashSet<ToolGroup> = tools.values().map(|info| info.group).collect();

        Self { tools, groups }
    }

    /// Create an empty registry
    pub fn empty() -> Self {
        Self {
            tools: HashMap::new(),
            groups: HashSet::new(),
        }
    }

    /// Register a tool
    pub fn register(&mut self, name: ToolName) -> ToolResult<()> {
        let info = ToolInfo::from_name(name);
        self.groups.insert(info.group);
        self.tools.insert(name, info);
        Ok(())
    }

    /// Unregister a tool
    pub fn unregister(&mut self, name: ToolName) -> ToolResult<()> {
        if self.is_tool_available(name) {
            self.tools.remove(&name);
            // Rebuild groups set
            self.groups = self.tools.values().map(|info| info.group).collect();
            Ok(())
        } else {
            Err(ToolError::ToolNotFound(name.to_string()))
        }
    }

    /// Check if a tool is available
    pub fn is_tool_available(&self, name: ToolName) -> bool {
        self.tools.contains_key(&name)
    }

    /// Check if a group is available
    pub fn is_group_available(&self, group: ToolGroup) -> bool {
        self.groups.contains(&group)
    }

    /// Get tool info
    pub fn get_tool_info(&self, name: ToolName) -> Option<&ToolInfo> {
        self.tools.get(&name)
    }

    /// Get all available tools
    pub fn get_available_tools(&self) -> Vec<ToolName> {
        self.tools.keys().copied().collect()
    }

    /// Get all available groups
    pub fn get_available_groups(&self) -> Vec<ToolGroup> {
        self.groups.iter().copied().collect()
    }

    /// Get tools in a specific group
    pub fn get_tools_in_group(&self, group: ToolGroup) -> Vec<ToolName> {
        self.tools
            .values()
            .filter(|info| info.group == group)
            .map(|info| info.name)
            .collect()
    }

    /// Get always available tools
    pub fn get_always_available_tools(&self) -> Vec<ToolName> {
        self.tools
            .values()
            .filter(|info| info.always_available)
            .map(|info| info.name)
            .collect()
    }

    /// Validate tool availability
    pub fn validate_tool(&self, name: ToolName) -> ToolResult<()> {
        if self.is_tool_available(name) {
            Ok(())
        } else {
            Err(ToolError::ToolNotAvailable(name.to_string()))
        }
    }

    /// Get the count of registered tools
    pub fn tool_count(&self) -> usize {
        self.tools.len()
    }

    /// Get the count of registered groups
    pub fn group_count(&self) -> usize {
        self.groups.len()
    }

    /// Clear all tools except always available ones
    pub fn clear_optional_tools(&mut self) {
        self.tools.retain(|_, info| info.always_available);
        self.groups = self.tools.values().map(|info| info.group).collect();
    }

    /// Enable all tools in a group
    pub fn enable_group(&mut self, group: ToolGroup) {
        for tool in group.tools() {
            let _ = self.register(tool);
        }
    }

    /// Disable all tools in a group (except always available)
    pub fn disable_group(&mut self, group: ToolGroup) {
        let tools_to_remove: Vec<ToolName> = self
            .tools
            .values()
            .filter(|info| info.group == group && !info.always_available)
            .map(|info| info.name)
            .collect();

        for tool in tools_to_remove {
            let _ = self.unregister(tool);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_new() {
        let registry = ToolRegistry::new();
        assert_eq!(registry.tool_count(), 21); // All 21 tools
        assert!(registry.group_count() > 0);
    }

    #[test]
    fn test_registry_empty() {
        let registry = ToolRegistry::empty();
        assert_eq!(registry.tool_count(), 0);
        assert_eq!(registry.group_count(), 0);
    }

    #[test]
    fn test_register_tool() {
        let mut registry = ToolRegistry::empty();
        assert!(registry.register(ToolName::ReadFile).is_ok());
        assert!(registry.is_tool_available(ToolName::ReadFile));
        assert_eq!(registry.tool_count(), 1);
    }

    #[test]
    fn test_unregister_tool() {
        let mut registry = ToolRegistry::new();
        assert!(registry.unregister(ToolName::ReadFile).is_ok());
        assert!(!registry.is_tool_available(ToolName::ReadFile));
    }

    #[test]
    fn test_unregister_nonexistent_tool() {
        let mut registry = ToolRegistry::empty();
        let result = registry.unregister(ToolName::ReadFile);
        assert!(result.is_err());
        assert!(matches!(result, Err(ToolError::ToolNotFound(_))));
    }

    #[test]
    fn test_is_tool_available() {
        let registry = ToolRegistry::new();
        assert!(registry.is_tool_available(ToolName::ReadFile));
        assert!(registry.is_tool_available(ToolName::WriteToFile));
        assert!(registry.is_tool_available(ToolName::AttemptCompletion));
    }

    #[test]
    fn test_is_group_available() {
        let registry = ToolRegistry::new();
        assert!(registry.is_group_available(ToolGroup::Read));
        assert!(registry.is_group_available(ToolGroup::Edit));
        assert!(registry.is_group_available(ToolGroup::Meta));
    }

    #[test]
    fn test_get_tool_info() {
        let registry = ToolRegistry::new();
        let info = registry.get_tool_info(ToolName::ReadFile);
        assert!(info.is_some());
        let info = info.unwrap();
        assert_eq!(info.name, ToolName::ReadFile);
        assert_eq!(info.group, ToolGroup::Read);
    }

    #[test]
    fn test_get_available_tools() {
        let registry = ToolRegistry::new();
        let tools = registry.get_available_tools();
        assert_eq!(tools.len(), 21);
        assert!(tools.contains(&ToolName::ReadFile));
        assert!(tools.contains(&ToolName::WriteToFile));
    }

    #[test]
    fn test_get_tools_in_group() {
        let registry = ToolRegistry::new();
        let read_tools = registry.get_tools_in_group(ToolGroup::Read);
        assert!(read_tools.contains(&ToolName::ReadFile));
        assert!(read_tools.contains(&ToolName::SearchFiles));
        assert!(!read_tools.contains(&ToolName::WriteToFile));
    }

    #[test]
    fn test_get_always_available_tools() {
        let registry = ToolRegistry::new();
        let always_available = registry.get_always_available_tools();
        assert!(always_available.contains(&ToolName::AttemptCompletion));
        assert!(always_available.contains(&ToolName::AskFollowupQuestion));
        assert!(!always_available.contains(&ToolName::ReadFile));
    }

    #[test]
    fn test_validate_tool() {
        let registry = ToolRegistry::new();
        assert!(registry.validate_tool(ToolName::ReadFile).is_ok());

        let empty_registry = ToolRegistry::empty();
        let result = empty_registry.validate_tool(ToolName::ReadFile);
        assert!(result.is_err());
        assert!(matches!(result, Err(ToolError::ToolNotAvailable(_))));
    }

    #[test]
    fn test_clear_optional_tools() {
        let mut registry = ToolRegistry::new();
        let initial_count = registry.tool_count();
        registry.clear_optional_tools();
        let final_count = registry.tool_count();
        assert!(final_count < initial_count);
        // Should still have always available tools
        assert!(registry.is_tool_available(ToolName::AttemptCompletion));
        // Should not have optional tools
        assert!(!registry.is_tool_available(ToolName::ReadFile));
    }

    #[test]
    fn test_enable_group() {
        let mut registry = ToolRegistry::empty();
        registry.enable_group(ToolGroup::Read);
        assert!(registry.is_tool_available(ToolName::ReadFile));
        assert!(registry.is_tool_available(ToolName::SearchFiles));
        assert!(!registry.is_tool_available(ToolName::WriteToFile));
    }

    #[test]
    fn test_disable_group() {
        let mut registry = ToolRegistry::new();
        registry.disable_group(ToolGroup::Read);
        assert!(!registry.is_tool_available(ToolName::ReadFile));
        assert!(!registry.is_tool_available(ToolName::SearchFiles));
        // Should still have tools from other groups
        assert!(registry.is_tool_available(ToolName::WriteToFile));
    }

    #[test]
    fn test_tool_info_from_name() {
        let info = ToolInfo::from_name(ToolName::ReadFile);
        assert_eq!(info.name, ToolName::ReadFile);
        assert_eq!(info.display_name, "read files");
        assert_eq!(info.group, ToolGroup::Read);
        assert!(!info.always_available);
        assert!(!info.description.is_empty());
    }
}