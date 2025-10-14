# Phase 2: 主项目集成与实战部署规划

**创建时间**: 2025-10-14  
**状态**: Phase 1完成，Phase 2规划中  
**目标**: 将Rust WASM模块集成到主项目，完成端到端验证

---

## 📋 当前状态总结

### ✅ Phase 1 已完成成果

1. **Rust WASM核心模块** (~7,121行代码，113+测试)

    - ✅ API Integration (1,894行，23测试) - WASM 18KB
    - ✅ Task Engine (~1,200行，~20测试) - 状态机完整
    - ✅ Tools System (1,150行，36测试) - WASM 95KB
    - ✅ Conversation (1,527行，38测试) - WASM 374KB
    - ✅ Memory System (~1,350行，16测试) - WASM 977KB

2. **WASM构建与优化**

    - ✅ 统一WASM模块：1.1MB（优化56%，目标<2MB）
    - ✅ TypeScript绑定：441行类型定义
    - ✅ 集成层：1,353行TypeScript代码
    - ✅ 24/24集成测试全部通过

3. **完整验收通过**
    - ✅ `pnpm check-types`: 11包通过（1m19s）
    - ✅ `pnpm clean`: 12任务成功（2.7s）
    - ✅ `pnpm build`: 5任务成功（2m27s）
    - ✅ `pnpm vsix`: 28.93MB VSIX（23.8s）
    - ✅ Git提交：3个主要提交完成

---

## 🎯 Phase 2 核心目标

**将Rust WASM模块深度集成到VSCode Extension主代码中，实现真正的跨平台非UI逻辑替换。**

### 关键原则

1. **渐进式集成**：先集成单个模块验证，再扩展到其他模块
2. **向后兼容**：保持现有TypeScript实现作为fallback
3. **性能优先**：WASM调用必须快于或等于TS实现
4. **测试驱动**：每个集成点都需要完整测试覆盖
5. **上下文控制**：每步操作控制在120K token内

---

## 🔧 Phase 2 详细任务分解

### 任务2.1: 评估与准备 (2-3天)

#### 2.1.1 创建适配器接口定义

**文件**: `src/core/wasm/adapters/interfaces.ts` (约200行)

```typescript
export interface WasmTaskAdapter {
	createTask(config: TaskConfig): Promise<string>
	executeTask(taskId: string, message: string): AsyncIterator<TaskEvent>
	pauseTask(taskId: string): Promise<void>
	resumeTask(taskId: string): Promise<void>
	abortTask(taskId: string): Promise<void>
}

export interface WasmApiAdapter {
	createMessage(system: string, messages: Message[], config: ProviderSettings): AsyncIterator<ApiStreamChunk>
}

export interface WasmToolsAdapter {
	registerTool(def: ToolDefinition): Promise<void>
	executeTool(name: string, params: any): Promise<ToolResult>
	validateParams(name: string, params: any): ValidationResult
}

export interface WasmMemoryAdapter {
	storeMessage(taskId: string, message: Message): Promise<void>
	searchMemories(query: string, limit: number): Promise<Memory[]>
	condenseContext(messages: Message[]): Promise<CondenedResult>
}
```

**交付物**:

- [ ] 接口定义文档（interfaces.ts）
- [ ] TypeScript ↔ Rust类型映射表
- [ ] 集成点识别清单

**验收标准**:

- 接口编译通过
- 所有必需方法已定义
- 类型兼容性验证通过

---

### 任务2.2: 实现Task适配器 (3-4天)

#### 2.2.1 创建TaskAdapter实现

**文件**: `src/core/wasm/adapters/TaskAdapter.ts` (约400行)

**核心功能**:

1. 任务创建与初始化
2. 消息流处理
3. 状态同步（TS ↔ WASM）
4. 错误处理与fallback

**关键代码**:

```typescript
export class WasmTaskAdapter implements IWasmTaskAdapter {
	private wasm: WasmLoader
	private host: HostInterface

	async createTask(config: TaskConfig): Promise<string> {
		await this.wasm.initialize()

		// 转换配置为WASM格式
		const wasmConfig = this.convertConfig(config)

		// 调用Rust WASM
		const taskId = await this.wasm.getModule().task_create(JSON.stringify(wasmConfig))

		return taskId
	}

	async *executeTask(taskId: string, message: string) {
		const streamHandle = await this.wasm.getModule().task_execute(taskId, message, this.host.getCallbacks())

		// 转换WASM事件为TS事件
		for await (const wasmEvent of this.pollWasmStream(streamHandle)) {
			yield this.convertEvent(wasmEvent)
		}
	}

	private async *pollWasmStream(handle: number) {
		while (true) {
			const event = await this.wasm.getModule().stream_next(handle)
			if (!event) break
			yield JSON.parse(event)
		}
	}
}
```

#### 2.2.2 集成到Task.ts

**文件**: `src/core/task/Task.ts`

**修改点**:

1. 添加`useWasm`配置选项
2. 在constructor中初始化WasmTaskAdapter
3. 修改`recursivelyMakeClineRequests()`支持WASM路径
4. 保留原有TS实现作为fallback

```typescript
export class Task extends EventEmitter<TaskEvents> {
	private useWasm: boolean
	private wasmAdapter?: WasmTaskAdapter

	constructor(options: TaskOptions) {
		// ... 现有代码

		this.useWasm =
			options.enableWasm ?? vscode.workspace.getConfiguration("roo-cline").get("experimentalWasmMode", false)

		if (this.useWasm) {
			this.wasmAdapter = new WasmTaskAdapter(this.providerRef.deref()!)
		}
	}

	async recursivelyMakeClineRequests(userContent: Anthropic.Messages.ContentBlockParam[]): Promise<boolean> {
		if (this.useWasm && this.wasmAdapter) {
			return this.wasmExecutionPath(userContent)
		}

		// 原有TypeScript实现（fallback）
		return this.typescriptExecutionPath(userContent)
	}

	private async wasmExecutionPath(userContent: Anthropic.Messages.ContentBlockParam[]): Promise<boolean> {
		try {
			for await (const event of this.wasmAdapter!.executeTask(this.taskId, JSON.stringify(userContent))) {
				await this.handleWasmEvent(event)
			}
			return true
		} catch (error) {
			console.error("[Task] WASM execution failed, falling back to TS:", error)
			// Fallback到TS实现
			this.useWasm = false
			return this.typescriptExecutionPath(userContent)
		}
	}
}
```

#### 2.2.3 添加配置选项

**文件**: `src/package.json`

```json
{
	"contributes": {
		"configuration": {
			"properties": {
				"roo-cline.experimentalWasmMode": {
					"type": "boolean",
					"default": false,
					"description": "Enable experimental Rust WASM mode for task execution (faster, cross-platform)"
				}
			}
		}
	}
}
```

**交付物**:

- [ ] TaskAdapter完整实现
- [ ] Task.ts集成修改
- [ ] 配置选项添加
- [ ] 单元测试（>80%覆盖率）

**验收标准**:

- Task能通过WASM创建并执行
- 所有测试通过（包括现有TS测试）
- Fallback机制正常工作
- 性能对比数据生成

---

### 任务2.3: 工具系统集成 (2-3天)

#### 2.3.1 创建ToolsAdapter

**文件**: `src/core/wasm/adapters/ToolsAdapter.ts` (约300行)

```typescript
export class WasmToolsAdapter {
	private registeredTools = new Map<string, ToolDefinition>()

	async registerTool(def: ToolDefinition): Promise<void> {
		this.registeredTools.set(def.name, def)

		await this.wasm.getModule().tools_register(def.name, JSON.stringify(def.schema))
	}

	async executeTool(name: string, params: any): Promise<ToolResult> {
		// 验证参数
		const validation = await this.validateParams(name, params)
		if (!validation.valid) {
			throw new Error(`Invalid params: ${validation.errors.join(", ")}`)
		}

		// 执行工具（通过Host Interface回调）
		const result = await this.wasm.getModule().tools_execute(name, JSON.stringify(params), this.host.getCallbacks())

		return JSON.parse(result)
	}
}
```

#### 2.3.2 集成现有工具

**修改**: `src/core/tools/*.ts` 中的每个工具

**示例** - `read_file` 工具集成:

```typescript
// src/core/tools/readFileTool.ts
export async function executeReadFile(params: ReadFileParams, host: HostInterface): Promise<ToolResult> {
	if (USE_WASM) {
		return wasmToolsAdapter.executeTool("read_file", params)
	}

	// 原有TypeScript实现
	// ...
}
```

**交付物**:

- [ ] ToolsAdapter实现
- [ ] 20+工具的WASM集成
- [ ] 工具执行测试套件

**验收标准**:

- 所有工具通过WASM执行成功
- 参数验证正确
- Host Interface回调正常
- 错误处理完善

---

### 任务2.4: API集成与Provider支持 (3-4天)

#### 2.4.1 实现ApiAdapter

**文件**: `src/core/wasm/adapters/ApiAdapter.ts` (约350行)

```typescript
export class WasmApiAdapter {
	async *createMessage(system: string, messages: Message[], config: ProviderSettings): AsyncIterator<ApiStreamChunk> {
		// 初始化Provider配置
		const providerConfig = this.convertProviderConfig(config)

		// 创建流式请求
		const streamHandle = await this.wasm
			.getModule()
			.api_create_message(system, JSON.stringify(messages), JSON.stringify(providerConfig))

		// 轮询WASM流
		while (true) {
			const chunk = await this.wasm.getModule().api_stream_next(streamHandle)
			if (!chunk) break

			const parsed = JSON.parse(chunk)
			yield this.convertChunk(parsed)
		}

		// 清理流
		await this.wasm.getModule().api_stream_close(streamHandle)
	}

	private convertProviderConfig(config: ProviderSettings): any {
		// 转换42个Provider的配置格式
		return {
			provider: config.apiProvider,
			api_key: config.apiKey,
			base_url: config.apiBaseUrl,
			model_id: config.apiModelId,
			// ... 其他配置
		}
	}
}
```

#### 2.4.2 集成到buildApiHandler

**文件**: `src/api/index.ts`

```typescript
export function buildApiHandler(configuration: ProviderSettings): ApiHandler {
	// 检查是否启用WASM
	const useWasm = vscode.workspace.getConfiguration("roo-cline").get("experimentalWasmMode", false)

	if (useWasm) {
		return new WasmApiHandler(configuration)
	}

	// 原有Provider逻辑
	const { apiProvider, ...options } = configuration
	switch (apiProvider) {
		case "anthropic":
			return new AnthropicHandler(options)
		// ... 其他42个Provider
	}
}
```

**交付物**:

- [ ] ApiAdapter实现
- [ ] 42个Provider的WASM支持
- [ ] 流式响应测试
- [ ] Token计数验证

**验收标准**:

- 至少5个主要Provider（Anthropic, OpenAI, Gemini, Ollama, DeepSeek）通过WASM工作
- 流式响应延迟<50ms
- Token计数准确率>99%
- 错误处理覆盖所有边缘情况

---

### 任务2.5: 对话与记忆集成 (2-3天)

#### 2.5.1 实现ConversationAdapter

**文件**: `src/core/wasm/adapters/ConversationAdapter.ts` (约250行)

```typescript
export class WasmConversationAdapter {
  async storeMessage(
    taskId: string,
    message: ClineMessage
  ): Promise<void> {
    await this.wasm.getModule().conversation_store_message(
      taskId,
      JSON.stringify(message)
    )
  }

  async getHistory(taskId: string): Promise<ClineMessage[]> {
    const result = await this.wasm.getModule().conversation_get_history(
      taskId
    )
    return JSON.parse(result)
  }

  async condenseContext(taskId: string): Promise<CondenseResult> {

```
