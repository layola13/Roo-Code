import { ToolArgs } from "./types"

/**
 * Generates the use_subagent tool description.
 * Allows the assistant to delegate specialized analysis tasks to subagents.
 */
export function getUseSubagentDescription(args: ToolArgs): string {
	return `## use_subagent
Description: Delegate specialized analysis to isolated subagents for context management and structured insights. Subagents run in separate contexts with focused prompts optimized for specific analysis types.

**AUTO-TRIGGER CONDITIONS:**
- Context > 8000 tokens OR conversation > 15 messages
- User explicitly requests summary/analysis ("summarize", "recap", "what have we discussed")
- Before complex multi-factor decisions requiring full context review
- When you need structured extraction from lengthy conversations

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

Strategy 1 - Full Context Compression:
1. Call condense-context-analyzer → get conversation structure
2. Call condense-memory-extractor → extract critical decisions
3. Synthesize both results → provide compressed context to user

Strategy 2 - Focused Technical Analysis:
1. Call condense-code-summarizer with context="last 5 file changes"
2. Use summary to inform current code review or refactoring decision

Strategy 3 - Progressive Memory Management:
- Every ~20 messages: call condense-memory-extractor
- Store extracted memories in your working context
- Discard older full messages, keep only memories + recent 10 messages

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
