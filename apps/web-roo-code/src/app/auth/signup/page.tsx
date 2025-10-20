"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"

export default function SignUpPage() {
	const router = useRouter()
	const [name, setName] = useState("")
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [error, setError] = useState("")
	const [loading, setLoading] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError("")

		if (password !== confirmPassword) {
			setError("Passwords do not match")
			return
		}

		if (password.length < 8) {
			setError("Password must be at least 8 characters")
			return
		}

		setLoading(true)

		try {
			const response = await fetch("/api/auth/register", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name,
					email,
					password,
				}),
			})

			const data = await response.json()

			if (!response.ok) {
				setError(data.error || "Registration failed")
				return
			}

			// Auto sign in after registration
			const result = await signIn("credentials", {
				email,
				password,
				redirect: false,
			})

			if (result?.error) {
				setError("Registration successful but auto-login failed. Please sign in manually.")
				setTimeout(() => router.push("/auth/signin"), 2000)
			} else {
				router.push("/")
			}
		} catch (err) {
			setError("An error occurred. Please try again.")
		} finally {
			setLoading(false)
		}
	}

	const handleGithubSignUp = () => {
		signIn("github", { callbackUrl: "/" })
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-vscode-editor-background">
			<div className="max-w-md w-full space-y-8 p-8 bg-vscode-sideBar-background rounded-lg border border-vscode-panel-border">
				<div>
					<h2 className="text-3xl font-bold text-center text-vscode-foreground">Create your account</h2>
					<p className="mt-2 text-center text-sm text-vscode-descriptionForeground">
						Join Roo Code to start coding with AI assistance
					</p>
				</div>

				<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
					{error && (
						<div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded">
							{error}
						</div>
					)}

					<div className="space-y-4">
						<div>
							<label htmlFor="name" className="block text-sm font-medium text-vscode-foreground mb-2">
								Name
							</label>
							<input
								id="name"
								name="name"
								type="text"
								autoComplete="name"
								required
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="w-full px-3 py-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-none focus:border-vscode-focusBorder"
								placeholder="John Doe"
							/>
						</div>

						<div>
							<label htmlFor="email" className="block text-sm font-medium text-vscode-foreground mb-2">
								Email address
							</label>
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="w-full px-3 py-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-none focus:border-vscode-focusBorder"
								placeholder="you@example.com"
							/>
						</div>

						<div>
							<label htmlFor="password" className="block text-sm font-medium text-vscode-foreground mb-2">
								Password
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="new-password"
								required
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full px-3 py-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-none focus:border-vscode-focusBorder"
								placeholder="••••••••"
							/>
							<p className="mt-1 text-xs text-vscode-descriptionForeground">
								Must be at least 8 characters
							</p>
						</div>

						<div>
							<label
								htmlFor="confirmPassword"
								className="block text-sm font-medium text-vscode-foreground mb-2">
								Confirm Password
							</label>
							<input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								autoComplete="new-password"
								required
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								className="w-full px-3 py-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-none focus:border-vscode-focusBorder"
								placeholder="••••••••"
							/>
						</div>
					</div>

					<div>
						<button
							type="submit"
							disabled={loading}
							className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-vscode-button-background hover:bg-vscode-button-hoverBackground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-vscode-focusBorder disabled:opacity-50 disabled:cursor-not-allowed">
							{loading ? "Creating account..." : "Create account"}
						</button>
					</div>

					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t border-vscode-panel-border"></div>
						</div>
						<div className="relative flex justify-center text-sm">
							<span className="px-2 bg-vscode-sideBar-background text-vscode-descriptionForeground">
								Or continue with
							</span>
						</div>
					</div>

					<div>
						<button
							type="button"
							onClick={handleGithubSignUp}
							className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-vscode-input-border rounded-md shadow-sm text-sm font-medium text-vscode-foreground bg-vscode-input-background hover:bg-vscode-list-hoverBackground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-vscode-focusBorder">
							<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
							</svg>
							Sign up with GitHub
						</button>
					</div>
				</form>

				<div className="text-center">
					<p className="text-sm text-vscode-descriptionForeground">
						Already have an account?{" "}
						<a
							href="/auth/signin"
							className="font-medium text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground">
							Sign in
						</a>
					</p>
				</div>
			</div>
		</div>
	)
}
