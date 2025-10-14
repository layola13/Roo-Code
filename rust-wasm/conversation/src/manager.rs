//! Conversation Manager
//! 
//! Manages conversation history, message indexing, and queries

use crate::{ApiMessage, ConversationStats, ConversationError, Result, MessageRole};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Conversation Manager - handles conversation history and message operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationManager {
    /// All messages in the conversation
    messages: Vec<ApiMessage>,
    
    /// Index mapping timestamps to message positions
    #[serde(skip)]
    timestamp_index: HashMap<i64, usize>,
}

impl ConversationManager {
    /// Create a new conversation manager
    pub fn new() -> Self {
        Self {
            messages: Vec::new(),
            timestamp_index: HashMap::new(),
        }
    }
    
    /// Create a manager from existing messages
    pub fn from_messages(messages: Vec<ApiMessage>) -> Self {
        let mut manager = Self::new();
        for msg in messages {
            manager.add_message(msg);
        }
        manager
    }
    
    /// Add a message to the conversation
    pub fn add_message(&mut self, message: ApiMessage) {
        if let Some(ts) = message.ts {
            self.timestamp_index.insert(ts, self.messages.len());
        }
        self.messages.push(message);
    }
    
    /// Add multiple messages
    pub fn add_messages(&mut self, messages: Vec<ApiMessage>) {
        for msg in messages {
            self.add_message(msg);
        }
    }
    
    /// Get all messages
    pub fn get_messages(&self) -> &[ApiMessage] {
        &self.messages
    }
    
    /// Get messages as a mutable slice
    pub fn get_messages_mut(&mut self) -> &mut Vec<ApiMessage> {
        &mut self.messages
    }
    
    /// Get a specific message by index
    pub fn get_message(&self, index: usize) -> Option<&ApiMessage> {
        self.messages.get(index)
    }
    
    /// Find a message by timestamp
    pub fn find_by_timestamp(&self, ts: i64) -> Option<&ApiMessage> {
        self.timestamp_index.get(&ts)
            .and_then(|&idx| self.messages.get(idx))
    }
    
    /// Find message index by timestamp
    pub fn find_index_by_timestamp(&self, ts: i64) -> Option<usize> {
        self.timestamp_index.get(&ts).copied()
    }
    
    /// Get the last message
    pub fn last_message(&self) -> Option<&ApiMessage> {
        self.messages.last()
    }
    
    /// Get the last N messages
    pub fn last_n_messages(&self, n: usize) -> &[ApiMessage] {
        let start = self.messages.len().saturating_sub(n);
        &self.messages[start..]
    }
    
    /// Get messages in a range
    pub fn get_range(&self, start: usize, end: usize) -> Result<&[ApiMessage]> {
        if end > self.messages.len() {
            return Err(ConversationError::IndexOutOfBounds(end));
        }
        Ok(&self.messages[start..end])
    }
    
    /// Overwrite messages with a new set
    pub fn overwrite_messages(&mut self, messages: Vec<ApiMessage>) {
        self.messages = messages;
        self.rebuild_index();
    }
    
    /// Truncate conversation to a specific index
    pub fn truncate_to_index(&mut self, index: usize) -> Result<()> {
        if index > self.messages.len() {
            return Err(ConversationError::IndexOutOfBounds(index));
        }
        self.messages.truncate(index);
        self.rebuild_index();
        Ok(())
    }
    
    /// Truncate to timestamp (remove all messages after this timestamp)
    pub fn truncate_to_timestamp(&mut self, ts: i64) -> Result<()> {
        if let Some(index) = self.find_index_by_timestamp(ts) {
            self.truncate_to_index(index)?;
            Ok(())
        } else {
            Err(ConversationError::MessageNotFound(ts))
        }
    }
    
    /// Clear all messages
    pub fn clear(&mut self) {
        self.messages.clear();
        self.timestamp_index.clear();
    }
    
    /// Count total messages
    pub fn len(&self) -> usize {
        self.messages.len()
    }
    
    /// Check if conversation is empty
    pub fn is_empty(&self) -> bool {
        self.messages.is_empty()
    }
    
    /// Get conversation statistics
    pub fn get_stats(&self) -> ConversationStats {
        let mut user_count = 0;
        let mut assistant_count = 0;
        let mut summary_count = 0;
        let mut total_tokens = 0;
        
        for msg in &self.messages {
            match msg.role {
                MessageRole::User => user_count += 1,
                MessageRole::Assistant => assistant_count += 1,
            }
            
            if msg.is_summary() {
                summary_count += 1;
            }
            
            total_tokens += msg.estimate_tokens();
        }
        
        ConversationStats {
            total_messages: self.messages.len(),
            user_messages: user_count,
            assistant_messages: assistant_count,
            summary_messages: summary_count,
            estimated_tokens: total_tokens,
        }
    }
    
    /// Find the index of the last summary message
    pub fn find_last_summary_index(&self) -> Option<usize> {
        self.messages.iter()
            .rposition(|msg| msg.is_summary())
    }
    
    /// Get messages since the last summary
    pub fn get_messages_since_summary(&self) -> &[ApiMessage] {
        match self.find_last_summary_index() {
            Some(idx) => &self.messages[idx..],
            None => &self.messages,
        }
    }
    
    /// Check if conversation was recently condensed
    pub fn has_recent_summary(&self, keep_count: usize) -> bool {
        if self.messages.len() <= keep_count {
            return false;
        }
        
        // Check if any of the last N messages is a summary
        self.last_n_messages(keep_count)
            .iter()
            .any(|msg| msg.is_summary())
    }
    
    /// Rebuild the timestamp index
    fn rebuild_index(&mut self) {
        self.timestamp_index.clear();
        for (idx, msg) in self.messages.iter().enumerate() {
            if let Some(ts) = msg.ts {
                self.timestamp_index.insert(ts, idx);
            }
        }
    }
    
    /// Filter messages by role
    pub fn filter_by_role(&self, role: &MessageRole) -> Vec<&ApiMessage> {
        self.messages.iter()
            .filter(|msg| &msg.role == role)
            .collect()
    }
    
    /// Get first message (often contains system context)
    pub fn first_message(&self) -> Option<&ApiMessage> {
        self.messages.first()
    }
    
    /// Remove image blocks from messages (for condensing)
    pub fn remove_images(&mut self) {
        use crate::types::{MessageContent, ContentBlock};
        
        for msg in &mut self.messages {
            if let MessageContent::Blocks(ref blocks) = msg.content {
                let text_blocks: Vec<ContentBlock> = blocks.iter()
                    .filter(|block| matches!(block, ContentBlock::Text { .. }))
                    .cloned()
                    .collect();
                
                if !text_blocks.is_empty() {
                    msg.content = MessageContent::Blocks(text_blocks);
                } else {
                    // If all blocks were images, replace with empty text
                    msg.content = MessageContent::Text(String::new());
                }
            }
        }
    }
    
    /// Create a summary message and prepend to conversation
    pub fn add_summary(&mut self, summary_text: String, first_msg_ts: i64) {
        let summary = ApiMessage::summary(summary_text, first_msg_ts);
        self.messages.insert(0, summary);
        self.rebuild_index();
    }
}

impl Default for ConversationManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_manager() {
        let manager = ConversationManager::new();
        assert_eq!(manager.len(), 0);
        assert!(manager.is_empty());
    }

    #[test]
    fn test_add_message() {
        let mut manager = ConversationManager::new();
        let msg = ApiMessage::user("Hello");
        manager.add_message(msg);
        
        assert_eq!(manager.len(), 1);
        assert!(!manager.is_empty());
    }

    #[test]
    fn test_find_by_timestamp() {
        let mut manager = ConversationManager::new();
        let msg = ApiMessage::user("Test");
        let ts = msg.ts.unwrap();
        manager.add_message(msg);
        
        let found = manager.find_by_timestamp(ts);
        assert!(found.is_some());
        assert_eq!(found.unwrap().get_text(), "Test");
    }

    #[test]
    fn test_last_n_messages() {
        let mut manager = ConversationManager::new();
        for i in 0..5 {
            manager.add_message(ApiMessage::user(format!("Message {}", i)));
        }
        
        let last_3 = manager.last_n_messages(3);
        assert_eq!(last_3.len(), 3);
        assert_eq!(last_3[0].get_text(), "Message 2");
        assert_eq!(last_3[2].get_text(), "Message 4");
    }

    #[test]
    fn test_truncate() {
        let mut manager = ConversationManager::new();
        for i in 0..5 {
            manager.add_message(ApiMessage::user(format!("Message {}", i)));
        }
        
        manager.truncate_to_index(3).unwrap();
        assert_eq!(manager.len(), 3);
    }

    #[test]
    fn test_overwrite() {
        let mut manager = ConversationManager::new();
        manager.add_message(ApiMessage::user("Old"));
        
        let new_msgs = vec![
            ApiMessage::user("New 1"),
            ApiMessage::user("New 2"),
        ];
        manager.overwrite_messages(new_msgs);
        
        assert_eq!(manager.len(), 2);
        assert_eq!(manager.get_message(0).unwrap().get_text(), "New 1");
    }

    #[test]
    fn test_stats() {
        let mut manager = ConversationManager::new();
        manager.add_message(ApiMessage::user("User 1"));
        manager.add_message(ApiMessage::assistant("Assistant 1"));
        manager.add_message(ApiMessage::user("User 2"));
        manager.add_message(ApiMessage::summary("Summary", 123));
        
        let stats = manager.get_stats();
        assert_eq!(stats.total_messages, 4);
        assert_eq!(stats.user_messages, 2);
        assert_eq!(stats.assistant_messages, 2);
        assert_eq!(stats.summary_messages, 1);
    }

    #[test]
    fn test_find_last_summary() {
        let mut manager = ConversationManager::new();
        manager.add_message(ApiMessage::user("User 1"));
        manager.add_message(ApiMessage::summary("Summary 1", 100));
        manager.add_message(ApiMessage::user("User 2"));
        manager.add_message(ApiMessage::summary("Summary 2", 200));
        manager.add_message(ApiMessage::user("User 3"));
        
        let idx = manager.find_last_summary_index();
        assert_eq!(idx, Some(3));
    }

    #[test]
    fn test_messages_since_summary() {
        let mut manager = ConversationManager::new();
        manager.add_message(ApiMessage::user("User 1"));
        manager.add_message(ApiMessage::summary("Summary", 100));
        manager.add_message(ApiMessage::user("User 2"));
        manager.add_message(ApiMessage::assistant("Assistant"));
        
        let since_summary = manager.get_messages_since_summary();
        assert_eq!(since_summary.len(), 3); // Summary + 2 messages after
    }

    #[test]
    fn test_clear() {
        let mut manager = ConversationManager::new();
        manager.add_message(ApiMessage::user("Test"));
        manager.clear();
        
        assert_eq!(manager.len(), 0);
        assert!(manager.is_empty());
    }

    #[test]
    fn test_filter_by_role() {
        let mut manager = ConversationManager::new();
        manager.add_message(ApiMessage::user("User 1"));
        manager.add_message(ApiMessage::assistant("Assistant"));
        manager.add_message(ApiMessage::user("User 2"));
        
        let user_msgs = manager.filter_by_role(&MessageRole::User);
        assert_eq!(user_msgs.len(), 2);
        
        let assistant_msgs = manager.filter_by_role(&MessageRole::Assistant);
        assert_eq!(assistant_msgs.len(), 1);
    }

    #[test]
    fn test_has_recent_summary() {
        let mut manager = ConversationManager::new();
        manager.add_message(ApiMessage::user("User 1"));
        manager.add_message(ApiMessage::user("User 2"));
        manager.add_message(ApiMessage::summary("Summary", 100));
        manager.add_message(ApiMessage::user("User 3"));
        manager.add_message(ApiMessage::user("User 4"));
        
        // Total 5 messages, summary is at index 2
        // With keep_count=3, last 3 messages are indices [2,3,4], summary is in there
        assert!(manager.has_recent_summary(3));
        
        // With keep_count=2, last 2 messages are indices [3,4], no summary
        assert!(!manager.has_recent_summary(2));
        
        // With keep_count=1, last 1 message is index [4], no summary
        assert!(!manager.has_recent_summary(1));
    }
}