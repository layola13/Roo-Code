/**
 * Prisma Client 单例
 * 确保整个应用使用同一个数据库连接实例
 */

import type { PrismaClient } from "./prisma-types"

// 临时 Mock 实现，等待 Prisma Client 生成
const mockPrismaClient: PrismaClient = {
	task: {
		findUnique: async () => null,
		findMany: async () => [],
		upsert: async () => ({}) as any,
		update: async () => ({}) as any,
		delete: async () => ({}) as any,
	},
	checkpoint: {
		findFirst: async () => null,
		create: async () => ({}) as any,
	},
	settings: {
		findUnique: async () => null,
		upsert: async () => ({}) as any,
	},
	user: {
		findUnique: async () => null,
		create: async () => ({}) as any,
	},
}

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? mockPrismaClient

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma
}

export default prisma
