require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const app = express();
app.use(express.json());
app.use(cors());

// ---------- SQLite Setup ----------
// Render persistent disk mount: /data
const DB_PATH = process.env.RENDER_PERSISTENT_DISK_PATH
  ? path.join(process.env.RENDER_PERSISTENT_DISK_PATH, "bstream.db")
  : path.join(__dirname, "bstream.db");

if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let db;
(async () => {
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  // Create table if it doesn't exist
  await db.run(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      startTime TEXT NOT NULL,
      duration INTEGER NOT NULL
    )
  `);
})();

// ---------- AWS S3 Setup ----------
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ---------- Basic Auth ----------
function checkAuth(req, res, next) {
  const b64auth = (req.headers.authorization || "").split(" ")[1] || "";
  const [login, password] = Buffer.from(b64auth, "base64").toString().split(":");
  if (login === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) return next();
  res.set("WWW-Authenticate", 'Basic realm="Admin Area"');
  res.status(401).send("Authentication required.");
}

// ---------- Upload URL ----------
app.post("/upload-url", checkAuth, async (req, res) => {
  try {
    const { fileName, contentType, title, startTime, duration } = req.body;
    if (!fileName || !contentType) return res.status(400).json({ message: "Missing parameters" });

    const dur = parseInt(duration) || 3600;
    const startDate = startTime ? new Date(startTime) : new Date();

    const key = Date.now() + "-" + fileName;
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    const videoUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    // Insert into DB
    const result = await db.run(
      `INSERT INTO videos (title, url, startTime, duration) VALUES (?, ?, ?, ?)`,
      [title || fileName, videoUrl, startDate.toISOString(), dur]
    );

    const videoData = {
      id: result.lastID,
      title: title || fileName,
      url: videoUrl,
      startTime: startDate,
      duration: dur,
    };

    res.json({ uploadUrl, video: videoData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate upload URL" });
  }
});

// ---------- Get current live video ----------
app.get("/now", async (req, res) => {
  try {
    const now = new Date();
    const video = await db.get(`SELECT * FROM videos WHERE startTime <= ? AND datetime(startTime, '+' || duration || ' seconds') >= ?`, [
      now.toISOString(),
      now.toISOString(),
    ]);
    res.json(video || {});
  } catch (err) {
    console.error(err);
    res.status(500).send({});
  }
});

// ---------- Full schedule ----------
app.get("/schedule", async (req, res) => {
  try {
    const videos = await db.all(`SELECT * FROM videos ORDER BY startTime ASC`);
    res.json(videos);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// ---------- Stream video efficiently ----------
app.get("/video/:id", async (req, res) => {
  try {
    const video = await db.get("SELECT * FROM videos WHERE id = ?", [req.params.id]);
    if (!video) return res.status(404).send("Video not found");

    // Redirect to S3 URL (bypasses RAM issues)
    res.redirect(video.url);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching video");
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
