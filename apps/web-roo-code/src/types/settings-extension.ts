// Temporary type extension for web-specific settings
import { RooCodeSettings } from "@roo-code/types"

// Extend RooCodeSettings with apiConfiguration for backward compatibility
export interface WebRooCodeSettings extends RooCodeSettings {
	apiConfiguration?: any
}
