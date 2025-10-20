import React from "react"

export function Table(props: any) {
	return (
		<table {...props} className={`w-full ${props.className || ""}`}>
			{props.children}
		</table>
	)
}

export function TableBody(props: any) {
	return <tbody {...props}>{props.children}</tbody>
}

export function TableCaption(props: any) {
	return <caption {...props}>{props.children}</caption>
}

export function TableCell(props: any) {
	return (
		<td {...props} className={`px-4 py-2 ${props.className || ""}`}>
			{props.children}
		</td>
	)
}

export function TableHead(props: any) {
	return <thead {...props}>{props.children}</thead>
}

export function TableHeader(props: any) {
	return (
		<th {...props} className={`px-4 py-2 text-left ${props.className || ""}`}>
			{props.children}
		</th>
	)
}

export function TableRow(props: any) {
	return (
		<tr {...props} className={`border-b ${props.className || ""}`}>
			{props.children}
		</tr>
	)
}
