//! Task State Management
//! 
//! Implements the task state machine and state transitions

use crate::types::TaskStatus;
use serde::{Deserialize, Serialize};

/// Task state structure managing current execution state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskState {
    /// Current status
    status: TaskStatus,
    /// Is task paused (waiting for subtask)
    is_paused: bool,
    /// Is task aborted
    is_aborted: bool,
    /// Is task abandoned
    is_abandoned: bool,
    /// Abort reason if applicable
    abort_reason: Option<String>,
    /// Is initialized
    is_initialized: bool,
    /// Consecutive mistake count
    consecutive_mistake_count: u32,
    /// Consecutive mistake limit
    consecutive_mistake_limit: u32,
}

impl TaskState {
    /// Create a new task state
    pub fn new() -> Self {
        Self {
            status: TaskStatus::Idle,
            is_paused: false,
            is_aborted: false,
            is_abandoned: false,
            abort_reason: None,
            is_initialized: false,
            consecutive_mistake_count: 0,
            consecutive_mistake_limit: 3,
        }
    }
    
    /// Initialize the task
    pub fn initialize(&mut self) {
        self.is_initialized = true;
        self.status = TaskStatus::Running;
    }
    
    /// Pause the task (for subtask spawning)
    pub fn pause(&mut self) {
        self.is_paused = true;
        self.status = TaskStatus::Paused;
    }
    
    /// Resume the task (after subtask completion)
    pub fn resume(&mut self) {
        self.is_paused = false;
        self.status = TaskStatus::Running;
    }
    
    /// Abort the task
    pub fn abort(&mut self, reason: String) {
        self.is_aborted = true;
        self.abort_reason = Some(reason);
        self.status = TaskStatus::Aborted;
    }
    
    /// Complete the task
    pub fn complete(&mut self) {
        self.status = TaskStatus::Completed;
    }
    
    /// Set task to interactive state (waiting for user)
    pub fn set_interactive(&mut self) {
        self.status = TaskStatus::Interactive;
    }
    
    /// Set task to resumable state
    pub fn set_resumable(&mut self) {
        self.status = TaskStatus::Resumable;
    }
    
    /// Set task to idle state
    pub fn set_idle(&mut self) {
        self.status = TaskStatus::Idle;
    }
    
    /// Set task to running state
    pub fn set_running(&mut self) {
        self.status = TaskStatus::Running;
    }
    
    /// Check if task is paused
    pub fn is_paused(&self) -> bool {
        self.is_paused
    }
    
    /// Check if task is aborted
    pub fn is_aborted(&self) -> bool {
        self.is_aborted
    }
    
    /// Check if task is abandoned
    pub fn is_abandoned(&self) -> bool {
        self.is_abandoned
    }
    
    /// Check if task is initialized
    pub fn is_initialized(&self) -> bool {
        self.is_initialized
    }
    
    /// Check if task is complete
    pub fn is_completed(&self) -> bool {
        self.status == TaskStatus::Completed
    }
    
    /// Check if task is running
    pub fn is_running(&self) -> bool {
        self.status == TaskStatus::Running
    }
    
    /// Get current status
    pub fn status(&self) -> TaskStatus {
        self.status
    }
    
    /// Get status as string
    pub fn status_string(&self) -> String {
        self.status.as_str().to_string()
    }
    
    /// Get abort reason
    pub fn abort_reason(&self) -> Option<&str> {
        self.abort_reason.as_deref()
    }
    
    /// Increment consecutive mistake count
    pub fn increment_mistake_count(&mut self) {
        self.consecutive_mistake_count += 1;
    }
    
    /// Reset consecutive mistake count
    pub fn reset_mistake_count(&mut self) {
        self.consecutive_mistake_count = 0;
    }
    
    /// Check if mistake limit reached
    pub fn is_mistake_limit_reached(&self) -> bool {
        self.consecutive_mistake_count >= self.consecutive_mistake_limit
    }
    
    /// Get consecutive mistake count
    pub fn mistake_count(&self) -> u32 {
        self.consecutive_mistake_count
    }
    
    /// Can transition to target status
    pub fn can_transition_to(&self, target: TaskStatus) -> bool {
        use TaskStatus::*;
        
        match (self.status, target) {
            // From Idle
            (Idle, Running) => true,
            (Idle, Interactive) => true,
            
            // From Running
            (Running, Interactive) => true,
            (Running, Resumable) => true,
            (Running, Paused) => true,
            (Running, Aborted) => true,
            (Running, Completed) => true,
            (Running, Idle) => true,
            
            // From Interactive
            (Interactive, Running) => true,
            (Interactive, Aborted) => true,
            (Interactive, Completed) => true,
            
            // From Resumable
            (Resumable, Running) => true,
            (Resumable, Aborted) => true,
            (Resumable, Completed) => true,
            
            // From Paused
            (Paused, Running) => true,
            (Paused, Aborted) => true,
            
            // Terminal states
            (Completed, _) => false,
            (Aborted, _) => false,
            
            // Other transitions not allowed
            _ => false,
        }
    }
    
    /// Attempt to transition to new status
    pub fn transition_to(&mut self, target: TaskStatus) -> Result<(), String> {
        if !self.can_transition_to(target) {
            return Err(format!(
                "Invalid state transition from {:?} to {:?}",
                self.status, target
            ));
        }
        
        self.status = target;
        
        // Update related flags
        match target {
            TaskStatus::Paused => self.is_paused = true,
            TaskStatus::Running => self.is_paused = false,
            TaskStatus::Aborted => self.is_aborted = true,
            _ => {}
        }
        
        Ok(())
    }
}

impl Default for TaskState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_new_task_state() {
        let state = TaskState::new();
        assert_eq!(state.status(), TaskStatus::Idle);
        assert!(!state.is_initialized());
        assert!(!state.is_paused());
        assert!(!state.is_aborted());
    }
    
    #[test]
    fn test_initialize() {
        let mut state = TaskState::new();
        state.initialize();
        assert!(state.is_initialized());
        assert_eq!(state.status(), TaskStatus::Running);
    }
    
    #[test]
    fn test_pause_resume() {
        let mut state = TaskState::new();
        state.initialize();
        
        state.pause();
        assert!(state.is_paused());
        assert_eq!(state.status(), TaskStatus::Paused);
        
        state.resume();
        assert!(!state.is_paused());
        assert_eq!(state.status(), TaskStatus::Running);
    }
    
    #[test]
    fn test_abort() {
        let mut state = TaskState::new();
        state.initialize();
        
        state.abort("Test abort".to_string());
        assert!(state.is_aborted());
        assert_eq!(state.status(), TaskStatus::Aborted);
        assert_eq!(state.abort_reason(), Some("Test abort"));
    }
    
    #[test]
    fn test_complete() {
        let mut state = TaskState::new();
        state.initialize();
        
        state.complete();
        assert_eq!(state.status(), TaskStatus::Completed);
        assert!(state.is_completed());
    }
    
    #[test]
    fn test_mistake_counting() {
        let mut state = TaskState::new();
        
        assert_eq!(state.mistake_count(), 0);
        assert!(!state.is_mistake_limit_reached());
        
        state.increment_mistake_count();
        state.increment_mistake_count();
        state.increment_mistake_count();
        
        assert_eq!(state.mistake_count(), 3);
        assert!(state.is_mistake_limit_reached());
        
        state.reset_mistake_count();
        assert_eq!(state.mistake_count(), 0);
        assert!(!state.is_mistake_limit_reached());
    }
    
    #[test]
    fn test_state_transitions() {
        let mut state = TaskState::new();
        
        // Idle -> Running
        assert!(state.can_transition_to(TaskStatus::Running));
        assert!(state.transition_to(TaskStatus::Running).is_ok());
        
        // Running -> Paused
        assert!(state.can_transition_to(TaskStatus::Paused));
        assert!(state.transition_to(TaskStatus::Paused).is_ok());
        
        // Paused -> Running
        assert!(state.can_transition_to(TaskStatus::Running));
        assert!(state.transition_to(TaskStatus::Running).is_ok());
        
        // Running -> Completed
        assert!(state.can_transition_to(TaskStatus::Completed));
        assert!(state.transition_to(TaskStatus::Completed).is_ok());
        
        // Completed -> Running (should fail)
        assert!(!state.can_transition_to(TaskStatus::Running));
        assert!(state.transition_to(TaskStatus::Running).is_err());
    }
}