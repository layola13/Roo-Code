/**
 * Web 配置管理器
 *
 * 功能：
 * 1. 管理应用配置的本地缓存
 * 2. 与云端配置同步
 * 3. 处理配置冲突
 */

import type { RooCodeSettings, ProviderSettings } from "@roo-code/types"

export interface WebConfigManagerConfig {
	cloudService?: unknown
	localStorageKey: string
	userId: string
}

export interface ConfigWithTimestamp {
	settings: RooCodeSettings
	timestamp: number
	version: number
}

/**
 * Web 配置管理器
 * 负责配置的本地缓存、云端同步和冲突解决
 */
export class WebConfigManager {
	private localStorageKey: string
	private userId: string
	private cloudService?: unknown
	private localCache: Map<string, unknown>
	private syncInProgress: boolean = false

	constructor(config: WebConfigManagerConfig) {
		this.localStorageKey = config.localStorageKey
		this.userId = config.userId
		this.cloudService = config.cloudService
		this.localCache = new Map()

		// 初始化时加载本地缓存
		this.loadLocalCache()
	}

	/**
	 * 从 localStorage 加载缓存
	 */
	private loadLocalCache(): void {
		try {
			const cached = localStorage.getItem(this.localStorageKey)

			if (cached) {
				const data = JSON.parse(cached)

				for (const [key, value] of Object.entries(data)) {
					this.localCache.set(key, value)
				}
			}
		} catch (error) {
			console.error("[WebConfigManager] Failed to load local cache:", error)
		}
	}

	/**
	 * 保存缓存到 localStorage
	 */
	private saveLocalCache(): void {
		try {
			const data = Object.fromEntries(this.localCache)
			localStorage.setItem(this.localStorageKey, JSON.stringify(data))
		} catch (error) {
			console.error("[WebConfigManager] Failed to save local cache:", error)
		}
	}

	/**
	 * 获取设置 - 优先云端，本地缓存作为备份
	 */
	async getSettings(): Promise<RooCodeSettings> {
		try {
			// 1. 尝试从云端获取
			if (this.cloudService) {
				const response = await fetch("/api/settings", {
					method: "GET",
					credentials: "include",
				})

				if (response.ok) {
					const cloudSettings: ConfigWithTimestamp = await response.json()

					// 更新本地缓存
					this.cacheSettings(cloudSettings.settings, cloudSettings.timestamp)

					return cloudSettings.settings
				}
			}
		} catch (error) {
			console.error("[WebConfigManager] Failed to fetch cloud settings:", error)
		}

		// 2. 回退到本地缓存
		const cached = this.getCachedSettings()

		if (cached) {
			return cached
		}

		// 3. 返回默认配置
		return this.getDefaultSettings()
	}

	/**
	 * 保存设置 - 同时保存到云端和本地
	 */
	async saveSettings(settings: RooCodeSettings): Promise<void> {
		const timestamp = Date.now()

		// 本地立即缓存
		this.cacheSettings(settings, timestamp)

		// 异步保存到云端
		try {
			const response = await fetch("/api/settings", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({
					settings,
					timestamp,
					userId: this.userId,
				}),
			})

			if (!response.ok) {
				throw new Error(`Failed to save settings: ${response.statusText}`)
			}
		} catch (error) {
			console.error("[WebConfigManager] Failed to save to cloud:", error)
			// 不阻塞，本地缓存已生效
		}
	}

	/**
	 * 同步配置
	 * 从云端拉取最新配置，并解决冲突
	 */
	async syncSettings(): Promise<void> {
		if (this.syncInProgress) {
			console.warn("[WebConfigManager] Sync already in progress")
			return
		}

		this.syncInProgress = true

		try {
			const response = await fetch("/api/settings/sync", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({
					localTimestamp: this.localCache.get("timestamp"),
					userId: this.userId,
				}),
			})

			if (!response.ok) {
				throw new Error(`Failed to sync settings: ${response.statusText}`)
			}

			const syncResult = await response.json()

			if (syncResult.conflict) {
				// 有冲突，需要解决
				const resolved = this.resolveConflict(
					this.getCachedSettings()!,
					syncResult.remoteSettings,
					(this.localCache.get("timestamp") as number) || 0,
					syncResult.remoteTimestamp,
				)

				// 保存解决后的配置
				await this.saveSettings(resolved)
			} else if (syncResult.updated) {
				// 无冲突，直接使用云端配置
				this.cacheSettings(syncResult.settings, syncResult.timestamp)
			}
		} catch (error) {
			console.error("[WebConfigManager] Failed to sync settings:", error)
			throw error
		} finally {
			this.syncInProgress = false
		}
	}

	/**
	 * 解决配置冲突
	 *
	 * 规则：
	 * 1. 最后写入获胜 (Last Write Wins)
	 * 2. 敏感配置以云端为准 (API Keys)
	 * 3. 本地配置优先 (UI 偏好)
	 */
	private resolveConflict(
		localSettings: RooCodeSettings,
		remoteSettings: RooCodeSettings,
		localTimestamp: number,
		remoteTimestamp: number,
	): RooCodeSettings {
		// 基本策略：时间戳较新的获胜
		if (remoteTimestamp > localTimestamp) {
			return {
				...remoteSettings,
				// 保留本地 UI 偏好
				soundEnabled: localSettings.soundEnabled,
				soundVolume: localSettings.soundVolume,
				ttsEnabled: localSettings.ttsEnabled,
				ttsSpeed: localSettings.ttsSpeed,
			}
		}

		// 返回本地设置（时间戳较旧）
		return localSettings
	}

	/**
	 * 缓存设置到本地
	 */
	private cacheSettings(settings: RooCodeSettings, timestamp: number): void {
		this.localCache.set("settings", settings)
		this.localCache.set("timestamp", timestamp)
		this.saveLocalCache()
	}

	/**
	 * 获取缓存的设置
	 */
	private getCachedSettings(): RooCodeSettings | null {
		return this.localCache.get("settings") || null
	}

	/**
	 * 获取默认配置
	 */
	private getDefaultSettings(): RooCodeSettings {
		return {
			apiConfiguration: {
				apiProvider: "anthropic",
			} as ProviderSettings,
			alwaysAllowReadOnly: false,
			alwaysAllowWrite: false,
			alwaysAllowExecute: false,
			soundEnabled: false,
			diffEnabled: true,
		} as RooCodeSettings
	}

	/**
	 * 清除本地缓存
	 */
	clearCache(): void {
		this.localCache.clear()
		localStorage.removeItem(this.localStorageKey)
	}

	/**
	 * 获取特定配置项
	 */
	async getSetting<K extends keyof RooCodeSettings>(key: K): Promise<RooCodeSettings[K] | undefined> {
		const settings = await this.getSettings()
		return settings[key]
	}

	/**
	 * 保存特定配置项
	 */
	async setSetting<K extends keyof RooCodeSettings>(key: K, value: RooCodeSettings[K]): Promise<void> {
		const settings = await this.getSettings()
		settings[key] = value
		await this.saveSettings(settings)
	}

	/**
	 * 导出配置
	 */
	async exportSettings(): Promise<string> {
		const settings = await this.getSettings()
		return JSON.stringify(settings, null, 2)
	}

	/**
	 * 导入配置
	 */
	async importSettings(json: string): Promise<void> {
		try {
			const settings = JSON.parse(json) as RooCodeSettings
			await this.saveSettings(settings)
		} catch (error) {
			console.error("[WebConfigManager] Failed to import settings:", error)
			throw new Error("Invalid settings JSON")
		}
	}
}
