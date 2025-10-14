
//! Memory manager implementation
//!
//! Core memory management with CRUD operations, aging, and statistics

use crate::error::{MemoryError, MemoryResult};
use crate::extraction::{MemoryExtractor, MessageContent};
use crate::types::{
    AgingConfig, MemoryConfig, MemoryEntry, MemoryExtractionResult, MemoryPriority, MemoryStats,
    MemoryType, SimilarityConfig,
};
use std::collections::HashMap;

/// Conversation memory manager
pub struct ConversationMemory {
    /// Task ID
    task_id: String,
    /// Memory storage (ID -> Entry)
    memories: HashMap<String, MemoryEntry>,
    /// Last extracted message index
    last_extracted_index: usize,
    /// Similarity configuration
    similarity_config: SimilarityConfig,
    /// Aging configuration
    aging_config: AgingConfig,
    /// Memory extractor
    extractor: MemoryExtractor,
}

impl ConversationMemory {
    /// Create a new conversation memory manager
    pub fn new(task_id: String, config: Option<MemoryConfig>) -> MemoryResult<Self> {
        let config = config.unwrap_or_default();
        let extractor = MemoryExtractor::new(task_id.clone())?;

        Ok(Self {
            task_id,
            memories: HashMap::new(),
            last_extracted_index: 0,
            similarity_config: config.similarity,
            aging_config: config.aging,
            extractor,
        })
    }

    /// Extract memories from messages
    pub fn extract_memories(
        &mut self,
        messages: Vec<MessageContent>,
        timestamp: i64,
    ) -> MemoryResult<MemoryExtractionResult> {
        let mut new_memories = Vec::new();
        let mut scanned_count = 0;

        // Only process new messages
        for message in messages.iter().skip(self.last_extracted_index) {
            scanned_count += 1;
            let extracted = self.extractor.extract_from_message(message, timestamp)?;

            // Deduplicate and merge
            for memory in extracted {
                if let Some(duplicate_id) = self.find_duplicate(&memory) {
                    self.merge_memories(&duplicate_id, &memory, timestamp);
                } else {
                    self.memories.insert(memory.id.clone(), memory.clone());
                    new_memories.push(memory);
                }
            }
        }

        self.last_extracted_index = messages.len();

        Ok(MemoryExtractionResult {
            memories: new_memories.clone(),
            scanned_messages: scanned_count,
            new_memories_count: new_memories.len(),
        })
    }

    /// Find duplicate memory by similarity
    fn find_duplicate(&self, new_memory: &MemoryEntry) -> Option<String> {
        for existing in self.memories.values() {
            // Type must match
            if existing.memory_type != new_memory.memory_type {
                continue;
            }

            // Calculate similarity
            let similarity =
                MemoryExtractor::calculate_text_similarity(&existing.content, &new_memory.content);

            if similarity >= self.similarity_config.threshold {
                return Some(existing.id.clone());
            }
        }
        None
    }

    /// Merge two memories
    fn merge_memories(&mut self, existing_id: &str, incoming: &MemoryEntry, timestamp: i64) {
        if let Some(existing) = self.memories.get_mut(existing_id) {
            existing.record_access(timestamp);

            // Upgrade priority if needed
            if incoming.priority > existing.priority {
                existing.priority = incoming.priority;
            }

            // Merge tags
            if let Some(incoming_tags) = &incoming.tags {
                let mut all_tags = existing.tags.clone().unwrap_or_default();
                all_tags.extend(incoming_tags.clone());
                existing.tags = Some(all_tags.into_iter().collect());
            }

            // Merge files
            if let Some(incoming_files) = &incoming.related_files {
                let mut all_files = existing.related_files.clone().unwrap_or_default();
                all_files.extend(incoming_files.clone());
                existing.related_files = Some(all_files.into_iter().collect());
            }

            // Merge tech
            if let Some(incoming_tech) = &incoming.related_tech {
                let mut all_tech = existing.related_tech.clone().unwrap_or_default();
                all_tech.extend(incoming_tech.clone());
                existing.related_tech = Some(all_tech.into_iter().collect());
            }

            // Update content if longer
            if incoming.content.len() > existing.content.len() {
                existing.content = incoming.content.clone();
            }
        }
    }

    /// Get all memories
    pub fn get_all_memories(&self) -> Vec<MemoryEntry> {
        self.memories.values().cloned().collect()
    }

    /// Get critical memories
    pub fn get_critical_memories(&self) -> Vec<MemoryEntry> {
        self.memories
            .values()
            .filter(|m| m.priority == MemoryPriority::Critical)
            .cloned()
            .collect()
    }

    /// Get memories by priority
    pub fn get_memories_by_priority(&self, priority: MemoryPriority) -> Vec<MemoryEntry> {
        self.memories
            .values()
            .filter(|m| m.priority == priority)
            .cloned()
            .collect()
    }

    /// Get memories by type
    pub fn get_memories_by_type(&self, memory_type: MemoryType) -> Vec<MemoryEntry> {
        self.memories
            .values()
            .filter(|m| m.memory_type == memory_type)
            .cloned()
            .collect()
    }

    /// Record memory access
    pub fn record_memory_access(&mut self, memory_id: &str, timestamp: i64) {
        if let Some(memory) = self.memories.get_mut(memory_id) {
            memory.record_access(timestamp);
        }
    }

    /// Generate memory summary
    pub fn generate_memory_summary(&mut self, timestamp: i64) -> String {
        // Apply aging first
        self.apply_memory_aging(timestamp);

        let critical = self.get_critical_memories();
        let high = self.get_memories_by_priority(MemoryPriority::High);

        if critical.is_empty() && high.is_empty() {
            return String::new();
        }

        let mut lines = vec!["## 重要上下文记忆".to_string(), String::new()];

        // Critical memories
        if !critical.is_empty() {
            lines.push("### 关键指令：".to_string());
            let grouped = self.group_by_type(&critical);
            for (type_label, memories) in grouped {
                if !memories.is_empty() {
                    lines.push(format!("**{}**:", type_label));
                    for memory in memories {
                        lines.push(format!("  - {}", memory.content));
                    }
                }
            }
            lines.push(String::new());
        }

        // High priority memories (limit to 15)
        if !high.is_empty() {
            lines.push("### 重要决策：".to_string());
            for memory in high.iter().take(15) {
                lines.push(format!("  - {}", memory.content));
            }
            lines.push(String::new());
        }

        // Tech stack summary
        if let Some(tech_summary) = self.get_tech_stack_summary() {
            lines.push("### 技术栈：".to_string());
            lines.push(tech_summary);
            lines.push(String::new());
        }

        lines.join("\n")
    }

    /// Group memories by type
    fn group_by_type(&self, memories: &[MemoryEntry]) -> Vec<(String, Vec<MemoryEntry>)> {
        let mut grouped: HashMap<String, Vec<MemoryEntry>> = HashMap::new();

        for memory in memories {
            let label = match memory.memory_type {
                MemoryType::UserInstruction => "用户指令",
                MemoryType::TechnicalDecision => "技术决策",
                MemoryType::Configuration => "配置",
                MemoryType::ImportantError => "重要错误",
                MemoryType::ProjectContext => "项目上下文",
                MemoryType::WorkflowPattern => "工作流程",
            };
            grouped
                .entry(label.to_string())
                .or_default()
                .push(memory.clone());
        }

        grouped.into_iter().collect()
    }

    /// Get tech stack summary
    fn get_tech_stack_summary(&self) -> Option<String> {
        let mut all_tech = std::collections::HashSet::new();

        for memory in self.memories.values() {
            if let Some(tech) = &memory.related_tech {
                all_tech.extend(tech.iter().cloned());
            }
        }

        if all_tech.is_empty() {
            None
        } else {
            Some(all_tech.into_iter().collect::<Vec<_>>().join(", "))
        }
    }

    /// Apply memory aging mechanism
    fn apply_memory_aging(&mut self, current_time: i64) {
        if !self.aging_config.enable_auto_aging {
            return;
        }

        let memories: Vec<String> = self.memories.keys().cloned().collect();

        for memory_id in memories {
            if let Some(memory) = self.memories.get_mut(&memory_id) {
                // Skip critical memories
                if memory.priority == MemoryPriority::Critical {
                    continue;
                }

                let age = memory.age(current_time);
                let half_life = match memory.priority {
                    MemoryPriority::High => self.aging_config.high_priority_half_life,
                    MemoryPriority::Medium => self.aging_config.medium_priority_half_life,
                    MemoryPriority::Low => self.aging_config.low_priority_half_life,
                    MemoryPriority::Critical => continue,
                };

                // Downgrade if aged beyond half-life
                if age > half_life {
                    memory.priority = match memory.priority {
                        MemoryPriority::High => MemoryPriority::Medium,
                        MemoryPriority::Medium => MemoryPriority::Low,
                        MemoryPriority::Low => MemoryPriority::Low,
                        MemoryPriority::Critical => MemoryPriority::Critical,
                    };
                }
            }
        }
    }

    /// Prune low priority memories
    pub fn prune_low_priority_memories(&mut self, max_count: usize, current_time: i64) {
        let mut all_memories: Vec<MemoryEntry> = self.memories.values().cloned().collect();

        if all_memories.len() <= max_count {
            return;
        }

        // Sort by importance score (descending)
        all_memories.sort_by(|a, b| {
            let score_a = a.importance_score(current_time);
            let score_b = b.importance_score(current_time);
            score_b.partial_cmp(&score_a).unwrap()
        });

        // Keep top max_count memories
        let to_keep: std::collections::HashSet<String> = all_memories
            .iter()
            .take(max_count)
            .map(|m| m.id.clone())
            .collect();

        self.memories.retain(|id, _| to_keep.contains(id));
    }

    /// Get memory statistics
    pub fn get_memory_stats(&self, current_time: i64) -> MemoryStats {
        let all_memories = self.get_all_memories();
        let mut stats = MemoryStats::new();

        stats.total_memories = all_memories.len();

        for memory in &all_memories {
            // Count by type
            let type_key = memory.memory_type.to_string();
            *stats.by_type.entry(type_key).or_insert(0) += 1;

            // Count by priority
            let priority_key = memory.priority.to_string();
            *stats.by_priority.entry(priority_key).or_insert(0) += 1;

            // Count pending (created within 5 minutes and not accessed)
            if current_time - memory.created_at < 5 * 60 * 1000 && memory.access_count == 0 {
                stats.pending_memories += 1;
            }
        }

        stats.persisted_memories = all_memories.len();
        stats
    }

    /// Serialize to JSON
    pub fn serialize(&self) -> MemoryResult<String> {
        let data = serde_json::json!({
            "taskId": self.task_id,
            "memories": self.get_all_memories(),
            "lastExtractedIndex": self.last_extracted_index,
        });
        serde_json::to_string(&data).map_err(|e| e.into())
    }

    /// Deserialize from JSON
    pub fn deserialize(data: &str) -> MemoryResult<Self> {
        let parsed: serde_json::Value = serde_json::from_str(data)?;

        let task_id = parsed["taskId"]
            .as_str()
            .ok_or_else(|| MemoryError::InvalidFormat("Missing taskId".to_string()))?
            .to_string();

        let memories_array = parsed["memories"]
            .as_array()
            .ok_or_else(|| MemoryError::InvalidFormat("Invalid memories array".to_string()))?;

        let mut memory = Self::new(task_id, None)?;

        for mem_val in memories_array {
            let mem: MemoryEntry = serde_json::from_value(mem_val.clone())?;
            memory.memories.insert(mem.id.clone(), mem);
        }

        memory.last_extracted_index = parsed["lastExtractedIndex"].as_u64().unwrap_or(0) as usize;

        Ok(memory)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_memory_manager() {
        let manager = ConversationMemory::new("task-1".to_string(), None);
        assert!(manager.is_ok());
    }

    #[test]
    fn test_get_memories_by_priority() {
        let mut manager = ConversationMemory::new("task-1".to_string(), None).unwrap();
        let memory = MemoryEntry::new(
            "mem-1".to_string(),
            MemoryType::UserInstruction,
            MemoryPriority::Critical,
            "Test content".to_string(),
            1000,
        );
        manager.memories.insert(memory.id.clone(), memory);

        let critical = manager.get_critical_memories();
        assert_eq!(critical.len(), 1);
    }

    #[test]
    fn test_memory_stats() {
        let mut manager = ConversationMemory::new("task-1".to_string(), None).unwrap();

        let mem1 = MemoryEntry::new(
            "mem-1".to_string(),
            MemoryType::UserInstruction,
            MemoryPriority::High,
            "Test 1".to_string(),
            1000,
        );
        let mem2 = MemoryEntry::new(
            "mem-2".to_string(),
            MemoryType::Configuration,
            MemoryPriority::Medium,
            "Test 2".to_string(),
            2000,
        );

        manager.memories.insert(mem1.id.clone(), mem1);
        manager.memories.insert(mem2.id.clone(), mem2);

        let stats = manager.get_memory_stats(3000);
        assert_eq!(stats.total_memories, 2);
        assert!(stats.by_type.len() > 0);
        assert!(stats.by_priority.len() > 0);
    }

    #[test]
    fn test_serialize_deserialize() {
        let manager = ConversationMemory::new("task-1".to_string(), None).unwrap();
        let serialized = manager.serialize().unwrap();
        let deserialized = ConversationMemory::deserialize(&serialized).unwrap();
        assert_eq!(deserialized.task_id, "task-1");
    }
}