# VSCode配置同步文档

## 概述

Web版Roo-Code通过API自动读取VSCode插件的配置，实现无缝配置同步。

## 架构设计

```
VSCode端                     Web端
  │                           │
  ├─ 配置存储                 ├─ VSCodeSyncClient
  │  ~/.vscode-server/...     │  (轮询/WebSocket)
  │                           │
  └─ 本地API服务器 ──────────▶ └─ /api/vscode-config
     (src/api/localServer.ts)     (读取并返回配置)
```

## 功能特性

### 1. 自动配置读取

- 从VSCode全局存储读取配置
- 支持customModes、mcpSettings、taskHistory等
- 无需用户手动配置

### 2. 实时同步

- Web端定时轮询（默认30秒）
- 配置变更自动应用

### 3. 离线支持

- 本地LocalStorage缓存
- 离线时使用缓存配置

## API端点

### GET /api/vscode-config

读取VSCode配置

**响应示例：**

```json
{
  "success": true,
  "data": {
    "config": {
      "customModes": "...",
      "mcpSettings": {...},
      "taskHistory": [...]
    },
    "storagePath": "/home/user/.vscode-server/...",
    "hasConfig": true
  }
}
```

## 使用方法

### Web端集成

```typescript
import { VSCodeSyncClient } from "@/lib/vscode-sync-client"

const client = new VSCodeSyncClient({
	apiEndpoint: "http://localhost:3000",
	pollInterval: 30000,
})

client.startPolling((config) => {
	console.log("配置已更新:", config)
})
```

## 配置文件位置

- **Linux/Mac**: `~/.vscode-server/data/User/globalStorage/rooveterinaryinc.roo-cline`
- **Windows**: `%USERPROFILE%\.vscode-server\data\User\globalStorage\rooveterinaryinc.roo-cline`

## 安全考虑

1. **API认证**: 生产环境应添加认证
2. **敏感数据**: API Keys应加密传输
3. **CORS配置**: 限制访问来源
