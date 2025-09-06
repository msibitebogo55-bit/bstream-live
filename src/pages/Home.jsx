import React from "react";
import Header from "../components/Header";
import ChannelCard from "../components/ChannelCard";

export default function Home() {
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
          <ChannelCard
            title="On-Campus StudentTV"
            livePage="/live"
          />
        </div>
      </div>
    </div>
  );
}
