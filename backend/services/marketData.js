// backend/services/marketData.js
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance(); // Must instantiate

const intervalMap = {
  "1min": "1m",
  "2min": "2m",
  "5min": "5m",
  "15min": "15m",
  "30min": "30m",
  "60min": "60m",
  "90min": "90m",
  "1h": "1h",
  "1d": "1d",
  "5d": "5d",
  "1wk": "1wk",
  "1mo": "1mo",
  "3mo": "3mo"
};

// Normalize trader input to Yahoo Finance symbols
export function normalizeSymbol(input) {
  if (!input) return "";

  const s = input.toUpperCase().replace(/\s+/g, "");

  // Forex & Commodities like EURUSD, USDZAR, XAUUSD
  if (/^[A-Z]{6,7}$/.test(s)) return s + "=X";

  // Common indices
  const indexMap = {
    SP500: "^GSPC",
    NASDAQ: "^IXIC",
    DOW: "^DJI",
    FTSE100: "^FTSE",
    NIKKEI: "^N225",
    HSI: "^HSI"
  };
  if (indexMap[s]) return indexMap[s];

  // Common commodities
  const commodityMap = {
    GOLD: "XAUUSD=X",
    SILVER: "XAGUSD=X",
    OIL: "CL=F",
    BRENT: "BZ=F"
  };
  if (commodityMap[s]) return commodityMap[s];

  // Already Yahoo symbol
  if (s.startsWith("^") || s.includes("=")) return s;

  // Fallback: try as-is
  return s;
}

export async function fetchCandles(symbolInput, interval = "15min") {
  try {
    const symbol = normalizeSymbol(symbolInput); // normalize input
    const yfInterval = intervalMap[interval] || "15m";

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const result = await yahooFinance.chart(symbol, {
      period1: oneDayAgo,
      interval: yfInterval
    });

    const quotes = result?.quotes;
    if (!quotes || quotes.length === 0) {
      throw new Error("No data returned from Yahoo Finance for " + symbol);
    }

    return quotes.slice(-5).map(c => ({
      time: c.date,
      mid: {
        o: c.open,
        h: c.high,
        l: c.low,
        c: c.close,
        v: c.volume || 0
      }
    }));
  } catch (err) {
    console.error("Yahoo fetch error:", err.message);
    throw err;
  }
}
