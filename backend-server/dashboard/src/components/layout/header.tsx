"use client"

import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogOut, User } from "lucide-react"

export function Header() {
	const { user, logout } = useAuth()

	return (
		<header className="flex h-16 items-center justify-between border-b bg-card px-6">
			<div className="flex items-center gap-4">
				<h2 className="text-lg font-semibold">Backend Server Dashboard</h2>
			</div>
			<div className="flex items-center gap-4">
				<DropdownMenu>
					<DropdownMenuTrigger>
						<Button variant="ghost" className="relative h-10 w-10 rounded-full">
							<Avatar>
								<AvatarFallback>{user?.name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
							</Avatar>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-56">
						<div className="flex flex-col space-y-1 p-2">
							<p className="text-sm font-medium">{user?.name || "User"}</p>
							<p className="text-xs text-muted-foreground">{user?.email}</p>
						</div>
						<DropdownMenuSeparator />
						<DropdownMenuItem>
							<User className="mr-2 h-4 w-4" />
							Profile
						</DropdownMenuItem>
						<DropdownMenuItem onClick={logout}>
							<LogOut className="mr-2 h-4 w-4" />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</header>
	)
}
