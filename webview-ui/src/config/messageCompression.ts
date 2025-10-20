/**
 * 消息压缩配置
 *
 * 用于管理聊天面板中消息的智能压缩策略，防止内存溢出
 */

import type { ClineSay } from "@roo-code/types"

/**
 * 压缩级别
 */
export type CompressionLevel = "light" | "medium" | "heavy"

/**
 * 消息压缩配置
 */
export const MESSAGE_COMPRESSION_CONFIG = {
	// 🔴 启用压缩（默认关闭，通过全局设置开启）
	ENABLED: false,

	// 🆕 每100条消息触发一次压缩检查
	CHECK_INTERVAL: 100,

	// 时间窗口：1小时（毫秒）
	TIME_WINDOW_HOURS: 1,
	TIME_WINDOW_MS: 3600000, // 1 hour in milliseconds

	// 🆕 每次压缩的批量大小
	BATCH_SIZE: 50,
	MAX_BATCH_SIZE: 100,

	// 触发完整清理的阈值（仍保留作为兜底）
	FULL_CLEANUP_THRESHOLD: 1500,
	TARGET_AFTER_CLEANUP: 800,

	// 永不压缩的消息类型
	NEVER_COMPRESS_TYPES: [
		"user_feedback",
		"user_feedback_diff",
		"completion_result",
		"checkpoint_saved",
		"error",
		"user_edit_todos",
	] as ClineSay[],

	// 永不压缩的 ask 类型
	NEVER_COMPRESS_ASK_TYPES: ["completion_result", "followup"],

	// 压缩级别配置 - 针对不同的消息类型
	COMPRESSION_RULES: {
		readFile: "medium",
		editedExistingFile: "medium",
		newFileCreated: "medium",
		appliedDiff: "medium",
		insertContent: "medium",
		command_output: "heavy",
		api_req_started: "light",
		browser_action: "heavy",
		browser_action_result: "heavy",
		mcp_server_request_started: "light",
		mcp_server_response: "medium",
		codebase_search_result: "medium",
	} as Record<string, CompressionLevel>,
} as const

/**
 * 压缩策略配置
 */
export const COMPRESSION_STRATEGIES = {
	light: {
		// 轻度压缩 - 压缩比 ~5-10%
		// 只添加压缩标记，保留完整内容
		preserveContent: true,
		maxContentLength: undefined,
		compressionRatio: 0.95, // 95% 保留
	},
	medium: {
		// 中度压缩 - 压缩比 ~50-70%
		// 保留关键信息，移除冗余内容
		preserveContent: false,
		maxContentLength: 500, // 限制内容长度
		compressionRatio: 0.5, // 50% 保留
	},
	heavy: {
		// 重度压缩 - 压缩比 ~90-95%
		// 只保留元数据，移除详细内容
		preserveContent: false,
		maxContentLength: 100, // 只保留简短摘要
		compressionRatio: 0.1, // 10% 保留
	},
} as const
