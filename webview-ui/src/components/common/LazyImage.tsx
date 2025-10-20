import React, { useEffect, useRef, useState } from "react"

interface LazyImageProps {
	src: string
	alt?: string
	className?: string
	style?: React.CSSProperties
	onLoad?: () => void
	onError?: () => void
}

/**
 * LazyImage组件 - 使用Intersection Observer实现图片懒加载
 *
 * 只有当图片进入视口时才开始加载，显著减少内存占用
 *
 * @param src - 图片源URL或base64数据
 * @param alt - 图片alt文本
 * @param className - CSS类名
 * @param style - 内联样式
 * @param onLoad - 加载完成回调
 * @param onError - 加载错误回调
 */
export function LazyImage({ src, alt = "", className = "", style, onLoad, onError }: LazyImageProps) {
	const imgRef = useRef<HTMLImageElement>(null)
	const [isInView, setIsInView] = useState(false)
	const [isLoaded, setIsLoaded] = useState(false)
	const [hasError, setHasError] = useState(false)

	useEffect(() => {
		const imgElement = imgRef.current
		if (!imgElement) return

		// 创建Intersection Observer
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						setIsInView(true)
						// 一旦进入视口，停止观察
						observer.disconnect()
					}
				})
			},
			{
				// 提前200px开始加载，提供更流畅的用户体验
				rootMargin: "200px",
				threshold: 0.01,
			},
		)

		observer.observe(imgElement)

		return () => {
			observer.disconnect()
		}
	}, [])

	const handleLoad = () => {
		setIsLoaded(true)
		onLoad?.()
	}

	const handleError = () => {
		setHasError(true)
		onError?.()
	}

	return (
		<div
			className={className}
			style={{
				position: "relative",
				...style,
			}}>
			<img
				ref={imgRef}
				src={isInView ? src : undefined}
				alt={alt}
				onLoad={handleLoad}
				onError={handleError}
				style={{
					display: isLoaded && !hasError ? "block" : "none",
					maxWidth: "100%",
					height: "auto",
				}}
			/>
			{/* 加载占位符 */}
			{!isLoaded && !hasError && (
				<div
					style={{
						minHeight: "100px",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: "var(--vscode-editor-background)",
						border: "1px solid var(--vscode-editorGroup-border)",
						borderRadius: "4px",
					}}>
					{isInView ? (
						<span className="codicon codicon-loading codicon-modifier-spin" />
					) : (
						<span className="codicon codicon-file-media" style={{ opacity: 0.3, fontSize: "24px" }} />
					)}
				</div>
			)}
			{/* 错误占位符 */}
			{hasError && (
				<div
					style={{
						minHeight: "100px",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: "var(--vscode-editor-background)",
						border: "1px solid var(--vscode-errorForeground)",
						borderRadius: "4px",
						color: "var(--vscode-errorForeground)",
						padding: "10px",
						textAlign: "center",
					}}>
					<div>
						<span className="codicon codicon-error" style={{ fontSize: "24px" }} />
						<div style={{ marginTop: "8px", fontSize: "12px" }}>Failed to load image</div>
					</div>
				</div>
			)}
		</div>
	)
}
