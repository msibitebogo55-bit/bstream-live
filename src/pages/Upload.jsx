import React, { useState } from "react";
import axios from "axios";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [message, setMessage] = useState("");

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a video file.");
      return;
    }

    try {
      // Step 1: Request pre-signed upload URL
      const res = await axios.post(
        "https://bstream-backend.onrender.com/upload-url",
        {
          fileName: file.name,
          contentType: file.type,
          title,
          startTime, // include requested start time
        },
        {
          headers: {
            Authorization:
              "Basic " + btoa("bstreamadmin:BStr3am$ecure2025"),
          },
        }
      );

      const { uploadUrl, video } = res.data;

      // Step 2: Upload video to S3
      await axios.put(uploadUrl, file, {
        headers: {
          "Content-Type": file.type,
        },
      });

      // Step 3: Confirm upload and set default duration (10 minutes)
      await axios.post(
        "https://bstream-backend.onrender.com/confirm-upload",
        { id: video.id, defaultDuration: 600 }, // 600 seconds = 10 minutes
        {
          headers: {
            Authorization:
              "Basic " + btoa("bstreamadmin:BStr3am$ecure2025"),
          },
        }
      );

      setMessage(`✅ Video uploaded and scheduled! Title: ${video.title}`);
      setFile(null);
      setTitle("");
      setStartTime("");
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to upload video.");
    }
  };

  return (
    <div style={{ padding: "30px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ color: "#ff6600", marginBottom: "20px" }}>Upload Video</h1>

      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files[0])}
        style={{ marginBottom: "10px" }}
      />
      <br />

      <input
        type="text"
        placeholder="Video Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ marginBottom: "10px", padding: "5px", width: "300px" }}
      />
      <br />

      <input
        type="datetime-local"
        value={startTime}
        onChange={(e) => setStartTime(e.target.value)}
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

      {message && (
        <div style={{ marginTop: "20px", color: "#fff" }}>{message}</div>
      )}
    </div>
  );
}
