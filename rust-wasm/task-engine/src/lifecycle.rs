//! Task Lifecycle Management
//! 
//! Manages task initialization, execution, and termination

use crate::error::{TaskError, TaskResult};
use crate::types::{ApiMessage, TokenUsage};
use serde::{Deserialize, Serialize};

/// Task lifecycle manager
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskLifecycle {
    task_id: String,
    is_started: bool,
    is_completed: bool,
    is_aborted: bool,
    abort_reason: Option<String>,
    start_time: Option<i64>,
    end_time: Option<i64>,
    api_history: Vec<ApiMessage>,
    token_usage: TokenUsage,
}

impl TaskLifecycle {
    /// Create a new lifecycle manager
    pub fn new(task_id: String) -> Self {
        Self {
            task_id,
            is_started: false,
            is_completed: false,
            is_aborted: false,
            abort_reason: None,
            start_time: None,
            end_time: None,
            api_history: Vec::new(),
            token_usage: TokenUsage::new(),
        }
    }
    
    /// Start the task
    pub async fn start(&mut self, _initial_message: String) -> TaskResult<()> {
        if self.is_started {
            return Err(TaskError::AlreadyStarted);
        }
        
        self.is_started = true;
        self.start_time = Some(chrono::Utc::now().timestamp_millis());
        
        Ok(())
    }
    
    /// Abort the task
    pub async fn abort(&mut self, reason: String) -> TaskResult<()> {
        if self.is_aborted {
            return Ok(());
        }
        
        self.is_aborted = true;
        self.abort_reason = Some(reason.clone());
        self.end_time = Some(chrono::Utc::now().timestamp_millis());
        
        Ok(())
    }
    
    /// Complete the task
    pub async fn complete(&mut self) -> TaskResult<()> {
        if self.is_completed {
            return Ok(());
        }
        
        if self.is_aborted {
            return Err(TaskError::TaskAborted(
                self.abort_reason.clone().unwrap_or_default()
            ));
        }
        
        self.is_completed = true;
        self.end_time = Some(chrono::Utc::now().timestamp_millis());
        
        Ok(())
    }
    
    /// Check if task is started
    pub fn is_started(&self) -> bool {
        self.is_started
    }
    
    /// Check if task is completed
    pub fn is_completed(&self) -> bool {
        self.is_completed
    }
    
    /// Check if task is aborted
    pub fn is_aborted(&self) -> bool {
        self.is_aborted
    }
    
    /// Get abort reason
    pub fn abort_reason(&self) -> Option<&str> {
        self.abort_reason.as_deref()
    }
    
    /// Get task duration in milliseconds
    pub fn duration_ms(&self) -> Option<i64> {
        match (self.start_time, self.end_time) {
            (Some(start), Some(end)) => Some(end - start),
            (Some(start), None) => {
                Some(chrono::Utc::now().timestamp_millis() - start)
            }
            _ => None,
        }
    }
    
    /// Add message to API history
    pub fn add_to_history(&mut self, message: ApiMessage) {
        self.api_history.push(message);
    }
    
    /// Get API history
    pub fn history(&self) -> &[ApiMessage] {
        &self.api_history
    }
    
    /// Clear API history
    pub fn clear_history(&mut self) {
        self.api_history.clear();
    }
    
    /// Update token usage
    pub fn update_token_usage(&mut self, usage: &TokenUsage) {
        self.token_usage.add(usage);
    }
    
    /// Get total token usage
    pub fn token_usage(&self) -> &TokenUsage {
        &self.token_usage
    }
    
    /// Get task summary
    pub fn summary(&self) -> TaskSummary {
        TaskSummary {
            task_id: self.task_id.clone(),
            is_started: self.is_started,
            is_completed: self.is_completed,
            is_aborted: self.is_aborted,
            abort_reason: self.abort_reason.clone(),
            duration_ms: self.duration_ms(),
            total_messages: self.api_history.len(),
            total_tokens: self.token_usage.total_tokens(),
        }
    }
}

/// Task summary information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSummary {
    pub task_id: String,
    pub is_started: bool,
    pub is_completed: bool,
    pub is_aborted: bool,
    pub abort_reason: Option<String>,
    pub duration_ms: Option<i64>,
    pub total_messages: usize,
    pub total_tokens: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_lifecycle_start() {
        let mut lifecycle = TaskLifecycle::new("test-task".to_string());
        
        assert!(!lifecycle.is_started());
        
        lifecycle.start("Initial message".to_string()).await.unwrap();
        
        assert!(lifecycle.is_started());
        assert!(lifecycle.start_time.is_some());
    }
    
    #[tokio::test]
    async fn test_lifecycle_complete() {
        let mut lifecycle = TaskLifecycle::new("test-task".to_string());
        
        lifecycle.start("Initial message".to_string()).await.unwrap();
        lifecycle.complete().await.unwrap();
        
        assert!(lifecycle.is_completed());
        assert!(lifecycle.end_time.is_some());
        assert!(lifecycle.duration_ms().is_some());
    }
    
    #[tokio::test]
    async fn test_lifecycle_abort() {
        let mut lifecycle = TaskLifecycle::new("test-task".to_string());
        
        lifecycle.start("Initial message".to_string()).await.unwrap();
        lifecycle.abort("User requested".to_string()).await.unwrap();
        
        assert!(lifecycle.is_aborted());
        assert_eq!(lifecycle.abort_reason(), Some("User requested"));
        
        // Should fail to complete after abort
        let result = lifecycle.complete().await;
        assert!(result.is_err());
    }
    
    #[tokio::test]
    async fn test_lifecycle_summary() {
        let mut lifecycle = TaskLifecycle::new("test-task".to_string());
        
        lifecycle.start("Initial message".to_string()).await.unwrap();
        
        // Simulate some token usage
        let usage = TokenUsage {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_tokens: 0,
            cache_read_tokens: 0,
        };
        lifecycle.update_token_usage(&usage);
        
        lifecycle.complete().await.unwrap();
        
        let summary = lifecycle.summary();
        assert_eq!(summary.task_id, "test-task");
        assert!(summary.is_completed);
        assert_eq!(summary.total_tokens, 150);
    }
}