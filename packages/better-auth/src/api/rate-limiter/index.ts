import { getSignedCookie } from "better-call";
import type { AuthContext } from "../../types";
import { getIp } from "../../utils/get-request-ip";
import { logger } from "../../utils/logger";
import { baseRateLimiter } from "./adapters/base";

async function getKey(req: Request, ctx: AuthContext) {
	let identifier = "";
	const path = req.url.replace(ctx.baseURL, "");
	try {
		const cookie = await getSignedCookie(
			req.headers,
			ctx.secret,
			ctx.authCookies.sessionToken.name,
			ctx.authCookies.sessionToken.name.startsWith("__Secure-")
				? "secure"
				: undefined,
		);
		if (cookie) {
			identifier = cookie;
		}
	} catch (e) {
		logger.error("Error getting session token", e);
	}
	if (!identifier) {
		const ip = getIp(req) ?? "";
		const userAgent = req.headers.get("User-Agent") ?? "";
		identifier = `${ip}:${userAgent}`;
	}
	return `${path}:${identifier}`;
}

function rateLimitResponse(retryAfter: number) {
	return new Response(
		JSON.stringify({
			message: "Too many requests. Please try again later.",
		}),
		{
			status: 429,
			statusText: "Too Many Requests",
			headers: {
				"X-Retry-After": retryAfter.toString(),
			},
		},
	);
}

export async function onRequestRateLimit(req: Request, ctx: AuthContext) {
	if (!ctx.rateLimit.enabled) {
		return;
	}
	const baseURL = ctx.baseURL;
	const path = req.url.replace(baseURL, "");
	let window = ctx.rateLimit.window;
	let max = ctx.rateLimit.max;
	const key = await getKey(req, ctx);
	const specialRules = getDefaultSpecialRules();
	const specialRule = specialRules.find((rule) => rule.pathMatcher(path));

	if (specialRule) {
		window = specialRule.window;
		max = specialRule.max;
	}

	for (const plugin of ctx.options.plugins || []) {
		if (plugin.rateLimit) {
			const matchedRule = plugin.rateLimit.find((rule) =>
				rule.pathMatcher(path),
			);
			if (matchedRule) {
				window = matchedRule.window;
				max = matchedRule.max;
				break;
			}
		}
	}

	if (ctx.rateLimit.customRules) {
		const customRule = ctx.rateLimit.customRules[path];
		if (customRule) {
			window = customRule.window;
			max = customRule.max;
		}
	}
	const getAdapter = ctx.options.rateLimit?.adapter || baseRateLimiter();
	const adapter = getAdapter(ctx);
	const result = await adapter.check(key, max, window);
	if (!result.allowed) {
		return rateLimitResponse(result.resetIn);
	}
	return;
}

function getDefaultSpecialRules() {
	const specialRules = [
		{
			pathMatcher(path: string) {
				return path.startsWith("/sign-in") || path.startsWith("/sign-up");
			},
			window: 10,
			max: 7,
		},
	];
	return specialRules;
}
