import React, { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { X } from "lucide-react"

interface ApiRetryCountdownProps {
	errorMessage: string
	onRetry: () => void
	onCancel: () => void
	initialCountdown?: number
}

/**
 * API重试倒计时组件
 * 显示错误信息、倒计时进度条和取消按钮
 */
export const ApiRetryCountdown = ({
	errorMessage,
	onRetry,
	onCancel,
	initialCountdown = 30,
}: ApiRetryCountdownProps) => {
	const { t } = useTranslation("chat")
	const [countdown, setCountdown] = useState(initialCountdown)
	const [isActive, setIsActive] = useState(true)

	useEffect(() => {
		if (!isActive || countdown <= 0) {
			return
		}

		const timer = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					setIsActive(false)
					onRetry()
					return 0
				}
				return prev - 1
			})
		}, 1000)

		return () => clearInterval(timer)
	}, [countdown, isActive, onRetry])

	const handleCancel = useCallback(() => {
		setIsActive(false)
		setCountdown(0)
		onCancel()
	}, [onCancel])

	const progressPercentage = (countdown / initialCountdown) * 100

	return (
		<div className="border border-vscode-errorForeground/30 rounded bg-vscode-errorForeground/5 p-4 my-2">
			{/* 错误信息 */}
			<div className="flex items-center gap-2 mb-3">
				<span className="codicon codicon-error text-vscode-errorForeground" />
				<span className="text-vscode-errorForeground font-bold">{t("apiRetry.errorDetected")}</span>
			</div>

			{/* 错误详情 */}
			<p className="text-vscode-foreground mb-4 pl-6 text-sm">{errorMessage}</p>

			{/* 倒计时显示 */}
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<span className="text-sm text-vscode-foreground">
						{t("apiRetry.willRetryIn", { seconds: countdown })}
					</span>
					<VSCodeButton
						appearance="icon"
						onClick={handleCancel}
						title={t("apiRetry.cancelRetry")}
						className="text-vscode-descriptionForeground hover:text-vscode-foreground">
						<X className="w-4 h-4" />
					</VSCodeButton>
				</div>

				{/* 进度条 */}
				<div className="w-full bg-vscode-progressBar-background rounded-full h-2">
					<div
						className="bg-vscode-progressBar-foreground h-2 rounded-full transition-all duration-1000 ease-linear"
						style={{ width: `${progressPercentage}%` }}
					/>
				</div>
			</div>

			{/* 提示文本 */}
			<p className="text-xs text-vscode-descriptionForeground mt-3">{t("apiRetry.clickToCancel")}</p>
		</div>
	)
}

export default ApiRetryCountdown
