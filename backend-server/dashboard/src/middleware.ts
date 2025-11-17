import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
	const token =
		request.cookies.get("auth_token")?.value || request.headers.get("authorization")?.replace("Bearer ", "")

	const isAuthPage = request.nextUrl.pathname.startsWith("/login")
	const isDashboardPage = request.nextUrl.pathname.startsWith("/dashboard")

	// Redirect to login if accessing dashboard without token
	if (isDashboardPage && !token) {
		return NextResponse.redirect(new URL("/login", request.url))
	}

	// Redirect to dashboard if accessing login with token
	if (isAuthPage && token) {
		return NextResponse.redirect(new URL("/dashboard", request.url))
	}

	return NextResponse.next()
}

export const config = {
	matcher: ["/dashboard/:path*", "/login"],
}
