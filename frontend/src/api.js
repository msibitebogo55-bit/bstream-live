// frontend/src/api.js
export async function fetchAnalysis(symbol = "EUR_USD", timeframe = "15min") {
  try {
    const res = await fetch(
      `/api/analyze?pair=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`
    );

    if (!res.ok) {
      throw new Error(`Backend returned status ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error("fetchAnalysis error:", err.message);
    throw err;
  }
}
