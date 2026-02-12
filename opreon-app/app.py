import os
import re
import sqlite3
import smtplib
from email.message import EmailMessage
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

DB_PATH = os.getenv("DB_PATH", "leads.db")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

app = FastAPI(title="Opreon Lead API")

# Simple in memory rate limiting per IP
RATE_LIMIT_WINDOW_SEC = 60
RATE_LIMIT_MAX = 10
_ip_bucket: dict[str, list[float]] = {}


class LeadIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    company: str = Field(min_length=2, max_length=120)
    role: Optional[str] = Field(default=None, max_length=120)
    email: str = Field(min_length=5, max_length=200)
    system: Optional[str] = Field(default=None, max_length=120)
    workflow: str = Field(min_length=10, max_length=4000)
    # Honeypot. Must remain empty.
    website: Optional[str] = Field(default=None, max_length=200)


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS leads (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              created_at TEXT NOT NULL,
              ip TEXT NOT NULL,
              name TEXT NOT NULL,
              company TEXT NOT NULL,
              role TEXT,
              email TEXT NOT NULL,
              system TEXT,
              workflow TEXT NOT NULL,
              user_agent TEXT
            )
            """
        )
        conn.commit()


@app.on_event("startup")
def _startup():
    init_db()


def _rate_limit(ip: str) -> None:
    now = datetime.now(timezone.utc).timestamp()
    bucket = _ip_bucket.get(ip, [])
    bucket = [t for t in bucket if now - t <= RATE_LIMIT_WINDOW_SEC]
    if len(bucket) >= RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Too many requests. Try again shortly.")
    bucket.append(now)
    _ip_bucket[ip] = bucket


def send_lead_email(to_email: str, subject: str, body: str) -> None:
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")

    if not (host and user and password and to_email):
        return  # email not configured

    msg = EmailMessage()
    msg["From"] = user
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(host, port) as s:
        s.starttls()
        s.login(user, password)
        s.send_message(msg)


@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    # Minimal CORS
    if request.method == "OPTIONS":
        from fastapi.responses import Response
        r = Response()
    else:
        r = await call_next(request)

    origin = request.headers.get("origin")
    if ALLOWED_ORIGINS == "*":
        r.headers["Access-Control-Allow-Origin"] = origin or "*"
    else:
        allowed = [o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()]
        if origin in allowed:
            r.headers["Access-Control-Allow-Origin"] = origin

    r.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    r.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return r


@app.get("/", response_class=HTMLResponse)
def home():
    try:
        with open("index.html", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "<h1>index.html not found</h1>"


@app.post("/api/lead")
async def create_lead(payload: LeadIn, request: Request):
    ip = request.client.host if request.client else "unknown"
    _rate_limit(ip)

    # Honeypot
    if payload.website and payload.website.strip():
        raise HTTPException(status_code=400, detail="Invalid submission.")

    if not EMAIL_REGEX.match(payload.email.strip()):
        raise HTTPException(status_code=400, detail="Invalid email.")

    created_at = datetime.now(timezone.utc).isoformat()
    ua = request.headers.get("user-agent")

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO leads (created_at, ip, name, company, role, email, system, workflow, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created_at,
                ip,
                payload.name.strip(),
                payload.company.strip(),
                (payload.role or "").strip() or None,
                payload.email.strip(),
                (payload.system or "").strip() or None,
                payload.workflow.strip(),
                ua,
            ),
        )
        conn.commit()

    # Email notification
    notify_to = os.getenv("NOTIFY_TO_EMAIL", "mtebogo1@hotmail.com")
    subject = f"Opreon Lead: {payload.company}"
    body = (
        "New lead received\n\n"
        f"Name: {payload.name}\n"
        f"Company: {payload.company}\n"
        f"Role: {payload.role or '-'}\n"
        f"Email: {payload.email}\n"
        f"System: {payload.system or '-'}\n\n"
        "Workflow:\n"
        f"{payload.workflow}\n\n"
        f"Time (UTC): {created_at}\n"
        f"IP: {ip}\n"
    )
    try:
        send_lead_email(notify_to, subject, body)
    except Exception:
        # Do not fail the request if email fails
        pass

    return {"ok": True, "message": "Lead received."}


@app.get("/api/leads/count")
def leads_count():
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute("SELECT COUNT(*) FROM leads")
        n = cur.fetchone()[0]
    return {"count": n}
