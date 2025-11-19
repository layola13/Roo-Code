"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export interface TopStatItem {
	name: string
	value: number
	percentage: number
}

export interface TopStats {
	topCreators: TopStatItem[]
	topModels: TopStatItem[]
	topRepositories: TopStatItem[]
}

interface StatsTableProps {
	data: TopStats
	loading?: boolean
}

function StatRow({ item, index }: { item: TopStatItem; index: number }) {
	return (
		<TableRow>
			<TableCell className="font-medium">
				<Badge variant={index === 0 ? "default" : "secondary"}>{index + 1}</Badge>
			</TableCell>
			<TableCell className="max-w-xs truncate" title={item.name}>
				{item.name}
			</TableCell>
			<TableCell className="text-right">{item.value.toLocaleString()}</TableCell>
			<TableCell className="text-right">{item.percentage.toFixed(2)}%</TableCell>
		</TableRow>
	)
}

function StatSection({ title, items, emptyMessage }: { title: string; items: TopStatItem[]; emptyMessage: string }) {
	if (items.length === 0) {
		return (
			<div className="py-8 text-center text-muted-foreground">
				<p>{emptyMessage}</p>
			</div>
		)
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="w-16">Rank</TableHead>
					<TableHead>{title}</TableHead>
					<TableHead className="text-right">Usage</TableHead>
					<TableHead className="text-right">Share</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{items.map((item, index) => (
					<StatRow key={`${title}-${index}`} item={item} index={index} />
				))}
			</TableBody>
		</Table>
	)
}

export function StatsTable({ data, loading = false }: StatsTableProps) {
	if (loading) {
		return (
			<div className="grid gap-6 md:grid-cols-3">
				{["Top Creators", "Top Models", "Top Repositories"].map((title) => (
					<Card key={title}>
						<CardHeader>
							<CardTitle>{title}</CardTitle>
							<CardDescription>Loading...</CardDescription>
						</CardHeader>
						<CardContent className="h-64 flex items-center justify-center">
							<div className="animate-pulse text-muted-foreground">Loading...</div>
						</CardContent>
					</Card>
				))}
			</div>
		)
	}

	return (
		<div className="grid gap-6 md:grid-cols-3">
			{/* Top Creators */}
			<Card>
				<CardHeader>
					<CardTitle>Top Creators</CardTitle>
					<CardDescription>Most active users in the last 30 days</CardDescription>
				</CardHeader>
				<CardContent>
					<StatSection title="Creator" items={data.topCreators} emptyMessage="No creator data available" />
				</CardContent>
			</Card>

			{/* Top Models */}
			<Card>
				<CardHeader>
					<CardTitle>Top Models</CardTitle>
					<CardDescription>Most used AI models in the last 30 days</CardDescription>
				</CardHeader>
				<CardContent>
					<StatSection title="Model" items={data.topModels} emptyMessage="No model data available" />
				</CardContent>
			</Card>

			{/* Top Repositories */}
			<Card>
				<CardHeader>
					<CardTitle>Top Repositories</CardTitle>
					<CardDescription>Most accessed repositories in the last 30 days</CardDescription>
				</CardHeader>
				<CardContent>
					<StatSection
						title="Repository"
						items={data.topRepositories}
						emptyMessage="No repository data available"
					/>
				</CardContent>
			</Card>
		</div>
	)
}
