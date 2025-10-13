//! Roo Task Engine - Rust/WASM Implementation
//! 
//! This module implements the core task lifecycle management system.
//! It handles task creation, execution, state management, and event emission.

pub mod types;
pub mod state;
pub mod lifecycle;
pub mod events;
pub mod message;
pub mod error;

use wasm_bindgen::prelude::*;
use state::TaskState;
use lifecycle::TaskLifecycle;
use events::TaskEventEmitter;

/// Main Task structure representing a single task instance
#[wasm_bindgen]
pub struct Task {
    /// Unique task identifier
    task_id: String,
    /// Instance identifier for tracking multiple runs
    instance_id: String,
    /// Root task ID for subtask hierarchy
    root_task_id: Option<String>,
    /// Parent task ID for subtask hierarchy
    parent_task_id: Option<String>,
    /// Child task ID when spawned
    child_task_id: Option<String>,
    /// Task number in sequence
    task_number: u32,
    /// Current task state
    state: TaskState,
    /// Task lifecycle manager
    lifecycle: TaskLifecycle,
    /// Event emitter
    events: TaskEventEmitter,
    /// Task mode (code/architect/debug/etc)
    task_mode: String,
}

#[wasm_bindgen]
impl Task {
    /// Create a new task instance
    #[wasm_bindgen(constructor)]
    pub fn new(task_mode: String, parent_task_id: Option<String>) -> Self {
        let task_id = uuid::Uuid::new_v4().to_string();
        let instance_id = uuid::Uuid::new_v4().to_string();
        
        Self {
            task_id: task_id.clone(),
            instance_id,
            root_task_id: parent_task_id.clone(),
            parent_task_id,
            child_task_id: None,
            task_number: 0,
            state: TaskState::new(),
            lifecycle: TaskLifecycle::new(task_id.clone()),
            events: TaskEventEmitter::new(),
            task_mode,
        }
    }
    
    /// Get task ID
    #[wasm_bindgen(getter)]
    pub fn task_id(&self) -> String {
        self.task_id.clone()
    }
    
    /// Get instance ID
    #[wasm_bindgen(getter)]
    pub fn instance_id(&self) -> String {
        self.instance_id.clone()
    }
    
    /// Get current task mode
    #[wasm_bindgen(getter)]
    pub fn task_mode(&self) -> String {
        self.task_mode.clone()
    }
    
    /// Start task execution
    pub async fn start(&mut self, initial_message: String) -> Result<(), JsValue> {
        self.lifecycle.start(initial_message).await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.events.emit_started(&self.task_id).await;
        Ok(())
    }
    
    /// Pause task (for subtask spawning)
    pub async fn pause(&mut self) -> Result<(), JsValue> {
        self.state.pause();
        self.events.emit_paused(&self.task_id).await;
        Ok(())
    }
    
    /// Resume task (after subtask completion)
    pub async fn resume(&mut self) -> Result<(), JsValue> {
        self.state.resume();
        self.events.emit_unpaused(&self.task_id).await;
        Ok(())
    }
    
    /// Abort task execution
    pub async fn abort(&mut self, reason: String) -> Result<(), JsValue> {
        self.lifecycle.abort(reason).await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.events.emit_aborted(&self.task_id).await;
        Ok(())
    }
    
    /// Complete task
    pub async fn complete(&mut self) -> Result<(), JsValue> {
        self.lifecycle.complete().await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.events.emit_completed(&self.task_id).await;
        Ok(())
    }
    
    /// Check if task is paused
    #[wasm_bindgen(getter)]
    pub fn is_paused(&self) -> bool {
        self.state.is_paused()
    }
    
    /// Check if task is aborted
    #[wasm_bindgen(getter)]
    pub fn is_aborted(&self) -> bool {
        self.state.is_aborted()
    }
    
    /// Get task status as string
    #[wasm_bindgen(getter)]
    pub fn status(&self) -> String {
        self.state.status_string()
    }
}

/// Initialize the WASM module
#[wasm_bindgen(start)]
pub fn init() {
    // WASM module initialization
    // Console error panic hook can be added here if needed
}