import { Anthropic } from "@anthropic-ai/sdk"
import * as vscode from "vscode"

import { ProviderSettings } from "@roo-code/types"
import { buildApiHandler, ApiHandler } from "../../api"

import {
	JudgeConfig,
	TaskContext,
	JudgeResult,
	JudgeResponseJson,
	JudgeProgressCallback,
	JudgeProgressUpdate,
} from "./types"
import { buildJudgePrompt } from "./prompts"

/**
 * 裁判服务
 * 负责调用独立的模型来判断任务是否真正完成
 */
export class JudgeService {
	private config: JudgeConfig
	private apiHandler?: ApiHandler
	private context: vscode.ExtensionContext

	constructor(config: JudgeConfig, context: vscode.ExtensionContext) {
		this.config = config
		this.context = context

		// 如果有独立模型配置，创建专用的 ApiHandler
		if (config.modelConfig) {
			try {
				this.apiHandler = buildApiHandler(config.modelConfig)
			} catch (error) {
				console.error("[JudgeService] Failed to build API handler:", error)
				// 不抛出错误，允许回退到主模型
			}
		}
	}

	/**
	 * 判断任务是否真正完成
	 * @param taskContext 任务上下文
	 * @param attemptResult 完成尝试的结果
	 * @param onProgress 可选的流式进度回调，用于实时显示裁判思考过程
	 */
	async judgeCompletion(
		taskContext: TaskContext,
		attemptResult: string,
		onProgress?: JudgeProgressCallback,
	): Promise<JudgeResult> {
		const startTime = Date.now()

		try {
			// 通知开始构建提示词
			if (onProgress) {
				await onProgress({ type: "parsing", stage: "正在构建裁判提示词..." })
			}

			// 构建裁判提示词
			const judgePrompt = buildJudgePrompt(taskContext, attemptResult, this.config.detailLevel)

			// 调用裁判模型（传递流式回调）
			const response = await this.callJudgeModel(judgePrompt, onProgress)

			// 通知开始解析
			if (onProgress) {
				await onProgress({ type: "parsing", stage: "正在解析裁判响应..." })
			}

			// 解析裁判结果
			const result = this.parseJudgeResponse(response)

			// 计算执行时间
			const executionTimeMs = Date.now() - startTime

			// 获取使用的模型名称
			const modelName = this.getModelName()

			// 检查是否使用了GSW记忆
			const usedGswMemory = !!(taskContext.gswHistoricalMemories && taskContext.gswHistoricalMemories.length > 0)

			// 添加执行时间和其他元数据
			const finalResult = {
				...result,
				executionTimeMs,
				modelName,
				usedGswMemory,
			}

			// 通知完成
			if (onProgress) {
				await onProgress({ type: "complete", stage: "裁判分析完成" })
			}

			return finalResult
		} catch (error) {
			console.error("[JudgeService] Error during judgment:", error)
			const executionTimeMs = Date.now() - startTime

			// 如果裁判失败，返回一个默认的批准结果，避免阻塞用户
			return {
				approved: true,
				reasoning: `裁判服务遇到错误，默认批准任务完成。错误信息: ${error instanceof Error ? error.message : String(error)}`,
				missingItems: [],
				suggestions: ["建议检查裁判服务配置"],
				hasCriticalIssues: false,
				executionTimeMs,
				modelName: this.getModelName(),
				usedGswMemory: false,
			}
		}
	}

	/**
	 * 调用裁判模型
	 * @param prompt 裁判提示词
	 * @param onProgress 可选的流式进度回调
	 */
	private async callJudgeModel(prompt: string, onProgress?: JudgeProgressCallback): Promise<string> {
		if (!this.apiHandler) {
			throw new Error("No API handler available for judge service")
		}

		// 构建消息
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: prompt,
			},
		]

		// 调用 API
		const stream = this.apiHandler.createMessage("You are a task completion judge.", messages, {
			taskId: "judge-task",
			mode: "judge",
		})

		// 收集流式响应
		let fullResponse = ""
		let approvedDetected = false // 跟踪是否已检测到 approved 状态

		for await (const chunk of stream) {
			if (chunk.type === "text") {
				fullResponse += chunk.text

				// 🔑 流式回调：通知每个新块
				if (onProgress) {
					await onProgress({
						type: "chunk",
						chunk: chunk.text,
						fullText: fullResponse,
					})

					// 🔑 检测 approved 字段（只通知一次）
					if (!approvedDetected) {
						const approvedMatch = fullResponse.match(/"approved"\s*:\s*(true|false)/i)
						if (approvedMatch) {
							approvedDetected = true
							const approved = approvedMatch[1].toLowerCase() === "true"
							await onProgress({
								type: "approved_detected",
								approved,
								fullText: fullResponse,
								stage: approved ? "✅ 初步判断：批准" : "❌ 初步判断：拒绝",
							})
						}
					}
				}
			}
		}

		return fullResponse
	}

	/**
	 * 解析裁判响应
	 */
	private parseJudgeResponse(response: string): JudgeResult {
		// 🛡️ 终极保险：如果响应中任何地方出现 "approved": false，立即返回拒绝
		// 这是最后一道防线，确保无论解析逻辑如何，拒绝决策都不会被错误覆盖
		const hasExplicitRejection = /"approved"\s*:\s*false/i.test(response)
		if (hasExplicitRejection) {
			console.log(
				"[JudgeService] 🛡️ INSURANCE CHECK: Found explicit 'approved: false' in response - will ensure rejection",
			)
		}

		try {
			// 尝试提取 JSON 内容 - 优先匹配 ```json 代码块
			const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/\{[\s\S]*\}/)

			if (!jsonMatch) {
				// 如果没有找到 JSON，尝试 Markdown 格式解析
				console.log("[JudgeService] No JSON found, falling back to Markdown parsing")
				return this.parseMarkdownResponseWithJsonCheck(response)
			}

			let jsonStr = jsonMatch[1] || jsonMatch[0]

			// 🔴 关键修复：LLM 可能返回包含原始换行符的 JSON，需要先清理
			// 尝试直接解析，如果失败则尝试清理后再解析
			let parsed: JudgeResponseJson
			try {
				parsed = JSON.parse(jsonStr)
			} catch (firstError) {
				console.log("[JudgeService] First JSON parse failed, attempting to sanitize JSON...")

				// 尝试清理 JSON 字符串中的控制字符
				jsonStr = this.sanitizeJsonString(jsonStr)

				try {
					parsed = JSON.parse(jsonStr)
					console.log("[JudgeService] Successfully parsed sanitized JSON")
				} catch (secondError) {
					console.error("[JudgeService] Sanitized JSON parse also failed:", secondError)

					// 🔴 关键修复：即使 JSON 解析完全失败，也要尝试提取 approved 字段
					// 这比回退到 Markdown 解析更可靠
					const approvedFieldMatch = jsonStr.match(/"approved"\s*:\s*(true|false)/i)
					if (approvedFieldMatch) {
						const approved = approvedFieldMatch[1].toLowerCase() === "true"
						console.log("[JudgeService] Extracted approved field from malformed JSON:", approved)

						// 尝试提取其他字段
						const reasoningMatch = jsonStr.match(/"reasoning"\s*:\s*"([\s\S]*?)(?:"\s*[,}]|$)/)
						const reasoning = reasoningMatch
							? reasoningMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
							: "JSON 解析失败，但已提取关键字段"

						const overallScoreMatch = jsonStr.match(/"overall_score"\s*:\s*(\d+)/)
						const overallScore = overallScoreMatch ? parseInt(overallScoreMatch[1], 10) : undefined

						return {
							approved,
							reasoning: reasoning + "\n\n⚠️ 注意：原始 JSON 格式有误，部分字段可能未正确解析。",
							overallScore,
							missingItems: this.extractArrayField(jsonStr, "missingItems"),
							suggestions: this.extractArrayField(jsonStr, "suggestions"),
							criticalIssues: this.extractArrayField(jsonStr, "criticalIssues"),
							hasCriticalIssues: this.extractArrayField(jsonStr, "criticalIssues").length > 0,
						}
					}

					// 完全无法解析，回退到 Markdown 解析（但会检查嵌入的 JSON approved 字段）
					console.log(
						"[JudgeService] Could not extract approved field, falling back to Markdown with JSON check",
					)
					return this.parseMarkdownResponseWithJsonCheck(response)
				}
			}

			// 🔴 关键修复：JSON 中的 approved 字段是最终决策，优先级最高
			// 检测潜在矛盾：如果外层 Markdown 文本与 JSON approved 字段不一致
			const decisionMatch = response.match(/Decision:\s*(.+?)(?:\n|$)/i)
			if (decisionMatch) {
				const decision = decisionMatch[1].toLowerCase()
				const markdownSaysApproved =
					decision.includes("approved") &&
					!decision.includes("not approved") &&
					!decision.includes("rejected") &&
					!decision.includes("denied")

				// 检查是否存在矛盾
				const jsonApproved = parsed.approved === true
				const jsonRejected = parsed.approved === false

				if ((markdownSaysApproved && jsonRejected) || (!markdownSaysApproved && jsonApproved)) {
					console.warn(
						"[JudgeService] ⚠️  CONTRADICTION DETECTED between Markdown Decision and JSON approved field",
					)
					console.warn("[JudgeService] Markdown Decision:", decision)
					console.warn("[JudgeService] JSON approved:", parsed.approved)
					console.warn("[JudgeService] 🔑 Using JSON approved field as the authoritative decision")

					// 🔑 关键：始终以 JSON 的 approved 字段为准，这是最终决策
					// 但在 reasoning 中记录这个矛盾
					const contradictionNote = `\n\n⚠️ 注意：检测到裁判响应中存在矛盾（Markdown Decision 说 "${markdownSaysApproved ? "批准" : "拒绝"}" 但 JSON approved 字段为 ${parsed.approved}）。已采用 JSON approved 字段作为最终决策。`
					parsed.reasoning = (parsed.reasoning || "未提供理由") + contradictionNote
				}
			}

			// 正常解析，以 JSON 的 approved 字段为准
			const criticalIssues = parsed.criticalIssues || []
			let result: JudgeResult = {
				approved: parsed.approved ?? false, // 默认拒绝（安全策略）
				reasoning: parsed.reasoning || "未提供理由",
				completenessScore: parsed.completeness_score,
				correctnessScore: parsed.correctness_score,
				qualityScore: parsed.quality_score,
				overallScore: parsed.overall_score,
				missingItems: parsed.missingItems || [],
				suggestions: parsed.suggestions || [],
				criticalIssues,
				hasCriticalIssues: criticalIssues.length > 0,
			}

			// 🛡️ 终极保险执行：如果检测到明确的拒绝，但结果却是批准，强制覆盖为拒绝
			if (hasExplicitRejection && result.approved === true) {
				console.warn(
					"[JudgeService] 🛡️ INSURANCE OVERRIDE: Detected 'approved: false' in raw response but parsed as true - forcing rejection!",
				)
				result.approved = false
				result.reasoning =
					result.reasoning + '\n\n🛡️ 安全覆盖：检测到原始响应中包含 "approved": false，已强制设为拒绝状态。'
			}

			console.log("[JudgeService] Successfully parsed JSON response:", {
				approved: result.approved,
				reasoning: result.reasoning.substring(0, 100) + "...",
				overallScore: result.overallScore,
			})

			return result
		} catch (error) {
			console.error("[JudgeService] Failed to parse judge response as JSON:", error)
			console.error("[JudgeService] Response was:", response)

			// 回退到 Markdown 格式解析（但会检查嵌入的 JSON approved 字段）
			// 🛡️ 同样应用终极保险
			const markdownResult = this.parseMarkdownResponseWithJsonCheck(response)

			if (hasExplicitRejection && markdownResult.approved === true) {
				console.warn(
					"[JudgeService] 🛡️ INSURANCE OVERRIDE (Markdown fallback): Detected 'approved: false' in raw response - forcing rejection!",
				)
				return {
					...markdownResult,
					approved: false,
					reasoning:
						markdownResult.reasoning +
						'\n\n🛡️ 安全覆盖：检测到原始响应中包含 "approved": false，已强制设为拒绝状态。',
				}
			}

			return markdownResult
		}
	}

	/**
	 * 清理 JSON 字符串中的控制字符（如原始换行符）
	 */
	private sanitizeJsonString(jsonStr: string): string {
		// 处理字符串值中的原始换行符
		// 这是一个简化的处理方法，适用于大多数情况
		let inString = false
		let escaped = false
		let result = ""

		for (let i = 0; i < jsonStr.length; i++) {
			const char = jsonStr[i]

			if (escaped) {
				result += char
				escaped = false
				continue
			}

			if (char === "\\") {
				escaped = true
				result += char
				continue
			}

			if (char === '"') {
				inString = !inString
				result += char
				continue
			}

			if (inString) {
				// 在字符串内部，替换控制字符
				if (char === "\n") {
					result += "\\n"
				} else if (char === "\r") {
					result += "\\r"
				} else if (char === "\t") {
					result += "\\t"
				} else {
					result += char
				}
			} else {
				result += char
			}
		}

		return result
	}

	/**
	 * 从 JSON 字符串中提取数组字段
	 */
	private extractArrayField(jsonStr: string, fieldName: string): string[] {
		const regex = new RegExp(`"${fieldName}"\\s*:\\s*\\[([\\s\\S]*?)\\]`, "i")
		const match = jsonStr.match(regex)
		if (!match) return []

		const items: string[] = []
		const itemMatches = match[1].matchAll(/"([^"]+)"/g)
		for (const m of itemMatches) {
			items.push(m[1])
		}
		return items
	}

	/**
	 * 使用 Markdown 解析，但会优先检查响应中是否有嵌入的 JSON approved 字段
	 */
	private parseMarkdownResponseWithJsonCheck(response: string): JudgeResult {
		// 🔴 关键修复：在进行 Markdown 解析之前，先检查是否有嵌入的 JSON approved 字段
		// 这样即使 Decision 说 "approved"，但 JSON 说 false，我们也能正确识别
		const embeddedApprovedMatch = response.match(/"approved"\s*:\s*(true|false)/i)
		if (embeddedApprovedMatch) {
			const embeddedApproved = embeddedApprovedMatch[1].toLowerCase() === "true"
			console.log("[JudgeService] Found embedded JSON approved field:", embeddedApproved)

			// 如果找到了嵌入的 approved 字段，使用它作为权威来源
			// 但仍然尝试从 Markdown 中提取其他信息
			const markdownResult = this.parseMarkdownResponse(response)

			// 如果 Markdown 解析的 approved 与嵌入的 JSON approved 不一致，使用 JSON 的值
			if (markdownResult.approved !== embeddedApproved) {
				console.warn("[JudgeService] ⚠️ Markdown approved differs from embedded JSON approved")
				console.warn("[JudgeService] Markdown says:", markdownResult.approved)
				console.warn("[JudgeService] Embedded JSON says:", embeddedApproved)
				console.warn("[JudgeService] Using embedded JSON approved as authoritative")

				return {
					...markdownResult,
					approved: embeddedApproved,
					reasoning:
						markdownResult.reasoning +
						`\n\n⚠️ 注意：已使用嵌入的 JSON approved 字段（${embeddedApproved}）覆盖 Markdown 判断。`,
				}
			}
		}

		// 没有找到嵌入的 approved 字段，使用纯 Markdown 解析
		return this.parseMarkdownResponse(response)
	}

	/**
	 * 解析 Markdown 格式的裁判响应
	 * 支持类似以下格式：
	 * " Judge Approval
	 * Decision: Task completion approved
	 * Reasoning: ...
	 * Optional Suggestions for Future Improvements:
	 * ..."
	 */
	private parseMarkdownResponse(response: string): JudgeResult {
		// 判断是否批准
		let approved = false
		const decisionMatch = response.match(/Decision:\s*(.+?)(?:\n|$)/i)
		if (decisionMatch) {
			const decision = decisionMatch[1].toLowerCase()
			// 必须先检查拒绝关键词，因为可能会出现 "not approved" 或 "rejected" 的情况
			if (
				decision.includes("rejected") ||
				decision.includes("拒绝") ||
				decision.includes("not approved") ||
				decision.includes("denied")
			) {
				approved = false
			} else if (decision.includes("approved") || decision.includes("批准")) {
				approved = true
			} else {
				// 如果 Decision 字段既不包含批准也不包含拒绝关键词，默认为拒绝
				approved = false
			}
		} else {
			// 如果没有明确的 Decision 字段，尝试从整体文本判断
			const lowerResponse = response.toLowerCase()
			// 优先检查拒绝关键词
			if (lowerResponse.includes("rejected") || lowerResponse.includes("拒绝")) {
				approved = false
			} else if (
				lowerResponse.includes("approved") ||
				lowerResponse.includes("批准") ||
				lowerResponse.includes("task completion approved")
			) {
				approved = true
			} else {
				// 如果都不包含，默认为拒绝（安全起见）
				approved = false
			}
		}

		// 提取理由
		let reasoning = ""
		const reasoningMatch = response.match(
			/Reasoning:\s*([\s\S]*?)(?:\n\n|\n(?:Optional Suggestions|Overall Score|$))/i,
		)
		if (reasoningMatch) {
			reasoning = reasoningMatch[1].trim()
		} else {
			// 如果没有明确的 Reasoning 字段，使用整个响应作为理由
			reasoning = response.trim()
		}

		// 提取评分
		let overallScore: number | undefined
		const scoreMatch = response.match(/Overall Score:\s*(\d+)\/10/i)
		if (scoreMatch) {
			overallScore = parseInt(scoreMatch[1], 10)
		}

		// 提取建议列表
		const suggestions: string[] = []
		const suggestionsSection = response.match(
			/(?:Optional Suggestions for Future Improvements|Suggestions):\s*([\s\S]*?)(?:\n\n|$)/i,
		)
		if (suggestionsSection) {
			// 提取编号列表项
			const suggestionMatches = suggestionsSection[1].matchAll(/(?:\d+\.|[-*])\s*(.+?)(?:\n|$)/g)
			for (const match of suggestionMatches) {
				const suggestion = match[1].trim()
				if (suggestion) {
					suggestions.push(suggestion)
				}
			}
		}

		// 提取缺失项
		const missingItems: string[] = []
		const missingSection = response.match(/(?:Missing Items|缺失项):\s*([\s\S]*?)(?:\n\n|$)/i)
		if (missingSection) {
			const missingMatches = missingSection[1].matchAll(/(?:\d+\.|[-*])\s*(.+?)(?:\n|$)/g)
			for (const match of missingMatches) {
				const item = match[1].trim()
				if (item) {
					missingItems.push(item)
				}
			}
		}

		// 提取严重问题
		const criticalIssues: string[] = []
		const criticalSection = response.match(/(?:Critical Issues|严重问题):\s*([\s\S]*?)(?:\n\n|$)/i)
		if (criticalSection) {
			const criticalMatches = criticalSection[1].matchAll(/(?:\d+\.|[-*])\s*(.+?)(?:\n|$)/g)
			for (const match of criticalMatches) {
				const issue = match[1].trim()
				if (issue) {
					criticalIssues.push(issue)
				}
			}
		}

		console.log("[JudgeService] Parsed Markdown response:", {
			approved,
			reasoning: reasoning.substring(0, 100) + "...",
			overallScore,
			suggestionsCount: suggestions.length,
			missingItemsCount: missingItems.length,
			criticalIssuesCount: criticalIssues.length,
		})

		return {
			approved,
			reasoning: reasoning || "未提供详细理由",
			overallScore,
			missingItems,
			suggestions,
			criticalIssues,
			hasCriticalIssues: criticalIssues.length > 0,
		}
	}

	/**
	 * 更新配置
	 */
	updateConfig(config: JudgeConfig) {
		this.config = config

		// 如果模型配置改变，重新创建 ApiHandler
		if (config.modelConfig) {
			try {
				this.apiHandler = buildApiHandler(config.modelConfig)
			} catch (error) {
				console.error("[JudgeService] Failed to update API handler:", error)
			}
		} else {
			this.apiHandler = undefined
		}
	}

	/**
	 * 设置 API Handler（用于从外部注入）
	 */
	setApiHandler(handler: ApiHandler) {
		this.apiHandler = handler
	}

	/**
	 * 获取当前配置
	 */
	getConfig(): JudgeConfig {
		return { ...this.config }
	}

	/**
	 * 获取当前使用的模型名称
	 */
	private getModelName(): string {
		if (this.config.modelConfig) {
			// 使用裁判独立配置的模型
			return this.config.modelConfig.apiModelId || "Unknown Model"
		}
		// 使用主模型（通过 setApiHandler 设置）
		return "Current Model"
	}
}
