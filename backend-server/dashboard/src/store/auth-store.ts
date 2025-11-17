import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { CloudUserInfo, CloudOrganizationMembership } from "@roo-code/types"

interface AuthState {
	user: CloudUserInfo | null
	token: string | null
	refreshToken: string | null
	organizations: CloudOrganizationMembership[]
	isAuthenticated: boolean
	isLoading: boolean

	// Actions
	setAuth: (data: { user: CloudUserInfo; token: string; refreshToken: string }) => void
	setOrganizations: (organizations: CloudOrganizationMembership[]) => void
	logout: () => void
	updateToken: (token: string, refreshToken: string) => void
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			user: null,
			token: null,
			refreshToken: null,
			organizations: [],
			isAuthenticated: false,
			isLoading: false,

			setAuth: (data) => {
				set({
					user: data.user,
					token: data.token,
					refreshToken: data.refreshToken,
					isAuthenticated: true,
				})
				// Store token in localStorage for API calls
				if (typeof window !== "undefined") {
					localStorage.setItem("auth_token", data.token)
					localStorage.setItem("refresh_token", data.refreshToken)
				}
			},

			setOrganizations: (organizations) => {
				set({ organizations })
			},

			logout: () => {
				set({
					user: null,
					token: null,
					refreshToken: null,
					organizations: [],
					isAuthenticated: false,
				})
				if (typeof window !== "undefined") {
					localStorage.removeItem("auth_token")
					localStorage.removeItem("refresh_token")
				}
			},

			updateToken: (token, refreshToken) => {
				set({ token, refreshToken })
				if (typeof window !== "undefined") {
					localStorage.setItem("auth_token", token)
					localStorage.setItem("refresh_token", refreshToken)
				}
			},
		}),
		{
			name: "auth-storage",
			partialize: (state) => ({
				user: state.user,
				token: state.token,
				refreshToken: state.refreshToken,
				organizations: state.organizations,
				isAuthenticated: state.isAuthenticated,
			}),
		},
	),
)
