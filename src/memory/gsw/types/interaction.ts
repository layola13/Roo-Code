/**
 * GSW三元记忆系统 - Interaction Memory类型定义
 * 用于存储用户交互和会话信息
 */

import { BaseMemory } from "./common"

/**
 * 用户目标记录
 */
export interface UserGoal {
	timestamp: string
	goal: string
	context: string
	context_switch: boolean
	previous_goal?: string
	/** 强制性指令列表（务必、禁止、必须等关键词提取的指令） */
	mandatory_instructions?: string[]
}

/**
 * Interaction Memory - 用户交互记忆
 */
export interface InteractionMemory extends BaseMemory {
	session_id: string
	start_time: string
	end_time?: string
	mode: string
	context_switches?: number
	user_goals: UserGoal[]
}
