/**
 * 侧边栏组件
 *
 * 功能：
 * - 任务历史列表
 * - 文件浏览器
 * - 设置入口
 */

"use client"

import { useState, useEffect } from "react"
import { WebTaskProvider, WebTask } from "@/lib/providers/WebTaskProvider"
import { FileProxyClient } from "@/lib/file-proxy/FileProxyClient"
import { History, FolderOpen, Settings, Plus, Trash2 } from "lucide-react"

interface SidebarProps {
	provider: WebTaskProvider
	fileProxy: FileProxyClient
	onSettingsClick: () => void
}

export function Sidebar({ provider, fileProxy, onSettingsClick }: SidebarProps) {
	const [tasks, setTasks] = useState<WebTask[]>([])
	const [activeTab, setActiveTab] = useState<"tasks" | "files">("tasks")

	useEffect(() => {
		// 加载任务历史
		const loadTasks = () => {
			const taskHistory = provider.getTaskHistory()
			setTasks(taskHistory)
		}

		loadTasks()

		// 定期刷新任务列表
		const interval = setInterval(loadTasks, 5000)

		return () => clearInterval(interval)
	}, [provider])

	const handleNewTask = async () => {
		try {
			await provider.createTask()
			// 刷新任务列表
			setTasks(provider.getTaskHistory())
		} catch (error) {
			console.error("Failed to create new task:", error)
		}
	}

	const handleDeleteTask = async (taskId: string) => {
		try {
			await provider.deleteTask(taskId)
			setTasks(provider.getTaskHistory())
		} catch (error) {
			console.error("Failed to delete task:", error)
		}
	}

	const handleResumeTask = async (taskId: string) => {
		try {
			await provider.resumeTask(taskId)
		} catch (error) {
			console.error("Failed to resume task:", error)
		}
	}

	return (
		<aside className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
			{/* 头部 */}
			<div className="p-4 border-b border-gray-200 dark:border-gray-700">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold text-gray-900 dark:text-white">侧边栏</h2>
					<button
						onClick={onSettingsClick}
						className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
						title="设置">
						<Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
					</button>
				</div>

				{/* Tab 切换 */}
				<div className="flex space-x-2">
					<button
						onClick={() => setActiveTab("tasks")}
						className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
							activeTab === "tasks"
								? "bg-blue-600 text-white"
								: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
						}`}>
						<History className="w-4 h-4" />
						<span>任务</span>
					</button>
					<button
						onClick={() => setActiveTab("files")}
						className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
							activeTab === "files"
								? "bg-blue-600 text-white"
								: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
						}`}>
						<FolderOpen className="w-4 h-4" />
						<span>文件</span>
					</button>
				</div>
			</div>

			{/* 内容区域 */}
			<div className="flex-1 overflow-y-auto p-4">
				{activeTab === "tasks" ? (
					<div className="space-y-4">
						{/* 新建任务按钮 */}
						<button
							onClick={handleNewTask}
							className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center space-x-2 transition-colors">
							<Plus className="w-5 h-5" />
							<span>新建任务</span>
						</button>

						{/* 任务列表 */}
						<div className="space-y-2">
							{tasks.length === 0 ? (
								<p className="text-center text-gray-500 dark:text-gray-400 py-8">暂无任务历史</p>
							) : (
								tasks.map((task) => (
									<div
										key={task.taskId}
										className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer group"
										onClick={() => handleResumeTask(task.taskId)}>
										<div className="flex items-start justify-between">
											<div className="flex-1 min-w-0">
												<div className="flex items-center space-x-2 mb-1">
													<span
														className={`inline-block w-2 h-2 rounded-full ${
															task.status === "running"
																? "bg-green-500"
																: task.status === "completed"
																	? "bg-blue-500"
																	: task.status === "failed"
																		? "bg-red-500"
																		: "bg-gray-400"
														}`}></span>
													<span className="text-xs font-medium text-gray-500 dark:text-gray-400">
														{task.status}
													</span>
												</div>
												<p className="text-sm text-gray-900 dark:text-white truncate">
													{task.taskId}
												</p>
												<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
													{new Date(task.createdAt).toLocaleString()}
												</p>
											</div>
											<button
												onClick={(e) => {
													e.stopPropagation()
													handleDeleteTask(task.taskId)
												}}
												className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-opacity"
												title="删除任务">
												<Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
											</button>
										</div>
									</div>
								))
							)}
						</div>
					</div>
				) : (
					<div>
						<p className="text-center text-gray-500 dark:text-gray-400 py-8">文件浏览器功能开发中...</p>
						<p className="text-xs text-gray-400 dark:text-gray-500 text-center">
							未来将支持浏览和编辑 GitHub 仓库文件
						</p>
					</div>
				)}
			</div>
		</aside>
	)
}
