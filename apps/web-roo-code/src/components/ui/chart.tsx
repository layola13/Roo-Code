import React from "react"

export function ChartContainer(props: any) {
	return (
		<div {...props} className={`chart-container ${props.className || ""}`}>
			{props.children}
		</div>
	)
}

export function ChartTooltip(props: any) {
	return (
		<div {...props} className={`chart-tooltip ${props.className || ""}`}>
			{props.children}
		</div>
	)
}

export type ChartConfig = Record<string, any>
