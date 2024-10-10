import { describe } from "vitest";
import { runRateLimiterTest } from "./rate-limiter-test";
import { baseRateLimiter } from "./adapters/base";

describe("base-rate-limiter", async () => {
	runRateLimiterTest(baseRateLimiter());
});
