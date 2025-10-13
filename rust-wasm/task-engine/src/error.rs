//! Task Engine Error Types

use thiserror::Error;
use wasm_bindgen::JsValue;

/// Task engine error types
#[derive(Error, Debug)]
pub enum TaskError {
    #[error("Task not initialized")]
    NotInitialized,
    
    #[error("Task already started")]
    AlreadyStarted,
    
    #[error("Task is paused")]
    TaskPaused,
    
    #[error("Task is aborted: {0}")]
    TaskAborted(String),
    
    #[error("Task is completed")]
    TaskCompleted,
    
    #[error("Invalid state transition from {from} to {to}")]
    InvalidTransition { from: String, to: String },
    
    #[error("Host interface error: {0}")]
    HostInterface(String),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Message error: {0}")]
    Message(String),
    
    #[error("Lifecycle error: {0}")]
    Lifecycle(String),
    
    #[error("IO error: {0}")]
    Io(String),
    
    #[error("{0}")]
    Other(String),
}

impl From<TaskError> for JsValue {
    fn from(error: TaskError) -> Self {
        JsValue::from_str(&error.to_string())
    }
}

impl From<String> for TaskError {
    fn from(s: String) -> Self {
        TaskError::Other(s)
    }
}

impl From<&str> for TaskError {
    fn from(s: &str) -> Self {
        TaskError::Other(s.to_string())
    }
}

/// Result type for task operations
pub type TaskResult<T> = Result<T, TaskError>;