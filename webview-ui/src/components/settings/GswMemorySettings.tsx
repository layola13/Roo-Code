import { HTMLAttributes, useEffect } from "react"
import { VSCodeCheckbox, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"
import { Brain } from "lucide-react"

import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui"
import { useExtensionState } from "@/context/ExtensionStateContext"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type GswMemorySettingsProps = HTMLAttributes<HTMLDivElement> & {
	gswMemoryEnabled?: boolean
	gswMaxFileSizeKB?: number
	gswArchiveAfterDays?: number
	gswEnableAutoRotation?: boolean
	apiConfiguration?: any
	setApiConfigurationField?: <K extends string>(field: K, value: any, isUserAction?: boolean) => void
	setCachedStateField: SetCachedStateField<
		"gswMemoryEnabled" | "gswMaxFileSizeKB" | "gswArchiveAfterDays" | "gswEnableAutoRotation"
	>
}

export const GswMemorySettings = ({
	gswMemoryEnabled,
	gswMaxFileSizeKB,
	gswArchiveAfterDays,
	gswEnableAutoRotation,
	apiConfiguration,
	setApiConfigurationField,
	setCachedStateField,
	className,
	...props
}: GswMemorySettingsProps) => {
	const { listApiConfigMeta } = useExtensionState()
	const gswModelConfigId = apiConfiguration?.gswModelConfigId ?? ""

	// DEBUG: Log current value (same as JudgeSettings)
	useEffect(() => {
		console.log(
			"[GswMemorySettings] Current gswModelConfigId from apiConfiguration:",
			JSON.stringify(apiConfiguration?.gswModelConfigId),
		)
		console.log("[GswMemorySettings] Final gswModelConfigId (with fallback):", gswModelConfigId)
		console.log("[GswMemorySettings] apiConfiguration object:", JSON.stringify(apiConfiguration, null, 2))
	}, [apiConfiguration?.gswModelConfigId, gswModelConfigId, apiConfiguration])

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader description="GSW (Goal-Session-Workflow) triple memory system captures user interactions, LLM reasoning, and code evolution for better context understanding">
				<div className="flex items-center gap-2">
					<Brain className="w-4" />
					<div>GSW Memory System</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="flex flex-col gap-3">
					<VSCodeCheckbox
						checked={gswMemoryEnabled ?? true}
						onChange={(e: any) => setCachedStateField("gswMemoryEnabled", e.target.checked)}
						data-testid="gsw-memory-enabled-checkbox">
						<span className="font-medium">Enable GSW Memory System</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm">
						Automatically captures three types of memory: user interactions (goals and context switches),
						LLM reasoning (decision points and thought process), and code evolution (file modifications with
						self-reflection).
					</div>

					{gswMemoryEnabled && (
						<div className="flex flex-col gap-4 pl-3 mt-2 border-vscode-button-background">
							{/* GSW Model Configuration */}
							<div>
								<label className="block font-medium mb-2">LLM Model Configuration</label>
								<VSCodeDropdown
									value={gswModelConfigId}
									onChange={(e: any) =>
										setApiConfigurationField?.("gswModelConfigId", e.target.value)
									}
									className="w-full"
									data-testid="gsw-model-config-dropdown">
									<VSCodeOption value="">Use Current Model</VSCodeOption>
									{(listApiConfigMeta ?? []).map((config) => (
										<VSCodeOption key={config.id} value={config.id}>
											{config.name}
										</VSCodeOption>
									))}
								</VSCodeDropdown>
								<div className="text-vscode-descriptionForeground text-sm mt-1">
									Select a dedicated LLM configuration for GSW memory operations. Leave empty to use
									the current model.
								</div>
							</div>

							{/* Max File Size */}
							<div>
								<span className="block font-medium mb-1">Maximum Memory File Size</span>
								<div className="flex items-center gap-2">
									<Slider
										min={10}
										max={500}
										step={10}
										value={[gswMaxFileSizeKB ?? 50]}
										onValueChange={([value]) => setCachedStateField("gswMaxFileSizeKB", value)}
										data-testid="gsw-max-file-size-slider"
									/>
									<span className="w-16 text-sm">{gswMaxFileSizeKB ?? 50} KB</span>
								</div>
								<div className="text-vscode-descriptionForeground text-sm mt-1">
									Memory files will be rotated when they exceed this size to maintain performance
								</div>
							</div>

							{/* Archive After Days */}
							<div>
								<span className="block font-medium mb-1">Archive Memory After</span>
								<div className="flex items-center gap-2">
									<Slider
										min={1}
										max={365}
										step={1}
										value={[gswArchiveAfterDays ?? 30]}
										onValueChange={([value]) => setCachedStateField("gswArchiveAfterDays", value)}
										data-testid="gsw-archive-days-slider"
									/>
									<span className="w-16 text-sm">{gswArchiveAfterDays ?? 30} days</span>
								</div>
								<div className="text-vscode-descriptionForeground text-sm mt-1">
									Older memory files will be archived to keep the active memory fresh and relevant
								</div>
							</div>

							{/* Auto Rotation */}
							<div>
								<VSCodeCheckbox
									checked={gswEnableAutoRotation ?? true}
									onChange={(e: any) =>
										setCachedStateField("gswEnableAutoRotation", e.target.checked)
									}
									data-testid="gsw-auto-rotation-checkbox">
									<span className="font-medium">Enable Automatic File Rotation</span>
								</VSCodeCheckbox>
								<div className="text-vscode-descriptionForeground text-sm mt-1 pl-6">
									Automatically create new memory files when the current file reaches the size limit
								</div>
							</div>

							{/* Memory Storage Location Info */}
							<div className="mt-2 p-3 bg-vscode-editor-background rounded border border-vscode-panel-border">
								<div className="text-xs font-medium mb-1">Memory Storage Location</div>
								<div className="text-vscode-descriptionForeground text-xs">
									GSW memories are stored in{" "}
									<code className="px-1 py-0.5 bg-vscode-textCodeBlock-background rounded">
										.project/
									</code>{" "}
									directory at your project root:
									<ul className="list-disc list-inside mt-1 ml-2 space-y-0.5">
										<li>
											<code>interaction/</code> - User goals and context switches
										</li>
										<li>
											<code>reasoning/</code> - LLM decision points and reasoning
										</li>
										<li>
											<code>evolution/</code> - Code modifications with reflection
										</li>
									</ul>
								</div>
							</div>
						</div>
					)}
				</div>
			</Section>
		</div>
	)
}
