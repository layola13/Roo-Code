# Phase 2 立即行动计划

**创建时间**: 2025-10-14  
**执行周期**: 2-3周  
**当前状态**: Phase 1完成，准备启动Phase 2

---

## 🎯 Phase 2 总体目标

**将Rust WASM核心模块（1.1MB）深度集成到VSCode Extension主项目中，实现端到端的任务执行验证。**

---

## 📊 Phase 1 → Phase 2 过渡总结

### ✅ Phase 1 交付成果（已完成）

| 模块            | 代码量       | 测试数     | WASM大小  | 状态 |
| --------------- | ------------ | ---------- | --------- | ---- |
| API Integration | 1,894行      | 23个       | 18KB      | ✅   |
| Task Engine     | ~1,200行     | ~20个      | -         | ✅   |
| Tools System    | 1,150行      | 36个       | 95KB      | ✅   |
| Conversation    | 1,527行      | 38个       | 374KB     | ✅   |
| Memory System   | ~1,350行     | 16个       | 977KB     | ✅   |
| **总计**        | **~7,121行** | **113+个** | **1.1MB** | ✅   |

**集成层**: 1,353行TypeScript + 441行类型定义  
**测试覆盖**: 24/24集成测试通过  
**构建验收**: check-types, clean, build, vsix全部通过

### 🚧 Phase 2 集成挑战

1. **TypeScript ↔ Rust数据转换**

    - 42个API Provider配置格式统一
    - ClineMessage ↔ Rust消息结构映射
    - 工具参数序列化/反序列化

2. **Host Interface实现**

    - 文件系统回调（必须使用`safeWriteJson`）
    - 终端操作回调
    - UI交互回调
    - 向量数据库回调

3. **流式处理集成**

    - WASM流 → TypeScript AsyncIterator转换
    - 事件轮询机制
    - 背压控制（backpressure）

4. **性能优化**
    - WASM调用开销控制
    - 序列化/反序列化优化
    - 内存管理（避免泄漏）

---

## 📅 Phase 2 执行计划（3周）

### Week 1: 适配器层实现（2.1-2.2）

#### Day 1-2: 接口定义与准备

- [ ] 创建`src/core/wasm/adapters/interfaces.ts`
- [ ] 定义TaskAdapter, ApiAdapter, ToolsAdapter, MemoryAdapter接口
- [ ] 创建TypeScript ↔ Rust类型映射文档
- [ ] 设计错误处理策略

**交付物**: 接口定义文件 + 类型映射文档

#### Day 3-5: TaskAdapter实现

- [ ] 实现`WasmTaskAdapter`类（~400行）
- [ ] 任务创建、执行、暂停、恢复、中止方法
- [ ] WASM事件流 → TS事件转换
- [ ] 编写单元测试（>80%覆盖率）

**交付物**: TaskAdapter实现 + 测试套件

#### Day 6-7: Task.ts集成

- [ ] 在`Task.ts`添加WASM模式开关
- [ ] 修改`recursivelyMakeClineRequests()`支持WASM路径
- [ ] 实现fallback机制
- [ ] 添加配置项`roo-cline.experimentalWasmMode`
- [ ] 运行现有Task测试确保无回归

**交付物**: Task.ts集成完成 + 回归测试通过

---

### Week 2: 工具与API集成（2.3-2.4）

#### Day 8-10: ToolsAdapter实现

- [ ] 实现`WasmToolsAdapter`类（~300行）
- [ ] 工具注册、参数验证、执行方法
- [ ] Host Interface回调集成（文件、终端、UI）
- [ ] 集成20+现有工具
- [ ] 工具执行测试

**重点工具优先级**:

1. `read_file` - 文件读取
2. `write_to_file` - 文件写入（**必须使用`safeWriteJson`**）
3. `execute_command` - 命令执行
4. `list_files` - 文件列表
5. `search_files` - 文件搜索

**交付物**: ToolsAdapter + 20+工具集成 + 测试

#### Day 11-14: ApiAdapter实现

- [ ] 实现`WasmApiAdapter`类（~350行）
- [ ] Provider配置转换（支持42个Provider）
- [ ] 流式响应处理
- [ ] 集成到`buildApiHandler()`
- [ ] 测试主要Provider（Anthropic, OpenAI, Gemini, Ollama, DeepSeek）

**交付物**: ApiAdapter + 5+Provider支持 + 流式测试

---

### Week 3: 记忆集成与验收（2.5-2.7）

#### Day 15-16: ConversationAdapter与MemoryAdapter

- [ ] 实现`WasmConversationAdapter`（~250行）
- [ ] 实现`WasmMemoryAdapter`（~200行）
- [ ] 对话历史存储与检索
- [ ] 上下文压缩集成
- [ ] 向量记忆搜索集成

**交付物**: Conversation + Memory适配器 + 测试

#### Day 17-18: 端到端集成测试

- [ ] 创建真实任务测试场景
- [ ] WASM模式 vs TS模式对比测试
- [ ] 性能基准测试（latency, throughput, memory）
- [ ] 错误恢复与fallback测试
- [ ] 长时间运行稳定性测试

**测试场景**:

1. 简单代码生成任务
2. 文件读写密集型任务
3. 多工具调用任务
4. 长对话上下文任务
5. 错误处理压力测试

**交付物**: 测试报告 + 性能数据

#### Day 19-21: 完整验收与优化

- [ ] 运行`pnpm check-types`
- [ ] 运行`pnpm clean`
- [ ] 运行`pnpm build`
- [ ] 运行`pnpm vsix`
- [ ] 性能优化（如需要）
- [ ] 文档更新
- [ ] Git提交

**交付物**: Phase 2完成报告 + VSIX包

---

## 🔍 关键技术决策

### 决策1: WASM模式开关策略

**选择**: 配置项 + 环境变量

```typescript
// 1. VSCode配置（用户可控）
const userConfig = vscode.workspace.getConfiguration("roo-cline").get("experimentalWasmMode", false)

// 2. 环境变量（开发者可控）
const devOverride = process.env.ROO_FORCE_WASM === "true"

// 3. 最终决策
const useWasm = devOverride || userConfig
```

**优势**:

- 用户可选择加入
- 开发者可强制启用测试
- 生产环境可灰度发布

### 决策2: Fallback策略

**选择**: 捕获异常 → 日志 → 切换回TS

```typescript
private async wasmExecutionPath(...): Promise<boolean> {
  try {
    // WASM执行
    return await this.wasmAdapter!.executeTask(...)
  } catch (error) {
    console.error('[Task] WASM failed, falling back:', error)
    this.useWasm = false
    return this.typescriptExecutionPath(...)
  }
}
```

**优势**:

- 保证稳定性
- 自动恢复
- 收集错误数据

### 决策3: 数据序列化策略

**选择**: JSON + 结构化验证

```typescript
// TS → Rust
const wasmData = JSON.stringify({
	task_id: this.taskId,
	message: userContent,
	config: this.apiConfiguration,
})

// Rust → TS
const tsData = JSON.parse(wasmResult)
if (!this.validateStructure(tsData)) {
	throw new Error("Invalid WASM response structure")
}
```

**优势**:

- 简单可靠
- 易于调试
- 跨语言兼容

---

## 📏 成功标准

### 功能性指标

| 指标               | 目标 | 验收方法          |
| ------------------ | ---- | ----------------- |
| WASM模式任务成功率 | >95% | 100个真实任务测试 |
| Fallback触发率     | <5%  | 监控日志统计      |
| 工具执行成功率     | >98% | 工具测试套件      |
| API Provider支持   | ≥5个 | Provider集成测试  |
| 测试覆盖率         | >80% | vitest报告        |

### 性能指标

| 指标         | 目标       | 测量方法   |
| ------------ | ---------- | ---------- |
| WASM调用延迟 | <10ms      | 微基准测试 |
| 任务执行时间 | ±10% vs TS | 端到端对比 |
| 内存占用     | ≤TS版本    | 长时间监控 |
| WASM加载时间 | <200ms     | 冷启动测试 |

### 稳定性指标

| 指标           | 目标    | 验证方法           |
| -------------- | ------- | ------------------ |
| 无崩溃运行时间 | >24小时 | 长期压力测试       |
| 错误恢复率     | 100%    | 异常注入测试       |
| 内存泄漏       | 0       | Valgrind/heaptrack |

---

## 🚨 风险与缓解

### 风险1: WASM性能不及预期

**缓解**:

- 在Week 2结束时进行中期性能评估
- 如延迟>50ms，考虑批量调用优化
- 准备好TS fallback作为备选

### 风险2: 数据转换开销过大

**缓解**:

- 使用结构化二进制格式（MessagePack/CBOR）
- 缓存频繁转换的数据
- 异步预加载

### 风险3: Host Interface回调复杂度高

**缓解**:

- 优先实现最常用的5个回调
- 使用代理模式简化接口
- 充分的单元测试

### 风险4: 42个Provider配置差异大

**缓解**:

- 先支持5个主流Provider（80%用户覆盖）
- 创建配置归一化层
- 分批次迭代支持

---

## 📖 相关文档

1. **Phase 1完成报告**: `docs/35-rust-wasm-phase1-completion-report.md`
2. **Phase 2详细计划**: `docs/63-phase2-main-project-integration-plan.md`
3. **跨平台评估**: `docs/30-cross-platform-plugin-migration-evaluation.md`
4. **详细任务计划**: `docs/31-cross-platform-migration-detailed-task-plan.md`
5. **WASM集成文档**: `docs/34-rust-wasm-integration-complete.md`

---

## 🎬 启动Phase 2的前置条件

- [x] Phase 1完成并验收
- [x] WASM模块构建成功（1.1MB）
- [x] 集成测试24/24通过
- [x]
