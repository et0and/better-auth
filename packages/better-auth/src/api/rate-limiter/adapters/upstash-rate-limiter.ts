import { Ratelimit } from "@upstash/ratelimit";
import { Pipeline } from "@upstash/redis";
import type { RateLimiterAdapter } from "./types";

type IsDenied = 0 | 1;
interface Redis {
	sadd: <TData>(key: string, ...members: TData[]) => Promise<number>;
	hset: <TValue>(
		key: string,
		obj: {
			[key: string]: TValue;
		},
	) => Promise<number>;
	eval: <TArgs extends unknown[], TData = unknown>(
		...args: [script: string, keys: string[], args: TArgs]
	) => Promise<TData>;
	evalsha: <TArgs extends unknown[], TData = unknown>(
		...args: [sha1: string, keys: string[], args: TArgs]
	) => Promise<TData>;
	scriptLoad: (...args: [script: string]) => Promise<string>;
	smismember: (key: string, members: string[]) => Promise<IsDenied[]>;
	multi: () => Pipeline;
}

export const upstashRateLimiter = ({
	redis,
}: {
	redis: Redis;
}): RateLimiterAdapter => {
	return (ctx) => {
		const ratelimit = new Ratelimit({
			redis,
			limiter: Ratelimit.fixedWindow(
				ctx.rateLimit.max,
				`${ctx.rateLimit.window}s`,
			),
			prefix: "@better-auth/rate-limit",
		});
		return {
			check: async (key: string, max: number, window: number) => {
				const result = await ratelimit.limit(key, {
					rate: max / window,
				});
				return {
					allowed: result.success,
					remaining: Math.floor((result.remaining - Date.now()) / 1000),
					resetIn: Math.floor((result.reset - Date.now()) / 1000),
				};
			},
		};
	};
};
