// The panel that opens beneath a signal chip when you hover/click it.
// For "Technical" this is a purpose-built readout (gauge + MACD bars +
// ATR/Bollinger stats) built from fields we already fetch but never used
// to show. For everything else it's a generic, honest dump of whatever
// real fields that tool actually returned — never invented, never padded.
import { motion } from "framer-motion";
import RsiGauge from "./RsiGauge";
import { useCountUp, fmt } from "./hooks/useCountUp";

function StatRow({ label, value, decimals = 2, suffix = "", text }) {
  const animated = useCountUp(typeof value === "number" ? value : null, { duration: 800 });
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {text ?? (animated != null ? `${fmt(animated, decimals)}${suffix}` : "—")}
      </span>
    </div>
  );
}

function MacdBars({ macd }) {
  if (!macd) return null;
  const rows = [
    { label: "MACD", value: macd.macd },
    { label: "Signal", value: macd.signal },
    { label: "Histogram", value: macd.histogram },
  ];
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.value ?? 0)), 1);
  return (
    <div className="macd-bars">
      {rows.map((r, i) => {
        const pct = (Math.abs(r.value ?? 0) / maxAbs) * 50;
        const positive = (r.value ?? 0) >= 0;
        return (
          <div className="macd-row" key={r.label}>
            <span className="macd-label">{r.label}</span>
            <div className="macd-track">
              <div className="macd-zero" />
              <motion.div
                className={`macd-fill ${positive ? "pos" : "neg"}`}
                style={positive ? { left: "50%" } : { right: "50%" }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="macd-value">{fmt(r.value, 1)}</span>
          </div>
        );
      })}
      {macd.cross && <span className="macd-cross-badge">{macd.cross.replace(/_/g, " ")}</span>}
    </div>
  );
}

function prettifyKey(k) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function RawFields({ data }) {
  const entries = Object.entries(data || {}).filter(
    ([, v]) => v !== null && typeof v !== "object"
  );
  if (!entries.length) {
    return <p className="detail-empty">No additional fields in this response.</p>;
  }
  return (
    <div className="raw-fields">
      {entries.map(([k, v]) => (
        <StatRow
          key={k}
          label={prettifyKey(k)}
          value={typeof v === "number" ? v : null}
          decimals={Number.isInteger(v) ? 0 : 2}
          text={typeof v !== "number" ? String(v) : undefined}
        />
      ))}
    </div>
  );
}

export default function SignalDetail({ chipKey, signal }) {
  if (!signal?.ok) return null;
  const d = signal.data;

  return (
    <motion.div
      className="signal-detail"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="signal-detail-inner">
        {chipKey === "technical" ? (
          <div className="technical-detail">
            <RsiGauge rsi={d.rsi?.rsi} rsiSignal={d.rsi?.signal} />
            <div className="technical-detail-right">
              <MacdBars macd={d.macd} />
              <div className="stat-col">
                <StatRow label="ATR (14)" value={d.atr?.atr} />
                <StatRow label="ATR %" value={d.atr?.atr_pct} suffix="%" />
                <StatRow label="Suggested stop" value={d.atr?.suggested_stop} />
                <StatRow label="Bollinger %B" value={d.bollinger?.pct_b} decimals={3} />
                <StatRow
                  label="Bollinger position"
                  text={d.bollinger?.position?.replace(/_/g, " ")}
                />
              </div>
            </div>
          </div>
        ) : (
          <RawFields data={d} />
        )}
      </div>
    </motion.div>
  );
}
