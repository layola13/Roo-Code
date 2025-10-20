/**
 * Local API Server for Web Version Config Sync
 *
 * This server runs within the VSCode extension and provides HTTP endpoints
 * for the web version to access VSCode configuration and secrets.
 *
 * Security:
 * - Only accessible from localhost
 * - Optional token-based authentication
 * - CORS restricted to specific origins
 */

import * as http from "http"
import * as vscode from "vscode"
import { ContextProxy } from "../core/config/ContextProxy"

interface ServerConfig {
	port: number
	enableAuth: boolean
	allowedOrigins: string[]
	authToken?: string
}

export class LocalConfigServer {
	private server: http.Server | null = null
	private config: ServerConfig
	private context: ContextProxy

	constructor(context: ContextProxy, config: Partial<ServerConfig> = {}) {
		this.context = context
		this.config = {
			port: config.port || 3001,
			enableAuth: config.enableAuth ?? false,
			allowedOrigins: config.allowedOrigins || ["http://localhost:3000", "http://127.0.0.1:3000"],
			authToken: config.authToken || this.generateToken(),
		}
	}

	private generateToken(): string {
		return Math.random().toString(36).substring(2) + Date.now().toString(36)
	}

	/**
	 * Start the local API server
	 */
	async start(): Promise<void> {
		if (this.server) {
			console.log("[LocalConfigServer] Server already running")
			return
		}

		this.server = http.createServer((req, res) => {
			this.handleRequest(req, res)
		})

		return new Promise((resolve, reject) => {
			this.server!.listen(this.config.port, "localhost", () => {
				console.log(`[LocalConfigServer] Server started on http://localhost:${this.config.port}`)
				console.log(`[LocalConfigServer] Auth token: ${this.config.authToken}`)
				resolve()
			})

			this.server!.on("error", (error: NodeJS.ErrnoException) => {
				if (error.code === "EADDRINUSE") {
					console.error(`[LocalConfigServer] Port ${this.config.port} is already in use`)
				}
				reject(error)
			})
		})
	}

	/**
	 * Stop the server
	 */
	async stop(): Promise<void> {
		if (!this.server) {
			return
		}

		return new Promise((resolve) => {
			this.server!.close(() => {
				console.log("[LocalConfigServer] Server stopped")
				this.server = null
				resolve()
			})
		})
	}

	/**
	 * Handle incoming HTTP requests
	 */
	private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
		// Set CORS headers
		const origin = req.headers.origin
		if (origin && this.config.allowedOrigins.includes(origin)) {
			res.setHeader("Access-Control-Allow-Origin", origin)
			res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}

		// Handle OPTIONS preflight
		if (req.method === "OPTIONS") {
			res.writeHead(204)
			res.end()
			return
		}

		// Verify authentication
		if (this.config.enableAuth) {
			const authHeader = req.headers.authorization
			if (!authHeader || !authHeader.startsWith("Bearer ")) {
				this.sendError(res, 401, "Unauthorized")
				return
			}

			const token = authHeader.substring(7)
			if (token !== this.config.authToken) {
				this.sendError(res, 401, "Invalid token")
				return
			}
		}

		// Route handling
		const url = req.url || "/"
		const method = req.method || "GET"

		try {
			if (method === "GET" && url === "/health") {
				await this.handleHealth(req, res)
			} else if (method === "GET" && url === "/api/config") {
				await this.handleGetConfig(req, res)
			} else if (method === "GET" && url === "/api/config/current") {
				await this.handleGetCurrentConfig(req, res)
			} else if (method === "GET" && url === "/api/secrets") {
				await this.handleGetSecrets(req, res)
			} else if (method === "POST" && url === "/api/config/sync") {
				await this.handleSyncConfig(req, res)
			} else {
				this.sendError(res, 404, "Not found")
			}
		} catch (error) {
			console.error("[LocalConfigServer] Request error:", error)
			this.sendError(res, 500, error instanceof Error ? error.message : "Internal server error")
		}
	}

	/**
	 * Health check endpoint
	 */
	private async handleHealth(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
		this.sendJson(res, 200, {
			status: "ok",
			server: "roo-code-local-api",
			version: "1.0.0",
			authEnabled: this.config.enableAuth,
		})
	}

	/**
	 * Get full configuration (including secrets)
	 */
	private async handleGetConfig(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
		const globalSettings = this.context.getGlobalSettings()
		const providerSettings = this.context.getProviderSettings()

		// Get all secrets
		const secrets: Record<string, string | undefined> = {}
		const secretKeys = [
			"apiKey",
			"openRouterApiKey",
			"openAiApiKey",
			"geminiApiKey",
			"anthropicApiKey",
			"awsAccessKey",
			"awsSecretKey",
		]

		for (const key of secretKeys) {
			const value = this.context.getSecret(key as any)
			if (value) {
				secrets[key] = value
			}
		}

		this.sendJson(res, 200, {
			success: true,
			data: {
				...globalSettings,
				...providerSettings,
				...secrets,
			},
		})
	}

	/**
	 * Get current active API configuration
	 */
	private async handleGetCurrentConfig(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
		const providerSettings = this.context.getProviderSettings()
		const apiProvider = providerSettings.apiProvider

		let apiKey: string | undefined

		// Get the appropriate API key based on provider
		switch (apiProvider) {
			case "anthropic":
				apiKey = this.context.getSecret("apiKey")
				break
			case "openrouter":
				apiKey = this.context.getSecret("openRouterApiKey")
				break
			case "openai":
			case "openai-native":
				apiKey = this.context.getSecret("openAiApiKey")
				break
			case "gemini":
				apiKey = this.context.getSecret("geminiApiKey")
				break
			case "bedrock":
				apiKey = this.context.getSecret("awsAccessKey")
				break
		}

		this.sendJson(res, 200, {
			success: true,
			data: {
				apiProvider,
				apiKey,
				apiModelId: providerSettings.apiModelId,
				modelId: this.getModelId(providerSettings),
				currentApiConfigName: this.context.getGlobalState("currentApiConfigName"),
			},
		})
	}

	/**
	 * Get all secrets (for debugging - should be protected)
	 */
	private async handleGetSecrets(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
		// Only allow in development
		if (process.env.NODE_ENV === "production") {
			this.sendError(res, 403, "Forbidden in production")
			return
		}

		const secrets: Record<string, string | undefined> = {}
		const secretKeys = [
			"apiKey",
			"glamaApiKey",
			"openRouterApiKey",
			"awsAccessKey",
			"awsSecretKey",
			"openAiApiKey",
			"geminiApiKey",
			"anthropicApiKey",
		]

		for (const key of secretKeys) {
			const value = this.context.getSecret(key as any)
			if (value) {
				// Mask the key for security
				secrets[key] = value.substring(0, 10) + "..." + value.substring(value.length - 4)
			}
		}

		this.sendJson(res, 200, {
			success: true,
			data: secrets,
		})
	}

	/**
	 * Trigger configuration sync
	 */
	private async handleSyncConfig(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
		// Refresh secrets and state
		await this.context.refreshSecrets()

		this.sendJson(res, 200, {
			success: true,
			message: "Configuration synced successfully",
		})
	}

	/**
	 * Helper: Get model ID from provider settings
	 */
	private getModelId(settings: any): string | undefined {
		const modelIdKeys = ["apiModelId", "openRouterModelId", "openAiModelId", "geminiApiId", "ollamaModelId"]

		for (const key of modelIdKeys) {
			if (settings[key]) {
				return settings[key]
			}
		}

		return undefined
	}

	/**
	 * Send JSON response
	 */
	private sendJson(res: http.ServerResponse, status: number, data: any): void {
		res.writeHead(status, { "Content-Type": "application/json" })
		res.end(JSON.stringify(data))
	}

	/**
	 * Send error response
	 */
	private sendError(res: http.ServerResponse, status: number, message: string): void {
		this.sendJson(res, status, {
			success: false,
			error: message,
		})
	}

	/**
	 * Get server info for display
	 */
	getServerInfo() {
		return {
			running: this.server !== null,
			port: this.config.port,
			url: `http://localhost:${this.config.port}`,
			authToken: this.config.enableAuth ? this.config.authToken : null,
		}
	}
}

/**
 * Global server instance
 */
let serverInstance: LocalConfigServer | null = null

/**
 * Start the local config server
 */
export async function startLocalConfigServer(context: ContextProxy): Promise<LocalConfigServer> {
	if (serverInstance) {
		return serverInstance
	}

	serverInstance = new LocalConfigServer(context, {
		port: 3001,
		enableAuth: false, // Disabled for localhost-only access
		allowedOrigins: [
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"http://localhost:3002",
			"http://127.0.0.1:3002",
		],
	})

	await serverInstance.start()
	return serverInstance
}

/**
 * Stop the local config server
 */
export async function stopLocalConfigServer(): Promise<void> {
	if (serverInstance) {
		await serverInstance.stop()
		serverInstance = null
	}
}

/**
 * Get the current server instance
 */
export function getLocalConfigServer(): LocalConfigServer | null {
	return serverInstance
}
