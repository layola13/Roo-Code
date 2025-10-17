# WASM 运行时切换指南

## 📋 概述

Roo-Code 现在支持在 **WebAssembly (WASM)** 和 **TypeScript** 运行时之间灵活切换，让您能够根据需求选择最佳的执行模式。

## 🎯 什么时候使用 WASM？

### ✅ 推荐使用 WASM 的场景：

- **生产环境**：需要最佳性能和稳定性
- **大型项目**：处理大量任务、对话或工具调用
- **性能优先**：计算密集型操作（虽然简单操作可能稍慢）
- **资源受限**：内存和 CPU 使用优化

### ❌ 不推荐使用 WASM 的场景：

- **开发调试**：需要直接调试 TypeScript 代码
- **WASM 兼容性问题**：某些环境可能不支持 WASM
- **快速迭代**：频繁修改核心逻辑

## 🔧 配置方式

### 方式 1: VS Code UI 设置（推荐）

1. 打开 VS Code 设置：`Ctrl/Cmd + ,`
2. 搜索 `roo-cline.wasm`
3. 配置以下选项：

#### 🎛️ 可用设置

| 设置项              | 类型    | 默认值 | 说明                                |
| ------------------- | ------- | ------ | ----------------------------------- |
| **Enable WASM**     | boolean | `true` | 启用 WASM 运行时                    |
| **Enable Fallback** | boolean | `true` | WASM 失败时自动降级到 TypeScript    |
| **Max Retries**     | number  | `3`    | 触发降级前允许的最大错误次数 (0-10) |

### 方式 2: 环境变量

```bash
# 完全禁用 WASM（使用 TypeScript）
export ROO_WASM_MODE=typescript

# WASM 专用模式（禁用 Fallback，用于测试）
export ROO_WASM_MODE=wasm-only

# 默认模式（WASM + Fallback）
unset ROO_WASM_MODE
```

### 方式 3: 程序化配置

```typescript
import { WasmConfigManager } from "./src/core/wasm/config"

const configManager = WasmConfigManager.getInstance()

// 切换到 TypeScript 模式
configManager.switchToTypeScript()

// 切换到 WASM 模式
configManager.switchToWasm()

// 自定义配置
configManager.updateConfig({
	enableWasm: true,
	enableFallback: true,
	maxRetries: 5,
})
```

## 📊 运行模式对比

### 🚀 模式 1: WASM + Fallback（默认，推荐）

```json
{
	"roo-cline.wasm.enableWasm": true,
	"roo-cline.wasm.enableFallback": true,
	"roo-cline.wasm.maxRetries": 3
}
```

**特点**：

- ✅ 优先使用 WASM 获得最佳性能
- ✅ WASM 失败时自动降级到 TypeScript
- ✅ 生产环境最佳选择
- ⚠️ 3 次错误后自动切换到 TypeScript

**适用场景**：

- 生产环境部署
- 不确定 WASM 兼容性时
- 需要最大容错能力

---

### 💻 模式 2: TypeScript Only（开发/调试）

```json
{
	"roo-cline.wasm.enableWasm": false,
	"roo-cline.wasm.enableFallback": true
}
```

**特点**：

- ✅ 直接使用 TypeScript 实现
- ✅ 可以直接调试源码
- ✅ 无 WASM 初始化开销
- ❌ 性能可能不如 WASM（复杂操作）

**适用场景**：

- 开发和调试
- WASM 不可用的环境
- 快速原型开发

---

### 🔬 模式 3: WASM Only（测试）

```json
{
	"roo-cline.wasm.enableWasm": true,
	"roo-cline.wasm.enableFallback": false
}
```

**特点**：

- ✅ 强制使用 WASM
- ✅ 可以发现 WASM 兼容性问题
- ❌ WASM 失败时直接报错
- ⚠️ 不推荐生产环境使用

**适用场景**：

- WASM 功能测试
- 性能基准测试
- 确保 WASM 正常工作

## 🔄 Fallback 机制工作原理

### 触发条件

Fallback 机制会在以下情况自动激活：

1. **构造函数阶段**：

    ```typescript
    // WASM 初始化失败 → 立即切换到 Fallback
    try {
    	this.wasmTask = new WasmTask()
    } catch (error) {
    	this.fallbackMode = true // ✅ 自动降级
    }
    ```

2. **运行时阶段**：

    ```typescript
    // 错误累积达到阈值 → 自动降级
    if (this.errorCount >= this.config.maxRetries) {
    	this.fallbackMode = true // ✅ 自动降级
    	this.log("warn", "Switching to fallback mode")
    }
    ```

3. **手动触发**：
    ```typescript
    // enableWasm: false → 直接使用 Fallback
    const adapter = new TaskAdapter(taskId, mode, hostInterface, {
    	enableWasm: false, // ✅ 强制 Fallback
    })
    ```

### Fallback 状态检查

```typescript
const adapter = new TaskAdapter(...)

// 检查当前运行模式
if (adapter.isFallbackMode()) {
  console.log("使用 TypeScript 模式")
} else {
  console.log("使用 WASM 模式")
}

// 获取错误计数
const errorCount = adapter.getErrorCount()
console.log(`WASM 错误次数: ${errorCount}`)

// 重置错误计数（如果需要）
adapter.resetErrorCount()
```

## 📈 性能对比

根据 [`wasm-adapters.benchmark.ts`](../src/core/wasm/__tests__/performance/wasm-adapters.benchmark.ts) 的测试结果：

| Adapter     | Mode          | Mean Time (ms) | Throughput (ops/s) | 场景     |
| ----------- | ------------- | -------------- | ------------------ | -------- |
| TaskAdapter | WASM          | 0.03           | 36,730             | 简单操作 |
| TaskAdapter | Fallback (TS) | 0.00           | 353,114            | 简单操作 |
| TaskAdapter | WASM          | ?              | ?                  | 复杂计算 |
| TaskAdapter | Fallback (TS) | ?              | ?                  | 复杂计算 |

**关键发现**：

- ✅ **简单操作**：TypeScript 比 WASM 快 **9.6x**（FFI 开销）
- ✅ **复杂计算**：WASM 预期更快（尚未测试）
- ⚠️ **选择建议**：根据实际工作负载选择模式

## 🛠️ 实际使用案例

### 案例 1: 生产环境配置

```json
{
	"roo-cline.wasm.enableWasm": true,
	"roo-cline.wasm.enableFallback": true,
	"roo-cline.wasm.maxRetries": 3
}
```

**理由**：

- 默认使用 WASM 获得最佳性能
- 遇到问题时自动降级，保证服务可用性
- 3 次重试提供合理的容错窗口

---

### 案例 2: 开发环境配置

```json
{
	"roo-cline.wasm.enableWasm": false,
	"roo-cline.wasm.enableFallback": true
}
```

**理由**：

- 直接使用 TypeScript，方便调试
- 无需等待 WASM 初始化
- 可以使用 VS Code 断点调试

---

### 案例 3: CI/CD 测试配置

```json
{
	"roo-cline.wasm.enableWasm": true,
	"roo-cline.wasm.enableFallback": false,
	"roo-cline.wasm.maxRetries": 0
}
```

**理由**：

- 强制使用 WASM，确保 WASM 功能正常
- 禁用 Fallback，及时发现 WASM 问题
- 适用于自动化测试环境

---

### 案例 4: 性能优化配置

```json
{
	"roo-cline.wasm.enableWasm": true,
	"roo-cline.wasm.enableFallback": true,
	"roo-cline.wasm.maxRetries": 1
}
```

**理由**：

- 启用 WASM 以获得最佳性能
- 快速失败（1 次重试）避免性能损失
- 适用于对性能敏感的场景

## 🐛 故障排查

### 问题 1: WASM 初始化失败

**症状**：

```
[TaskAdapter] WASM error during initialization: ...
[TaskAdapter] Using fallback mode for task: ...
```

**解决方案**：

1. 检查 WASM 文件是否存在：`wasm-dist/roo_core_wasm.wasm`
2. 确认浏览器/Node.js 版本支持 WASM
3. 临时禁用 WASM：`"roo-cline.wasm.enableWasm": false`

---

### 问题 2: 频繁切换到 Fallback

**症状**：

```
[TaskAdapter] WASM error during start: ... (count: 3)
[TaskAdapter] Switching to fallback mode for task: ...
```

**解决方案**：

1. 增加重试次数：`"roo-cline.wasm.maxRetries": 10`
2. 检查 WASM 日志找到根本原因
3. 如果是 WASM Bug，报告给开发团队

---

### 问题 3: 性能不如预期

**症状**：

- WASM 模式下操作变慢

**解决方案**：

1. 运行性能基准测试：
    ```bash
    cd src && npx tsx core/wasm/__tests__/performance/wasm-adapters.benchmark.ts
    ```
2. 对比 WASM 和 Fallback 的性能
3. 根据工作负载选择合适模式

## 📚 相关文档

- [WASM 架构设计](./46-rust-wasm-technical-specifications.md)
- [WASM 迁移完成报告](./78-rust-wasm-migration-completion-report.md)
- [性能基准测试](../src/core/wasm/__tests__/performance/wasm-adapters.benchmark.ts)
- [配置管理源码](../src/core/wasm/config.ts)

## 🎓 最佳实践

1. **生产环境**：始终启用 Fallback 机制
2. **开发环境**：根据需要选择 WASM 或 TypeScript
3. **测试环境**：使用 WASM-only 模式验证功能
4. **监控日志**：定期检查 Fallback 触发频率
5. **性能测试**：定期运行基准测试确认性能
6. **版本控制**：将配置添加到 `.vscode/settings.json`

## 🔮 未来计划

- [ ] 动态性能分析和自动模式选择
- [ ] WASM 模块热重载
- [ ] 更细粒度的模块级别切换
- [ ] 性能监控仪表板
- [ ] A/B 测试框架

---

**版本**: 1.0.0  
**最后更新**: 2025-10-17  
**作者**: Roo-Code Team
