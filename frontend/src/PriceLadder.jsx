// A vertical price ladder — the cinematic centerpiece. Every number on it
// is real, pulled from the same technical_analysis payload the thesis was
// built from: live support/resistance levels, moving averages, and the
// current price, laid out to scale and animated into place. Nothing here
// is decorative filler — if the data isn't there, the level isn't drawn.
//
// Two things make this interactive rather than a static chart:
//  - hover any level and a beam draws to the current price, counting up
//    the exact live $ and % distance between them
//  - the current-price marker's pulse speed is driven by the real ATR%
//    (volatility) reading — a calmer market literally breathes slower
//
// Real market levels often cluster tightly (a moving average sitting a few
// dollars from a resistance line), so raw proportional placement makes
// labels overlap. Positions are computed in pixels with a minimum-gap pass
// (the same trick axis labels in charting libraries use) so every level
// stays legible regardless of how close the underlying numbers are.
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useCountUp, fmt } from "./hooks/useCountUp";

const CONTENT_HEIGHT = 220;
const MIN_GAP = 30;
const TOP_PAD = 14;
const BOTTOM_PAD = 14;

function Row({ label, value, tone, px, delay, decimals, onEnter, onLeave, hovered }) {
  const display = useCountUp(value, { duration: 900 });
  return (
    <motion.div
      className={`ladder-level tone-${tone} ${hovered ? "hovered" : ""}`}
      style={{ top: `${px}px` }}
      initial={{ opacity: 0, x: tone === "support" ? -16 : 16 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.06, x: tone === "support" ? -3 : 3 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <span className="ladder-tick" />
      <span className="ladder-label">{label}</span>
      <span className="ladder-value">{fmt(display, decimals)}</span>
    </motion.div>
  );
}

function CurrentMarker({ price, px, delay, verdictTone, pulseDuration }) {
  const display = useCountUp(price, { duration: 1200 });
  return (
    <motion.div
      className={`ladder-current tone-${verdictTone}`}
      style={{ top: `${px}px`, "--pulse-duration": `${pulseDuration}s` }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 240, damping: 18 }}
    >
      <span className="ladder-current-ring" />
      <span className="ladder-current-dot" />
      <span className="ladder-current-price">${fmt(display, 2)}</span>
    </motion.div>
  );
}

function HoverBeam({ hovered, currentPx, decimals }) {
  if (!hovered) return null;
  const top = Math.min(hovered.px, currentPx);
  const height = Math.max(Math.abs(hovered.px - currentPx), 1);
  const diff = hovered.value - hovered.currentValue;
  const pct = (diff / hovered.currentValue) * 100;
  const positive = diff >= 0;
  const readoutTop = (hovered.px + currentPx) / 2;

  return (
    <>
      <motion.div
        className={`ladder-beam ${positive ? "pos" : "neg"}`}
        style={{ top: `${top}px`, height: `${height}px` }}
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: 1, scaleY: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      />
      <motion.div
        className={`ladder-beam-readout ${positive ? "pos" : "neg"}`}
        style={{ top: `${readoutTop}px` }}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
      >
        {positive ? "+" : ""}
        {fmt(diff, decimals)} ({positive ? "+" : ""}
        {fmt(pct, 2)}%) from price
      </motion.div>
    </>
  );
}

const VERDICT_TONE = { BULLISH: "up", BEARISH: "down" };

export default function PriceLadder({ technical }) {
  const [hoveredKey, setHoveredKey] = useState(null);

  const layout = useMemo(() => {
    if (!technical?.ok) return null;
    const d = technical.data;
    const price = d.ma?.price ?? d.support_resistance?.current_price;
    if (typeof price !== "number") return null;

    const supports = d.support_resistance?.supports ?? [];
    const resistances = d.support_resistance?.resistances ?? [];
    const mas = [
      { label: "MA7", value: d.ma?.ma7 },
      { label: "MA25", value: d.ma?.ma25 },
      { label: "MA99", value: d.ma?.ma99 },
    ].filter((m) => typeof m.value === "number");

    const decimals = price >= 100 ? 0 : price >= 1 ? 2 : 5;

    const points = [
      ...resistances.map((v, i) => ({ key: `r${i}`, label: `R${i + 1}`, tone: "resistance", value: v })),
      ...mas.map((m) => ({ key: m.label, label: m.label, tone: "ma", value: m.value })),
      { key: "current", label: "NOW", tone: "current", value: price, isCurrent: true },
      ...supports.map((v, i) => ({ key: `s${i}`, label: `S${i + 1}`, tone: "support", value: v })),
    ].sort((a, b) => b.value - a.value);

    const max = points[0].value;
    const min = points[points.length - 1].value;
    const span = Math.max(max - min, max * 0.001, 1);

    points.forEach((p) => {
      p.px = TOP_PAD + (1 - (p.value - min) / span) * (CONTENT_HEIGHT - TOP_PAD - BOTTOM_PAD);
    });
    for (let i = 1; i < points.length; i++) {
      if (points[i].px - points[i - 1].px < MIN_GAP) {
        points[i].px = points[i - 1].px + MIN_GAP;
      }
    }

    const trackHeight = Math.max(CONTENT_HEIGHT, points[points.length - 1].px + BOTTOM_PAD + 10);
    const atrPct = d.atr?.atr_pct;
    // Higher real volatility (ATR%) = faster pulse. Clamped to a sane range
    // so it stays readable rather than becoming a strobe.
    const pulseDuration =
      typeof atrPct === "number" ? Math.max(0.9, Math.min(2.6, 2.6 - atrPct * 0.9)) : 1.8;

    return {
      symbol: d.symbol,
      verdict: d.verdict,
      bullSignals: d.bull_signals,
      bearSignals: d.bear_signals,
      points,
      trackHeight,
      decimals,
      price,
      pulseDuration,
      verdictTone: VERDICT_TONE[d.verdict] || "mid",
    };
  }, [technical]);

  if (!layout) return null;

  const currentPoint = layout.points.find((p) => p.isCurrent);
  const hoveredPoint = layout.points.find((p) => p.key === hoveredKey && !p.isCurrent);
  const hovered = hoveredPoint
    ? { px: hoveredPoint.px, value: hoveredPoint.value, currentValue: layout.price }
    : null;

  let delay = 0.05;
  const rows = layout.points.map((p) => {
    if (p.isCurrent) {
      const row = (
        <CurrentMarker
          key={p.key}
          price={p.value}
          px={p.px}
          delay={delay + 0.15}
          verdictTone={layout.verdictTone}
          pulseDuration={layout.pulseDuration}
        />
      );
      delay += 0.09;
      return row;
    }
    const row = (
      <Row
        key={p.key}
        label={p.label}
        value={p.value}
        tone={p.tone}
        px={p.px}
        delay={delay}
        decimals={layout.decimals}
        hovered={hoveredKey === p.key}
        onEnter={() => setHoveredKey(p.key)}
        onLeave={() => setHoveredKey((k) => (k === p.key ? null : k))}
      />
    );
    delay += 0.09;
    return row;
  });

  return (
    <motion.div
      className="price-ladder"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="ladder-heading">
        <span>Price ladder · {layout.symbol}</span>
        <span className={`ladder-verdict tone-${layout.verdictTone}`}>
          {layout.verdict} ({layout.bullSignals}↑ / {layout.bearSignals}↓)
        </span>
      </div>
      <p className="ladder-hint">hover a level to measure its live distance from price</p>
      <div className="ladder-track" style={{ height: layout.trackHeight }}>
        <div className="ladder-rail" />
        {rows}
        {currentPoint && (
          <HoverBeam hovered={hovered} currentPx={currentPoint.px} decimals={layout.decimals} />
        )}
      </div>
    </motion.div>
  );
}
