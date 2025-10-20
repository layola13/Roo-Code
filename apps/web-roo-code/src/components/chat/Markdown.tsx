"use client"

import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

interface MarkdownProps {
	content: string
	className?: string
}

export function Markdown({ content, className = "" }: MarkdownProps) {
	return (
		<div className={`prose prose-invert max-w-none ${className}`}>
			<ReactMarkdown
				components={{
					code({ node, inline, className, children, ...props }: any) {
						const match = /language-(\w+)/.exec(className || "")
						return !inline && match ? (
							<SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
								{String(children).replace(/\n$/, "")}
							</SyntaxHighlighter>
						) : (
							<code className={className} {...props}>
								{children}
							</code>
						)
					},
				}}>
				{content}
			</ReactMarkdown>
		</div>
	)
}
