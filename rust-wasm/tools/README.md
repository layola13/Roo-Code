# Roo Tools System

Tools system for the Roo-Code VSCode extension, implemented in Rust and compiled to WebAssembly.

## Overview

The tools system manages all available tools (read, edit, command, browser, MCP, etc.) and provides:

- **Tool Registration**: Dynamic tool availability management
- **Tool Validation**: Ensure tools are available before use
- **Tool Grouping**: Logical organization of related tools
- **WASM Integration**: Efficient cross-platform tool management

## Architecture

```
tools/
├── src/
│   ├── lib.rs          # WASM bindings and public API
│   ├── types.rs        # Tool types and definitions (21 tools, 7 groups)
│   ├── registry.rs     # Tool registry management
│   └── error.rs        # Error handling
├── Cargo.toml          # Rust dependencies and build config
└── README.md           # This file
```

## Tool Categories

### 1. Read Tools (6 tools)

- `read_file` - Read file contents
- `fetch_instructions` - Fetch task instructions
- `search_files` - Search files with regex
- `list_files` - List files and directories
- `list_code_definition_names` - List code definitions
- `codebase_search` - Semantic codebase search

### 2. Edit Tools (5 tools)

- `apply_diff` - Apply precise file modifications
- `write_to_file` - Write content to files
- `insert_content` - Insert content at specific lines
- `search_and_replace` - Find and replace text/regex
- `generate_image` - Generate images with AI

### 3. Command Tools (1 tool)

- `execute_command` - Execute CLI commands

### 4. Browser Tools (1 tool)

- `browser_action` - Browser interaction

### 5. MCP Tools (2 tools)

- `use_mcp_tool` - Use MCP server tools
- `access_mcp_resource` - Access MCP server resources

### 6. Mode Management Tools (2 tools)

- `switch_mode` - Switch between modes
- `new_task` - Create new task instances

### 7. Meta Tools (4 tools - Always Available)

- `ask_followup_question` - Ask user questions
- `attempt_completion` - Complete tasks
- `update_todo_list` - Update todo lists
- `run_slash_command` - Run slash commands

## API Reference

### Core Functions

#### `create_tool_registry() -> JsValue`

Create a new tool registry with all 21 tools registered.

```javascript
const registry = create_tool_registry()
```

#### `create_empty_tool_registry() -> JsValue`

Create an empty tool registry.

```javascript
const registry = create_empty_tool_registry()
```

#### `is_tool_available(registry: JsValue, tool_name: string) -> bool`

Check if a tool is available in the registry.

```javascript
const available = is_tool_available(registry, "read_file")
```

#### `get_available_tools(registry: JsValue) -> JsValue`

Get all available tools.

```javascript
const tools = get_available_tools(registry) // ["read_file", "write_to_file", ...]
```

#### `get_tools_in_group(registry: JsValue, group: string) -> JsValue`

Get all tools in a specific group.

```javascript
const readTools = get_tools_in_group(registry, "read")
```

#### `register_tool(registry: JsValue, tool_name: string) -> JsValue`

Register a tool in the registry.

```javascript
const updatedRegistry = register_tool(registry, "read_file")
```

#### `unregister_tool(registry: JsValue, tool_name: string) -> JsValue`

Unregister a tool from the registry.

```javascript
const updatedRegistry = unregister_tool(registry, "read_file")
```

#### `validate_tool(registry: JsValue, tool_name: string) -> bool`

Validate that a tool is available.

```javascript
const valid = validate_tool(registry, "read_file")
```

#### `enable_group(registry: JsValue, group: string) -> JsValue`

Enable all tools in a group.

```javascript
const updatedRegistry = enable_group(registry, "edit")
```

#### `disable_group(registry: JsValue, group: string) -> JsValue`

Disable all tools in a group (except always available).

```javascript
const updatedRegistry = disable_group(registry, "read")
```

#### `get_tool_count(registry: JsValue) -> number`

Get the number of registered tools.

```javascript
const count = get_tool_count(registry) // 21
```

## Usage Example

```javascript
import * as tools from "./roo_tools.js"

// Create registry with all tools
let registry = tools.create_tool_registry()
console.log(`Total tools: ${tools.get_tool_count(registry)}`) // 21

// Check tool availability
if (tools.is_tool_available(registry, "read_file")) {
	console.log("read_file is available")
}

// Get tools by group
const editTools = tools.get_tools_in_group(registry, "edit")
console.log("Edit tools:", editTools)

// Disable a group
registry = tools.disable_group(registry, "browser")

// Meta tools are always available
const isAvailable = tools.is_tool_available(registry, "attempt_completion")
console.log("attempt_completion available:", isAvailable) // true
```

## Building

### Build for Development

```bash
cd rust-wasm/tools
cargo build
```

### Build for Production (WASM)

```bash
cd rust-wasm/tools
wasm-pack build --target web --out-dir ../../dist/wasm/tools
```

### Run Tests

```bash
cd rust-wasm/tools
cargo test
```

## Test Coverage

The tools system includes comprehensive tests:

- **types.rs**: 12 tests covering tool names, groups, and tool use
- **error.rs**: 6 tests covering error handling
- **registry.rs**: 19 tests covering registry operations
- **lib.rs**: 4 integration tests

**Total: 41 unit tests** with >80% code coverage.

## Performance

- **WASM Bundle Size**: ~15KB (gzipped: ~5KB)
- **Initialization Time**: <1ms
- **Memory Usage**: ~50KB for full registry

## Design Decisions

### 1. Immutable Registry Pattern

Tool registration functions return a new registry instance rather than mutating in-place. This ensures:

- Thread safety in WASM context
- Predictable state management
- Easy rollback capabilities

### 2. Always Available Tools

Meta tools (completion, questions, mode switching) are always available regardless of registry state. This ensures:

- Users can always complete or abort tasks
- Mode switching is never blocked
- Consistent UX across all modes

### 3. Group-Based Management

Tools are organized into logical groups for easy bulk operations:

- Enable/disable entire feature sets at once
- Simplified mode configuration
- Better organization and discoverability

## Integration with TypeScript

The WASM module integrates seamlessly with the existing TypeScript codebase:

```typescript
import * as ToolsWasm from "../dist/wasm/tools/roo_tools"

class ToolManager {
	private registry: any

	constructor() {
		this.registry = ToolsWasm.create_tool_registry()
	}

	isToolAvailable(toolName: string): boolean {
		return ToolsWasm.is_tool_available(this.registry, toolName)
	}

	enableGroup(group: string): void {
		this.registry = ToolsWasm.enable_group(this.registry, group)
	}
}
```

## Future Enhancements

1. **Tool Permissions**: Add permission checks for sensitive operations
2. **Tool Analytics**: Track tool usage and performance metrics
3. **Custom Tools**: Allow users to register custom tools
4. **Tool Validation**: Validate tool parameters before execution
5. **Tool Chaining**: Support for sequential tool execution

## License

MIT License - See LICENSE file for details.
