import { describe, it, expect } from "vitest"
import { User } from "../User.js"

describe("User Entity", () => {
	it("should create a User instance with required fields", () => {
		const user = new User()
		user.id = "user-123"
		user.email = "test@example.com"
		user.passwordHash = "hashed-password"
		user.name = "Test User"

		expect(user.id).toBe("user-123")
		expect(user.email).toBe("test@example.com")
		expect(user.passwordHash).toBe("hashed-password")
		expect(user.name).toBe("Test User")
	})

	it("should allow optional fields", () => {
		const user = new User()
		user.id = "user-123"
		user.email = "test@example.com"
		user.passwordHash = "hashed-password"

		expect(user.name).toBeUndefined()
		expect(user.settings).toBeUndefined()
	})

	it("should support settings as JSON", () => {
		const user = new User()
		user.id = "user-123"
		user.email = "test@example.com"
		user.passwordHash = "hashed-password"
		user.settings = {
			theme: "dark",
			notifications: true,
		}

		expect(user.settings).toEqual({
			theme: "dark",
			notifications: true,
		})
	})
})
