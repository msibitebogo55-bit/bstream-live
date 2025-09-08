import React, { useEffect, useRef, useState } from "react";

export default function Live() {
  const videoRef = useRef(null);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [elapsed, setElapsed] = useState(0);

  // FIXED CHANNEL (On-Campus StudentTV)
  const channelId = "student-tv"; // <-- use the exact ID your backend uses

  const fetchSchedule = async () => {
    try {
      const res = await fetch("https://bstream-backend.onrender.com/schedule");
      const data = await res.json();

      // Filter schedule for this channel only
      const channelSchedule = data.filter((v) => v.channelId === channelId);
      setSchedule(channelSchedule);

      const now = new Date();
      const liveVideo = channelSchedule.find((v) => {
        const start = new Date(v.startTime);
        const end = new Date(start.getTime() + v.duration * 1000);
        return now >= start && now <= end;
      });

      if (liveVideo) {
        setCurrentVideo(liveVideo);
        const elapsedSeconds = Math.floor((now - new Date(liveVideo.startTime)) / 1000);
        setElapsed(elapsedSeconds);
      } else {
        setCurrentVideo(null);
      }
    } catch (err) {
      console.error("Failed to fetch schedule:", err);
    }
  };

  useEffect(() => {
    fetchSchedule();
    const interval = setInterval(fetchSchedule, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !currentVideo) return;

    videoEl.currentTime = elapsed;
    videoEl.play();

    const handleSeeking = () => {
      const allowedTime = Math.floor((new Date() - new Date(currentVideo.startTime)) / 1000);
      if (videoEl.currentTime > allowedTime) {
        videoEl.currentTime = allowedTime;
      }
    };

    videoEl.addEventListener("seeking", handleSeeking);
    return () => videoEl.removeEventListener("seeking", handleSeeking);
  }, [currentVideo, elapsed]);

  return (
    <div style={{ maxWidth: "900px", margin: "20px auto", fontFamily: "Arial, sans-serif" }}>
      <h1>On-Campus StudentTV Live</h1>

      {currentVideo ? (
        <div>
          <video
            ref={videoRef}
            src={currentVideo.url}
            controls
            controlsList="nodownload nofullscreen noremoteplayback"
            onContextMenu={(e) => e.preventDefault()}
            style={{
              width: "100%",
              outline: "none",
              borderRadius: "8px",
              background: "#000",
            }}
          ></video>
          <div style={{ marginTop: "10px", fontWeight: "bold" }}>
            Now Playing: {currentVideo.title}
          </div>
          <div>
            Elapsed: {Math.floor(elapsed / 60)}:{("0" + (elapsed % 60)).slice(-2)}
          </div>
        </div>
      ) : (
        <div>No live video currently</div>
      )}

      <div style={{ marginTop: "20px" }}>
        <h3>Up Next:</h3>
        {schedule
          .filter((v) => new Date(v.startTime) > new Date())
          .map((v) => (
            <div
              key={v.id}
              style={{
                padding: "8px",
                background: "#222",
                margin: "5px 0",
                borderRadius: "5px",
                color: "#fff",
              }}
            >
              {v.title} at {new Date(v.startTime).toLocaleTimeString()}
            </div>
          ))}
      </div>
    </div>
  );
}
