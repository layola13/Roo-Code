"use client"

import { useEffect, useState } from "react"
import { usersAPI } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CloudUserInfo } from "@roo-code/types"
import { Search } from "lucide-react"

export default function UsersPage() {
	const [users, setUsers] = useState<CloudUserInfo[]>([])
	const [search, setSearch] = useState("")
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		usersAPI
			.list({ page: 1, limit: 50, search })
			.then((data) => setUsers(data.users))
			.catch(console.error)
			.finally(() => setLoading(false))
	}, [search])

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Users</h1>
				<p className="text-muted-foreground">Manage system users</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>User List</CardTitle>
					<div className="relative mt-4">
						<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search users..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-8"
						/>
					</div>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div>Loading...</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>ID</TableHead>
									<TableHead>Created</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{users.map((user) => (
									<TableRow key={user.id}>
										<TableCell className="font-medium">{user.name}</TableCell>
										<TableCell>{user.email}</TableCell>
										<TableCell className="font-mono text-sm">{user.id?.slice(0, 8)}...</TableCell>
										<TableCell>-</TableCell>
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
