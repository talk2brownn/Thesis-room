/**
 * Thesis synthesis layer.
 *
 * Takes whatever real signals we managed to gather (some may be missing —
 * that's expected, see resilientSignal.js) and turns them into a structured
 * "thesis card": bull case, bear case, key risk, a plain verdict label.
 *
 * Deliberately NO fake confidence percentage — Bitget's own sentiment-guide
 * treats a bare number as misleading, and we applied the same rule on an
 * earlier project (SIGNAL/Bulk) for the same reason: a single number implies
 * a calibrated model backing it, and we don't have one yet.
 *
 * Provider is swappable via LLM_PROVIDER:
 *   - "gemini"    — needs GEMINI_API_KEY. Free tier, no credit card, key
 *                    issued instantly at aistudio.google.com. This is the
 *                    default while we're unblocking on zero budget and a
 *                    same-day deadline.
 *   - "anthropic" — needs ANTHROPIC_API_KEY (small paid credit required)
 *   - "qwen"      — needs BITGET_QWEN_API_KEY, uses the hackathon's Qwen
 *                    subsidy endpoint (OpenAI-compatible) at
 *                    https://hackathon.bitgetops.com/v1, model qwen3.8-max.
 *                    Worth switching to later for the submission's
 *                    "LLM Role Statement" field, since the rules explicitly
 *                    ask entrants to note Qwen usage if applicable — but
 *                    its KYC approval cycle is too slow to depend on right
 *                    before the deadline.
 */
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are the analysis engine behind "Thesis Room", a market research
workbench. You are given real, live signal data pulled moments ago from
Bitget's public market-data tools (technical indicators, sentiment,
derivatives positioning, macro rates, news) for one ticker. Some fields may
be marked unavailable — that is normal for a shared public data feed; note
the gap neutrally, never invent a number to fill it.

Write a structured thesis with exactly these fields:
- bull_case: 2-3 sentences, grounded only in the data actually provided
- bear_case: 2-3 sentences, grounded only in the data actually provided
- key_risk: 1 sentence naming the single biggest risk to either side
- verdict: one of "constructive", "cautious", "mixed", "avoid" — never a
  numeric confidence score or percentage
- data_gaps: short plain-language note on which inputs were unavailable,
  or null if everything came through

Return ONLY a JSON object with those five keys — no markdown, no prose
outside the JSON.`;

function buildUserPrompt({ symbol, question, signals }) {
  const describe = (label, sig) =>
    sig.ok
      ? `${label} (${sig.cached ? "cached, " : ""}live): ${JSON.stringify(sig.data)}`
      : `${label}: UNAVAILABLE (${sig.reason})`;

  return [
    `Ticker: ${symbol}`,
    question ? `User's question: ${question}` : null,
    "",
    describe("Technical analysis", signals.technical),
    describe("Sentiment index", signals.sentiment),
    describe("Derivatives positioning", signals.derivatives),
    describe("Macro / rates snapshot", signals.macro),
    describe("Recent news", signals.news),
  ]
    .filter(Boolean)
    .join("\n");
}

async function callAnthropic(userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to backend/.env — see .env.example."
    );
  }
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  const text = msg.content?.[0]?.type === "text" ? msg.content[0].text : "";
  return text;
}

async function callQwen(userPrompt) {
  const apiKey = process.env.BITGET_QWEN_API_KEY;
  if (!apiKey) {
    throw new Error(
      "BITGET_QWEN_API_KEY is not set. Get one via the hackathon's Qwen subsidy and add it to backend/.env."
    );
  }
  const res = await fetch("https://hackathon.bitgetops.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "qwen3.8-max",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 600,
    }),
  });
  if (!res.ok) throw new Error(`Qwen endpoint returned ${res.status}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

// Free-tier Gemini flash models occasionally return 503 "high demand" —
// confirmed live while building this (gemini-3.8-flash 503'd twice in a
// row, while gemini-3.5-flash-lite answered fine both times). Rather than
// let that surface as a raw failure in front of a judge, try a couple of
// models in order and only give up if all of them are down.
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];

async function callGeminiOnce(model, apiKey, userPrompt) {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini(${model}) returned ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

async function callGemini(userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Get a free key at aistudio.google.com and add it to backend/.env."
    );
  }
  let lastErr;
  for (const model of GEMINI_MODELS) {
    try {
      return await callGeminiOnce(model, apiKey, userPrompt);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

function parseThesisJson(text) {
  // Models sometimes wrap JSON in a code fence despite instructions — strip it.
  const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      bull_case: null,
      bear_case: null,
      key_risk: null,
      verdict: "mixed",
      data_gaps: "Could not parse the model's response as structured JSON.",
      raw: text,
    };
  }
}

const PROVIDERS = { gemini: callGemini, anthropic: callAnthropic, qwen: callQwen };

export async function synthesizeThesis({ symbol, question, signals }) {
  const userPrompt = buildUserPrompt({ symbol, question, signals });
  const provider = process.env.LLM_PROVIDER || "gemini";
  const call = PROVIDERS[provider];
  if (!call) throw new Error(`Unknown LLM_PROVIDER "${provider}"`);
  const text = await call(userPrompt);
  return { ...parseThesisJson(text), provider };
}
