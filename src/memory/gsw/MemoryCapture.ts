/**
 * GSW三元记忆系统 - 记忆捕获器
 * 负责自动捕获用户交互、LLM推理和代码演进
 */

import { Anthropic } from "@anthropic-ai/sdk"
import { DirectoryMemorySystem } from "./DirectoryMemorySystem"
import { InteractionMemory, UserGoal } from "./types/interaction"
import { ReasoningMemory } from "./types/reasoning"
import { EvolutionMemory, ModificationContext } from "./types/evolution"
import { SessionSummary } from "./types/summary"
import { ApiHandler } from "../../api"

/**
 * 自我反思结构
 */
interface SelfReflection {
	reason: string
	benefits: string[]
	potential_issues: string[]
	future_applications: string[]
}

export class MemoryCapture {
	private memorySystem: DirectoryMemorySystem
	private currentSessionId: string | null = null
	private sessionData: Map<string, InteractionMemory> = new Map()
	private apiHandler?: ApiHandler

	constructor(memorySystem: DirectoryMemorySystem, apiHandler?: ApiHandler) {
		this.memorySystem = memorySystem
		this.apiHandler = apiHandler
	}

	/**
	 * 设置或更新 API Handler
	 */
	setApiHandler(handler: ApiHandler | undefined) {
		this.apiHandler = handler
	}

	/**
	 * 1️⃣ 捕获用户交互（Interaction Memory）
	 * 触发时机：用户发送消息到webview
	 */
	async captureUserInteraction(message: string, mode: string, taskId: string): Promise<void> {
		// 检测是否是上下文切换
		const isContextSwitch = this.detectContextSwitch(message)

		// 检测强制性指令关键词
		const mandatoryInstructions = this.extractMandatoryInstructions(message)

		// 🔥 检测用户纠错模式并捕获为工作流知识
		if (this.currentSessionId) {
			await this.detectAndCaptureUserCorrection(message, this.currentSessionId)
		}

		// 如果是新会话或上下文切换，创建新的session
		if (!this.currentSessionId || isContextSwitch) {
			const previousGoal = this.currentSessionId ? this.getPreviousGoal() : undefined

			this.currentSessionId = `sess_${Date.now()}`

			const interactionData: InteractionMemory = {
				version: "1.0",
				session_id: this.currentSessionId,
				start_time: new Date().toISOString(),
				mode: mode,
				context_switches: isContextSwitch ? 1 : 0,
				user_goals: [
					{
						timestamp: new Date().toISOString(),
						goal: message,
						context: `用户在${mode}模式下的请求`,
						context_switch: isContextSwitch,
						previous_goal: previousGoal,
						mandatory_instructions: mandatoryInstructions.length > 0 ? mandatoryInstructions : undefined,
					},
				],
			}

			// 缓存session数据
			this.sessionData.set(this.currentSessionId, interactionData)

			// 写入Interaction Memory
			await this.memorySystem.writeMemory("interaction", interactionData)
		} else {
			// 追加到现有session
			await this.appendToSession(message, mode, mandatoryInstructions)
		}

		// 🔥 自动生成并保存会话总结
		if (this.currentSessionId) {
			try {
				const summary = await this.generateRealtimeSummary(this.currentSessionId)
				await this.memorySystem.saveSessionSummary(summary)
			} catch (error) {
				console.warn("[MemoryCapture] Failed to generate session summary:", error)
				// 不影响主流程，继续执行
			}
		}
	}

	/**
	 * 🔥 检测用户纠错并捕获为工作流知识
	 * 识别"不对，应该是..."、"错了，正确的是..."等模式
	 */
	private async detectAndCaptureUserCorrection(message: string, sessionId: string): Promise<void> {
		// 用户纠错模式关键词
		const correctionPatterns = [
			// 中文纠错模式
			{ pattern: /不对[，,\s]*(?:应该|正确|是)[是：:\s]*(.+)/s, lang: "zh" },
			{ pattern: /错了[，,\s]*(?:应该|正确|是)[是：:\s]*(.+)/s, lang: "zh" },
			{ pattern: /不是[，,\s]*(?:应该|是)[是：:\s]*(.+)/s, lang: "zh" },
			{ pattern: /改成[：:\s]*(.+)/s, lang: "zh" },
			{ pattern: /应该[是用：:\s]*(.+)/s, lang: "zh" },
			{ pattern: /正确的[是命令参数用法：:\s]*(.+)/s, lang: "zh" },
			// 英文纠错模式
			{ pattern: /(?:no|wrong|incorrect)[,\s]*(?:it\s+)?should\s+be[:\s]*(.+)/is, lang: "en" },
			{ pattern: /(?:that's\s+)?(?:wrong|incorrect)[,\s]*(?:use|try)[:\s]*(.+)/is, lang: "en" },
			{ pattern: /correct(?:ed)?\s+(?:command|version|syntax)[:\s]*(.+)/is, lang: "en" },
			{ pattern: /change\s+(?:it\s+)?to[:\s]*(.+)/is, lang: "en" },
			{ pattern: /use\s+this\s+instead[:\s]*(.+)/is, lang: "en" },
		]

		for (const { pattern } of correctionPatterns) {
			const match = message.match(pattern)
			if (match && match[1]) {
				const correctedValue = match[1].trim().substring(0, 500) // 限制长度

				// 尝试提取命令名
				let toolName = "unknown_tool"
				const cmdMatch = correctedValue.match(/^[`"']?([.\w\/-]+)/)
				if (cmdMatch && cmdMatch[1]) {
					toolName = cmdMatch[1].split("/").pop() || toolName
				}

				try {
					await this.captureWorkflowKnowledge(
						toolName,
						"error_correction",
						{
							description: `User correction: ${correctedValue.substring(0, 100)}`,
							example: correctedValue,
							context: `User provided correction in message`,
						},
						sessionId,
					)
					console.log(`[MemoryCapture] 📝 Captured user correction for: ${toolName}`)
				} catch (error) {
					console.warn("[MemoryCapture] Failed to capture user correction:", error)
				}

				// 只捕获第一个匹配的纠错
				break
			}
		}
	}

	/**
	 * 2️⃣ 捕获LLM推理（Reasoning Memory）
	 * 触发时机：LLM返回响应时
	 */
	async captureReasoning(llmResponse: string, relatedFiles: string[], sessionId: string): Promise<void> {
		// 提取推理内容（过滤掉代码块）
		const reasoning = this.extractReasoningText(llmResponse)

		if (reasoning.length < 50) {
			return // 太短的响应不记录
		}

		// 提取决策点
		const decisionPoints = this.extractDecisionPoints(reasoning)

		// 检测"记忆触发器"（我想起了、我记得、之前）
		const memoryTrigger = this.detectMemoryTrigger(reasoning)

		const reasoningData: ReasoningMemory = {
			version: "1.0",
			entry_id: `reason_${Date.now()}`,
			timestamp: new Date().toISOString(),
			related_session: sessionId,
			source_file: relatedFiles[0] || "unknown",
			reasoning: reasoning,
			decision_points: decisionPoints,
			memory_trigger: memoryTrigger,
			confidence: this.estimateConfidence(reasoning),
			related_files: relatedFiles,
		}

		// 写入Reasoning Memory
		await this.memorySystem.writeMemory("reasoning", reasoningData)
	}

	/**
	 * 🔥 捕获工具执行证据（用于裁判验证）
	 * 触发时机：任何文件编辑工具成功执行后
	 */
	async captureToolExecution(
		toolName: string,
		params: Record<string, any>,
		result: { success: boolean; filesModified?: string[]; error?: string },
		sessionId: string,
	): Promise<void> {
		// 构建工具执行记录
		const executionRecord = {
			version: "1.0",
			execution_id: `exec_${Date.now()}`,
			timestamp: new Date().toISOString(),
			session_id: sessionId,
			tool_name: toolName,
			parameters: params,
			result: result,
			files_modified: result.filesModified || [],
		}

		// 写入工具执行记录（存储到reasoning memory的扩展字段）
		// 这样裁判可以直接读取这些证据
		const reasoningData: ReasoningMemory = {
			version: "1.0",
			entry_id: executionRecord.execution_id,
			timestamp: executionRecord.timestamp,
			related_session: sessionId,
			source_file: result.filesModified?.[0] || "unknown",
			reasoning: `工具 ${toolName} 执行${result.success ? "成功" : "失败"}`,
			decision_points: [`修改文件: ${result.filesModified?.join(", ") || "无"}`],
			memory_trigger: undefined,
			confidence: result.success ? 1.0 : 0.0,
			related_files: result.filesModified || [],
			tool_execution: executionRecord, // 🔥 扩展字段
		}

		// 写入Reasoning Memory（包含工具执行证据）
		await this.memorySystem.writeMemory("reasoning", reasoningData)
	}

	/**
	 * 3️⃣ 捕获代码演进（Evolution Memory）
	 * 触发时机：apply_diff或write_to_file成功执行后
	 */
	async captureCodeEvolution(
		filePath: string,
		diff: string,
		gitCommit: string | null,
		sessionId: string,
	): Promise<void> {
		// 生成diff摘要
		const diffSummary = this.generateDiffSummary(diff)

		// 优先使用LLM生成反思，如果失败则回退到规则方法
		let selfReflection: SelfReflection
		if (this.apiHandler) {
			try {
				selfReflection = await this.llmBasedReflection(filePath, diff, sessionId)
			} catch (error) {
				console.warn("[MemoryCapture] LLM reflection failed, falling back to rule-based:", error)
				selfReflection = this.ruleBasedReflection(filePath, diff, sessionId)
			}
		} else {
			selfReflection = this.ruleBasedReflection(filePath, diff, sessionId)
		}

		const evolutionData: EvolutionMemory = {
			version: "1.0",
			evolution_id: `evol_${Date.now()}`,
			timestamp: new Date().toISOString(),
			file_path: filePath,
			git_commit: gitCommit || "uncommitted",
			diff_summary: diffSummary,
			modification_context: {
				reason: selfReflection.reason,
				related_session: sessionId,
				related_reasoning: [], // 稍后通过索引关联
			},
			benefits: selfReflection.benefits,
			potential_issues: selfReflection.potential_issues,
			future_applications: selfReflection.future_applications,
			code_snippet: this.extractKeyCode(diff),
		}

		// 写入Evolution Memory
		await this.memorySystem.writeMemory("evolution", evolutionData)
	}

	/**
	 * 🔥 捕获工作流知识（新增功能）
	 * 用于捕获CLI工具使用方法、正确参数、成功模式等可复用知识
	 * 触发时机：
	 * 1. 当LLM通过 --help 学习工具用法后
	 * 2. 当命令执行成功且包含特定参数模式时
	 * 3. 当用户纠正参数错误时
	 */
	async captureWorkflowKnowledge(
		toolOrCommand: string,
		knowledgeType: "cli_usage" | "parameter_pattern" | "error_correction" | "best_practice",
		knowledge: {
			command?: string
			correctParams?: string[]
			incorrectParams?: string[]
			description: string
			example?: string
			context?: string
		},
		sessionId: string,
	): Promise<void> {
		// 构建工作流知识记录
		const workflowKnowledge = {
			tool_or_command: toolOrCommand,
			knowledge_type: knowledgeType,
			...knowledge,
			timestamp: new Date().toISOString(),
		}

		// 生成关键词，确保后续查询能精准匹配
		const keywords: string[] = [
			toolOrCommand.toLowerCase(),
			...(knowledge.correctParams || []).map((p) => p.toLowerCase()),
			knowledgeType,
		]

		// 提取命令名（如 rust2haxe）
		if (knowledge.command) {
			const commandParts = knowledge.command.split(/\s+/)
			const cmdName = commandParts[0]?.split("/").pop() || ""
			if (cmdName) {
				keywords.push(cmdName.toLowerCase())
			}
		}

		// 写入Reasoning Memory，标记为工作流知识
		const reasoningData: ReasoningMemory = {
			version: "1.0",
			entry_id: `workflow_${Date.now()}`,
			timestamp: new Date().toISOString(),
			related_session: sessionId,
			source_file: "workflow_knowledge",
			reasoning: `[WORKFLOW] ${knowledgeType}: ${knowledge.description}`,
			decision_points: knowledge.example ? [`示例: ${knowledge.example}`] : [],
			memory_trigger: "workflow_knowledge", // 特殊标记，方便后续查询
			confidence: 1.0, // 工作流知识置信度高
			related_files: [],
			workflow_knowledge: workflowKnowledge, // 🔥 扩展字段
		}

		// 写入Reasoning Memory
		await this.memorySystem.writeMemory("reasoning", reasoningData)

		console.log(`[MemoryCapture] 📚 Captured workflow knowledge: ${knowledgeType} for ${toolOrCommand}`)
	}

	/**
	 * 🔥 从LLM响应中自动提取工作流知识（增强版）
	 * 识别帮助信息、使用方法、参数说明等
	 */
	async extractAndCaptureWorkflowKnowledge(llmResponse: string, sessionId: string): Promise<void> {
		// 检测是否包含CLI工具帮助信息
		const helpPatterns = [
			/USAGE:\s*(.+?)(?:\n\n|\z)/is,
			/usage:\s*(.+?)(?:\n\n|\z)/is,
			/Options?:\s*\n((?:\s+--.+\n)+)/im,
			/Args?:\s*\n((?:\s+<.+>\s+.+\n)+)/im,
			/示例[:：]\s*(.+?)(?:\n\n|\z)/is,
			/Example[:：]\s*(.+?)(?:\n\n|\z)/is,
		]

		let foundHelp = false
		let extractedUsage = ""
		let extractedOptions: string[] = []

		for (const pattern of helpPatterns) {
			const match = llmResponse.match(pattern)
			if (match && match[1]) {
				foundHelp = true
				if (pattern.toString().includes("USAGE") || pattern.toString().includes("usage")) {
					extractedUsage = match[1].trim()
				} else if (pattern.toString().includes("Options")) {
					// 提取选项参数
					extractedOptions = match[1]
						.split("\n")
						.filter((line) => line.includes("--"))
						.map((line) => line.trim().split(/\s{2,}/)[0] || "")
						.filter(Boolean)
				}
			}
		}

		// 检测命令名
		const commandPattern =
			/(?:running|executing|run|execute|cmd|command)[:：]?\s*[`"]?([.\w/-]+(?:\s+[^\n`"]+)?)[`"]?/i
		const commandMatch = llmResponse.match(commandPattern)
		const command = commandMatch?.[1]?.trim()

		// 如果找到帮助信息，捕获为工作流知识
		if (foundHelp && (extractedUsage || extractedOptions.length > 0)) {
			const toolName = command?.split(/\s+/)[0]?.split("/").pop() || "unknown_tool"

			await this.captureWorkflowKnowledge(
				toolName,
				"cli_usage",
				{
					command: command || extractedUsage.split("\n")[0],
					correctParams: extractedOptions.slice(0, 10), // 最多10个参数
					description: `CLI usage learned from help output`,
					example: extractedUsage.substring(0, 500),
					context: "Extracted from --help or usage documentation",
				},
				sessionId,
			)
		}

		// 检测错误纠正模式
		const correctionPatterns = [
			/正确的(?:命令|参数|用法)[:：是]?\s*(.+)/,
			/应该(?:使用|改为)[:：]?\s*(.+)/,
			/correct(?:ed|ion)?[:：]?\s*(.+)/i,
			/should be[:：]?\s*(.+)/i,
		]

		for (const pattern of correctionPatterns) {
			const match = llmResponse.match(pattern)
			if (match && match[1]) {
				const correctedValue = match[1].trim().substring(0, 200)
				const toolName = command?.split(/\s+/)[0]?.split("/").pop() || "unknown_tool"

				await this.captureWorkflowKnowledge(
					toolName,
					"error_correction",
					{
						command: command,
						description: `Error correction: ${correctedValue}`,
						example: correctedValue,
						context: "Learned from error correction",
					},
					sessionId,
				)
				break // 只捕获第一个纠正
			}
		}
	}

	/**
	 * 检测上下文切换的关键词
	 */
	private detectContextSwitch(message: string): boolean {
		const switchKeywords = ["等等", "不对", "先", "改成", "换个", "重新", "取消", "停", "算了"]

		return switchKeywords.some((keyword) => message.toLowerCase().includes(keyword))
	}

	/**
	 * 获取上一个目标
	 */
	private getPreviousGoal(): string | undefined {
		if (!this.currentSessionId) {
			return undefined
		}

		const session = this.sessionData.get(this.currentSessionId)
		if (!session || session.user_goals.length === 0) {
			return undefined
		}

		return session.user_goals[session.user_goals.length - 1].goal
	}

	/**
	 * 追加到现有session
	 */
	private async appendToSession(message: string, mode: string, mandatoryInstructions?: string[]): Promise<void> {
		if (!this.currentSessionId) {
			return
		}

		const session = this.sessionData.get(this.currentSessionId)
		if (!session) {
			return
		}

		const newGoal: UserGoal = {
			timestamp: new Date().toISOString(),
			goal: message,
			context: `用户在${mode}模式下的请求`,
			context_switch: false,
			mandatory_instructions:
				mandatoryInstructions && mandatoryInstructions.length > 0 ? mandatoryInstructions : undefined,
		}

		session.user_goals.push(newGoal)
		session.end_time = new Date().toISOString()

		// 更新文件
		await this.memorySystem.writeMemory("interaction", session)
	}

	/**
	 * 提取强制性指令关键词
	 * 识别用户下达的必须遵守的指令
	 */
	private extractMandatoryInstructions(message: string): string[] {
		const instructions: string[] = []

		// 强制性指令关键词列表
		const mandatoryKeywords = [
			"务必",
			"必须",
			"一定要",
			"一定得",
			"禁止",
			"不能",
			"不要",
			"严禁",
			"绝对不",
			"千万不要",
			"切记",
			"注意",
			"记住",
			"要求",
			"规定",
			"强制",
			"限制",
			"约束",
			"规则",
		]

		// 正则模式：捕获包含强制性关键词的完整句子或短语
		const patterns = mandatoryKeywords.map(
			(keyword) => new RegExp(`(${keyword}[^。！？\\n]{10,200})[。！？\\n]?`, "g"),
		)

		for (const pattern of patterns) {
			const matches = message.matchAll(pattern)
			for (const match of matches) {
				if (match[1]) {
					const instruction = match[1].trim()
					// 去重并添加
					if (!instructions.includes(instruction)) {
						instructions.push(instruction)
					}
				}
			}
		}

		// 如果没有匹配到完整句子，尝试匹配关键词前后的短语
		if (instructions.length === 0) {
			for (const keyword of mandatoryKeywords) {
				if (message.includes(keyword)) {
					// 提取关键词所在的行或句子
					const lines = message.split(/[。！？\n]/)
					for (const line of lines) {
						if (line.includes(keyword) && line.trim().length > 5) {
							instructions.push(line.trim())
						}
					}
				}
			}
		}

		return instructions
	}

	/**
	 * 提取推理文本（移除代码块）
	 */
	private extractReasoningText(llmResponse: string): string {
		// 移除```代码块```
		const withoutCodeBlocks = llmResponse.replace(/```[\s\S]*?```/g, "[代码已省略]")

		// 提取纯文本推理
		const lines = withoutCodeBlocks.split("\n")
		const reasoningLines = lines.filter(
			(line) =>
				!line.trim().startsWith("<") && // 移除XML标签
				!line.trim().startsWith("//") && // 移除注释
				line.trim().length > 20, // 过滤太短的行
		)

		return reasoningLines.join("\n").trim()
	}

	/**
	 * 提取决策点（包含"选择"、"因为"、"vs"等关键词）
	 */
	private extractDecisionPoints(text: string): string[] {
		const decisionPatterns = [/选择(.+?)因为/g, /(.+?)vs(.+?):/g, /决定(.+?)[，。]/g]

		const decisions: string[] = []
		for (const pattern of decisionPatterns) {
			const matches = text.matchAll(pattern)
			for (const match of matches) {
				decisions.push(match[0])
			}
		}

		return decisions
	}

	/**
	 * 检测记忆触发器
	 */
	private detectMemoryTrigger(text: string): string | undefined {
		const triggers = ["我想起了", "我记得", "之前", "上次", "类似"]

		for (const trigger of triggers) {
			if (text.includes(trigger)) {
				return `触发词: ${trigger}`
			}
		}

		return undefined
	}

	/**
	 * 估计置信度
	 */
	private estimateConfidence(text: string): number {
		// 简单的启发式规则
		let confidence = 0.5

		if (text.includes("确定") || text.includes("肯定")) {
			confidence += 0.2
		}
		if (text.includes("可能") || text.includes("或许")) {
			confidence -= 0.1
		}
		if (text.includes("建议") || text.includes("推荐")) {
			confidence += 0.1
		}

		return Math.max(0, Math.min(1, confidence))
	}

	/**
	 * 生成diff摘要（无需LLM）
	 */
	private generateDiffSummary(diff: string): string {
		const lines = diff.split("\n")
		const added = lines.filter((l) => l.startsWith("+")).length
		const removed = lines.filter((l) => l.startsWith("-")).length

		// 提取关键函数名
		const functionNames = this.extractFunctionNames(diff)

		return `+ ${added}行 / - ${removed}行\n修改函数: ${functionNames.join(", ")}`
	}

	/**
	 * 提取函数名
	 */
	private extractFunctionNames(diff: string): string[] {
		const functionPattern = /(?:function|const|let|var|async)\s+(\w+)/g
		const names = new Set<string>()

		const matches = diff.matchAll(functionPattern)
		for (const match of matches) {
			if (match[1]) {
				names.add(match[1])
			}
		}

		return Array.from(names).slice(0, 5) // 最多5个
	}

	/**
	 * 使用LLM生成代码变更反思
	 */
	private async llmBasedReflection(filePath: string, diff: string, sessionId: string): Promise<SelfReflection> {
		if (!this.apiHandler) {
			throw new Error("No API handler available for LLM-based reflection")
		}

		const session = this.sessionData.get(sessionId)
		const userGoal = session?.user_goals[0]?.goal || "代码优化"

		// 构建LLM提示词
		const prompt = this.buildReflectionPrompt(filePath, diff, userGoal)

		// 调用LLM
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: prompt,
			},
		]

		const stream = this.apiHandler.createMessage(
			"You are a code analysis assistant specializing in understanding code changes and their implications.",
			messages,
			{
				taskId: "gsw-memory-reflection",
				mode: "gsw-memory",
			},
		)

		// 收集流式响应
		let fullResponse = ""
		for await (const chunk of stream) {
			if (chunk.type === "text") {
				fullResponse += chunk.text
			}
		}

		// 解析LLM响应
		return this.parseReflectionResponse(fullResponse)
	}

	/**
	 * 构建代码反思提示词
	 */
	private buildReflectionPrompt(filePath: string, diff: string, userGoal: string): string {
		return `分析以下代码变更并生成自我反思。

**用户目标**: ${userGoal}

**修改文件**: ${filePath}

**代码差异**:
\`\`\`diff
${diff.substring(0, 2000)}${diff.length > 2000 ? "\n...(截断)" : ""}
\`\`\`

请以JSON格式返回分析结果：

\`\`\`json
{
	 "reason": "为什么进行这次修改（1-2句话）",
	 "benefits": ["好处1", "好处2", "好处3"],
	 "potential_issues": ["潜在问题1", "潜在问题2"],
	 "future_applications": ["未来可应用场景1", "未来可应用场景2"]
}
\`\`\`

要求：
- reason: 简明扼要说明修改原因
- benefits: 列举2-4个具体好处
- potential_issues: 列举1-3个需要注意的潜在问题
- future_applications: 列举1-3个未来可以借鉴的场景

请直接返回JSON，不要添加额外说明。`
	}

	/**
	 * 解析LLM反思响应
	 */
	private parseReflectionResponse(response: string): SelfReflection {
		try {
			// 提取JSON内容
			const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/\{[\s\S]*\}/)

			if (!jsonMatch) {
				throw new Error("No JSON found in response")
			}

			const jsonStr = jsonMatch[1] || jsonMatch[0]
			const parsed = JSON.parse(jsonStr)

			return {
				reason: parsed.reason || "代码优化",
				benefits: Array.isArray(parsed.benefits) ? parsed.benefits : [],
				potential_issues: Array.isArray(parsed.potential_issues) ? parsed.potential_issues : [],
				future_applications: Array.isArray(parsed.future_applications) ? parsed.future_applications : [],
			}
		} catch (error) {
			console.error("[MemoryCapture] Failed to parse LLM reflection response:", error)
			throw error
		}
	}

	/**
	 * 基于规则的反思（回退方案）
	 */
	private ruleBasedReflection(filePath: string, diff: string, sessionId: string): SelfReflection {
		const session = this.sessionData.get(sessionId)
		const reason = session?.user_goals[0]?.goal || "代码优化"

		// 分析diff内容
		const hasAsync = diff.includes("async")
		const hasError = diff.includes("try") || diff.includes("catch")
		const hasPerf = diff.includes("cache") || diff.includes("memo")
		const hasType = diff.includes("interface") || diff.includes("type")

		return {
			reason: reason,
			benefits: [
				hasAsync ? "支持异步操作" : null,
				hasError ? "增强错误处理" : null,
				hasPerf ? "提升性能" : null,
				hasType ? "改进类型安全" : null,
			].filter((b): b is string => b !== null),
			potential_issues: [
				hasAsync ? "需要处理Promise rejection" : null,
				diff.length > 1000 ? "变更较大，需要充分测试" : null,
			].filter((i): i is string => i !== null),
			future_applications: [`可以应用到${filePath}相关的其他文件`],
		}
	}

	/**
	 * 提取关键代码片段
	 */
	private extractKeyCode(diff: string): string {
		const lines = diff.split("\n")
		const addedLines = lines.filter((l) => l.startsWith("+"))

		// 取前10行添加的代码
		return addedLines.slice(0, 10).join("\n")
	}

	/**
	 * 获取当前session ID
	 */
	getCurrentSessionId(): string | null {
		return this.currentSessionId
	}

	/**
	 * 结束当前session
	 */
	async endCurrentSession(): Promise<void> {
		if (!this.currentSessionId) {
			return
		}

		const session = this.sessionData.get(this.currentSessionId)
		if (session) {
			session.end_time = new Date().toISOString()
			await this.memorySystem.writeMemory("interaction", session)
		}

		this.currentSessionId = null
	}

	/**
	 * 🔥 生成实时会话总结（GSW增强功能1）
	 * 使用轻量级提示词生成总结，控制在200 tokens内
	 */
	async generateRealtimeSummary(sessionId: string): Promise<SessionSummary> {
		const session = this.sessionData.get(sessionId)

		if (!session) {
			throw new Error(`Session ${sessionId} not found`)
		}

		// 如果有API Handler，使用LLM生成总结
		if (this.apiHandler) {
			try {
				return await this.llmBasedSummary(session)
			} catch (error) {
				console.warn("[MemoryCapture] LLM summary failed, falling back to rule-based:", error)
			}
		}

		// Fallback: 基于规则的总结
		return this.ruleBasedSummary(session)
	}

	/**
	 * 使用LLM生成会话总结
	 */
	private async llmBasedSummary(session: InteractionMemory): Promise<SessionSummary> {
		if (!this.apiHandler) {
			throw new Error("No API handler available")
		}

		// 构建简洁的提示词（控制在200 tokens内）
		const prompt = this.buildSummaryPrompt(session)

		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: prompt,
			},
		]

		const stream = this.apiHandler.createMessage(
			"You are a concise session summarizer. Respond only with valid JSON.",
			messages,
			{
				taskId: "gsw-session-summary",
				mode: "gsw-memory",
			},
		)

		// 收集流式响应
		let fullResponse = ""
		for await (const chunk of stream) {
			if (chunk.type === "text") {
				fullResponse += chunk.text
			}
		}

		// 解析LLM响应
		return this.parseSummaryResponse(fullResponse, session)
	}

	/**
	 * 构建总结提示词（简洁版，<200 tokens）
	 */
	private buildSummaryPrompt(session: InteractionMemory): string {
		const goals = session.user_goals.map((g) => g.goal).join("; ")
		const mandatoryInstructions = session.user_goals
			.flatMap((g) => g.mandatory_instructions || [])
			.filter((v, i, a) => a.indexOf(v) === i) // 去重

		return `Summarize this session in JSON format (max 200 tokens):

**Goals**: ${goals.substring(0, 500)}
**Mode**: ${session.mode}
**Mandatory**: ${mandatoryInstructions.join("; ")}

Return JSON:
\`\`\`json
{
	 "key_points": ["point1", "point2", "point3"],
	 "user_intent": "one sentence",
	 "current_status": "one sentence",
	 "next_steps": ["step1", "step2"]
}
\`\`\`

Be concise. Only JSON, no explanation.`
	}

	/**
	 * 解析LLM总结响应
	 */
	private parseSummaryResponse(response: string, session: InteractionMemory): SessionSummary {
		try {
			const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/\{[\s\S]*\}/)

			if (!jsonMatch) {
				throw new Error("No JSON found in response")
			}

			const jsonStr = jsonMatch[1] || jsonMatch[0]
			const parsed = JSON.parse(jsonStr)

			// 提取mandatory instructions
			const mandatoryInstructions = session.user_goals
				.flatMap((g) => g.mandatory_instructions || [])
				.filter((v, i, a) => a.indexOf(v) === i) // 去重

			return {
				session_id: session.session_id,
				last_updated: new Date().toISOString(),
				key_points: Array.isArray(parsed.key_points) ? parsed.key_points.slice(0, 5) : [],
				user_intent: parsed.user_intent || "未知意图",
				current_status: parsed.current_status || "进行中",
				next_steps: Array.isArray(parsed.next_steps) ? parsed.next_steps.slice(0, 3) : [],
				mandatory_requirements: mandatoryInstructions.length > 0 ? mandatoryInstructions : undefined,
				files_involved: undefined, // 后续可以从reasoning memory中提取
			}
		} catch (error) {
			console.error("[MemoryCapture] Failed to parse summary response:", error)
			// Fallback to rule-based
			return this.ruleBasedSummary(session)
		}
	}

	/**
	 * 基于规则的总结（Fallback）
	 */
	private ruleBasedSummary(session: InteractionMemory): SessionSummary {
		const goals = session.user_goals
		const latestGoal = goals[goals.length - 1]

		// 提取关键点
		const keyPoints: string[] = []
		if (goals.length > 1) {
			keyPoints.push(`完成了${goals.length}个目标`)
		}
		if (session.context_switches && session.context_switches > 0) {
			keyPoints.push(`发生了${session.context_switches}次上下文切换`)
		}
		keyPoints.push(latestGoal.goal.substring(0, 100))

		// 提取mandatory instructions
		const mandatoryInstructions = goals
			.flatMap((g) => g.mandatory_instructions || [])
			.filter((v, i, a) => a.indexOf(v) === i) // 去重

		return {
			session_id: session.session_id,
			last_updated: new Date().toISOString(),
			key_points: keyPoints.slice(0, 5),
			user_intent: latestGoal.goal.substring(0, 150),
			current_status: session.end_time ? "已完成" : "进行中",
			next_steps: ["继续当前任务", "等待用户反馈"],
			mandatory_requirements: mandatoryInstructions.length > 0 ? mandatoryInstructions : undefined,
			files_involved: undefined,
		}
	}
}
