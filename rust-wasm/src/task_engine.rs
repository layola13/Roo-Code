//! Task Engine Module
//! 
//! Manages task lifecycle, state transitions, and execution flow.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use std::collections::HashMap;

/// Task state enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[wasm_bindgen]
pub enum TaskState {
    Created,
    Running,
    Paused,
    Interactive,
    Resumable,
    Idle,
    Completed,
    Failed,
    Aborted,
}

/// Task structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub state: TaskState,
    pub mode: String,
    pub parent_id: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

/// Task Engine - manages all tasks
#[wasm_bindgen]
pub struct TaskEngine {
    tasks: HashMap<String, Task>,
    current_task_id: Option<String>,
}

#[wasm_bindgen]
impl TaskEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> TaskEngine {
        TaskEngine {
            tasks: HashMap::new(),
            current_task_id: None,
        }
    }
    
    /// Create a new task
    pub fn create_task(&mut self, mode: String, parent_id: Option<String>) -> String {
        let id = format!("task_{}", self.tasks.len());
        let now = js_sys::Date::now() as u64;
        
        let task = Task {
            id: id.clone(),
            state: TaskState::Created,
            mode,
            parent_id,
            created_at: now,
            updated_at: now,
        };
        
        self.tasks.insert(id.clone(), task);
        self.current_task_id = Some(id.clone());
        id
    }
    
    /// Get current task ID
    pub fn get_current_task_id(&self) -> Option<String> {
        self.current_task_id.clone()
    }
    
    /// Get task count
    pub fn task_count(&self) -> usize {
        self.tasks.len()
    }
}

impl Default for TaskEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_engine_creation() {
        let engine = TaskEngine::new();
        assert_eq!(engine.task_count(), 0);
        assert!(engine.get_current_task_id().is_none());
    }
    
    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_create_task() {
        let mut engine = TaskEngine::new();
        let task_id = engine.create_task("code".to_string(), None);
        
        assert_eq!(engine.task_count(), 1);
        assert_eq!(engine.get_current_task_id(), Some(task_id));
    }
    
    #[test]
    fn test_task_state_equality() {
        assert_eq!(TaskState::Created, TaskState::Created);
        assert_ne!(TaskState::Created, TaskState::Running);
    }
}