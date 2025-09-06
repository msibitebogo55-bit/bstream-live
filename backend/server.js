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

// ------- SQLite (works w/ or w/o Render disk) -------
const DATA_DIR =
  process.env.RENDER_PERSISTENT_DISK_PATH ||
  path.join(__dirname, "data");

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
      duration INTEGER,
      status TEXT NOT NULL DEFAULT 'pending' -- pending|ready|failed
    )
  `);
});

// Promisified helpers
const dbRun = (sql, params=[]) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const dbGet = (sql, params=[]) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, function (err, row) {
      if (err) return reject(err);
      resolve(row);
    });
  });

const dbAll = (sql, params=[]) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) return reject(err);
      resolve(rows);
    });
  });

// ------- AWS S3 -------
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ------- Basic Auth (admin endpoints) -------
function checkAuth(req, res, next) {
  const b64auth = (req.headers.authorization || "").split(" ")[1] || "";
  const [login, password] = Buffer.from(b64auth, "base64").toString().split(":");
  if (login === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) return next();
  res.set("WWW-Authenticate", 'Basic realm="Admin Area"');
  res.status(401).send("Authentication required.");
}

// ------- Helper: resolve schedule conflicts -------
async function nextAvailableStart(requestedISO, durationSec) {
  const requested = new Date(requestedISO);
  const rows = await dbAll(`SELECT startTime, duration FROM videos WHERE status IN ('pending','ready') ORDER BY startTime ASC`);
  let start = requested.getTime();

  for (const r of rows) {
    if (!r.duration) continue; // pending duration, skip overlap calc
    const s = new Date(r.startTime).getTime();
    const e = s + r.duration * 1000;
    const newEnd = start + durationSec * 1000;

    // overlap if [start,newEnd] crosses [s,e]
    if (start < e && newEnd > s) {
      start = e; // push to end of existing
    }
  }
  return new Date(start).toISOString();
}

// ------- 1) Create S3 presigned URL & provisional DB row -------
app.post("/upload-url", checkAuth, async (req, res) => {
  try {
    const { fileName, contentType, title, startTime, duration } = req.body;
    if (!fileName || !contentType) {
      return res.status(400).json({ message: "Missing fileName or contentType" });
    }

    // If no startTime passed, start now. If duration passed, use it provisionally; final comes from probe.
    const requestedStart = startTime ? new Date(startTime).toISOString() : new Date().toISOString();
    const provisionalDur = parseInt(duration) > 0 ? parseInt(duration) : null;

    // pick a unique key and final scheduled start that avoids overlap if we already know duration
    const s3key = `${Date.now()}-${fileName}`;
    const publicUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeURIComponent(s3key)}`;

    // If we have a provisional duration, push start to avoid conflict; otherwise just record requested time
    const scheduledStart = provisionalDur
      ? await nextAvailableStart(requestedStart, provisionalDur)
      : requestedStart;

    const cmd = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3key,
      ContentType: contentType
    });
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 3600 });

    // Insert provisional row (duration may be null until probe)
    const result = await dbRun(
      `INSERT INTO videos (title, url, s3key, startTime, duration, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [title || fileName, publicUrl, s3key, scheduledStart, provisionalDur]
    );

    const video = await dbGet(`SELECT * FROM videos WHERE id = ?`, [result.lastID]);

    res.json({ uploadUrl, video });
  } catch (err) {
    console.error("upload-url error:", err);
    res.status(500).json({ message: "Failed to generate upload URL" });
  }
});

// ------- 2) Confirm upload -> ffprobe duration -> finalize row -------
app.post("/confirm-upload", checkAuth, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ message: "Missing id" });

    const video = await dbGet(`SELECT * FROM videos WHERE id = ?`, [id]);
    if (!video) return res.status(404).json({ message: "Video not found" });

    // probe public S3 URL; ffprobe can read http(s)
    const durationSec = await new Promise((resolve) => {
      ffmpeg.ffprobe(video.url, (err, meta) => {
        if (err) {
          console.error("ffprobe error:", err);
          return resolve(null);
        }
        const dur = Math.floor(meta?.format?.duration || 0);
        resolve(dur > 0 ? dur : null);
      });
    });

    // if duration missing, keep previous; else update
    let finalDuration = durationSec || video.duration || 3600;

    // if previously no duration, now we know it -> push start to avoid conflicts
    let finalStart = video.startTime;
    if (!video.duration && durationSec) {
      finalStart = await nextAvailableStart(video.startTime, finalDuration);
    }

    await dbRun(
      `UPDATE videos SET duration = ?, startTime = ?, status = 'ready' WHERE id = ?`,
      [finalDuration, finalStart, id]
    );

    const updated = await dbGet(`SELECT * FROM videos WHERE id = ?`, [id]);
    res.json({ ok: true, video: updated });
  } catch (err) {
    console.error("confirm-upload error:", err);
    res.status(500).json({ message: "Failed to confirm upload" });
  }
});

// ------- 3) Now playing -------
app.get("/now", async (req, res) => {
  try {
    const nowISO = new Date().toISOString();
    const row = await dbGet(
      `SELECT * FROM videos
       WHERE status='ready'
       AND startTime <= ?
       AND datetime(startTime, '+' || duration || ' seconds') >= ?
       ORDER BY startTime DESC
       LIMIT 1`,
      [nowISO, nowISO]
    );
    res.json(row || {});
  } catch (err) {
    console.error("now error:", err);
    res.status(500).json({});
  }
});

// ------- 4) Full schedule (ready + pending) -------
app.get("/schedule", async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT * FROM videos
       WHERE status IN ('pending','ready')
       ORDER BY startTime ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error("schedule error:", err);
    res.status(500).json([]);
  }
});

// ------- 5) Video redirect (serves public S3 URL) -------
app.get("/video/:id", async (req, res) => {
  try {
    const row = await dbGet(`SELECT * FROM videos WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).send("Not found");
    res.redirect(row.url);
  } catch (err) {
    console.error("video redirect error:", err);
    res.status(500).send("Error");
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on :${PORT}`));
