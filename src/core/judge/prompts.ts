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
	const { originalTask, conversationHistory, toolCalls, fileChanges, currentMode, gitStatus } = taskContext

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

	// Git状态部分
	const gitStatusSection = gitStatus
		? `
## 实际文件改动情况 (Git Status)

${gitStatus}

**重要提示**: 上述是通过 git status 检查的实际文件改动情况。如果声称修改了某些文件但这里没有显示，说明文件可能没有真正被修改。`
		: ""

	// 用户需求变更部分
	const userFeedbackSection = recentUserFeedback
		? `
## 最新的用户需求和反馈

${recentUserFeedback}

**重要提示**: 如果用户在对话过程中提出了新的需求或修改了原有需求，请以最新的用户需求为准进行评判，而不是仅仅关注最初的任务描述。`
		: ""

	return `你是一个严格但灵活的任务审查员（Judge）。请根据以下信息判断任务是否真正完成。

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
${gitStatusSection}

## 模型声称的完成结果

${attemptResult}

## 评判标准

请根据以下标准逐项评估：

### 1. 需求匹配度 (Requirement Alignment)
- **最重要**: 是否满足用户最新提出的需求？（如果有需求变更，以最新需求为准）
- 初始任务的核心要求是否被满足？
- 是否有明显的遗漏？
- 所有用户明确要求的功能是否都已实现？

### 2. 实际改动验证 (Actual Changes Verification)
- **关键检查点**: 如果声称修改了文件，Git状态中是否真的显示了这些文件的改动？
- 如果Git状态显示"无改动"但声称完成了任务，这很可能意味着文件没有真正被修改
- 文件修改的时间是否合理（最近修改的文件才是真正改动过的）

### 3. 正确性 (Correctness)
- 实现是否正确无误？
- 是否有明显的逻辑错误或bug？
- 代码是否能正常运行？

### 4. 质量 (Quality)
- 代码质量是否符合基本标准？
- 是否有测试覆盖（如果要求）？
- 是否有适当的错误处理？
- 是否遵循了最佳实践？

### 5. 文档 (Documentation)
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

1. **灵活性优先**: 如果用户在对话中修改了需求，以最新的需求为准，不要死板地坚持初始任务
2. **验证实际改动**: 优先参考Git状态来验证文件是否真正被修改，而不是仅凭声明
3. **批准适度**: 如果任务基本完成但有小问题，可以批准并在 suggestions 中提出改进建议
4. **严格对待关键问题**: 如果有以下严重问题必须拒绝：
   - 声称修改文件但Git显示无改动
   - 明显违背用户最新要求
   - 有严重的逻辑错误或安全问题
5. **具体建议**: 提供可操作的具体建议，而非笼统的评价
6. **评分范围**: 0-10分，其中：
   - 0-3: 严重不足，完全未完成
   - 4-6: 有明显问题或遗漏
   - 7-8: 基本合格但有改进空间
   - 9-10: 优秀，完全满足要求

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
