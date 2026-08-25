import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";

/**
 * Pluggable SQLite layer.
 * - Prefers better-sqlite3 (native, prebuilt for Node 18–26 incl. Vercel's Linux runtime).
 * - Falls back to the built-in node:sqlite driver (Node >= 23.4).
 * Both expose the same synchronous surface used across the app:
 * exec(sql), prepare(sql).run/.get/.all, run() -> { changes }.
 */

/** First writable location wins: explicit override → ./data (local dev) → OS tmp (serverless). */
function resolveDataDir(): string {
  if (process.env.DB_DIR) return process.env.DB_DIR;
  const local = path.join(process.cwd(), "data");
  try {
    fs.mkdirSync(local, { recursive: true });
    fs.accessSync(local, fs.constants.W_OK);
    return local;
  } catch {
    /* read-only fs (e.g. AWS Lambda /var/task) */
  }
  const tmp = path.join(os.tmpdir(), "cultory-data");
  fs.mkdirSync(tmp, { recursive: true });
  return tmp;
}

export const DB_FILE = process.env.DB_PATH || path.join(resolveDataDir(), "cultory.db");

interface SyncDb {
  exec(sql: string): void;
  prepare(sql: string): any;
}

function openDb(): { db: SyncDb; driver: string } {
  const force = process.env.SQLITE_DRIVER;
  if (force !== "node") {
    try {
      const require_ = createRequire(import.meta.url);
      const Database = require_("better-sqlite3");
      return { db: new Database(DB_FILE) as SyncDb, driver: "better-sqlite3" };
    } catch (err) {
      if (force === "better") throw err;
      console.warn(
        "[db] better-sqlite3 unavailable, falling back to node:sqlite:",
        (err as Error).message
      );
    }
  }
  return { db: new DatabaseSync(DB_FILE) as unknown as SyncDb, driver: "node:sqlite" };
}

const { db, driver } = openDb();
console.log(`[db] driver=${driver} file=${DB_FILE}`);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS municipalities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  plan_tier TEXT NOT NULL DEFAULT 'none',        -- none | essential | premium
  plan_price_cents INTEGER NOT NULL DEFAULT 0,
  package_status TEXT NOT NULL DEFAULT 'none',   -- none | active | pending
  lat REAL, lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin','municipality','enterprise','guide','elder')),
  municipality_id TEXT REFERENCES municipalities(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  municipality_id TEXT NOT NULL REFERENCES municipalities(id),
  contributor_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  transcript TEXT NOT NULL,
  translation_en TEXT,
  category TEXT NOT NULL,            -- oral_history | crafts_music | cuisine | folklore | rituals | nature_wisdom
  language TEXT NOT NULL DEFAULT 'el',
  place_name TEXT NOT NULL,
  lat REAL, lng REAL,
  media_type TEXT NOT NULL DEFAULT 'voice',
  duration_sec INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  source TEXT NOT NULL DEFAULT 'interview',  -- interview | import
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS itineraries (
  id TEXT PRIMARY KEY,
  municipality_id TEXT NOT NULL REFERENCES municipalities(id),
  guide_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  duration_min INTEGER NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'easy',   -- easy | moderate | challenging
  cover_emoji TEXT NOT NULL DEFAULT '🏛️',
  rating REAL NOT NULL DEFAULT 4.7,
  certified INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS itinerary_stops (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  story_id TEXT NOT NULL REFERENCES stories(id),
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL REFERENCES itineraries(id),
  user_id TEXT REFERENCES users(id),
  tourist_name TEXT NOT NULL,
  tourist_email TEXT NOT NULL,
  tourist_country TEXT NOT NULL DEFAULT 'DE',
  age_group TEXT NOT NULL DEFAULT '35-44',
  seats INTEGER NOT NULL DEFAULT 2,
  tour_date TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | paid | cancelled
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  booking_id TEXT REFERENCES bookings(id),
  municipality_id TEXT REFERENCES municipalities(id),
  kind TEXT NOT NULL,                        -- booking | package | subscription
  payer TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  fee_pct REAL NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  payout_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'settled',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  label TEXT NOT NULL DEFAULT 'Production',
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'starter',      -- starter €500 | growth €1200 | scale €2000
  environment TEXT NOT NULL DEFAULT 'live',  -- live | test
  status TEXT NOT NULL DEFAULT 'active',     -- active | revoked
  request_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interview_sessions (
  id TEXT PRIMARY KEY,
  elder_id TEXT NOT NULL REFERENCES users(id),
  municipality_id TEXT REFERENCES municipalities(id),
  stage TEXT NOT NULL DEFAULT 'started',     -- started | transcribed | translated | structured | saved
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

export const uid = (prefix: string) =>
  `${prefix}_${crypto.randomBytes(9).toString("hex")}`;

export const sha256 = (v: string) =>
  crypto.createHash("sha256").update(v).digest("hex");

export { db };
