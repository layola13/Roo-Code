"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function SettingsPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Settings</h1>
				<p className="text-muted-foreground">System configuration and settings</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>System Settings</CardTitle>
				</CardHeader>
				<CardContent>
					<p>System settings will be implemented here.</p>
				</CardContent>
			</Card>
		</div>
	)
}
