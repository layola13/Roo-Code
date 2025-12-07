import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { SplitFileSettings } from "../SplitFileSettings"

// Mock the translation hook
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"settings:sections.splitFile": "Split File",
				"settings:splitFile.configuration.label": "File Splitting Configuration",
				"settings:splitFile.configuration.description":
					"Configure parameters for the large file splitting tool.",
				"settings:splitFile.linesPerChunk.label": "Lines per chunk",
				"settings:splitFile.linesPerChunk.description":
					"Set the number of lines per split file chunk. Default: 100 lines. Range: 100-1000 lines.",
				"settings:splitFile.overlapLines.label": "Overlap lines between chunks",
				"settings:splitFile.overlapLines.description":
					"Set the number of overlapping lines between adjacent chunks. Default: 0 lines. Range: 0-100 lines.",
			}
			return translations[key] || key
		},
	}),
}))

describe("SplitFileSettings", () => {
	const mockSetCachedStateField = vi.fn()

	const defaultProps = {
		splitFileLinesPerChunk: 100,
		splitFileOverlapLines: 0,
		setCachedStateField: mockSetCachedStateField,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the component with default values", () => {
		render(<SplitFileSettings {...defaultProps} />)

		expect(screen.getByText("Split File")).toBeInTheDocument()
		expect(screen.getByText("File Splitting Configuration")).toBeInTheDocument()
		expect(screen.getByText("Lines per chunk")).toBeInTheDocument()
		expect(screen.getByText("Overlap lines between chunks")).toBeInTheDocument()
		expect(screen.getByText("100")).toBeInTheDocument() // Default lines per chunk
		expect(screen.getByText("0")).toBeInTheDocument() // Default overlap lines
	})

	it("displays custom values when provided", () => {
		render(<SplitFileSettings {...defaultProps} splitFileLinesPerChunk={500} splitFileOverlapLines={50} />)

		expect(screen.getByText("500")).toBeInTheDocument()
		expect(screen.getByText("50")).toBeInTheDocument()
	})

	it("handles undefined values with defaults", () => {
		render(
			<SplitFileSettings
				{...defaultProps}
				splitFileLinesPerChunk={undefined}
				splitFileOverlapLines={undefined}
			/>,
		)

		expect(screen.getByText("100")).toBeInTheDocument() // Default
		expect(screen.getByText("0")).toBeInTheDocument() // Default
	})

	it("renders sliders with correct test ids", () => {
		render(<SplitFileSettings {...defaultProps} />)

		const linesSlider = screen.getByTestId("split-file-lines-per-chunk-slider")
		const overlapSlider = screen.getByTestId("split-file-overlap-lines-slider")

		expect(linesSlider).toBeInTheDocument()
		expect(overlapSlider).toBeInTheDocument()
	})

	it("displays descriptions for both settings", () => {
		render(<SplitFileSettings {...defaultProps} />)

		expect(screen.getByText(/Set the number of lines per split file chunk/)).toBeInTheDocument()
		expect(screen.getByText(/Set the number of overlapping lines between adjacent chunks/)).toBeInTheDocument()
	})

	it("renders with custom className", () => {
		const { container } = render(<SplitFileSettings {...defaultProps} className="custom-class" />)

		const wrapper = container.firstChild as HTMLElement
		expect(wrapper).toHaveClass("custom-class")
	})

	it("displays section header", () => {
		render(<SplitFileSettings {...defaultProps} />)

		const header = screen.getByText("Split File")
		expect(header).toBeInTheDocument()
	})

	it("displays configuration section", () => {
		render(<SplitFileSettings {...defaultProps} />)

		expect(screen.getByText("File Splitting Configuration")).toBeInTheDocument()
		expect(screen.getByText(/Configure parameters for the large file splitting tool/)).toBeInTheDocument()
	})
})
