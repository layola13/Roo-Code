//! Memory extraction from conversation messages
//!
//! Pattern matching and memory extraction logic

use crate::error::MemoryResult;
use crate::types::{MemoryEntry, MemoryPriority, MemoryType};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Message content for extraction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageContent {
    pub role: String,
    pub content: String,
}

/// Memory extractor with compiled patterns
pub struct MemoryExtractor {
    task_id: String,
    instruction_pattern: Regex,
    tech_decision_pattern: Regex,
    config_pattern: Regex,
    file_pattern: Regex,
    tech_stack_pattern: Regex,
    api_pattern: Regex,
}

impl MemoryExtractor {
    /// Create a new memory extractor
    pub fn new(task_id: String) -> MemoryResult<Self> {
        Ok(Self {
            task_id,
            instruction_pattern: Regex::new(
                r"(?i)(必须|务必|一定要|重要|关键|记住|注意|禁止|不要|必需|always|must|important|critical|remember|note|do not|never)",
            )?,
            tech_decision_pattern: Regex::new(
                r"(?i)(使用|采用|选择|决定用|用|迁移到|升级到|切换到|use|using|adopt|switch to|migrate to|choose)",
            )?,
            config_pattern: Regex::new(
                r"(?i)(端口|数据库|配置|设置|主题|语言|port|database|config|theme|language|setting)",
            )?,
            file_pattern: Regex::new(r"[a-zA-Z0-9_\-./]+\.(ts|js|json|md|rs|toml|yaml|yml)")?,
            tech_stack_pattern: Regex::new(
                r"(?i)(React|Vue|Angular|Node\.js|TypeScript|JavaScript|Rust|Python|Go|Java|Docker|Kubernetes|PostgreSQL|MongoDB|Redis)",
            )?,
            api_pattern: Regex::new(r"https?://[^\s]+|/api/[^\s]+")?,
        })
    }

    /// Extract memories from a single message
    pub fn extract_from_message(
        &self,
        message: &MessageContent,
        timestamp: i64,
    ) -> MemoryResult<Vec<MemoryEntry>> {
        let mut memories = Vec::new();
        let content = &message.content;

        // Extract user instructions (high priority)
        if message.role == "user" && self.instruction_pattern.is_match(content) {
            let memory = self.create_memory(
                MemoryType::UserInstruction,
                MemoryPriority::High,
                content.clone(),
                timestamp,
            );
            memories.push(memory);
        }

        // Extract technical decisions
        if self.tech_decision_pattern.is_match(content) && self.tech_stack_pattern.is_match(content)
        {
            let tech: Vec<String> = self
                .tech_stack_pattern
                .find_iter(content)
                .map(|m| m.as_str().to_string())
                .collect();

            let mut memory = self.create_memory(
                MemoryType::TechnicalDecision,
                MemoryPriority::Medium,
                content.clone(),
                timestamp,
            );
            memory.related_tech = Some(tech);
            memories.push(memory);
        }

        // Extract configuration
        if self.config_pattern.is_match(content) {
            let memory = self.create_memory(
                MemoryType::Configuration,
                MemoryPriority::Medium,
                content.clone(),
                timestamp,
            );
            memories.push(memory);
        }

        // Extract file references
        let files: Vec<String> = self
            .file_pattern
            .find_iter(content)
            .map(|m| m.as_str().to_string())
            .collect();

        if !files.is_empty() {
            for memory in &mut memories {
                memory.related_files = Some(files.clone());
            }
        }

        Ok(memories)
    }

    /// Create a memory entry with generated ID
    fn create_memory(
        &self,
        memory_type: MemoryType,
        priority: MemoryPriority,
        content: String,
        timestamp: i64,
    ) -> MemoryEntry {
        let id = self.generate_memory_id();
        MemoryEntry::new(id, memory_type, priority, content, timestamp)
    }

    /// Generate a simple random memory ID
    fn generate_memory_id(&self) -> String {
        use std::collections::hash_map::RandomState;
        use std::hash::{BuildHasher, Hash, Hasher};

        let random_state = RandomState::new();
        let mut hasher = random_state.build_hasher();
        std::time::SystemTime::now().hash(&mut hasher);
        format!("mem-{:x}", hasher.finish())
    }

    /// Calculate Jaccard similarity between two texts
    pub fn calculate_text_similarity(text1: &str, text2: &str) -> f64 {
        let words1: HashSet<&str> = text1.split_whitespace().collect();
        let words2: HashSet<&str> = text2.split_whitespace().collect();

        if words1.is_empty() && words2.is_empty() {
            return 1.0;
        }

        let intersection = words1.intersection(&words2).count();
        let union = words1.union(&words2).count();

        if union == 0 {
            0.0
        } else {
            intersection as f64 / union as f64
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extractor_creation() {
        let extractor = MemoryExtractor::new("task-1".to_string());
        assert!(extractor.is_ok());
    }

    #[test]
    fn test_extract_user_instruction() {
        let extractor = MemoryExtractor::new("task-1".to_string()).unwrap();
        let message = MessageContent {
            role: "user".to_string(),
            content: "记住：必须使用TypeScript编写代码".to_string(),
        };

        let memories = extractor.extract_from_message(&message, 1000).unwrap();
        assert!(!memories.is_empty());
        assert_eq!(memories[0].memory_type, MemoryType::UserInstruction);
    }

    #[test]
    fn test_extract_technical_decision() {
        let extractor = MemoryExtractor::new("task-1".to_string()).unwrap();
        let message = MessageContent {
            role: "assistant".to_string(),
            content: "我们决定使用React和TypeScript构建前端".to_string(),
        };

        let memories = extractor.extract_from_message(&message, 1000).unwrap();
        assert!(!memories.is_empty());
        let tech_memory = memories
            .iter()
            .find(|m| m.memory_type == MemoryType::TechnicalDecision);
        assert!(tech_memory.is_some());
    }

    #[test]
    fn test_extract_file_paths() {
        let extractor = MemoryExtractor::new("task-1".to_string()).unwrap();
        let message = MessageContent {
            role: "user".to_string(),
            content: "重要：请修改 src/app.ts 文件和 src/utils.rs 文件".to_string(),
        };

        let memories = extractor.extract_from_message(&message, 1000).unwrap();
        assert!(!memories.is_empty(), "Expected at least one memory to be created");
        
        let files = memories[0].related_files.as_ref().expect("Expected related_files to be populated");
        assert!(files.len() >= 2, "Expected at least 2 files, got: {:?}", files);
        assert!(files.contains(&"src/app.ts".to_string()), "Expected src/app.ts in files, got: {:?}", files);
        assert!(files.contains(&"src/utils.rs".to_string()), "Expected src/utils.rs in files, got: {:?}", files);
    }

    #[test]
    fn test_text_similarity() {
        let sim1 = MemoryExtractor::calculate_text_similarity("hello world", "hello rust world");
        assert!(sim1 > 0.5);

        let sim2 = MemoryExtractor::calculate_text_similarity("hello", "world");
        assert!(sim2 < 0.5);

        let sim3 = MemoryExtractor::calculate_text_similarity("same text", "same text");
        assert!((sim3 - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_extract_config() {
        let extractor = MemoryExtractor::new("task-1".to_string()).unwrap();
        let message = MessageContent {
            role: "user".to_string(),
            content: "数据库端口设置为5432".to_string(),
        };

        let memories = extractor.extract_from_message(&message, 1000).unwrap();
        let config_memory = memories
            .iter()
            .find(|m| m.memory_type == MemoryType::Configuration);
        assert!(config_memory.is_some());
    }
}