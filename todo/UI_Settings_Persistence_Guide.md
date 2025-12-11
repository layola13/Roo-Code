# UI 设置持久化完整指南

**创建日期**: 2025-12-11
**适用范围**: Roo-Code 扩展中的所有 UI 设置

---

## 🔑 核心概念

在 Roo-Code 中，UI 设置的持久化涉及 **4 个关键层**，缺少任何一层都会导致设置无法正确保存或恢复。

```
┌─────────────────────────────────────────────────────────────┐
│                    Webview (React UI)                       │
│  用户点击设置 → 发送 WebviewMessage                           │
└──────────────────────────┬──────────────────────────────────┘
                           │ postMessage({ type: "settingName", ... })
                           ▼
┌─────────────────────────────────────────────────────────────┐
│            webviewMessageHandler.ts                         │
│  case "settingName": → updateGlobalState("settingName", ...)│
└──────────────────────────┬──────────────────────────────────┘
                           │ 保存到 VSCode GlobalState
                           ▼
┌─────────────────────────────────────────────────────────────┐
│            @roo-code/types/global-settings.ts               │
│  globalSettingsSchema = z.object({ settingName: ..., })     │
└──────────────────────────┬──────────────────────────────────┘
                           │ 类型定义
                           ▼
┌─────────────────────────────────────────────────────────────┐
│            ClineProvider.ts                                 │
│  getState() / getStateToPostToWebview()                     │
│  → 返回设置给 Webview 用于 UI 回显                            │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ 添加新 UI 设置的完整步骤

### Step 1: 定义消息类型 (`src/shared/WebviewMessage.ts`)

```typescript
export interface WebviewMessage {
	type: "existingSetting" | "myNewSetting" // ✅ 添加新的消息类型
	// ...
	bool?: boolean // 如果是布尔设置
	value?: number // 如果是数值设置
	text?: string // 如果是字符串设置
}
```

### Step 2: 定义类型 Schema (`packages/types/src/global-settings.ts`)

```typescript
export const globalSettingsSchema = z.object({
	// ... 其他设置
	myNewSetting: z.boolean().optional(), // ✅ 添加类型定义
})
```

> ⚠️ **重要**: 修改后需要运行 `npm run build` 重新构建 types 包！

### Step 3: 添加消息处理器 (`src/core/webview/webviewMessageHandler.ts`)

```typescript
case "myNewSetting":
  await updateGlobalState("myNewSetting", message.bool)
  await provider.postStateToWebview()
  break
```

### Step 4: 添加到 getState() 返回值 (`src/core/webview/ClineProvider.ts`)

在 `getState()` 方法的返回对象中添加：

```typescript
async getState() {
  const stateValues = this.contextProxy.getValues()
  return {
    // ... 其他设置
    myNewSetting: stateValues.myNewSetting ?? false,  // ✅ 添加默认值
  }
}
```

### Step 5: 添加到 getStateToPostToWebview() (`src/core/webview/ClineProvider.ts`)

首先在解构中添加：

```typescript
const {
	// ... 其他设置
	myNewSetting, // ✅ 从 getState() 解构
} = await this.getState()
```

然后在返回对象中添加：

```typescript
return {
	// ... 其他设置
	myNewSetting: myNewSetting ?? false, // ✅ 返回给 Webview
}
```

### Step 6: 添加到 ExtensionState 类型 (`src/shared/ExtensionMessage.ts`)

```typescript
export type ExtensionState = Pick<
	GlobalSettings,
	"existingSetting" | "myNewSetting" // ✅ 添加到 Pick 类型
> & {
	// ...
}
```

---

## 🔴 常见错误与诊断

### 问题 1: 设置保存了但 UI 不回显

**原因**: 设置未在 `getStateToPostToWebview()` 中返回
**诊断**: 检查 `ClineProvider.ts` 的 `getStateToPostToWebview()` 返回值

### 问题 2: 重启扩展后设置丢失

**原因**:

- 消息处理器未调用 `updateGlobalState()`
- 或 `globalSettingsSchema` 中缺少类型定义

**诊断**: 检查 `webviewMessageHandler.ts` 中是否有对应的 `case`

### 问题 3: TypeScript 类型错误

**原因**: `@roo-code/types` 包未重新构建
**解决**: 运行 `cd packages/types && npm run build`

---

## 📋 本次修复的设置

### GSW Memory System 设置

| 设置名       | 消息类型                | 存储键                  | 默认值      |
| ------------ | ----------------------- | ----------------------- | ----------- |
| GSW 开关     | `gswMemoryEnabled`      | `gswMemoryEnabled`      | `true`      |
| 最大文件大小 | `gswMaxFileSizeKB`      | `gswMaxFileSizeKB`      | `50`        |
| 归档天数     | `gswArchiveAfterDays`   | `gswArchiveAfterDays`   | `30`        |
| 自动轮换     | `gswEnableAutoRotation` | `gswEnableAutoRotation` | `true`      |
| LLM 模型配置 | `gswModelConfigId`      | `gswModelConfigId`      | `undefined` |

### Split File 设置

| 设置名              | 消息类型                 | 存储键                   | 默认值  |
| ------------------- | ------------------------ | ------------------------ | ------- |
| 自动批准 Split File | `alwaysAllowSplitFile`   | `alwaysAllowSplitFile`   | `false` |
| 每块行数            | `splitFileLinesPerChunk` | `splitFileLinesPerChunk` | `100`   |
| 重叠行数            | `splitFileOverlapLines`  | `splitFileOverlapLines`  | `0`     |

### Judge 设置 (⚠️ 特殊 - ProviderSettings)

**注意**: Judge 设置属于 `ProviderSettings`（每个 API 配置独立保存），而非 `GlobalSettings`。

| 设置名       | 消息类型                 | 存储位置 | 默认值      |
| ------------ | ------------------------ | -------- | ----------- |
| 启用裁判     | `judgeEnabled`           | API 配置 | `undefined` |
| 裁判模式     | `judgeMode`              | API 配置 | `undefined` |
| 详细程度     | `judgeDetailLevel`       | API 配置 | `undefined` |
| 允许用户覆盖 | `judgeAllowUserOverride` | API 配置 | `undefined` |
| 裁判模型配置 | `judgeModelConfigId`     | API 配置 | `undefined` |

---

## ⚠️ 重要：GlobalSettings vs ProviderSettings

### GlobalSettings (全局设置)

- 使用 `updateGlobalState()` 保存
- 所有 API 配置共享
- 示例：`gswMemoryEnabled`, `alwaysAllowSplitFile`, `soundEnabled`

### ProviderSettings (提供商设置 / API 配置)

- 使用 `providerSettingsManager.saveConfig()` 保存
- 每个 API 配置独立保存
- 示例：`judgeEnabled`, `judgeMode`, `apiKey`, `modelId`

**处理 ProviderSettings 的正确方式**:

```typescript
case "judgeEnabled": {
    const { apiConfiguration, currentApiConfigName } = await provider.getState()
    if (currentApiConfigName && apiConfiguration) {
        const updatedConfig = { ...apiConfiguration, judgeEnabled: message.bool }
        await provider.providerSettingsManager.saveConfig(currentApiConfigName, updatedConfig)
        await provider.postStateToWebview()
    }
    break
}
```

---

## 🛠️ 修改的文件清单

1. **`packages/types/src/global-settings.ts`**

    - 添加 `gswModelConfigId` 到 schema

2. **`src/shared/ExtensionMessage.ts`**

    - 添加 `gswModelConfigId` 到 `ExtensionState` 类型

3. **`src/shared/WebviewMessage.ts`**

    - 消息类型已存在，无需修改

4. **`src/core/webview/webviewMessageHandler.ts`**

    - 添加 `gswModelConfigId` 处理器
    - 添加 `alwaysAllowSplitFile` 处理器

5. **`src/core/webview/ClineProvider.ts`**
    - `getState()`: 添加 GSW 和 Split File 设置返回
    - `getStateToPostToWebview()`: 添加 GSW 和 Split File 设置返回

---

## ✅ 验证设置持久化

1. 在 UI 中修改设置
2. 重启 VSCode / 重新加载扩展
3. 检查设置是否恢复

如果设置未恢复，按照以下顺序排查：

1. 检查消息处理器是否存在
2. 检查 `getState()` 是否返回该设置
3. 检查 `getStateToPostToWebview()` 是否返回该设置
4. 检查 `ExtensionState` 类型是否包含该设置
