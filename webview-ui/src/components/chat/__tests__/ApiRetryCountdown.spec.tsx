import React from "react"
import { render, screen, fireEvent, act } from "@testing-library/react"

import { ApiRetryCountdown } from "../ApiRetryCountdown"

// Mock the translation hook
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: any) => {
			if (key === "apiRetry.errorDetected") {
				return "API Request Failed - Will Retry"
			}
			if (key === "apiRetry.willRetryIn" && options?.seconds !== undefined) {
				return `Retrying in ${options.seconds} seconds`
			}
			if (key === "apiRetry.cancelRetry") {
				return "Cancel Retry"
			}
			if (key === "apiRetry.clickToCancel") {
				return "Click button above to cancel retry"
			}
			return key
		},
	}),
}))

describe("ApiRetryCountdown", () => {
	const mockOnCancel = vi.fn()
	const mockOnRetry = vi.fn()
	const defaultProps = {
		errorMessage: "API流式转换失败",
		initialCountdown: 30,
		onCancel: mockOnCancel,
		onRetry: mockOnRetry,
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("should render with initial countdown of 30 seconds", () => {
		render(<ApiRetryCountdown {...defaultProps} />)

		expect(screen.getByText("API Request Failed - Will Retry")).toBeInTheDocument()
		expect(screen.getByText("API流式转换失败")).toBeInTheDocument()
		expect(screen.getByText("Retrying in 30 seconds")).toBeInTheDocument()
		expect(screen.getByTitle("Cancel Retry")).toBeInTheDocument()
	})

	it("should update countdown display as time progresses", async () => {
		render(<ApiRetryCountdown {...defaultProps} />)

		// Initially should show 30 seconds
		expect(screen.getByText("Retrying in 30 seconds")).toBeInTheDocument()

		// Advance timer by 1 second
		await act(async () => {
			vi.advanceTimersByTime(1000)
		})

		// Should show 29 seconds
		expect(screen.getByText("Retrying in 29 seconds")).toBeInTheDocument()

		// Advance timer by another 10 seconds
		await act(async () => {
			vi.advanceTimersByTime(10000)
		})

		// Should show 19 seconds
		expect(screen.getByText("Retrying in 19 seconds")).toBeInTheDocument()
	})

	it("should call onRetry when countdown reaches zero", async () => {
		render(<ApiRetryCountdown {...defaultProps} />)

		// Advance timer to completion (30 seconds)
		await act(async () => {
			vi.advanceTimersByTime(30000)
		})

		// onRetry should have been called
		expect(mockOnRetry).toHaveBeenCalledTimes(1)
		expect(mockOnCancel).not.toHaveBeenCalled()
	})

	it("should call onCancel when cancel button is clicked", () => {
		render(<ApiRetryCountdown {...defaultProps} />)

		const cancelButton = screen.getByTitle("Cancel Retry")
		fireEvent.click(cancelButton)

		// onCancel should have been called
		expect(mockOnCancel).toHaveBeenCalledTimes(1)
		expect(mockOnRetry).not.toHaveBeenCalled()
	})

	it("should stop countdown when cancel button is clicked", async () => {
		render(<ApiRetryCountdown {...defaultProps} />)

		// Advance timer partially
		await act(async () => {
			vi.advanceTimersByTime(5000)
		})

		expect(screen.getByText("Retrying in 25 seconds")).toBeInTheDocument()

		// Click cancel button
		const cancelButton = screen.getByTitle("Cancel Retry")
		fireEvent.click(cancelButton)

		// Advance timer past the original completion time
		await act(async () => {
			vi.advanceTimersByTime(30000)
		})

		// onRetry should NOT have been called
		expect(mockOnRetry).not.toHaveBeenCalled()
		expect(mockOnCancel).toHaveBeenCalledTimes(1)
	})

	it("should clean up timer on unmount", () => {
		const { unmount } = render(<ApiRetryCountdown {...defaultProps} />)

		// Unmount component
		unmount()

		// Advance timer past completion
		vi.advanceTimersByTime(35000)

		// Neither callback should have been called
		expect(mockOnRetry).not.toHaveBeenCalled()
		expect(mockOnCancel).not.toHaveBeenCalled()
	})

	it("should render with custom retry delay", () => {
		render(<ApiRetryCountdown {...defaultProps} initialCountdown={10} />)

		expect(screen.getByText("Retrying in 10 seconds")).toBeInTheDocument()
	})

	it("should handle different error messages", () => {
		render(<ApiRetryCountdown {...defaultProps} errorMessage="API 请求失败" />)

		expect(screen.getByText("API 请求失败")).toBeInTheDocument()
	})

	it("should update progress bar as countdown progresses", async () => {
		render(<ApiRetryCountdown {...defaultProps} />)

		// Get progress bar (it's a div, not a progressbar role element)
		const progressBar = document.querySelector(".bg-vscode-progressBar-foreground")
		expect(progressBar).toBeInTheDocument()

		// Initial progress should be 100% (30/30)
		expect(progressBar).toHaveStyle({ width: "100%" })

		// Advance timer by 15 seconds (halfway)
		await act(async () => {
			vi.advanceTimersByTime(15000)
		})

		// Progress should be 50% (15/30)
		expect(progressBar).toHaveStyle({ width: "50%" })

		// Advance timer by another 10 seconds
		await act(async () => {
			vi.advanceTimersByTime(10000)
		})

		// Progress should be ~16.67% (5/30)
		expect(progressBar).toHaveStyle({ width: "16.666666666666664%" })
	})

	it("should not call onRetry multiple times", async () => {
		render(<ApiRetryCountdown {...defaultProps} />)

		// Advance timer past completion multiple times
		await act(async () => {
			vi.advanceTimersByTime(30000)
		})

		await act(async () => {
			vi.advanceTimersByTime(5000)
		})

		// onRetry should only be called once
		expect(mockOnRetry).toHaveBeenCalledTimes(1)
	})

	it("should handle rapid cancel clicks gracefully", () => {
		render(<ApiRetryCountdown {...defaultProps} />)

		const cancelButton = screen.getByTitle("Cancel Retry")

		// Click cancel button multiple times rapidly
		fireEvent.click(cancelButton)
		fireEvent.click(cancelButton)
		fireEvent.click(cancelButton)

		// onCancel should still only be called once per click
		expect(mockOnCancel).toHaveBeenCalledTimes(3)
		expect(mockOnRetry).not.toHaveBeenCalled()
	})

	it("should render all UI elements correctly", () => {
		render(<ApiRetryCountdown {...defaultProps} />)

		// Check for title
		expect(screen.getByText("API Request Failed - Will Retry")).toBeInTheDocument()

		// Check for error message
		expect(screen.getByText("API流式转换失败")).toBeInTheDocument()

		// Check for countdown text
		expect(screen.getByText("Retrying in 30 seconds")).toBeInTheDocument()

		// Check for progress bar
		const progressBar = document.querySelector(".bg-vscode-progressBar-foreground")
		expect(progressBar).toBeInTheDocument()

		// Check for cancel button (it's an icon button with title)
		expect(screen.getByTitle("Cancel Retry")).toBeInTheDocument()
	})

	it("should handle zero seconds edge case", async () => {
		render(<ApiRetryCountdown {...defaultProps} initialCountdown={1} />)

		expect(screen.getByText("Retrying in 1 seconds")).toBeInTheDocument()

		// Advance to completion
		await act(async () => {
			vi.advanceTimersByTime(1000)
		})

		expect(mockOnRetry).toHaveBeenCalledTimes(1)
	})
})
