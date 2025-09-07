import React, { useState } from "react";
import axios from "axios";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(3600); // default 1 hour
  const [message, setMessage] = useState("");

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a video file.");
      return;
    }

    try {
      // Step 1: Get the pre-signed upload URL from backend
      const res = await axios.post(
        "https://bstream-backend.onrender.com/upload-url",
        {
          fileName: file.name,
          contentType: file.type,
          title,
          startTime,
          duration,
        },
        {
          auth: {
            username: process.env.REACT_APP_ADMIN_USER,
            password: process.env.REACT_APP_ADMIN_PASS,
          },
        }
      );

      const { uploadUrl, video } = res.data;

      // Step 2: Upload the actual video file to S3
      await axios.put(uploadUrl, file, {
        headers: {
          "Content-Type": file.type,
        },
      });

      setMessage(`Video uploaded successfully! Title: ${video.title}`);
      setFile(null);
      setTitle("");
      setStartTime("");
      setDuration(3600);
    } catch (err) {
      console.error(err);
      setMessage("Failed to upload video.");
    }
  };

  return (
    <div style={{ padding: "30px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ color: "#ff6600", marginBottom: "20px" }}>Upload Video</h1>
      
      <input
        type="file"
        accept="video/*"
        onChange={e => setFile(e.target.files[0])}
        style={{ marginBottom: "10px" }}
      />
      <br />

      <input
        type="text"
        placeholder="Video Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        style={{ marginBottom: "10px", padding: "5px", width: "300px" }}
      />
      <br />

      <input
        type="datetime-local"
        placeholder="Start Time"
        value={startTime}
        onChange={e => setStartTime(e.target.value)}
        style={{ marginBottom: "10px", padding: "5px", width: "300px" }}
      />
      <br />

      <input
        type="number"
        placeholder="Duration (seconds)"
        value={duration}
        onChange={e => setDuration(e.target.value)}
        style={{ marginBottom: "10px", padding: "5px", width: "300px" }}
      />
      <br />

      <button
        onClick={handleUpload}
        style={{
          padding: "10px 20px",
          background: "#ff6600",
          color: "#fff",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        Upload
      </button>

      {message && <div style={{ marginTop: "20px", color: "#fff" }}>{message}</div>}
    </div>
  );
}
