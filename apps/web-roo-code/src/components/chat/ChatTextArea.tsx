import React, { forwardRef } from "react"

interface ChatTextAreaProps {
	inputValue: string
	setInputValue: (value: string) => void
	sendingDisabled: boolean
	selectApiConfigDisabled: boolean
	onSend: (text: string, images: string[]) => void
	selectedImages: string[]
	setSelectedImages: (images: string[]) => void
}

export const ChatTextArea = forwardRef<HTMLTextAreaElement, ChatTextAreaProps>((props, ref) => {
	const { inputValue, setInputValue, sendingDisabled, onSend, selectedImages } = props

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (!sendingDisabled && inputValue.trim()) {
			onSend(inputValue, selectedImages)
		}
	}

	return (
		<form onSubmit={handleSubmit} className="p-4 border-t">
			<textarea
				ref={ref}
				value={inputValue}
				onChange={(e) => setInputValue(e.target.value)}
				disabled={sendingDisabled}
				className="w-full p-2 border rounded"
				placeholder="Type your message..."
				rows={3}
			/>
			<button
				type="submit"
				disabled={sendingDisabled}
				className="mt-2 px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50">
				Send
			</button>
		</form>
	)
})

ChatTextArea.displayName = "ChatTextArea"
