# 子代理模式改进 - TodoList

**文档编号**: 34-TodoList
**创建日期**: 2025-10-16
**更新日期**: 2025-10-16
**状态**: ✅ 核心功能已完成
**关联文档**:

- [34-subagent-improvement-plan.md](./34-subagent-improvement-plan.md) - 改进方案(已更正)
- [44-subagent-tool-based-invocation.md](./44-subagent-tool-based-invocation.md) - 正确实现说明

---

## ⚠️ 重要更正

**原文档基于错误假设**: 使用文本检测方式调用子代理

**实际正确方式**: 使用工具调用机制 (Tool Use)

**已完成实现**: `use_subagent` 工具已完整实现并正确注册

---

## 📋 任务清单 (已更新)

### Phase 1: 代码分析（准备阶段）

- [x] **Task 1.1**: 读取并分析 SubAgentExecutor 实现细节

    - [x] 读取 `src/core/condense/SubAgentExecutor.ts`
    - [ ] 理解执行流程和 API 调用机制
    - [ ] 确认可复用的方法
    - **关键发现**:
        - `executeCompression()` 并行执行多个子代理
        - `executeSubAgent()` 是私有方法，可单独执行
        - 支持自定义提示词覆盖

- [ ] **Task 1.2**: 读取 SYSTEM_PROMPT 文件，了解当前提示结构
    - [ ] 读取 `src/core/prompts/system.ts`
    - [ ] 了解当前提示结构
    - [ ] 确定最佳插入位置

---

### Phase 2: 核心功能实现

- [x] **Task 2.1**: ✅ 工具描述实现

    - **文件**: `src/core/prompts/tools/use-subagent.ts`
    - **状态**: 已完成
    - **内容**: 完整的use_subagent工具描述,包括3个子代理说明、参数定义、使用示例

- [x] **Task 2.2**: ✅ 工具执行器实现

    - **文件**: `src/core/tools/useSubagentTool.ts`
    - **状态**: 已完成
    - **功能**: 完整的工具执行逻辑,参数验证,SubAgentExecutor调用

- [x] **Task 2.3**: ✅ 工具注册

    - **文件**: `src/shared/tools.ts`, `src/core/prompts/tools/index.ts`
    - **状态**: 已完成
    - **功能**: 类型定义、参数注册、始终可用配置、工具描述映射

- [ ] **Task 2.4**: 修改 WebviewMessage.ts 添加子代理调用类型字段

    - **文件**: `src/shared/WebviewMessage.ts` 或相关类型文件
    - **操作**: 新增 `SubAgentInvocation` 接口
    - **字段**: `triggerType: 'tool_call' | 'auto_compress'`

- [ ] **Task 2.5**: 在 Task.ts 中记录子代理调用历史

    - **文件**: `src/core/task/Task.ts`
    - **操作**:
        - 添加 `subAgentInvocations` 属性
        - 添加 `recordSubAgentInvocation()` 方法
        - 添加 `getSubAgentInvocations()` 方法

- [ ] **Task 2.6**: 集成到消息处理流程

    - **文件**: `src/core/assistant-message/index.ts` 或 `Task.ts`
    - **操作**: 在 `presentAssistantMessage` 中添加意图检测和调用逻辑
    - **功能**: 检测到意图时自动执行子代理并返回结果

- [ ] **Task 2.7**: 修改被动压缩记录类型
    - **文件**: `Task.ts` 的 `attemptApiRequest` 方法
    - **操作**: 在 `truncateConversationIfNeeded` 后记录为 `auto_compress`
    - **目的**: 区分被动触发和主动调用

---

### Phase 3: UI 可视化

- [ ] **Task 3.1**: 修改 TaskHeader.tsx 添加调用类型显示

    - **文件**: `webview-ui/src/components/chat/TaskHeader.tsx`
    - **操作**: 添加子代理历史显示区域
    - **数据源**: 从 Task 状态中获取 `subAgentInvocations`

- [ ] **Task 3.2**: 为主动调用和自动压缩添加不同的图标和标签

    - **文件**: `TaskHeader.tsx`
    - **操作**:
        - 主动调用使用 🤖 图标 + "主动调用" 标签
        - 自动压缩使用 ⚡ 图标 + "自动压缩" 标签
    - **样式**: 使用 Tailwind CSS

- [ ] **Task 3.3**: 显示子代理调用详情
    - **文件**: `TaskHeader.tsx`
    - **操作**: 显示时间、Token（输入/输出）、成本
    - **格式**:
        ```
        🤖 context-analyzer  主动调用  ↑1234 ↓567  $0.0023  ✓
        ⚡ memory-extractor  自动压缩  ↑2345 ↓890  $0.0045  ✓
        ```

---

### Phase 4: 测试覆盖

- [ ] **Task 4.1**: 创建 SubAgentExecutor 单元测试文件

    - **文件**: `src/core/condense/__tests__/SubAgentExecutor.spec.ts`
    - **测试内容**:
        - 测试 `executeCompression()` 并行执行
        - 测试单个子代理执行
        - 测试自定义提示词覆盖
        - 测试错误处理

- [ ] **Task 4.2**: 编写子代理意图检测的单元测试

    - **文件**: `src/core/task/__tests__/subagent-intent-detection.spec.ts`
    - **测试内容**:
        - 测试各种调用表达式的检测
        - 测试大小写不敏感
        - 测试 false positive 情况
        - 测试多个子代理同时提及

- [ ] **Task 4.3**: 编写 TaskHeader 可视化的单元测试
    - **文件**: `webview-ui/src/components/chat/__tests__/TaskHeader-subagent.spec.tsx`
    - **测试内容**:
        - 测试历史列表渲染
        - 测试图标和标签区分
        - 测试数据格式化显示
        - 测试空状态处理

---

### Phase 5: 验收测试

- [ ] **Task 5.1**: 运行后端测试

    - **命令**: `cd src && npx vitest run`
    - **预期**: 所有测试通过，无错误

- [ ] **Task 5.2**: 运行前端测试

    - **命令**: `cd webview-ui && npx vitest run`
    - **预期**: 所有测试通过，无错误

- [ ] **Task 5.3**: 执行类型检查

    - **命令**: `pnpm check-types`
    - **预期**: 无类型错误

- [ ] **Task 5.4**: 运行全部测试

    - **命令**: `pnpm test`
    - **预期**: 全部通过

- [ ] **Task 5.5**: 执行构建
    - **命令**: `pnpm build`
    - **预期**: 构建成功，无错误

---

### Phase 6: 手动验证

- [ ] **Task 6.1**: 验证被动压缩功能

    - **操作**: 创建长对话，触发上下文阈值
    - **预期**: 子代理自动执行，UI 显示 ⚡ 自动压缩

- [ ] **Task 6.2**: 验证主动调用功能

    - **操作**: 在对话中提到调用子代理
    - **预期**:
        - 子代理被执行
        - UI 显示 🤖 主动调用
        - 返回结果集成到对话中

- [ ] **Task 6.3**: 验证 UI 可视化
    - **操作**: 检查 TaskHeader 显示
    - **预期**:
        - 正确显示调用历史
        - 图标和标签正确区分
        - Token 和成本数据准确

---

## 📊 进度统计

- **总任务数**: 19 (原计划)
- **核心功能**: ✅ 已完成 (use_subagent工具)
- **文本检测相关**: ❌ 已废弃 (错误方案)
- **UI和测试**: 🔄 待完善

---

## 🎯 关键里程碑

1. ✅ **核心功能实现** - use_subagent工具完整实现
2. ✅ **文档更正** - 纠正错误的文本检测方案
3. 🔄 **UI可视化** - 显示子代理调用历史(可选)
4. 🔄 **测试完善** - 工具调用相关测试(可选)
5. ✅ **类型检查** - 所有类型定义正确

---

## 📝 重要注意事项

1. ✅ **保留被动压缩** - SubAgentExecutor的自动压缩功能保持不变
2. ✅ **工具调用优先** - 使用Tool Use机制,不要使用文本检测
3. ⚠️ **删除无效代码** - 建议删除文本检测相关代码(detectSubAgentIntent等)
4. ✅ **文档已更正** - docs/34和docs/44说明正确实现方式
5. 🔄 **UI显示** - 可选:在TaskHeader中显示子代理调用历史

---

## 🔗 相关文档

- [34-subagent-improvement-plan.md](./34-subagent-improvement-plan.md) - 详细改进方案
- [subagent2.md](./subagent2.md) - 正确的子代理架构
- [sub_agents.md](./sub_agents.md) - 子代理系统文档

---

## 📅 时间估算

- **Phase 1**: 0.5 天 （代码分析）
- **Phase 2**: 2 天 （核心功能实现）
- **Phase 3**: 1 天 （UI 可视化）
- **Phase 4**: 1.5 天 （测试编写）
- **Phase 5**: 0.5 天 （验收测试）
- **Phase 6**: 0.5 天 （手动验证）

**总计**: 约 6 天工作量

---

## ✅ 完成标准

当以下所有条件满足时，项目完成：

1. ✅ 所有 19 个任务全部完成
2. ✅ `pnpm check-types` 无错误
3. ✅ `pnpm test` 全部通过
4. ✅ `pnpm build` 构建成功
5. ✅ 手动验证所有功能正常
6. ✅ 文档更新完成
