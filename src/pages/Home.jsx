import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Header from "../components/Header";

export default function Home() {
  const [liveStatus, setLiveStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if StudentTV is live
    axios
      .get("https://bstream-backend.onrender.com/channels/studenttv/live")
      .then((res) => setLiveStatus(res.data))
      .catch((err) => console.error("Failed to fetch live status:", err));
  }, []);

  return (
    <div style={{ background: "#141414", minHeight: "100vh" }}>
      <Header />
      <div style={{ padding: "30px" }}>
        <h2 style={{ color: "#fff", marginBottom: "20px" }}>Channels</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "20px",
          }}
        >
          <div
            onClick={() => navigate("/live", { state: { slug: "studenttv" } })}
            style={{
              background: "#1e1e1e",
              borderRadius: "10px",
              cursor: "pointer",
              padding: "20px",
              color: "#fff",
              textAlign: "center",
            }}
          >
            <div
              style={{
                background: "#333",
                height: "150px",
                borderRadius: "8px",
                marginBottom: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                color: "#aaa",
              }}
            >
              On-Campus StudentTV
            </div>
            <h3>On-Campus StudentTV</h3>
            {liveStatus ? (
              liveStatus.live ? (
                <p style={{ color: "lime" }}>🔴 Live Now</p>
              ) : (
                <p style={{ color: "#aaa" }}>No live stream right now</p>
              )
            ) : (
              <p style={{ color: "#aaa" }}>Loading...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
