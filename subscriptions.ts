import { Buffer } from "node:buffer";

export const PRIMARY_PROVIDER = "openai-codex";

export type SubscriptionContext = {
	model?: { provider: string; id: string };
	modelRegistry: {
		getApiKeyForProvider: (provider: string) => Promise<string | undefined>;
		getAll?: () => ReadonlyArray<{ provider: string }>;
	};
};

export type SubscriptionIdentity = {
	provider: string;
	token: string;
	accountId: string;
};

export function isSubscriptionProvider(provider: string): boolean {
	return provider === PRIMARY_PROVIDER || provider === `${PRIMARY_PROVIDER}-alt`
		|| /^openai-codex-([2-9]|[1-9]\d+)$/.test(provider);
}

export function subscriptionProviders(ctx: SubscriptionContext): string[] {
	const registered = (ctx.modelRegistry.getAll?.() ?? [])
		.map((model) => model.provider)
		.filter(isSubscriptionProvider)
		.sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
	const current = ctx.model?.provider;
	return [...new Set([
		...(current && isSubscriptionProvider(current) ? [current] : []),
		PRIMARY_PROVIDER,
		...registered,
	])];
}

function identityFromToken(token: string): { accountId: string; subject: string } {
	const payload = token.split(".")[1];
	if (!payload) throw new Error("Expected a subscription OAuth token");
	const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
	const accountId = claims?.["https://api.openai.com/auth"]?.chatgpt_account_id;
	if (typeof accountId !== "string" || !accountId) throw new Error("Missing subscription account ID");
	return { accountId, subject: typeof claims.sub === "string" ? claims.sub : "" };
}

/**
 * Resolve each subscription through Pi so expired tokens can refresh normally.
 * Only a rejected HTTP 429 is replayable. A successful response is returned
 * before consuming its stream; stream, network, and non-quota failures must not
 * replay an image generation that may already have started.
 */
export async function requestWithSubscriptionFallback(
	ctx: SubscriptionContext,
	send: (identity: SubscriptionIdentity) => Promise<Response>,
	signal?: AbortSignal,
): Promise<{ response: Response; provider: string }> {
	const seenAccounts = new Set<string>();
	let limitedCount = 0;
	let lastLimit = "";

	for (const provider of subscriptionProviders(ctx)) {
		signal?.throwIfAborted();
		let identity: SubscriptionIdentity;
		try {
			const token = await ctx.modelRegistry.getApiKeyForProvider(provider);
			signal?.throwIfAborted();
			if (!token) continue;
			const { accountId, subject } = identityFromToken(token);
			const accountKey = JSON.stringify([accountId, subject]);
			if (seenAccounts.has(accountKey)) continue;
			seenAccounts.add(accountKey);
			identity = { provider, token, accountId };
		} catch {
			signal?.throwIfAborted();
			// A signed-out or unrefreshable account must not hide another usable
			// subscription. Never expose token/refresh errors in tool output.
			continue;
		}

		signal?.throwIfAborted();
		const response = await send(identity);
		signal?.throwIfAborted();
		if (response.ok) return { response, provider };
		const errorText = (await response.text()).slice(0, 4096);
		signal?.throwIfAborted();
		if (response.status !== 429) {
			throw new Error(`Codex image request failed (${response.status}): ${errorText}`);
		}
		limitedCount++;
		lastLimit = errorText;
	}

	if (limitedCount > 0) {
		throw new Error(`Codex image request failed (429): all ${limitedCount} available subscription(s) are rate-limited. ${lastLimit}`);
	}
	throw new Error("Missing usable OpenAI Codex OAuth credentials. Run /login and select a ChatGPT/Codex subscription.");
}
