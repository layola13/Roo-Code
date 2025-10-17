import { memo } from "react"
import { HardDrive } from "lucide-react"
import { StandardTooltip } from "@src/components/ui"
import { cn } from "@src/lib/utils"

export interface StorageStatus {
	redis?: {
		connected: boolean
		url?: string
		error?: string
	}
	qdrant?: {
		connected: boolean
		url?: string
		error?: string
		collectionName?: string
	}
	sqlite?: {
		enabled: boolean
		path?: string
	}
}

interface StorageStatusIndicatorProps {
	status: StorageStatus
	compact?: boolean
}

const StorageStatusIndicator = ({ status, compact = false }: StorageStatusIndicatorProps) => {
	const { redis, qdrant, sqlite } = status

	// 如果所有存储都未配置，不显示
	if (!redis && !qdrant && !sqlite) {
		return null
	}

	if (compact) {
		// 紧凑模式：只显示图标和整体状态
		const hasConnected = redis?.connected || qdrant?.connected || sqlite?.enabled
		const statusColor = hasConnected ? "text-vscode-charts-green" : "text-vscode-descriptionForeground"

		return (
			<StandardTooltip
				content={
					<div className="space-y-2">
						<div className="font-medium">存储服务状态</div>
						{redis && (
							<div className="flex items-center gap-2">
								<span
									className={cn(
										"codicon",
										redis.connected
											? "codicon-pass text-vscode-charts-green"
											: "codicon-circle-slash text-vscode-charts-red",
									)}
								/>
								<span>Redis: {redis.connected ? "已连接" : "未连接"}</span>
								{redis.url && <span className="text-xs opacity-70">({redis.url})</span>}
							</div>
						)}
						{qdrant && (
							<div className="flex items-center gap-2">
								<span
									className={cn(
										"codicon",
										qdrant.connected
											? "codicon-pass text-vscode-charts-green"
											: "codicon-circle-slash text-vscode-charts-red",
									)}
								/>
								<span>Qdrant: {qdrant.connected ? "已连接" : "未连接"}</span>
								{qdrant.url && <span className="text-xs opacity-70">({qdrant.url})</span>}
							</div>
						)}
						{sqlite?.enabled && (
							<div className="flex items-center gap-2">
								<span className="codicon codicon-pass text-vscode-charts-green" />
								<span>SQLite: 已启用</span>
								{sqlite.path && <span className="text-xs opacity-70">({sqlite.path})</span>}
							</div>
						)}
					</div>
				}>
				<div className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-vscode-toolbar-hoverBackground">
					<HardDrive size={14} className={statusColor} />
					<span className={cn("text-xs", statusColor)}>{hasConnected ? "存储已连接" : "存储未连接"}</span>
				</div>
			</StandardTooltip>
		)
	}

	// 完整模式：显示详细状态
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2 text-xs font-medium text-vscode-descriptionForeground">
				<HardDrive size={14} />
				<span>存储服务状态</span>
			</div>
			<div className="flex flex-col gap-1.5 pl-5">
				{/* Redis 状态 */}
				{redis && (
					<div className="flex items-center gap-2 text-xs">
						<span
							className={cn(
								"codicon",
								redis.connected
									? "codicon-pass text-vscode-charts-green"
									: "codicon-circle-slash text-vscode-charts-red",
							)}
						/>
						<span className="font-medium min-w-[60px]">Redis:</span>
						<span className={redis.connected ? "text-vscode-charts-green" : "text-vscode-charts-red"}>
							{redis.connected ? "已连接" : "未连接"}
						</span>
						{redis.url && (
							<span className="text-vscode-descriptionForeground opacity-70 text-xs">{redis.url}</span>
						)}
						{redis.error && (
							<StandardTooltip content={redis.error}>
								<span className="codicon codicon-warning text-vscode-charts-orange" />
							</StandardTooltip>
						)}
					</div>
				)}

				{/* Qdrant 状态 */}
				{qdrant && (
					<div className="flex items-center gap-2 text-xs">
						<span
							className={cn(
								"codicon",
								qdrant.connected
									? "codicon-pass text-vscode-charts-green"
									: "codicon-circle-slash text-vscode-charts-red",
							)}
						/>
						<span className="font-medium min-w-[60px]">Qdrant:</span>
						<span className={qdrant.connected ? "text-vscode-charts-green" : "text-vscode-charts-red"}>
							{qdrant.connected ? "已连接" : "未连接"}
						</span>
						{qdrant.url && (
							<span className="text-vscode-descriptionForeground opacity-70 text-xs">{qdrant.url}</span>
						)}
						{qdrant.collectionName && (
							<span className="text-vscode-descriptionForeground opacity-70 text-xs">
								(集合: {qdrant.collectionName})
							</span>
						)}
						{qdrant.error && (
							<StandardTooltip content={qdrant.error}>
								<span className="codicon codicon-warning text-vscode-charts-orange" />
							</StandardTooltip>
						)}
					</div>
				)}

				{/* SQLite 状态 */}
				{sqlite?.enabled && (
					<div className="flex items-center gap-2 text-xs">
						<span className="codicon codicon-pass text-vscode-charts-green" />
						<span className="font-medium min-w-[60px]">SQLite:</span>
						<span className="text-vscode-charts-green">已启用</span>
						{sqlite.path && (
							<span className="text-vscode-descriptionForeground opacity-70 text-xs">{sqlite.path}</span>
						)}
					</div>
				)}

				{/* 如果没有任何存储服务，显示提示 */}
				{!redis && !qdrant && !sqlite?.enabled && (
					<div className="flex items-center gap-2 text-xs text-vscode-descriptionForeground opacity-60">
						<span className="codicon codicon-info" />
						<span>未配置存储服务。在设置中配置Redis/Qdrant以启用高级功能。</span>
					</div>
				)}
			</div>
		</div>
	)
}

export default memo(StorageStatusIndicator)
