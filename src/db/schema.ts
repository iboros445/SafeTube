import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ─── Children ──────────────────────────────────────────────────────
export const children = sqliteTable("children", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    avatarColor: text("avatar_color").notNull().default("#6366f1"),
    dailyLimitSeconds: integer("daily_limit_seconds").notNull().default(3600),
    currentUsageSeconds: integer("current_usage_seconds").notNull().default(0),
    lastHeartbeatAt: integer("last_heartbeat_at", { mode: "timestamp" }),
    lastResetDate: text("last_reset_date"), // YYYY-MM-DD
});

// ─── Sessions ──────────────────────────────────────────────────────
export const sessions = sqliteTable("sessions", {
    id: text("id").primaryKey(),
    childId: integer("child_id")
        .notNull()
        .references(() => children.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
});

// ─── Videos ────────────────────────────────────────────────────────
export const videos = sqliteTable("videos", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    youtubeUrl: text("youtube_url"),
    localPath: text("local_path").notNull(),
    thumbnailPath: text("thumbnail_path"),
    durationSeconds: integer("duration_seconds"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─── Settings ──────────────────────────────────────────────────────
export const settings = sqliteTable("settings", {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
});

// ─── Types ─────────────────────────────────────────────────────────
export type Child = typeof children.$inferSelect;
export type NewChild = typeof children.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type Setting = typeof settings.$inferSelect;
