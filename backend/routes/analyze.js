// backend/routes/analyze.js
import express from "express";
import { fetchCandles } from "../services/marketData.js";
import { buildFiveCandleSet } from "../services/buildFiveCandleSet.js";
import { analyzeWithGemini } from "../services/gemini.js";
import { canAnalyze, logAnalysis } from "../services/usage.js";

const router = express.Router();

// In-memory cache for last 5 candles per symbol
const candleCache = {};

router.get("/analyze", async (req, res) => {
  const ip = req.ip;

  if (!canAnalyze(ip)) {
    return res.status(429).json({ error: "You have reached your 2 analyses limit for today." });
  }

  try {
    const { symbol = "EURUSD", timeframe = "15min" } = req.query;

    let raw;
    try {
      raw = await fetchCandles(symbol, timeframe);
      candleCache[symbol] = raw; // update cache
    } catch (err) {
      console.warn("Fetch failed, using cached data if available:", err.message);
      if (!candleCache[symbol]) {
        return res.status(500).json({ error: "No data available for this symbol" });
      }
      raw = candleCache[symbol];
    }

    const structured = buildFiveCandleSet(raw);
    const analysis = await analyzeWithGemini(symbol, timeframe, structured);

    logAnalysis(ip); // record usage persistently

    res.json({ analysis, candles: structured });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Analysis failed" });
  }
});

export default router;
