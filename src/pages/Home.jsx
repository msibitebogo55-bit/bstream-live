import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Header from "../components/Header";
import ChannelCard from "../components/ChannelCard";

export default function Home() {
  const [channels, setChannels] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch schedule from backend
    axios
      .get("https://bstream-backend.onrender.com/schedule")
      .then((res) => setChannels(res.data))
      .catch((err) => console.error("Failed to fetch channels:", err));
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
          {channels.length > 0 ? (
            channels.map((channel) => (
              <div
                key={channel.id}
                onClick={() =>
                  navigate("/live", { state: { channelId: channel.id } })
                }
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
                  }}
                >
                  Thumbnail
                </div>
                <h3>{channel.title}</h3>
              </div>
            ))
          ) : (
            <div style={{ color: "#fff" }}>No channels available</div>
          )}
        </div>
      </div>
    </div>
  );
}
