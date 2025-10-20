export function findLast<T>(arr: T[], predicate: (item: T) => boolean): T | undefined {
	return arr.slice().reverse().find(predicate)
}
