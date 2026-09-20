/**
 * Resilience wrapper around callSignalTool.
 *
 * Why this exists: we proved on 2026-09-14 that Bitget's shared, public
 * signal MCP server is unreliable under hackathon-week load — some tools
 * (sentiment, FRED-backed macro, Yahoo/CoinGecko lookups) intermittently
 * error out or hang, while technical_analysis (Binance/ccxt-backed) stays
 * solid. Rather than let one flaky call break a live demo, every signal
 * fetch goes through here, which adds:
 *
 *   1. A hard timeout (the raw client has hung for 60s+ in testing)
 *   2. One retry with a short backoff (many failures are transient)
 *   3. A short-lived cache, so a judge re-loading the page doesn't re-roll
 *      the dice on a flaky upstream, and so we're not hammering a server
 *      everyone else is also hammering
 *   4. A uniform { ok, data | reason } shape, so callers never have to
 *      special-case "the tool returned {error: ''}" themselves
 *
 * This mirrors what Bitget's own skill files tell their agent to do on
 * failure ("data temporarily unavailable", never expose the failing
 * provider) — we're just doing it in code instead of in an LLM's head.
 */
import { callSignalTool } from "./mcpClient.js";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — for a successful response
const FAILURE_CACHE_TTL_MS = 45 * 1000; // 45 seconds — for a failed one
const CALL_TIMEOUT_MS = 6_000;
const RETRY_DELAY_MS = 800;

const cache = new Map(); // key -> { at, value }
const failureCache = new Map(); // key -> timestamp of last failure

function cacheKey(name, args) {
  return `${name}:${JSON.stringify(args)}`;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function looksLikeFailure(data) {
  if (data == null) return true;
  if (typeof data === "string" && /^error executing tool/i.test(data)) return true;
  if (typeof data === "object") {
    // Tools in this server signal failure as {..._error: ""} or {error: ""}
    // (see feed-routing.md / signal-guide.md error-handling sections) —
    // an object where every value is an empty-string "error" key is a fail.
    const values = Object.values(data);
    if (values.length > 0 && values.every((v) => v && typeof v === "object" && "error" in v && !v.error)) {
      return true;
    }
    if ("error" in data && data.error === "") return true;
  }
  return false;
}

async function attemptOnce(name, args) {
  const raw = await withTimeout(callSignalTool(name, args), CALL_TIMEOUT_MS);
  if (looksLikeFailure(raw)) {
    throw new Error(`signal "${name}" reported a failure shape`);
  }
  return raw;
}

/**
 * Fetch a signal tool with caching, retry, and timeout protection.
 * Always resolves — never throws — so a Promise.all of several signals
 * can't be taken down by one bad source.
 *
 * @returns {Promise<{ok: true, data: any, cached?: boolean} | {ok: false, reason: string}>}
 */
export async function getSignal(name, args = {}) {
  const key = cacheKey(name, args);

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { ok: true, data: hit.value, cached: true };
  }

  // If this exact call just failed, don't make a judge's page load pay the
  // full ~13s retry cost again for a source that's still down — fail fast
  // until the short failure window expires, then try again for real.
  const failedAt = failureCache.get(key);
  if (failedAt && Date.now() - failedAt < FAILURE_CACHE_TTL_MS) {
    if (hit) return { ok: true, data: hit.value, cached: true, stale: true };
    return { ok: false, reason: "temporarily unavailable" };
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const data = await attemptOnce(name, args);
      cache.set(key, { at: Date.now(), value: data });
      failureCache.delete(key);
      return { ok: true, data };
    } catch (err) {
      if (attempt === 2) {
        failureCache.set(key, Date.now());
        // Serve a stale cache entry over nothing, if we have one.
        if (hit) return { ok: true, data: hit.value, cached: true, stale: true };
        return { ok: false, reason: "temporarily unavailable" };
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  return { ok: false, reason: "temporarily unavailable" };
}
