"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { tasksAPI } from "@/lib/api"
import { useExtensionEvents } from "@/hooks/use-socket"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ExtensionTask, ExtensionBridgeEvent } from "@roo-code/types"
import { formatNumber, formatCurrency, formatRelativeTime } from "@/lib/utils"
import { Eye } from "lucide-react"

export default function TasksPage() {
	const [tasks, setTasks] = useState<ExtensionTask[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		tasksAPI
			.list({ page: 1, limit: 50 })
			.then((data) => setTasks(data.tasks))
			.catch(console.error)
			.finally(() => setLoading(false))
	}, [])

	const handleTaskEvent = useCallback((event: ExtensionBridgeEvent) => {
		const task = event.instance.task
		setTasks((prev) => {
			const index = prev.findIndex((t) => t.taskId === task.taskId)
			if (index >= 0) {
				const newTasks = [...prev]
				newTasks[index] = task
				return newTasks
			} else if (event.type === "taskCreated") {
				return [task, ...prev]
			}
			return prev
		})
	}, [])

	useExtensionEvents(handleTaskEvent)

	const getStatusColor = (status: string) => {
		switch (status) {
			case "active":
				return "bg-green-500"
			case "completed":
				return "bg-blue-500"
			case "aborted":
				return "bg-red-500"
			default:
				return "bg-gray-500"
		}
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Tasks</h1>
				<p className="text-muted-foreground">Monitor and manage tasks</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Task List</CardTitle>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div>Loading...</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Task ID</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Tokens</TableHead>
									<TableHead>Cost</TableHead>
									<TableHead>Created</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{tasks.map((task) => (
									<TableRow key={task.taskId}>
										<TableCell className="font-mono text-sm">
											{task.taskId.slice(0, 8)}...
										</TableCell>
										<TableCell>
											<Badge className={getStatusColor(task.taskStatus)}>{task.taskStatus}</Badge>
										</TableCell>
										<TableCell>
											{task.tokenUsage
												? formatNumber(
														task.tokenUsage.totalTokensIn + task.tokenUsage.totalTokensOut,
													)
												: "-"}
										</TableCell>
										<TableCell>
											{task.tokenUsage ? formatCurrency(task.tokenUsage.totalCost) : "-"}
										</TableCell>
										<TableCell>-</TableCell>
										<TableCell>
											<Link href={`/tasks/${task.taskId}`}>
												<Button variant="ghost" size="sm">
													<Eye className="h-4 w-4" />
												</Button>
											</Link>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
