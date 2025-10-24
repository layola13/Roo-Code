import { ToolArgs } from "./types"

export function getParseAstDescription(args: ToolArgs): string {
	return `## parse_ast
Description: Request to parse and return the Abstract Syntax Tree (AST) structure of a specified file. This tool uses tree-sitter to analyze source code and returns the complete AST representation, which is useful for understanding code structure, analyzing syntax patterns, or performing advanced code analysis. Supports multiple programming languages including JavaScript, TypeScript, Python, Go, Rust, C/C++, Java, and more.
Parameters:
- path: (required) The path of the file to parse (relative to the current workspace directory ${args.cwd})
- format: (optional) Output format - 'tree' for tree structure (default) or 'json' for JSON representation
- max_depth: (optional) Maximum depth to traverse in the AST tree (default: unlimited). Use this to limit output size for large files.
Usage:
<parse_ast>
<path>File path here</path>
<format>tree or json (optional)</format>
<max_depth>Maximum depth number (optional)</max_depth>
</parse_ast>

Example: Requesting to parse a Go file's AST
<parse_ast>
<path>src/parser.go</path>
<format>tree</format>
<max_depth>5</max_depth>
</parse_ast>

Example: Requesting to parse a TypeScript file's AST in JSON format
<parse_ast>
<path>src/utils.ts</path>
<format>json</format>
</parse_ast>

**⚠️ Context Management Reminder:**
AST output can be very large, especially for complex files. Consider using the max_depth parameter to limit output size. If context usage is approaching 75-85% of the window limit, consider using the \`use_subagent\` tool to compress existing context first. This maintains conversation quality and prevents context overflow.`
}
