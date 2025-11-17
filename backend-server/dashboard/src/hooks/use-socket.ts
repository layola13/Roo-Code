"use client"

import { useEffect, useState, useRef } from "react"
import { io, Socket } from "socket.io-client"
import type { ExtensionBridgeEvent, TaskBridgeEvent } from "@roo-code/types"

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000"

export function useSocket() {
	const [isConnected, setIsConnected] = useState(false)
	const [socket, setSocket] = useState<Socket | null>(null)
	const socketRef = useRef<Socket | null>(null)

	useEffect(() => {
		const token = localStorage.getItem("auth_token")
		if (!token) return

		const newSocket = io(SOCKET_URL, {
			auth: { token },
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionAttempts: 5,
		})

		newSocket.on("connect", () => {
			console.log("Socket connected")
			setIsConnected(true)
		})

		newSocket.on("disconnect", () => {
			console.log("Socket disconnected")
			setIsConnected(false)
		})

		newSocket.on("connect_error", (error) => {
			console.error("Socket connection error:", error)
		})

		socketRef.current = newSocket
		setSocket(newSocket)

		return () => {
			newSocket.close()
		}
	}, [])

	return { socket, isConnected }
}

export function useExtensionEvents(callback: (event: ExtensionBridgeEvent) => void) {
	const { socket } = useSocket()

	useEffect(() => {
		if (!socket) return

		socket.on("extension:relayed_event", callback)

		return () => {
			socket.off("extension:relayed_event", callback)
		}
	}, [socket, callback])
}

export function useTaskEvents(taskId: string, callback: (event: TaskBridgeEvent) => void) {
	const { socket } = useSocket()

	useEffect(() => {
		if (!socket || !taskId) return

		// Join task room
		socket.emit("task:join", taskId)

		// Listen for task events
		socket.on("task:relayed_event", callback)

		return () => {
			socket.emit("task:leave", taskId)
			socket.off("task:relayed_event", callback)
		}
	}, [socket, taskId, callback])
}
