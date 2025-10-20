/**
 * Web端VSCode配置同步客户端
 */

export interface SyncConfig {
	apiEndpoint: string
	pollInterval?: number
}

export class VSCodeSyncClient {
	private apiEndpoint: string
	private pollInterval: number
	private isPolling: boolean = false

	constructor(config: SyncConfig) {
		this.apiEndpoint = config.apiEndpoint
		this.pollInterval = config.pollInterval || 30000 // 默认30秒
	}

	/**
	 * 同步配置
	 */
	async syncConfig(): Promise<any> {
		try {
			const response = await fetch(`${this.apiEndpoint}/api/vscode-config`)
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`)
			}
			const data = await response.json()
			return data
		} catch (error) {
			console.error("Failed to sync config:", error)
			throw error
		}
	}

	/**
	 * 启动轮询同步
	 */
	startPolling(callback: (config: any) => void): void {
		if (this.isPolling) return

		this.isPolling = true
		const poll = async () => {
			if (!this.isPolling) return

			try {
				const config = await this.syncConfig()
				callback(config)
			} catch (error) {
				console.error("Polling error:", error)
			}

			if (this.isPolling) {
				setTimeout(poll, this.pollInterval)
			}
		}

		poll()
	}

	/**
	 * 停止轮询
	 */
	stopPolling(): void {
		this.isPolling = false
	}
}
