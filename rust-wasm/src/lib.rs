//! Roo-Code Core Library - Rust+WASM Implementation
//! 
//! This library provides the core business logic for the Roo-Code VSCode extension,
//! compiled to WebAssembly for cross-platform compatibility.

use wasm_bindgen::prelude::*;

// Set up panic hook for better error messages in the browser console
#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

// Module declarations
pub mod host_interface;
pub mod task_engine;
pub mod api_integration;
pub mod tools;
pub mod conversation;
pub mod memory;
pub mod utils;

// Re-export main types
pub use host_interface::HostInterface;
pub use task_engine::{TaskEngine, TaskState, Task};

/// Initialize the Roo-Code WASM module
/// Returns version information
#[wasm_bindgen]
pub fn initialize() -> String {
    init();
    format!("Roo-Code WASM v{}", env!("CARGO_PKG_VERSION"))
}

/// Get module information
#[wasm_bindgen]
pub fn get_module_info() -> JsValue {
    let info = serde_json::json!({
        "name": env!("CARGO_PKG_NAME"),
        "version": env!("CARGO_PKG_VERSION"),
        "description": env!("CARGO_PKG_DESCRIPTION"),
        "rust_version": env!("CARGO_PKG_RUST_VERSION"),
    });
    
    serde_wasm_bindgen::to_value(&info).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initialize() {
        let result = initialize();
        assert!(result.contains("Roo-Code WASM"));
        assert!(result.contains("0.1.0"));
    }
}