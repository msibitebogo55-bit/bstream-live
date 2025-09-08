// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const ffmpeg = require("fluent-ffmpeg");
const ffprobe = require("ffprobe-static");

ffmpeg.setFfprobePath(ffprobe.path);

const app = express();
app.use(express.json());
app.use(cors());

// ---------- Persistence / SQLite ----------
const DATA_DIR =
  process.env.RENDER_PERSISTENT_DISK_PATH || path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "bstream.db");
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      s3key TEXT NOT NULL,
      startTime TEXT NOT NULL,
      duration INTEGER,                -- seconds; NULL until confirmed
      status TEXT NOT NULL DEFAULT 'pending', -- pending|ready|failed
      channelId TEXT NOT NULL DEFAULT 'student-tv',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
});

// Promisified sqlite helpers
const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, function (err, row) {
      if (err) return reject(err);
      resolve(row);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) return reject(err);
      resolve(rows);
    });
  });

// ---------- AWS S3 client ----------
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ---------- Basic admin auth ----------
function checkAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const b64 = (auth.split(" ")[1] || "");
  let login = "", password = "";
  try {
    const decoded = Buffer.from(b64, "base64").toString();
    [login, password] = decoded.split(":");
  } catch (e) {}
  if (login === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Admin Area"');
  return res.status(401).json({ message: "Authentication required" });
}

// ---------- Scheduling helpers ----------
// returns list of videos (pending or ready) ordered by startTime
async function getAllScheduled(channelId = "student-tv") {
  const rows = await dbAll(
    `SELECT * FROM videos WHERE channelId = ? AND status IN ('pending','ready') ORDER BY datetime(startTime) ASC`,
    [channelId]
  );
  return rows;
}

// Given requestedStartISO and durationSec, find earliest startTime (ISO) that doesn't overlap existing schedule
// Excludes an optional 'excludeId' (useful when re-scheduling the same row)
async function findNextAvailableStart(requestedStartISO, durationSec, channelId = "student-tv", excludeId = null) {
  const requested = new Date(requestedStartISO).getTime();
  const rows = await dbAll(
    `SELECT id, startTime, duration FROM videos WHERE channelId = ? AND status IN ('pending','ready') ${excludeId ? "AND id != ?" : ""} ORDER BY datetime(startTime) ASC`,
    excludeId ? [channelId, excludeId] : [channelId]
  );

  // We'll walk through and shift start forward if overlapping
  let start = requested;

  for (const r of rows) {
    // skip rows without duration (if any) — treat them as zero-length for safety
    if (!r.duration) continue;
    const s = new Date(r.startTime).getTime();
    const e = s + r.duration * 1000;
    const newEnd = start + durationSec * 1000;

    if (start < e && newEnd > s) {
      // overlap -> move start to end of this existing
      start = e;
    }
  }

  return new Date(start).toISOString();
}

// Utility: probe duration seconds for a public URL using ffprobe (returns integer seconds or null)
function probeDurationSeconds(url) {
  return new Promise((resolve) => {
    // ffprobe supports http(s) if ffmpeg built with http support
    ffmpeg.ffprobe(url, (err, meta) => {
      if (err) {
        console.error("ffprobe failed:", err?.message || err);
        return resolve(null);
      }
      const dur = Math.floor(meta?.format?.duration || 0);
      resolve(dur > 0 ? dur : null);
    });
  });
}

// ---------- Routes ----------

// Health
app.get("/", (req, res) => res.send({ ok: true, message: "BStream backend running" }));

// Return single channel list (we keep one channel fixed)
app.get("/channels", (req, res) => {
  res.json([
    {
      id: "student-tv",
      name: "On-Campus StudentTV",
      slug: "studenttv"
    }
  ]);
});

// returns live status for a channel (currently playing video + elapsed info)
app.get("/channels/:slug/live", async (req, res) => {
  try {
    const { slug } = req.params;
    // Only "studenttv" supported for now
    if (slug !== "studenttv" && slug !== "student-tv") {
      return res.status(404).json({ live: false, message: "Channel not found" });
    }
    // query schedule for channelId 'student-tv'
    const nowISO = new Date().toISOString();
    const row = await dbGet(
      `SELECT * FROM videos
       WHERE channelId = 'student-tv' AND status='ready' AND startTime <= ? AND datetime(startTime, '+' || duration || ' seconds') > ?
       ORDER BY datetime(startTime) DESC LIMIT 1`,
      [nowISO, nowISO]
    );

    if (!row) {
      return res.json({ live: false, message: "No live stream right now" });
    }

    const start = new Date(row.startTime);
    const now = new Date();
    const elapsedSec = Math.floor((now - start) / 1000);
    return res.json({
      live: true,
      video: {
        id: row.id,
        title: row.title,
        url: row.url,
        startTime: row.startTime,
        duration: row.duration
      },
      elapsed: elapsedSec
    });
  } catch (err) {
    console.error("channels/:slug/live error:", err);
    res.status(500).json({ live: false, message: "Error" });
  }
});

// Create presigned upload URL and insert provisional DB row (status 'pending', duration NULL)
app.post("/upload-url", checkAuth, async (req, res) => {
  try {
    const { fileName, contentType, title, startTime } = req.body;
    if (!fileName || !contentType) {
      return res.status(400).json({ message: "Missing fileName or contentType" });
    }

    // requested start (or now)
    const requestedStartISO = startTime ? new Date(startTime).toISOString() : new Date().toISOString();

    // build S3 key and public URL
    const s3key = `${Date.now()}-${fileName}`;
    const publicUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeURIComponent(s3key)}`;

    // create presigned PUT command (no ACL since bucket owner enforced)
    const cmd = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3key,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 3600 });

    // Insert provisional DB row; duration is NULL until confirm
    const result = await dbRun(
      `INSERT INTO videos (title, url, s3key, startTime, duration, status, channelId)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [title || fileName, publicUrl, s3key, requestedStartISO, null, "student-tv"]
    );

    const video = await dbGet(`SELECT * FROM videos WHERE id = ?`, [result.lastID]);
    return res.json({ uploadUrl, video });
  } catch (err) {
    console.error("upload-url error:", err);
    return res.status(500).json({ message: "Failed to generate upload URL" });
  }
});

// Confirm upload: probe duration and finalize schedule (sets duration and possibly shifts start to avoid overlaps)
app.post("/confirm-upload", checkAuth, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ message: "Missing id" });

    const video = await dbGet(`SELECT * FROM videos WHERE id = ?`, [id]);
    if (!video) return res.status(404).json({ message: "Video not found" });

    // probe duration (seconds) from the public S3 URL
    const durationSec = await probeDurationSeconds(video.url);
    if (!durationSec) {
      // mark failed
      await dbRun(`UPDATE videos SET status='failed' WHERE id = ?`, [id]);
      return res.status(500).json({ message: "Failed to detect video duration" });
    }

    // compute final start to avoid overlap with existing scheduled videos (exclude this video id)
    const finalStartISO = await findNextAvailableStart(video.startTime, durationSec, video.channelId, id);

    await dbRun(
      `UPDATE videos SET duration = ?, startTime = ?, status = 'ready' WHERE id = ?`,
      [durationSec, finalStartISO, id]
    );

    const updated = await dbGet(`SELECT * FROM videos WHERE id = ?`, [id]);
    return res.json({ ok: true, video: updated });
  } catch (err) {
    console.error("confirm-upload error:", err);
    return res.status(500).json({ message: "Failed to confirm upload" });
  }
});

// Full schedule for channel (ready + pending)
app.get("/schedule", async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT * FROM videos WHERE channelId='student-tv' AND status IN ('pending','ready') ORDER BY datetime(startTime) ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error("schedule error:", err);
    return res.status(500).json([]);
  }
});

// Return the currently live video (legacy /now endpoint)
app.get("/now", async (req, res) => {
  try {
    const nowISO = new Date().toISOString();
    const row = await dbGet(
      `SELECT * FROM videos WHERE channelId='student-tv' AND status='ready' AND startTime <= ? AND datetime(startTime, '+' || duration || ' seconds') > ? ORDER BY datetime(startTime) DESC LIMIT 1`,
      [nowISO, nowISO]
    );
    return res.json(row || {});
  } catch (err) {
    console.error("/now error:", err);
    return res.status(500).json({});
  }
});

// Video redirect: returns 302 redirect to S3 public url (no RAM streaming on server)
app.get("/video/:id", async (req, res) => {
  try {
    const row = await dbGet(`SELECT * FROM videos WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).send("Not found");
    return res.redirect(row.url);
  } catch (err) {
    console.error("video redirect error:", err);
    return res.status(500).send("Error");
  }
});

// Admin: list all videos (for debugging)
app.get("/admin/videos", checkAuth, async (req, res) => {
  try {
    const rows = await dbAll(`SELECT * FROM videos ORDER BY datetime(startTime) ASC`);
    return res.json(rows);
  } catch (err) {
    console.error("/admin/videos error:", err);
    return res.status(500).json([]);
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`BStream backend listening on port ${PORT}`);
});
