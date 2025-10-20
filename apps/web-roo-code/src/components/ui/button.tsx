import React from "react"

export function Button(props: any) {
	return (
		<button {...props} className={`px-4 py-2 rounded ${props.className || ""}`}>
			{props.children}
		</button>
	)
}
