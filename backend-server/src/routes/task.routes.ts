import { Router } from "express"
import { taskController } from "../controllers/TaskController.js"
import { authenticate } from "../middleware/auth.js"

/**
 * 创建任务路由
 */
export function createTaskRouter(): Router {
	const router = Router()

	/**
	 * POST /api/tasks
	 * 创建任务
	 * 需要认证
	 */
	router.post("/", authenticate, (req, res) => taskController.createTask(req, res))

	/**
	 * GET /api/tasks/:id
	 * 获取任务详情
	 * 需要认证
	 */
	router.get("/:id", authenticate, (req, res) => taskController.getTask(req, res))

	/**
	 * PATCH /api/tasks/:id
	 * 更新任务信息
	 * 需要认证
	 */
	router.patch("/:id", authenticate, (req, res) => taskController.updateTask(req, res))

	/**
	 * DELETE /api/tasks/:id
	 * 删除任务
	 * 需要认证
	 */
	router.delete("/:id", authenticate, (req, res) => taskController.deleteTask(req, res))

	/**
	 * GET /api/tasks/user/:userId
	 * 列出用户的任务
	 * 需要认证
	 */
	router.get("/user/:userId", authenticate, (req, res) => taskController.listUserTasks(req, res))

	/**
	 * GET /api/tasks/organization/:organizationId
	 * 列出组织的任务
	 * 需要认证
	 */
	router.get("/organization/:organizationId", authenticate, (req, res) =>
		taskController.listOrganizationTasks(req, res),
	)

	/**
	 * PATCH /api/tasks/:id/status
	 * 更新任务状态
	 * 需要认证
	 */
	router.patch("/:id/status", authenticate, (req, res) => taskController.updateTaskStatus(req, res))

	/**
	 * POST /api/tasks/search
	 * 搜索任务
	 * 需要认证
	 */
	router.post("/search", authenticate, (req, res) => taskController.searchTasks(req, res))

	return router
}

/**
 * 导出默认路由实例
 */
export const taskRouter = createTaskRouter()
