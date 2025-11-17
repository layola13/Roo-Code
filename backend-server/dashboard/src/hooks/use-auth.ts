"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth-store"
import { authAPI, APIError } from "@/lib/api"

export function useAuth() {
	const router = useRouter()
	const { user, token, isAuthenticated, setAuth, logout: storeLogout, setOrganizations } = useAuthStore()

	useEffect(() => {
		// Auto-refresh user info on mount if authenticated
		if (isAuthenticated && token) {
			authAPI.getMe().catch(() => {
				// Token might be expired, logout
				storeLogout()
				router.push("/login")
			})
		}
	}, [isAuthenticated, token, router, storeLogout])

	const login = async (email: string, password: string) => {
		try {
			const response = await authAPI.login(email, password)
			setAuth({
				user: response.user,
				token: response.accessToken,
				refreshToken: response.refreshToken,
			})

			// Fetch organizations
			const orgs = await authAPI.getOrganizations()
			setOrganizations(orgs)

			return { success: true }
		} catch (error) {
			if (error instanceof APIError) {
				return { success: false, error: error.message }
			}
			return { success: false, error: "Login failed" }
		}
	}

	const logout = async () => {
		try {
			await authAPI.logout()
		} catch (error) {
			// Ignore logout errors
			console.error("Logout error:", error)
		} finally {
			storeLogout()
			router.push("/login")
		}
	}

	const switchOrganization = async (organizationId: string) => {
		try {
			const response = await authAPI.switchOrganization(organizationId)
			setAuth({
				user: response.user,
				token: response.accessToken,
				refreshToken: response.refreshToken,
			})
			return { success: true }
		} catch (error) {
			if (error instanceof APIError) {
				return { success: false, error: error.message }
			}
			return { success: false, error: "Failed to switch organization" }
		}
	}

	const refreshToken = async () => {
		const storedRefreshToken = useAuthStore.getState().refreshToken
		if (!storedRefreshToken) {
			throw new Error("No refresh token available")
		}

		try {
			const response = await authAPI.refreshToken(storedRefreshToken)
			useAuthStore.getState().updateToken(response.accessToken, response.refreshToken)
			return response.accessToken
		} catch (error) {
			// Refresh failed, logout user
			storeLogout()
			router.push("/login")
			throw error
		}
	}

	return {
		user,
		isAuthenticated,
		login,
		logout,
		switchOrganization,
		refreshToken,
	}
}
