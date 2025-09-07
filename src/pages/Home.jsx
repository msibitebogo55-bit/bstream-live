import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Home() {
  const [channels, setChannels] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch the schedule from your backend
    axios
      .get("https://your-backend-url.onrender.com/schedule")
      .then(res => {
        // Extract unique channels from schedule
        const uniqueChannels = res.data.reduce((acc, video) => {
          if (!acc.find(c => c.id === video.channelId)) {
            acc.push({ id: video.channelId, title: video.channel || "On-Campus StudentTV" });
          }
          return acc;
        }, []);
        setChannels(uniqueChannels);
      })
      .catch(err => console.error(err));
  }, []);

  return (
    <div style={{ background: "#141414", minHeight: "100vh", padding: "30px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ color: "#ff6600", marginBottom: "20px" }}>BStream</h1>
      <h2 style={{ color: "#fff", marginBottom: "20px" }}>Channels</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
        }}
      >
        {channels.length > 0 ? (
          channels.map(channel => (
            <div
              key={channel.id}
              onClick={() => navigate("/live", { state: { channelId: channel.id } })}
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
  );
}
