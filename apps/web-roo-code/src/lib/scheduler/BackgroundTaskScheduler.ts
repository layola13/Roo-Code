/**
 * 后台任务调度器
 *
 * 功能：
 * 1. 任务持久化到数据库
 * 2. 定时检查任务状态
 * 3. 支持任务恢复和重试
 */

import prisma from "../db/prisma"

export interface BackgroundTask {
	taskId: string
	userId: string
	status: "running" | "paused" | "completed" | "failed"
	lastActiveAt: number
	checkpoint?: unknown
}

export class BackgroundTaskScheduler {
	private checkInterval: NodeJS.Timeout | null = null
	private readonly CHECK_INTERVAL_MS = 60000 // 1分钟
	private readonly IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30分钟

	constructor() {
		this.startPeriodicCheck()
	}

	/**
	 * 提交后台任务
	 */
	async submitTask(task: BackgroundTask): Promise<void> {
		try {
			await prisma.task.upsert({
				where: { taskId: task.taskId },
				update: {
					status: task.status,
					updatedAt: new Date(),
				},
				create: {
					taskId: task.taskId,
					instanceId: `instance-${Date.now()}`,
					userId: task.userId,
					messages: [],
					configuration: {},
					status: task.status,
				},
			})

			// 保存检查点
			if (task.checkpoint) {
				await this.saveCheckpoint(task.taskId, task.checkpoint)
			}
		} catch (error) {
			console.error("[BackgroundTaskScheduler] Failed to submit task:", error)
			throw error
		}
	}

	/**
	 * 恢复后台任务
	 */
	async resumeTask(taskId: string): Promise<BackgroundTask | null> {
		try {
			const task = await prisma.task.findUnique({
				where: { taskId },
				include: {
					checkpoints: {
						orderBy: { timestamp: "desc" },
						take: 1,
					},
				},
			})

			if (!task) {
				return null
			}

			const checkpoint = task.checkpoints[0]

			return {
				taskId: task.taskId,
				userId: task.userId,
				status: task.status as "running" | "paused" | "completed" | "failed",
				lastActiveAt: task.updatedAt.getTime(),
				checkpoint: checkpoint ? checkpoint.data : undefined,
			}
		} catch (error) {
			console.error("[BackgroundTaskScheduler] Failed to resume task:", error)
			return null
		}
	}

	/**
	 * 保存任务检查点
	 */
	async saveCheckpoint(taskId: string, checkpoint: unknown): Promise<void> {
		try {
			await prisma.checkpoint.create({
				data: {
					taskId,
					data: checkpoint,
					timestamp: BigInt(Date.now()),
				},
			})
		} catch (error) {
			console.error("[BackgroundTaskScheduler] Failed to save checkpoint:", error)
		}
	}

	/**
	 * 获取最新检查点
	 */
	async getLatestCheckpoint(taskId: string): Promise<unknown | null> {
		try {
			const checkpoint = await prisma.checkpoint.findFirst({
				where: { taskId },
				orderBy: { timestamp: "desc" },
			})

			return checkpoint ? checkpoint.data : null
		} catch (error) {
			console.error("[BackgroundTaskScheduler] Failed to get checkpoint:", error)
			return null
		}
	}

	/**
	 * 启动定时检查
	 */
	private startPeriodicCheck(): void {
		if (this.checkInterval) {
			return
		}

		this.checkInterval = setInterval(async () => {
			await this.checkIdleTasks()
		}, this.CHECK_INTERVAL_MS)
	}

	/**
	 * 检查空闲任务
	 */
	private async checkIdleTasks(): Promise<void> {
		try {
			const idleThreshold = new Date(Date.now() - this.IDLE_TIMEOUT_MS)

			const idleTasks = await prisma.task.findMany({
				where: {
					status: "running",
					updatedAt: {
						lt: idleThreshold,
					},
				},
			})

			for (const task of idleTasks) {
				console.log(`[BackgroundTaskScheduler] Task ${task.taskId} appears idle, saving checkpoint...`)

				// 更新任务状态为暂停
				await prisma.task.update({
					where: { id: task.id },
					data: {
						status: "paused",
						updatedAt: new Date(),
					},
				})
			}
		} catch (error) {
			console.error("[BackgroundTaskScheduler] Error checking idle tasks:", error)
		}
	}

	/**
	 * 更新任务活动时间
	 */
	async updateTaskActivity(taskId: string): Promise<void> {
		try {
			await prisma.task.update({
				where: { taskId },
				data: { updatedAt: new Date() },
			})
		} catch (error) {
			console.error("[BackgroundTaskScheduler] Failed to update task activity:", error)
		}
	}

	/**
	 * 停止定时检查
	 */
	stop(): void {
		if (this.checkInterval) {
			clearInterval(this.checkInterval)
			this.checkInterval = null
		}
	}

	/**
	 * 获取用户的所有后台任务
	 */
	async getUserTasks(userId: string): Promise<BackgroundTask[]> {
		try {
			const tasks = await prisma.task.findMany({
				where: { userId },
				orderBy: { updatedAt: "desc" },
			})

			return tasks.map((task: { taskId: string; userId: string; status: string; updatedAt: Date }) => ({
				taskId: task.taskId,
				userId: task.userId,
				status: task.status as "running" | "paused" | "completed" | "failed",
				lastActiveAt: task.updatedAt.getTime(),
			}))
		} catch (error) {
			console.error("[BackgroundTaskScheduler] Failed to get user tasks:", error)
			return []
		}
	}
}

// 单例实例
let schedulerInstance: BackgroundTaskScheduler | null = null

export function getScheduler(): BackgroundTaskScheduler {
	if (!schedulerInstance) {
		schedulerInstance = new BackgroundTaskScheduler()
	}
	return schedulerInstance
}
