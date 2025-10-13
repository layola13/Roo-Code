//! API Integration Module
//! 
//! Handles integration with AI providers (Anthropic, OpenAI, Gemini, etc.)

use serde::{Deserialize, Serialize};

/// API Provider enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ApiProvider {
    Anthropic,
    OpenAI,
    Gemini,
    Ollama,
}

/// API Request configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiRequest {
    pub provider: ApiProvider,
    pub model: String,
    pub messages: Vec<Message>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

/// Message structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

/// API Response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse {
    pub content: String,
    pub tokens_used: u32,
    pub cost: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_request_creation() {
        let request = ApiRequest {
            provider: ApiProvider::Anthropic,
            model: "claude-3-5-sonnet-20241022".to_string(),
            messages: vec![],
            max_tokens: Some(4000),
            temperature: Some(0.7),
        };
        assert_eq!(request.max_tokens, Some(4000));
    }
}