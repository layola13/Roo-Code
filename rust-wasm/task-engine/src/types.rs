//! Task Engine Types
//! 
//! Core type definitions for task management

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// Task status enumeration
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskStatus {
    /// Task is currently running
    Running,
    /// Task is waiting for user interaction
    Interactive,
    /// Task is in a resumable state
    Resumable,
    /// Task is idle/waiting
    Idle,
    /// Task is paused (waiting for subtask)
    Paused,
    /// Task has been aborted
    Aborted,
    /// Task has completed successfully
    Completed,
}

impl TaskStatus {
    pub fn as_str(&self) -> &str {
        match self {
            TaskStatus::Running => "running",
            TaskStatus::Interactive => "interactive",
            TaskStatus::Resumable => "resumable",
            TaskStatus::Idle => "idle",
            TaskStatus::Paused => "paused",
            TaskStatus::Aborted => "aborted",
            TaskStatus::Completed => "completed",
        }
    }
}

/// Task metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskMetadata {
    /// Task description/title
    pub title: String,
    /// Creation timestamp
    pub created_at: i64,
    /// Last updated timestamp
    pub updated_at: i64,
    /// Associated images
    pub images: Vec<String>,
    /// Task mode
    pub mode: String,
}

impl TaskMetadata {
    pub fn new(title: String, mode: String) -> Self {
        let now = chrono::Utc::now().timestamp_millis();
        Self {
            title,
            created_at: now,
            updated_at: now,
            images: Vec::new(),
            mode,
        }
    }
    
    pub fn update_timestamp(&mut self) {
        self.updated_at = chrono::Utc::now().timestamp_millis();
    }
}

/// Todo item structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoItem {
    /// Todo text
    pub text: String,
    /// Completion status
    pub completed: bool,
    /// In progress status
    pub in_progress: bool,
    /// Creation timestamp
    pub created_at: i64,
}

impl TodoItem {
    pub fn new(text: String) -> Self {
        Self {
            text,
            completed: false,
            in_progress: false,
            created_at: chrono::Utc::now().timestamp_millis(),
        }
    }
    
    pub fn mark_completed(&mut self) {
        self.completed = true;
        self.in_progress = false;
    }
    
    pub fn mark_in_progress(&mut self) {
        self.in_progress = true;
        self.completed = false;
    }
}

/// Tool usage statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ToolUsage {
    /// Total tool calls
    pub total_calls: u32,
    /// Successful calls
    pub successful_calls: u32,
    /// Failed calls
    pub failed_calls: u32,
    /// Tool usage breakdown by tool name
    pub by_tool: std::collections::HashMap<String, u32>,
}

impl ToolUsage {
    pub fn new() -> Self {
        Self::default()
    }
    
    pub fn record_call(&mut self, tool_name: &str, success: bool) {
        self.total_calls += 1;
        if success {
            self.successful_calls += 1;
        } else {
            self.failed_calls += 1;
        }
        *self.by_tool.entry(tool_name.to_string()).or_insert(0) += 1;
    }
}

/// Token usage tracking
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TokenUsage {
    /// Input tokens
    pub input_tokens: u64,
    /// Output tokens
    pub output_tokens: u64,
    /// Cache creation tokens
    pub cache_creation_tokens: u64,
    /// Cache read tokens
    pub cache_read_tokens: u64,
}

impl TokenUsage {
    pub fn new() -> Self {
        Self::default()
    }
    
    pub fn add(&mut self, other: &TokenUsage) {
        self.input_tokens += other.input_tokens;
        self.output_tokens += other.output_tokens;
        self.cache_creation_tokens += other.cache_creation_tokens;
        self.cache_read_tokens += other.cache_read_tokens;
    }
    
    pub fn total_tokens(&self) -> u64 {
        self.input_tokens + self.output_tokens
    }
}

/// Message content block type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ContentBlock {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image { source: ImageSource },
    #[serde(rename = "tool_use")]
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    #[serde(rename = "tool_result")]
    ToolResult {
        tool_use_id: String,
        content: String,
        is_error: bool,
    },
}

/// Image source specification
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ImageSource {
    #[serde(rename = "base64")]
    Base64 {
        media_type: String,
        data: String,
    },
    #[serde(rename = "url")]
    Url { url: String },
}

/// API message structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiMessage {
    pub role: MessageRole,
    pub content: Vec<ContentBlock>,
}

/// Message role
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

/// Task event types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskEventType {
    TaskStarted,
    TaskCompleted,
    TaskAborted,
    TaskPaused,
    TaskUnpaused,
    TaskSpawned,
    TaskActive,
    TaskInteractive,
    TaskResumable,
    TaskIdle,
    MessageCreated,
    MessageUpdated,
    TokenUsageUpdated,
}

impl TaskEventType {
    pub fn as_str(&self) -> &str {
        match self {
            TaskEventType::TaskStarted => "task_started",
            TaskEventType::TaskCompleted => "task_completed",
            TaskEventType::TaskAborted => "task_aborted",
            TaskEventType::TaskPaused => "task_paused",
            TaskEventType::TaskUnpaused => "task_unpaused",
            TaskEventType::TaskSpawned => "task_spawned",
            TaskEventType::TaskActive => "task_active",
            TaskEventType::TaskInteractive => "task_interactive",
            TaskEventType::TaskResumable => "task_resumable",
            TaskEventType::TaskIdle => "task_idle",
            TaskEventType::MessageCreated => "message_created",
            TaskEventType::MessageUpdated => "message_updated",
            TaskEventType::TokenUsageUpdated => "token_usage_updated",
        }
    }
}