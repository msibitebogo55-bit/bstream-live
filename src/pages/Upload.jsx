import React, { useState } from "react";

export default function Upload() {
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(""); // optional; backend will auto-detect
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  const BACKEND = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select a video file");

    try {
      const username = prompt("Admin Username");
      const password = prompt("Admin Password");
      const authHeader = "Basic " + btoa(`${username}:${password}`);

      // 1) Get presigned URL + provisional DB row
      const res = await fetch(`${BACKEND}/upload-url`, {
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
          duration: duration || undefined, // optional
        }),
      });

      const data = await res.json();
      if (!data.uploadUrl) throw new Error(data.message || "Failed to get upload URL");

      // 2) Upload file directly to S3
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", data.uploadUrl, true);
      xhr.setRequestHeader("Content-Type", file.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(percent);
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          setStatus("Uploaded. Finalizing...");
          // 3) Tell backend to ffprobe and finalize duration/start
          const confirmRes = await fetch(`${BACKEND}/confirm-upload`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
            body: JSON.stringify({ id: data.video.id }),
          });
          const confirm = await confirmRes.json();
          if (!confirm.ok) {
            setStatus("Upload saved, but duration detection failed. Default used.");
          } else {
            const v = confirm.video;
            setStatus(
              `✅ Scheduled: "${v.title}" — ${new Date(v.startTime).toLocaleString()} (duration ${v.duration}s)`
            );
          }
          setProgress(100);
        } else {
          setStatus(`Upload failed. Status: ${xhr.status}`);
        }
      };

      xhr.onerror = () => setStatus("Upload error.");
      xhr.send(file);
    } catch (err) {
      console.error(err);
      setStatus("Error: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "20px auto", fontFamily: "Arial, sans-serif" }}>
      <h1>Upload Video</h1>
      <form onSubmit={handleUpload}>
        <input
          type="text"
          placeholder="Video Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{ width: "100%", padding: 8, margin: "5px 0" }}
        />
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
          style={{ width: "100%", padding: 8, margin: "5px 0" }}
        />
        <input
          type="number"
          placeholder="(Optional) Duration in seconds"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          style={{ width: "100%", padding: 8, margin: "5px 0" }}
        />
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files[0])}
          required
          style={{ width: "100%", padding: 8, margin: "5px 0" }}
        />
        <button type="submit" style={{ width: "100%", padding: 10, margin: "10px 0" }}>
          Generate Upload URL & Upload
        </button>
      </form>

      <div style={{ background: "#eee", borderRadius: 5, marginTop: 10, height: 20 }}>
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "green",
            textAlign: "center",
            color: "white",
          }}
        >
          {progress}%
        </div>
      </div>

      <div style={{ marginTop: 10 }}>{status}</div>
    </div>
  );
}
