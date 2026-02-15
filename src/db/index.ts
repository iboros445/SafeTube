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
async function initDb() {
  // Set busy timeout & WAL mode to prevent SQLITE_BUSY during concurrent access
  await client.execute("PRAGMA busy_timeout = 5000");
  await client.execute("PRAGMA journal_mode = WAL");

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#6366f1',
      avatar_type TEXT NOT NULL DEFAULT 'color',
      avatar_emoji TEXT,
      avatar_photo TEXT,
      theme TEXT NOT NULL DEFAULT 'dark',
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
      subtitle_path TEXT,
      duration_seconds INTEGER,
      created_at INTEGER NOT NULL,
      ai_score INTEGER,
      educational_value TEXT,
      pacing TEXT,
      educational_tags TEXT,
      is_approved INTEGER
    );

    CREATE TABLE IF NOT EXISTS video_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      progress_seconds INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_pin', '1234');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('retention_days', '7');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('ai_provider', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('ai_api_key', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('ai_auto_analysis', 'false');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('ai_recommendations', 'false');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('ai_ollama_url', 'http://localhost:11434');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('ai_model', '');
  `);

  // Migrate existing databases: add new columns if missing (safe to fail)
  const migrations = [
    "ALTER TABLE children ADD COLUMN avatar_type TEXT NOT NULL DEFAULT 'color'",
    "ALTER TABLE children ADD COLUMN avatar_emoji TEXT",
    "ALTER TABLE children ADD COLUMN avatar_photo TEXT",
    "ALTER TABLE children ADD COLUMN theme TEXT NOT NULL DEFAULT 'dark'",
    "ALTER TABLE videos ADD COLUMN subtitle_path TEXT",
    // AI columns
    "ALTER TABLE videos ADD COLUMN ai_score INTEGER",
    "ALTER TABLE videos ADD COLUMN educational_value TEXT",
    "ALTER TABLE videos ADD COLUMN pacing TEXT",
    "ALTER TABLE videos ADD COLUMN educational_tags TEXT",
    "ALTER TABLE videos ADD COLUMN is_approved INTEGER",
  ];
  for (const sql of migrations) {
    try { await client.execute(sql); } catch { /* column already exists */ }
  }
}

// Singleton promise: created once, awaited by all consumers to ensure DB is ready.
// Skipped only during Next.js production build phase.
let dbReady: Promise<void>;
if (process.env.NEXT_PHASE === 'phase-production-build') {
  dbReady = Promise.resolve(); // no-op during build
} else {
  dbReady = initDb();
}

export { dbReady };
