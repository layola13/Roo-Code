use crate::error::{ApiError, ApiResult};
use crate::types::ApiHandlerOptions;
use crate::providers::base::BaseProvider;
use crate::providers::anthropic::AnthropicProvider;
use crate::providers::openai::OpenAIProvider;
use crate::types::ApiProvider;

/// Provider factory for creating API provider instances
pub struct ProviderFactory;

impl ProviderFactory {
    /// Create a provider instance based on the configuration
    /// 
    /// # Arguments
    /// * `options` - API handler configuration options
    /// 
    /// # Returns
    /// A boxed trait object implementing BaseProvider
    /// 
    /// # Errors
    /// Returns an error if the provider type is not supported
    pub fn create(options: ApiHandlerOptions) -> ApiResult<Box<dyn BaseProvider>> {
        match options.api_provider {
            ApiProvider::Anthropic => {
                let api_key = options.api_key.clone();
                let model_id = options.api_model_id.clone();
                let mut provider = AnthropicProvider::new(api_key, model_id);
                if let Some(base_url) = options.anthropic_base_url {
                    provider = provider.with_base_url(base_url);
                }
                Ok(Box::new(provider))
            }
            ApiProvider::OpenAi | ApiProvider::OpenAiNative => {
                // OpenAIProvider takes ApiHandlerOptions directly
                Ok(Box::new(OpenAIProvider::new(options)))
            }
            ApiProvider::Gemini => {
                Err(ApiError::UnsupportedProvider(
                    "Gemini provider is not yet implemented".to_string()
                ))
            }
            ApiProvider::DeepSeek => {
                Err(ApiError::UnsupportedProvider(
                    "DeepSeek provider is not yet implemented".to_string()
                ))
            }
            ApiProvider::Ollama => {
                Err(ApiError::UnsupportedProvider(
                    "Ollama provider is not yet implemented".to_string()
                ))
            }
            ApiProvider::OpenRouter => {
                Err(ApiError::UnsupportedProvider(
                    "OpenRouter provider is not yet implemented".to_string()
                ))
            }
            ApiProvider::Unknown => {
                Err(ApiError::UnsupportedProvider(
                    "Unknown provider type".to_string()
                ))
            }
        }
    }
    
    /// Check if a provider type is supported
    pub fn is_supported(provider: &ApiProvider) -> bool {
        matches!(
            provider,
            ApiProvider::Anthropic | ApiProvider::OpenAi | ApiProvider::OpenAiNative
        )
    }
    
    /// Get list of supported providers
    pub fn supported_providers() -> Vec<ApiProvider> {
        vec![
            ApiProvider::Anthropic,
            ApiProvider::OpenAi,
            ApiProvider::OpenAiNative,
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    fn create_test_options(provider: ApiProvider) -> ApiHandlerOptions {
        ApiHandlerOptions {
            api_provider: provider,
            api_model_id: "test-model".to_string(),
            api_key: "test-key".to_string(),
            anthropic_base_url: None,
            anthropic_use_auth_token: None,
            anthropic_beta_1m_context: None,
            openai_base_url: None,
            openai_model_id: None,
            temperature: None,
            max_tokens: None,
        }
    }
    
    #[test]
    fn test_create_anthropic_provider() {
        let options = create_test_options(ApiProvider::Anthropic);
        let provider = ProviderFactory::create(options);
        
        assert!(provider.is_ok());
        let provider = provider.unwrap();
        assert_eq!(provider.get_provider_name(), "anthropic");
    }
    
    #[test]
    fn test_create_openai_provider() {
        let options = create_test_options(ApiProvider::OpenAi);
        let provider = ProviderFactory::create(options);
        
        assert!(provider.is_ok());
        let provider = provider.unwrap();
        assert_eq!(provider.get_provider_name(), "openai");
    }
    
    #[test]
    fn test_create_openai_native_provider() {
        let options = create_test_options(ApiProvider::OpenAiNative);
        let provider = ProviderFactory::create(options);
        
        assert!(provider.is_ok());
        let provider = provider.unwrap();
        assert_eq!(provider.get_provider_name(), "openai");
    }
    
    #[test]
    fn test_create_unsupported_provider() {
        let options = create_test_options(ApiProvider::Gemini);
        let provider = ProviderFactory::create(options);
        
        assert!(provider.is_err());
        match provider {
            Err(ApiError::UnsupportedProvider(msg)) => {
                assert!(msg.contains("Gemini"));
            }
            _ => panic!("Expected UnsupportedProvider error"),
        }
    }
    
    #[test]
    fn test_is_supported() {
        assert!(ProviderFactory::is_supported(&ApiProvider::Anthropic));
        assert!(ProviderFactory::is_supported(&ApiProvider::OpenAi));
        assert!(ProviderFactory::is_supported(&ApiProvider::OpenAiNative));
        assert!(!ProviderFactory::is_supported(&ApiProvider::Gemini));
        assert!(!ProviderFactory::is_supported(&ApiProvider::DeepSeek));
        assert!(!ProviderFactory::is_supported(&ApiProvider::Unknown));
    }
    
    #[test]
    fn test_supported_providers_list() {
        let supported = ProviderFactory::supported_providers();
        
        assert_eq!(supported.len(), 3);
        assert!(supported.contains(&ApiProvider::Anthropic));
        assert!(supported.contains(&ApiProvider::OpenAi));
        assert!(supported.contains(&ApiProvider::OpenAiNative));
    }
}