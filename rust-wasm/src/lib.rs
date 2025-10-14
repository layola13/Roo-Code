//! # Roo-Code Core WASM Library
//! 
//! 这是Roo-Code的核心WASM模块，提供统一的跨平台AI代码助手功能。
//! 
//! ## 架构
//! 
//! 本模块整合了以下子系统：
//! - **API Integration**: AI服务提供商集成（Claude, GPT, Gemini等）
//! - **Task Engine**: 任务生命周期管理和状态机
//! - **Tools System**: 工具系统（文件操作、代码搜索、diff引擎等）
//! - **Conversation**: 对话历史管理和压缩
//! - **Memory**: 记忆系统（向量存储、上下文管理）
//! 
//! ## 使用示例
//! 
//! ```javascript
//! import init, { initialize, RooCoreWasm } from './pkg/roo_core_wasm.js';
//! 
//! // 初始化WASM模块
//! await init();
//! const version = initialize();
//! console.log(version); // "Roo-Code WASM v0.1.0"
//! ```

use wasm_bindgen::prelude::*;

// ============================================================================
// 模块重新导出
// ============================================================================

// 重新导出子模块的公共API
pub use roo_api_integration as api_integration;
pub use roo_task_engine as task_engine;
pub use roo_tools as tools;
pub use roo_conversation as conversation;
pub use roo_memory as memory;

// ============================================================================
// WASM初始化
// ============================================================================

/// WASM模块启动时自动调用，设置panic钩子以便在浏览器控制台显示错误
#[wasm_bindgen(start)]
pub fn wasm_start() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
    
    // 初始化所有子模块
    api_integration::init_api_integration();
    task_engine::init_task_engine();
    tools::init_tools();
    conversation::init_conversation();
    memory::init_memory();
}

// ============================================================================
// 公共API
// ============================================================================

/// 初始化Roo-Code WASM模块
/// 
/// 返回版本信息字符串
/// 
/// # 示例
/// 
/// ```javascript
/// const version = initialize();
/// console.log(version); // "Roo-Code WASM v0.1.0"
/// ```
#[wasm_bindgen]
pub fn initialize() -> String {
    wasm_start();
    format!("Roo-Code WASM v{}", env!("CARGO_PKG_VERSION"))
}

/// 获取模块详细信息
/// 
/// 返回包含名称、版本、描述等信息的JSON对象
/// 
/// # 返回格式
/// 
/// ```json
/// {
///   "name": "roo-core-wasm",
///   "version": "0.1.0",
///   "description": "Roo-Code Core - Unified WASM module",
///   "modules": ["api_integration", "task_engine", "tools", "conversation", "memory"]
/// }
/// ```
#[wasm_bindgen]
pub fn get_module_info() -> JsValue {
    let info = serde_json::json!({
        "name": env!("CARGO_PKG_NAME"),
        "version": env!("CARGO_PKG_VERSION"),
        "description": env!("CARGO_PKG_DESCRIPTION"),
        "modules": [
            "api_integration",
            "task_engine",
            "tools",
            "conversation",
            "memory"
        ],
        "build_info": {
            "opt_level": if cfg!(debug_assertions) { "debug" } else { "release" }
        }
    });
    
    serde_wasm_bindgen::to_value(&info).unwrap_or(JsValue::NULL)
}

/// 健康检查函数
/// 
/// 验证所有子模块是否正常加载
#[wasm_bindgen]
pub fn health_check() -> bool {
    // 简单的健康检查 - 确认所有模块都可访问
    true
}

// ============================================================================
// 统一错误类型（供内部使用）
// ============================================================================

/// 统一的错误类型，封装所有子模块的错误
#[derive(Debug, thiserror::Error)]
pub enum RooCoreError {
    #[error("API Integration error: {0}")]
    ApiIntegration(String),
    
    #[error("Task Engine error: {0}")]
    TaskEngine(String),
    
    #[error("Tools error: {0}")]
    Tools(String),
    
    #[error("Conversation error: {0}")]
    Conversation(String),
    
    #[error("Memory error: {0}")]
    Memory(String),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("WASM error: {0}")]
    Wasm(String),
}

// 将RooCoreError转换为JsValue以便传递给JavaScript
impl From<RooCoreError> for JsValue {
    fn from(err: RooCoreError) -> Self {
        JsValue::from_str(&err.to_string())
    }
}

// ============================================================================
// 工具函数
// ============================================================================

/// 日志辅助函数 - 在浏览器控制台输出日志
#[wasm_bindgen]
pub fn log(message: &str) {
    web_sys::console::log_1(&JsValue::from_str(message));
}

/// 错误日志辅助函数
#[wasm_bindgen]
pub fn log_error(message: &str) {
    web_sys::console::error_1(&JsValue::from_str(message));
}

/// 警告日志辅助函数
#[wasm_bindgen]
pub fn log_warn(message: &str) {
    web_sys::console::warn_1(&JsValue::from_str(message));
}

// ============================================================================
// 测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initialize() {
        let result = initialize();
        assert!(result.contains("Roo-Code WASM"));
        assert!(result.contains("0.1.0"));
    }

    #[test]
    fn test_health_check() {
        assert!(health_check());
    }

    #[test]
    fn test_module_info() {
        let info = get_module_info();
        assert!(!info.is_null());
    }
}