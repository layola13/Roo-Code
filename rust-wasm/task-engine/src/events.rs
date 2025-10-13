//! Task Event System
//! 
//! Handles event emission to the host environment

use crate::types::TaskEventType;
use wasm_bindgen::prelude::*;
use serde_json::json;

/// External host event handler
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["globalThis", "rooHost"], js_name = emitEvent)]
    async fn host_emit_event(event_type: &str, data: &str);
}

/// Task event emitter
#[derive(Debug, Clone)]
pub struct TaskEventEmitter {
    enabled: bool,
}

impl TaskEventEmitter {
    /// Create a new event emitter
    pub fn new() -> Self {
        Self { enabled: true }
    }
    
    /// Enable event emission
    pub fn enable(&mut self) {
        self.enabled = true;
    }
    
    /// Disable event emission
    pub fn disable(&mut self) {
        self.enabled = false;
    }
    
    /// Emit a generic event
    pub async fn emit(&self, event_type: TaskEventType, data: serde_json::Value) {
        if !self.enabled {
            return;
        }
        
        let event_str = event_type.as_str();
        let data_str = data.to_string();
        
        host_emit_event(event_str, &data_str).await;
    }
    
    /// Emit task started event
    pub async fn emit_started(&self, task_id: &str) {
        self.emit(
            TaskEventType::TaskStarted,
            json!({ "taskId": task_id })
        ).await;
    }
    
    /// Emit task completed event
    pub async fn emit_completed(&self, task_id: &str) {
        self.emit(
            TaskEventType::TaskCompleted,
            json!({ "taskId": task_id })
        ).await;
    }
    
    /// Emit task aborted event
    pub async fn emit_aborted(&self, task_id: &str) {
        self.emit(
            TaskEventType::TaskAborted,
            json!({ "taskId": task_id })
        ).await;
    }
    
    /// Emit task paused event
    pub async fn emit_paused(&self, task_id: &str) {
        self.emit(
            TaskEventType::TaskPaused,
            json!({ "taskId": task_id })
        ).await;
    }
    
    /// Emit task unpaused event
    pub async fn emit_unpaused(&self, task_id: &str) {
        self.emit(
            TaskEventType::TaskUnpaused,
            json!({ "taskId": task_id })
        ).await;
    }
    
    /// Emit task spawned event
    pub async fn emit_spawned(&self, parent_task_id: &str, child_task_id: &str) {
        self.emit(
            TaskEventType::TaskSpawned,
            json!({
                "parentTaskId": parent_task_id,
                "childTaskId": child_task_id
            })
        ).await;
    }
    
    /// Emit task active event
    pub async fn emit_active(&self, task_id: &str) {
        self.emit(
            TaskEventType::TaskActive,
            json!({ "taskId": task_id })
        ).await;
    }
    
    /// Emit task interactive event
    pub async fn emit_interactive(&self, task_id: &str) {
        self.emit(
            TaskEventType::TaskInteractive,
            json!({ "taskId": task_id })
        ).await;
    }
    
    /// Emit task resumable event
    pub async fn emit_resumable(&self, task_id: &str) {
        self.emit(
            TaskEventType::TaskResumable,
            json!({ "taskId": task_id })
        ).await;
    }
    
    /// Emit task idle event
    pub async fn emit_idle(&self, task_id: &str) {
        self.emit(
            TaskEventType::TaskIdle,
            json!({ "taskId": task_id })
        ).await;
    }
    
    /// Emit message created event
    pub async fn emit_message_created(&self, task_id: &str, message_id: &str) {
        self.emit(
            TaskEventType::MessageCreated,
            json!({
                "taskId": task_id,
                "messageId": message_id
            })
        ).await;
    }
    
    /// Emit message updated event
    pub async fn emit_message_updated(&self, task_id: &str, message_id: &str) {
        self.emit(
            TaskEventType::MessageUpdated,
            json!({
                "taskId": task_id,
                "messageId": message_id
            })
        ).await;
    }
    
    /// Emit token usage updated event
    pub async fn emit_token_usage(&self, task_id: &str, input_tokens: u64, output_tokens: u64) {
        self.emit(
            TaskEventType::TokenUsageUpdated,
            json!({
                "taskId": task_id,
                "inputTokens": input_tokens,
                "outputTokens": output_tokens
            })
        ).await;
    }
}

impl Default for TaskEventEmitter {
    fn default() -> Self {
        Self::new()
    }
}