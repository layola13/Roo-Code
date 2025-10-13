//! Host Interface Module
//! 
//! Defines the interface between WASM and the host environment (TypeScript/VSCode).
//! This abstraction allows WASM to call host functions without direct dependencies.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

/// Host Interface trait - defines all operations that WASM can request from the host
#[wasm_bindgen]
extern "C" {
    // File System Operations (7 functions)
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = readFile)]
    pub async fn read_file(path: String) -> JsValue;
    
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = writeFile)]
    pub async fn write_file(path: String, content: String) -> JsValue;
    
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = fileExists)]
    pub async fn file_exists(path: String) -> JsValue;
    
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = listDir)]
    pub async fn list_dir(path: String) -> JsValue;
    
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = createDir)]
    pub async fn create_dir(path: String) -> JsValue;
    
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = deleteFile)]
    pub async fn delete_file(path: String) -> JsValue;
    
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = getFileMetadata)]
    pub async fn get_file_metadata(path: String) -> JsValue;
    
    // Terminal Operations (3 functions)
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = executeCommand)]
    pub async fn execute_command(command: String, cwd: Option<String>) -> JsValue;
    
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = getTerminalOutput)]
    pub async fn get_terminal_output(process_id: String) -> JsValue;
    
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = killProcess)]
    pub async fn kill_process(process_id: String) -> JsValue;
    
    // UI Operations (4 functions)
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = showNotification)]
    pub fn show_notification(message: String, level: String);
    
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = askApproval)]
    pub async fn ask_approval(message: String, options: JsValue) -> JsValue;
    
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = askInput)]
    pub async fn ask_input(prompt: String, default_value: Option<String>) -> JsValue;
    
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = showError)]
    pub fn show_error(message: String);
    
    // Network Operations (2 functions)
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = httpRequest)]
    pub async fn http_request(url: String, config: JsValue) -> JsValue;
    
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = httpStream)]
    pub async fn http_stream(url: String, config: JsValue) -> JsValue;
    
    // Configuration Operations (2 functions)
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = getConfig)]
    pub async fn get_config(key: String) -> JsValue;
    
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = setConfig)]
    pub async fn set_config(key: String, value: String) -> JsValue;
    
    // Vector Database Operations (2 functions)
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = vectorSearch)]
    pub async fn vector_search(query: JsValue) -> JsValue;
    
    #[wasm_bindgen(js_namespace = __HOST_INTERFACE__, js_name = vectorInsert)]
    pub async fn vector_insert(data: JsValue) -> JsValue;
}

/// Result type for host operations
#[derive(Debug, Serialize, Deserialize)]
pub struct HostResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

/// File metadata structure
#[derive(Debug, Serialize, Deserialize)]
pub struct FileMetadata {
    pub size: u64,
    pub modified: u64,
    pub created: u64,
    pub is_directory: bool,
}

/// HTTP request configuration
#[derive(Debug, Serialize, Deserialize)]
pub struct HttpRequestConfig {
    pub url: String,
    pub method: String,
    pub headers: Option<serde_json::Value>,
    pub body: Option<String>,
    pub timeout: Option<u32>,
}

/// HTTP response
#[derive(Debug, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: serde_json::Value,
    pub body: String,
}

/// Host Interface wrapper for type-safe operations
pub struct HostInterface;

impl HostInterface {
    /// Read file with error handling
    pub async fn read_file_safe(path: &str) -> Result<String, String> {
        let result = read_file(path.to_string()).await;
        let parsed: HostResult<String> = serde_wasm_bindgen::from_value(result)
            .map_err(|e| format!("Failed to parse result: {}", e))?;
        
        if parsed.success {
            parsed.data.ok_or_else(|| "No data returned".to_string())
        } else {
            Err(parsed.error.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }
    
    /// Write file with error handling
    pub async fn write_file_safe(path: &str, content: &str) -> Result<(), String> {
        let result = write_file(path.to_string(), content.to_string()).await;
        let parsed: HostResult<()> = serde_wasm_bindgen::from_value(result)
            .map_err(|e| format!("Failed to parse result: {}", e))?;
        
        if parsed.success {
            Ok(())
        } else {
            Err(parsed.error.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }
    
    /// Check if file exists
    pub async fn file_exists_safe(path: &str) -> Result<bool, String> {
        let result = file_exists(path.to_string()).await;
        let parsed: HostResult<bool> = serde_wasm_bindgen::from_value(result)
            .map_err(|e| format!("Failed to parse result: {}", e))?;
        
        if parsed.success {
            Ok(parsed.data.unwrap_or(false))
        } else {
            Err(parsed.error.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_http_config_serialization() {
        let config = HttpRequestConfig {
            url: "https://api.example.com".to_string(),
            method: "GET".to_string(),
            headers: None,
            body: None,
            timeout: Some(5000),
        };
        
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("https://api.example.com"));
    }
}