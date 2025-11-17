"use client"

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { tasksAPI } from "@/lib/api"
import { useSSE } from "@/hooks/use-sse"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ExtensionTask, ClineMessage } from "@roo-code/types"
import { formatNumber, formatCurrency, calculateDuration, cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"

export default function TaskDetailPage() {
	const params = useParams()
	const taskId = params.taskId as string
	const [task, setTask] = useState<ExtensionTask | null>(null)
	const [messages, setMessages] = useState<ClineMessage[]>([])
	const messagesEndRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		tasksAPI.get(taskId).then(setTask).catch(console.error)

		tasksAPI.getMessages(taskId).then(setMessages).catch(console.error)
	}, [taskId])

	useSSE(`/api/tasks/${taskId}/events`, {
		onMessage: (event) => {
			try {
				const data = JSON.parse(event.data)
				if (data.message) {
					setMessages((prev) => [...prev, data.message])
					setTimeout(() => {
						messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
					}, 100)
				}
			} catch (error) {
				console.error("Failed to parse SSE message:", error)
			}
		},
	})

	const isUserMessage = (message: ClineMessage) => {
		return message.type === "ask" || message.say === "user_feedback"
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold">Task {taskId.slice(0, 8)}</h1>
				<p className="text-muted-foreground">Real-time task execution viewer</p>
			</div>

			{task && (
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle>Task Information</CardTitle>
							<Badge>{task.taskStatus}</Badge>
						</div>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div>
								<div className="text-sm text-muted-foreground">Total Tokens</div>
								<div className="text-2xl font-bold">
									{task.tokenUsage
										? formatNumber(task.tokenUsage.totalTokensIn + task.tokenUsage.totalTokensOut)
										: "-"}
								</div>
							</div>
							<div>
								<div className="text-sm text-muted-foreground">Total Cost</div>
								<div className="text-2xl font-bold">
									{task.tokenUsage ? formatCurrency(task.tokenUsage.totalCost) : "-"}
								</div>
							</div>
							<div>
								<div className="text-sm text-muted-foreground">Messages</div>
								<div className="text-2xl font-bold">{messages.length}</div>
							</div>
							<div>
								<div className="text-sm text-muted-foreground">Duration</div>
								<div className="text-2xl font-bold">-</div>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					<CardTitle>Conversation</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4 max-h-[600px] overflow-y-auto">
						{messages.map((message, index) => (
							<div
								key={`${message.ts}-${index}`}
								className={cn("flex gap-3", isUserMessage(message) ? "justify-end" : "justify-start")}>
								<div
									className={cn(
										"rounded-lg px-4 py-2 max-w-[80%]",
										isUserMessage(message) ? "bg-primary text-primary-foreground" : "bg-muted",
									)}>
									<div className="text-xs opacity-70 mb-1">
										{message.type === "ask" ? `Ask: ${message.ask}` : `Say: ${message.say}`}
									</div>
									{message.text && (
										<div className="prose prose-sm dark:prose-invert max-w-none">
											<ReactMarkdown>{message.text}</ReactMarkdown>
										</div>
									)}
									<div className="text-xs opacity-50 mt-1">
										{new Date(message.ts).toLocaleTimeString()}
									</div>
								</div>
							</div>
						))}
						<div ref={messagesEndRef} />
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
