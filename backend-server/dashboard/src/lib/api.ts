import type {
	CloudUserInfo,
	CloudOrganization,
	CloudOrganizationMembership,
	ExtensionTask,
	ClineMessage,
	OrganizationSettings,
	UserSettingsData,
	RooCodeTelemetryEvent,
	ShareResponse,
} from "@roo-code/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

export class APIError extends Error {
	constructor(
		message: string,
		public statusCode: number,
		public code?: string,
	) {
		super(message)
		this.name = "APIError"
	}
}

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
	const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...(options.headers as Record<string, string>),
	}

	if (token) {
		headers["Authorization"] = `Bearer ${token}`
	}

	const response = await fetch(`${API_URL}${endpoint}`, {
		...options,
		headers,
	})

	if (!response.ok) {
		const error = await response.json().catch(() => ({
			message: "An error occurred",
		}))
		throw new APIError(error.message || `HTTP ${response.status}`, response.status, error.code)
	}

	return response.json()
}

// Auth API
export const authAPI = {
	async login(email: string, password: string) {
		return fetchAPI<{
			accessToken: string
			refreshToken: string
			expiresIn: number
			user: CloudUserInfo
		}>("/api/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		})
	},

	async logout() {
		return fetchAPI<void>("/api/auth/logout", {
			method: "POST",
		})
	},

	async refreshToken(refreshToken: string) {
		return fetchAPI<{
			accessToken: string
			refreshToken: string
			expiresIn: number
			user: CloudUserInfo
		}>("/api/auth/refresh", {
			method: "POST",
			body: JSON.stringify({ refreshToken }),
		})
	},

	async getMe() {
		return fetchAPI<CloudUserInfo>("/api/auth/me")
	},

	async getOrganizations() {
		return fetchAPI<CloudOrganizationMembership[]>("/api/auth/organizations")
	},

	async switchOrganization(organizationId: string) {
		return fetchAPI<{
			accessToken: string
			refreshToken: string
			expiresIn: number
			user: CloudUserInfo
		}>("/api/auth/switch-organization", {
			method: "POST",
			body: JSON.stringify({ organizationId }),
		})
	},
}

// Organizations API
export const organizationsAPI = {
	async list() {
		return fetchAPI<CloudOrganization[]>("/api/organizations")
	},

	async get(id: string) {
		return fetchAPI<CloudOrganization>(`/api/organizations/${id}`)
	},

	async create(name: string) {
		return fetchAPI<CloudOrganization>("/api/organizations", {
			method: "POST",
			body: JSON.stringify({ name }),
		})
	},

	async update(id: string, data: Partial<CloudOrganization>) {
		return fetchAPI<CloudOrganization>(`/api/organizations/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		})
	},

	async getMembers(id: string) {
		return fetchAPI<CloudOrganizationMembership[]>(`/api/organizations/${id}/members`)
	},

	async addMember(id: string, userId: string, role: string) {
		return fetchAPI<void>(`/api/organizations/${id}/members`, {
			method: "POST",
			body: JSON.stringify({ userId, role }),
		})
	},

	async removeMember(id: string, userId: string) {
		return fetchAPI<void>(`/api/organizations/${id}/members/${userId}`, {
			method: "DELETE",
		})
	},

	async getSettings(id: string) {
		return fetchAPI<OrganizationSettings>(`/api/organizations/${id}/settings`)
	},

	async updateSettings(id: string, settings: Partial<OrganizationSettings>) {
		return fetchAPI<void>(`/api/organizations/${id}/settings`, {
			method: "PUT",
			body: JSON.stringify(settings),
		})
	},
}

// Tasks API
export const tasksAPI = {
	async list(params?: {
		page?: number
		limit?: number
		sortBy?: string
		sortOrder?: "ASC" | "DESC"
		status?: string
		userId?: string
		organizationId?: string
	}) {
		const query = new URLSearchParams()
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined) {
					query.append(key, String(value))
				}
			})
		}
		return fetchAPI<{
			tasks: ExtensionTask[]
			total: number
			page: number
			limit: number
		}>(`/api/tasks?${query.toString()}`)
	},

	async get(id: string) {
		return fetchAPI<ExtensionTask>(`/api/tasks/${id}`)
	},

	async getMessages(id: string) {
		return fetchAPI<ClineMessage[]>(`/api/tasks/${id}/messages`)
	},

	async createShare(taskId: string, visibility: "public" | "organization") {
		return fetchAPI<ShareResponse>("/api/extension/share", {
			method: "POST",
			body: JSON.stringify({ taskId, visibility }),
		})
	},
}

// Telemetry API
export const telemetryAPI = {
	async getStats(params: { organizationId?: string; startDate?: string; endDate?: string }) {
		const query = new URLSearchParams()
		Object.entries(params).forEach(([key, value]) => {
			if (value) {
				query.append(key, value)
			}
		})
		return fetchAPI<{
			totalEvents: number
			eventsByType: Record<string, number>
			totalTokens: number
			totalCost: number
			activeUsers: number
			trends: Array<{
				date: string
				events: number
				tokens: number
				cost: number
			}>
		}>(`/api/telemetry/stats?${query.toString()}`)
	},

	async captureEvent(event: RooCodeTelemetryEvent) {
		return fetchAPI<void>("/api/telemetry/events", {
			method: "POST",
			body: JSON.stringify(event),
		})
	},
}

// Settings API
export const settingsAPI = {
	async getUserSettings() {
		return fetchAPI<UserSettingsData>("/api/settings")
	},

	async updateUserSettings(settings: Partial<UserSettingsData>) {
		return fetchAPI<void>("/api/settings", {
			method: "PUT",
			body: JSON.stringify(settings),
		})
	},

	async getFeatures() {
		return fetchAPI<{
			taskSync: boolean
			telemetry: boolean
			sharing: boolean
		}>("/api/settings/features")
	},
}

// Dashboard Stats API
export const dashboardAPI = {
	async getStats() {
		return fetchAPI<{
			totalUsers: number
			totalOrganizations: number
			totalTasks: number
			activeTasks: number
			totalTokens: number
			totalCost: number
			onlineUsers: number
			recentTasks: ExtensionTask[]
			tokenTrend: Array<{
				date: string
				tokens: number
				cost: number
			}>
			activeUsersTrend: Array<{
				date: string
				count: number
			}>
		}>("/api/dashboard/stats")
	},

	async getOverview(organizationId?: string) {
		const query = organizationId ? `?organizationId=${organizationId}` : ""
		return fetchAPI<{
			totalApiCalls: number
			totalTokens: number
			totalCost: number
			activeUsers: number
		}>(`/api/v1/dashboard/overview${query}`)
	},

	async getTokenUsage(days: number = 7, organizationId?: string) {
		const params = new URLSearchParams({ days: String(days) })
		if (organizationId) {
			params.append("organizationId", organizationId)
		}
		return fetchAPI<
			Array<{
				date: string
				inputTokens: number
				outputTokens: number
				totalTokens: number
			}>
		>(`/api/v1/dashboard/token-usage?${params.toString()}`)
	},

	async getCostAnalysis(days: number = 7, organizationId?: string) {
		const params = new URLSearchParams({ days: String(days) })
		if (organizationId) {
			params.append("organizationId", organizationId)
		}
		return fetchAPI<
			Array<{
				date: string
				modelCosts: Record<string, number>
				totalCost: number
			}>
		>(`/api/v1/dashboard/cost-analysis?${params.toString()}`)
	},

	async getTopStats(organizationId?: string) {
		const query = organizationId ? `?organizationId=${organizationId}` : ""
		return fetchAPI<{
			topCreators: Array<{
				name: string
				value: number
				percentage: number
			}>
			topModels: Array<{
				name: string
				value: number
				percentage: number
			}>
			topRepositories: Array<{
				name: string
				value: number
				percentage: number
			}>
		}>(`/api/v1/dashboard/top-stats${query}`)
	},
}

// Users API (for admin dashboard)
export const usersAPI = {
	async list(params?: { page?: number; limit?: number; search?: string }) {
		const query = new URLSearchParams()
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined) {
					query.append(key, String(value))
				}
			})
		}
		return fetchAPI<{
			users: CloudUserInfo[]
			total: number
			page: number
			limit: number
		}>(`/api/users?${query.toString()}`)
	},

	async get(id: string) {
		return fetchAPI<CloudUserInfo>(`/api/users/${id}`)
	},
}
