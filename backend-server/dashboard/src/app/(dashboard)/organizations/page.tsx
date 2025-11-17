"use client"

import { useEffect, useState } from "react"
import { organizationsAPI } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CloudOrganization } from "@roo-code/types"

export default function OrganizationsPage() {
	const [organizations, setOrganizations] = useState<CloudOrganization[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		organizationsAPI
			.list()
			.then(setOrganizations)
			.catch(console.error)
			.finally(() => setLoading(false))
	}, [])

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Organizations</h1>
				<p className="text-muted-foreground">Manage organizations and members</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Organization List</CardTitle>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div>Loading...</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>ID</TableHead>
									<TableHead>Created</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{organizations.map((org) => (
									<TableRow key={org.id}>
										<TableCell className="font-medium">{org.name}</TableCell>
										<TableCell className="font-mono text-sm">{org.id.slice(0, 8)}...</TableCell>
										<TableCell>
											{org.created_at ? new Date(org.created_at).toLocaleDateString() : "-"}
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
