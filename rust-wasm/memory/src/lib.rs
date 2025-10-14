//! Memory System - WASM Bindings
//!
//! WebAssembly bindings for conversation memory management

mod error;
mod extraction;
mod manager;
mod types;

use extraction::MessageContent;
use manager::ConversationMemory;
use types::{MemoryConfig, MemoryPriority, MemoryType};
use wasm_bindgen::prelude::*;

#[cfg(feature = "console_error_panic_hook")]
pub use console_error_panic_hook::set_once as set_panic_hook;

/// Initialize the memory system (internal use only)
/// Call this from the main WASM module's init function
pub fn init_memory() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Memory System Manager (WASM Interface)
#[wasm_bindgen]
pub struct MemoryManager {
    inner: ConversationMemory,
}

#[wasm_bindgen]
impl MemoryManager {
    /// Create a new memory manager
    #[wasm_bindgen(constructor)]
    pub fn new(task_id: String, config: JsValue) -> Result<MemoryManager, JsValue> {
        let memory_config: Option<MemoryConfig> = if config.is_null() || config.is_undefined() {
            None
        } else {
            Some(serde_wasm_bindgen::from_value(config)?)
        };

        let inner = ConversationMemory::new(task_id, memory_config)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(MemoryManager { inner })
    }

    /// Extract memories from conversation messages
    #[wasm_bindgen(js_name = extractMemories)]
    pub fn extract_memories(
        &mut self,
        messages: JsValue,
        timestamp: f64,
    ) -> Result<JsValue, JsValue> {
        let messages: Vec<MessageContent> = serde_wasm_bindgen::from_value(messages)?;
        let timestamp = timestamp as i64;

        let result = self
            .inner
            .extract_memories(messages, timestamp)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(serde_wasm_bindgen::to_value(&result)?)
    }

    /// Get all memories
    #[wasm_bindgen(js_name = getAllMemories)]
    pub fn get_all_memories(&self) -> Result<JsValue, JsValue> {
        let memories = self.inner.get_all_memories();
        Ok(serde_wasm_bindgen::to_value(&memories)?)
    }

    /// Get critical memories
    #[wasm_bindgen(js_name = getCriticalMemories)]
    pub fn get_critical_memories(&self) -> Result<JsValue, JsValue> {
        let memories = self.inner.get_critical_memories();
        Ok(serde_wasm_bindgen::to_value(&memories)?)
    }

    /// Get memories by priority
    #[wasm_bindgen(js_name = getMemoriesByPriority)]
    pub fn get_memories_by_priority(&self, priority: String) -> Result<JsValue, JsValue> {
        let priority = MemoryPriority::from_string(&priority)
            .ok_or_else(|| JsValue::from_str("Invalid priority"))?;

        let memories = self.inner.get_memories_by_priority(priority);
        Ok(serde_wasm_bindgen::to_value(&memories)?)
    }

    /// Get memories by type
    #[wasm_bindgen(js_name = getMemoriesByType)]
    pub fn get_memories_by_type(&self, memory_type: String) -> Result<JsValue, JsValue> {
        let memory_type = MemoryType::from_string(&memory_type)
            .ok_or_else(|| JsValue::from_str("Invalid memory type"))?;

        let memories = self.inner.get_memories_by_type(memory_type);
        Ok(serde_wasm_bindgen::to_value(&memories)?)
    }

    /// Record memory access
    #[wasm_bindgen(js_name = recordMemoryAccess)]
    pub fn record_memory_access(&mut self, memory_id: String, timestamp: f64) {
        self.inner
            .record_memory_access(&memory_id, timestamp as i64);
    }

    /// Generate memory summary for prompt
    #[wasm_bindgen(js_name = generateMemorySummary)]
    pub fn generate_memory_summary(&mut self, timestamp: f64) -> String {
        self.inner.generate_memory_summary(timestamp as i64)
    }

    /// Apply memory aging mechanism
    #[wasm_bindgen(js_name = applyMemoryAging)]
    pub fn apply_memory_aging(&mut self, current_time: f64) {
        // Aging is now applied automatically in generate_memory_summary
        // This method is kept for manual trigger if needed
        let _ = self.inner.generate_memory_summary(current_time as i64);
    }

    /// Prune low priority memories
    #[wasm_bindgen(js_name = pruneLowPriorityMemories)]
    pub fn prune_low_priority_memories(&mut self, max_count: usize, current_time: f64) {
        self.inner
            .prune_low_priority_memories(max_count, current_time as i64);
    }

    /// Get memory statistics
    #[wasm_bindgen(js_name = getMemoryStats)]
    pub fn get_memory_stats(&self, current_time: f64) -> Result<JsValue, JsValue> {
        let stats = self.inner.get_memory_stats(current_time as i64);
        Ok(serde_wasm_bindgen::to_value(&stats)?)
    }

    /// Serialize to JSON string
    #[wasm_bindgen(js_name = serialize)]
    pub fn serialize(&self) -> Result<String, JsValue> {
        self.inner
            .serialize()
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Deserialize from JSON string
    #[wasm_bindgen(js_name = deserialize)]
    pub fn deserialize(data: String) -> Result<MemoryManager, JsValue> {
        let inner = ConversationMemory::deserialize(&data)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(MemoryManager { inner })
    }
}

/// Utility: Calculate text similarity (Jaccard)
#[wasm_bindgen(js_name = calculateTextSimilarity)]
pub fn calculate_text_similarity(text1: String, text2: String) -> f64 {
    extraction::MemoryExtractor::calculate_text_similarity(&text1, &text2)
}

/// Utility: Parse memory priority from string
#[wasm_bindgen(js_name = parseMemoryPriority)]
pub fn parse_memory_priority(priority_str: String) -> Result<JsValue, JsValue> {
    let priority = MemoryPriority::from_string(&priority_str)
        .ok_or_else(|| JsValue::from_str("Invalid priority"))?;
    Ok(serde_wasm_bindgen::to_value(&priority)?)
}

/// Utility: Parse memory type from string
#[wasm_bindgen(js_name = parseMemoryType)]
pub fn parse_memory_type(type_str: String) -> Result<JsValue, JsValue> {
    let memory_type = MemoryType::from_string(&type_str)
        .ok_or_else(|| JsValue::from_str("Invalid memory type"))?;
    Ok(serde_wasm_bindgen::to_value(&memory_type)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_arch = "wasm32")]
    #[test]
    fn test_memory_manager_creation() {
        let manager = MemoryManager::new("task-1".to_string(), JsValue::NULL);
        assert!(manager.is_ok());
    }

    #[test]
    fn test_text_similarity() {
        let sim = calculate_text_similarity(
            "hello world".to_string(),
            "hello rust world".to_string(),
        );
        assert!(sim > 0.5);
    }

    #[cfg(target_arch = "wasm32")]
    #[test]
    fn test_parse_priority() {
        let result = parse_memory_priority("high".to_string());
        assert!(result.is_ok());
    }

    #[cfg(target_arch = "wasm32")]
    #[test]
    fn test_parse_type() {
        let result = parse_memory_type("userInstruction".to_string());
        assert!(result.is_ok());
    }
}