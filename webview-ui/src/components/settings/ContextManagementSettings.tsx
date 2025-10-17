import { HTMLAttributes } from "react"
import React from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { Database, FoldVertical } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider, Button } from "@/components/ui"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { vscode } from "@/utils/vscode"
import { DEFAULT_SUBAGENT_PROMPTS } from "@roo/subagent-prompts"
import { useExtensionState } from "@/context/ExtensionStateContext"

type ContextManagementSettingsProps = HTMLAttributes<HTMLDivElement> & {
	autoCondenseContext: boolean
	autoCondenseContextPercent: number
	listApiConfigMeta: any[]
	maxOpenTabsContext: number
	maxWorkspaceFiles: number
	showRooIgnoredFiles?: boolean
	maxReadFileLine?: number
	maxImageFileSize?: number
	maxTotalImageSize?: number
	maxConcurrentFileReads?: number
	profileThresholds?: Record<string, number>
	includeDiagnosticMessages?: boolean
	maxDiagnosticMessages?: number
	writeDelayMs: number
	vectorMemoryEnabled?: boolean
	subAgentCompressionEnabled?: boolean
	useContextAnalyzer?: boolean
	useMemoryExtractor?: boolean
	useCodeSummarizer?: boolean
	contextAnalyzerPrompt?: string
	memoryExtractorPrompt?: string
	codeSummarizerPrompt?: string
	redisUrl?: string
	qdrantUrl?: string
	qdrantCollectionName?: string
	setCachedStateField: SetCachedStateField<
		| "autoCondenseContext"
		| "autoCondenseContextPercent"
		| "maxOpenTabsContext"
		| "maxWorkspaceFiles"
		| "showRooIgnoredFiles"
		| "maxReadFileLine"
		| "maxImageFileSize"
		| "maxTotalImageSize"
		| "maxConcurrentFileReads"
		| "profileThresholds"
		| "includeDiagnosticMessages"
		| "maxDiagnosticMessages"
		| "writeDelayMs"
		| "vectorMemoryEnabled"
		| "subAgentCompressionEnabled"
		| "useContextAnalyzer"
		| "useMemoryExtractor"
		| "useCodeSummarizer"
		| "contextAnalyzerPrompt"
		| "memoryExtractorPrompt"
		| "codeSummarizerPrompt"
		| "redisUrl"
		| "qdrantUrl"
		| "qdrantCollectionName"
	>
}

export const ContextManagementSettings = ({
	autoCondenseContext,
	autoCondenseContextPercent,
	listApiConfigMeta,
	maxOpenTabsContext,
	maxWorkspaceFiles,
	showRooIgnoredFiles,
	setCachedStateField,
	maxReadFileLine,
	maxImageFileSize,
	maxTotalImageSize,
	maxConcurrentFileReads,
	profileThresholds = {},
	includeDiagnosticMessages,
	maxDiagnosticMessages,
	writeDelayMs,
	vectorMemoryEnabled,
	subAgentCompressionEnabled,
	useContextAnalyzer,
	useMemoryExtractor,
	useCodeSummarizer,
	contextAnalyzerPrompt,
	memoryExtractorPrompt,
	codeSummarizerPrompt,
	redisUrl,
	qdrantUrl,
	qdrantCollectionName,
	className,
	...props
}: ContextManagementSettingsProps) => {
	const { t } = useAppTranslation()
	const { condensingApiConfigId, setCondensingApiConfigId } = useExtensionState()
	const [selectedThresholdProfile, setSelectedThresholdProfile] = React.useState<string>("default")

	// 🔍 DEBUG: Log current state and defaults
	React.useEffect(() => {
		console.log("🔍 [SubAgent Debug] Current State:", {
			contextAnalyzerPrompt: contextAnalyzerPrompt,
			contextAnalyzerPrompt_type: typeof contextAnalyzerPrompt,
			contextAnalyzerPrompt_length: contextAnalyzerPrompt?.length,
			contextAnalyzerPrompt_isEmpty: contextAnalyzerPrompt === "",
			contextAnalyzerPrompt_isUndefined: contextAnalyzerPrompt === undefined,
			memoryExtractorPrompt: memoryExtractorPrompt,
			memoryExtractorPrompt_type: typeof memoryExtractorPrompt,
			codeSummarizerPrompt: codeSummarizerPrompt,
			codeSummarizerPrompt_type: typeof codeSummarizerPrompt,
		})
		console.log("🔍 [SubAgent Debug] DEFAULT_SUBAGENT_PROMPTS:", {
			contextAnalyzer_exists: !!DEFAULT_SUBAGENT_PROMPTS.contextAnalyzer,
			contextAnalyzer_length: DEFAULT_SUBAGENT_PROMPTS.contextAnalyzer?.length,
			contextAnalyzer_preview: DEFAULT_SUBAGENT_PROMPTS.contextAnalyzer?.substring(0, 100),
			memoryExtractor_exists: !!DEFAULT_SUBAGENT_PROMPTS.memoryExtractor,
			memoryExtractor_length: DEFAULT_SUBAGENT_PROMPTS.memoryExtractor?.length,
			codeSummarizer_exists: !!DEFAULT_SUBAGENT_PROMPTS.codeSummarizer,
			codeSummarizer_length: DEFAULT_SUBAGENT_PROMPTS.codeSummarizer?.length,
		})
		console.log("🔍 [SubAgent Debug] Textarea will show:", {
			contextAnalyzer_value: contextAnalyzerPrompt ?? DEFAULT_SUBAGENT_PROMPTS.contextAnalyzer,
			contextAnalyzer_finalLength: (contextAnalyzerPrompt ?? DEFAULT_SUBAGENT_PROMPTS.contextAnalyzer)?.length,
		})
	}, [contextAnalyzerPrompt, memoryExtractorPrompt, codeSummarizerPrompt])

	// Helper function to get the current threshold value based on selected profile
	const getCurrentThresholdValue = () => {
		if (selectedThresholdProfile === "default") {
			return autoCondenseContextPercent
		}
		const profileThreshold = profileThresholds[selectedThresholdProfile]
		if (profileThreshold === undefined || profileThreshold === -1) {
			return autoCondenseContextPercent // Use default if profile not configured or set to -1
		}
		return profileThreshold
	}

	// Helper function to handle threshold changes
	const handleThresholdChange = (value: number) => {
		if (selectedThresholdProfile === "default") {
			setCachedStateField("autoCondenseContextPercent", value)
		} else {
			const newThresholds = {
				...profileThresholds,
				[selectedThresholdProfile]: value,
			}
			setCachedStateField("profileThresholds", newThresholds)
			vscode.postMessage({
				type: "profileThresholds",
				values: newThresholds,
			})
		}
	}
	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader description={t("settings:contextManagement.description")}>
				<div className="flex items-center gap-2">
					<Database className="w-4" />
					<div>{t("settings:sections.contextManagement")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<span className="block font-medium mb-1">{t("settings:contextManagement.openTabs.label")}</span>
					<div className="flex items-center gap-2">
						<Slider
							min={0}
							max={500}
							step={1}
							value={[maxOpenTabsContext ?? 20]}
							onValueChange={([value]) => setCachedStateField("maxOpenTabsContext", value)}
							data-testid="open-tabs-limit-slider"
						/>
						<span className="w-10">{maxOpenTabsContext ?? 20}</span>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:contextManagement.openTabs.description")}
					</div>
				</div>

				<div>
					<span className="block font-medium mb-1">
						{t("settings:contextManagement.workspaceFiles.label")}
					</span>
					<div className="flex items-center gap-2">
						<Slider
							min={0}
							max={500}
							step={1}
							value={[maxWorkspaceFiles ?? 200]}
							onValueChange={([value]) => setCachedStateField("maxWorkspaceFiles", value)}
							data-testid="workspace-files-limit-slider"
						/>
						<span className="w-10">{maxWorkspaceFiles ?? 200}</span>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:contextManagement.workspaceFiles.description")}
					</div>
				</div>

				<div>
					<span className="block font-medium mb-1">
						{t("settings:contextManagement.maxConcurrentFileReads.label")}
					</span>
					<div className="flex items-center gap-2">
						<Slider
							min={1}
							max={100}
							step={1}
							value={[Math.max(1, maxConcurrentFileReads ?? 5)]}
							onValueChange={([value]) => setCachedStateField("maxConcurrentFileReads", value)}
							data-testid="max-concurrent-file-reads-slider"
						/>
						<span className="w-10 text-sm">{Math.max(1, maxConcurrentFileReads ?? 5)}</span>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:contextManagement.maxConcurrentFileReads.description")}
					</div>
				</div>

				<div>
					<VSCodeCheckbox
						checked={showRooIgnoredFiles}
						onChange={(e: any) => setCachedStateField("showRooIgnoredFiles", e.target.checked)}
						data-testid="show-rooignored-files-checkbox">
						<label className="block font-medium mb-1">
							{t("settings:contextManagement.rooignore.label")}
						</label>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:contextManagement.rooignore.description")}
					</div>
				</div>

				<div>
					<div className="flex flex-col gap-2">
						<span className="font-medium">{t("settings:contextManagement.maxReadFile.label")}</span>
						<div className="flex items-center gap-4">
							<Input
								type="number"
								pattern="-?[0-9]*"
								className="w-24 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
								value={maxReadFileLine ?? -1}
								min={-1}
								onChange={(e) => {
									const newValue = parseInt(e.target.value, 10)
									if (!isNaN(newValue) && newValue >= -1) {
										setCachedStateField("maxReadFileLine", newValue)
									}
								}}
								onClick={(e) => e.currentTarget.select()}
								data-testid="max-read-file-line-input"
								disabled={maxReadFileLine === -1}
							/>
							<span>{t("settings:contextManagement.maxReadFile.lines")}</span>
							<VSCodeCheckbox
								checked={maxReadFileLine === -1}
								onChange={(e: any) =>
									setCachedStateField("maxReadFileLine", e.target.checked ? -1 : 500)
								}
								data-testid="max-read-file-always-full-checkbox">
								{t("settings:contextManagement.maxReadFile.always_full_read")}
							</VSCodeCheckbox>
						</div>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-2">
						{t("settings:contextManagement.maxReadFile.description")}
					</div>
				</div>

				<div>
					<div className="flex flex-col gap-2">
						<span className="font-medium">{t("settings:contextManagement.maxImageFileSize.label")}</span>
						<div className="flex items-center gap-4">
							<Input
								type="number"
								pattern="[0-9]*"
								className="w-24 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
								value={maxImageFileSize ?? 5}
								min={1}
								max={100}
								onChange={(e) => {
									const newValue = parseInt(e.target.value, 10)
									if (!isNaN(newValue) && newValue >= 1 && newValue <= 100) {
										setCachedStateField("maxImageFileSize", newValue)
									}
								}}
								onClick={(e) => e.currentTarget.select()}
								data-testid="max-image-file-size-input"
							/>
							<span>{t("settings:contextManagement.maxImageFileSize.mb")}</span>
						</div>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-2">
						{t("settings:contextManagement.maxImageFileSize.description")}
					</div>
				</div>

				<div>
					<div className="flex flex-col gap-2">
						<span className="font-medium">{t("settings:contextManagement.maxTotalImageSize.label")}</span>
						<div className="flex items-center gap-4">
							<Input
								type="number"
								pattern="[0-9]*"
								className="w-24 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
								value={maxTotalImageSize ?? 20}
								min={1}
								max={500}
								onChange={(e) => {
									const newValue = parseInt(e.target.value, 10)
									if (!isNaN(newValue) && newValue >= 1 && newValue <= 500) {
										setCachedStateField("maxTotalImageSize", newValue)
									}
								}}
								onClick={(e) => e.currentTarget.select()}
								data-testid="max-total-image-size-input"
							/>
							<span>{t("settings:contextManagement.maxTotalImageSize.mb")}</span>
						</div>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-2">
						{t("settings:contextManagement.maxTotalImageSize.description")}
					</div>
				</div>

				<div>
					<VSCodeCheckbox
						checked={includeDiagnosticMessages}
						onChange={(e: any) => setCachedStateField("includeDiagnosticMessages", e.target.checked)}
						data-testid="include-diagnostic-messages-checkbox">
						<label className="block font-medium mb-1">
							{t("settings:contextManagement.diagnostics.includeMessages.label")}
						</label>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:contextManagement.diagnostics.includeMessages.description")}
					</div>
				</div>

				<div>
					<span className="block font-medium mb-1">
						{t("settings:contextManagement.diagnostics.maxMessages.label")}
					</span>
					<div className="flex items-center gap-2">
						<Slider
							min={1}
							max={100}
							step={1}
							value={[
								maxDiagnosticMessages !== undefined && maxDiagnosticMessages <= 0
									? 100
									: (maxDiagnosticMessages ?? 50),
							]}
							onValueChange={([value]) => {
								// When slider reaches 100, set to -1 (unlimited)
								setCachedStateField("maxDiagnosticMessages", value === 100 ? -1 : value)
							}}
							data-testid="max-diagnostic-messages-slider"
							aria-label={t("settings:contextManagement.diagnostics.maxMessages.label")}
							aria-valuemin={1}
							aria-valuemax={100}
							aria-valuenow={
								maxDiagnosticMessages !== undefined && maxDiagnosticMessages <= 0
									? 100
									: (maxDiagnosticMessages ?? 50)
							}
							aria-valuetext={
								(maxDiagnosticMessages !== undefined && maxDiagnosticMessages <= 0) ||
								maxDiagnosticMessages === 100
									? t("settings:contextManagement.diagnostics.maxMessages.unlimitedLabel")
									: `${maxDiagnosticMessages ?? 50} ${t("settings:contextManagement.diagnostics.maxMessages.label")}`
							}
						/>
						<span className="w-20 text-sm font-medium">
							{(maxDiagnosticMessages !== undefined && maxDiagnosticMessages <= 0) ||
							maxDiagnosticMessages === 100
								? t("settings:contextManagement.diagnostics.maxMessages.unlimitedLabel")
								: (maxDiagnosticMessages ?? 50)}
						</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setCachedStateField("maxDiagnosticMessages", 50)}
							title={t("settings:contextManagement.diagnostics.maxMessages.resetTooltip")}
							className="p-1 h-6 w-6"
							disabled={maxDiagnosticMessages === 50}>
							<span className="codicon codicon-discard" />
						</Button>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:contextManagement.diagnostics.maxMessages.description")}
					</div>
				</div>

				<div>
					<span className="block font-medium mb-1">
						{t("settings:contextManagement.diagnostics.delayAfterWrite.label")}
					</span>
					<div className="flex items-center gap-2">
						<Slider
							min={0}
							max={5000}
							step={100}
							value={[writeDelayMs]}
							onValueChange={([value]) => setCachedStateField("writeDelayMs", value)}
							data-testid="write-delay-slider"
						/>
						<span className="w-20">{writeDelayMs}ms</span>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:contextManagement.diagnostics.delayAfterWrite.description")}
					</div>
				</div>
			</Section>
			<Section className="pt-2">
				<VSCodeCheckbox
					checked={autoCondenseContext}
					onChange={(e: any) => setCachedStateField("autoCondenseContext", e.target.checked)}
					data-testid="auto-condense-context-checkbox">
					<span className="font-medium">{t("settings:contextManagement.autoCondenseContext.name")}</span>
				</VSCodeCheckbox>
				{autoCondenseContext && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
						<div className="flex items-center gap-4 font-bold">
							<FoldVertical size={16} />
							<div>{t("settings:contextManagement.condensingThreshold.label")}</div>
						</div>
						<div>
							<Select
								value={selectedThresholdProfile || "default"}
								onValueChange={(value) => {
									setSelectedThresholdProfile(value)
								}}
								data-testid="threshold-profile-select">
								<SelectTrigger className="w-full">
									<SelectValue
										placeholder={
											t("settings:contextManagement.condensingThreshold.selectProfile") ||
											"Select profile for threshold"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="default">
										{t("settings:contextManagement.condensingThreshold.defaultProfile") ||
											"Default (applies to all unconfigured profiles)"}
									</SelectItem>
									{(listApiConfigMeta || []).map((config) => {
										const profileThreshold = profileThresholds[config.id]
										const thresholdDisplay =
											profileThreshold !== undefined
												? profileThreshold === -1
													? ` ${t(
															"settings:contextManagement.condensingThreshold.usesGlobal",
															{
																threshold: autoCondenseContextPercent,
															},
														)}`
													: ` (${profileThreshold}%)`
												: ""
										return (
											<SelectItem key={config.id} value={config.id}>
												{config.name}
												{thresholdDisplay}
											</SelectItem>
										)
									})}
								</SelectContent>
							</Select>
						</div>

						{/* Threshold Slider */}
						<div>
							<div className="flex items-center gap-2">
								<Slider
									min={10}
									max={100}
									step={1}
									value={[getCurrentThresholdValue()]}
									onValueChange={([value]) => handleThresholdChange(value)}
									data-testid="condense-threshold-slider"
								/>
								<span className="w-20">{getCurrentThresholdValue()}%</span>
							</div>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{selectedThresholdProfile === "default"
									? t("settings:contextManagement.condensingThreshold.defaultDescription", {
											threshold: autoCondenseContextPercent,
										})
									: t("settings:contextManagement.condensingThreshold.profileDescription")}
							</div>
						</div>
					</div>
				)}
			</Section>

			{/* Vector Memory Section */}
			<Section className="pt-2">
				<div className="flex flex-col gap-3">
					<VSCodeCheckbox
						checked={vectorMemoryEnabled}
						onChange={(e: any) => setCachedStateField("vectorMemoryEnabled", e.target.checked)}
						data-testid="vector-memory-enabled-checkbox">
						<span className="font-medium">{t("settings:contextManagement.vectorMemory.label")}</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm">
						{t("settings:contextManagement.vectorMemory.description")}
					</div>
				</div>
			</Section>

			{/* Storage Configuration Section */}
			<Section className="pt-2">
				<div className="flex flex-col gap-3">
					<span className="font-medium text-base">{t("settings:contextManagement.storageConfig.title")}</span>
					<div className="text-vscode-descriptionForeground text-sm mb-2">
						{t("settings:contextManagement.storageConfig.description")}
					</div>

					{/* Redis Configuration */}
					<div className="flex flex-col gap-2">
						<label className="block text-sm font-medium">
							{t("settings:contextManagement.storageConfig.redis.label")}
						</label>
						<Input
							type="text"
							className="w-full bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded"
							placeholder="redis://localhost:6379"
							value={redisUrl || ""}
							onChange={(e) => setCachedStateField("redisUrl", e.target.value)}
							data-testid="redis-url-input"
						/>
						<div className="text-vscode-descriptionForeground text-xs">
							{t("settings:contextManagement.storageConfig.redis.description")}
						</div>
					</div>

					{/* Qdrant Configuration */}
					<div className="flex flex-col gap-2">
						<label className="block text-sm font-medium">
							{t("settings:contextManagement.storageConfig.qdrant.label")}
						</label>
						<Input
							type="text"
							className="w-full bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded mb-2"
							placeholder="http://localhost:6333"
							value={qdrantUrl || ""}
							onChange={(e) => setCachedStateField("qdrantUrl", e.target.value)}
							data-testid="qdrant-url-input"
						/>
						<label className="block text-xs font-medium">
							{t("settings:contextManagement.storageConfig.qdrant.collectionLabel")}
						</label>
						<Input
							type="text"
							className="w-full bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded"
							placeholder="roo_memory"
							value={qdrantCollectionName || ""}
							onChange={(e) => setCachedStateField("qdrantCollectionName", e.target.value)}
							data-testid="qdrant-collection-input"
						/>
						<div className="text-vscode-descriptionForeground text-xs">
							{t("settings:contextManagement.storageConfig.qdrant.description")}
						</div>
					</div>
				</div>
			</Section>

			{/* Sub-Agent Compression Section */}
			<Section className="pt-2">
				<div className="flex flex-col gap-3">
					<VSCodeCheckbox
						checked={subAgentCompressionEnabled}
						onChange={(e: any) => setCachedStateField("subAgentCompressionEnabled", e.target.checked)}
						data-testid="sub-agent-compression-enabled-checkbox">
						<span className="font-medium">{t("settings:contextManagement.subAgentCompression.label")}</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm">
						{t("settings:contextManagement.subAgentCompression.description")}
					</div>

					{/* Sub-Agent Configuration UI */}
					{subAgentCompressionEnabled && (
						<div className="flex flex-col gap-4 pl-3 mt-2 border-l-2 border-vscode-button-background">
							<div className="text-sm font-semibold">
								{t("settings:contextManagement.subAgentConfig.title")}
							</div>
							<div className="text-vscode-descriptionForeground text-sm">
								{t("settings:contextManagement.subAgentConfig.description")}
							</div>

							{/* Subagent API Configuration Selector */}
							<div className="flex flex-col gap-2">
								<label className="block text-sm font-medium">
									{t("settings:contextManagement.subAgentConfig.apiConfiguration.label") ||
										"Subagent API Configuration"}
								</label>
								<Select
									value={condensingApiConfigId || "-"}
									onValueChange={(value) => {
										const newConfigId = value === "-" ? "" : value
										setCondensingApiConfigId(newConfigId)
										vscode.postMessage({
											type: "condensingApiConfigId",
											text: newConfigId,
										})
									}}
									data-testid="subagent-api-config-select">
									<SelectTrigger className="w-full">
										<SelectValue
											placeholder={
												t(
													"settings:contextManagement.subAgentConfig.apiConfiguration.useCurrentConfig",
												) || "Use current API configuration"
											}
										/>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="-">
											{t(
												"settings:contextManagement.subAgentConfig.apiConfiguration.useCurrentConfig",
											) || "Use current API configuration"}
										</SelectItem>
										{(listApiConfigMeta || []).map((config) => (
											<SelectItem
												key={config.id}
												value={config.id}
												data-testid={`subagent-${config.id}-option`}>
												{config.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<div className="text-vscode-descriptionForeground text-xs">
									{t("settings:contextManagement.subAgentConfig.apiConfiguration.description") ||
										"Select which API configuration to use for subagent compression tasks. Leave as default to use the same configuration as main chat."}
								</div>
							</div>

							{/* Context Analyzer */}
							<div className="flex flex-col gap-2">
								<VSCodeCheckbox
									checked={useContextAnalyzer ?? true}
									onChange={(e: any) => setCachedStateField("useContextAnalyzer", e.target.checked)}
									data-testid="use-context-analyzer-checkbox">
									<span className="font-medium">
										{t("settings:contextManagement.subAgentConfig.contextAnalyzer.label")}
									</span>
								</VSCodeCheckbox>
								<div className="text-vscode-descriptionForeground text-xs pl-6">
									{t("settings:contextManagement.subAgentConfig.contextAnalyzer.description")}
								</div>
								{(useContextAnalyzer ?? true) && (
									<div className="flex flex-col gap-1 pl-6">
										<label className="text-xs font-medium">
											{t("settings:contextManagement.subAgentConfig.contextAnalyzer.promptLabel")}
										</label>
										<textarea
											className="w-full min-h-[80px] bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-xs resize-y"
											value={
												contextAnalyzerPrompt && contextAnalyzerPrompt.trim()
													? contextAnalyzerPrompt
													: DEFAULT_SUBAGENT_PROMPTS.contextAnalyzer
											}
											onChange={(e) =>
												setCachedStateField(
													"contextAnalyzerPrompt",
													e.target.value || undefined,
												)
											}
											placeholder={t(
												"settings:contextManagement.subAgentConfig.contextAnalyzer.promptPlaceholder",
											)}
											data-testid="context-analyzer-prompt-textarea"
										/>
										{/* 🔍 DEBUG INFO - 可见调试面板 */}
										<div className="mt-2 p-2 bg-yellow-900 bg-opacity-20 border border-yellow-600 rounded text-xs">
											<div className="font-bold text-yellow-400 mb-1">🔍 调试信息:</div>
											<div className="text-yellow-200 space-y-1">
												<div>
													• Prop值类型: <code>{typeof contextAnalyzerPrompt}</code>
												</div>
												<div>
													• Prop值:{" "}
													<code>
														{contextAnalyzerPrompt === undefined
															? "undefined"
															: contextAnalyzerPrompt === ""
																? '空字符串("")'
																: `有值(${contextAnalyzerPrompt?.length}字符)`}
													</code>
												</div>
												<div>
													• 默认值存在:{" "}
													<code>
														{DEFAULT_SUBAGENT_PROMPTS.contextAnalyzer
															? `是(${DEFAULT_SUBAGENT_PROMPTS.contextAnalyzer.length}字符)`
															: "否"}
													</code>
												</div>
												<div>
													• Fallback结果:{" "}
													<code>
														{(
															contextAnalyzerPrompt ??
															DEFAULT_SUBAGENT_PROMPTS.contextAnalyzer
														)?.length || 0}
														字符
													</code>
												</div>
												<div>
													• Textarea显示内容长度:{" "}
													<code>
														{(
															contextAnalyzerPrompt ??
															DEFAULT_SUBAGENT_PROMPTS.contextAnalyzer
														)?.length || 0}
													</code>
												</div>
											</div>
										</div>
										{contextAnalyzerPrompt && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setCachedStateField("contextAnalyzerPrompt", undefined)}
												className="self-start text-xs"
												data-testid="context-analyzer-prompt-reset">
												{t("settings:contextManagement.subAgentConfig.resetButton")}
											</Button>
										)}
									</div>
								)}
							</div>

							{/* Memory Extractor */}
							<div className="flex flex-col gap-2">
								<VSCodeCheckbox
									checked={useMemoryExtractor ?? true}
									onChange={(e: any) => setCachedStateField("useMemoryExtractor", e.target.checked)}
									data-testid="use-memory-extractor-checkbox">
									<span className="font-medium">
										{t("settings:contextManagement.subAgentConfig.memoryExtractor.label")}
									</span>
								</VSCodeCheckbox>
								<div className="text-vscode-descriptionForeground text-xs pl-6">
									{t("settings:contextManagement.subAgentConfig.memoryExtractor.description")}
								</div>
								{(useMemoryExtractor ?? true) && (
									<div className="flex flex-col gap-1 pl-6">
										<label className="text-xs font-medium">
											{t("settings:contextManagement.subAgentConfig.memoryExtractor.promptLabel")}
										</label>
										<textarea
											className="w-full min-h-[80px] bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-xs resize-y"
											value={
												memoryExtractorPrompt && memoryExtractorPrompt.trim()
													? memoryExtractorPrompt
													: DEFAULT_SUBAGENT_PROMPTS.memoryExtractor
											}
											onChange={(e) =>
												setCachedStateField(
													"memoryExtractorPrompt",
													e.target.value || undefined,
												)
											}
											placeholder={t(
												"settings:contextManagement.subAgentConfig.memoryExtractor.promptPlaceholder",
											)}
											data-testid="memory-extractor-prompt-textarea"
										/>
										{memoryExtractorPrompt && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setCachedStateField("memoryExtractorPrompt", undefined)}
												className="self-start text-xs"
												data-testid="memory-extractor-prompt-reset">
												{t("settings:contextManagement.subAgentConfig.resetButton")}
											</Button>
										)}
									</div>
								)}
							</div>

							{/* Code Summarizer */}
							<div className="flex flex-col gap-2">
								<VSCodeCheckbox
									checked={useCodeSummarizer ?? true}
									onChange={(e: any) => setCachedStateField("useCodeSummarizer", e.target.checked)}
									data-testid="use-code-summarizer-checkbox">
									<span className="font-medium">
										{t("settings:contextManagement.subAgentConfig.codeSummarizer.label")}
									</span>
								</VSCodeCheckbox>
								<div className="text-vscode-descriptionForeground text-xs pl-6">
									{t("settings:contextManagement.subAgentConfig.codeSummarizer.description")}
								</div>
								{(useCodeSummarizer ?? true) && (
									<div className="flex flex-col gap-1 pl-6">
										<label className="text-xs font-medium">
											{t("settings:contextManagement.subAgentConfig.codeSummarizer.promptLabel")}
										</label>
										<textarea
											className="w-full min-h-[80px] bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-xs resize-y"
											value={
												codeSummarizerPrompt && codeSummarizerPrompt.trim()
													? codeSummarizerPrompt
													: DEFAULT_SUBAGENT_PROMPTS.codeSummarizer
											}
											onChange={(e) =>
												setCachedStateField("codeSummarizerPrompt", e.target.value || undefined)
											}
											placeholder={t(
												"settings:contextManagement.subAgentConfig.codeSummarizer.promptPlaceholder",
											)}
											data-testid="code-summarizer-prompt-textarea"
										/>
										{codeSummarizerPrompt && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setCachedStateField("codeSummarizerPrompt", undefined)}
												className="self-start text-xs"
												data-testid="code-summarizer-prompt-reset">
												{t("settings:contextManagement.subAgentConfig.resetButton")}
											</Button>
										)}
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</Section>
		</div>
	)
}
