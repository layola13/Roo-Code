#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

function ensureDir(dir) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true })
	}
}

function writeFile(filePath, content) {
	ensureDir(path.dirname(filePath))
	fs.writeFileSync(filePath, content.trim() + "\n")
	console.log(`✓ Created: ${filePath}`)
}

const pages = {
	// Dashboard Overview Page
	"src/app/(dashboard)/page.tsx": `'use client'

import { useEffect, useState } from 'react'
import { dashboardAPI } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber, formatCurrency } from '@/lib/utils'
import { Users, Building2, ListTodo, TrendingUp } from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardAPI.getStats()
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
}`,

	// Users Page
	"src/app/(dashboard)/users/page.tsx": `'use client'

import { useEffect, useState } from 'react'
import { usersAPI } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CloudUserInfo } from '@roo-code/types'
import { Search } from 'lucide-react'

export default function UsersPage() {
  const [users, setUsers] = useState<CloudUserInfo[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    usersAPI.list({ page: 1, limit: 50, search })
      .then(data => setUsers(data.users))
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
                    <TableCell className="font-mono text-sm">{user.id.slice(0, 8)}...</TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}`,

	// Organizations Page
	"src/app/(dashboard)/organizations/page.tsx": `'use client'

import { useEffect, useState } from 'react'
import { organizationsAPI } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CloudOrganization } from '@roo-code/types'

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<CloudOrganization[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    organizationsAPI.list()
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
                    <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}`,

	// Tasks Page
	"src/app/(dashboard)/tasks/page.tsx": `'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { tasksAPI } from '@/lib/api'
import { useExtensionEvents } from '@/hooks/use-socket'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ExtensionTask, ExtensionBridgeEvent } from '@roo-code/types'
import { formatNumber, formatCurrency, formatRelativeTime } from '@/lib/utils'
import { Eye } from 'lucide-react'

export default function TasksPage() {
  const [tasks, setTasks] = useState<ExtensionTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    tasksAPI.list({ page: 1, limit: 50 })
      .then(data => setTasks(data.tasks))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleTaskEvent = useCallback((event: ExtensionBridgeEvent) => {
    const task = event.instance.task
    setTasks(prev => {
      const index = prev.findIndex(t => t.taskId === task.taskId)
      if (index >= 0) {
        const newTasks = [...prev]
        newTasks[index] = task
        return newTasks
      } else if (event.type === 'TaskCreated') {
        return [task, ...prev]
      }
      return prev
    })
  }, [])

  useExtensionEvents(handleTaskEvent)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'completed': return 'bg-blue-500'
      case 'aborted': return 'bg-red-500'
      default: return 'bg-gray-500'
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
                    <TableCell className="font-mono text-sm">{task.taskId.slice(0, 8)}...</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(task.taskStatus)}>
                        {task.taskStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.tokenUsage ? 
                        formatNumber(task.tokenUsage.totalTokensIn + task.tokenUsage.totalTokensOut) 
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {task.tokenUsage ? formatCurrency(task.tokenUsage.totalCost) : '-'}
                    </TableCell>
                    <TableCell>{formatRelativeTime(task.createdAt)}</TableCell>
                    <TableCell>
                      <Link href={\`/tasks/\${task.taskId}\`}>
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
}`,

	// Task Detail Page with SSE
	"src/app/(dashboard)/tasks/[taskId]/page.tsx": `'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { tasksAPI } from '@/lib/api'
import { useSSE } from '@/hooks/use-sse'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ExtensionTask, ClineMessage } from '@roo-code/types'
import { formatNumber, formatCurrency, calculateDuration, cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

export default function TaskDetailPage() {
  const params = useParams()
  const taskId = params.taskId as string
  const [task, setTask] = useState<ExtensionTask | null>(null)
  const [messages, setMessages] = useState<ClineMessage[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    tasksAPI.get(taskId)
      .then(setTask)
      .catch(console.error)
    
    tasksAPI.getMessages(taskId)
      .then(setMessages)
      .catch(console.error)
  }, [taskId])

  useSSE(
    \`/api/tasks/\${taskId}/events\`,
    {
      onMessage: (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.message) {
            setMessages(prev => [...prev, data.message])
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error)
        }
      }
    }
  )

  const isUserMessage = (message: ClineMessage) => {
    return message.type === 'ask' || message.say === 'user_feedback'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Task {taskId.slice(0, 8)}</h1>
        <p className="text-muted-foreground">Real-time task execution viewer</p>
      </div>

      {task && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Task Information</CardTitle>
              <Badge>{task.taskStatus}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Total Tokens</div>
                <div className="text-2xl font-bold">
                  {task.tokenUsage ? 
                    formatNumber(task.tokenUsage.totalTokensIn + task.tokenUsage.totalTokensOut) 
                    : '-'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Cost</div>
                <div className="text-2xl font-bold">
                  {task.tokenUsage ? formatCurrency(task.tokenUsage.totalCost) : '-'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Messages</div>
                <div className="text-2xl font-bold">{messages.length}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Duration</div>
                <div className="text-2xl font-bold">
                  {calculateDuration(task.createdAt, task.updatedAt)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {messages.map((message, index) => (
              <div
                key={\`\${message.ts}-\${index}\`}
                className={cn(
                  'flex gap-3',
                  isUserMessage(message) ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'rounded-lg px-4 py-2 max-w-[80%]',
                    isUserMessage(message)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <div className="text-xs opacity-70 mb-1">
                    {message.type === 'ask' ? \`Ask: \${message.ask}\` : \`Say: \${message.say}\`}
                  </div>
                  {message.text && (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{message.text}</ReactMarkdown>
                    </div>
                  )}
                  <div className="text-xs opacity-50 mt-1">
                    {new Date(message.ts).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}`,

	// Telemetry Page
	"src/app/(dashboard)/telemetry/page.tsx": `'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TelemetryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Telemetry Analytics</h1>
        <p className="text-muted-foreground">System telemetry and analytics</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Telemetry analytics features will be implemented here.</p>
        </CardContent>
      </Card>
    </div>
  )
}`,

	// Settings Page
	"src/app/(dashboard)/settings/page.tsx": `'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
}`,
}

console.log("🚀 Generating Dashboard pages...\\n")

Object.entries(pages).forEach(([filePath, content]) => {
	writeFile(filePath, content)
})

console.log(`
✅ Generated ${Object.keys(pages).length} pages successfully!

📋 All pages created:
- Dashboard Overview (/dashboard)
- Users Management (/dashboard/users)
- Organizations (/dashboard/organizations)
- Tasks Explorer (/dashboard/tasks)
- Task Detail Viewer (/dashboard/tasks/[taskId])
- Telemetry Analytics (/dashboard/telemetry)
- System Settings (/dashboard/settings)

🎉 All pages are ready to use!
`)
