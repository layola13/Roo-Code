"use client"

import { useEffect, useState } from "react"
import { dashboardAPI } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber, formatCurrency } from "@/lib/utils"
import { Users, Building2, ListTodo, TrendingUp } from "lucide-react"

export default function DashboardPage() {
	const [stats, setStats] = useState<any>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		dashboardAPI
			.getStats()
			.then(setStats)
			.catch(console.error)
			.finally(() => setLoading(false))
	}, [])

	if (loading) {
		return <div className="flex items-center justify-center h-full">Loading...</div>
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Dashboard Overview</h1>
				<p className="text-muted-foreground">System statistics and metrics</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Users</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatNumber(stats?.totalUsers || 0)}</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Organizations</CardTitle>
						<Building2 className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatNumber(stats?.totalOrganizations || 0)}</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
						<ListTodo className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatNumber(stats?.activeTasks || 0)}</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Cost (7d)</CardTitle>
						<TrendingUp className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{formatCurrency(stats?.totalCost || 0)}</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Recent Tasks</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{stats?.recentTasks?.slice(0, 5).map((task: any) => (
							<div key={task.taskId} className="flex items-center justify-between border-b pb-2">
								<div>
									<p className="font-medium">{task.taskId.slice(0, 8)}...</p>
									<p className="text-sm text-muted-foreground">{task.taskStatus}</p>
								</div>
								<div className="text-sm text-muted-foreground">
									{new Date(task.createdAt).toLocaleDateString()}
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
