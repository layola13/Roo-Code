# Tools System 结构分析

**创建时间**: 2025-10-15  
**目的**: 分析现有Tools System结构，为ToolsAdapter实现提供指导

## 1. 现有TypeScript Tools System

### 1.1 核心组件

#### validateToolUse.ts

- **职责**: 验证工具在特定模式下是否可用
- **关键函数**:
    ```typescript
    validateToolUse(
      toolName: ToolName,
      mode: Mode,
      customModes?: ModeConfig[],
      toolRequirements?: Record<string, boolean>,
      toolParams?: Record<string, unknown>
    ): void
    ```
- **验证逻辑**: 使用`isToolAllowedForMode()`检查工具权限
- **错误处理**: 抛出Error，格式："Tool X is not allowed in Y mode."

#### ToolRepetitionDetector.ts

- **职责**: 检测连续相同工具调用，防止AI陷入循环
- **关键特性**:
    - 默认限制: 3次连续相同调用
    - 参数序列化: 使用排序后的JSON字符串比较
    - 特殊处理: 浏览器滚动操作不受限制
    - 限制达到后自动重置计数器
- **返回值**:
    ```typescript
    {
      allowExecution: boolean
      askUser?: {
        messageKey: string
        messageDetail: string
      }
    }
    ```

### 1.2 工具分组系统

根据Rust WASM实现，工具分为7个组：

| 组名    | 工具数量 | 说明                                                                                                 | 始终可用 |
| ------- | -------- | ---------------------------------------------------------------------------------------------------- | -------- |
| Read    | 6        | read_file, search_files, list_files, list_code_definition_names, codebase_search, fetch_instructions | ❌       |
| Edit    | 5        | apply_diff, write_to_file, insert_content, search_and_replace, generate_image                        | ❌       |
| Command | 1        | execute_command                                                                                      | ❌       |
| Browser | 1        | browser_action                                                                                       | ❌       |
| Mcp     | 2        | use_mcp_tool, access_mcp_resource                                                                    | ❌       |
| Modes   | 2        | switch_mode, new_task                                                                                | ✅       |
| Meta    | 4        | ask_followup_question, attempt_completion, update_todo_list, run_slash_command                       | ✅       |

**总计**: 21个工具

## 2. Rust WASM Tools Module

### 2.1 模块结构

```
rust-wasm/tools/
├── src/
│   ├── lib.rs           # 主入口，WASM绑定
│   ├── types.rs         # 核心类型定义（ToolName, ToolGroup, ToolUse）
│   ├── registry.rs      # 工具注册表（ToolRegistry, ToolInfo）
│   └── error.rs         # 错误类型
└── Cargo.toml
```

### 2.2 核心类型

#### ToolName (types.rs)

```rust
pub enum ToolName {
    // 21个工具枚举
    ReadFile, SearchFiles, ... AttemptCompletion
}

impl ToolName {
    fn display_name(&self) -> &'static str
    fn as_str(&self) -> &'static str
    fn group(&self) -> ToolGroup
    fn is_always_available(&self) -> bool
    fn all() -> Vec<Self>
    fn from_str(s: &str) -> Option<Self>
}
```

#### ToolGroup (types.rs)

```rust
pub enum ToolGroup {
    Read, Edit, Command, Browser, Mcp, Modes, Meta
}

impl ToolGroup {
    fn tools(&self) -> Vec<ToolName>
    fn is_always_available(&self) -> bool
}
```

#### ToolUse (types.rs)

```rust
pub struct ToolUse {
    pub name: ToolName,
    pub params: HashMap<String, String>,
    pub partial: bool,
}

impl ToolUse {
    fn new(name: ToolName) -> Self
    fn with_param(self, key, value) -> Self
    fn get_param(&self, key: &str) -> Option<&String>
    fn has_param(&self, key: &str) -> bool
}
```

#### ToolRegistry (registry.rs)

```rust
pub struct ToolRegistry {
    tools: HashMap<ToolName, ToolInfo>,
    groups: HashSet<ToolGroup>,
}

impl ToolRegistry {
    fn new() -> Self                              // 所有工具
    fn empty() -> Self                            // 空注册表
    fn register(&mut self, name: ToolName)
    fn unregister(&mut self, name: ToolName)
    fn is_tool_available(&self, name: ToolName) -> bool
    fn get_tool_info(&self, name: ToolName) -> Option<&ToolInfo>
    fn get_available_tools(&self) -> Vec<ToolName>
    fn get_tools_in_group(&self, group: ToolGroup) -> Vec<ToolName>
    fn validate_tool(&self, name: ToolName) -> ToolResult<()>
    fn enable_group(&mut self, group: ToolGroup)
    fn disable_group(&mut self, group: ToolGroup)
}
```

### 2.3 WASM导出函数 (lib.rs)

| 函数名                         | 参数                   | 返回值  | 说明                     |
| ------------------------------ | ---------------------- | ------- | ------------------------ |
| `create_tool_registry()`       | 无                     | JsValue | 创建包含所有工具的注册表 |
| `create_empty_tool_registry()` | 无                     | JsValue | 创建空注册表             |
| `is_tool_available()`          | registry_js, tool_name | bool    | 检查工具是否可用         |
| `get_available_tools()`        | registry_js            | JsValue | 获取所有可用工具         |
| `get_tools_in_group()`         | registry_js, group     | JsValue | 获取组内工具             |
| `register_tool()`              | registry_js, tool_name | JsValue | 注册工具                 |
| `unregister_tool()`            | registry_js, tool_name | JsValue | 注销工具                 |
| `validate_tool()`              | registry_js, tool_name | bool    | 验证工具                 |
| `enable_group()`               | registry_js, group     | JsValue | 启用组                   |
| `disable_group()`              | registry_js, group     | JsValue | 禁用组                   |
| `get_tool_count()`             | registry_js            | usize   | 获取工具数量             |

## 3. ToolsAdapter 设计方案

### 3.1 设计目标

1. **桥接层**: TypeScript工具系统 ↔ Rust WASM工具系统
2. **Registry管理**: 维护工具注册表状态
3. **工具调用**: 参数验证、执行、结果处理
4. **重复检测**: 集成ToolRepetitionDetector逻辑
5. **Fallback策略**: WASM失败时降级到TypeScript
6. **状态持久化**: 使用safeWriteJson保存注册表状态（⚠️强制规则）

### 3.2 核心接口设计

```typescript
export interface ToolsAdapterConfig {
	enableWasm: boolean // 启用WASM
	enableFallback: boolean // 启用Fallback
	persistencePath?: string // 状态持久化路径
	maxRetries?: number // 最大重试次数
	repetitionLimit?: number // 重复检测限制
}

export interface ToolExecutionResult {
	success: boolean
	result?: any
	error?: string
	usedWasm: boolean
	retryCount: number
}

export class ToolsAdapter {
	// 构造函数
	constructor(hostInterface: HostInterface, config: ToolsAdapterConfig)

	// 注册表管理
	async initializeRegistry(): Promise<void>
	async registerTool(toolName: string): Promise<boolean>
	async unregisterTool(toolName: string): Promise<boolean>
	async enableGroup(group: string): Promise<void>
	async disableGroup(group: string): Promise<void>

	// 工具查询
	isToolAvailable(toolName: string): Promise<boolean>
	getAvailableTools(): Promise<string[]>
	getToolsInGroup(group: string): Promise<string[]>

	// 工具执行（核心）
	async validateAndExecute(toolUse: ToolUse, mode: string): Promise<ToolExecutionResult>

	// 重复检测
	checkRepetition(toolUse: ToolUse): {
		allowExecution: boolean
		askUser?: { messageKey: string; messageDetail: string }
	}

	// 状态管理
	async syncRegistry(): Promise<void> // 使用safeWriteJson
	async loadRegistry(): Promise<void>

	// 资源清理
	dispose(): void
}
```

### 3.3 关键设计决策

#### 3.3.1 状态持久化（⚠️关键）

**强制使用safeWriteJson**:

```typescript
private async syncRegistry(): Promise<void> {
  if (!this.config.persistencePath) return

  try {
    const registryState = {
      tools: await this.getAvailableTools(),
      timestamp: Date.now(),
      wasmMode: !this.fallbackMode
    }

    const path = `${this.config.persistencePath}/tools-registry.json`
    // ⚠️ 必须使用safeWriteJson，不能用JSON.stringify + fs.writeFile
    await safeWriteJson(path, registryState)
  } catch (error) {
    this.hostInterface.log('error', `Failed to sync registry: ${error}`)
  }
}
```

#### 3.3.2 Fallback策略

1. **初始化失败** → 立即切换Fallback
2. **运行时错误** → 重试3次 → 达到限制后切换Fallback
3. **Fallback模式** → 使用TypeScript `validateToolUse()`和现有工具实现

#### 3.3.3 重复检测集成

```typescript
private repetitionDetector: ToolRepetitionDetector

async validateAndExecute(toolUse: ToolUse): Promise<ToolExecutionResult> {
  // 1. 重复检测（优先级最高）
  const repetitionCheck = this.repetitionDetector.check(toolUse)
  if (!repetitionCheck.allowExecution) {
    return {
      success: false,
      error: repetitionCheck.askUser?.messageDetail,
      usedWasm: false,
      retryCount: 0
    }
  }

  // 2. WASM或Fallback执行
  if (this.fallbackMode) {
    return await this.executeFallback(toolUse)
  } else {
    return await this.executeWasm(toolUse)
  }
}
```

#### 3.3.4 参考TaskAdapter模式

```typescript
// TaskAdapter模式的优秀实践：
✅ 清晰的错误计数和重试逻辑
✅ 自动Fallback切换机制
✅ 使用safeWriteJson持久化状态
✅ 防御性编程（try-catch包裹所有WASM调用）
✅ 日志记录（info/warn/error分级）
✅ 独立的状态同步方法
```

## 4. 实现计划

### Phase 2.2.1: ToolsAdapter基础实现

1. ✅ **2.2.1.1**: 分析现有Tools System结构（本文档）
2. **2.2.1.2**: 创建ToolsAdapter基础类

    - 配置接口
    - 构造函数
    - WASM初始化
    - Fallback机制

3. **2.2.1.3**: 实现工具注册和管理

    - `initializeRegistry()`
    - `registerTool()` / `unregisterTool()`
    - `enableGroup()` / `disableGroup()`
    - `isToolAvailable()` / `getAvailableTools()`

4. **2.2.1.4**: 实现工具调用WASM桥接

    - `validateAndExecute()` - 主执行入口
    - `executeWasm()` - WASM执行路径
    - `executeFallback()` - TypeScript执行路径
    - 参数序列化/反序列化

5. **2.2.1.5**: 实现参数验证（使用safeWriteJson）

    - `validateToolParams()` - 参数校验
    - `syncRegistry()` - 状态持久化（⚠️必须使用safeWriteJson）
    - `loadRegistry()` - 状态加载

6. **2.2.1.6**: 实现错误处理与重试

    - `handleWasmError()` - 错误处理
    - 重试计数器
    - 自动Fallback切换
    - 日志记录

7. **2.2.1.7**: 创建ToolsAdapter单元测试
    - 注册表管理测试
    - 工具调用测试
    - Fallback机制测试
    - 重复检测测试
    - 状态持久化测试

### Phase 2.2.2: 集成到主流程

- 修改Task.ts集成ToolsAdapter
- 修改工具调用流程使用WASM
- 端到端测试

### Phase 2.2.3: 验证与优化

- 运行所有工具测试
- 性能基准测试
- Git提交

## 5. 测试策略

### 5.1 单元测试覆盖

- ✅ 注册表初始化（空/全量）
- ✅ 工具注册/注销
- ✅ 组启用/禁用
- ✅ 工具可用性检查
- ✅ 重复检测逻辑
- ✅ WASM调用成功
- ✅ WASM调用失败 → Fallback
- ✅
