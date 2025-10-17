# WASM 生产环境部署指南

## 概述

本文档提供 Roo-Code WASM 运行时在生产环境中的部署、监控和故障排查指南。

## 🚀 部署准备

### 1. 构建生产版本

```bash
# 清理旧构建产物
pnpm clean

# 类型检查
pnpm check-types

# 构建 WASM 模块（生产优化）
cd rust-wasm
./build-all.sh --release

# 构建整个项目
cd ..
pnpm build

# 生成 VSIX 包
pnpm vsix
```

### 2. 验证构建产物

```bash
# 检查 WASM 文件大小（应该已优化）
ls -lh wasm-dist/*/*.wasm

# 预期大小：
# - task-engine: ~700-800 KB
# - api-integration: ~1.0-1.2 MB
# - tools: ~800-900 KB

# 检查 VSIX 包
ls -lh *.vsix
# 预期大小: ~25-30 MB
```

### 3. 默认配置（生产推荐）

```json
{
	"roo-cline.wasmRuntimeEnabled": true,
	"roo-cline.wasmFallbackEnabled": true,
	"roo-cline.wasmMaxRetries": 3
}
```

## 📊 性能监控

### 关键指标

| 指标            | 目标值  | 监控方法          |
| --------------- | ------- | ----------------- |
| WASM 初始化时间 | < 100ms | 启动日志          |
| WASM 执行成功率 | > 99%   | Fallback 触发率   |
| 内存占用        | < 200MB | VSCode 任务管理器 |
| Fallback 触发率 | < 1%    | 日志统计          |

### 日志监控

查看 VSCode 输出面板 > Roo-Code：

```
[WASM] Initialization time: 85ms ✅
[WASM] TaskAdapter success rate: 99.8% ✅
[Fallback] Triggered 2 times in last hour ✅
[Performance] Average execution time: 2.3ms (WASM) vs 0.8ms (TS)
```

## 🐛 故障排查

### 常见问题

**问题 1: WASM 加载失败**

```
解决方案:
1. 确认 wasm-dist/ 目录存在
2. 检查文件权限
3. 验证 VSCode 版本 >= 1.85.0
4. 启用 Fallback 确保功能可用
```

**问题 2: 性能下降**

```
解决方案:
1. 检查是否频繁触发 Fallback
2. 查看内存使用情况
3. 临时禁用 WASM 对比
4. 收集性能日志报告问题
```

**问题 3: 用户报告功能异常**

```
排查步骤:
1. 收集用户配置（Settings > WASM Runtime）
2. 检查 Fallback 是否启用
3. 查看错误日志
4. 临时切换到 TypeScript 模式验证
```

## 🔄 灰度发布策略

### 阶段 1: 内部测试 (0-1%)

```json
{
	"wasmRuntimeEnabled": true,
	"wasmFallbackEnabled": true,
	"maxRetries": 5
}
```

### 阶段 2: 早期采用者 (1-10%)

```json
{
	"wasmRuntimeEnabled": true,
	"wasmFallbackEnabled": true,
	"maxRetries": 3
}
```

### 阶段 3: 全量发布 (100%)

```json
{
	"wasmRuntimeEnabled": true,
	"wasmFallbackEnabled": true,
	"maxRetries": 3
}
```

## 📈 回滚策略

如果遇到严重问题，可以快速回滚：

### 方法 1: 禁用 WASM（用户端）

```
Settings > WASM Runtime > 取消勾选"启用 WASM 运行时"
```

### 方法 2: 默认配置（服务端）

```json
{
	"roo-cline.wasmRuntimeEnabled": false
}
```

## 🎯 成功标准

### Phase 7 完成标准

- ✅ 构建验证通过（check-types, build, vsix）
- ✅ 所有测试通过（137+ tests）
- ✅ 用户文档完整
- ✅ 开发者文档完整
- ✅ 生产部署指南完整
- ✅ WASM 运行时可配置
- ✅ Fallback 机制正常工作

---

**文档版本**: v1.0.0  
**最后更新**: 2025-10-17  
**适用版本**: Roo-Code v3.28.x+
