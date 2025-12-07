import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { FileSliders } from "lucide-react"

import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type SplitFileSettingsProps = HTMLAttributes<HTMLDivElement> & {
	splitFileLinesPerChunk?: number
	splitFileOverlapLines?: number
	setCachedStateField: SetCachedStateField<"splitFileLinesPerChunk" | "splitFileOverlapLines">
}

export const SplitFileSettings = ({
	splitFileLinesPerChunk,
	splitFileOverlapLines,
	setCachedStateField,
	className,
	...props
}: SplitFileSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col", className)} {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<FileSliders className="w-4" />
					<div>{t("settings:sections.splitFile")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-1">
						<div className="flex items-center gap-2 font-bold">
							<span className="codicon codicon-split-horizontal" />
							<div>{t("settings:splitFile.configuration.label")}</div>
						</div>
						<div className="text-vscode-descriptionForeground">
							{t("settings:splitFile.configuration.description")}
						</div>
					</div>
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
						<div>
							<label className="block font-medium mb-1">
								{t("settings:splitFile.linesPerChunk.label")}
							</label>
							<div className="flex items-center gap-2">
								<Slider
									min={100}
									max={1000}
									step={50}
									value={[splitFileLinesPerChunk ?? 100]}
									onValueChange={([value]) => setCachedStateField("splitFileLinesPerChunk", value)}
									data-testid="split-file-lines-per-chunk-slider"
								/>
								<span className="w-16">{splitFileLinesPerChunk ?? 100}</span>
							</div>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:splitFile.linesPerChunk.description")}
							</div>
						</div>
						<div>
							<label className="block font-medium mb-1">
								{t("settings:splitFile.overlapLines.label")}
							</label>
							<div className="flex items-center gap-2">
								<Slider
									min={0}
									max={100}
									step={10}
									value={[splitFileOverlapLines ?? 0]}
									onValueChange={([value]) => setCachedStateField("splitFileOverlapLines", value)}
									data-testid="split-file-overlap-lines-slider"
								/>
								<span className="w-16">{splitFileOverlapLines ?? 0}</span>
							</div>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:splitFile.overlapLines.description")}
							</div>
						</div>
					</div>
				</div>
			</Section>
		</div>
	)
}
