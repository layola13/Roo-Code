"use client"

import React from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export interface TokenUsageTrendPoint {
	date: string
	inputTokens: number
	outputTokens: number
	totalTokens: number
}

interface TokenUsageChartProps {
	data: TokenUsageTrendPoint[]
	loading?: boolean
}

export function TokenUsageChart({ data, loading = false }: TokenUsageChartProps) {
	if (loading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Token Usage Trend</CardTitle>
					<CardDescription>Loading token usage data...</CardDescription>
				</CardHeader>
				<CardContent className="h-80 flex items-center justify-center">
					<div className="animate-pulse text-muted-foreground">Loading...</div>
				</CardContent>
			</Card>
		)
	}

	if (!data || data.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Token Usage Trend</CardTitle>
					<CardDescription>Token usage over the last 7 days</CardDescription>
				</CardHeader>
				<CardContent className="h-80 flex items-center justify-center">
					<p className="text-muted-foreground">No data available</p>
				</CardContent>
			</Card>
		)
	}

	// Format date for display
	const formattedData = data.map((point) => ({
		...point,
		date: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
	}))

	return (
		<Card>
			<CardHeader>
				<CardTitle>Token Usage Trend</CardTitle>
				<CardDescription>Token usage over the last {data.length} days</CardDescription>
			</CardHeader>
			<CardContent>
				<ResponsiveContainer width="100%" height={320}>
					<LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
						<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
						<XAxis dataKey="date" className="text-xs" />
						<YAxis className="text-xs" />
						<Tooltip
							contentStyle={{
								backgroundColor: "hsl(var(--background))",
								border: "1px solid hsl(var(--border))",
								borderRadius: "var(--radius)",
							}}
							labelStyle={{ color: "hsl(var(--foreground))" }}
						/>
						<Legend />
						<Line
							type="monotone"
							dataKey="inputTokens"
							stroke="hsl(var(--primary))"
							strokeWidth={2}
							name="Input Tokens"
							dot={{ fill: "hsl(var(--primary))" }}
						/>
						<Line
							type="monotone"
							dataKey="outputTokens"
							stroke="hsl(var(--destructive))"
							strokeWidth={2}
							name="Output Tokens"
							dot={{ fill: "hsl(var(--destructive))" }}
						/>
						<Line
							type="monotone"
							dataKey="totalTokens"
							stroke="hsl(var(--secondary))"
							strokeWidth={2}
							strokeDasharray="5 5"
							name="Total Tokens"
							dot={{ fill: "hsl(var(--secondary))" }}
						/>
					</LineChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	)
}
