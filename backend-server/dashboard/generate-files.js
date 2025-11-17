#!/usr/bin/env node

/**
 * Dashboard Files Generator
 *
 * This script generates all necessary files for the Dashboard project.
 * Run: node generate-files.js
 */

const fs = require("fs")
const path = require("path")

// Ensure directory exists
function ensureDir(dir) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true })
	}
}

// Write file with content
function writeFile(filePath, content) {
	ensureDir(path.dirname(filePath))
	fs.writeFileSync(filePath, content.trim() + "\n")
	console.log(`✓ Created: ${filePath}`)
}

// File templates
const files = {
	// Hooks
	"src/hooks/use-socket.ts": `'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import type { ExtensionBridgeEvent, TaskBridgeEvent } from '@roo-code/types'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000'

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) return

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    newSocket.on('connect', () => {
      console.log('Socket connected')
      setIsConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected')
      setIsConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  return { socket, isConnected }
}

export function useExtensionEvents(
  callback: (event: ExtensionBridgeEvent) => void
) {
  const { socket } = useSocket()

  useEffect(() => {
    if (!socket) return

    socket.on('extension:relayed_event', callback)

    return () => {
      socket.off('extension:relayed_event', callback)
    }
  }, [socket, callback])
}

export function useTaskEvents(
  taskId: string,
  callback: (event: TaskBridgeEvent) => void
) {
  const { socket } = useSocket()

  useEffect(() => {
    if (!socket || !taskId) return

    // Join task room
    socket.emit('task:join', taskId)

    // Listen for task events
    socket.on('task:relayed_event', callback)

    return () => {
      socket.emit('task:leave', taskId)
      socket.off('task:relayed_event', callback)
    }
  }, [socket, taskId, callback])
}`,

	"src/hooks/use-sse.ts": `'use client'

import { useEffect, useRef, useState } from 'react'

interface UseSSEOptions {
  onMessage?: (event: MessageEvent) => void
  onError?: (error: Event) => void
  onOpen?: () => void
}

export function useSSE(url: string | null, options: UseSSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!url) return

    const eventSource = new EventSource(url, { withCredentials: true })

    eventSource.onopen = () => {
      console.log('SSE connected:', url)
      setIsConnected(true)
      options.onOpen?.()
    }

    eventSource.onmessage = (event) => {
      options.onMessage?.(event)
    }

    eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      setIsConnected(false)
      options.onError?.(error)
    }

    eventSourceRef.current = eventSource

    return () => {
      eventSource.close()
      setIsConnected(false)
    }
  }, [url])

  const close = () => {
    eventSourceRef.current?.close()
    setIsConnected(false)
  }

  return { isConnected, close }
}`,

	// Root Layout
	"src/app/layout.tsx": `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Backend Server Dashboard',
  description: 'Management dashboard for Roo Code backend server',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}`,

	// Root Page (redirect to dashboard)
	"src/app/page.tsx": `import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/dashboard')
}`,

	// Middleware for route protection
	"src/middleware.ts": `import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '')

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isDashboardPage = request.nextUrl.pathname.startsWith('/dashboard')

  // Redirect to login if accessing dashboard without token
  if (isDashboardPage && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect to dashboard if accessing login with token
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}`,

	// Login Page
	"src/app/(auth)/login/page.tsx": `'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const result = await login(email, password)
    
    setIsLoading(false)

    if (result.success) {
      router.push('/dashboard')
    } else {
      setError(result.error || 'Login failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Backend Dashboard</CardTitle>
          <CardDescription>
            Enter your credentials to access the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Log in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}`,

	// Dashboard Layout
	"src/app/(dashboard)/layout.tsx": `import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-muted/40 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}`,

	// Sidebar Component
	"src/components/layout/sidebar.tsx": `'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  ListTodo, 
  BarChart3, 
  Settings 
} from 'lucide-react'

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Users', href: '/dashboard/users', icon: Users },
  { name: 'Organizations', href: '/dashboard/organizations', icon: Building2 },
  { name: 'Tasks', href: '/dashboard/tasks', icon: ListTodo },
  { name: 'Telemetry', href: '/dashboard/telemetry', icon: BarChart3 },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden w-64 border-r bg-card md:block">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <h1 className="text-lg font-semibold">Dashboard</h1>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}`,

	// Header Component
	"src/components/layout/header.tsx": `'use client'

import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, User } from 'lucide-react'

export function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">Backend Server Dashboard</h2>
      </div>
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar>
                <AvatarFallback>
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
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
}`,
}

// Generate all files
console.log("🚀 Generating Dashboard files...\n")

Object.entries(files).forEach(([filePath, content]) => {
	writeFile(filePath, content)
})

console.log(`
✅ Generated ${Object.keys(files).length} files successfully!

📋 Next steps:
1. Install shadcn/ui components:
   npx shadcn-ui@latest add button card input label select table dialog dropdown-menu avatar badge separator tabs toast

2. Run the development server:
   npm run dev

3. Visit http://localhost:3001
`)
