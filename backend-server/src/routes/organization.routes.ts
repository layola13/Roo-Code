import { Router } from "express"
import { organizationController } from "../controllers/OrganizationController.js"
import { authenticate } from "../middleware/auth.js"

/**
 * 创建组织路由
 */
export function createOrganizationRouter(): Router {
	const router = Router()

	/**
	 * GET /api/organizations
	 * 获取用户的组织列表
	 * 需要认证
	 */
	router.get("/", authenticate, (req, res) => organizationController.listUserOrganizations(req, res))

	/**
	 * POST /api/organizations
	 * 创建新组织
	 * 需要认证
	 */
	router.post("/", authenticate, (req, res) => organizationController.createOrganization(req, res))

	/**
	 * GET /api/organizations/:id
	 * 获取组织详情
	 * 需要认证
	 */
	router.get("/:id", authenticate, (req, res) => organizationController.getOrganization(req, res))

	/**
	 * PATCH /api/organizations/:id
	 * 更新组织信息
	 * 需要认证
	 */
	router.patch("/:id", authenticate, (req, res) => organizationController.updateOrganization(req, res))

	/**
	 * DELETE /api/organizations/:id
	 * 删除组织
	 * 需要认证
	 */
	router.delete("/:id", authenticate, (req, res) => organizationController.deleteOrganization(req, res))

	/**
	 * GET /api/organizations/:id/members
	 * 获取组织成员列表
	 * 需要认证
	 */
	router.get("/:id/members", authenticate, (req, res) => organizationController.listMembers(req, res))

	/**
	 * POST /api/organizations/:id/members
	 * 添加组织成员
	 * 需要认证
	 */
	router.post("/:id/members", authenticate, (req, res) => organizationController.addMember(req, res))

	/**
	 * DELETE /api/organizations/:id/members/:userId
	 * 移除组织成员
	 * 需要认证
	 */
	router.delete("/:id/members/:userId", authenticate, (req, res) => organizationController.removeMember(req, res))

	/**
	 * PATCH /api/organizations/:id/members/:userId/role
	 * 更新成员角色
	 * 需要认证
	 */
	router.patch("/:id/members/:userId/role", authenticate, (req, res) =>
		organizationController.updateMemberRole(req, res),
	)

	return router
}

/**
 * 导出默认路由实例
 */
export const organizationRouter = createOrganizationRouter()
