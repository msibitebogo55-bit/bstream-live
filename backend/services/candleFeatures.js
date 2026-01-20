export function analyzeCandle(candle, prev) {
  const o = +candle.mid.o;
  const h = +candle.mid.h;
  const l = +candle.mid.l;
  const c = +candle.mid.c;

  const body = Math.abs(c - o);
  const range = h - l;
  const upper = h - Math.max(o, c);
  const lower = Math.min(o, c) - l;

  return {
    open: o,
    high: h,
    low: l,
    close: c,
    direction: c > o ? "bullish" : c < o ? "bearish" : "neutral",
    body_strength: body / range > 0.6 ? "large" : body / range > 0.3 ? "medium" : "small",
    upper_wick: upper / range > 0.4 ? "long" : upper / range > 0.2 ? "medium" : "short",
    lower_wick: lower / range > 0.4 ? "long" : lower / range > 0.2 ? "medium" : "short",
    close_position:
      c > l + range * 0.75 ? "near_high" :
      c < l + range * 0.25 ? "near_low" : "mid_range",
    relative_range: prev && range > prev.range ? "expansion" : "contraction",
    range
  };
}
