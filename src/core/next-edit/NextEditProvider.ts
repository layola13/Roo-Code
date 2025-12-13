/**
 * NextEditProvider - 编辑步骤生成器
 * 负责使用LLM生成编辑步骤
 */

import { v4 as uuidv4 } from "uuid"
import { Anthropic } from "@anthropic-ai/sdk"
import { EditStep, EditType, EditChainStatus } from "../../memory/gsw/types/next-edit"
import { StepGenerationContext } from "./types"

/**
 * LLM响应格式
 */
interface LLMEditStepResponse {
	filePath: string
	startLine: number
	endLine: number
	originalCode: string
	suggestedCode: string
	description: string
	editType: EditType
	confidence: number
	dependsOn?: string[]
}

/**
 * NextEditProvider
 * 使用LLM生成编辑步骤
 */
export class NextEditProvider {
	private apiKey?: string
	private model: string = "claude-sonnet-4"

	constructor(apiKeyOrHandler?: string | any, model?: string) {
		// 兼容ApiHandler或string类型
		if (typeof apiKeyOrHandler === "string") {
			this.apiKey = apiKeyOrHandler
		} else if (apiKeyOrHandler && typeof apiKeyOrHandler.getModel === "function") {
			// 如果是ApiHandler，暂不设置apiKey（将从Task获取）
			this.apiKey = undefined
		}
		if (model) {
			this.model = model
		}
	}

	/**
	 * 生成编辑步骤
	 */
	async generateSteps(context: StepGenerationContext): Promise<EditStep[]> {
		if (!this.apiKey) {
			// 如果没有API key，返回空步骤（后续会从Task获取LLM实例）
			console.warn("[NextEditProvider] No API key provided, skipping step generation")
			return []
		}

		const prompt = this.buildPrompt(context)

		try {
			const anthropic = new Anthropic({ apiKey: this.apiKey })

			const response = await anthropic.messages.create({
				model: this.model,
				max_tokens: 4096,
				messages: [
					{
						role: "user",
						content: prompt,
					},
				],
			})

			// 解析响应
			const content = response.content[0]
			if (content.type !== "text") {
				throw new Error("Unexpected response type")
			}

			const stepsData = this.parseResponse(content.text)
			return this.convertToEditSteps(stepsData, context)
		} catch (error) {
			console.error("[NextEditProvider] Failed to generate steps:", error)
			throw error
		}
	}

	/**
	 * 构建生成步骤的Prompt
	 */
	private buildPrompt(context: StepGenerationContext): string {
		const { taskDescription, existingSteps, fileContents, codebaseContext, similarChains } = context

		let prompt = `You are an expert code editor. Your task is to break down a complex code modification into small, incremental editing steps that can be reviewed one at a time.

**Task Description:**
${taskDescription}

**Instructions:**
1. Analyze the task and break it into the smallest possible atomic editing steps
2. Each step should modify only a few lines of code (ideally 5-15 lines)
3. Steps should be ordered logically and can have dependencies
4. Each step must be self-contained and reversible
5. Provide high confidence scores for straightforward changes

**Available Files:**
${Array.from(fileContents.keys()).join("\n")}

`

		// 添加文件内容
		if (fileContents.size > 0) {
			prompt += "\n**Current File Contents:**\n"
			for (const [filePath, content] of fileContents.entries()) {
				prompt += `\n--- ${filePath} ---\n${content.substring(0, 2000)}\n` // 限制长度
			}
		}

		// 添加代码库上下文
		if (codebaseContext) {
			prompt += `\n**Codebase Context:**\n${codebaseContext}\n`
		}

		// 添加相似编辑链（模式学习）
		if (similarChains && similarChains.length > 0) {
			prompt += "\n**Similar Previous Edits (for reference):**\n"
			for (const chain of similarChains.slice(0, 2)) {
				prompt += `- ${chain.taskDescription} (${chain.steps.length} steps)\n`
			}
		}

		// 添加已有步骤
		if (existingSteps.length > 0) {
			prompt += `\n**Existing Steps (continue from here):**\n`
			for (const step of existingSteps) {
				prompt += `${step.index}. ${step.description}\n`
			}
		}

		prompt += `

**Output Format (JSON array):**
[
  {
    "filePath": "path/to/file.ts",
    "startLine": 10,
    "endLine": 15,
    "originalCode": "existing code...",
    "suggestedCode": "new code...",
    "description": "Brief description of the change",
    "editType": "insert|replace|delete|refactor",
    "confidence": 0.95,
    "dependsOn": ["step-id-1"] // optional
  }
]

Generate the editing steps as a JSON array:`

		return prompt
	}

	/**
	 * 解析LLM响应
	 */
	private parseResponse(responseText: string): LLMEditStepResponse[] {
		try {
			// 尝试提取JSON（可能包含在代码块中）
			const jsonMatch = responseText.match(/\[[\s\S]*\]/)
			if (!jsonMatch) {
				throw new Error("No JSON array found in response")
			}

			const stepsData = JSON.parse(jsonMatch[0]) as LLMEditStepResponse[]

			// 验证基本结构
			if (!Array.isArray(stepsData)) {
				throw new Error("Response is not an array")
			}

			return stepsData
		} catch (error) {
			console.error("[NextEditProvider] Failed to parse response:", error)
			console.error("Response text:", responseText)
			throw new Error(`Failed to parse LLM response: ${error}`)
		}
	}

	/**
	 * 转换为EditStep格式
	 */
	private convertToEditSteps(stepsData: LLMEditStepResponse[], context: StepGenerationContext): EditStep[] {
		const startIndex = context.existingSteps.length

		return stepsData.map((data, idx) => {
			const step: EditStep = {
				index: startIndex + idx,
				stepId: uuidv4(),
				filePath: data.filePath,
				startLine: data.startLine,
				endLine: data.endLine,
				originalCode: data.originalCode,
				suggestedCode: data.suggestedCode,
				description: data.description,
				editType: data.editType,
				status: "pending",
				confidence: data.confidence || 0.8,
				dependsOn: data.dependsOn,
			}

			return step
		})
	}

	/**
	 * 预测下一步（预测式生成）
	 * 在用户接受当前步骤时，后台预取下一步
	 */
	async predictNextStep(context: StepGenerationContext, currentStepIndex: number): Promise<EditStep | null> {
		// 检查是否已经有下一步
		if (currentStepIndex + 1 < context.existingSteps.length) {
			return context.existingSteps[currentStepIndex + 1]
		}

		// 生成下一步
		const steps = await this.generateSteps({
			...context,
			existingSteps: context.existingSteps.slice(0, currentStepIndex + 1),
		})

		return steps.length > 0 ? steps[0] : null
	}

	/**
	 * 设置API Key
	 */
	setApiKey(apiKey: string): void {
		this.apiKey = apiKey
	}

	/**
	 * 设置模型
	 */
	setModel(model: string): void {
		this.model = model
	}

	/**
	 * 获取模型
	 */
	getModel(): string {
		return this.model
	}
}
