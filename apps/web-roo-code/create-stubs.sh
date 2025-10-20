#!/bin/bash

# 创建所有缺失的存根文件
mkdir -p src/types src/lib/{utils,hooks,modes,i18n} src/context src/components/{ui/hooks,welcome,cloud,common,history}

# Types
echo "export type McpServer = any" > src/types/mcp.ts
echo "export type McpTool = any" >> src/types/mcp.ts
echo "export type AudioType = 'celebration' | 'notification' | 'progress_loop'" > src/types/WebviewMessage.ts

# Utils
echo "export function findLast<T>(arr: T[], predicate: (item: T) => boolean): T | undefined { return arr.slice().reverse().find(predicate) }" > src/lib/utils/array.ts
echo "export function combineApiRequests(messages: any[]): any[] { return messages }" > src/lib/utils/combineApiRequests.ts
echo "export function combineCommandSequences(messages: any[]): any[] { return messages }" > src/lib/utils/combineCommandSequences.ts
echo "export function getApiMetrics(messages: any[]): any { return { totalTokensIn: 0, totalTokensOut: 0, totalCacheWrites: 0, totalCacheReads: 0, totalCost: 0, contextTokens: 0, subAgentTokenUsage: {} } }" > src/lib/utils/getApiMetrics.ts
echo "export function getLatestTodo(messages: any[]): any[] { return [] }" > src/lib/utils/todo.ts
echo "export type CommandDecision = any" > src/lib/utils/command-validation.ts
echo "export function getCommandDecision(...args: any[]): any { return null }" >> src/lib/utils/command-validation.ts
echo "export function findLongestPrefixMatch(...args: any[]): any { return null }" >> src/lib/utils/command-validation.ts
echo "export function parseCommand(...args: any[]): any { return null }" >> src/lib/utils/command-validation.ts

# Hooks
echo "export function useAutoApprovalState() { return {} }" > src/lib/hooks/useAutoApprovalState.ts
echo "export function useAutoApprovalToggles() { return {} }" > src/lib/hooks/useAutoApprovalToggles.ts
echo "export function useCloudUpsell(config: any) { return { isOpen: false, openUpsell: () => {}, closeUpsell: () => {}, handleConnect: () => {} } }" > src/lib/hooks/useCloudUpsell.ts

# Other libs
echo "export function getAllModes() { return [] }" > src/lib/modes.ts
echo "export class ProfileValidator { static isProfileAllowed(...args: any[]) { return true } }" > src/lib/ProfileValidator.ts
echo "import { createContext, useContext } from 'react'" > src/lib/i18n/TranslationContext.tsx
echo "const TranslationContext = createContext<any>(null)" >> src/lib/i18n/TranslationContext.tsx
echo "export function useAppTranslation(ns?: string) { return { t: (key: string) => key } }" >> src/lib/i18n/TranslationContext.tsx

# Context
echo "import { createContext, useContext } from 'react'" > src/context/ExtensionStateContext.tsx
echo "const ExtensionStateContext = createContext<any>({})" >> src/context/ExtensionStateContext.tsx
echo "export function useExtensionState() { return useContext(ExtensionStateContext) || {} }" >> src/context/ExtensionStateContext.tsx

# Components
echo "export function useSelectedModel() { return {} }" > src/components/ui/hooks/useSelectedModel.ts
echo "export function StandardTooltip(props: any) { return null }" > src/components/ui/StandardTooltip.tsx
echo "export default function RooHero() { return <div>Roo Hero</div> }" > src/components/welcome/RooHero.tsx
echo "export default function RooTips() { return <div>Roo Tips</div> }" > src/components/welcome/RooTips.tsx
echo "export function CloudUpsellDialog(props: any) { return null }" > src/components/cloud/CloudUpsellDialog.tsx
echo "export default function TelemetryBanner() { return null }" > src/components/common/TelemetryBanner.tsx
echo "export default function VersionIndicator() { return null }" > src/components/common/VersionIndicator.tsx
echo "export default function DismissibleUpsell(props: any) { return null }" > src/components/common/DismissibleUpsell.tsx
echo "export function useTaskSearch() { return { tasks: [] } }" > src/components/history/useTaskSearch.tsx
echo "export default function HistoryPreview(props: any) { return null }" > src/components/history/HistoryPreview.tsx
echo "export default function Announcement(props: any) { return null }" > src/components/chat/Announcement.tsx
echo "export default function BrowserSessionRow(props: any) { return null }" > src/components/chat/BrowserSessionRow.tsx
echo "export default function ChatRow(props: any) { return null }" > src/components/chat/ChatRow.tsx
echo "export default function SystemPromptWarning(props: any) { return null }" > src/components/chat/SystemPromptWarning.tsx
echo "export default function ProfileViolationWarning(props: any) { return null }" > src/components/chat/ProfileViolationWarning.tsx
echo "export function CheckpointWarning(props: any) { return null }" > src/components/chat/CheckpointWarning.tsx
echo "export function QueuedMessages(props: any) { return null }" > src/components/chat/QueuedMessages.tsx

echo "✅ 所有存根文件已创建"
