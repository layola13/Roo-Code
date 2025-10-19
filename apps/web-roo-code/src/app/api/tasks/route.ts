/**
 * 任务管理 API Routes
 *
 * 提供任务的 CRUD 操作
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
 * GET /api/tasks - 获取用户的所有任务
 */
export async function GET(request: NextRequest) {
	try {
		// TODO: 实现用户认证
		// const session = await getServerSession()
		// if (!session?.user) {
		//   return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		// }

		// 从查询参数获取过滤条件
		const searchParams = request.nextUrl.searchParams
		const userId = searchParams.get("userId")
		const status = searchParams.get("status")

		// 获取所有任务
		const allTasks = Array.from(tasksStore.values())

		// 过滤任务
		let filteredTasks = allTasks

		if (userId) {
			filteredTasks = filteredTasks.filter((task) => task.userId === userId)
		}

		if (status) {
			filteredTasks = filteredTasks.filter((task) => task.status === status)
		}

		// 按创建时间倒序排列
		filteredTasks.sort((a, b) => b.createdAt - a.createdAt)

		return NextResponse.json(filteredTasks)
	} catch (error) {
		console.error("[GET /api/tasks] Error:", error)
		return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
	}
}

/**
 * POST /api/tasks - 创建新任务
 */
export async function POST(request: NextRequest) {
	try {
		// TODO: 实现用户认证
		// const session = await getServerSession()
		// if (!session?.user) {
		//   return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		// }

		const body = await request.json()
		const { taskId, instanceId, messages, configuration, userId } = body

		if (!taskId || !userId) {
			return NextResponse.json({ error: "Missing required fields: taskId, userId" }, { status: 400 })
		}

		// 创建任务对象
		const task = {
			taskId,
			instanceId: instanceId || `instance-${Date.now()}`,
			userId,
			messages: messages || [],
			configuration: configuration || {},
			status: "running",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		}

		// 保存到存储
		tasksStore.set(taskId, task)

		return NextResponse.json({
			success: true,
			task,
		})
	} catch (error) {
		console.error("[POST /api/tasks] Error:", error)
		return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
	}
}

/**
 * DELETE /api/tasks - 批量删除任务
 */
export async function DELETE(request: NextRequest) {
	try {
		const body = await request.json()
		const { taskIds } = body

		if (!Array.isArray(taskIds)) {
			return NextResponse.json({ error: "taskIds must be an array" }, { status: 400 })
		}

		// 删除任务
		for (const taskId of taskIds) {
			tasksStore.delete(taskId)
		}

		return NextResponse.json({
			success: true,
			deleted: taskIds.length,
		})
	} catch (error) {
		console.error("[DELETE /api/tasks] Error:", error)
		return NextResponse.json({ error: "Failed to delete tasks" }, { status: 500 })
	}
}
