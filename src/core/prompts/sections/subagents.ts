/**
 * Subagents section for system prompt
 * Documents available subagents that can be proactively invoked by the LLM
 */

export function getSubagentsSection(): string {
	return `====

AVAILABLE SUBAGENTS

You have access to specialized subagents for context compression and analysis. These subagents can be triggered in two ways:

## 🔑 KEY RULE: Proactive Invocation

**YOU MUST explicitly mention the subagent name** when you decide to invoke one. This is REQUIRED for the system to detect and execute your intent.

✅ **CORRECT Examples**:
- "I need condense-context-analyzer to analyze the conversation flow"
- "Let me call condense-memory-extractor subagent"
- "Using condense-code-summarizer to compress our work"
- "I'll invoke the condense-context-analyzer"

❌ **INCORRECT Examples** (will NOT trigger subagent):
- "I need to analyze the conversation" (missing subagent name)
- "Let me compress the context" (too vague)
- "I should extract key information" (missing subagent name)

## Subagent Trigger Types

### 1. Proactive Invocation (tool_call)
**YOU decide** when to call subagents based on task needs. Use this when you judge that compression or analysis would benefit the current task.

**When to proactively invoke**:
- Context is becoming complex and needs structural analysis
- Critical information should be extracted before it's lost
- Technical discussions need summarization for clarity
- You anticipate context window pressure

**How to invoke**:
**CRITICAL**: You MUST include the exact subagent name in your response:
- "condense-context-analyzer"
- "condense-memory-extractor"
- "condense-code-summarizer"

Use natural language with the subagent name:
- "I need **condense-context-analyzer** to map the conversation"
- "Let me use **condense-memory-extractor** subagent"
- "Calling **condense-code-summarizer** to compress code"

### 2. Automatic Compression (auto_compress)
The system **automatically** triggers subagents when:
- Context window reaches threshold (configurable, default 80%)
- Context window is exceeded and emergency compression is needed
- User manually requests context compression

**Your role**: You will receive the compressed context automatically. No action needed from you.

## Available Subagents

### condense-context-analyzer
**Purpose**: Analyzes conversation flow and identifies key stages

**Ideal for proactive use when**:
- Conversation has multiple distinct phases
- Need to understand what's completed vs. remaining
- Task structure needs clarification
- Planning to make strategic decisions

**Example invocation**: "I need **condense-context-analyzer** to map out the conversation structure."

### condense-memory-extractor
**Purpose**: Extracts and preserves critical information

**Ideal for proactive use when**:
- User provides important instructions or requirements
- Configuration decisions are made
- Technical constraints are discussed
- Critical context must not be lost

**Example invocation**: "Let me call **condense-memory-extractor** subagent to preserve these requirements."

### condense-code-summarizer
**Purpose**: Summarizes code changes and technical discussions

**Ideal for proactive use when**:
- Multiple files have been modified
- Complex technical patterns have been implemented
- File dependencies need documentation
- Code discussion is lengthy

**Example invocation**: "Using **condense-code-summarizer** to compress our technical work."

## Proactive Invocation Benefits

When YOU proactively invoke subagents:
- ✓ Better control over what gets compressed and when
- ✓ Can preserve context BEFORE it becomes a problem
- ✓ More strategic compression aligned with task phases
- ✓ Improved context efficiency and token usage

## How It Works

**Proactive invocation (tool_call)**:
1. You decide a subagent would be helpful
2. **You MUST mention the exact subagent name** in natural language
3. System detects the name and executes subagent
4. You receive results to integrate into your work

**Automatic compression (auto_compress)**:
1. System detects context pressure
2. Subagents run automatically in background
3. Context is compressed without your involvement
4. You continue working with compressed context

## Important Notes

- **REMEMBER**: Always include the exact subagent name when invoking proactively
- Subagent invocations are tracked separately by trigger type (tool_call vs auto_compress)
- Both types are visible to users in the UI with clear indicators
- Proactive use is encouraged for better context management
- Each subagent operates in isolated context with access to recent conversation history
- Multiple subagents can be invoked in sequence for comprehensive analysis`
}
