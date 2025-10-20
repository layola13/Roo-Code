import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { LazyImage } from "../LazyImage"

// Mock IntersectionObserver
class MockIntersectionObserver {
	readonly root: Element | null = null
	readonly rootMargin: string = ""
	readonly thresholds: ReadonlyArray<number> = []

	constructor(
		public callback: IntersectionObserverCallback,
		public options?: IntersectionObserverInit,
	) {}

	observe = vi.fn()
	unobserve = vi.fn()
	disconnect = vi.fn()
	takeRecords = vi.fn(() => [])
}

describe("LazyImage", () => {
	beforeEach(() => {
		// Setup IntersectionObserver mock
		global.IntersectionObserver = vi.fn((callback, options) => {
			return new MockIntersectionObserver(callback, options)
		}) as any
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("应该渲染占位符而不加载图片直到进入视口", () => {
		render(<LazyImage src="test-image.jpg" alt="Test Image" />)

		// 应该显示占位符图标
		const placeholder = document.querySelector(".codicon-file-media")
		expect(placeholder).toBeInTheDocument()

		// 图片不应该有src属性（未加载）
		const img = document.querySelector("img")
		expect(img).toBeInTheDocument()
		expect(img?.getAttribute("src")).toBeNull()
	})

	it("当进入视口时应该开始加载图片", async () => {
		render(<LazyImage src="test-image.jpg" alt="Test Image" />)

		// 模拟进入视口
		const entries: IntersectionObserverEntry[] = [
			{
				isIntersecting: true,
				target: document.querySelector("img")!,
				boundingClientRect: {} as DOMRectReadOnly,
				intersectionRatio: 0.5,
				intersectionRect: {} as DOMRectReadOnly,
				rootBounds: null,
				time: Date.now(),
			},
		]

		// 调用observer回调
		const observers = (global.IntersectionObserver as any).mock.results
		if (observers.length > 0) {
			const observer = observers[0].value
			observer.callback(entries, observer)
		}

		await waitFor(() => {
			const img = document.querySelector("img")
			expect(img?.getAttribute("src")).toBe("test-image.jpg")
		})
	})

	it("加载中时应该显示加载图标", async () => {
		render(<LazyImage src="test-image.jpg" alt="Test Image" />)

		// 模拟进入视口
		const entries: IntersectionObserverEntry[] = [
			{
				isIntersecting: true,
				target: document.querySelector("img")!,
				boundingClientRect: {} as DOMRectReadOnly,
				intersectionRatio: 0.5,
				intersectionRect: {} as DOMRectReadOnly,
				rootBounds: null,
				time: Date.now(),
			},
		]

		const observers = (global.IntersectionObserver as any).mock.results
		if (observers.length > 0) {
			const observer = observers[0].value
			observer.callback(entries, observer)
		}

		await waitFor(() => {
			// 应该显示加载中图标
			const loadingIcon = document.querySelector(".codicon-loading")
			expect(loadingIcon).toBeInTheDocument()
		})
	})

	it("图片加载失败时应该显示错误占位符", async () => {
		const { container } = render(<LazyImage src="invalid-image.jpg" alt="Test Image" />)

		// 模拟进入视口
		const entries: IntersectionObserverEntry[] = [
			{
				isIntersecting: true,
				target: container.querySelector("img")!,
				boundingClientRect: {} as DOMRectReadOnly,
				intersectionRatio: 0.5,
				intersectionRect: {} as DOMRectReadOnly,
				rootBounds: null,
				time: Date.now(),
			},
		]

		const observers = (global.IntersectionObserver as any).mock.results
		if (observers.length > 0) {
			const observer = observers[0].value
			observer.callback(entries, observer)
		}

		// 等待图片设置src
		await waitFor(() => {
			const img = container.querySelector("img")
			expect(img?.getAttribute("src")).toBe("invalid-image.jpg")
		})

		// 模拟图片加载错误
		const img = container.querySelector("img")
		if (img) {
			const errorEvent = new Event("error")
			img.dispatchEvent(errorEvent)
		}

		await waitFor(() => {
			// 应该显示错误消息
			expect(screen.getByText(/Failed to load image/i)).toBeInTheDocument()
		})
	})

	it("应该调用onLoad回调", async () => {
		const onLoad = vi.fn()
		const { container } = render(<LazyImage src="test-image.jpg" alt="Test Image" onLoad={onLoad} />)

		// 模拟进入视口
		const entries: IntersectionObserverEntry[] = [
			{
				isIntersecting: true,
				target: container.querySelector("img")!,
				boundingClientRect: {} as DOMRectReadOnly,
				intersectionRatio: 0.5,
				intersectionRect: {} as DOMRectReadOnly,
				rootBounds: null,
				time: Date.now(),
			},
		]

		const observers = (global.IntersectionObserver as any).mock.results
		if (observers.length > 0) {
			const observer = observers[0].value
			observer.callback(entries, observer)
		}

		// 等待图片设置src
		await waitFor(() => {
			const img = container.querySelector("img")
			expect(img?.getAttribute("src")).toBe("test-image.jpg")
		})

		// 模拟图片加载成功
		const img = container.querySelector("img")
		if (img) {
			const loadEvent = new Event("load")
			img.dispatchEvent(loadEvent)
		}

		await waitFor(() => {
			expect(onLoad).toHaveBeenCalledTimes(1)
		})
	})

	it("应该调用onError回调", async () => {
		const onError = vi.fn()
		const { container } = render(<LazyImage src="invalid-image.jpg" alt="Test Image" onError={onError} />)

		// 模拟进入视口
		const entries: IntersectionObserverEntry[] = [
			{
				isIntersecting: true,
				target: container.querySelector("img")!,
				boundingClientRect: {} as DOMRectReadOnly,
				intersectionRatio: 0.5,
				intersectionRect: {} as DOMRectReadOnly,
				rootBounds: null,
				time: Date.now(),
			},
		]

		const observers = (global.IntersectionObserver as any).mock.results
		if (observers.length > 0) {
			const observer = observers[0].value
			observer.callback(entries, observer)
		}

		// 等待图片设置src
		await waitFor(() => {
			const img = container.querySelector("img")
			expect(img?.getAttribute("src")).toBe("invalid-image.jpg")
		})

		// 模拟图片加载错误
		const img = container.querySelector("img")
		if (img) {
			const errorEvent = new Event("error")
			img.dispatchEvent(errorEvent)
		}

		await waitFor(() => {
			expect(onError).toHaveBeenCalledTimes(1)
		})
	})

	it("组件卸载时应该断开observer连接", () => {
		const { unmount } = render(<LazyImage src="test-image.jpg" alt="Test Image" />)

		const observers = (global.IntersectionObserver as any).mock.results
		expect(observers.length).toBeGreaterThan(0)

		unmount()

		// 验证disconnect被调用
		const observer = observers[0].value
		expect(observer.disconnect).toHaveBeenCalled()
	})
})
