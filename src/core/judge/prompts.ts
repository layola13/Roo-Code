import { ClineMessage } from "@roo-code/types"
import { TaskContext, JudgeDetailLevel } from "./types"

/**
 * 构建裁判提示词
 */
export function buildJudgePrompt(
	taskContext: TaskContext,
	attemptResult: string,
	detailLevel: JudgeDetailLevel,
): string {
	const {
		originalTask,
		conversationHistory,
		toolCalls,
		fileChanges,
		currentMode,
		isSubtask,
		parentTaskDescription,
		rootTaskDescription,
	} = taskContext

	// 提取对话历史的摘要
	const conversationSummary = summarizeConversationHistory(conversationHistory)

	// 提取工具调用摘要
	const toolCallsSummary = summarizeToolCalls(toolCalls)

	// 提取文件修改摘要
	const fileChangesSummary = summarizeFileChanges(fileChanges)

	// 提取最近的用户反馈和需求变更
	const recentUserFeedback = extractRecentUserFeedback(conversationHistory)

	const detailInstructions =
		detailLevel === "detailed"
			? `请提供详细的判断理由，逐项检查并提供改进建议。`
			: `请提供简洁的判断理由，只指出主要问题。`

	// 用户需求变更部分
	const userFeedbackSection = recentUserFeedback
		? `
## 最新的用户需求和反馈

${recentUserFeedback}

**重要提示**: 如果用户在对话过程中提出了新的需求或修改了原有需求，请以最新的用户需求为准进行评判，而不是仅仅关注最初的任务描述。`
		: ""

	// 子任务特殊说明部分
	const subtaskSection = isSubtask
		? `
## ⚠️ 重要：这是一个子任务（Subtask）

**当前任务是一个阶段性子任务，不是完整的主任务。**

### 子任务评判原则：
1. **聚焦当前子任务的目标**：不要期望完成整个主任务的所有要求
2. **阶段性完成即可**：子任务只需要完成其被分配的具体部分
3. **上下文理解**：理解子任务在整体任务中的位置和作用
4. **适度宽松**：相比主任务，对子任务的完整性要求应该更加灵活

${rootTaskDescription ? `### 根任务（Root Task）上下文：\n${rootTaskDescription}\n` : ""}
${parentTaskDescription ? `### 父任务（Parent Task）上下文：\n${parentTaskDescription}\n` : ""}

**当前子任务的范围**：请基于上述上下文理解，这个子任务只需要完成主任务的一个特定部分。`
		: ""

	return `你是一个严格但灵活的任务审查员（Judge）。请根据以下信息判断任务是否真正完成。
${subtaskSection}

## 初始任务描述

${originalTask}
${userFeedbackSection}

## 当前模式

${currentMode}

## 执行历史摘要

### 对话轮数
${conversationSummary.rounds} 轮对话

### 工具调用
${toolCallsSummary}

### 文件修改声明
${fileChangesSummary}

## 模型声称的完成结果

${attemptResult}

## 评判标准

${isSubtask ? "**⚠️ 子任务评判标准**：请注意，这是一个子任务，评判时应该：\n- 关注子任务本身的目标，而不是整个主任务\n- 允许部分功能未实现（如果不在子任务范围内）\n- 重点验证子任务声称完成的部分是否真正完成\n\n" : ""}请根据以下标准逐项评估：

### 1. 需求匹配度 (Requirement Alignment)
- **最重要**: 是否满足${isSubtask ? "子任务" : ""}用户最新提出的需求？（如果有需求变更，以最新需求为准）
- ${isSubtask ? "子任务的具体目标" : "初始任务的核心要求"}是否被满足？
- ${isSubtask ? "在子任务范围内" : ""}是否有明显的遗漏？
- ${isSubtask ? "子任务声称要完成的功能" : "所有用户明确要求的功能"}是否都已实现？

### 2. 正确性 (Correctness)
- 实现是否正确无误？
- 是否有明显的逻辑错误或bug？
- 代码是否能正常运行？

### 3. 质量 (Quality)
- 代码质量是否符合基本标准？
- 是否有测试覆盖（如果要求）？
- 是否有适当的错误处理？
- 是否遵循了最佳实践？

### 4. 文档 (Documentation)
- 是否有必要的注释和文档？
- 是否更新了相关的 README 或文档文件（如果需要）？

## 输出格式

${detailInstructions}

请以 JSON 格式回复，结构如下（请确保返回有效的JSON，不要包含任何其他文本）：

重要提示: approved 字段必须根据实际评判结果设置为 true（批准）或 false（拒绝），这是最终决策字段。

\`\`\`json
{
  "approved": true,
  "reasoning": "详细的判断理由，说明为什么批准或拒绝。特别说明：是否满足最新用户需求、文件是否真正被修改等关键问题",
  "completeness_score": 7,
  "correctness_score": 8,
  "quality_score": 6,
  "overall_score": 7,
  "missingItems": ["缺少单元测试", "README 未更新", "错误处理不完整"],
  "suggestions": [
    "添加至少3个单元测试覆盖核心功能",
    "更新 README.md 中的使用说明",
    "在 API 调用处添加 try-catch 错误处理"
  ],
  "criticalIssues": ["声称修改了文件但Git状态显示无改动", "可能存在内存泄漏风险"]
}
\`\`\`

关键说明:
- 如果任务完成符合要求，设置 "approved": true
- 如果任务未完成或有严重问题，设置 "approved": false
- approved 字段是唯一的最终判断标准，请确保其值与你的判断一致

## 评判原则

${
	isSubtask
		? `**🎯 子任务特殊原则**：
1. **范围聚焦**: 只评估子任务声称要完成的部分，不要求完成整个主任务
2. **阶段性认可**: 如果子任务完成了其被分配的特定目标，即使主任务未完成也应批准
3. **上下文理解**: 基于根任务和父任务的上下文，理解这是一个阶段性工作
4. **避免过度要求**: 不要因为缺少主任务的其他部分而拒绝子任务

**通用原则**：
`
		: ""
}1. **灵活性优先**: 如果用户在对话中修改了需求，以最新的需求为准，不要死板地坚持初始任务
2. **批准适度**: 如果${isSubtask ? "子任务" : "任务"}基本完成但有小问题，可以批准并在 suggestions 中提出改进建议
3. **严格对待关键问题**: 如果有以下严重问题必须拒绝：
   - 明显违背用户最新要求
   - 有严重的逻辑错误或安全问题
4. **具体建议**: 提供可操作的具体建议，而非笼统的评价
5. **评分范围**: 0-10分，其中：
   - 0-3: 严重不足，完全未完成${isSubtask ? "子任务目标" : ""}
   - 4-6: 有明显问题或遗漏
   - 7-8: 基本合格但有改进空间
   - 9-10: 优秀，完全满足${isSubtask ? "子任务" : ""}要求

请现在开始评判。`
}

/**
 * 总结对话历史
 */
function summarizeConversationHistory(conversationHistory: ClineMessage[]): {
	rounds: number
	summary: string
} {
	const rounds = conversationHistory.length
	return {
		rounds,
		summary: `共 ${rounds} 条消息`,
	}
}

/**
 * 总结工具调用
 */
function summarizeToolCalls(toolCalls: string[]): string {
	if (toolCalls.length === 0) {
		return "无工具调用"
	}

	// 统计不同类型的工具调用
	const toolStats: Record<string, number> = {}
	for (const tool of toolCalls) {
		toolStats[tool] = (toolStats[tool] || 0) + 1
	}

	const lines = Object.entries(toolStats)
		.map(([tool, count]) => `- ${tool}: ${count} 次`)
		.join("\n")

	return `总计 ${toolCalls.length} 次工具调用：\n${lines}`
}

/**
 * 总结文件修改
 */
function summarizeFileChanges(fileChanges: string[]): string {
	if (fileChanges.length === 0) {
		return "无文件修改"
	}

	const lines = fileChanges.map((file) => `- ${file}`).join("\n")
	return `修改了 ${fileChanges.length} 个文件：\n${lines}`
}

/**
 * 提取最近的用户反馈和需求变更
 */
function extractRecentUserFeedback(conversationHistory: ClineMessage[]): string {
	// 收集用户反馈消息
	const userFeedbacks = conversationHistory
		.filter((m) => m.type === "say" && m.say === "user_feedback" && m.text)
		.map((m) => m.text!)

	// 收集用户的直接输入（来自ask响应）
	const userInputs = conversationHistory
		.filter((m) => m.type === "ask" && m.ask === "followup" && m.text)
		.map((m) => {
			try {
				const parsed = JSON.parse(m.text || "{}")
				return parsed.question || ""
			} catch {
				return m.text || ""
			}
		})
		.filter((text) => text.length > 0)

	const allFeedback = [...userFeedbacks, ...userInputs]

	if (allFeedback.length === 0) {
		return ""
	}

	// 只取最近3条反馈，避免信息过载
	const recentFeedback = allFeedback.slice(-3)
	return recentFeedback.map((fb, i) => `${i + 1}. ${fb.substring(0, 300)}${fb.length > 300 ? "..." : ""}`).join("\n")
}

/**
 * 构建简化的裁判提示词（用于快速检查）
 */
export function buildSimpleJudgePrompt(originalTask: string, attemptResult: string): string {
	return `你是一个任务审查员。请判断以下任务是否完成：

## 原始任务
${originalTask}

## 完成声明
${attemptResult}

请以JSON格式回复：
{
  "approved": true/false,
  "reasoning": "简短理由"
}

只需返回JSON，不要其他内容。`
}
