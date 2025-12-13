# Next Edit + GSW + SubAgent Parallel 实现任务

## Phase 1: 类型定义和基础架构 (2天)

- [ ] 创建 `src/memory/gsw/types/next-edit.ts` 定义 NextEditMemory 类型
- [ ] 创建 `src/memory/gsw/types/parallel-session.ts` 定义 ParallelSessionMemory 类型
- [ ] 创建 `src/core/next-edit/types.ts` 定义 EditStep, EditChain 等类型
- [ ] 更新 `src/memory/gsw/types/index.ts` 导出新类型

## Phase 2: 核心服务实现 (4天)

- [ ] 创建 `src/core/next-edit/NextEditService.ts` 主服务
- [ ] 创建 `src/core/next-edit/NextEditProvider.ts` 代码生成器
- [ ] 创建 `src/core/next-edit/NextEditMemoryManager.ts` GSW集成层
- [ ] 创建 `src/core/next-edit/EditChainAnalyzer.ts` 编辑分析器

## Phase 3: 并行执行核心 (5天) 🆕

- [ ] 创建 `src/core/subagent/parallel/ParallelSubagentManager.ts` 并行管理器
- [ ] 创建 `src/core/subagent/parallel/IsolatedContext.ts` 隔离上下文
- [ ] 创建 `src/core/subagent/parallel/ContextPool.ts` 上下文池 (复用)
- [ ] 创建 `src/core/subagent/parallel/DynamicScheduler.ts` 动态调度 (完成即拉取)
- [ ] 创建 `src/core/subagent/parallel/ParallelEditChainExecutor.ts` 并行编辑链执行器

## Phase 4: GSW 集成 (2天)

- [ ] 修改 `DirectoryMemorySystem.ts` 支持 next-edit 类型记忆的查询
- [ ] 修改 `MemoryCapture.ts` 添加 `captureEditPattern` 方法
- [ ] 修改 `MemoryCapture.ts` 添加 `captureParallelSession` 方法 🆕
- [ ] 添加向量索引支持 edit_chain 的语义搜索

## Phase 5: 工具和 Prompt (3天) 🆕

- [ ] 创建 `src/core/tools/spawnParallelTasksTool.ts` 并行任务工具
- [ ] 创建 `src/core/tools/spawnEditChainTool.ts` 编辑链工具 🆕
- [ ] 创建 `src/core/tools/spawnParallelEditChainsTool.ts` 并行编辑链工具 🆕
- [ ] 添加工具提示词到 Code 模式 system prompt
- [ ] 创建 `src/core/prompts/sections/unified-execution.ts` 统一执行策略 Prompt

## Phase 6: Task.ts 集成 (2天)

- [ ] 修改 `Task.ts` 添加 NextEditService 初始化
- [ ] 修改 `Task.ts` 添加 ParallelSubagentManager 初始化 🆕
- [ ] 添加多步骤编辑任务检测逻辑
- [ ] 添加 Next Edit 相关的消息处理
- [ ] 添加并行执行相关的消息处理 🆕

## Phase 7: UI 实现 - 并行 Tab Bar (2天) 🆕

- [ ] 创建 `webview-ui/src/components/chat/SubagentTabBar.tsx`
- [ ] 创建 `webview-ui/src/components/chat/SubagentTab.tsx`
- [ ] 实现横向滚动 + 队列指示器 "+N in Queue"
- [ ] 实现自动关闭动画 (完成后 3 秒淡出)

## Phase 8: UI 实现 - Next Edit 面板 (2天)

- [ ] 创建 `webview-ui/src/components/next-edit/NextEditPanel.tsx`
- [ ] 创建 `webview-ui/src/components/next-edit/EditStepCard.tsx`
- [ ] 创建 `webview-ui/src/components/next-edit/EditChainProgress.tsx`
- [ ] 添加快捷键支持 (Tab/Esc 或 Cmd+Enter/Cmd+Backspace)

## Phase 9: 统一视图整合 (1.5天) 🆕

- [ ] 创建 `webview-ui/src/components/chat/UnifiedTaskView.tsx`
- [ ] 集成 SubagentTabBar + NextEditPanel
- [ ] 添加后端消息协议 (ExtensionMessage 扩展)
- [ ] ChatView.tsx 集成

## Phase 10: 测试和验证 (3天)

- [ ] 创建 `NextEditService.test.ts` 单元测试
- [ ] 创建 `ParallelSubagentManager.test.ts` 并行管理器测试 🆕
- [ ] 创建 `NextEditMemoryManager.test.ts` GSW集成测试
- [ ] 端到端手动测试：单文件编辑链场景
- [ ] 端到端手动测试：多文件并行编辑链场景 🆕

---

## 总计工作量

| 阶段     | 天数        | 关键产出        |
| -------- | ----------- | --------------- |
| Phase 1  | 2           | 类型定义        |
| Phase 2  | 4           | Next Edit 核心  |
| Phase 3  | 5           | 并行执行核心 🔥 |
| Phase 4  | 2           | GSW 集成        |
| Phase 5  | 3           | 工具 + Prompt   |
| Phase 6  | 2           | Task.ts 集成    |
| Phase 7  | 2           | 并行 Tab UI     |
| Phase 8  | 2           | Next Edit UI    |
| Phase 9  | 1.5         | 统一视图        |
| Phase 10 | 3           | 测试验证        |
| **总计** | **26.5 天** | ~ 5-6 周        |
