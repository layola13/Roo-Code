import path from "path"
import fs from "fs/promises"
import { Task } from "../../task/Task"
import { getApiMetrics } from "../../../shared/getApiMetrics"
import { getModelMaxOutputTokens } from "../../../shared/api"

/**
 * 上下文可用性检查结果
 */
export interface ContextAvailability {
	/** 是否有足够空间读取文件 */
	hasEnoughSpace: boolean
	/** 当前上下文使用百分比 (0-100) */
	contextUsagePercent: number
	/** 可用的token数量 */
	availableTokens: number
	/** 当前已使用的token数量 */
	currentTokens: number
	/** 上下文窗口总容量 */
	contextWindow: number
	/** 为输出预留的token数量 */
	reservedTokens: number
}

/**
 * 估算文件的token消耗
 *
 * @param filePath 文件路径
 * @param fileSize 文件大小（字节）
 * @returns 估算的token数量
 */
export function estimateFileTokens(filePath: string, fileSize: number): number {
	const ext = path.extname(filePath).toLowerCase()

	// 代码文件通常有更高的token密度（更多符号、关键字）
	const codeExtensions = [
		".ts",
		".js",
		".jsx",
		".tsx",
		".py",
		".rs",
		".go",
		".java",
		".cpp",
		".c",
		".h",
		".hpp",
		".cs",
		".rb",
		".php",
		".swift",
		".kt",
		".scala",
		".m",
		".mm",
	]

	// 代码文件: 3字符/token, 普通文本: 4字符/token
	const charsPerToken = codeExtensions.includes(ext) ? 3 : 4

	// 考虑行号的额外开销
	// 假设平均每行50个字符，每行行号大约需要5个字符 "123 | "
	const estimatedLines = Math.max(1, Math.ceil(fileSize / 50))
	const lineNumberOverhead = estimatedLines * 5

	// 总token = (文件内容 + 行号开销) / 字符每token
	const totalTokens = Math.ceil((fileSize + lineNumberOverhead) / charsPerToken)

	return totalTokens
}

/**
 * 检查当前上下文是否有足够空间读取指定大小的文件
 *
 * @param cline Task实例
 * @param estimatedTokens 估算需要的token数量
 * @param safetyFactor 安全系数，默认1.2 (建议为估算值留20%余量)
 * @returns 上下文可用性信息
 */
export async function checkContextAvailability(
	cline: Task,
	estimatedTokens: number,
	safetyFactor: number = 1.2,
): Promise<ContextAvailability> {
	// 获取当前会话的API使用指标
	const apiMetrics = getApiMetrics(cline.clineMessages)
	const currentTokens = apiMetrics.contextTokens || 0

	// 获取模型信息
	const model = cline.api.getModel()
	const contextWindow = model.info.contextWindow

	// 获取为输出预留的token数量
	const maxTokens =
		getModelMaxOutputTokens({
			modelId: model.id,
			model: model.info,
			settings: cline.apiConfiguration,
		}) || 8192

	// 计算实际可用空间
	// 可用空间 = 总容量 - 当前使用 - 输出预留
	const availableTokens = Math.max(0, contextWindow - currentTokens - maxTokens)

	// 计算当前使用百分比
	const contextUsagePercent = (currentTokens / contextWindow) * 100

	// 判断是否有足够空间（考虑安全系数）
	const requiredTokens = Math.ceil(estimatedTokens * safetyFactor)
	const hasEnoughSpace = availableTokens >= requiredTokens

	return {
		hasEnoughSpace,
		contextUsagePercent,
		availableTokens,
		currentTokens,
		contextWindow,
		reservedTokens: maxTokens,
	}
}

/**
 * 检查文件扩展名是否被AST分析器支持
 *
 * @param filePath 文件路径
 * @returns 是否支持AST分析
 */
export function isSupportedByAstParser(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase()

	// 与 parseAstTool.ts 中的支持列表保持一致
	const supportedExtensions = [
		".js",
		".jsx",
		".ts",
		".tsx",
		".py",
		".rs",
		".go",
		".c",
		".h",
		".cpp",
		".hpp",
		".cs",
		".rb",
		".java",
		".php",
		".swift",
		".kt",
		".kts",
		".sol",
		".ex",
		".exs",
		".el",
		".html",
		".htm",
		".json",
		".css",
		".rdl",
		".ml",
		".mli",
		".lua",
		".scala",
		".toml",
		".zig",
		".ejs",
		".erb",
		".vb",
		".vue",
		".tla",
	]

	return supportedExtensions.includes(ext)
}

/**
 * 智能文件读取决策
 * 决定应该使用哪种方式读取文件
 */
export interface SmartReadDecision {
	/** 读取模式: 'full' = 完整读取, 'ast_summary' = AST摘要, 'line_preview' = 行预览 */
	mode: "full" | "ast_summary" | "line_preview"
	/** 决策原因 */
	reason: string
	/** 上下文可用性信息 */
	contextInfo: ContextAvailability
}

/**
 * 决定如何读取文件（完整 vs AST摘要 vs 行预览）
 *
 * @param cline Task实例
 * @param filePath 文件路径
 * @param fileSize 文件大小（字节）
 * @param smartReadEnabled 是否启用智能读取
 * @param contextThreshold 上下文使用阈值百分比 (0-100)，默认75%
 * @returns 智能读取决策
 */
export async function decideFileReadStrategy(
	cline: Task,
	filePath: string,
	fileSize: number,
	smartReadEnabled: boolean = true,
	contextThreshold: number = 75,
): Promise<SmartReadDecision> {
	// 估算文件token消耗
	const estimatedTokens = estimateFileTokens(filePath, fileSize)

	// 检查上下文可用性
	const contextInfo = await checkContextAvailability(cline, estimatedTokens)

	// 如果功能未启用，始终使用完整读取
	if (!smartReadEnabled) {
		return {
			mode: "full",
			reason: "Smart file read is disabled",
			contextInfo,
		}
	}

	// 如果有足够空间且上下文使用率低于阈值，使用完整读取
	if (contextInfo.hasEnoughSpace && contextInfo.contextUsagePercent < contextThreshold) {
		return {
			mode: "full",
			reason: `Sufficient context space available (${contextInfo.contextUsagePercent.toFixed(1)}% used, ${contextInfo.availableTokens} tokens available)`,
			contextInfo,
		}
	}

	// 空间不足，需要降级
	// 优先使用AST摘要（如果支持）
	if (isSupportedByAstParser(filePath)) {
		return {
			mode: "ast_summary",
			reason: `Limited context space (${contextInfo.contextUsagePercent.toFixed(1)}% used, only ${contextInfo.availableTokens} tokens available). Using AST summary mode to show function signatures and imports.`,
			contextInfo,
		}
	}

	// AST不支持的文件类型，使用行预览模式
	return {
		mode: "line_preview",
		reason: `Limited context space (${contextInfo.contextUsagePercent.toFixed(1)}% used) and file type not supported by AST parser. Showing first 100 lines.`,
		contextInfo,
	}
}

/**
 * 批量文件读取的智能分配策略
 *
 * @param cline Task实例
 * @param files 文件信息数组 [{path, size}]
 * @param smartReadEnabled 是否启用智能读取
 * @returns 每个文件的读取策略
 */
export async function decideBatchReadStrategy(
	cline: Task,
	files: Array<{ path: string; size: number }>,
	smartReadEnabled: boolean = true,
): Promise<Map<string, SmartReadDecision>> {
	const decisions = new Map<string, SmartReadDecision>()

	// 如果功能未启用，所有文件都使用完整读取
	if (!smartReadEnabled) {
		for (const file of files) {
			const estimatedTokens = estimateFileTokens(file.path, file.size)
			const contextInfo = await checkContextAvailability(cline, estimatedTokens)
			decisions.set(file.path, {
				mode: "full",
				reason: "Smart file read is disabled",
				contextInfo,
			})
		}
		return decisions
	}

	// 按文件大小排序，小文件优先完整读取
	const sortedFiles = [...files].sort((a, b) => a.size - b.size)

	// 获取当前上下文状态
	const apiMetrics = getApiMetrics(cline.clineMessages)
	const currentTokens = apiMetrics.contextTokens || 0
	const model = cline.api.getModel()
	const contextWindow = model.info.contextWindow
	const maxTokens =
		getModelMaxOutputTokens({
			modelId: model.id,
			model: model.info,
			settings: cline.apiConfiguration,
		}) || 8192

	let remainingTokens = Math.max(0, contextWindow - currentTokens - maxTokens)

	for (const file of sortedFiles) {
		const estimatedTokens = estimateFileTokens(file.path, file.size)
		const requiredTokens = Math.ceil(estimatedTokens * 1.2) // 1.2倍安全系数

		const contextInfo = await checkContextAvailability(cline, estimatedTokens)

		if (remainingTokens >= requiredTokens) {
			// 完整读取
			decisions.set(file.path, {
				mode: "full",
				reason: `Sufficient space in batch allocation (${remainingTokens} tokens available)`,
				contextInfo,
			})
			remainingTokens -= estimatedTokens
		} else if (isSupportedByAstParser(file.path)) {
			// AST摘要（约占10%空间）
			const astTokens = Math.ceil(estimatedTokens * 0.1)
			decisions.set(file.path, {
				mode: "ast_summary",
				reason: `Limited space in batch (${remainingTokens} tokens left). Using AST summary.`,
				contextInfo,
			})
			remainingTokens -= astTokens
		} else {
			// 行预览
			const previewTokens = Math.ceil(estimatedTokens * 0.2)
			decisions.set(file.path, {
				mode: "line_preview",
				reason: `Limited space in batch and AST not supported. Using line preview.`,
				contextInfo,
			})
			remainingTokens -= previewTokens
		}
	}

	return decisions
}
