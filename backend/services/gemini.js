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
Analyze the last 5 candles for ${pair} on ${timeframe}.
Candles:
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
