export function getApiMetrics(messages: any[]): any {
	return {
		totalTokensIn: 0,
		totalTokensOut: 0,
		totalCacheWrites: 0,
		totalCacheReads: 0,
		totalCost: 0,
		contextTokens: 0,
		subAgentTokenUsage: {},
	}
}
