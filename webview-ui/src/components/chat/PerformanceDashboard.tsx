import React, { useMemo } from "react"
import { formatLargeNumber } from "@/utils/format"
import { StandardTooltip } from "@/components/ui"

interface PerformanceMetrics {
	// Token使用
	totalTokensIn: number
	totalTokensOut: number
	averageTokensPerRequest: number
	// 成本
	totalCost: number
	averageCostPerRequest: number
	// 响应时间
	averageResponseTime: number
	slowestResponseTime: number
	fastestResponseTime: number
	// API请求
	totalRequests: number
	successfulRequests: number
	failedRequests: number
	// 子Agent
	subAgentInvocations: number
	subAgentSuccessRate: number
	subAgentTotalCost: number
	// 压缩
	compressionCount: number
	compressionSavedTokens: number
	// 缓存
	cacheHitRate: number
	cacheWrites: number
	cacheReads: number
}

interface PerformanceDashboardProps {
	metrics: PerformanceMetrics
	className?: string
}

/**
 * PerformanceDashboard - 实时性能仪表板
 * 显示实时性能指标
 */
export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ metrics, className = "" }) => {
	// 计算成功率
	const successRate = useMemo(() => {
		if (metrics.totalRequests === 0) return 0
		return (metrics.successfulRequests / metrics.totalRequests) * 100
	}, [metrics.successfulRequests, metrics.totalRequests])

	// 性能评级
	const performanceRating = useMemo(() => {
		if (successRate >= 95 && metrics.averageResponseTime < 5000) return "excellent"
		if (successRate >= 90 && metrics.averageResponseTime < 10000) return "good"
		if (successRate >= 80) return "fair"
		return "poor"
	}, [successRate, metrics.averageResponseTime])

	// 获取评级颜色
	const getRatingColor = (rating: string) => {
		switch (rating) {
			case "excellent":
				return "text-vscode-charts-green"
			case "good":
				return "text-vscode-charts-blue"
			case "fair":
				return "text-vscode-charts-orange"
			case "poor":
				return "text-vscode-charts-red"
			default:
				return "text-vscode-descriptionForeground"
		}
	}

	// 获取评级文本
	const getRatingText = (rating: string) => {
		switch (rating) {
			case "excellent":
				return "优秀"
			case "good":
				return "良好"
			case "fair":
				return "一般"
			case "poor":
				return "较差"
			default:
				return "未知"
		}
	}

	// 格式化时间（毫秒）
	const formatTime = (ms: number) => {
		if (ms < 1000) return `${ms.toFixed(0)}ms`
		return `${(ms / 1000).toFixed(1)}s`
	}

	// 渲染指标卡片
	const MetricCard = ({
		title,
		value,
		subtitle,
		icon,
		color = "text-vscode-charts-blue",
		tooltip,
	}: {
		title: string
		value: string | number
		subtitle?: string
		icon: string
		color?: string
		tooltip?: string
	}) => (
		<StandardTooltip content={tooltip || title}>
			<div className="bg-vscode-input-background border border-vscode-panel-border rounded-md p-3 hover:bg-vscode-list-hoverBackground transition-colors">
				<div className="flex items-center gap-2 mb-1">
					<span className={`codicon codicon-${icon} ${color}`}></span>
					<span className="text-xs text-vscode-descriptionForeground font-medium">{title}</span>
				</div>
				<div className="text-lg font-bold text-vscode-foreground">{value}</div>
				{subtitle && <div className="text-xs text-vscode-descriptionForeground mt-1">{subtitle}</div>}
			</div>
		</StandardTooltip>
	)

	// 渲染进度条
	const ProgressBar = ({ percentage, color }: { percentage: number; color: string }) => (
		<div className="h-2 bg-vscode-input-background rounded-full overflow-hidden">
			<div
				className={`h-full ${color} transition-all duration-300`}
				style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
			/>
		</div>
	)

	return (
		<div className={`bg-vscode-input-background border border-vscode-panel-border rounded-md p-4 ${className}`}>
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<span className="codicon codicon-dashboard text-vscode-charts-blue"></span>
					<h3 className="text-sm font-medium text-vscode-foreground">性能仪表板</h3>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-xs text-vscode-descriptionForeground">性能评级:</span>
					<span className={`text-sm font-bold ${getRatingColor(performanceRating)}`}>
						{getRatingText(performanceRating)}
					</span>
				</div>
			</div>

			{/* 核心指标 */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
				<MetricCard
					title="总请求"
					value={metrics.totalRequests}
					subtitle={`成功 ${metrics.successfulRequests}`}
					icon="pulse"
					color="text-vscode-charts-blue"
					tooltip={`成功率: ${successRate.toFixed(1)}%`}
				/>
				<MetricCard
					title="Token使用"
					value={formatLargeNumber(metrics.totalTokensIn + metrics.totalTokensOut)}
					subtitle={`平均 ${formatLargeNumber(metrics.averageTokensPerRequest)}/次`}
					icon="symbol-misc"
					color="text-vscode-charts-purple"
					tooltip={`输入: ${formatLargeNumber(metrics.totalTokensIn)}, 输出: ${formatLargeNumber(metrics.totalTokensOut)}`}
				/>
				<MetricCard
					title="总成本"
					value={`$${metrics.totalCost.toFixed(2)}`}
					subtitle={`平均 $${metrics.averageCostPerRequest.toFixed(4)}/次`}
					icon="credit-card"
					color="text-vscode-charts-orange"
					tooltip="API调用总成本"
				/>
				<MetricCard
					title="平均响应"
					value={formatTime(metrics.averageResponseTime)}
					subtitle={`最快 ${formatTime(metrics.fastestResponseTime)}`}
					icon="watch"
					color="text-vscode-charts-green"
					tooltip={`最慢: ${formatTime(metrics.slowestResponseTime)}`}
				/>
			</div>

			{/* 成功率可视化 */}
			<div className="mb-4">
				<div className="flex items-center justify-between mb-2">
					<span className="text-xs font-medium text-vscode-descriptionForeground">API成功率</span>
					<span className="text-xs text-vscode-descriptionForeground">{successRate.toFixed(1)}%</span>
				</div>
				<ProgressBar
					percentage={successRate}
					color={
						successRate >= 95
							? "bg-vscode-charts-green"
							: successRate >= 80
								? "bg-vscode-charts-orange"
								: "bg-vscode-charts-red"
					}
				/>
			</div>

			{/* 子Agent和缓存统计 */}
			<div className="grid grid-cols-2 gap-3 mb-4">
				<div className="bg-vscode-editor-background border border-vscode-panel-border rounded-md p-3">
					<div className="flex items-center gap-2 mb-2">
						<span className="codicon codicon-organization text-vscode-charts-purple"></span>
						<span className="text-xs font-medium text-vscode-descriptionForeground">子Agent</span>
					</div>
					<div className="space-y-1 text-xs">
						<div className="flex justify-between">
							<span className="text-vscode-descriptionForeground">调用次数:</span>
							<span className="font-medium">{metrics.subAgentInvocations}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-vscode-descriptionForeground">成功率:</span>
							<span
								className={
									metrics.subAgentSuccessRate >= 90
										? "text-vscode-charts-green font-medium"
										: "font-medium"
								}>
								{metrics.subAgentSuccessRate.toFixed(1)}%
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-vscode-descriptionForeground">总成本:</span>
							<span className="font-medium">${metrics.subAgentTotalCost.toFixed(4)}</span>
						</div>
					</div>
				</div>

				<div className="bg-vscode-editor-background border border-vscode-panel-border rounded-md p-3">
					<div className="flex items-center gap-2 mb-2">
						<span className="codicon codicon-database text-vscode-charts-blue"></span>
						<span className="text-xs font-medium text-vscode-descriptionForeground">缓存</span>
					</div>
					<div className="space-y-1 text-xs">
						<div className="flex justify-between">
							<span className="text-vscode-descriptionForeground">命中率:</span>
							<span
								className={
									metrics.cacheHitRate >= 50 ? "text-vscode-charts-green font-medium" : "font-medium"
								}>
								{metrics.cacheHitRate.toFixed(1)}%
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-vscode-descriptionForeground">写入:</span>
							<span className="font-medium">{formatLargeNumber(metrics.cacheWrites)}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-vscode-descriptionForeground">读取:</span>
							<span className="font-medium">{formatLargeNumber(metrics.cacheReads)}</span>
						</div>
					</div>
				</div>
			</div>

			{/* 压缩效果 */}
			{metrics.compressionCount > 0 && (
				<div className="bg-vscode-editor-background border border-vscode-panel-border rounded-md p-3">
					<div className="flex items-center gap-2 mb-2">
						<span className="codicon codicon-fold text-vscode-charts-green"></span>
						<span className="text-xs font-medium text-vscode-descriptionForeground">上下文压缩</span>
					</div>
					<div className="grid grid-cols-2 gap-2 text-xs">
						<div className="flex justify-between">
							<span className="text-vscode-descriptionForeground">压缩次数:</span>
							<span className="font-medium">{metrics.compressionCount}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-vscode-descriptionForeground">节省Token:</span>
							<span className="font-medium text-vscode-charts-green">
								{formatLargeNumber(metrics.compressionSavedTokens)}
							</span>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
