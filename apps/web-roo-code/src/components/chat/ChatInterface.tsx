/**
 * 聊天界面组件
 *
 * 核心功能：
 * - 显示对话历史
 * - 接收用户输入
 * - 流式显示 AI 响应
 * - 工具调用可视化
 */

"use client"

import { useState, useEffect, useRef } from "react"
import { WebTaskProvider } from "@/lib/providers/WebTaskProvider"
import { WebConfigManager } from "@/lib/config/WebConfigManager"
import { FileProxyClient } from "@/lib/file-proxy/FileProxyClient"
import { RooCodeEventName } from "@roo-code/types"
import { Send, Square, Loader2 } from "lucide-react"

interface ChatInterfaceProps {
	provider: WebTaskProvider
	configManager: WebConfigManager
	fileProxy: FileProxyClient
}

interface Message {
	role: "user" | "assistant" | "system"
	content: string
	timestamp: number
}

export function ChatInterface({ provider, configManager, fileProxy }: ChatInterfaceProps) {
	const [messages, setMessages] = useState<Message[]>([])
	const [input, setInput] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [currentTask, setCurrentTask] = useState<string | null>(null)
	const messagesEndRef = useRef<HTMLDivElement>(null)

	// 自动滚动到底部
	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}

	useEffect(() => {
		scrollToBottom()
	}, [messages])

	// 监听任务事件
	useEffect(() => {
		const handleTaskCreated = (task: unknown) => {
			console.log("Task created:", task)
			setIsLoading(true)
		}

		const handleTaskCompleted = (taskId: string) => {
			console.log("Task completed:", taskId)
			setIsLoading(false)
			setCurrentTask(null)
		}

		const handleTaskAborted = (taskId: string) => {
			console.log("Task aborted:", taskId)
			setIsLoading(false)
			setCurrentTask(null)
		}

		provider.on(RooCodeEventName.TaskCreated, handleTaskCreated)
		provider.on(RooCodeEventName.TaskCompleted, handleTaskCompleted)
		provider.on(RooCodeEventName.TaskAborted, handleTaskAborted)

		return () => {
			provider.off(RooCodeEventName.TaskCreated, handleTaskCreated)
			provider.off(RooCodeEventName.TaskCompleted, handleTaskCompleted)
			provider.off(RooCodeEventName.TaskAborted, handleTaskAborted)
		}
	}, [provider])

	// 发送消息
	const handleSendMessage = async () => {
		if (!input.trim() || isLoading) return

		const userMessage: Message = {
			role: "user",
			content: input.trim(),
			timestamp: Date.now(),
		}

		setMessages((prev) => [...prev, userMessage])
		setInput("")
		setIsLoading(true)

		try {
			// 创建新任务
			const task = await provider.createTask(userMessage.content)
			setCurrentTask(task.taskId)

			// TODO: 实现流式响应
			// 这里需要实际调用 AI API 并处理响应
			// 暂时使用模拟响应
			setTimeout(() => {
				const assistantMessage: Message = {
					role: "assistant",
					content:
						"我已收到您的请求。这是 Roo Code Web 版本的演示响应。实际功能需要配置 API 密钥并连接到 AI 服务。",
					timestamp: Date.now(),
				}
				setMessages((prev) => [...prev, assistantMessage])
				setIsLoading(false)
				setCurrentTask(null)
			}, 1500)
		} catch (error) {
			console.error("Failed to send message:", error)
			setIsLoading(false)
			setCurrentTask(null)

			const errorMessage: Message = {
				role: "system",
				content: `发送消息失败: ${error instanceof Error ? error.message : "未知错误"}`,
				timestamp: Date.now(),
			}
			setMessages((prev) => [...prev, errorMessage])
		}
	}

	// 取消当前任务
	const handleCancelTask = async () => {
		if (!currentTask) return

		try {
			await provider.cancelTask()
			setIsLoading(false)
			setCurrentTask(null)
		} catch (error) {
			console.error("Failed to cancel task:", error)
		}
	}

	// 处理 Enter 键发送
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			handleSendMessage()
		}
	}

	return (
		<div className="flex flex-col h-full">
			{/* 头部 */}
			<header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
				<h1 className="text-2xl font-bold text-gray-900 dark:text-white">Roo Code Web</h1>
				<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">AI 驱动的代码助手 - Web 版本</p>
			</header>

			{/* 消息列表 */}
			<div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
				{messages.length === 0 ? (
					<div className="flex items-center justify-center h-full text-center">
						<div>
							<h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
								欢迎使用 Roo Code Web
							</h2>
							<p className="text-gray-500 dark:text-gray-400">开始对话以使用 AI 代码助手功能</p>
						</div>
					</div>
				) : (
					messages.map((message, index) => (
						<div
							key={index}
							className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
							<div
								className={`max-w-[80%] rounded-lg px-4 py-3 ${
									message.role === "user"
										? "bg-blue-600 text-white"
										: message.role === "system"
											? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
											: "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
								}`}>
								<p className="whitespace-pre-wrap break-words">{message.content}</p>
								<span className="text-xs opacity-70 mt-2 block">
									{new Date(message.timestamp).toLocaleTimeString()}
								</span>
							</div>
						</div>
					))
				)}

				{isLoading && (
					<div className="flex justify-start">
						<div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3">
							<div className="flex items-center space-x-2">
								<Loader2 className="w-4 h-4 animate-spin text-blue-600" />
								<span className="text-gray-700 dark:text-gray-300">正在思考...</span>
							</div>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* 输入区域 */}
			<div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
				<div className="flex items-end space-x-4">
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="输入消息... (Shift+Enter 换行)"
						className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px] max-h-[200px]"
						rows={1}
						disabled={isLoading}
					/>

					{isLoading ? (
						<button
							onClick={handleCancelTask}
							className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-6 py-3 flex items-center space-x-2 transition-colors">
							<Square className="w-5 h-5" />
							<span>停止</span>
						</button>
					) : (
						<button
							onClick={handleSendMessage}
							disabled={!input.trim()}
							className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg px-6 py-3 flex items-center space-x-2 transition-colors">
							<Send className="w-5 h-5" />
							<span>发送</span>
						</button>
					)}
				</div>

				<p className="text-xs text-gray-500 dark:text-gray-400 mt-2">提示：使用 @ 提及文件，使用 / 调用命令</p>
			</div>
		</div>
	)
}
