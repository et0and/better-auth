import type { AuthContext, RateLimit } from "../../../types";
import { logger } from "../../../utils/logger";
import type { RateLimiterAdapter } from "./types";

function createDBStorage(ctx: AuthContext, tableName?: string) {
	const model = tableName ?? "rateLimit";
	const db = ctx.adapter;
	return {
		get: async (key: string) => {
			const res = await db.findOne<RateLimit>({
				model,
				where: [{ field: "key", value: key }],
			});
			return res;
		},
		set: async (key: string, value: RateLimit, _update?: boolean) => {
			try {
				if (_update) {
					await db.update({
						model: tableName ?? "rateLimit",
						where: [{ field: "key", value: key }],
						update: {
							count: value.count,
							lastRequest: value.lastRequest,
						},
					});
				} else {
					await db.create({
						model: tableName ?? "rateLimit",
						data: {
							key,
							count: value.count,
							lastRequest: value.lastRequest,
						},
					});
				}
			} catch (e) {
				logger.error("Error setting rate limit", e);
			}
		},
	};
}

const memory = new Map<string, RateLimit>();

export function getRateLimitStorage(ctx: AuthContext) {
	if (ctx.rateLimit.storage === "secondary-storage") {
		return {
			get: async (key: string) => {
				const stringified = await ctx.options.secondaryStorage?.get(key);
				return stringified ? (JSON.parse(stringified) as RateLimit) : undefined;
			},
			set: async (key: string, value: RateLimit) => {
				await ctx.options.secondaryStorage?.set?.(key, JSON.stringify(value));
			},
		};
	}
	const storage = ctx.rateLimit.storage;
	if (storage === "memory") {
		return {
			async get(key: string) {
				return memory.get(key);
			},
			async set(key: string, value: RateLimit, _update?: boolean) {
				memory.set(key, value);
			},
		};
	}
	return createDBStorage(ctx, ctx.rateLimit.tableName);
}

export const baseRateLimiter = (): RateLimiterAdapter => {
	return (ctx) => {
		return {
			check: async (key: string, max: number, window: number) => {
				const storage = getRateLimitStorage(ctx);
				const data = await storage.get(key);
				const now = Date.now();
				const windowMs = window * 1000;

				if (!data) {
					await storage.set(key, {
						key,
						count: 1,
						lastRequest: now,
					});
					return {
						allowed: true,
						remaining: max - 1,
						resetIn: window,
					};
				}

				if (now - data.lastRequest >= windowMs) {
					await storage.set(key, {
						...data,
						count: 1,
						lastRequest: now,
					});
					return {
						allowed: true,
						remaining: max - 1,
						resetIn: window,
					};
				}

				if (data.count >= max) {
					return {
						allowed: false,
						remaining: 0,
						resetIn: Math.floor((data.lastRequest + windowMs - now) / 1000),
					};
				}

				await storage.set(key, {
					...data,
					count: data.count + 1,
					lastRequest: now,
				});

				return {
					allowed: true,
					remaining: max - data.count - 1,
					resetIn: Math.floor((data.lastRequest + windowMs - now) / 1000),
				};
			},
		};
	};
};
