/**
 * Normalized signal getters used by the /api/thesis route.
 * Each one is a thin, named wrapper over getSignal() so the route handler
 * reads like a checklist, not a pile of raw tool names and arg objects.
 */
import { getSignal } from "../resilientSignal.js";

export async function getTechnical(symbol, timeframe = "4h") {
  return getSignal("technical_analysis", { action: "full_analysis", symbol, timeframe });
}

export async function getSentiment() {
  return getSignal("sentiment_index", { action: "current" });
}

export async function getDerivativesPositioning(symbol = "BTCUSDT") {
  return getSignal("derivatives_sentiment", { action: "long_short", symbol, period: "4h" });
}

export async function getMacroSnapshot() {
  return getSignal("rates_yields", { action: "rates_snapshot" });
}

export async function getNews(keyword, limit = 5) {
  return getSignal("news_feed", {
    action: "latest",
    feeds: "cointelegraph,coindesk,decrypt,blockworks,cnbc",
    keyword,
    limit,
  });
}

/**
 * Pull every signal in parallel for a given ticker/question. Nothing here
 * throws — each field is either {ok:true, data} or {ok:false, reason}, and
 * the caller (the thesis route) decides how to talk about gaps.
 */
export async function gatherSignals({ symbol, keyword }) {
  const [technical, sentiment, derivatives, macro, news] = await Promise.all([
    getTechnical(symbol),
    getSentiment(),
    getDerivativesPositioning(symbol.replace("/", "")),
    getMacroSnapshot(),
    getNews(keyword),
  ]);
  return { technical, sentiment, derivatives, macro, news };
}
