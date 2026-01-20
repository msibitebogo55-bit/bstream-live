export async function fetchAnalysis(symbol, timeframe) {
  const res = await fetch(
    `/api/analyze?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`
  );

  if (!res.ok) {
    throw new Error("Backend error");
  }

  return res.json();
}


