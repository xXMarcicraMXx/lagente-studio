-- Run this once in the D1 console (Cloudflare dashboard, database "Console" tab).
CREATE TABLE IF NOT EXISTS fittings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL,
  name        TEXT NOT NULL,
  company     TEXT NOT NULL,
  role        TEXT NOT NULL,
  email       TEXT NOT NULL,
  job         TEXT NOT NULL,
  country     TEXT,
  ip          TEXT,
  user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS fittings_created_at ON fittings (created_at DESC);
