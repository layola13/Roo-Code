"use client"

import { useEffect, useRef, useState } from "react"

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
			console.log("SSE connected:", url)
			setIsConnected(true)
			options.onOpen?.()
		}

		eventSource.onmessage = (event) => {
			options.onMessage?.(event)
		}

		eventSource.onerror = (error) => {
			console.error("SSE error:", error)
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
}
