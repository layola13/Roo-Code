//! Conversation Condensing
//! 
//! Handles conversation summarization and context compression

use crate::{ApiMessage, CondenseConfig, ConversationError, Result};

/// Calculate how many messages to keep during condensing based on conversation state
pub fn calculate_keep_count(total_messages: usize, context_usage_percent: f64) -> usize {
    // Base keep count
    let mut keep = 3;
    
    // Adjust based on context usage
    if context_usage_percent > 85.0 {
        keep = 2; // Emergency: keep minimum
    } else if context_usage_percent > 75.0 {
        keep = 3; // Normal
    } else if context_usage_percent < 50.0 {
        keep = 5; // Plenty of space: keep more
    }
    
    // Adjust based on total message count
    if total_messages > 50 {
        keep = keep.min(2); // Very long conversation: force reduction
    } else if total_messages < 10 {
        keep = keep.max(4); // Short conversation: preserve more context
    }
    
    keep
}

/// Get messages since the last summary
/// If no summary exists, returns all messages
/// Preserves the first message for context
pub fn get_messages_since_summary(messages: &[ApiMessage]) -> Vec<ApiMessage> {
    if messages.is_empty() {
        return Vec::new();
    }
    
    // Find the last summary index
    let last_summary_idx = messages.iter()
        .rposition(|msg| msg.is_summary());
    
    match last_summary_idx {
        Some(idx) => {
            // Return messages from summary onwards
            // If summary is not a user message, prepend the original first message
            let messages_from_summary = &messages[idx..];
            
            if !messages_from_summary.is_empty() && 
               messages_from_summary[0].role != crate::types::MessageRole::User {
                // Prepend original first user message for context
                let first_msg = &messages[0];
                if first_msg.role == crate::types::MessageRole::User {
                    let mut result = vec![first_msg.clone()];
                    result.extend_from_slice(messages_from_summary);
                    return result;
                }
            }
            
            messages_from_summary.to_vec()
        },
        None => messages.to_vec(), // No summary found, return all
    }
}

/// Select messages to keep based on importance scoring
/// This is a simplified version - full implementation would include:
/// - Token counting
/// - Semantic importance
/// - Recency weighting
pub fn select_messages_to_keep(
    messages: &[ApiMessage],
    target_keep_count: usize,
) -> Vec<ApiMessage> {
    if messages.is_empty() {
        return Vec::new();
    }
    
    if messages.len() <= target_keep_count {
        return messages.to_vec();
    }
    
    // Score messages (simplified - just by recency and role)
    let mut scored: Vec<(usize, f64)> = messages.iter()
        .enumerate()
        .map(|(idx, msg)| {
            let mut score = 0.0;
            
            // Recency score (more recent = higher)
            score += (idx as f64 / messages.len() as f64) * 50.0;
            
            // Role score (user messages slightly more important)
            if msg.role == crate::types::MessageRole::User {
                score += 10.0;
            }
            
            // Summary messages are important
            if msg.is_summary() {
                score += 30.0;
            }
            
            // Length score (longer = potentially more important)
            let text_len = msg.get_text().len();
            score += (text_len as f64 / 1000.0).min(20.0);
            
            (idx, score)
        })
        .collect();
    
    // Sort by score descending
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    
    // Select top N messages
    let mut selected_indices: Vec<usize> = scored.iter()
        .take(target_keep_count)
        .map(|(idx, _)| *idx)
        .collect();
    
    // Ensure last message is included
    let last_idx = messages.len() - 1;
    if !selected_indices.contains(&last_idx) {
        selected_indices.push(last_idx);
    }
    
    // Sort by original order
    selected_indices.sort_unstable();
    
    // Return selected messages in order
    selected_indices.iter()
        .filter_map(|&idx| messages.get(idx).cloned())
        .collect()
}

/// Validate condense parameters
pub fn validate_condense_params(
    messages: &[ApiMessage],
    config: &CondenseConfig,
) -> Result<()> {
    // Check minimum message count
    let min_required = config.keep_count + 2; // Need at least N to keep + 2 to condense
    if messages.len() < min_required {
        return Err(ConversationError::NotEnoughMessages(
            min_required,
            messages.len(),
        ));
    }
    
    // Check for recent summary in messages to keep
    if messages.len() > config.keep_count {
        let keep_messages = &messages[messages.len() - config.keep_count..];
        if keep_messages.iter().any(|msg| msg.is_summary()) {
            return Err(ConversationError::RecentlyCondensed);
        }
    }
    
    Ok(())
}

/// Prepare messages for condensing
/// Returns (messages_to_condense, messages_to_keep, first_message)
pub fn prepare_messages_for_condense(
    messages: &[ApiMessage],
    keep_count: usize,
) -> Result<(Vec<ApiMessage>, Vec<ApiMessage>, Option<ApiMessage>)> {
    if messages.is_empty() {
        return Err(ConversationError::EmptyConversation);
    }
    
    // Always preserve first message (may contain important context)
    let first_message = messages.first().cloned();
    
    // Messages to keep (last N)
    let keep_start = messages.len().saturating_sub(keep_count);
    let messages_to_keep = messages[keep_start..].to_vec();
    
    // Messages to condense (everything between first and last N)
    let condense_end = keep_start.max(1); // Keep at least first message separate
    let messages_to_condense = if condense_end > 1 {
        messages[1..condense_end].to_vec()
    } else {
        Vec::new()
    };
    
    // Get messages since last summary for condensing
    let condense_with_context = if !messages_to_condense.is_empty() {
        get_messages_since_summary(&messages_to_condense)
    } else {
        Vec::new()
    };
    
    Ok((condense_with_context, messages_to_keep, first_message))
}

/// Remove image blocks from messages (for API compatibility)
pub fn remove_image_blocks(messages: Vec<ApiMessage>) -> Vec<ApiMessage> {
    use crate::types::{MessageContent, ContentBlock};
    
    messages.into_iter()
        .map(|mut msg| {
            if let MessageContent::Blocks(ref blocks) = msg.content {
                let text_blocks: Vec<ContentBlock> = blocks.iter()
                    .filter(|block| matches!(block, ContentBlock::Text { .. }))
                    .cloned()
                    .collect();
                
                if !text_blocks.is_empty() {
                    msg.content = MessageContent::Blocks(text_blocks);
                } else {
                    // If all blocks were images, replace with placeholder
                    msg.content = MessageContent::Text("[Images removed]".to_string());
                }
            }
            msg
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ApiMessage;

    #[test]
    fn test_calculate_keep_count() {
        // High usage - keep minimum
        assert_eq!(calculate_keep_count(10, 90.0), 2);
        
        // Normal usage
        assert_eq!(calculate_keep_count(10, 70.0), 3);
        
        // Low usage - keep more
        assert_eq!(calculate_keep_count(10, 40.0), 5);
        
        // Very long conversation
        assert_eq!(calculate_keep_count(60, 70.0), 2);
        
        // Short conversation
        assert_eq!(calculate_keep_count(5, 70.0), 4);
    }

    #[test]
    fn test_get_messages_since_summary_no_summary() {
        let messages = vec![
            ApiMessage::user("Message 1"),
            ApiMessage::assistant("Message 2"),
            ApiMessage::user("Message 3"),
        ];
        
        let result = get_messages_since_summary(&messages);
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn test_get_messages_since_summary_with_summary() {
        let messages = vec![
            ApiMessage::user("Message 1"),
            ApiMessage::assistant("Message 2"),
            ApiMessage::summary("Summary", 100),
            ApiMessage::user("Message 3"),
            ApiMessage::assistant("Message 4"),
        ];
        
        let result = get_messages_since_summary(&messages);
        // Should include first message + summary + messages after
        assert!(result.len() >= 3);
        assert!(result.iter().any(|m| m.is_summary()));
    }

    #[test]
    fn test_select_messages_to_keep() {
        let messages = vec![
            ApiMessage::user("Message 1"),
            ApiMessage::assistant("Message 2"),
            ApiMessage::user("Message 3"),
            ApiMessage::assistant("Message 4"),
            ApiMessage::user("Message 5"),
        ];
        
        let selected = select_messages_to_keep(&messages, 3);
        assert_eq!(selected.len(), 3);
        
        // Last message should always be included
        assert_eq!(selected.last().unwrap().get_text(), "Message 5");
    }

    #[test]
    fn test_select_messages_fewer_than_target() {
        let messages = vec![
            ApiMessage::user("Message 1"),
            ApiMessage::assistant("Message 2"),
        ];
        
        let selected = select_messages_to_keep(&messages, 5);
        assert_eq!(selected.len(), 2); // Returns all when fewer than target
    }

    #[test]
    fn test_validate_condense_params_success() {
        let messages = vec![
            ApiMessage::user("1"),
            ApiMessage::assistant("2"),
            ApiMessage::user("3"),
            ApiMessage::assistant("4"),
            ApiMessage::user("5"),
            ApiMessage::assistant("6"),
        ];
        
        let config = CondenseConfig::default();
        assert!(validate_condense_params(&messages, &config).is_ok());
    }

    #[test]
    fn test_validate_condense_params_not_enough() {
        let messages = vec![
            ApiMessage::user("1"),
            ApiMessage::assistant("2"),
        ];
        
        let config = CondenseConfig::default();
        let result = validate_condense_params(&messages, &config);
        assert!(matches!(result, Err(ConversationError::NotEnoughMessages(_, _))));
    }

    #[test]
    fn test_validate_condense_params_recent_summary() {
        let messages = vec![
            ApiMessage::user("1"),
            ApiMessage::assistant("2"),
            ApiMessage::user("3"),
            ApiMessage::summary("Recent summary", 100),
            ApiMessage::user("4"),
        ];
        
        let config = CondenseConfig {
            keep_count: 2,
            ..Default::default()
        };
        
        let result = validate_condense_params(&messages, &config);
        assert!(matches!(result, Err(ConversationError::RecentlyCondensed)));
    }

    #[test]
    fn test_prepare_messages_for_condense() {
        let messages = vec![
            ApiMessage::user("First"),
            ApiMessage::assistant("2"),
            ApiMessage::user("3"),
            ApiMessage::assistant("4"),
            ApiMessage::user("Last 1"),
            ApiMessage::assistant("Last 2"),
        ];
        
        let result = prepare_messages_for_condense(&messages, 2);
        assert!(result.is_ok());
        
        let (to_condense, to_keep, first) = result.unwrap();
        assert_eq!(to_keep.len(), 2);
        assert!(first.is_some());
        assert_eq!(first.unwrap().get_text(), "First");
        assert!(!to_condense.is_empty());
    }

    #[test]
    fn test_remove_image_blocks() {
        use crate::types::{MessageContent, ContentBlock};
        
        let messages = vec![
            ApiMessage {
                role: crate::types::MessageRole::User,
                content: MessageContent::Blocks(vec![
                    ContentBlock::Text { text: "Hello".to_string() },
                    ContentBlock::Image { 
                        source: crate::types::ImageSource::Base64 {
                            media_type: "image/png".to_string(),
                            data: "base64data".to_string(),
                        }
                    },
                ]),
                ts: Some(100),
                is_summary: None,
                name: None,
            },
        ];
        
        let cleaned = remove_image_blocks(messages);
        assert_eq!(cleaned.len(), 1);
        
        if let MessageContent::Blocks(blocks) = &cleaned[0].content {
            assert_eq!(blocks.len(), 1);
            assert!(matches!(blocks[0], ContentBlock::Text { .. }));
        }
    }

    #[test]
    fn test_empty_messages() {
        let messages: Vec<ApiMessage> = vec![];
        let result = get_messages_since_summary(&messages);
        assert!(result.is_empty());
        
        let result = prepare_messages_for_condense(&messages, 3);
        assert!(matches!(result, Err(ConversationError::EmptyConversation)));
    }
}