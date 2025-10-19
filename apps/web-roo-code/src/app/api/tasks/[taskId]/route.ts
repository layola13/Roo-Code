/**
 * 单个任务的 API Routes
 *
 * 提供获取、更新、删除单个任务的操作
 */

import { NextRequest, NextResponse } from "next/server"

// 临时内存存储 - 实际应用中应使用数据库
interface TaskData {
	taskId: string
	instanceId: string
	userId: string
	messages: unknown[]
	configuration: unknown
	status: string
	createdAt: number
	updatedAt: number
}

const tasksStore = new Map<string, TaskData>()

/**
 * GET /api/tasks/[taskId] - 获取任务详情
 */
export async function GET(request: NextRequest, { params }: { params: { taskId: string } }) {
	try {
		const { taskId } = params

		const task = tasksStore.get(taskId)

		if (!task) {
			return NextResponse.json({ error: "Task not found" }, { status: 404 })
		}

		return NextResponse.json(task)
	} catch (error) {
		console.error(`[GET /api/tasks/${params.taskId}] Error:`, error)
		return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 })
	}
}

/**
 * PUT /api/tasks/[taskId] - 更新任务
 */
export async function PUT(request: NextRequest, { params }: { params: { taskId: string } }) {
	try {
		const { taskId } = params
		const body = await request.json()

		const task = tasksStore.get(taskId)

		if (!task) {
			return NextResponse.json({ error: "Task not found" }, { status: 404 })
		}

		// 更新任务
		const updatedTask = {
			...task,
			...body,
			taskId, // 确保 taskId 不被修改
			updatedAt: Date.now(),
		}

		tasksStore.set(taskId, updatedTask)

		return NextResponse.json({
			success: true,
			task: updatedTask,
		})
	} catch (error) {
		console.error(`[PUT /api/tasks/${params.taskId}] Error:`, error)
		return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
	}
}

/**
 * DELETE /api/tasks/[taskId] - 删除任务
 */
export async function DELETE(request: NextRequest, { params }: { params: { taskId: string } }) {
	try {
		const { taskId } = params

		const task = tasksStore.get(taskId)

		if (!task) {
			return NextResponse.json({ error: "Task not found" }, { status: 404 })
		}

		// 删除任务
		tasksStore.delete(taskId)

		return NextResponse.json({
			success: true,
			taskId,
		})
	} catch (error) {
		console.error(`[DELETE /api/tasks/${params.taskId}] Error:`, error)
		return NextResponse.json({ error: "Failed to delete task" }, { status: 500 })
	}
}
