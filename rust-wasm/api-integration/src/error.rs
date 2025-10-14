use thiserror::Error;

/// API错误类型
#[derive(Error, Debug, Clone)]
pub enum ApiError {
    #[error("HTTP request failed: {0}")]
    HttpError(String),
    
    #[error("JSON parse error: {0}")]
    JsonError(String),
    
    #[error("Invalid response: {0}")]
    InvalidResponse(String),
    
    #[error("API rate limit exceeded: {0}")]
    RateLimitError(String),
    
    #[error("Authentication failed: {0}")]
    AuthError(String),
    
    #[error("Model not found: {0}")]
    ModelNotFoundError(String),
    
    #[error("Invalid request: {0}")]
    InvalidRequestError(String),
    
    #[error("Stream processing error: {0}")]
    StreamError(String),
    
    #[error("Timeout: {0}")]
    TimeoutError(String),
    
    #[error("Unsupported provider: {0}")]
    UnsupportedProvider(String),
    
    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl ApiError {
    /// 从HTTP状态码创建错误
    pub fn from_status_code(status: u16, message: String) -> Self {
        match status {
            401 | 403 => Self::AuthError(message),
            404 => Self::ModelNotFoundError(message),
            429 => Self::RateLimitError(message),
            400 => Self::InvalidRequestError(message),
            408 | 504 => Self::TimeoutError(message),
            _ => Self::HttpError(format!("Status {}: {}", status, message)),
        }
    }
    
    /// 检查是否可重试
    pub fn is_retriable(&self) -> bool {
        matches!(
            self,
            Self::RateLimitError(_) | Self::TimeoutError(_) | Self::HttpError(_)
        )
    }
}

/// Result类型别名
pub type ApiResult<T> = Result<T, ApiError>;