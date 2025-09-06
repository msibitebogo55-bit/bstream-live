import React, { useState } from "react";

export default function Upload() {
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(0); // Will auto-set
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select a video file");

    try {
      // Step 0: Get actual video duration
      const videoEl = document.createElement("video");
      videoEl.src = URL.createObjectURL(file);

      await new Promise((resolve, reject) => {
        videoEl.onloadedmetadata = () => {
          setDuration(Math.floor(videoEl.duration)); // seconds
          resolve();
        };
        videoEl.onerror = reject;
      });

      const username = prompt("Admin Username");
      const password = prompt("Admin Password");
      const authHeader = "Basic " + btoa(`${username}:${password}`);

      // Step 1: Get pre-signed URL from backend
      const res = await fetch("http://localhost:5000/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          title,
          startTime,
          duration: Math.floor(videoEl.duration), // auto-set duration
        }),
      });

      const data = await res.json();
      if (!data.uploadUrl) throw new Error(data.message || "Failed to get upload URL");

      // Step 2: Upload directly to S3
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", data.uploadUrl, true);
      xhr.setRequestHeader("Content-Type", file.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          setStatus(
            `Upload successful! Video scheduled from ${new Date(
              data.video.startTime
            ).toLocaleString()} for ${Math.floor(videoEl.duration)} seconds`
          );
          setProgress(100);
        } else {
          setStatus(`Upload failed. Status: ${xhr.status}`);
        }
      };

      xhr.onerror = () => {
        setStatus("Upload error.");
      };

      xhr.send(file);
    } catch (err) {
      console.error(err);
      setStatus("Error: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: "500px", margin: "20px auto", fontFamily: "Arial, sans-serif" }}>
      <h1>Upload Video</h1>
      <form onSubmit={handleUpload}>
        <input
          type="text"
          placeholder="Video Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{ width: "100%", padding: "8px", margin: "5px 0" }}
        />
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
          style={{ width: "100%", padding: "8px", margin: "5px 0" }}
        />
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files[0])}
          required
          style={{ width: "100%", padding: "8px", margin: "5px 0" }}
        />
        <button type="submit" style={{ width: "100%", padding: "10px", margin: "10px 0" }}>
          Generate Upload URL & Upload
        </button>
      </form>

      <div style={{ background: "#eee", borderRadius: "5px", marginTop: "10px", height: "20px" }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "green", textAlign: "center", color: "white" }}>
          {progress}%
        </div>
      </div>

      <div style={{ marginTop: "10px" }}>{status}</div>
    </div>
  );
}
