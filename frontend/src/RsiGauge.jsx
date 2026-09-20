// A real analog gauge — not a progress bar wearing a costume. The needle
// angle is recomputed every animation frame directly from useCountUp's
// live value, so the sweep you see IS the RSI arriving, not a canned CSS
// animation playing alongside a number.
import { useCountUp, fmt } from "./hooks/useCountUp";

const CX = 70;
const CY = 70;
const R = 60;
const ARC_LEN = Math.PI * R; // half-circumference of the semicircle

function dashFor(fromFrac, toFrac) {
  const seg = Math.max(0, (toFrac - fromFrac) * ARC_LEN);
  return {
    strokeDasharray: `${seg} ${ARC_LEN - seg}`,
    strokeDashoffset: -(fromFrac * ARC_LEN),
  };
}

function zoneFor(v) {
  if (v <= 30) return { label: "Oversold", tone: "up" };
  if (v >= 70) return { label: "Overbought", tone: "down" };
  return { label: "Neutral", tone: "mid" };
}

const ARC_PATH = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

export default function RsiGauge({ rsi, rsiSignal }) {
  const animated = useCountUp(rsi, { duration: 1200 });
  const value = animated ?? 0;
  const frac = Math.min(1, Math.max(0, value / 100));
  const angle = Math.PI - frac * Math.PI;
  const needleLen = R - 10;
  const nx = CX + needleLen * Math.cos(angle);
  const ny = CY - needleLen * Math.sin(angle);
  const tipX = CX + (R - 2) * Math.cos(angle);
  const tipY = CY - (R - 2) * Math.sin(angle);
  const zone = zoneFor(typeof rsi === "number" ? rsi : 50);

  return (
    <div className="rsi-gauge">
      <svg viewBox="0 0 140 78" width="140" height="78">
        <path d={ARC_PATH} className="gauge-zone zone-up" style={dashFor(0, 0.3)} />
        <path d={ARC_PATH} className="gauge-zone zone-mid" style={dashFor(0.3, 0.7)} />
        <path d={ARC_PATH} className="gauge-zone zone-down" style={dashFor(0.7, 1)} />
        <circle cx={tipX} cy={tipY} r="3.2" className={`gauge-tip tone-${zone.tone}`} />
        <line x1={CX} y1={CY} x2={nx} y2={ny} className="gauge-needle" />
        <circle cx={CX} cy={CY} r="4.5" className="gauge-pivot" />
      </svg>
      <div className="gauge-readout">
        <span className="gauge-value-num">{fmt(value, 1)}</span>
        <span className={`gauge-zone-label tone-${zone.tone}`}>{zone.label}</span>
        {rsiSignal && <span className="gauge-signal">signal: {rsiSignal}</span>}
      </div>
    </div>
  );
}
