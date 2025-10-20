/**
 * 配置管理 API
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db/prisma"

/**
 * GET /api/settings - 获取用户设置
 */
export async function GET(request: NextRequest) {
	try {
		const userId = request.headers.get("x-user-id")

		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		const settings = await prisma.settings.findUnique({
			where: { userId },
		})

		if (!settings) {
			return NextResponse.json({
				settings: {},
				timestamp: Date.now(),
				version: 1,
			})
		}

		return NextResponse.json({
			settings: settings.data,
			timestamp: Number(settings.timestamp),
			version: settings.version,
		})
	} catch (error) {
		console.error("[GET /api/settings] Error:", error)
		return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
	}
}

/**
 * PUT /api/settings - 保存用户设置
 */
export async function PUT(request: NextRequest) {
	try {
		const userId = request.headers.get("x-user-id")

		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		const body = await request.json()
		const { settings, timestamp } = body

		const updated = await prisma.settings.upsert({
			where: { userId },
			update: {
				data: settings,
				timestamp: BigInt(timestamp),
				version: { increment: 1 },
			},
			create: {
				userId,
				data: settings,
				timestamp: BigInt(timestamp),
				version: 1,
			},
		})

		return NextResponse.json({
			success: true,
			version: updated.version,
		})
	} catch (error) {
		console.error("[PUT /api/settings] Error:", error)
		return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
	}
}

/**
 * POST /api/settings/sync - 同步设置
 */
export async function POST(request: NextRequest) {
	try {
		const userId = request.headers.get("x-user-id")

		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
		}

		const body = await request.json()
		const { localTimestamp } = body

		const settings = await prisma.settings.findUnique({
			where: { userId },
		})

		if (!settings) {
			return NextResponse.json({
				updated: false,
				conflict: false,
			})
		}

		const remoteTimestamp = Number(settings.timestamp)

		if (localTimestamp && remoteTimestamp > localTimestamp) {
			// 远程更新，可能有冲突
			return NextResponse.json({
				updated: true,
				conflict: true,
				settings: settings.data,
				remoteTimestamp,
			})
		}

		return NextResponse.json({
			updated: false,
			conflict: false,
		})
	} catch (error) {
		console.error("[POST /api/settings/sync] Error:", error)
		return NextResponse.json({ error: "Failed to sync settings" }, { status: 500 })
	}
}
