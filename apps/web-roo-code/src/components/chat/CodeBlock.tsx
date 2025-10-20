"use client"

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useState } from "react"

interface CodeBlockProps {
	code: string
	language: string
	filename?: string
}

export function CodeBlock({ code, language, filename }: CodeBlockProps) {
	const [copied, setCopied] = useState(false)

	const handleCopy = async () => {
		await navigator.clipboard.writeText(code)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	return (
		<div className="relative group">
			{filename && (
				<div className="bg-gray-800 px-4 py-2 text-sm text-gray-300 border-b border-gray-700">{filename}</div>
			)}
			<button
				onClick={handleCopy}
				className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm">
				{copied ? "Copied!" : "Copy"}
			</button>
			<SyntaxHighlighter
				language={language}
				style={vscDarkPlus}
				customStyle={{
					margin: 0,
					borderRadius: filename ? "0 0 0.375rem 0.375rem" : "0.375rem",
				}}>
				{code}
			</SyntaxHighlighter>
		</div>
	)
}
