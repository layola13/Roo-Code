import * as vscode from "vscode"
import { DirectoryMemorySystem } from "./DirectoryMemorySystem"

/**
 * GSW记忆系统定时维护调度器
 *
 * 负责：
 * 1. 定期执行记忆压缩（archive old sessions）
 * 2. 定期重建索引（rebuild index）
 * 3. 定期清理过期记忆
 *
 * 设计原则：
 * - 非侵入式：后台运行，不影响主任务
 * - 可配置：支持用户自定义调度策略
 * - 容错性：失败不影响系统稳定性
 */

export interface MemorySchedulerConfig {
	/** 归档间隔（毫秒），默认24小时 */
	archiveIntervalMs: number
	/** 索引重建间隔（毫秒），默认12小时 */
	indexRebuildIntervalMs: number
	/** 清理间隔（毫秒），默认7天 */
	cleanupIntervalMs: number
	/** 归档阈值：会话数超过此值触发归档，默认100 */
	archiveThreshold: number
	/** 清理阈值：归档文件超过此天数后删除，默认90天 */
	cleanupThresholdDays: number
}

export const DEFAULT_SCHEDULER_CONFIG: MemorySchedulerConfig = {
	archiveIntervalMs: 24 * 60 * 60 * 1000, // 24小时
	indexRebuildIntervalMs: 12 * 60 * 60 * 1000, // 12小时
	cleanupIntervalMs: 7 * 24 * 60 * 60 * 1000, // 7天
	archiveThreshold: 100,
	cleanupThresholdDays: 90,
}

export class MemoryScheduler {
	private memorySystem: DirectoryMemorySystem
	private config: MemorySchedulerConfig
	private timers: NodeJS.Timeout[] = []
	private disposables: vscode.Disposable[] = []
	private isRunning: boolean = false

	constructor(memorySystem: DirectoryMemorySystem, config?: Partial<MemorySchedulerConfig>) {
		this.memorySystem = memorySystem
		this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config }
	}

	/**
	 * 启动调度器
	 */
	start(): void {
		if (this.isRunning) {
			console.warn("[MemoryScheduler] Already running")
			return
		}

		console.log("[MemoryScheduler] Starting scheduler with config:", this.config)

		// 1. 归档任务
		const archiveTimer = setInterval(() => {
			this.scheduleArchive().catch((error) => {
				console.error("[MemoryScheduler] Archive task failed:", error)
			})
		}, this.config.archiveIntervalMs)
		this.timers.push(archiveTimer)

		// 2. 索引重建任务
		const indexTimer = setInterval(() => {
			this.scheduleIndexRebuild().catch((error) => {
				console.error("[MemoryScheduler] Index rebuild task failed:", error)
			})
		}, this.config.indexRebuildIntervalMs)
		this.timers.push(indexTimer)

		// 3. 清理任务
		const cleanupTimer = setInterval(() => {
			this.scheduleCleanup().catch((error) => {
				console.error("[MemoryScheduler] Cleanup task failed:", error)
			})
		}, this.config.cleanupIntervalMs)
		this.timers.push(cleanupTimer)

		// 启动时立即执行一次索引重建（确保索引可用）
		this.scheduleIndexRebuild().catch((error) => {
			console.error("[MemoryScheduler] Initial index rebuild failed:", error)
		})

		this.isRunning = true
	}

	/**
	 * 停止调度器
	 */
	stop(): void {
		if (!this.isRunning) {
			return
		}

		console.log("[MemoryScheduler] Stopping scheduler")

		// 清理所有定时器
		this.timers.forEach((timer) => clearInterval(timer))
		this.timers = []

		// 清理所有disposables
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []

		this.isRunning = false
	}

	/**
	 * 手动触发归档任务
	 */
	async triggerArchive(): Promise<void> {
		await this.scheduleArchive()
	}

	/**
	 * 手动触发索引重建任务
	 */
	async triggerIndexRebuild(): Promise<void> {
		await this.scheduleIndexRebuild()
	}

	/**
	 * 手动触发清理任务
	 */
	async triggerCleanup(): Promise<void> {
		await this.scheduleCleanup()
	}

	/**
	 * 执行归档任务
	 *
	 * 策略：
	 * 1. 检查活跃会话数量
	 * 2. 如果超过阈值，归档最旧的会话
	 */
	private async scheduleArchive(): Promise<void> {
		console.log("[MemoryScheduler] Running archive task...")

		try {
			const indexManager = (this.memorySystem as any).indexManager
			if (!indexManager) {
				console.warn("[MemoryScheduler] IndexManager not available, skipping archive")
				return
			}

			// 获取所有会话
			const allSessions = await indexManager.getAllSessions()
			const activeSessions = allSessions.filter((s: any) => !s.archived)

			console.log(
				`[MemoryScheduler] Active sessions: ${activeSessions.length}, threshold: ${this.config.archiveThreshold}`,
			)

			if (activeSessions.length <= this.config.archiveThreshold) {
				console.log("[MemoryScheduler] Archive threshold not reached, skipping")
				return
			}

			// 归档最旧的会话
			const sessionsToArchive = activeSessions
				.sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
				.slice(0, activeSessions.length - this.config.archiveThreshold)

			console.log(`[MemoryScheduler] Archiving ${sessionsToArchive.length} sessions...`)

			for (const session of sessionsToArchive) {
				try {
					const fileRotator = (this.memorySystem as any).fileRotator
					if (fileRotator) {
						await fileRotator.archiveSession(session.id)
						console.log(`[MemoryScheduler] Archived session: ${session.id}`)
					}
				} catch (error) {
					console.error(`[MemoryScheduler] Failed to archive session ${session.id}:`, error)
				}
			}

			console.log("[MemoryScheduler] Archive task completed")
		} catch (error) {
			console.error("[MemoryScheduler] Archive task failed:", error)
			throw error
		}
	}

	/**
	 * 执行索引重建任务
	 *
	 * 策略：
	 * 1. 扫描所有记忆文件
	 * 2. 重建索引
	 */
	private async scheduleIndexRebuild(): Promise<void> {
		console.log("[MemoryScheduler] Running index rebuild task...")

		try {
			const indexManager = (this.memorySystem as any).indexManager
			if (!indexManager) {
				console.warn("[MemoryScheduler] IndexManager not available, skipping rebuild")
				return
			}

			await indexManager.rebuildIndex()
			console.log("[MemoryScheduler] Index rebuild completed")
		} catch (error) {
			console.error("[MemoryScheduler] Index rebuild failed:", error)
			throw error
		}
	}

	/**
	 * 执行清理任务
	 *
	 * 策略：
	 * 1. 检查归档文件的创建时间
	 * 2. 删除超过阈值天数的归档文件
	 */
	private async scheduleCleanup(): Promise<void> {
		console.log("[MemoryScheduler] Running cleanup task...")

		try {
			const fileRotator = (this.memorySystem as any).fileRotator
			if (!fileRotator) {
				console.warn("[MemoryScheduler] FileRotator not available, skipping cleanup")
				return
			}

			const thresholdDate = new Date()
			thresholdDate.setDate(thresholdDate.getDate() - this.config.cleanupThresholdDays)

			console.log(`[MemoryScheduler] Cleaning up archives older than ${thresholdDate.toISOString()}`)

			await fileRotator.cleanupOldArchives(thresholdDate)
			console.log("[MemoryScheduler] Cleanup task completed")
		} catch (error) {
			console.error("[MemoryScheduler] Cleanup task failed:", error)
			throw error
		}
	}

	/**
	 * 获取调度器状态
	 */
	getStatus(): {
		isRunning: boolean
		config: MemorySchedulerConfig
		nextArchive: Date
		nextIndexRebuild: Date
		nextCleanup: Date
	} {
		const now = new Date()
		return {
			isRunning: this.isRunning,
			config: this.config,
			nextArchive: new Date(now.getTime() + this.config.archiveIntervalMs),
			nextIndexRebuild: new Date(now.getTime() + this.config.indexRebuildIntervalMs),
			nextCleanup: new Date(now.getTime() + this.config.cleanupIntervalMs),
		}
	}

	/**
	 * 更新配置
	 */
	updateConfig(config: Partial<MemorySchedulerConfig>): void {
		this.config = { ...this.config, ...config }
		console.log("[MemoryScheduler] Config updated:", this.config)

		// 重启调度器以应用新配置
		if (this.isRunning) {
			this.stop()
			this.start()
		}
	}

	/**
	 * 清理资源
	 */
	dispose(): void {
		this.stop()
	}
}
