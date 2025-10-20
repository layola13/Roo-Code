"use client"

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { useDeepCompareEffect } from "react-use"
import debounce from "debounce"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import removeMd from "remove-markdown"
import { LRUCache } from "lru-cache"

import { useDebounceEffect } from "@/lib/hooks/useDebounceEffect"
import { appendImages } from "@/lib/utils/imageUtils"

import type { ClineAsk, ClineMessage, McpServerUse } from "@roo-code/types"

import { ClineSayBrowserAction, ClineSayTool } from "@/types/ExtensionMessage"
import { McpServer, McpTool } from "@/types/mcp"
import { findLast } from "@/lib/utils/array"
import { FollowUpData, SuggestionItem } from "@roo-code/types"
import { combineApiRequests } from "@/lib/utils/combineApiRequests"
import { combineCommandSequences } from "@/lib/utils/combineCommandSequences"
import { getApiMetrics } from "@/lib/utils/getApiMetrics"
import { AudioType } from "@/types/WebviewMessage"
import { getAllModes } from "@/lib/modes"
import { ProfileValidator } from "@/lib/ProfileValidator"
import { getLatestTodo } from "@/lib/utils/todo"

import {
	getCommandDecision,
	CommandDecision,
	findLongestPrefixMatch,
	parseCommand,
} from "@/lib/utils/command-validation"
import { useAppTranslation } from "@/lib/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"
import RooHero from "@/components/welcome/RooHero"
import RooTips from "@/components/welcome/RooTips"
import { StandardTooltip } from "@/components/ui"
import { useAutoApprovalState } from "@/lib/hooks/useAutoApprovalState"
import { useAutoApprovalToggles } from "@/lib/hooks/useAutoApprovalToggles"
import { CloudUpsellDialog } from "@/components/cloud/CloudUpsellDialog"

import TelemetryBanner from "../common/TelemetryBanner"
import VersionIndicator from "../common/VersionIndicator"
import { useTaskSearch } from "../history/useTaskSearch"
import HistoryPreview from "../history/HistoryPreview"
import Announcement from "./Announcement"
import BrowserSessionRow from "./BrowserSessionRow"
import ChatRow from "./ChatRow"
import { ChatTextArea } from "./ChatTextArea"
import TaskHeader from "./TaskHeader"
import SystemPromptWarning from "./SystemPromptWarning"
import ProfileViolationWarning from "./ProfileViolationWarning"
import { CheckpointWarning } from "./CheckpointWarning"
import { QueuedMessages } from "./QueuedMessages"
import DismissibleUpsell from "../common/DismissibleUpsell"
import { useCloudUpsell } from "@/lib/hooks/useCloudUpsell"
import { Cloud } from "lucide-react"

export interface ChatViewProps {
	isHidden: boolean
	showAnnouncement: boolean
	hideAnnouncement: () => void
}

export interface ChatViewRef {
	acceptInput: () => void
}

export const MAX_IMAGES_PER_MESSAGE = 20

const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0

const ChatViewComponent: React.ForwardRefRenderFunction<ChatViewRef, ChatViewProps> = (
	{ isHidden, showAnnouncement, hideAnnouncement },
	ref,
) => {
	const isMountedRef = useRef(true)

	const [audioBaseUri] = useState(() => {
		if (typeof window === "undefined") return ""
		const w = window as any
		return w.AUDIO_BASE_URI || ""
	})

	const { t } = useAppTranslation()
	const { t: tSettings } = useAppTranslation("settings")
	const modeShortcutText = `${isMac ? "⌘" : "Ctrl"} + . for next mode, ${isMac ? "⌘" : "Ctrl"} + Shift + . for previous mode`

	const {
		clineMessages: messages = [],
		currentTaskItem,
		currentTaskTodos = [],
		taskHistory = [],
		apiConfiguration,
		organizationAllowList,
		mcpServers = [],
		alwaysAllowBrowser = false,
		alwaysAllowReadOnly = false,
		alwaysAllowReadOnlyOutsideWorkspace = false,
		alwaysAllowWrite = false,
		alwaysAllowWriteOutsideWorkspace = false,
		alwaysAllowWriteProtected = false,
		alwaysAllowExecute = false,
		alwaysAllowMcp = false,
		allowedCommands = [],
		deniedCommands = [],
		writeDelayMs = 0,
		followupAutoApproveTimeoutMs = 3000,
		mode = "code",
		setMode,
		autoApprovalEnabled = false,
		alwaysAllowModeSwitch = false,
		alwaysAllowSubtasks = false,
		alwaysAllowFollowupQuestions = false,
		alwaysAllowUpdateTodoList = false,
		customModes = [],
		telemetrySetting,
		hasSystemPromptOverride = false,
		historyPreviewCollapsed,
		soundEnabled = true,
		soundVolume = 0.5,
		cloudIsAuthenticated = false,
		messageQueue = [],
		subAgentCompressionEnabled = false,
		useContextAnalyzer = false,
		useMemoryExtractor = false,
		useCodeSummarizer = false,
	} = useExtensionState()

	const messagesRef = useRef(messages)

	useEffect(() => {
		messagesRef.current = messages
	}, [messages])

	const { tasks } = useTaskSearch()

	const [isExpanded, setIsExpanded] = useState(
		historyPreviewCollapsed === undefined ? true : !historyPreviewCollapsed,
	)

	const toggleExpanded = useCallback(() => {
		const newState = !isExpanded
		setIsExpanded(newState)
		// Send message to server to persist
		// postMessage({ type: "setHistoryPreviewCollapsed", bool: !newState })
	}, [isExpanded])

	const task = useMemo(() => messages.at(0), [messages])

	const latestTodos = useMemo(() => {
		if (currentTaskTodos && currentTaskTodos.length > 0) {
			const messageBasedTodos = getLatestTodo(messages)
			if (messageBasedTodos && messageBasedTodos.length > 0) {
				return messageBasedTodos
			}
			return currentTaskTodos
		}
		return getLatestTodo(messages)
	}, [messages, currentTaskTodos])

	const modifiedMessages = useMemo(() => combineApiRequests(combineCommandSequences(messages.slice(1))), [messages])

	const apiMetrics = useMemo(() => getApiMetrics(modifiedMessages), [modifiedMessages])

	const [inputValue, setInputValue] = useState("")
	const inputValueRef = useRef(inputValue)
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const [sendingDisabled, setSendingDisabled] = useState(false)
	const [selectedImages, setSelectedImages] = useState<string[]>([])

	const [clineAsk, setClineAsk] = useState<ClineAsk | undefined>(undefined)
	const [enableButtons, setEnableButtons] = useState<boolean>(false)
	const [primaryButtonText, setPrimaryButtonText] = useState<string | undefined>(undefined)
	const [secondaryButtonText, setSecondaryButtonText] = useState<string | undefined>(undefined)
	const [didClickCancel, setDidClickCancel] = useState(false)
	const virtuosoRef = useRef<VirtuosoHandle>(null)
	const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({})
	const prevExpandedRowsRef = useRef<Record<number, boolean>>()
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const disableAutoScrollRef = useRef(false)
	const [showScrollToBottom, setShowScrollToBottom] = useState(false)
	const [isAtBottom, setIsAtBottom] = useState(false)
	const lastTtsRef = useRef<string>("")
	const [wasStreaming, setWasStreaming] = useState<boolean>(false)
	const [showCheckpointWarning, setShowCheckpointWarning] = useState<boolean>(false)
	const [isCondensing, setIsCondensing] = useState<boolean>(false)
	const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
	const everVisibleMessagesTsRef = useRef<LRUCache<number, boolean>>(
		new LRUCache({
			max: 100,
			ttl: 1000 * 60 * 5,
		}),
	)
	const autoApproveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const userRespondedRef = useRef<boolean>(false)
	const [currentFollowUpTs, setCurrentFollowUpTs] = useState<number | null>(null)

	const clineAskRef = useRef(clineAsk)
	useEffect(() => {
		clineAskRef.current = clineAsk
	}, [clineAsk])

	const {
		isOpen: isUpsellOpen,
		openUpsell,
		closeUpsell,
		handleConnect,
	} = useCloudUpsell({
		autoOpenOnAuth: false,
	})

	useEffect(() => {
		inputValueRef.current = inputValue
	}, [inputValue])

	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
		}
	}, [])

	const isProfileDisabled = useMemo(
		() => !!apiConfiguration && !ProfileValidator.isProfileAllowed(apiConfiguration, organizationAllowList),
		[apiConfiguration, organizationAllowList],
	)

	const lastMessage = useMemo(() => messages.at(-1), [messages])
	const secondLastMessage = useMemo(() => messages.at(-2), [messages])

	// Simplified sound handling for web
	const playSound = useCallback(
		(audioType: AudioType) => {
			if (!soundEnabled) return
			// Web implementation would use HTML5 Audio API
			console.log("Play sound:", audioType)
		},
		[soundEnabled],
	)

	const playTts = useCallback((text: string) => {
		// Web TTS implementation
		console.log("Play TTS:", text)
	}, [])

	// Handle last message updates
	useDeepCompareEffect(() => {
		if (lastMessage) {
			switch (lastMessage.type) {
				case "ask":
					userRespondedRef.current = false
					const isPartial = lastMessage.partial === true
					// Handle different ask types...
					break
				case "say":
					// Handle say types...
					break
			}
		}
	}, [lastMessage, secondLastMessage])

	// Simplified version - full implementation would match webview-ui exactly
	const handleSendMessage = useCallback((text: string, images: string[]) => {
		text = text.trim()
		if (text || images.length > 0) {
			// Web API call instead of vscode.postMessage
			fetch("/api/tasks/message", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text, images }),
			})
			setInputValue("")
			setSelectedImages([])
		}
	}, [])

	// More handlers would follow the same pattern...

	return (
		<div
			data-testid="chat-view"
			className={isHidden ? "hidden" : "fixed top-0 left-0 right-0 bottom-0 flex flex-col overflow-hidden"}>
			{/* Full component structure matching webview-ui */}
			<div className="flex-1 overflow-auto">
				{task ? (
					<TaskHeader
						task={task}
						tokensIn={apiMetrics.totalTokensIn}
						tokensOut={apiMetrics.totalTokensOut}
						cacheWrites={apiMetrics.totalCacheWrites}
						cacheReads={apiMetrics.totalCacheReads}
						totalCost={apiMetrics.totalCost}
						contextTokens={apiMetrics.contextTokens}
						buttonsDisabled={sendingDisabled}
						handleCondenseContext={() => {}}
						todos={latestTodos}
						subAgentTokenUsage={apiMetrics.subAgentTokenUsage}
						subAgentCompressionEnabled={subAgentCompressionEnabled}
						useContextAnalyzer={useContextAnalyzer}
						useMemoryExtractor={useMemoryExtractor}
						useCodeSummarizer={useCodeSummarizer}
					/>
				) : (
					<RooHero />
				)}
			</div>

			<ChatTextArea
				ref={textAreaRef}
				inputValue={inputValue}
				setInputValue={setInputValue}
				sendingDisabled={sendingDisabled || isProfileDisabled}
				selectApiConfigDisabled={sendingDisabled && clineAsk !== "api_req_failed"}
				onSend={handleSendMessage}
				selectedImages={selectedImages}
				setSelectedImages={setSelectedImages}
			/>
		</div>
	)
}

export const ChatView = forwardRef<ChatViewRef, ChatViewProps>(ChatViewComponent)
