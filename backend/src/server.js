import "dotenv/config";
import express from "express";
import cors from "cors";
import { gatherSignals } from "./services/signals.js";
import { synthesizeThesis } from "./llm.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Raw signals only — no LLM call. Useful for checking data-source health
// on its own, and for the frontend to show a "live data" strip separately
// from the synthesized thesis.
app.post("/api/signals", async (req, res) => {
  const { symbol = "BTC/USDT", keyword } = req.body || {};
  const signals = await gatherSignals({ symbol, keyword: keyword ?? symbol.split("/")[0] });
  res.json({ symbol, signals });
});

// Full pipeline: fetch signals, then synthesize a thesis card.
app.post("/api/thesis", async (req, res) => {
  const { symbol = "BTC/USDT", question } = req.body || {};
  try {
    const signals = await gatherSignals({ symbol, keyword: symbol.split("/")[0] });
    const thesis = await synthesizeThesis({ symbol, question, signals });
    res.json({ symbol, question: question ?? null, signals, thesis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Thesis Room API listening on :${PORT}`));
