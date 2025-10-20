import React from "react"

export function Dialog(props: any) {
	return <div {...props}>{props.children}</div>
}

export function DialogContent(props: any) {
	return (
		<div {...props} className={`dialog-content ${props.className || ""}`}>
			{props.children}
		</div>
	)
}

export function DialogDescription(props: any) {
	return (
		<div {...props} className={`dialog-description ${props.className || ""}`}>
			{props.children}
		</div>
	)
}

export function DialogFooter(props: any) {
	return (
		<div {...props} className={`dialog-footer ${props.className || ""}`}>
			{props.children}
		</div>
	)
}

export function DialogHeader(props: any) {
	return (
		<div {...props} className={`dialog-header ${props.className || ""}`}>
			{props.children}
		</div>
	)
}

export function DialogTitle(props: any) {
	return (
		<h2 {...props} className={`dialog-title ${props.className || ""}`}>
			{props.children}
		</h2>
	)
}

export function DialogTrigger(props: any) {
	return (
		<button {...props} className={`dialog-trigger ${props.className || ""}`}>
			{props.children}
		</button>
	)
}
