# Task.ts 拆分验证清单

## 📋 每次拆分后必须完成的验证步骤

---

## 1. 编译验证

### 1.1 TypeScript 编译检查

```bash
# 进入 src 目录
cd src

# 完整编译检查
npm run build

# 或使用 tsc 直接检查
npx tsc --noEmit

# 预期结果：0 个错误
```

**常见编译错误及解决方案：**

| 错误类型                                 | 原因           | 解决方案                   |
| ---------------------------------------- | -------------- | -------------------------- |
| `Cannot find module`                     | 导入路径错误   | 检查相对路径，确保文件存在 |
| `Property does not exist`                | 类型定义不匹配 | 检查接口定义，确保属性存在 |
| `Type 'X' is not assignable to type 'Y'` | 类型不兼容     | 添加类型转换或修正类型定义 |
| `'this' implicitly has type 'any'`       | 上下文丢失     | 使用箭头函数或绑定 this    |

### 1.2 检查导出

```bash
# 确保新模块正确导出
cat src/core/task/[模块名]/index.ts

# 应该包含：
# export * from './ClassName'
# export type * from './types'
```

---

## 2. 测试验证

### 2.1 运行现有测试

```bash
# 运行所有测试
cd src
npx vitest run

# 运行特定测试文件
npx vitest run tests/task.test.ts

# 预期结果：所有测试通过
```

### 2.2 运行新模块测试

```bash
# 运行新模块的单元测试
npx vitest run core/task/[模块名]/*.test.ts

# 使用 watch 模式进行开发
npx vitest watch core/task/[模块名]/*.test.ts
```

### 2.3 测试覆盖率检查

```bash
# 生成覆盖率报告
npx vitest run --coverage

# 检查新模块的覆盖率
# 目标：每个模块至少 80% 覆盖率
```

---

## 3. 功能验证

### 3.1 手动测试清单

每次拆分后，在开发环境中测试以下功能：

#### 基础功能测试

- [ ] **创建新任务**

    ```
    1. 打开 VSCode
    2. 打开 Roo-Code 面板
    3. 输入任务描述
    4. 点击开始
    5. 验证任务正常启动
    ```

- [ ] **任务历史恢复**

    ```
    1. 从历史记录选择一个任务
    2. 点击恢复
    3. 验证消息历史正确加载
    4. 验证可以继续对话
    ```

- [ ] **工具执行**

    ```
    1. 让 AI 读取一个文件
    2. 让 AI 创建一个文件
    3. 让 AI 执行一个命令
    4. 验证工具正常执行
    ```

- [ ] **任务中止**
    ```
    1. 开始一个任务
    2. 在执行过程中点击中止
    3. 验证任务正确中止
    4. 验证资源正确释放
    ```

#### 针对特定模块的测试

**工具管理模块拆分后：**

- [ ] 工具使用统计正确显示
- [ ] 工具错误正确记录
- [ ] 多次使用同一工具统计累加正确

**资源管理模块拆分后：**

- [ ] 浏览器会话正常工作
- [ ] 终端进程正常创建和释放
- [ ] 文件追踪正常工作
- [ ] dispose 方法正确释放所有资源

**消息管理模块拆分后：**

- [ ] 消息正确保存到磁盘
- [ ] 消息历史正确加载
- [ ] 消息索引正确分配
- [ ] 防抖保存正常工作

**API 交互模块拆分后：**

- [ ] API 请求正常发送
- [ ] 流式响应正确处理
- [ ] 错误重试机制正常
- [ ] 上下文压缩正常触发

---

## 4. 性能验证

### 4.1 内存泄漏检查

```bash
# 使用 Node.js 内存分析工具
node --inspect-brk node_modules/.bin/vitest run

# 在 Chrome DevTools 中：
# 1. 打开 chrome://inspect
# 2. 点击 inspect
# 3. 进入 Memory 标签
# 4. 拍摄多个堆快照
# 5. 比较快照，查找内存泄漏
```

### 4.2 性能基准测试

创建性能测试文件：

```typescript
// src/core/task/[模块名]/performance.test.ts
import { describe, it, expect } from "vitest"
import { performance } from "perf_hooks"

describe("Performance Tests", () => {
	it("should handle 1000 messages efficiently", async () => {
		const start = performance.now()

		// 执行性能测试
		for (let i = 0; i < 1000; i++) {
			// 测试代码
		}

		const end = performance.now()
		const duration = end - start

		// 应该在合理时间内完成（例如 1 秒）
		expect(duration).toBeLessThan(1000)
	})
})
```

---

## 5. 代码质量检查

### 5.1 Lint 检查

```bash
# 运行 ESLint
npm run lint

# 自动修复可修复的问题
npm run lint:fix

# 预期结果：0 个错误，0 个警告
```

### 5.2 代码复杂度检查

```bash
# 安装复杂度分析工具（如果还没有）
npm install -g complexity-report

# 分析新模块
cr src/core/task/[模块名]/*.ts

# 目标：
# - 圈复杂度 < 10
# - 函数长度 < 50 行
```

### 5.3 依赖检查

```bash
# 检查循环依赖
npx madge --circular src/core/task/

# 预期结果：无循环依赖
```

---

## 6. 文档验证

### 6.1 代码文档检查清单

每个新模块应该包含：

- [ ] 文件顶部的模块说明注释
- [ ] 每个公共类的 JSDoc 注释
- [ ] 每个公共方法的 JSDoc 注释
- [ ] 复杂逻辑的行内注释

示例：

````typescript
/**
 * MessageManager 负责管理任务的所有消息
 * 包括 API 消息和 Cline 消息的存储、持久化和检索
 *
 * @example
 * ```typescript
 * const manager = new MessageManager(taskId, storagePath, providerRef)
 * await manager.initialize()
 * await manager.addClineMessage(message)
 * ```
 */
export class MessageManager {
	/**
	 * 添加新的 Cline 消息
	 *
	 * @param message - 要添加的消息
	 * @throws {Error} 如果保存失败
	 */
	async addClineMessage(message: ClineMessage): Promise<void> {
		// ...
	}
}
````

### 6.2 README 更新

在每个模块目录创建 README.md：

````markdown
# 模块名称

## 概述

简要说明模块的职责和功能

## 主要类

- `ClassName1`: 说明
- `ClassName2`: 说明

## 使用示例

\```typescript
// 代码示例
\```

## 测试

\```bash
npx vitest run core/task/[模块名]
\```
````

---

## 7. Git 提交检查

### 7.1 提交前检查清单

- [ ] 所有测试通过
- [ ] 编译无错误
- [ ] Lint 检查通过
- [ ] 代码已格式化
- [ ] 新文件已添加到 Git
- [ ] 提交信息清晰明确

### 7.2 提交信息格式

```
refactor(task): extract [模块名] from Task.ts

- Created [ClassName1] to handle [功能]
- Created [ClassName2] to handle [功能]
- Updated Task.ts to use new modules
- Added unit tests with X% coverage
- All existing tests still pass

BREAKING CHANGE: None (internal refactoring only)

Refs: #issue-number
```

---

## 8. 回归测试

### 8.1 端到端测试场景

在拆分完每个主要模块后，执行完整的端到端测试：

```bash
# 运行 E2E 测试（如果有）
npm run test:e2e
```

### 8.2 手动回归测试场景

#### 场景 1: 完整任务生命周期

```
1. 创建新任务："创建一个 hello world 程序"
2. 等待 AI 完成任务
3. 验证文件已创建
4. 中止任务
5. 从历史恢复任务
6. 继续对话
7. 再次中止任务
```

#### 场景 2: 复杂工具使用

```
1. 创建任务："分析项目中的所有 TypeScript 文件"
2. 验证 AI 使用 search_files
3. 验证 AI 使用 read_file
4. 验证 AI 使用 codebase_search
5. 验证结果正确
```

#### 场景 3: 错误恢复

```
1. 创建任务
2. 模拟网络错误（断开网络）
3. 验证错误处理
4. 重新连接网络
5. 验证任务可以重试
```

---

## 9. 性能对比

### 9.1 拆分前后对比

记录以下指标：

| 指标           | 拆分前 | 拆分后 | 变化 |
| -------------- | ------ | ------ | ---- |
| Task.ts 行数   | 4131   | ?      | ?    |
| 启动时间 (ms)  | ?      | ?      | ?    |
| 内存使用 (MB)  | ?      | ?      | ?    |
| 测试覆盖率 (%) | ?      | ?      | ?    |
| 编译时间 (s)   | ?      | ?      | ?    |

### 9.2 基准测试脚本

```typescript
// benchmark.ts
import { performance } from "perf_hooks"
import { Task } from "./core/task/Task"

async function benchmark() {
	const iterations = 100
	const times: number[] = []

	for (let i = 0; i < iterations; i++) {
		const start = performance.now()

		// 创建任务实例
		const task = new Task({
			// ... options
		})

		const end = performance.now()
		times.push(end - start)
	}

	const avg = times.reduce((a, b) => a + b, 0) / times.length
	const min = Math.min(...times)
	const max = Math.max(...times)

	console.log(`Average: ${avg.toFixed(2)}ms`)
	console.log(`Min: ${min.toFixed(2)}ms`)
	console.log(`Max: ${max.toFixed(2)}ms`)
}

benchmark()
```

---

## 10. 常见问题及解决方案

### 问题 1: 循环依赖

**症状**: 编译时出现 "Circular dependency detected"

**解决方案**:

```typescript
// ❌ 错误：直接导入会导致循环依赖
import { Task } from "../Task"

// ✅ 正确：使用类型导入
import type { Task } from "../Task"

// 或者通过接口解耦
import type { ITask } from "../interfaces"
```

### 问题 2: this 上下文丢失

**症状**: 运行时错误 "Cannot read property 'x' of undefined"

**解决方案**:

```typescript
// ❌ 错误：普通函数会丢失 this
class Manager {
	private data = []

	getData() {
		return this.data // 如果作为回调，this 会丢失
	}
}

// ✅ 正确：使用箭头函数
class Manager {
	private data = []

	getData = () => {
		return this.data
	}
}
```

### 问题 3: 事件监听器泄漏

**症状**: 内存持续增长，控制台警告 "MaxListenersExceededWarning"

**解决方案**:

```typescript
class Manager extends EventEmitter {
    private listener?:
```
