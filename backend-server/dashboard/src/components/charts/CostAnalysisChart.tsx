"use client"

import React from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export interface CostAnalysisPoint {
	date: string
	modelCosts: Record<string, number>
	totalCost: number
}

interface CostAnalysisChartProps {
	data: CostAnalysisPoint[]
	loading?: boolean
}

// Predefined colors for different models
const MODEL_COLORS: Record<string, string> = {
	"gpt-4": "hsl(var(--primary))",
	"gpt-4-turbo": "hsl(var(--secondary))",
	"gpt-3.5-turbo": "hsl(var(--accent))",
	"claude-3-opus": "hsl(var(--destructive))",
	"claude-3-sonnet": "hsl(var(--warning))",
	default: "hsl(var(--muted-foreground))",
}

export function CostAnalysisChart({ data, loading = false }: CostAnalysisChartProps) {
	if (loading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Cost Analysis</CardTitle>
					<CardDescription>Loading cost analysis data...</CardDescription>
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
					<CardTitle>Cost Analysis</CardTitle>
					<CardDescription>API call costs by model over the last 7 days</CardDescription>
				</CardHeader>
				<CardContent className="h-80 flex items-center justify-center">
					<p className="text-muted-foreground">No data available</p>
				</CardContent>
			</Card>
		)
	}

	// Extract all unique models from the data
	const allModels = new Set<string>()
	data.forEach((point) => {
		Object.keys(point.modelCosts).forEach((model) => allModels.add(model))
	})
	const modelList = Array.from(allModels).sort()

	// Transform data for stacked bar chart
	const chartData = data.map((point) => {
		const formattedPoint: any = {
			date: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
		}

		// Add each model's cost
		modelList.forEach((model) => {
			formattedPoint[model] = point.modelCosts[model] || 0
		})

		return formattedPoint
	})

	// Calculate total cost
	const totalCost = data.reduce((sum, point) => sum + point.totalCost, 0)

	return (
		<Card>
			<CardHeader>
				<CardTitle>Cost Analysis</CardTitle>
				<CardDescription>
					API call costs by model over the last {data.length} days (Total: ${totalCost.toFixed(2)})
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ResponsiveContainer width="100%" height={320}>
					<BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
						<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
						<XAxis dataKey="date" className="text-xs" />
						<YAxis className="text-xs" tickFormatter={(value) => `$${value.toFixed(2)}`} />
						<Tooltip
							contentStyle={{
								backgroundColor: "hsl(var(--background))",
								border: "1px solid hsl(var(--border))",
								borderRadius: "var(--radius)",
							}}
							labelStyle={{ color: "hsl(var(--foreground))" }}
							formatter={(value: number) => `$${value.toFixed(4)}`}
						/>
						<Legend />
						{modelList.map((model, index) => (
							<Bar
								key={model}
								dataKey={model}
								stackId="cost"
								fill={MODEL_COLORS[model] || MODEL_COLORS.default}
								name={model}
							/>
						))}
					</BarChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	)
}
