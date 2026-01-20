import { analyzeCandle } from "./candleFeatures.js";

export function buildFiveCandleSet(candles) {
  return candles.map((c, i) => ({
    candle: i + 1,
    ...analyzeCandle(c, candles[i - 1])
  }));
}
