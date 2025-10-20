/**
 * Roo Code Web - 聊天界面主页
 *
 * 功能：
 * - AI 驱动的代码助手对话界面
 * - 任务管理和历史记录
 * - 文件浏览和编辑
 * - 配置管理
 */

"use client"

import { useState, useEffect } from "react"
import { WebTaskProvider } from "@/lib/providers/WebTaskProvider"
import { WebConfigManager } from "@/lib/config/WebConfigManager"
import { FileProxyClient } from "@/lib/file-proxy/FileProxyClient"
import { ChatInterface } from "@/components/chat/ChatInterface"
import { Sidebar } from "@/components/chat/Sidebar"
import { SettingsPanel } from "@/components/chat/SettingsPanel"

export default function ChatPage() {
	const [provider, setProvider] = useState<WebTaskProvider | null>(null)
	const [configManager, setConfigManager] = useState<WebConfigManager | null>(null)
	const [fileProxy, setFileProxy] = useState<FileProxyClient | null>(null)
	const [showSettings, setShowSettings] = useState(false)
	const [isInitialized, setIsInitialized] = useState(false)

	useEffect(() => {
		let currentProvider: WebTaskProvider | null = null

		// 初始化核心服务
		const initializeServices = async () => {
			try {
				// TODO: 从认证会话获取 userId
				const userId = "demo-user"

				// 初始化配置管理器
				const config = new WebConfigManager({
					localStorageKey: "roo-code-settings",
					userId,
				})

				// 初始化文件代理
				const fileClient = new FileProxyClient({
					apiEndpoint: "/api",
					mode: "github",
				})

				// 获取配置
				const settings = await config.getSettings()

				// 初始化任务提供者
				const taskProvider = new WebTaskProvider({
					apiConfiguration: settings as any,
					fileProxyEndpoint: "/api",
					userId,
				})

				currentProvider = taskProvider
				setConfigManager(config)
				setFileProxy(fileClient)
				setProvider(taskProvider)
				setIsInitialized(true)
			} catch (error) {
				console.error("Failed to initialize services:", error)
			}
		}

		initializeServices()

		// 清理函数
		return () => {
			currentProvider?.dispose()
		}
	}, [])

	if (!isInitialized || !provider || !configManager || !fileProxy) {
		return (
			<div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
				<div className="text-center">
					<div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
					<p className="text-lg text-gray-700 dark:text-gray-300">正在初始化 Roo Code...</p>
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-screen bg-gray-50 dark:bg-gray-900">
			{/* 侧边栏 - 任务历史和文件浏览器 */}
			<Sidebar provider={provider} fileProxy={fileProxy} onSettingsClick={() => setShowSettings(true)} />

			{/* 主聊天界面 */}
			<main className="flex-1 flex flex-col">
				<ChatInterface provider={provider} configManager={configManager} fileProxy={fileProxy} />
			</main>

			{/* 设置面板 */}
			{showSettings && <SettingsPanel configManager={configManager} onClose={() => setShowSettings(false)} />}
		</div>
	)
}
