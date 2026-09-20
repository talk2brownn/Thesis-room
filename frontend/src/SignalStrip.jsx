// A row of "signal chips" — one per data source. Lit when live, dim when
// unavailable. This is deliberately visible rather than hidden: the whole
// point of Thesis Room is that it tells you what it actually knows, not
// just what it wishes it knew. Chips boot online one at a time, and any
// live chip opens on hover into a real-data readout panel below the row —
// the extra fields (MACD, ATR, Bollinger, raw payloads) were always being
// fetched, they just weren't shown until now.
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCountUp, fmt } from "./hooks/useCountUp";
import SignalDetail from "./SignalDetail";

const LABELS = {
  technical: "Technical",
  sentiment: "Sentiment",
  derivatives: "Positioning",
  macro: "Macro",
  news: "News",
};

function numericValue(key, signal) {
  if (!signal?.ok) return null;
  const d = signal.data;
  if (key === "technical") return d.rsi?.rsi;
  if (key === "sentiment") return typeof d.value === "number" ? d.value : null;
  return null;
}

function textSummary(key, signal) {
  if (!signal?.ok) return "unavailable";
  const d = signal.data;
  switch (key) {
    case "technical":
      return d.verdict;
    case "sentiment":
      return d.classification ?? "live";
    case "derivatives":
      return "live";
    case "macro":
      return d.yield_curve_inverted ? "curve inverted" : "curve normal";
    case "news":
      return "live";
    default:
      return "live";
  }
}

function Chip({ index, chipKey, label, signal, isActive, onEnter, onLeave, onClick }) {
  const live = !!signal?.ok;
  const num = numericValue(chipKey, signal);
  const displayNum = useCountUp(num, { duration: 900 });

  return (
    <motion.div
      className={`signal-chip ${live ? "live" : "dim"} ${isActive ? "active" : ""}`}
      initial={{ opacity: 0, y: 10, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={live ? { y: -2 } : undefined}
      transition={{ delay: index * 0.12, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      <span className="dot" />
      <span className="chip-label">{label}</span>
      <span className="chip-value">
        {textSummary(chipKey, signal)}
        {num != null && <span className="chip-number"> · {fmt(displayNum, 1)}</span>}
      </span>
      {live && <span className="chip-expand-hint">{isActive ? "▲" : "▼"}</span>}
    </motion.div>
  );
}

export default function SignalStrip({ signals }) {
  const [active, setActive] = useState(null);
  if (!signals) return null;

  return (
    <div className="signal-strip-wrap">
      <div className="signal-strip">
        {Object.entries(LABELS).map(([key, label], i) => (
          <Chip
            key={key}
            index={i}
            chipKey={key}
            label={label}
            signal={signals[key]}
            isActive={active === key}
            onEnter={() => signals[key]?.ok && setActive(key)}
            onLeave={() => setActive((a) => (a === key ? null : a))}
            onClick={() => signals[key]?.ok && setActive((a) => (a === key ? null : key))}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        {active && signals[active]?.ok && (
          <SignalDetail key={active} chipKey={active} signal={signals[active]} />
        )}
      </AnimatePresence>
    </div>
  );
}
