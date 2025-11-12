# Task.ts 重构文档总览

本目录包含将 Task.ts (4131 行) 拆分为多个模块的完整重构方案。

---

## 📚 文档结构

### 1. [task-splitting-plan.md](./task-splitting-plan.md) - 总体规划

**内容概要**:

- 当前问题分析
- 拆分原则和目录结构
- 8 个主要模块的划分方案
- 详细的模块接口设计

**适合人员**: 架构师、技术负责人
**阅读时间**: 30-40 分钟

---

### 2. [implementation-guide.md](./implementation-guide.md) - 实施指南

**内容概要**:

- 推荐的拆分顺序（从简单到复杂）
- 每个模块的详细实施步骤
- 完整的代码示例
- 集成和测试方法

**适合人员**: 开发人员
**阅读时间**: 1-2 小时（分模块阅读）

---

### 3. [validation-checklist.md](./validation-checklist.md) - 验证清单

**内容概要**:

- 编译验证步骤
- 测试验证方法
- 性能对比指标
- 常见问题及解决方案

**适合人员**: 开发人员、QA
**阅读时间**: 20-30 分钟

---

## 🎯 快速开始

### 第一次阅读？从这里开始：

1. **了解全局** (30 分钟)

    - 阅读本 README
    - 浏览 `task-splitting-plan.md` 的"模块划分方案"部分

2. **开始实施** (1-2 小时准备)

    - 阅读 `implementation-guide.md` 的"模块 1: 工具管理模块"
    - 设置开发环境
    - 创建第一个模块

3. **验证工作** (30 分钟)
    - 按照 `validation-checklist.md` 验证第一个模块
    - 确保所有测试通过

---

## 📊 重构概览

### 当前状态

```
src/core/task/Task.ts
├── 4131 行代码
├── 职责过多
├── 难以测试
└── 难以维护
```

### 目标状态

```
src/core/task/
├── Task.ts (约 500 行) - 主入口
├── types.ts - 类型定义
├── interfaces.ts - 接口定义
│
├── lifecycle/ - 生命周期管理
├── messages/ - 消息管理
├── api/ - API 交互
├── state/ - 状态管理
├── tools/ - 工具管理
├── judge/ - 裁判模式
├── checkpoints/ - 检查点
└── resources/ - 资源管理
```

---

## 🗺️ 拆分路线图

### 时间线（预估 8-10 周）

```
Week 1: 准备工作
  ├── 创建目录结构
  ├── 提取类型定义
  └── 设置测试框架

Week 2-3: 工具管理模块 ⭐ (最简单)
  ├── ToolExecutionTracker
  └── 测试和集成

Week 3-4: 资源管理模块 ⭐⭐
  ├── ResourceManager
  ├── BrowserResourceManager
  ├── TerminalResourceManager
  └── 测试和集成

Week 4-5: 检查点管理模块 ⭐⭐
  └── CheckpointManager

Week 5-6: 裁判模式模块 ⭐⭐
  ├── TaskJudgeManager
  └── JudgeConfigProvider

Week 6-8: 消息管理模块 ⭐⭐⭐ (中等复杂)
  ├── MessageManager
  ├── ApiMessageStore
  ├── ClineMessageStore
  └── MessagePersistence

Week 8-9: 状态管理模块 ⭐⭐⭐
  ├── TaskStateManager
  ├── AskStateManager
  └── StreamStateManager

Week 9-11: API 交互模块 ⭐⭐⭐⭐ (高复杂度)
  ├── ApiRequestManager
  ├── StreamProcessor
  ├── ContextManager
  └── RetryStrategy

Week 11-13: 生命周期管理模块 ⭐⭐⭐⭐ (最核心)
  ├── TaskLifecycleManager
  ├── TaskInitializer
  └── SubtaskManager
```

---

## 📝 拆分原则

### 1. 单一职责原则 (SRP)

每个模块只负责一个明确的功能领域

### 2. 依赖倒置原则 (DIP)

高层模块不依赖低层模块，都依赖抽象

### 3. 开闭原则 (OCP)

对扩展开放，对修改关闭

### 4. 接口隔离原则 (ISP)

客户端不应依赖它不需要的接口

### 5. 渐进式重构

- 每次只拆分一个模块
- 确保每次拆分后编译通过
- 确保所有测试通过
- 保持向后兼容

---

## ✅ 验证标准

每个模块拆分完成后必须满足：

### 编译验证

- ✅ TypeScript 编译 0 错误
- ✅ 无循环依赖
- ✅ 所有导入路径正确

### 测试验证

- ✅ 所有现有测试通过
- ✅ 新模块单元测试覆盖率 > 80%
- ✅ 集成测试通过

### 功能验证

- ✅ 手动测试核心功能正常
- ✅ 无性能退化
- ✅ 无内存泄漏

### 代码质量

- ✅ Lint 检查通过
- ✅ 代码复杂度符合标准
- ✅ 文档完整

---

## 🎓 最佳实践

### 1. 先易后难

从最独立、依赖最少的模块开始拆分（工具管理 → 资源管理 → ...）

### 2. 保持兼容

在 Task.ts 中提供 getter/setter 保持 API 兼容

```typescript
// 示例：保持向后兼容
class Task {
	private toolTracker: ToolExecutionTracker

	// 提供 getter 保持兼容
	get toolUsage(): ToolUsage {
		return this.toolTracker.getToolUsage()
	}
}
```

### 3. 小步提交

每完成一个模块立即提交，不要等所有模块都完成

### 4. 充分测试

不要依赖"看起来正常"，必须通过自动化测试验证

### 5. 文档先行

先写接口文档，再实现代码

---

## 🚨 常见陷阱

### 陷阱 1: 过度拆分

**问题**: 创建太多小模块，反而增加复杂度
**解决**: 遵循本方案的 8 个模块划分，不要再细分

### 陷阱 2: 循环依赖

**问题**: 模块 A 依赖 B，B 又依赖 A
**解决**: 使用类型导入 (`import type`) 或提取共享接口

### 陷阱 3: 破坏封装

**问题**: 新模块暴露过多内部细节
**解决**: 只暴露必要的公共接口，其他都设为 private

### 陷阱 4: 忽视测试

**问题**: 拆分后没有充分测试，埋下隐患
**解决**: 严格遵循验证清单

---

## 📈 成功指标

重构完成后应达到：

| 指标             | 目标       | 说明                        |
| ---------------- | ---------- | --------------------------- |
| **Task.ts 行数** | < 600 行   | 从 4131 行减少到 600 行以下 |
| **模块数量**     | 8-10 个    | 合理的模块划分              |
| **测试覆盖率**   | > 80%      | 所有新模块                  |
| **圈复杂度**     | < 10       | 每个方法                    |
| **编译时间**     | 无明显增加 | 性能不退化                  |
| **启动时间**     | 无明显增加 | 性能不退化                  |

---

## 🔧 开发环境准备

### 必需工具

```bash
# Node.js 和 npm
node --version  # >= 16.x
npm --version   # >= 8.x

# TypeScript
npx tsc --version  # >= 4.x

# Vitest (测试框架)
npm install -D vitest

# ESLint (代码检查)
npm install -D eslint
```

### 推荐工具

```bash
# 依赖分析
npm install -g madge

# 复杂度分析
npm install -g complexity-report

# 性能分析
npm install -D clinic
```

---

## 📞 支持和反馈

### 遇到问题？

1. **检查文档**: 首先查看相关文档章节
2. **查看示例**: 参考 implementation-guide.md 中的代码示例
3. **运行测试**: 确保测试环境正常工作
4. **检查清单**: 使用 validation-checklist.md 排查问题

### 改进建议

如果您在实施过程中发现文档的不足或有改进建议，请：

1. 记录问题和建议
2. 提交改进 PR
3. 更新相关文档

---

## 📚 相关资源

### 内部文档

- `src/core/task/Task.ts` - 原始文件
- `src/core/task/Task.ts.bak` - 备份文件
- `docs/memory-leak-fix-plan.md` - 内存泄漏修复计划

### 外部资源

- [Clean Code](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
- [Refactoring: Improving the Design of Existing Code](https://martinfowler.com/books/refactoring.html)
- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)

---

## 📄 许可证

本重构方案遵循项目主许可证。

---

## 🎉 开始重构

准备好了吗？从这里开始：

1. **阅读** [task-splitting-plan.md](./task-splitting-plan.md) 了解全局
2. **实施** [implementation-guide.md](./implementation-guide.md) 的模块 1
3. **验证** 使用 [validation-checklist.md](./validation-checklist.md)

祝您重构顺利！🚀
