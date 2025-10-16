/**
 * 子代理调用类型定义
 * 用于记录和展示子代理的调用历史
 */

/**
 * 子代理触发类型
 * - tool_call: 主动调用(大模型决策)
 * - auto_compress: 自动压缩(被动触发)
 */
export type SubAgentTriggerType = "tool_call" | "auto_compress"

/**
 * 子代理调用记录
 * 记录每次子代理调用的详细信息
 */
export interface SubAgentInvocation {
	/** 子代理名称 */
	agentName: string

	/** 调用时间戳 */
	timestamp: number

	/** 触发类型: 主动调用 vs 自动压缩 */
	triggerType: SubAgentTriggerType

	/** 任务描述(可选,用于主动调用) */
	task?: string

	/** 输入 token 数量 */
	tokensIn: number

	/** 输出 token 数量 */
	tokensOut: number

	/** API 调用成本 */
	cost: number

	/** 是否成功 */
	success: boolean

	/** 错误信息(如果失败) */
	error?: string
}
