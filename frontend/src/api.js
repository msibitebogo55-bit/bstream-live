const BACKEND_URL = "https://tradex-analysis.onrender.com";

export async function fetchAnalysis(symbol = "EUR_USD", timeframe = "15min") {
  const res = await fetch(`${BACKEND_URL}/analyze?pair=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`);
  return res.json();
}

export async function fetchAnalysis(symbol, timeframe) {
  const res = await fetch(
    `/api/analyze?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`
  );

  if (!res.ok) {
    throw new Error("Backend error");
  }

  return res.json();
}

