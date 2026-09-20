import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { buildThesis } from "./api";
import SignalStrip from "./SignalStrip";
import ThesisCard from "./ThesisCard";
import PriceLadder from "./PriceLadder";
import "./App.css";

const QUICK_TICKERS = ["BTC/USDT", "ETH/USDT", "SOL/USDT"];

// The ambient background glow is driven entirely by the real verdict of the
// current thesis — not a random accent. Bullish reads warm the room green,
// bearish reads cool it red, everything else sits on the house amber.
const GLOW_TONE = { constructive: "up", cautious: "mid", mixed: "mid", avoid: "down" };

export default function App() {
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [customTicker, setCustomTicker] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await buildThesis({ symbol, question: question || undefined });
      setCurrent(result);
      setHistory((h) => [{ ...result, at: Date.now() }, ...h].slice(0, 8));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const glowTone = current ? GLOW_TONE[current.thesis?.verdict] || "mid" : "neutral";

  return (
    <div className="app">
      <div className={`ambient-glow tone-${glowTone}`} aria-hidden="true" />
      <div className="scanline" aria-hidden="true" />

      <motion.header
        className="masthead"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="wordmark">
          <span className="wordmark-main">THESIS</span>
          <span className="wordmark-sub">ROOM</span>
        </div>
        <p className="tagline">A research desk that shows its work — and what it doesn't know.</p>
      </motion.header>

      <motion.form
        className="desk"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="ticker-row">
          {QUICK_TICKERS.map((t) => (
            <motion.button
              type="button"
              key={t}
              whileTap={{ scale: 0.94 }}
              className={`ticker-pill ${symbol === t && !customTicker ? "active" : ""}`}
              onClick={() => {
                setSymbol(t);
                setCustomTicker("");
              }}
            >
              {t}
            </motion.button>
          ))}
          <input
            className="ticker-custom"
            value={customTicker}
            onChange={(e) => {
              const v = e.target.value.toUpperCase();
              setCustomTicker(v);
              if (v) setSymbol(v);
            }}
            placeholder="CUSTOM/PAIR"
          />
        </div>

        <textarea
          className="question-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask something specific, or leave blank for a general read…"
          rows={2}
        />

        <motion.button
          className="build-btn"
          type="submit"
          disabled={loading}
          whileTap={{ scale: 0.97 }}
        >
          {loading ? "Building thesis…" : "Build thesis"}
        </motion.button>
      </motion.form>

      <AnimatePresence>
        {error && (
          <motion.div
            className="error-banner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {loading && (
          <motion.div
            className="loading-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="pulse" />
            <span>Pulling live signals and reasoning through them…</span>
            <div className="loading-sweep" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {current && !loading && (
          <motion.section
            className="result"
            key={current.symbol + (current.thesis?.at || "") + JSON.stringify(current.question)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <SignalStrip signals={current.signals} />
            <PriceLadder technical={current.signals?.technical} />
            <ThesisCard result={current} />
          </motion.section>
        )}
      </AnimatePresence>

      {history.length > 1 && (
        <motion.section
          className="history"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h2>Earlier this session</h2>
          <div className="history-grid">
            {history.slice(1).map((h, i) => (
              <motion.button
                key={h.at + i}
                className="history-item"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setCurrent(h)}
              >
                <span className="history-symbol">{h.symbol}</span>
                <span className={`history-verdict v-${h.thesis.verdict}`}>
                  {h.thesis.verdict}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}
