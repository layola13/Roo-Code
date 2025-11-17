import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export function formatNumber(num: number): string {
	return new Intl.NumberFormat("en-US").format(num)
}

export function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	}).format(amount)
}

export function formatDate(date: Date | string): string {
	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(date))
}

export function formatRelativeTime(date: Date | string): string {
	const now = new Date()
	const then = new Date(date)
	const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)

	if (seconds < 60) return `${seconds}s ago`
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
	if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`
	return formatDate(date)
}

export function calculateDuration(start: Date | string, end: Date | string): string {
	const startTime = new Date(start).getTime()
	const endTime = new Date(end).getTime()
	const diff = endTime - startTime

	const seconds = Math.floor(diff / 1000)
	const minutes = Math.floor(seconds / 60)
	const hours = Math.floor(minutes / 60)

	if (hours > 0) return `${hours}h ${minutes % 60}m`
	if (minutes > 0) return `${minutes}m ${seconds % 60}s`
	return `${seconds}s`
}
