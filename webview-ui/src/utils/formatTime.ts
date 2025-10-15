/**
 * 格式化时间戳为 HH:MM 格式
 * @param timestamp Unix 时间戳（毫秒）
 * @returns 格式化后的时间字符串，例如 "08:37"
 */
export function formatMessageTime(timestamp: number): string {
	const date = new Date(timestamp)
	const hours = date.getHours().toString().padStart(2, "0")
	const minutes = date.getMinutes().toString().padStart(2, "0")
	return `${hours}:${minutes}`
}

/**
 * 检查消息时间是否超过1小时
 * @param timestamp Unix 时间戳（毫秒）
 * @returns 如果超过1小时则返回true，否则返回false
 */
export function isMessageOlderThanOneHour(timestamp: number): boolean {
	const now = Date.now()
	const oneHourAgo = now - 60 * 60 * 1000 // 1小时 = 60分钟 * 60秒 * 1000毫秒
	return timestamp < oneHourAgo
}

/**
 * 检查消息时间是否超过1天
 * @param timestamp Unix 时间戳（毫秒）
 * @returns 如果超过1天则返回true，否则返回false
 */
export function isMessageOlderThanOneDay(timestamp: number): boolean {
	const now = Date.now()
	const oneDayAgo = now - 24 * 60 * 60 * 1000 // 1天 = 24小时 * 60分钟 * 60秒 * 1000毫秒
	return timestamp < oneDayAgo
}
