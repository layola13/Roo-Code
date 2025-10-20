import { createContext, useContext } from "react"
const TranslationContext = createContext<any>(null)
export function useAppTranslation(ns?: string) {
	return { t: (key: string) => key }
}
