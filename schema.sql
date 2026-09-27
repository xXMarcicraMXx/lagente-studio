-- Fresh install: run this once in the D1 console (Cloudflare dashboard, database "Console" tab),
-- or locally with `npx wrangler d1 execute lagente-leads --local --file=schema.sql`.
-- An existing table with NOT NULL on role/job is rebuilt by migrations/0001-optional-fields.sql.
CREATE TABLE IF NOT EXISTS fittings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL,
  name        TEXT NOT NULL,
  company     TEXT NOT NULL,
  role        TEXT,
  email       TEXT NOT NULL,
  job         TEXT,
  site        TEXT,
  country     TEXT,
  ip          TEXT,
  user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS fittings_created_at ON fittings (created_at DESC);
