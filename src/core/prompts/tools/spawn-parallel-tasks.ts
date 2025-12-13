/**
 * Prompt for spawn_parallel_tasks tool
 *
 * Provides comprehensive documentation for LLM to understand when and how
 * to use parallel task execution effectively.
 */

export const spawnParallelTasksPrompt = `## spawn_parallel_tasks

Description: Spawn multiple independent tasks for parallel execution using isolated subagent contexts. This tool enables concurrent processing of up to 10 independent tasks, dramatically reducing total execution time for parallelizable work.

**⚠️ CRITICAL: This tool is designed for INDEPENDENT tasks only. Do NOT use for tasks with dependencies or sequential requirements.**

### When to Use

**✅ IDEAL SCENARIOS:**

1. **Multi-File Independent Operations**
   - Modifying multiple unrelated files
   - Example: Updating API endpoints across different services
   - Example: Refactoring similar patterns in multiple modules

2. **Batch Code Analysis**
   - Analyzing multiple independent modules
   - Example: Security audit of different components
   - Example: Performance profiling of separate services

3. **Multi-Component Refactoring**
   - Refactoring independent components
   - Example: Updating multiple UI components with same pattern
   - Example: Modernizing multiple utility libraries

4. **Parallel Test Execution**
   - Running independent test suites
   - Example: Unit tests for different modules
   - Example: Integration tests for separate services

5. **Batch Documentation Generation**
   - Generating docs for multiple modules
   - Example: API documentation for different endpoints
   - Example: README updates for multiple packages

**❌ DO NOT USE FOR:**
- Tasks with dependencies (use sequential execution)
- Shared state modifications (risk of conflicts)
- Database migrations (requires ordering)
- Tasks requiring coordination (use single task with steps)
- Simple single-file operations (overhead not worth it)

### Parameters

\`\`\`typescript
interface SpawnParallelTasksParams {
  tasks: Array<{
    id: string                    // Unique task identifier
    description: string           // Clear task description
    context?: string              // Additional context for the task
    target_files?: string[]       // Files this task will work with
    priority?: 'high' | 'medium' | 'low'  // Task priority (default: medium)
    model?: string                // Optional: specific model for this task
    tools?: string[]              // Optional: restrict available tools
  }>
  execution_mode?: 'auto' | 'wait_all' | 'stream_results'  // Default: auto
  max_concurrent?: number         // Max parallel executions (1-10, default: 10)
}
\`\`\`

### Execution Modes

**auto** (default):
- Automatically determines best execution strategy
- Balances throughput and resource usage
- Recommended for most use cases

**wait_all**:
- Wait for all tasks to complete before returning results
- Best for batch operations where you need all results together
- Example: Multi-file refactoring that will be reviewed as a whole

**stream_results**:
- Stream results as each task completes
- Best for long-running tasks where early results are useful
- Example: Progressive code analysis with incremental feedback

### Usage Examples

**Example 1: Multi-File Refactoring**
\`\`\`xml
<spawn_parallel_tasks>
<tasks>
[
  {
    "id": "refactor-auth",
    "description": "Refactor authentication module to use new JWT library",
    "target_files": ["src/auth/jwt.ts", "src/auth/middleware.ts"],
    "priority": "high"
  },
  {
    "id": "refactor-logging",
    "description": "Update logging to use structured format",
    "target_files": ["src/utils/logger.ts", "src/middleware/logging.ts"],
    "priority": "medium"
  },
  {
    "id": "refactor-config",
    "description": "Migrate config to TypeScript and add validation",
    "target_files": ["src/config/index.js", "src/config/schema.ts"],
    "priority": "medium"
  }
]
</tasks>
<execution_mode>wait_all</execution_mode>
</spawn_parallel_tasks>
\`\`\`

**Example 2: Batch Code Analysis**
\`\`\`xml
<spawn_parallel_tasks>
<tasks>
[
  {
    "id": "analyze-performance",
    "description": "Analyze performance bottlenecks in API handlers",
    "context": "Focus on database queries and N+1 problems",
    "target_files": ["src/api/**/*.ts"]
  },
  {
    "id": "analyze-security",
    "description": "Security audit for authentication flows",
    "context": "Check for SQL injection, XSS, and auth bypass",
    "target_files": ["src/auth/**/*.ts", "src/middleware/**/*.ts"]
  },
  {
    "id": "analyze-tests",
    "description": "Identify missing test coverage",
    "target_files": ["src/**/*.test.ts"]
  }
]
</tasks>
<execution_mode>stream_results</execution_mode>
<max_concurrent>5</max_concurrent>
</spawn_parallel_tasks>
\`\`\`

**Example 3: Independent Component Updates**
\`\`\`xml
<spawn_parallel_tasks>
<tasks>
[
  {
    "id": "update-button",
    "description": "Update Button component to use new design system",
    "target_files": ["src/components/Button.tsx"],
    "priority": "high"
  },
  {
    "id": "update-input",
    "description": "Update Input component to use new design system",
    "target_files": ["src/components/Input.tsx"],
    "priority": "high"
  },
  {
    "id": "update-modal",
    "description": "Update Modal component to use new design system",
    "target_files": ["src/components/Modal.tsx"],
    "priority": "medium"
  },
  {
    "id": "update-card",
    "description": "Update Card component to use new design system",
    "target_files": ["src/components/Card.tsx"],
    "priority": "low"
  }
]
</tasks>
</spawn_parallel_tasks>
\`\`\`

### Best Practices

1. **Clear Task Descriptions**
   - Be specific about what each task should accomplish
   - Include acceptance criteria in the description
   - Mention any constraints or requirements

2. **Appropriate Granularity**
   - Not too small: Avoid overhead for trivial tasks
   - Not too large: Keep tasks focused and independent
   - Sweet spot: 5-20 minutes of work per task

3. **Priority Assignment**
   - High: Critical path items, blocking issues
   - Medium: Standard work (default)
   - Low: Nice-to-have improvements, cleanup

4. **Resource Consideration**
   - Default max_concurrent (10) is usually optimal
   - Reduce for resource-intensive tasks
   - Consider API rate limits and costs

5. **Error Handling**
   - Each task executes independently
   - One task failure doesn't affect others
   - Review all results to identify partial failures

### Performance Characteristics

- **Speedup**: Up to 10x for perfectly parallel tasks
- **Overhead**: ~500ms per task for scheduling
- **Memory**: Each task gets isolated 200K token context
- **Cost**: Same as sequential execution (parallel API calls)

### Limitations

- Maximum 10 concurrent tasks
- Tasks must be truly independent
- Cannot share state between tasks
- Each task has isolated context (no cross-task memory)
- Limited to tools specified in task definition

### Monitoring

The tool provides real-time progress updates:
- Task start/completion notifications
- Success/failure status for each task
- Total execution time
- Aggregate statistics

Results include:
- Individual task outputs
- Execution metrics
- Error details for failed tasks
- Overall summary

### Integration with Workflow

**Before parallel execution:**
1. Identify independent subtasks
2. Verify no shared state or dependencies
3. Define clear task boundaries
4. Assign appropriate priorities

**During execution:**
- Monitor progress through UI updates
- Tasks execute in isolated contexts
- Dynamic scheduling handles queuing

**After execution:**
- Review all task results
- Handle any failures individually
- Integrate changes if needed
- Verify no conflicts between task outputs

### Common Patterns

**Pattern 1: Parallel File Processing**
\`\`\`typescript
// Good: Independent file updates
tasks: [
  { id: "file1", description: "Update file1.ts", target_files: ["file1.ts"] },
  { id: "file2", description: "Update file2.ts", target_files: ["file2.ts"] }
]

// Bad: Shared file modifications
tasks: [
  { id: "task1", description: "Add import to shared.ts" },
  { id: "task2", description: "Add export to shared.ts" }  // CONFLICT!
]
\`\`\`

**Pattern 2: Progressive Analysis**
\`\`\`typescript
// Use stream_results for immediate feedback
execution_mode: "stream_results"
tasks: [
  { id: "quick-scan", description: "Quick syntax check", priority: "high" },
  { id: "deep-analysis", description: "Deep semantic analysis", priority: "low" }
]
\`\`\`

**Pattern 3: Priority-Based Scheduling**
\`\`\`typescript
// High priority tasks execute first
tasks: [
  { id: "critical", priority: "high", description: "Fix production bug" },
  { id: "important", priority: "medium", description: "Feature work" },
  { id: "cleanup", priority: "low", description: "Code cleanup" }
]
\`\`\`

### Decision Matrix

| Scenario | Use Parallel? | Reasoning |
|----------|---------------|-----------|
| Update 10 independent components | ✅ Yes | Perfect for parallel |
| Refactor with shared types | ❌ No | Type dependencies |
| Run separate test suites | ✅ Yes | Independent execution |
| Database migration sequence | ❌ No | Order matters |
| Multi-file find and replace | ✅ Yes | Independent file ops |
| Incremental refactoring | ❌ No | Each step builds on previous |

Usage:
<spawn_parallel_tasks>
<tasks>Array of task definitions</tasks>
<execution_mode>auto, wait_all, or stream_results</execution_mode>
<max_concurrent>1-10</max_concurrent>
</spawn_parallel_tasks>`

export default spawnParallelTasksPrompt
