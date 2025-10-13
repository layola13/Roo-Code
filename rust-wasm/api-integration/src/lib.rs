use wasm_bindgen::prelude::*;

pub mod types;
pub mod error;
pub mod stream;
pub mod client;
pub mod providers;

// 重新导出核心类型
pub use types::*;
pub use error::{ApiError, ApiResult};
pub use stream::{ApiStreamChunk, StreamAccumulator, GroundingSource};
pub use client::HttpClient;
pub use providers::base::BaseProvider;
pub use providers::anthropic::AnthropicProvider;

/// API Integration模块版本
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// 初始化API Integration模块
#[wasm_bindgen(start)]
pub fn init() {
    // 设置panic hook以便在浏览器控制台看到panic信息
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// 获取模块版本
#[wasm_bindgen(js_name = "getApiIntegrationVersion")]
pub fn get_version() -> String {
    VERSION.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
    }
    
    #[test]
    fn test_get_version() {
        let version = get_version();
        assert_eq!(version, VERSION);
    }
}