import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Cpu } from "lucide-react"
import { telemetryClient } from "@/utils/TelemetryClient"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"

interface WasmRuntimeSettingsProps extends HTMLAttributes<HTMLDivElement> {
	wasmRuntimeEnabled?: boolean
	wasmFallbackEnabled?: boolean
	wasmMaxRetries?: number
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

export const WasmRuntimeSettings = ({
	wasmRuntimeEnabled = true,
	wasmFallbackEnabled = true,
	wasmMaxRetries = 3,
	setCachedStateField,
	...props
}: WasmRuntimeSettingsProps) => {
	const { t } = useAppTranslation()

	const handleWasmEnabledChange = (value: boolean) => {
		setCachedStateField("wasmRuntimeEnabled", value)
		telemetryClient.capture("wasm_runtime_enabled_changed", { enabled: value })
	}

	const handleFallbackEnabledChange = (value: boolean) => {
		setCachedStateField("wasmFallbackEnabled", value)
		telemetryClient.capture("wasm_fallback_enabled_changed", { enabled: value })
	}

	const handleMaxRetriesChange = (value: number) => {
		setCachedStateField("wasmMaxRetries", value)
	}

	// Determine current runtime mode
	const getRuntimeMode = () => {
		if (!wasmRuntimeEnabled) return "typescript"
		if (!wasmFallbackEnabled) return "wasm-only"
		return "wasm-with-fallback"
	}

	const runtimeMode = getRuntimeMode()

	return (
		<div {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Cpu className="w-4" />
					<div>{t("settings:sections.wasmRuntime")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="space-y-6">
					{/* Description */}
					<div className="text-vscode-descriptionForeground text-sm">
						{t("settings:wasmRuntime.description")}
					</div>

					{/* Runtime Status Badge */}
					<div className="flex items-center gap-2 p-3 bg-vscode-editor-background rounded border border-vscode-panel-border">
						<div className="flex items-center gap-2">
							<span className="text-sm font-medium">{t("settings:wasmRuntime.currentMode")}:</span>
							<span
								className={`px-2 py-1 rounded text-xs font-medium ${
									runtimeMode === "wasm-with-fallback"
										? "bg-green-500/20 text-green-400"
										: runtimeMode === "wasm-only"
											? "bg-blue-500/20 text-blue-400"
											: "bg-yellow-500/20 text-yellow-400"
								}`}>
								{t(`settings:wasmRuntime.modes.${runtimeMode}`)}
							</span>
						</div>
					</div>

					{/* Enable WASM Setting */}
					<div className="flex flex-col gap-1">
						<VSCodeCheckbox
							checked={wasmRuntimeEnabled}
							onChange={(e: any) => handleWasmEnabledChange(e.target.checked)}
							data-testid="wasm-enabled-checkbox">
							<span className="font-medium">{t("settings:wasmRuntime.enableWasm.label")}</span>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
							{t("settings:wasmRuntime.enableWasm.description")}
						</div>
					</div>

					{/* Enable Fallback Setting (only show if WASM is enabled) */}
					{wasmRuntimeEnabled && (
						<div className="flex flex-col gap-1">
							<VSCodeCheckbox
								checked={wasmFallbackEnabled}
								onChange={(e: any) => handleFallbackEnabledChange(e.target.checked)}
								data-testid="wasm-fallback-checkbox">
								<span className="font-medium">{t("settings:wasmRuntime.enableFallback.label")}</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
								{t("settings:wasmRuntime.enableFallback.description")}
							</div>
						</div>
					)}

					{/* Max Retries Slider (only show if WASM and Fallback are enabled) */}
					{wasmRuntimeEnabled && wasmFallbackEnabled && (
						<div className="flex flex-col gap-2">
							<label className="font-medium text-sm">{t("settings:wasmRuntime.maxRetries.label")}</label>
							<div className="flex items-center gap-3">
								<input
									type="range"
									min="0"
									max="10"
									value={wasmMaxRetries}
									onChange={(e) => handleMaxRetriesChange(parseInt(e.target.value))}
									className="flex-1"
									data-testid="wasm-max-retries-slider"
								/>
								<span className="w-12 text-center font-medium">{wasmMaxRetries}</span>
							</div>
							<div className="text-vscode-descriptionForeground text-sm">
								{t("settings:wasmRuntime.maxRetries.description")}
							</div>
						</div>
					)}

					{/* Performance Notes */}
					<div className="p-3 bg-vscode-textBlockQuote-background border-l-4 border-vscode-textLink-foreground rounded">
						<div className="text-sm font-medium mb-2">
							{t("settings:wasmRuntime.performanceNotes.title")}
						</div>
						<ul className="text-xs text-vscode-descriptionForeground space-y-1 ml-4">
							<li>{t("settings:wasmRuntime.performanceNotes.simple")}</li>
							<li>{t("settings:wasmRuntime.performanceNotes.complex")}</li>
							<li>{t("settings:wasmRuntime.performanceNotes.production")}</li>
						</ul>
					</div>

					{/* Documentation Link */}
					<div className="text-sm">
						<VSCodeLink
							href="https://github.com/RooVetGit/Roo-Code/blob/main/docs/82-wasm-runtime-switching-guide.md"
							style={{ display: "inline" }}>
							{t("settings:wasmRuntime.learnMore")}
						</VSCodeLink>
					</div>
				</div>
			</Section>
		</div>
	)
}
