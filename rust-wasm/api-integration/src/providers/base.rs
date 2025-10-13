use crate::error::ApiResult;
use crate::stream::ApiStreamChunk;
use crate::types::{CreateMessageMetadata, MessageParam};

/// Base provider trait that all API providers must implement
#[async_trait::async_trait(?Send)]
pub trait BaseProvider {
    /// Create a message and return a stream of chunks
    async fn create_message(
        &self,
        system_prompt: &str,
        messages: &[MessageParam],
        metadata: Option<&CreateMessageMetadata>,
    ) -> ApiResult<Vec<ApiStreamChunk>>;

    /// Complete a single prompt (non-streaming)
    async fn complete_prompt(&self, prompt: &str) -> ApiResult<String>;

    /// Get the model ID being used
    fn get_model_id(&self) -> &str;

    /// Get the provider name
    fn get_provider_name(&self) -> &str;
}