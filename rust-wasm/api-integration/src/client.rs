use wasm_bindgen::prelude::*;
use js_sys::JSON;
use std::collections::HashMap;

use crate::error::{ApiError, ApiResult};
use crate::types::{HttpRequestOptions, HttpResponse};

/// HTTP客户端 - 通过Host Interface与宿主环境通信
pub struct HttpClient;

/// Host Interface - 由宿主环境（TypeScript）实现
#[wasm_bindgen]
extern "C" {
    /// 发起HTTP请求（由宿主环境实现）
    #[wasm_bindgen(js_name = "hostHttpRequest", catch)]
    async fn host_http_request(options: JsValue) -> Result<JsValue, JsValue>;
    
    /// 记录日志
    #[wasm_bindgen(js_name = "hostLog")]
    fn host_log(level: &str, message: &str);
}

impl HttpClient {
    /// 创建新的HTTP客户端
    pub fn new() -> Self {
        Self
    }
    
    /// 发送HTTP请求
    pub async fn request(
        &self,
        method: &str,
        url: &str,
        headers: HashMap<String, String>,
        body: Option<String>,
        timeout: Option<u32>,
    ) -> ApiResult<HttpResponse> {
        let options = HttpRequestOptions {
            method: method.to_string(),
            url: url.to_string(),
            headers,
            body,
            timeout,
        };
        
        // 序列化请求选项
        let options_json = serde_json::to_string(&options)
            .map_err(|e| ApiError::JsonError(e.to_string()))?;
        
        let options_js = JSON::parse(&options_json)
            .map_err(|_| ApiError::JsonError("Failed to parse request options".to_string()))?;
        
        // 调用Host Interface
        let result = host_http_request(options_js)
            .await
            .map_err(|e| {
                let error_msg = format!("{:?}", e);
                log_error(&format!("HTTP request failed: {}", error_msg));
                ApiError::HttpError(error_msg)
            })?;
        
        // 解析响应
        let response_json = JSON::stringify(&result)
            .map_err(|_| ApiError::JsonError("Failed to stringify response".to_string()))?;
        
        let response_str = response_json.as_string()
            .ok_or_else(|| ApiError::JsonError("Response is not a string".to_string()))?;
        
        let response: HttpResponse = serde_json::from_str(&response_str)
            .map_err(|e| ApiError::JsonError(e.to_string()))?;
        
        // 检查HTTP状态码
        if response.status >= 400 {
            return Err(ApiError::from_status_code(response.status, response.body.clone()));
        }
        
        Ok(response)
    }
    
    /// GET请求
    pub async fn get(
        &self,
        url: &str,
        headers: HashMap<String, String>,
    ) -> ApiResult<HttpResponse> {
        self.request("GET", url, headers, None, None).await
    }
    
    /// POST请求
    pub async fn post(
        &self,
        url: &str,
        headers: HashMap<String, String>,
        body: String,
    ) -> ApiResult<HttpResponse> {
        self.request("POST", url, headers, Some(body), None).await
    }
    
    /// POST请求（带超时）
    pub async fn post_with_timeout(
        &self,
        url: &str,
        headers: HashMap<String, String>,
        body: String,
        timeout: u32,
    ) -> ApiResult<HttpResponse> {
        self.request("POST", url, headers, Some(body), Some(timeout)).await
    }
}

impl Default for HttpClient {
    fn default() -> Self {
        Self::new()
    }
}

/// 日志辅助函数
pub fn log_info(message: &str) {
    host_log("info", message);
}

pub fn log_error(message: &str) {
    host_log("error", message);
}

pub fn log_debug(message: &str) {
    host_log("debug", message);
}

pub fn log_warn(message: &str) {
    host_log("warn", message);
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_http_client_creation() {
        let client = HttpClient::new();
        let _ = client; // 确保client被使用
    }
    
    // 注意：实际的HTTP请求测试需要在集成测试中进行，
    // 因为它们依赖于Host Interface的实现
}