/**
 * 设置面板组件
 *
 * 功能：
 * - API 配置管理
 * - 主题设置
 * - 导入/导出配置
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { WebConfigManager } from "@/lib/config/WebConfigManager"
import type { RooCodeSettings } from "@roo-code/types"
import { X, Download, Upload, Save } from "lucide-react"

interface SettingsPanelProps {
	configManager: WebConfigManager
	onClose: () => void
}

export function SettingsPanel({ configManager, onClose }: SettingsPanelProps) {
	const [settings, setSettings] = useState<RooCodeSettings | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isSaving, setIsSaving] = useState(false)

	const loadSettings = useCallback(async () => {
		try {
			const loadedSettings = await configManager.getSettings()
			setSettings(loadedSettings)
		} catch (error) {
			console.error("Failed to load settings:", error)
		} finally {
			setIsLoading(false)
		}
	}, [configManager])

	useEffect(() => {
		loadSettings()
	}, [loadSettings])

	const handleSaveSettings = async () => {
		if (!settings) return

		setIsSaving(true)
		try {
			await configManager.saveSettings(settings)
			alert("设置已保存")
		} catch (error) {
			console.error("Failed to save settings:", error)
			alert("保存设置失败")
		} finally {
			setIsSaving(false)
		}
	}

	const handleExportSettings = async () => {
		try {
			const json = await configManager.exportSettings()
			const blob = new Blob([json], { type: "application/json" })
			const url = URL.createObjectURL(blob)
			const a = document.createElement("a")
			a.href = url
			a.download = `roo-code-settings-${Date.now()}.json`
			a.click()
			URL.revokeObjectURL(url)
		} catch (error) {
			console.error("Failed to export settings:", error)
			alert("导出设置失败")
		}
	}

	const handleImportSettings = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		try {
			const text = await file.text()
			await configManager.importSettings(text)
			await loadSettings()
			alert("设置已导入")
		} catch (error) {
			console.error("Failed to import settings:", error)
			alert("导入设置失败")
		}
	}

	if (isLoading) {
		return (
			<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
				<div className="bg-white dark:bg-gray-800 rounded-lg p-8">
					<div className="text-center">
						<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
						<p className="text-gray-700 dark:text-gray-300">加载设置中...</p>
					</div>
				</div>
			</div>
		)
	}

	if (!settings) {
		return null
	}

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
				{/* 头部 */}
				<div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white">设置</h2>
					<button
						onClick={onClose}
						className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
						<X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
					</button>
				</div>

				{/* 内容 */}
				<div className="flex-1 overflow-y-auto p-6 space-y-6">
					{/* API 配置 */}
					<section>
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">API 配置</h3>
						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									API 提供商
								</label>
								<select
									value={(settings as any).apiProvider || "anthropic"}
									onChange={(e) =>
										setSettings({
											...settings,
											apiProvider: e.target.value as any,
										} as any)
									}
									className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
									<option value="anthropic">Anthropic</option>
									<option value="openai">OpenAI</option>
									<option value="openrouter">OpenRouter</option>
									<option value="bedrock">AWS Bedrock</option>
									<option value="vertex">Google Vertex AI</option>
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									API 密钥
								</label>
								<input
									type="password"
									placeholder="输入您的 API 密钥"
									className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">密钥将被加密存储</p>
							</div>
						</div>
					</section>

					{/* 权限设置 */}
					<section>
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">权限设置</h3>
						<div className="space-y-3">
							<label className="flex items-center space-x-3">
								<input
									type="checkbox"
									checked={settings.alwaysAllowReadOnly || false}
									onChange={(e) =>
										setSettings({
											...settings,
											alwaysAllowReadOnly: e.target.checked,
										})
									}
									className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
								/>
								<span className="text-gray-700 dark:text-gray-300">自动允许只读操作</span>
							</label>

							<label className="flex items-center space-x-3">
								<input
									type="checkbox"
									checked={settings.alwaysAllowWrite || false}
									onChange={(e) =>
										setSettings({
											...settings,
											alwaysAllowWrite: e.target.checked,
										})
									}
									className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
								/>
								<span className="text-gray-700 dark:text-gray-300">自动允许文件写入</span>
							</label>

							<label className="flex items-center space-x-3">
								<input
									type="checkbox"
									checked={settings.diffEnabled !== false}
									onChange={(e) =>
										setSettings({
											...settings,
											diffEnabled: e.target.checked,
										})
									}
									className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
								/>
								<span className="text-gray-700 dark:text-gray-300">启用 Diff 视图</span>
							</label>
						</div>
					</section>

					{/* 导入/导出 */}
					<section>
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">导入/导出配置</h3>
						<div className="flex space-x-4">
							<button
								onClick={handleExportSettings}
								className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg flex items-center justify-center space-x-2 transition-colors">
								<Download className="w-4 h-4" />
								<span>导出</span>
							</button>

							<label className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg flex items-center justify-center space-x-2 transition-colors cursor-pointer">
								<Upload className="w-4 h-4" />
								<span>导入</span>
								<input type="file" accept=".json" onChange={handleImportSettings} className="hidden" />
							</label>
						</div>
					</section>
				</div>

				{/* 底部按钮 */}
				<div className="flex items-center justify-end space-x-4 p-6 border-t border-gray-200 dark:border-gray-700">
					<button
						onClick={onClose}
						className="py-2 px-6 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors">
						取消
					</button>
					<button
						onClick={handleSaveSettings}
						disabled={isSaving}
						className="py-2 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg flex items-center space-x-2 transition-colors">
						{isSaving ? (
							<div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
						) : (
							<Save className="w-4 h-4" />
						)}
						<span>{isSaving ? "保存中..." : "保存"}</span>
					</button>
				</div>
			</div>
		</div>
	)
}
