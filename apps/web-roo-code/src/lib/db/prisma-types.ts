/**
 * Prisma Client 临时类型定义
 * 这个文件提供基本的类型定义，直到 Prisma Client 能够正常生成
 */

export interface Task {
	id: string
	taskId: string
	instanceId: string
	userId: string
	messages: unknown
	configuration: unknown
	status: string
	createdAt: Date
	updatedAt: Date
	checkpoints: Checkpoint[]
}

export interface Checkpoint {
	id: string
	taskId: string
	data: unknown
	timestamp: bigint
	createdAt: Date
}

export interface Settings {
	id: string
	userId: string
	data: unknown
	timestamp: bigint
	version: number
	createdAt: Date
	updatedAt: Date
}

export interface User {
	id: string
	email: string
	name: string | null
	createdAt: Date
	updatedAt: Date
}

// Mock Prisma Client
export interface PrismaClient {
	task: {
		findUnique: (args: { where: { taskId: string }; include?: unknown }) => Promise<Task | null>
		findMany: (args: { where?: unknown; orderBy?: unknown }) => Promise<Task[]>
		upsert: (args: { where: unknown; update: unknown; create: unknown }) => Promise<Task>
		update: (args: { where: unknown; data: unknown }) => Promise<Task>
		delete: (args: { where: unknown }) => Promise<Task>
	}
	checkpoint: {
		findFirst: (args: { where: unknown; orderBy?: unknown }) => Promise<Checkpoint | null>
		create: (args: { data: unknown }) => Promise<Checkpoint>
	}
	settings: {
		findUnique: (args: { where: unknown }) => Promise<Settings | null>
		upsert: (args: { where: unknown; update: unknown; create: unknown }) => Promise<Settings>
	}
	user: {
		findUnique: (args: { where: unknown }) => Promise<User | null>
		create: (args: { data: unknown }) => Promise<User>
	}
}
