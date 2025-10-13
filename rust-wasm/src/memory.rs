//! Memory System Module
//! 
//! Manages conversation memory and context compression

use serde::{Deserialize, Serialize};

/// Memory type enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MemoryType {
    UserInstruction,
    TechnicalDecision,
    Configuration,
    ImportantError,
    ProjectContext,
    WorkflowPattern,
}

/// Memory priority
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemoryPriority {
    Critical,
    High,
    Medium,
    Low,
}

/// Memory entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub memory_type: MemoryType,
    pub priority: MemoryPriority,
    pub content: String,
    pub timestamp: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memory_priority() {
        assert_eq!(MemoryPriority::Critical, MemoryPriority::Critical);
        assert_ne!(MemoryPriority::High, MemoryPriority::Low);
    }
}