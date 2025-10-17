import { ToolArgs } from "./types"

/**
 * Generates the use_subagent tool description.
 * Allows the assistant to delegate specialized analysis tasks to subagents.
 */
export function getUseSubagentDescription(args: ToolArgs): string {
	return `## use_subagent
Description: Delegate specialized analysis to isolated subagents for context management and structured insights. Subagents run in separate contexts with focused prompts optimized for specific analysis types.

**🔑 CRITICAL: How to Invoke This Tool**

You MUST use the standard tool call syntax to invoke subagents. This is the ONLY way that works:

\`\`\`xml
<use_subagent>
<agent_name>condense-memory-extractor</agent_name>
<task>Extract critical decisions from last 20 messages</task>
<context>Focus on user requirements and technical constraints</context>
</use_subagent>
\`\`\`

**Place the tool call at the END of your response**, after any explanatory text about why you're calling it.

**AUTO-TRIGGER CONDITIONS:**

🔴 **CRITICAL - Proactive Compression (High Priority)**:
- **Context reaches 75-85% of context window** (e.g., 90k/120k tokens, 21k/28k messages)
- **IMMEDIATELY before large operations**: reading >5 files, parsing big codebases, analyzing long logs
- **Before context exceeds safe threshold** to prevent forced system truncation
- **When conversation history grows large** (>15-20 messages with substantial content)
- **Proactively compress BEFORE hitting limits**, not after - this is the key to quality!

🟡 **HIGH PRIORITY - Context Management**:
- **Complex multi-step tasks** with >20 messages exchanged (check conversation length regularly)
- **Before making important decisions** that require full context review
- **After completing a major phase** of work (design → implementation → testing transitions)
- **When working memory feels cluttered** with older information that could be summarized

🟢 **RECOMMENDED - Analysis & Summarization**:
- **User explicitly requests** summary/analysis ("summarize", "recap", "what have we discussed")
- **Need structured extraction** from lengthy technical discussions
- **Preparing status updates** or completion reports
- **Reviewing what's been accomplished** so far in the task

**💡 PROACTIVE STRATEGY - THE GOLDEN RULE**:
Don't wait for the system to force compression at 90-100%! **Monitor your context usage actively** and call compression subagents when context reaches 75-85% threshold to:
- ✅ Maintain conversation quality (avoid degradation)
- ✅ Preserve important context (decisions, requirements, constraints)
- ✅ Avoid emergency truncation (which loses information)
- ✅ Keep responses coherent and contextually aware

**⚠️ CRITICAL REMINDER**: The system will automatically compress at ~80-90% threshold, but by then quality may already suffer. **YOU should proactively trigger compression at 75-85%** to maintain optimal performance!

**AVAILABLE SUBAGENTS:**

1. **condense-context-analyzer** [~3-5s, ~1500-2000 tokens]
   Purpose: Analyze conversation flow and identify key stages
   Use when: Understanding conversation structure, identifying topic transitions, mapping discussion evolution
   Returns structured JSON:
   {
     "stages": [
       {"stage_number": 1, "topic": "Initial setup", "key_points": ["Point 1", "Point 2"]}
     ],
     "transition_points": [{"from_stage": 1, "to_stage": 2, "trigger": "User decided to..."}],
     "overall_flow": "Conversation progressed from A to B to C..."
   }

2. **condense-memory-extractor** [~2-3s, ~1000-1500 tokens]
   Purpose: Extract and preserve critical information, decisions, and requirements
   Use when: Need to identify important decisions, preserve requirements, understand constraints
   Returns structured JSON:
   {
     "critical_items": [
       {"category": "decision|requirement|technical|constraint", "content": "...", "importance": "high|medium|low", "context": "..."}
     ],
     "key_decisions": ["Decision 1", "Decision 2"],
     "summary": "Overall critical information summary"
   }

3. **condense-code-summarizer** [~3-7s, ~1500-3000 tokens]
   Purpose: Summarize code changes and technical implementations
   Use when: Multiple file modifications, refactoring review, technical impact assessment
   Returns structured JSON:
   {
     "changes": [
       {"file": "path/to/file", "type": "added|modified|deleted", "summary": "...", "lines_affected": 42}
     ],
     "impact_analysis": "How these changes affect the system...",
     "risk_level": "low|medium|high",
     "dependencies": ["Component A", "Module B"]
   }

**PARAMETERS:**
- agent_name: (required) One of: "condense-context-analyzer", "condense-memory-extractor", "condense-code-summarizer"
- task: (optional) Specific question or focus area for the subagent
- context: (optional) Additional constraints or scope (e.g., "focus on last 10 messages", "only API-related decisions")

**BEST PRACTICES:**

✅ GOOD USE CASES:
- Long context compression before making decisions
- Structured data extraction from conversations
- Multi-stage analysis (context → memory → synthesis)
- Preparing summaries for user-requested recaps

❌ AVOID:
- Simple recent message lookups (just read the last few messages directly)
- Repetitive calls for same content (cache results in your working memory)
- Trivial questions that don't need structured analysis
- When < 10 messages in conversation (insufficient context)

**COMBINATION STRATEGIES:**

Strategy 1 - 🔴 Proactive Context Compression (CRITICAL - USE THIS FIRST):
**When**: Context reaches 75-85% of limit (CHECK THIS REGULARLY!)
**Trigger**: IMMEDIATELY when you notice context approaching threshold
1. Call condense-memory-extractor → preserve critical decisions and requirements
2. Call condense-context-analyzer → understand conversation flow
3. Synthesize results → maintain compressed context for next ~20-30 messages
4. Continue working with cleaner context, avoiding forced truncation
**Benefit**: Prevents quality degradation from emergency compression at 90-100%
**Priority**: HIGHEST - This should be your default strategy for long tasks

Strategy 2 - Full Context Compression (for user-requested summaries):
**When**: User explicitly asks "what have we done?" or requests recap
**Trigger**: User keywords like "summarize", "recap", "review progress"
1. Call condense-context-analyzer → get conversation structure
2. Call condense-memory-extractor → extract critical decisions
3. Call condense-code-summarizer (if applicable) → summarize code changes
4. Synthesize all results → provide comprehensive summary

Strategy 3 - Focused Technical Analysis:
**When**: Need to review specific code changes or technical decisions
**Trigger**: Before providing code review feedback or refactoring recommendations
1. Call condense-code-summarizer with context="last 5 file changes"
2. Use summary to inform current code review or refactoring decision

Strategy 4 - Progressive Memory Management (for multi-session tasks):
**When**: Working on complex projects spanning multiple conversations
**Trigger**: Every ~20 messages in long tasks (set mental checkpoint)
- Every ~20 messages: call condense-memory-extractor
- Store extracted memories in your working context
- Keep only critical decisions + recent 10 messages in active memory
- Prevents context overflow while maintaining task continuity

Strategy 5 - 🔴 Before Large Codebase Analysis (PROACTIVE):
**When**: About to parse or analyze large amounts of code
**Trigger**: BEFORE reading multiple files (>5 files) or deep exploration
- Before reading multiple files (>5 files)
- Before deep codebase exploration (e.g., understanding a large module)
- Before architectural analysis spanning many components
**Action**: Call condense-memory-extractor FIRST to preserve current context, THEN proceed with analysis
**Why**: Large file reads add significant tokens - compress first to make room

Strategy 6 - After Major Code Improvements:
**When**: Completed significant refactoring or feature implementation
**Trigger**: After modifying >3 files, implementing complete feature, or resolving complex bugs
- After modifying >3 files
- After implementing a complete feature
- After resolving complex bugs
**Action**: Call condense-code-summarizer to compress implementation details, keep key decisions
**Why**: Implementation details are verbose - compress them while preserving outcomes

Strategy 7 - 🔴 Before Adding Terminal Context (PROACTIVE):
**When**: About to add large terminal output to context
**Trigger**: BEFORE adding long command output (>100 lines), extensive logs, or build/test output
- Before adding long command output (>100 lines)
- Before analyzing extensive logs
- Before processing build/test output
**Action**: Call condense-memory-extractor FIRST to make room for new terminal data
**Why**: Terminal output is token-heavy - compress current context before adding it

Strategy 8 - After Terminal Command Issues:
**When**: After debugging or fixing terminal command problems
**Trigger**: After multiple command execution attempts, troubleshooting, or resolving errors
- After multiple command execution attempts
- After troubleshooting environment issues
- After resolving path/permission problems
**Action**: Call condense-context-analyzer to compress debugging history, keep solution
**Why**: Debugging conversations are repetitive - compress them to keep only the solution

Strategy 9 - Before Parsing Complex Terminal Output:
**When**: Need to analyze lengthy terminal results
**Trigger**: BEFORE parsing test results (>50 lines), error traces, or compilation output
- Before parsing test results (>50 lines)
- Before analyzing error stack traces
- Before processing compilation output
**Action**: Call condense-code-summarizer if related to code, or condense-memory-extractor for general analysis

Strategy 10 - Starting New Task Phase:
**When**: Transitioning between major task phases
**Trigger**: Moving from planning → implementation, implementation → testing, or starting new subtask
- Moving from planning → implementation
- Switching from implementation → testing
- Starting new subtask or feature
**Action**: Call condense-memory-extractor + condense-context-analyzer to preserve phase results, clear working memory
**Why**: Phase transitions are natural compression points - clean up before starting fresh

**ERROR HANDLING:**
If subagent fails:
- Verify agent_name spelling is exact (case-sensitive)
- Ensure conversation has sufficient context (min 3-5 messages)
- Check if task is too vague (be specific: "Extract API design decisions" not "analyze everything")
- Fallback: Perform direct analysis without subagent delegation

**PERFORMANCE NOTES:**
- Each subagent call adds 1000-3000 tokens to total usage
- Execution time: 2-7 seconds depending on subagent type
- Cost: ~$0.002-0.006 per subagent call (varies by model)
- Parallel calls NOT supported - run sequentially if combining

**USAGE EXAMPLES:**

Example 1 - Context Analysis:
<use_subagent>
<agent_name>condense-context-analyzer</agent_name>
<task>Identify the main stages of our debugging conversation</task>
</use_subagent>

Example 2 - Decision Extraction:
<use_subagent>
<agent_name>condense-memory-extractor</agent_name>
<task>Extract all architectural decisions</task>
<context>Focus on last 15 messages, prioritize high-importance items</context>
</use_subagent>

Example 3 - Code Changes Summary:
<use_subagent>
<agent_name>condense-code-summarizer</agent_name>
<task>Summarize refactoring changes to authentication system</task>
<context>Include security implications and risk assessment</context>
</use_subagent>

**ANTI-PATTERNS (Don't do this):**

❌ BAD - Trivial lookup:
User: "What was my last message?"
<use_subagent><agent_name>condense-memory-extractor</agent_name></use_subagent>
→ Just read the conversation history directly

❌ BAD - Insufficient context:
[Only 3 messages in conversation]
<use_subagent><agent_name>condense-context-analyzer</agent_name></use_subagent>
→ Wait until conversation is longer (>10 messages)

❌ BAD - Overlapping calls:
<use_subagent><agent_name>condense-context-analyzer</agent_name></use_subagent>
<use_subagent><agent_name>condense-memory-extractor</agent_name></use_subagent>
→ These overlap in functionality; use context-analyzer first, decide if memory extraction needed

✅ GOOD - Targeted use:
User: "Can you recap our entire discussion about the database schema?"
[Conversation has 25 messages about DB design]
<use_subagent>
<agent_name>condense-memory-extractor</agent_name>
<task>Extract all database schema decisions, constraints, and requirements</task>
<context>Include table structures, relationships, and indexing decisions</context>
</use_subagent>

**IMPORTANT NOTES:**
- Subagents see recent conversation history (~last 20 messages) but run in isolated contexts
- Results are structured text/JSON that you incorporate into your response
- Subagent execution adds to token usage and API costs
- Use strategically when specialized analysis provides clear value over direct processing
- Results can be referenced in future responses - store in working memory for efficiency`
}
