// backend/services/usage.js
import fs from "fs";
import path from "path";

const FILE_PATH = path.join(process.cwd(), "usage.json");

// Load usage from file or initialize
let usage = {};
try {
  const raw = fs.readFileSync(FILE_PATH, "utf-8");
  usage = JSON.parse(raw);
} catch {
  usage = {};
}

// Save usage back to file
function saveUsage() {
  fs.writeFileSync(FILE_PATH, JSON.stringify(usage, null, 2));
}

// Check if IP can analyze today
export function canAnalyze(ip) {
  const today = new Date().toISOString().slice(0, 10);

  if (!usage[ip]) usage[ip] = {};
  if (!usage[ip][today]) usage[ip][today] = 0;

  return usage[ip][today] < 2;
}

// Log an analysis for this IP
export function logAnalysis(ip) {
  const today = new Date().toISOString().slice(0, 10);

  if (!usage[ip]) usage[ip] = {};
  if (!usage[ip][today]) usage[ip][today] = 0;

  usage[ip][today] += 1;

  saveUsage(); // persist to file
}
