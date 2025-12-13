import { HTMLAttributes } from "react"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { Zap } from "lucide-react"

import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type RealtimeCompressionSettingsProps = HTMLAttributes<HTMLDivElement> & {
	realtimeCompressionEnabled?: boolean
	realtimeCompressionMessageIncrement?: number
	realtimeCompressionTokenIncrement?: number
	realtimeCompressionMinIntervalSeconds?: number
	realtimeCompressionCacheValidityMinutes?: number
	setCachedStateField: SetCachedStateField<
		| "realtimeCompressionEnabled"
		| "realtimeCompressionMessageIncrement"
		| "realtimeCompressionTokenIncrement"
		| "realtimeCompressionMinIntervalSeconds"
		| "realtimeCompressionCacheValidityMinutes"
	>
}

export const RealtimeCompressionSettings = ({
	realtimeCompressionEnabled,
	realtimeCompressionMessageIncrement,
	realtimeCompressionTokenIncrement,
	realtimeCompressionMinIntervalSeconds,
	realtimeCompressionCacheValidityMinutes,
	setCachedStateField,
	className,
	...props
}: RealtimeCompressionSettingsProps) => {
	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader description="Pre-warm cache strategy for zero-wait context compression. Background summarization runs after each API response.">
				<div className="flex items-center gap-2">
					<Zap className="w-4" />
					<div>Realtime Compression</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="flex flex-col gap-3">
					<VSCodeCheckbox
						checked={realtimeCompressionEnabled ?? true}
						onChange={(e: any) => setCachedStateField("realtimeCompressionEnabled", e.target.checked)}
						data-testid="realtime-compression-enabled-checkbox">
						<span className="font-medium">Enable Realtime Compression</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm">
						When enabled, background summarization runs after each API response to keep a pre-computed
						summary ready. This eliminates wait time when context window limit is reached.
					</div>

					{realtimeCompressionEnabled && (
						<div className="flex flex-col gap-4 pl-3 mt-2 border-vscode-button-background">
							{/* Message Increment */}
							<div>
								<span className="block font-medium mb-1">Message Increment</span>
								<div className="flex items-center gap-2">
									<Slider
										min={1}
										max={20}
										step={1}
										value={[realtimeCompressionMessageIncrement ?? 5]}
										onValueChange={([value]) =>
											setCachedStateField("realtimeCompressionMessageIncrement", value)
										}
										data-testid="realtime-compression-message-increment-slider"
									/>
									<span className="w-16 text-sm">
										{realtimeCompressionMessageIncrement ?? 5} msgs
									</span>
								</div>
								<div className="text-vscode-descriptionForeground text-sm mt-1">
									Trigger background summary every N new messages
								</div>
							</div>

							{/* Token Increment */}
							<div>
								<span className="block font-medium mb-1">Token Increment</span>
								<div className="flex items-center gap-2">
									<Slider
										min={5000}
										max={50000}
										step={5000}
										value={[realtimeCompressionTokenIncrement ?? 20000]}
										onValueChange={([value]) =>
											setCachedStateField("realtimeCompressionTokenIncrement", value)
										}
										data-testid="realtime-compression-token-increment-slider"
									/>
									<span className="w-20 text-sm">
										{((realtimeCompressionTokenIncrement ?? 20000) / 1000).toFixed(0)}k tokens
									</span>
								</div>
								<div className="text-vscode-descriptionForeground text-sm mt-1">
									Trigger background summary every N new tokens
								</div>
							</div>

							{/* Minimum Interval (Rate Limit Protection) */}
							<div>
								<span className="block font-medium mb-1">Minimum Interval (Rate Limit Protection)</span>
								<div className="flex items-center gap-2">
									<Slider
										min={30}
										max={300}
										step={10}
										value={[realtimeCompressionMinIntervalSeconds ?? 60]}
										onValueChange={([value]) =>
											setCachedStateField("realtimeCompressionMinIntervalSeconds", value)
										}
										data-testid="realtime-compression-min-interval-slider"
									/>
									<span className="w-16 text-sm">{realtimeCompressionMinIntervalSeconds ?? 60}s</span>
								</div>
								<div className="text-vscode-descriptionForeground text-sm mt-1">
									Minimum seconds between background summaries to avoid triggering LLM rate limits
								</div>
							</div>

							{/* Cache Validity */}
							<div>
								<span className="block font-medium mb-1">Cache Validity</span>
								<div className="flex items-center gap-2">
									<Slider
										min={1}
										max={30}
										step={1}
										value={[realtimeCompressionCacheValidityMinutes ?? 5]}
										onValueChange={([value]) =>
											setCachedStateField("realtimeCompressionCacheValidityMinutes", value)
										}
										data-testid="realtime-compression-cache-validity-slider"
									/>
									<span className="w-16 text-sm">
										{realtimeCompressionCacheValidityMinutes ?? 5} min
									</span>
								</div>
								<div className="text-vscode-descriptionForeground text-sm mt-1">
									How long cached summaries remain valid before they need to be refreshed
								</div>
							</div>

							{/* Info Box */}
							<div className="mt-2 p-3 bg-vscode-editor-background rounded border border-vscode-panel-border">
								<div className="text-xs font-medium mb-1">How It Works</div>
								<div className="text-vscode-descriptionForeground text-xs">
									<ul className="list-disc list-inside space-y-0.5">
										<li>After each API response, a background summary is generated</li>
										<li>
											When context window limit is reached, the cached summary is used instantly
										</li>
										<li>The minimum interval prevents hitting LLM rate limits</li>
										<li>Cache validity ensures summaries stay fresh and relevant</li>
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
