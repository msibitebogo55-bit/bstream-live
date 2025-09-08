import React, { useState } from "react";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");

  const handleUpload = async () => {
    if (!file) return alert("Pick a file");

    try {
      setStatus("Requesting upload URL…");

      // 1. Ask backend for presigned URL
      const res = await fetch("https://bstream-backend.onrender.com/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + btoa("ADMIN_USER:ADMIN_PASS"),
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          title: title || file.name,
        }),
      });

      if (!res.ok) {
        throw new Error("upload-url failed: " + (await res.text()));
      }
      const { uploadUrl, video } = await res.json();

      // 2. PUT actual file to S3 presigned URL
      setStatus("Uploading to S3…");
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error("S3 upload failed: " + putRes.status);
      }

      // 3. Confirm upload so backend probes duration
      setStatus("Confirming upload…");
      const confirmRes = await fetch("https://bstream-backend.onrender.com/confirm-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + btoa("ADMIN_USER:ADMIN_PASS"),
        },
        body: JSON.stringify({ id: video.id }),
      });

      if (!confirmRes.ok) {
        throw new Error("confirm-upload failed: " + (await confirmRes.text()));
      }

      const confirmed = await confirmRes.json();
      console.log("Confirmed video:", confirmed);
      setStatus("✅ Upload complete, video scheduled!");
    } catch (err) {
      console.error(err);
      setStatus("❌ Error: " + err.message);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl mb-2">Upload video</h2>
      <input type="text" placeholder="Title" value={title}
        onChange={(e) => setTitle(e.target.value)} className="border p-1 mb-2 block" />
      <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files[0])} />
      <button
        onClick={handleUpload}
        className="bg-blue-500 text-white px-4 py-2 rounded mt-2"
      >
        Upload
      </button>
      <div className="mt-2">{status}</div>
    </div>
  );
}
