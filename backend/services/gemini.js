// backend/services/gemini.js
import 'dotenv/config';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

/**
 * Analyze 5 structured candles with Gemini
 */
export async function analyzeWithGemini(pair, timeframe, structuredCandles) {
  try {
    const prompt = `
You are analyzing raw market behavior for professional traders. You are a professional trader. Analysis should be structures like thsi:

EURUSD - 15m | Last 5 candles

Overall Trend & Volatility:
- The market alternates between bearish and bullish pressure, showing a struggle for control.
- Volatility is contracting, culminating in a zero-range candle — the market is holding its breath, waiting for new orders.

Candle Analysis:
1. C1 ↓ 0.0011 | Bearish: Strong selling drove the price down, but the long lower wick shows buyers defending support, preventing a deeper drop.
2. C2 ↓ 0.0004 | Bearish: Follow-through selling lost momentum; the long lower wick indicates buyers absorbing the selling pressure.
3. C3 ↑ 0.0008 | Bullish: Buyers gained temporary control, pushing price up, reversing part of the previous decline.
4. C4 ↓ 0.00027 | Bearish: Sellers efficiently pushed price down in a narrow band; range contraction shows momentum exhaustion.
5. C5 → 0 | Neutral: Absolute indecision. Neither buyers nor sellers can move price — likely accumulation or distribution.

Implications:
- The market is coiled: strong moves followed by contraction indicate a breakout is imminent.
- Break above 1.17302 → buyers may dominate.
- Break below 1.17192 → sellers may regain control.


Rules (must follow strictly):
- Explain ONLY what changed and why price reacted that way.
- Reasons must be derived from relative price movement, range change, and sequence behavior.
- Keep the analysis concise but causal. No teaching language.

Task:
Explain what is happening, why it is happening, and what it implies next.

Output format (exact structure):
${pair} - ${timeframe} | Last 5 candles

Overall Behavior:
- 2 short bullet points explaining control and volatility changes.

Candle Breakdown:
- C1: direction, range, and what price response indicates.
- C2: same
- C3: same
- C4: same
- C5: same

Implication:
- 2 short bullets describing likely market behavior if price moves up or down.

Data (do not repeat it verbatim, reason from it):
${JSON.stringify(structuredCandles, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    return response.text;
  } catch (err) {
    console.error("Gemini AI fetch error:", err.message);
    return "AI analysis unavailable (check API key).";
  }
}


