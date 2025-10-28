# Roo Code CLI 架构分析与设计方案

## 1. Kilo CLI 架构分析

### 1.1 核心架构组件

基于对 kilo CLI 的分析，其架构包含以下核心组件：

#### 1.1.1 CLI 主类 (CLI)

- **职责**: 应用生命周期管理
- **功能**:
    - 初始化 ExtensionService
    - 设置 Jotai 状态管理
    - 配置注入
    - 遥测服务管理
    - UI 渲染和销毁

#### 1.1.2 通信层 (IPC)

- **IPCChannel**: 单向消息通道
    - 支持 request/response 模式
    - 支持 event 模式（单向）
    - 超时管理
- **MessageBridge**: 双向消息桥接
    - TUI ↔ Extension Host 通信
    - 消息路由和转发

#### 1.1.3 配置系统

- **配置结构**:
    ```typescript
    interface CLIConfig {
    	version: string
    	mode: string
    	telemetry: boolean
    	provider: string
    	providers: ProviderConfig[]
    	autoApproval: AutoApprovalConfig
    	theme: ThemeId
    }
    ```
- **自动审批配置**: 细粒度控制
    - read, write, execute, browser, mcp, mode, subtasks, question, todo, retry

#### 1.1.4 状态管理 (Jotai)

- 原子化状态管理
- 核心 atoms:
    - extensionServiceAtom
    - configAtom
    - ciExitReasonAtom
    - approvalAtom
    - keyboardAtom

#### 1.1.5 UI 层 (Ink + React)

- 基于 Ink 的 TUI 框架
- React 组件化
- 主要组件:
    - App (根组件)
    - CommandInput
    - MessageDisplay
    - ApprovalMenu
    - StatusBar

#### 1.1.6 Extension Service

- 封装扩展主机
- 事件监听和处理
- 配置注入
- 生命周期管理

### 1.2 关键特性

#### 1.2.1 Autonomous 模式 (--auto)

- 非交互式运行
- 自动审批决策
- 超时支持
- 退出码管理:
    - 0: 成功
    - 124: 超时
    - 1: 错误

#### 1.2.2 命令系统

- Commander.js 命令解析
- 支持命令:
    - `kilocode` - 启动 TUI
    - `kilocode auth` - 认证向导
    - `kilocode config` - 打开配置文件

#### 1.2.3 配置管理

- JSON 配置文件
- 持久化存储
- 配置验证 (Ajv)
- 配置映射到 Extension State

## 2. Roo Code 现有架构评估

### 2.1 核心组件对比

| 组件      | Roo Code            | Kilo CLI           | 兼容性      |
| --------- | ------------------- | ------------------ | ----------- |
| Task 管理 | Task.ts             | ExtensionService   | ✅ 高度兼容 |
| 配置系统  | VSCode Settings     | JSON Config        | ⚠️ 需要映射 |
| 自动审批  | AutoApprovalHandler | AutoApprovalConfig | ✅ 直接复用 |
| 状态管理  | 无集中管理          | Jotai              | ⚠️ 需要新建 |
| UI        | Webview (React)     | Ink (React)        | ⚠️ 需要重写 |
| 通信      | Webview API         | IPC                | ⚠️ 需要适配 |

### 2.2 可复用的 Roo Code 组件

#### 2.2.1 核心业务逻辑

- ✅ **Task.ts**: 完整的任务管理逻辑
- ✅ **ApiHandler**: API 调用和流处理
- ✅ **Tool 系统**: 所有工具实现
- ✅ **AutoApprovalHandler**: 自动审批逻辑
- ✅ **Mode 系统**: 模式管理和切换

#### 2.2.2 配置和设置

- ✅ **ProviderSettings**: API 提供商配置
- ✅ **AutoApprove 配置**: 自动审批设置
- ✅ **Mode 定义**: 各种模式配置
- ⚠️ **VSCode Settings**: 需要映射到 CLI 配置

#### 2.2.3 辅助服务

- ✅ **TelemetryService**: 遥测服务
- ✅ **McpHub**: MCP 服务器管理
- ✅ **DiffViewProvider**: Diff 处理（需要适配）
- ✅ **TerminalRegistry**: 终端管理

### 2.3 需要新建的组件

#### 2.3.1 CLI 特有组件

- ❌ **CLI 主类**: 生命周期管理
- ❌ **IPC 通信层**: CLI ↔ Extension 通信
- ❌ **TUI 界面**: Ink 组件
- ❌ **配置持久化**: JSON 文件管理
- ❌ **状态管理**: Jotai atoms

#### 2.3.2 适配器层

- ❌ **VSCode API 适配器**: 模拟 VSCode API
- ❌ **Webview 消息适配器**: 转换为 IPC 消息
- ❌ **配置映射器**: VSCode Settings ↔ CLI Config

## 3. Roo Code CLI 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Entry                            │
│                     (cli/src/index.ts)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      CLI Main Class                          │
│  - Lifecycle Management                                      │
│  - Service Initialization                                    │
│  - Configuration Injection                                   │
└──────────────┬───────────────────────┬──────────────────────┘
               │                       │
               ▼                       ▼
┌──────────────────────┐   ┌──────────────────────┐
│   State Management   │   │   IPC Communication  │
│      (Jotai)         │   │   MessageBridge      │
└──────────┬───────────┘   └──────┬───────────────┘
           │                      │
           │                      │
           ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Extension Adapter                         │
│  - VSCode API Emulation                                      │
│  - Message Translation                                       │
│  - Configuration Mapping                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 Roo Code Core (Reused)                       │
│  - Task.ts                                                   │
│  - ApiHandler                                                │
│  - Tool System                                               │
│  - AutoApprovalHandler                                       │
│  - Mode System                                               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 目录结构

```
cli/
├── src/
│   ├── index.ts                 # CLI 入口
│   ├── cli.ts                   # CLI 主类
│   │
│   ├── adapter/                 # 适配器层
│   │   ├── vscode-api.ts       # VSCode API 模拟
│   │   ├── message-adapter.ts  # 消息转换
│   │   └── config-mapper.ts    # 配置映射
│   │
│   ├── communication/           # 通信层
│   │   ├── ipc.ts              # IPC 实现
│   │   └── bridge.ts           # 消息桥接
│   │
│   ├── config/                  # 配置系统
│   │   ├── types.ts            # 配置类型
│   │   ├── defaults.ts         # 默认配置
│   │   ├── persistence.ts      # 持久化
│   │   ├── validation.ts       # 验证
│   │   └── mapper.ts           # 映射逻辑
│   │
│   ├── state/                   # 状态管理
│   │   ├── atoms/              # Jotai atoms
│   │   │   ├── config.ts
│   │   │   ├── task.ts
│   │   │   ├── approval.ts
│   │   │   └── ci.ts
│   │   └── hooks/              # React hooks
│   │       ├── useTask.ts
│   │       ├── useApproval.ts
│   │       └── useConfig.ts
│   │
│   ├── ui/                      # TUI 界面
│   │   ├── App.tsx             # 根组件
│   │   ├── components/         # UI 组件
│   │   │   ├── CommandInput.tsx
│   │   │   ├── MessageDisplay.tsx
│   │   │   ├── ApprovalMenu.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── TaskList.tsx
│   │   └── utils/              # UI 工具
│   │
│   ├── services/               # 服务层
│   │   ├── extension.ts       # Extension Service
│   │   ├── telemetry.ts       # 遥测服务
│   │   └── approval.ts        # 审批决策
│   │
│   ├── commands/               # 命令系统
│   │   ├── registry.ts        # 命令注册
│   │   ├── parser.ts          # 命令解析
│   │   └── handlers/          # 命令处理器
│   │
│   ├── constants/              # 常量定义
│   │   ├── ci.ts
│   │   ├── modes.ts
│   │   └── themes.ts
│   │
│   └── utils/                  # 工具函数
│       ├── env-loader.ts
│       ├── auth.ts
│       └── paths.ts
│
├── __tests__/                   # 测试文件
│   ├── cli.test.ts
│   ├── ipc.test.ts
│   ├── config.test.ts
│   └── adapter.test.ts
│
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── README.md
```

### 3.3 核心接口设计

#### 3.3.1 CLI 主类接口

```typescript
interface CLIOptions {
	mode?: string
	workspace?: string
	ci?: boolean // autonomous mode
	prompt?: string
	timeout?: number
}

class RooCLI {
	async initialize(): Promise<void>
	async start(): Promise<void>
	async dispose(): Promise<void>
	getService(): ExtensionService
	getStore(): Store
	isReady(): boolean
}
```

#### 3.3.2 IPC 接口

```typescript
interface IPCMessage {
	id: string
	type: "request" | "response" | "event"
	data: any
	ts: number
}

class IPCChannel extends EventEmitter {
	async request<T>(data: any): Promise<T>
	respond(requestId: string, data: any): void
	event(data: any): void
	handleMessage(message: IPCMessage): void
}

class MessageBridge extends EventEmitter {
	getTUIChannel(): IPCChannel
	getExtensionChannel(): IPCChannel
	async sendWebviewMessage(message: WebviewMessage): Promise<any>
	async sendExtensionMessage(message: ExtensionMessage): Promise<void>
}
```

#### 3.3.3 配置接口

```typescript
interface RooCliConfig {
	version: "1.0.0"
	mode: string
	telemetry: boolean
	provider: string
	providers: ProviderConfig[]
	autoApproval: AutoApprovalConfig
	theme?: ThemeId
	// Roo Code 特有配置
	consecutiveMistakeLimit?: number
	diffEnabled?: boolean
	mcpEnabled?: boolean
}
```

## 4. 实施策略

### 4.1 开发阶段划分

#### 阶段 1: 基础架构 (Week 1-2)

- [ ] 创建
