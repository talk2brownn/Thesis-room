import { useEffect, useRef, useState } from "react";

/**
 * Animates a numeric value from wherever it last was to a new target,
 * whenever `target` changes. This is what makes every real number on the
 * page — price, RSI, MACD histogram, sentiment index — visibly arrive
 * instead of just popping into place. Returns a raw number (or null while
 * there's nothing to show); callers format it for display.
 */
export function useCountUp(target, { duration = 900 } = {}) {
  const hasTarget = typeof target === "number" && !Number.isNaN(target);
  const [value, setValue] = useState(hasTarget ? target : null);
  const fromRef = useRef(hasTarget ? target : 0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!hasTarget) return undefined;
    const from = fromRef.current;
    const to = target;
    if (from === to) {
      setValue(to);
      return undefined;
    }
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setValue(to);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, hasTarget]);

  return hasTarget ? value : null;
}

export function fmt(n, decimals = 2) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
