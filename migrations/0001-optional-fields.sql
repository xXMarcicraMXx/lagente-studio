-- Role and job become optional; a visible "site" column is added.
-- SQLite cannot drop NOT NULL in place, so the table is rebuilt and the rows copied over.
-- Run once against the live database:
--   npx wrangler d1 execute lagente-leads --remote --file=migrations/0001-optional-fields.sql
-- It is safe to run on an empty table.

CREATE TABLE fittings_new (
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

INSERT INTO fittings_new (id, created_at, name, company, role, email, job, country, ip, user_agent)
  SELECT id, created_at, name, company, role, email, job, country, ip, user_agent FROM fittings;

DROP TABLE fittings;
ALTER TABLE fittings_new RENAME TO fittings;

CREATE INDEX IF NOT EXISTS fittings_created_at ON fittings (created_at DESC);
