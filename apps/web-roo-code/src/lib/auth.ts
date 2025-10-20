import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GithubProvider from "next-auth/providers/github"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
	adapter: PrismaAdapter(prisma as any),
	session: {
		strategy: "jwt",
	},
	pages: {
		signIn: "/auth/signin",
		signOut: "/auth/signout",
		error: "/auth/error",
	},
	providers: [
		GithubProvider({
			clientId: process.env.GITHUB_ID || "",
			clientSecret: process.env.GITHUB_SECRET || "",
		}),
		CredentialsProvider({
			name: "credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				if (!credentials?.email || !credentials?.password) {
					throw new Error("Invalid credentials")
				}

				const user = await prisma.user.findUnique({
					where: {
						email: credentials.email,
					},
				})

				if (!user || !user.hashedPassword) {
					throw new Error("Invalid credentials")
				}

				const isCorrectPassword = await bcrypt.compare(credentials.password, user.hashedPassword)

				if (!isCorrectPassword) {
					throw new Error("Invalid credentials")
				}

				return {
					id: user.id,
					email: user.email,
					name: user.name,
				}
			},
		}),
	],
	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				token.id = user.id
				token.email = user.email
				token.name = user.name
			}
			return token
		},
		async session({ session, token }) {
			if (token && session.user) {
				// @ts-expect-error - NextAuth type mismatch
				session.user.id = token.id as string
				session.user.email = token.email as string
				session.user.name = token.name as string
			}
			return session
		},
	},
}
