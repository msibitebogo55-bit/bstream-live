import { useState } from "react";
import { fetchAnalysis } from "./api";
import { SYMBOLS } from "./symbols";

export default function App() {
  const [symbol, setSymbol] = useState(SYMBOLS.forex[0].value);
  const [timeframe, setTimeframe] = useState("15min");
  const [analysis, setAnalysis] = useState(null);
  const [candles, setCandles] = useState(null);
  const [loading, setLoading] = useState(false);

  const getAnalysis = async () => {
    setLoading(true);
    try {
      const data = await fetchAnalysis(symbol, timeframe);
      setAnalysis(data.analysis);
      setCandles(data.candles);
    } catch {
      alert("Analysis temporarily Unvailable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Tradex Analysis</h1>

      <div style={{ marginBottom: 10 }}>
        <label>Instrument:</label>
        <select value={symbol} onChange={e => setSymbol(e.target.value)}>
          <optgroup label="Forex">
            {SYMBOLS.forex.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </optgroup>

        
        </select>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label>Timeframe:</label>
        <select value={timeframe} onChange={e => setTimeframe(e.target.value)}>
          <option value="1min">1 min</option>
          <option value="5min">5 min</option>
          <option value="15min">15 min</option>
          <option value="1h">1 hour</option>
          <option value="1d">1 day</option>
        </select>
      </div>

      <button onClick={getAnalysis} disabled={loading}>
        {loading ? "Analyzing..." : "Analyze"}
      </button>

      {candles && (
  <div style={{ marginTop: 20 }}>
    <h2>Last 5 Candles</h2>
    <pre
      style={{
        fontFamily: "Courier, monospace",
        whiteSpace: "pre-wrap",
        lineHeight: 1.5,
        backgroundColor: "#f5f5f5",
        padding: "10px",
        borderRadius: "5px",
        overflowX: "auto"
      }}
    >
      {JSON.stringify(candles, null, 2)}
    </pre>
  </div>
)}

           {analysis && (
        <div style={{ marginTop: 20 }}>
          <h2>AI Analysis</h2>
          <pre
            style={{
              fontFamily: "Courier, monospace",
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
              backgroundColor: "#f5f5f5",
              padding: "10px",
              borderRadius: "5px",
              overflowX: "auto"
            }}
          >
            {analysis}
          </pre>
        </div>
      )}
    </div>
  );

}
