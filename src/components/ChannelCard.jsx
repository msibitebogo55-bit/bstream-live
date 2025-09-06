import React from "react";
import { Link } from "react-router-dom";

export default function ChannelCard({ title, livePage }) {
  return (
    <Link
      to={livePage}
      style={{
        textDecoration: "none",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #ff4757, #1e90ff)",
          color: "#fff",
          borderRadius: "12px",
          padding: "30px",
          height: "200px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          fontWeight: "bold",
          boxShadow: "0px 4px 10px rgba(0,0,0,0.3)",
          transition: "transform 0.2s ease",
        }}
      >
        {title}
      </div>
    </Link>
  );
}

