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
You are analyzing raw market behavior for professional traders.

Rules (must follow strictly):
- Do NOT name chart patterns, candle names, or technical terms.
- Do NOT use templates or generic explanations.
- Do NOT repeat phrasing across candles.
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

