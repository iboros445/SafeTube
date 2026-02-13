import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "safetube.db");

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const client = createClient({
  url: `file:${DB_PATH}`,
});

export const db = drizzle(client, { schema });

// ─── Auto-create tables on first run ───────────────────────────────
let initialized = false;
async function initDb() {
  if (initialized) return;
  initialized = true;

  // Set busy timeout & WAL mode to prevent SQLITE_BUSY during concurrent access
  await client.execute("PRAGMA busy_timeout = 5000");
  await client.execute("PRAGMA journal_mode = WAL");

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#6366f1',
      daily_limit_seconds INTEGER NOT NULL DEFAULT 3600,
      current_usage_seconds INTEGER NOT NULL DEFAULT 0,
      last_heartbeat_at INTEGER,
      last_reset_date TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      youtube_url TEXT,
      local_path TEXT NOT NULL,
      thumbnail_path TEXT,
      duration_seconds INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_pin', '1234');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('retention_days', '7');
  `);
}

// Run init immediately
initDb().catch(console.error);
