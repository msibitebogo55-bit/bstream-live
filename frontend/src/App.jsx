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
      alert("Analysis temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Tradex</h1>
          <p style={styles.subtitle}>
            Market structure explained in plain language
          </p>
        </header>

        <section style={styles.controls}>
          <div>
            <label style={styles.label}>Instrument</label>
            <select
              style={styles.select}
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
            >
              <optgroup label="Forex">
                {SYMBOLS.forex.map(s => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label style={styles.label}>Timeframe</label>
            <select
              style={styles.select}
              value={timeframe}
              onChange={e => setTimeframe(e.target.value)}
            >
              <option value="1min">1 min</option>
              <option value="5min">5 min</option>
              <option value="15min">15 min</option>
              <option value="1h">1 hour</option>
              <option value="1d">1 day</option>
            </select>
          </div>

          <button
            style={{
              ...styles.button,
              opacity: loading ? 0.6 : 1
            }}
            onClick={getAnalysis}
            disabled={loading}
          >
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </section>

        {candles && (
          <section style={styles.box}>
            <h3 style={styles.boxTitle}>Last 5 Candles</h3>
            <pre style={styles.code}>
              {JSON.stringify(candles, null, 2)}
            </pre>
          </section>
        )}

        {analysis && (
          <section style={styles.box}>
            <h3 style={styles.boxTitle}>Market Explanation</h3>
            <pre style={styles.analysis}>{analysis}</pre>
          </section>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, #020617, #000)",
    padding: "40px 20px",
    color: "#e5e7eb",
    fontFamily: "Inter, system-ui, sans-serif"
  },
  container: {
    maxWidth: 900,
    margin: "0 auto"
  },
  header: {
    marginBottom: 32
  },
  title: {
    margin: 0,
    fontSize: 32,
    letterSpacing: "-0.5px"
  },
  subtitle: {
    marginTop: 6,
    color: "#94a3b8"
  },
  controls: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr auto",
    gap: 12,
    marginBottom: 28,
    alignItems: "end"
  },
  label: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 4,
    display: "block"
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #1e293b",
    background: "#020617",
    color: "#e5e7eb",
    outline: "none"
  },
  button: {
    padding: "10px 18px",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
    height: 42
  },
  box: {
    marginTop: 24,
    padding: 18,
    borderRadius: 12,
    background: "#020617",
    border: "1px solid #1e293b"
  },
  boxTitle: {
    marginTop: 0,
    marginBottom: 12,
    fontSize: 16
  },
  code: {
    fontFamily: "JetBrains Mono, monospace",
    fontSize: 12,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    color: "#e5e7eb",
    margin: 0
  },
  analysis: {
    fontFamily: "JetBrains Mono, monospace",
    fontSize: 13,
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
    color: "#e5e7eb",
    margin: 0
  }
};
