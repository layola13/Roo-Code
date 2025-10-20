import { createContext, useContext } from "react"
const ExtensionStateContext = createContext<any>({})
export function useExtensionState() {
	return useContext(ExtensionStateContext) || {}
}
