//! Tools System for Roo-Code
//!
//! This crate provides a comprehensive tool management system for the Roo-Code
//! VSCode extension. It manages tool registration, validation, and execution.

pub mod error;
pub mod registry;
pub mod types;

// Re-export commonly used types
pub use error::{ToolError, ToolResult};
pub use registry::{ToolInfo, ToolRegistry};
pub use types::{ToolGroup, ToolName, ToolUse};

use wasm_bindgen::prelude::*;

/// Initialize the tools system
///
/// This should be called when the WASM module is loaded.
#[wasm_bindgen(start)]
pub fn init() {
    // Set panic hook for better error messages in browser console
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Create a new tool registry with all tools
#[wasm_bindgen]
pub fn create_tool_registry() -> JsValue {
    let registry = ToolRegistry::new();
    serde_wasm_bindgen::to_value(&registry).unwrap_or(JsValue::NULL)
}

/// Create an empty tool registry
#[wasm_bindgen]
pub fn create_empty_tool_registry() -> JsValue {
    let registry = ToolRegistry::empty();
    serde_wasm_bindgen::to_value(&registry).unwrap_or(JsValue::NULL)
}

/// Check if a tool is available in the registry
#[wasm_bindgen]
pub fn is_tool_available(registry_js: JsValue, tool_name: &str) -> bool {
    let registry: ToolRegistry = match serde_wasm_bindgen::from_value(registry_js) {
        Ok(r) => r,
        Err(_) => return false,
    };

    let tool_name = match ToolName::from_str(tool_name) {
        Some(name) => name,
        None => return false,
    };

    registry.is_tool_available(tool_name)
}

/// Get all available tools from the registry
#[wasm_bindgen]
pub fn get_available_tools(registry_js: JsValue) -> JsValue {
    let registry: ToolRegistry = match serde_wasm_bindgen::from_value(registry_js) {
        Ok(r) => r,
        Err(_) => return JsValue::NULL,
    };

    let tools: Vec<String> = registry
        .get_available_tools()
        .into_iter()
        .map(|t| t.to_string())
        .collect();

    serde_wasm_bindgen::to_value(&tools).unwrap_or(JsValue::NULL)
}

/// Get tools in a specific group
#[wasm_bindgen]
pub fn get_tools_in_group(registry_js: JsValue, group: &str) -> JsValue {
    let registry: ToolRegistry = match serde_wasm_bindgen::from_value(registry_js) {
        Ok(r) => r,
        Err(_) => return JsValue::NULL,
    };

    let group = match group {
        "read" => ToolGroup::Read,
        "edit" => ToolGroup::Edit,
        "command" => ToolGroup::Command,
        "browser" => ToolGroup::Browser,
        "mcp" => ToolGroup::Mcp,
        "modes" => ToolGroup::Modes,
        "meta" => ToolGroup::Meta,
        _ => return JsValue::NULL,
    };

    let tools: Vec<String> = registry
        .get_tools_in_group(group)
        .into_iter()
        .map(|t| t.to_string())
        .collect();

    serde_wasm_bindgen::to_value(&tools).unwrap_or(JsValue::NULL)
}

/// Register a tool in the registry
#[wasm_bindgen]
pub fn register_tool(registry_js: JsValue, tool_name: &str) -> JsValue {
    let mut registry: ToolRegistry = match serde_wasm_bindgen::from_value(registry_js) {
        Ok(r) => r,
        Err(_) => return JsValue::NULL,
    };

    let tool_name = match ToolName::from_str(tool_name) {
        Some(name) => name,
        None => return JsValue::NULL,
    };

    if registry.register(tool_name).is_ok() {
        serde_wasm_bindgen::to_value(&registry).unwrap_or(JsValue::NULL)
    } else {
        JsValue::NULL
    }
}

/// Unregister a tool from the registry
#[wasm_bindgen]
pub fn unregister_tool(registry_js: JsValue, tool_name: &str) -> JsValue {
    let mut registry: ToolRegistry = match serde_wasm_bindgen::from_value(registry_js) {
        Ok(r) => r,
        Err(_) => return JsValue::NULL,
    };

    let tool_name = match ToolName::from_str(tool_name) {
        Some(name) => name,
        None => return JsValue::NULL,
    };

    if registry.unregister(tool_name).is_ok() {
        serde_wasm_bindgen::to_value(&registry).unwrap_or(JsValue::NULL)
    } else {
        JsValue::NULL
    }
}

/// Validate a tool in the registry
#[wasm_bindgen]
pub fn validate_tool(registry_js: JsValue, tool_name: &str) -> bool {
    let registry: ToolRegistry = match serde_wasm_bindgen::from_value(registry_js) {
        Ok(r) => r,
        Err(_) => return false,
    };

    let tool_name = match ToolName::from_str(tool_name) {
        Some(name) => name,
        None => return false,
    };

    registry.validate_tool(tool_name).is_ok()
}

/// Enable all tools in a group
#[wasm_bindgen]
pub fn enable_group(registry_js: JsValue, group: &str) -> JsValue {
    let mut registry: ToolRegistry = match serde_wasm_bindgen::from_value(registry_js) {
        Ok(r) => r,
        Err(_) => return JsValue::NULL,
    };

    let group = match group {
        "read" => ToolGroup::Read,
        "edit" => ToolGroup::Edit,
        "command" => ToolGroup::Command,
        "browser" => ToolGroup::Browser,
        "mcp" => ToolGroup::Mcp,
        "modes" => ToolGroup::Modes,
        "meta" => ToolGroup::Meta,
        _ => return JsValue::NULL,
    };

    registry.enable_group(group);
    serde_wasm_bindgen::to_value(&registry).unwrap_or(JsValue::NULL)
}

/// Disable all tools in a group (except always available)
#[wasm_bindgen]
pub fn disable_group(registry_js: JsValue, group: &str) -> JsValue {
    let mut registry: ToolRegistry = match serde_wasm_bindgen::from_value(registry_js) {
        Ok(r) => r,
        Err(_) => return JsValue::NULL,
    };

    let group = match group {
        "read" => ToolGroup::Read,
        "edit" => ToolGroup::Edit,
        "command" => ToolGroup::Command,
        "browser" => ToolGroup::Browser,
        "mcp" => ToolGroup::Mcp,
        "modes" => ToolGroup::Modes,
        "meta" => ToolGroup::Meta,
        _ => return JsValue::NULL,
    };

    registry.disable_group(group);
    serde_wasm_bindgen::to_value(&registry).unwrap_or(JsValue::NULL)
}

/// Get tool count in the registry
#[wasm_bindgen]
pub fn get_tool_count(registry_js: JsValue) -> usize {
    let registry: ToolRegistry = match serde_wasm_bindgen::from_value(registry_js) {
        Ok(r) => r,
        Err(_) => return 0,
    };

    registry.tool_count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_name_all() {
        let all_tools = ToolName::all();
        assert_eq!(all_tools.len(), 21);
    }

    #[test]
    fn test_tool_groups() {
        assert_eq!(ToolName::ReadFile.group(), ToolGroup::Read);
        assert_eq!(ToolName::WriteToFile.group(), ToolGroup::Edit);
        assert_eq!(ToolName::ExecuteCommand.group(), ToolGroup::Command);
    }
}