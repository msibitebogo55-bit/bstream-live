import { useEffect, useState } from "react";
import { fetchAnalysis } from "../api";

export default function AnalysisPanel() {
  const [text, setText] = useState("Loading analysis...");

  useEffect(() => {
    fetchAnalysis().then(data => setText(data.analysis));
  }, []);

  return (
    <div style={{ width: "40%", padding: "20px", overflowY: "auto" }}>
      <pre style={{ whiteSpace: "pre-wrap" }}>{text}</pre>
    </div>
  );
}
