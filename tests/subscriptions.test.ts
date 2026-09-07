import assert from "node:assert/strict";
import { test } from "node:test";
import {
	requestWithSubscriptionFallback,
	subscriptionProviders,
	type SubscriptionContext,
	type SubscriptionIdentity,
} from "../subscriptions.ts";

const primary = "openai-codex";
const second = "openai-codex-2";
const third = "openai-codex-3";

function token(accountId: string, sub = "learner"): string {
	const payload = { sub, "https://api.openai.com/auth": { chatgpt_account_id: accountId } };
	return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

function context(tokens: Record<string, string | undefined>, current = primary): SubscriptionContext {
	return {
		model: { provider: current, id: "gpt-5.5" },
		modelRegistry: {
			getAll: () => Object.keys(tokens).flatMap((provider) => [{ provider }, { provider }]),
			getApiKeyForProvider: async (provider) => tokens[provider],
		},
	};
}

const limited = () => new Response('{"error":{"type":"usage_limit_reached"}}', { status: 429 });

// The reported regression: two exhausted subscriptions must not hide the third.
test("falls through two quota responses to the remaining subscription", async () => {
	const ctx = context({ [primary]: token("one"), [second]: token("two"), [third]: token("three") });
	const seen: SubscriptionIdentity[] = [];
	const success = new Response("image stream");
	const result = await requestWithSubscriptionFallback(ctx, async (identity) => {
		seen.push(identity);
		return identity.provider === third ? success : limited();
	});
	assert.deepEqual(seen.map(({ provider, accountId }) => [provider, accountId]), [
		[primary, "one"], [second, "two"], [third, "three"],
	]);
	assert.deepEqual(seen.map(({ token: access }) => access), [token("one"), token("two"), token("three")]);
	assert.equal(result.provider, third);
	assert.equal(result.response, success);
	assert.equal(success.bodyUsed, false);
});

test("keeps the single-subscription and older registry path working", async () => {
	const ctx: SubscriptionContext = { modelRegistry: { getApiKeyForProvider: async () => token("one") } };
	assert.deepEqual(subscriptionProviders(ctx), [primary]);
	const result = await requestWithSubscriptionFallback(ctx, async () => new Response("image"));
	assert.equal(result.provider, primary);
});

test("prefers a selected subscription alias, excluding unrelated and paid providers", () => {
	const ctx = context({
		openai: "sk-fake", anthropic: "other", "openai-codex-other": "other",
		"openai-codex-1": "other", [third]: token("three"), [primary]: token("one"),
		"openai-codex-alt": token("two"), "openai-codex-10": token("ten"),
	}, third);
	assert.deepEqual(subscriptionProviders(ctx), [third, primary, "openai-codex-10", "openai-codex-alt"]);
});

test("missing, malformed, and unrefreshable credentials do not hide a usable account", async () => {
	const ctx = context({ [primary]: undefined, [second]: "sk-not-an-oauth-token", [third]: token("three") });
	const original = ctx.modelRegistry.getApiKeyForProvider;
	ctx.modelRegistry.getApiKeyForProvider = async (provider) => {
		if (provider === primary) throw new Error("sensitive refresh failure");
		return original(provider);
	};
	const seen: string[] = [];
	const result = await requestWithSubscriptionFallback(ctx, async ({ provider }) => {
		seen.push(provider);
		return new Response("image");
	});
	assert.deepEqual(seen, [third]);
	assert.equal(result.provider, third);
});

test("deduplicates aliases of the same subscription even with refreshed tokens", async () => {
	const duplicate = token("one");
	const ctx = context({ [primary]: duplicate, [second]: duplicate.replace("header", "refreshed"), [third]: token("three") });
	const seen: string[] = [];
	await requestWithSubscriptionFallback(ctx, async ({ provider }) => {
		seen.push(provider);
		return provider === third ? new Response("image") : limited();
	});
	assert.deepEqual(seen, [primary, third]);
});

test("different users on one account are not deduplicated", async () => {
	const ctx = context({ [primary]: token("team", "first"), [second]: token("team", "second") });
	const seen: string[] = [];
	await requestWithSubscriptionFallback(ctx, async ({ provider }) => {
		seen.push(provider);
		return provider === second ? new Response("image") : limited();
	});
	assert.deepEqual(seen, [primary, second]);
});

test("tries each account once and reports pool exhaustion without credentials", async () => {
	const ctx = context({ [primary]: token("one"), [second]: token("two") });
	const seen: string[] = [];
	await assert.rejects(requestWithSubscriptionFallback(ctx, async ({ provider }) => {
		seen.push(provider);
		return limited();
	}), (error: Error) => {
		assert.match(error.message, /all 2 available subscription\(s\) are rate-limited/);
		assert.match(error.message, /usage_limit_reached/);
		assert.ok(!error.message.includes(token("one")));
		return true;
	});
	assert.deepEqual(seen, [primary, second]);
});

test("reports missing usable credentials without exposing refresh failures", async () => {
	const ctx = context({ [primary]: undefined, [second]: undefined });
	ctx.modelRegistry.getApiKeyForProvider = async () => { throw new Error("private-token-data"); };
	await assert.rejects(requestWithSubscriptionFallback(ctx, async () => {
		assert.fail("must not send without OAuth");
	}), /^Error: Missing usable OpenAI Codex OAuth credentials/);
});

for (const status of [400, 401, 403, 500, 503]) {
	test(`does not replay a rejected HTTP ${status}`, async () => {
		const ctx = context({ [primary]: token("one"), [second]: token("two") });
		let calls = 0;
		await assert.rejects(requestWithSubscriptionFallback(ctx, async () => {
			calls++;
			return new Response("request rejected", { status });
		}), new RegExp(`failed \\(${status}\\)`));
		assert.equal(calls, 1);
	});
}

test("does not retry transport failures or failures after a stream is accepted", async () => {
	const ctx = context({ [primary]: token("one"), [second]: token("two") });
	let calls = 0;
	await assert.rejects(requestWithSubscriptionFallback(ctx, async () => {
		calls++;
		throw new Error("network disconnected");
	}), /network disconnected/);
	assert.equal(calls, 1);
	calls = 0;
	const result = await requestWithSubscriptionFallback(ctx, async () => {
		calls++;
		return new Response(new ReadableStream({ start(controller) { controller.error(new Error("stream failed")); } }));
	});
	await assert.rejects(result.response.text(), /stream failed/);
	assert.equal(calls, 1);
});

test("cancellation before a request or during a quota response stops fallback", async () => {
	const ctx = context({ [primary]: token("one"), [second]: token("two") });
	const controller = new AbortController();
	controller.abort();
	let calls = 0;
	await assert.rejects(requestWithSubscriptionFallback(ctx, async () => {
		calls++;
		return new Response("image");
	}, controller.signal), { name: "AbortError" });
	assert.equal(calls, 0);
	const during = new AbortController();
	await assert.rejects(requestWithSubscriptionFallback(ctx, async () => {
		calls++;
		during.abort();
		return limited();
	}, during.signal), { name: "AbortError" });
	assert.equal(calls, 1);
});
