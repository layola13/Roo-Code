
//! Memory system type definitions
//!
//! This module defines all the core types for the memory system including:
//! - Memory entry types and priorities
//! - Memory extraction and search results
//! - Configuration structures

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// Memory type enumeration
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MemoryType {
    /// User's explicit instruction
    UserInstruction,
    /// Technical decision
    TechnicalDecision,
    /// Configuration requirement
    Configuration,
    /// Important error or issue
    ImportantError,
    /// Project context
    ProjectContext,
    /// Workflow pattern
    WorkflowPattern,
}

impl MemoryType {
    /// Convert to string representation
    pub fn to_string(&self) -> String {
        match self {
            MemoryType::UserInstruction => "user_instruction".to_string(),
            MemoryType::TechnicalDecision => "technical_decision".to_string(),
            MemoryType::Configuration => "configuration".to_string(),
            MemoryType::ImportantError => "important_error".to_string(),
            MemoryType::ProjectContext => "project_context".to_string(),
            MemoryType::WorkflowPattern => "workflow_pattern".to_string(),
        }
    }

    /// Parse from string
    pub fn from_string(s: &str) -> Option<MemoryType> {
        match s {
            "user_instruction" => Some(MemoryType::UserInstruction),
            "technical_decision" => Some(MemoryType::TechnicalDecision),
            "configuration" => Some(MemoryType::Configuration),
            "important_error" => Some(MemoryType::ImportantError),
            "project_context" => Some(MemoryType::ProjectContext),
            "workflow_pattern" => Some(MemoryType::WorkflowPattern),
            _ => None,
        }
    }
}

/// Memory priority levels
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum MemoryPriority {
    /// Low priority - can be deleted
    Low = 0,
    /// Medium priority - can be compressed if necessary
    Medium = 1,
    /// High priority - should be kept
    High = 2,
    /// Critical - must never be lost
    Critical = 3,
}

impl MemoryPriority {
    /// Convert to string representation
    pub fn to_string(&self) -> String {
        match self {
            MemoryPriority::Low => "low".to_string(),
            MemoryPriority::Medium => "medium".to_string(),
            MemoryPriority::High => "high".to_string(),
            MemoryPriority::Critical => "critical".to_string(),
        }
    }

    /// Parse from string
    pub fn from_string(s: &str) -> Option<MemoryPriority> {
        match s {
            "low" => Some(MemoryPriority::Low),
            "medium" => Some(MemoryPriority::Medium),
            "high" => Some(MemoryPriority::High),
            "critical" => Some(MemoryPriority::Critical),
            _ => None,
        }
    }

    /// Get priority weight for sorting
    pub fn weight(&self) -> u32 {
        match self {
            MemoryPriority::Low => 1,
            MemoryPriority::Medium => 10,
            MemoryPriority::High => 100,
            MemoryPriority::Critical => 1000,
        }
    }
}

/// Memory entry structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    /// Unique ID
    pub id: String,
    /// Memory type
    #[serde(rename = "type")]
    pub memory_type: MemoryType,
    /// Priority level
    pub priority: MemoryPriority,
    /// Memory content (original user instruction or summary)
    pub content: String,
    /// Creation timestamp (milliseconds)
    pub created_at: i64,
    /// Last access timestamp (milliseconds)
    pub last_accessed_at: i64,
    /// Access count
    pub access_count: u32,
    /// Associated message index
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_index: Option<usize>,
    /// Related file paths
    #[serde(skip_serializing_if = "Option::is_none")]
    pub related_files: Option<Vec<String>>,
    /// Related technologies
    #[serde(skip_serializing_if = "Option::is_none")]
    pub related_tech: Option<Vec<String>>,
    /// Tags
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

impl MemoryEntry {
    /// Create a new memory entry
    pub fn new(
        id: String,
        memory_type: MemoryType,
        priority: MemoryPriority,
        content: String,
        timestamp: i64,
    ) -> Self {
        Self {
            id,
            memory_type,
            priority,
            content,
            created_at: timestamp,
            last_accessed_at: timestamp,
            access_count: 0,
            message_index: None,
            related_files: None,
            related_tech: None,
            tags: None,
        }
    }

    /// Record an access to this memory
    pub fn record_access(&mut self, timestamp: i64) {
        self.last_accessed_at = timestamp;
        self.access_count += 1;
    }

    /// Calculate memory age in milliseconds
    pub fn age(&self, current_time: i64) -> i64 {
        current_time - self.last_accessed_at
    }

    /// Calculate importance score for memory selection
    pub fn importance_score(&self, current_time: i64) -> f64 {
        let priority_weight = self.priority.weight() as f64;
        let access_weight = (self.access_count as f64).min(10.0) * 5.0;
        let recency_weight = {
            let age_hours = (current_time - self.last_accessed_at) as f64 / (1000.0 * 3600.0);
            (1.0 / (1.0 + age_hours / 24.0)) * 50.0 // Decay over days
        };
        let length_penalty = if self.content.len() > 500 {
            -10.0
        } else {
            0.0
        };

        priority_weight + access_weight + recency_weight + length_penalty
    }
}

/// Memory extraction result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryExtractionResult {
    /// Extracted memory entries
    pub memories: Vec<MemoryEntry>,
    /// Number of messages scanned
    pub scanned_messages: usize,
    /// Number of new memories found
    pub new_memories_count: usize,
}

/// Memory statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStats {
    /// Total number of memories
    pub total_memories: usize,
    /// Count by type
    pub by_type: std::collections::HashMap<String, usize>,
    /// Count by priority
    pub by_priority: std::collections::HashMap<String, usize>,
    /// Pending memories (recently created but not compressed)
    pub pending_memories: usize,
    /// Persisted memories count
    pub persisted_memories: usize,
}

impl MemoryStats {
    /// Create empty statistics
    pub fn new() -> Self {
        let mut by_type = std::collections::HashMap::new();
        by_type.insert("user_instruction".to_string(), 0);
        by_type.insert("technical_decision".to_string(), 0);
        by_type.insert("configuration".to_string(), 0);
        by_type.insert("important_error".to_string(), 0);
        by_type.insert("project_context".to_string(), 0);
        by_type.insert("workflow_pattern".to_string(), 0);

        let mut by_priority = std::collections::HashMap::new();
        by_priority.insert("low".to_string(), 0);
        by_priority.insert("medium".to_string(), 0);
        by_priority.insert("high".to_string(), 0);
        by_priority.insert("critical".to_string(), 0);

        Self {
            total_memories: 0,
            by_type,
            by_priority,
            pending_memories: 0,
            persisted_memories: 0,
        }
    }
}

impl Default for MemoryStats {
    fn default() -> Self {
        Self::new()
    }
}

/// Similarity configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimilarityConfig {
    /// Similarity threshold (0.0-1.0)
    pub threshold: f64,
    /// Enable semantic similarity detection
    pub enable_semantic_similarity: bool,
}

impl Default for SimilarityConfig {
    fn default() -> Self {
        Self {
            threshold: 0.75,
            enable_semantic_similarity: true,
        }
    }
}

/// Memory aging configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgingConfig {
    /// High priority memory half-life (milliseconds)
    pub high_priority_half_life: i64,
    /// Medium priority memory half-life (milliseconds)
    pub medium_priority_half_life: i64,
    /// Low priority memory half-life (milliseconds)
    pub low_priority_half_life: i64,
    /// Enable automatic aging
    pub enable_auto_aging: bool,
}

impl Default for AgingConfig {
    fn default() -> Self {
        Self {
            high_priority_half_life: 7 * 24 * 60 * 60 * 1000, // 7 days
            medium_priority_half_life: 3 * 24 * 60 * 60 * 1000, // 3 days
            low_priority_half_life: 24 * 60 * 60 * 1000,       // 1 day
            enable_auto_aging: true,
        }
    }
}

/// Memory manager configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConfig {
    /// Similarity configuration
    #[serde(default)]
    pub similarity: SimilarityConfig,
    /// Aging configuration
    #[serde(default)]
    pub aging: AgingConfig,
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            similarity: SimilarityConfig::default(),
            aging: AgingConfig::default(),
        }
    }
}

/// Code chunk association (for memory enhancement)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeChunkAssociation {
    /// File path
    pub file_path: String,
    /// Code content
    pub code_chunk: String,
    /// Start line number
    pub start_line: usize,
    /// End line number
    pub end_line: usize,
    /// Relevance score
    pub relevance_score: f64,
}

/// Enhanced memory entry with code associations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedMemoryEntry {
    /// Base memory entry
    #[serde(flatten)]
    pub memory: MemoryEntry,
    /// Associated code chunks
    #[serde(skip_serializing_if = "Option::is_none")]
    pub associated_code: Option<Vec<CodeChunkAssociation>>,
}

/// Memory recommendation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryRecommendation {
    /// Recommended memory
    pub memory: MemoryEntry,
    /// Recommendation score
    pub score: f64,
    /// Recommendation reason
    pub reason: String,
    /// Related code blocks
    #[serde(skip_serializing_if = "Option::is_none")]
    pub related_code: Option<Vec<CodeChunkAssociation>>,
}

/// Knowledge graph node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeNode {
    /// Memory ID
    pub id: String,
    /// Memory type
    #[serde(rename = "type")]
    pub node_type: MemoryType,
    /// Priority
    pub priority: MemoryPriority,
    /// Content preview (truncated)
    pub content: String,
    /// Related files
    pub related_files: Vec<String>,
    /// Related technologies
    pub related_tech: Vec<String>,
    /// Access count
    pub access_count: u32,
}

/// Knowledge graph edge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeEdge {
    /// Source node ID
    pub source: String,
    /// Target node ID
    pub target: String,
    /// Relationship strength (0.0-1.0)
    pub strength: f64,
    /// Relationship types
    pub types: Vec<String>,
}

/// Knowledge graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeGraph {
    /// Graph nodes
    pub nodes: Vec<KnowledgeNode>,
    /// Graph edges
    pub edges: Vec<KnowledgeEdge>,
    /// Metadata
    pub metadata: KnowledgeGraphMetadata,
}

/// Knowledge graph metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeGraphMetadata {
    /// Total number of nodes
    pub total_nodes: usize,
    /// Total number of edges
    pub total_edges: usize,
    /// Creation timestamp
    pub created_at: i64,
}

/// Memory cluster
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryCluster {
    /// Cluster ID
    pub id: String,
    /// Nodes in this cluster
    pub nodes: Vec<KnowledgeNode>,
    /// Cluster size
    pub size: usize,
    /// Dominant technologies in this cluster
    pub dominant_tech: Vec<String>,
    /// Dominant memory type
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dominant_type: Option<MemoryType>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memory_type_conversion() {
        let mt = MemoryType::UserInstruction;
        assert_eq!(mt.to_string(), "user_instruction");
        assert_eq!(
            MemoryType::from_string("user_instruction"),
            Some(MemoryType::UserInstruction)
        );
    }

    #[test]
    fn test_memory_priority_ordering() {
        assert!(MemoryPriority::Critical > MemoryPriority::High);
        assert!(MemoryPriority::High > MemoryPriority::Medium);
        assert!(MemoryPriority::Medium > MemoryPriority::Low);
    }

    #[test]
    fn test_memory_priority_weight() {
        assert_eq!(MemoryPriority::Critical.weight(), 1000);
        assert_eq!(MemoryPriority::High.weight(), 100);
        assert_eq!(MemoryPriority::Medium.weight(), 10);
        assert_eq!(MemoryPriority::Low.weight(), 1);
    }
}