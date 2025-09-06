import React from "react";

export default function Header() {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        padding: "15px 30px",
        background: "#202020",
        color: "#fff",
        borderBottom: "2px solid #333",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "26px", fontWeight: "bold", color: "#ff4757" }}>
        BStream
      </h1>
    </header>
  );
}
