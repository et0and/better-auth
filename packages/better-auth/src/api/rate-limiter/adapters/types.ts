import type { AuthContext } from "../../../types";

export interface RateLimiterAdapter {
	(
		ctx: AuthContext,
	): {
		/**
		 * Check if the request should be rate limited
		 * @param key Unique identifier for the request (e.g., user ID, IP address)
		 * @param limit Maximum number of requests allowed in the time window
		 * @param window Time window in seconds
		 * @returns A promise that resolves to a RateLimitResult
		 */
		check(key: string, limit: number, window: number): Promise<RateLimitResult>;
	};
}

export interface RateLimitResult {
	/**
	 * Whether the request should be allowed or blocked
	 */
	allowed: boolean;
	/**
	 * The number of remaining requests in the current window
	 */
	remaining: number;
	/**
	 * The time in seconds until the rate limit resets
	 */
	resetIn: number;
}
