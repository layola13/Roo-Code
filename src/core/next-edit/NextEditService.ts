/**
 * NextEditService - 核心编辑链服务
 * 负责编辑链的创建、管理和执行
 */

import { v4 as uuidv4 } from "uuid"
import {
	EditChain,
	EditStep,
	EditChainStatus,
	EditStepStatus,
	EditType,
	ExecutionMode,
} from "../../memory/gsw/types/next-edit"
import {
	CreateEditChainOptions,
	StepGenerationContext,
	StepValidationResult,
	EditChainExecutionResult,
	EditChainStats,
	NextEditServiceConfig,
	DEFAULT_NEXT_EDIT_CONFIG,
	EditChainEvent,
	EditChainListener,
	StepFeedback,
} from "./types"
import { NextEditMemoryManager } from "./NextEditMemoryManager"
import { NextEditProvider } from "./NextEditProvider"
import { EditChainAnalyzer } from "./EditChainAnalyzer"

/**
 * NextEditService
 * 编辑链服务主类
 */
export class NextEditService {
	private config: NextEditServiceConfig
	public memoryManager: NextEditMemoryManager // 改为public以便外部访问
	private provider: NextEditProvider
	private analyzer: EditChainAnalyzer
	private activeChains: Map<string, EditChain> = new Map()
	private listeners: Set<EditChainListener> = new Set()
	private eventQueue: EditChainEvent[] = []

	constructor(
		memoryManager: NextEditMemoryManager,
		provider: NextEditProvider,
		analyzer: EditChainAnalyzer,
		config?: Partial<NextEditServiceConfig>,
	) {
		this.config = { ...DEFAULT_NEXT_EDIT_CONFIG, ...config }
		this.memoryManager = memoryManager
		this.provider = provider
		this.analyzer = analyzer
	}

	/**
	 * 创建新的编辑链
	 */
	async createEditChain(sessionId: string, options: CreateEditChainOptions): Promise<EditChain> {
		if (!this.config.enabled) {
			throw new Error("NextEdit service is not enabled")
		}

		// 检查并发限制
		if (this.activeChains.size >= this.config.maxConcurrentChains) {
			throw new Error(`Maximum concurrent chains (${this.config.maxConcurrentChains}) reached`)
		}

		const chainId = uuidv4()
		const now = new Date().toISOString()

		const chain: EditChain = {
			chainId,
			sessionId,
			taskDescription: options.taskDescription,
			taskIntent: options.taskIntent || options.taskDescription,
			steps: [],
			currentIndex: -1,
			affectedFiles: options.files || [],
			createdAt: now,
			updatedAt: now,
			status: "planning",
			executionMode: options.executionMode || "sequential",
		}

		// 加入活跃链集合
		this.activeChains.set(chainId, chain)

		// 触发事件
		await this.emitEvent({
			type: "chain_created",
			chainId,
			timestamp: now,
			data: { options },
		})

		return chain
	}

	/**
	 * 为编辑链生成步骤
	 */
	async generateSteps(chainId: string, context: StepGenerationContext): Promise<EditStep[]> {
		const chain = this.activeChains.get(chainId)
		if (!chain) {
			throw new Error(`Chain ${chainId} not found`)
		}

		// 使用 provider 生成步骤
		const steps = await this.provider.generateSteps(context)

		// 验证步骤
		for (const step of steps) {
			const validation = await this.validateStep(step, chain)
			if (!validation.valid && this.config.validationMode === "strict") {
				throw new Error(`Step validation failed: ${validation.errors.join(", ")}`)
			}
		}

		// 添加步骤到链
		chain.steps.push(...steps)
		chain.updatedAt = new Date().toISOString()

		// 更新活跃链
		this.activeChains.set(chainId, chain)

		// 触发事件
		for (const step of steps) {
			await this.emitEvent({
				type: "step_generated",
				chainId,
				stepId: step.stepId,
				timestamp: new Date().toISOString(),
				data: { step },
			})
		}

		return steps
	}

	/**
	 * 验证步骤
	 */
	async validateStep(step: EditStep, chain: EditChain): Promise<StepValidationResult> {
		const errors: string[] = []
		const warnings: string[] = []

		// 基本验证
		if (!step.filePath) {
			errors.push("Missing file path")
		}

		if (step.startLine < 0 || step.endLine < step.startLine) {
			errors.push("Invalid line range")
		}

		if (!step.suggestedCode && step.editType !== "delete") {
			errors.push("Missing suggested code")
		}

		// 依赖验证
		if (step.dependsOn && step.dependsOn.length > 0) {
			for (const depId of step.dependsOn) {
				const depStep = chain.steps.find((s) => s.stepId === depId)
				if (!depStep) {
					errors.push(`Dependency ${depId} not found`)
				} else if (depStep.status === "rejected") {
					warnings.push(`Dependency ${depId} was rejected`)
				}
			}
		}

		// 置信度检查
		if (step.confidence < 0.5) {
			warnings.push(`Low confidence: ${step.confidence}`)
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
			confidence: step.confidence,
		}
	}

	/**
	 * 开始执行编辑链
	 */
	async startChain(chainId: string): Promise<void> {
		const chain = this.activeChains.get(chainId)
		if (!chain) {
			throw new Error(`Chain ${chainId} not found`)
		}

		if (chain.status !== "planning") {
			throw new Error(`Chain ${chainId} is not in planning state`)
		}

		chain.status = "active"
		chain.currentIndex = 0
		chain.updatedAt = new Date().toISOString()

		this.activeChains.set(chainId, chain)

		await this.emitEvent({
			type: "chain_started",
			chainId,
			timestamp: new Date().toISOString(),
		})
	}

	/**
	 * 处理步骤反馈（接受/拒绝/修改）
	 */
	async handleStepFeedback(chainId: string, feedback: StepFeedback): Promise<void> {
		const chain = this.activeChains.get(chainId)
		if (!chain) {
			throw new Error(`Chain ${chainId} not found`)
		}

		const step = chain.steps.find((s) => s.stepId === feedback.stepId)
		if (!step) {
			throw new Error(`Step ${feedback.stepId} not found in chain ${chainId}`)
		}

		const now = new Date().toISOString()

		switch (feedback.action) {
			case "accept":
				step.status = "accepted"
				await this.emitEvent({
					type: "step_accepted",
					chainId,
					stepId: step.stepId,
					timestamp: now,
				})
				break

			case "reject":
				step.status = "rejected"
				step.rejectionReason = feedback.rejectionReason
				await this.emitEvent({
					type: "step_rejected",
					chainId,
					stepId: step.stepId,
					timestamp: now,
					data: { reason: feedback.rejectionReason },
				})
				break

			case "modify":
				step.status = "modified"
				step.userModifiedCode = feedback.modifiedCode
				await this.emitEvent({
					type: "step_modified",
					chainId,
					stepId: step.stepId,
					timestamp: now,
				})
				break
		}

		// 更新链
		chain.updatedAt = now
		this.activeChains.set(chainId, chain)

		// 如果是顺序执行模式，自动前进到下一步
		if (chain.executionMode === "sequential" && feedback.action !== "reject") {
			await this.advanceChain(chainId)
		}
	}

	/**
	 * 推进编辑链到下一步
	 */
	async advanceChain(chainId: string): Promise<boolean> {
		const chain = this.activeChains.get(chainId)
		if (!chain) {
			throw new Error(`Chain ${chainId} not found`)
		}

		// 检查当前步骤是否完成
		const currentStep = chain.steps[chain.currentIndex]
		if (currentStep && currentStep.status === "pending") {
			return false // 当前步骤未完成
		}

		// 前进到下一步
		chain.currentIndex++

		// 检查是否完成
		if (chain.currentIndex >= chain.steps.length) {
			await this.completeChain(chainId)
			return true
		}

		chain.updatedAt = new Date().toISOString()
		this.activeChains.set(chainId, chain)

		return true
	}

	/**
	 * 完成编辑链
	 */
	async completeChain(chainId: string): Promise<EditChainExecutionResult> {
		const chain = this.activeChains.get(chainId)
		if (!chain) {
			throw new Error(`Chain ${chainId} not found`)
		}

		const now = new Date().toISOString()
		chain.status = "completed"
		chain.completedAt = now
		chain.updatedAt = now

		// 计算统计
		const stats = {
			totalSteps: chain.steps.length,
			acceptedSteps: chain.steps.filter((s) => s.status === "accepted").length,
			modifiedSteps: chain.steps.filter((s) => s.status === "modified").length,
			rejectedSteps: chain.steps.filter((s) => s.status === "rejected").length,
		}

		const executionTime = new Date(now).getTime() - new Date(chain.createdAt).getTime()

		// 保存到 GSW 记忆系统
		await this.memoryManager.saveEditChain(chain)

		// 触发模式学习（如果成功率高）
		const successRate = (stats.acceptedSteps + stats.modifiedSteps) / stats.totalSteps
		if (successRate >= this.config.patternLearning.minSuccessRate && this.config.patternLearning.autoUpdate) {
			await this.analyzer.learnFromChain(chain)

			await this.emitEvent({
				type: "pattern_learned",
				chainId,
				timestamp: now,
				data: { successRate },
			})
		}

		// 从活跃链中移除
		this.activeChains.delete(chainId)

		await this.emitEvent({
			type: "chain_completed",
			chainId,
			timestamp: now,
			data: { stats, executionTime },
		})

		return {
			chainId,
			status: "completed",
			completedSteps: chain.currentIndex + 1,
			totalSteps: chain.steps.length,
			acceptedSteps: stats.acceptedSteps,
			modifiedSteps: stats.modifiedSteps,
			rejectedSteps: stats.rejectedSteps,
			executionTime,
			errors: [],
		}
	}

	/**
	 * 暂停编辑链
	 */
	async pauseChain(chainId: string): Promise<void> {
		const chain = this.activeChains.get(chainId)
		if (!chain) {
			throw new Error(`Chain ${chainId} not found`)
		}

		chain.status = "paused"
		chain.updatedAt = new Date().toISOString()
		this.activeChains.set(chainId, chain)

		await this.emitEvent({
			type: "chain_paused",
			chainId,
			timestamp: new Date().toISOString(),
		})
	}

	/**
	 * 恢复编辑链
	 */
	async resumeChain(chainId: string): Promise<void> {
		const chain = this.activeChains.get(chainId)
		if (!chain) {
			throw new Error(`Chain ${chainId} not found`)
		}

		if (chain.status !== "paused") {
			throw new Error(`Chain ${chainId} is not paused`)
		}

		chain.status = "active"
		chain.updatedAt = new Date().toISOString()
		this.activeChains.set(chainId, chain)

		await this.emitEvent({
			type: "chain_resumed",
			chainId,
			timestamp: new Date().toISOString(),
		})
	}

	/**
	 * 放弃编辑链
	 */
	async abandonChain(chainId: string, reason?: string): Promise<void> {
		const chain = this.activeChains.get(chainId)
		if (!chain) {
			throw new Error(`Chain ${chainId} not found`)
		}

		chain.status = "abandoned"
		chain.updatedAt = new Date().toISOString()

		// 保存到记忆（即使未完成）
		await this.memoryManager.saveEditChain(chain)

		this.activeChains.delete(chainId)

		await this.emitEvent({
			type: "chain_abandoned",
			chainId,
			timestamp: new Date().toISOString(),
			data: { reason },
		})
	}

	/**
	 * 获取编辑链
	 */
	getChain(chainId: string): EditChain | undefined {
		return this.activeChains.get(chainId)
	}

	/**
	 * 获取会话的所有活跃链
	 */
	getSessionChains(sessionId: string): EditChain[] {
		return Array.from(this.activeChains.values()).filter((chain) => chain.sessionId === sessionId)
	}

	/**
	 * 获取统计信息
	 */
	async getStats(): Promise<EditChainStats> {
		const activeChains = Array.from(this.activeChains.values())
		const completedChains = await this.memoryManager.getCompletedChains()

		const allChains = [...activeChains, ...completedChains]
		const totalSteps = allChains.reduce((sum, chain) => sum + chain.steps.length, 0)
		const acceptedSteps = allChains.reduce(
			(sum, chain) => sum + chain.steps.filter((s) => s.status === "accepted").length,
			0,
		)

		return {
			totalChains: allChains.length,
			activeChains: activeChains.length,
			completedChains: completedChains.length,
			averageSteps: allChains.length > 0 ? totalSteps / allChains.length : 0,
			averageAcceptanceRate: totalSteps > 0 ? acceptedSteps / totalSteps : 0,
			totalExecutionTime: allChains.reduce((sum, chain) => {
				if (chain.completedAt) {
					return sum + (new Date(chain.completedAt).getTime() - new Date(chain.createdAt).getTime())
				}
				return sum
			}, 0),
		}
	}

	/**
	 * 添加事件监听器
	 */
	addEventListener(listener: EditChainListener): void {
		this.listeners.add(listener)
	}

	/**
	 * 移除事件监听器
	 */
	removeEventListener(listener: EditChainListener): void {
		this.listeners.delete(listener)
	}

	/**
	 * 触发事件
	 */
	private async emitEvent(event: EditChainEvent): Promise<void> {
		// 添加到事件队列
		this.eventQueue.push(event)

		// 通知所有监听器
		const promises = Array.from(this.listeners).map((listener) => {
			try {
				return listener(event)
			} catch (error) {
				console.error("[NextEditService] Listener error:", error)
				return Promise.resolve()
			}
		})

		await Promise.allSettled(promises)
	}

	/**
	 * 获取事件历史
	 */
	getEventHistory(): EditChainEvent[] {
		return [...this.eventQueue]
	}

	/**
	 * 清空事件历史
	 */
	clearEventHistory(): void {
		this.eventQueue = []
	}

	/**
	 * 更新配置
	 */
	updateConfig(config: Partial<NextEditServiceConfig>): void {
		this.config = { ...this.config, ...config }
	}

	/**
	 * 获取配置
	 */
	getConfig(): NextEditServiceConfig {
		return { ...this.config }
	}

	/**
	 * 销毁服务
	 */
	dispose(): void {
		this.activeChains.clear()
		this.listeners.clear()
		this.eventQueue = []
	}
}
