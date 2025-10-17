/**
 * Subagents section for system prompt
 * Documents available subagents that can be proactively invoked by the LLM
 */

export function getSubagentsSection(): string {
	return `====

AVAILABLE SUBAGENTS

You have access to specialized subagents for context compression and analysis. These subagents MUST be triggered by YOU using explicit tool calls.

## 🔴 CRITICAL: Context Monitoring Requirement

**YOU MUST actively monitor context usage throughout the conversation and proactively invoke subagents BEFORE reaching capacity limits.**

### Mandatory Monitoring Rules:

1. **Track Message Count**: Count messages in current conversation regularly
   - At 15-20 messages → Consider calling condense-memory-extractor
   - At 25+ messages → MUST call compression subagents

2. **Estimate Context Usage**: Approximate your context window usage
   - 75-85% threshold → **IMMEDIATELY** invoke condense-memory-extractor + condense-context-analyzer
   - 85-90% threshold → **EMERGENCY** compression required
   - DO NOT wait until 90%+ - quality degrades rapidly

3. **Before Large Operations**: Always compress BEFORE adding large context
   - Before reading >5 files → Call condense-memory-extractor first
   - Before analyzing long terminal output (>100 lines) → Compress existing context
   - Before deep codebase exploration → Preserve current state

4. **Phase Transitions**: Compress when completing major work phases
   - After modifying >3 files → Call condense-code-summarizer
   - After resolving complex bugs → Call condense-context-analyzer
   - Moving from design → implementation → Call condense-memory-extractor

### Decision Flowchart:

Is conversation >15 messages? → YES → Should I compress now?
  - Has critical info to preserve? → YES → Call condense-memory-extractor
  - Multiple task phases completed? → YES → Call condense-context-analyzer
  - Code changes made? → YES → Call condense-code-summarizer

About to read >5 files? → YES → Call condense-memory-extractor FIRST
About to analyze long output? → YES → Call condense-context-analyzer FIRST
Context feels cluttered? → YES → Call appropriate subagent NOW

## 🔑 KEY RULE: Tool Call Invocation ONLY

**CRITICAL**: You MUST use explicit tool call syntax to invoke subagents. Natural language mentions will NOT trigger execution.

✅ **CORRECT - Use Tool Call Syntax**:
\`\`\`xml
<use_subagent>
<agent_name>condense-memory-extractor</agent_name>
<task>Extract critical decisions and requirements from last 20 messages</task>
</use_subagent>
\`\`\`

❌ **INCORRECT - Natural Language (Will NOT Work)**:
- "I need condense-context-analyzer to analyze the conversation" (DOES NOT TRIGGER)
- "Let me call condense-memory-extractor subagent" (DOES NOT TRIGGER)
- "Using condense-code-summarizer to compress" (DOES NOT TRIGGER)

**REMEMBER**: Only the XML tool call format above will actually execute subagents!

## Subagent Trigger Strategy

### 1. Proactive Invocation (YOUR RESPONSIBILITY)
**YOU decide** when to call subagents based on the monitoring rules above. This is YOUR responsibility to manage context proactively.

**WHEN YOU MUST PROACTIVELY INVOKE** (not optional):
- ✅ Context approaching 75-85% of limit (estimate based on message count/complexity)
- ✅ Conversation exceeds 20 messages with substantial content
- ✅ Critical information discussed that must be preserved (user requirements, decisions, constraints)
- ✅ Before performing large operations (reading multiple files, parsing logs)
- ✅ After completing major work phases (feature implementation, debugging session)
- ✅ When transitioning between task stages (design → code → test)

**How to invoke**:
Use the tool call syntax shown above. Place the tool call at the END of your response, after any explanatory text.

Example of proper usage:
\`\`\`
I notice we've exchanged 18 messages and made several important architectural decisions. Before proceeding with implementation, I'll preserve this critical context to ensure it's not lost.

<use_subagent>
<agent_name>condense-memory-extractor</agent_name>
<task>Extract all architectural decisions, requirements, and technical constraints discussed</task>
<context>Focus on API design, database schema, and authentication approach</context>
</use_subagent>
\`\`\`

### 2. Automatic Compression (auto_compress) - FALLBACK ONLY
The system **automatically** triggers subagents when:
- Context window reaches 80-90% threshold (emergency mode)
- Context window is exceeded and emergency compression is needed
- User manually requests context compression

**Your role**: You will receive the compressed context automatically. However, **DO NOT rely on this** - you should have already compressed proactively at 75-85%.

## Available Subagents

### condense-context-analyzer
**Purpose**: Analyzes conversation flow and identifies key stages
**Processing Time**: ~3-5s, ~1500-2000 tokens
**Returns**: Structured JSON with stages, transitions, and overall flow

**MUST USE when**:
- Conversation has >20 messages (MANDATORY)
- Multiple distinct task phases completed
- Planning to make strategic decisions requiring full context
- Need to understand what's completed vs. remaining

**Tool call example**:
\`\`\`xml
<use_subagent>
<agent_name>condense-context-analyzer</agent_name>
<task>Analyze conversation stages and identify key transition points</task>
</use_subagent>
\`\`\`

### condense-memory-extractor
**Purpose**: Extracts and preserves critical information, decisions, and requirements
**Processing Time**: ~2-3s, ~1000-1500 tokens
**Returns**: Structured JSON with critical_items, key_decisions, and summary

**MUST USE when**:
- User provides important instructions/requirements (MANDATORY)
- Configuration decisions are made (MANDATORY)
- Technical constraints are discussed (MANDATORY)
- Context exceeds 75% and contains critical info (MANDATORY)
- Before reading >5 files (MANDATORY)

**Tool call example**:
\`\`\`xml
<use_subagent>
<agent_name>condense-memory-extractor</agent_name>
<task>Extract critical requirements, decisions, and constraints</task>
<context>Prioritize user requirements and technical constraints</context>
</use_subagent>
\`\`\`

### condense-code-summarizer
**Purpose**: Summarizes code changes and technical implementations
**Processing Time**: ~3-7s, ~1500-3000 tokens
**Returns**: Structured JSON with changes, impact_analysis, risk_level, dependencies

**MUST USE when**:
- Modified >3 files (MANDATORY)
- Completed complex refactoring (MANDATORY)
- Implemented complete feature (MANDATORY)
- Code discussion exceeds 15 messages (MANDATORY)

**Tool call example**:
\`\`\`xml
<use_subagent>
<agent_name>condense-code-summarizer</agent_name>
<task>Summarize refactoring changes and assess impact</task>
<context>Include security implications and dependency changes</context>
</use_subagent>
\`\`\`

## Proactive Invocation Benefits

When YOU proactively invoke subagents at 75-85% threshold:
- ✅ Maintain conversation quality (avoid degradation at 90%+)
- ✅ Preserve important context (decisions, requirements, constraints)
- ✅ Avoid emergency truncation (which loses information)
- ✅ Keep responses coherent and contextually aware
- ✅ Better control over what gets compressed and when
- ✅ More strategic compression aligned with task phases

## Invocation Mechanism

**How to invoke proactively**:
1. **Assess context state**: Count messages, estimate usage
2. **Decide which subagent**: Based on content type (general/memory/code)
3. **Use tool call syntax**: Place XML tool call at end of your response (REQUIRED)
4. **Provide specific task**: Give clear instructions to subagent

**Tool Call Format** (REQUIRED):
\`\`\`xml
<use_subagent>
<agent_name>EXACT_SUBAGENT_NAME</agent_name>
<task>Specific task description</task>
<context>Optional additional context or focus area</context>
</use_subagent>
\`\`\`

**Valid agent names**:
- condense-context-analyzer
- condense-memory-extractor
- condense-code-summarizer

**System behavior**:
1. Detects tool call in your response
2. Executes subagent in isolated context
3. Returns structured results to you
4. You integrate results into ongoing work
5. UI shows compression indicator to user

## Important Notes

- **CRITICAL**: Tool calls MUST use exact XML format shown above
- **CRITICAL**: Always monitor message count - this is YOUR responsibility
- **GOLDEN RULE**: Compress at 75-85%, NOT at 90%+ when quality suffers
- **MANDATORY**: Call compression before large operations (>5 file reads, long outputs)
- **PLACEMENT**: Tool calls MUST be at the END of your message
- **UI VISIBILITY**: All subagent calls are visible to users with clear indicators
- **SEQUENCE**: Multiple subagents can be invoked in sequence for comprehensive analysis
- **COST AWARENESS**: Each call costs ~$0.002-0.006 - use strategically but don't avoid when needed`
}
