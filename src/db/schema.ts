import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ─── Children ──────────────────────────────────────────────────────
export const children = sqliteTable("children", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    avatarColor: text("avatar_color").notNull().default("#6366f1"),
    avatarType: text("avatar_type").notNull().default("color"), // "color" | "emoji" | "photo"
    avatarEmoji: text("avatar_emoji"),   // e.g. "🦁"
    avatarPhoto: text("avatar_photo"),   // filename in media/avatars/
    theme: text("theme").notNull().default("dark"), // "dark" | "light" — admin-only
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
    subtitlePath: text("subtitle_path"),
    durationSeconds: integer("duration_seconds"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    // AI Analysis fields (opt-in, nullable)
    aiScore: integer("ai_score"),                                        // 1-10 safety score
    educationalValue: text("educational_value"),                          // e.g. "High - Teaches Physics"
    pacing: text("pacing"),                                               // e.g. "Slow/Calm", "Hyper-Stimulating"
    educationalTags: text("educational_tags"),                            // JSON array string
    isApproved: integer("is_approved", { mode: "boolean" }),              // null = no review, true = approved, false = dismissed
});

// ─── Video Progress (per-child resume) ─────────────────────────────
export const videoProgress = sqliteTable("video_progress", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    childId: integer("child_id")
        .notNull()
        .references(() => children.id, { onDelete: "cascade" }),
    videoId: integer("video_id")
        .notNull()
        .references(() => videos.id, { onDelete: "cascade" }),
    progressSeconds: integer("progress_seconds").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
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
export type VideoProgress = typeof videoProgress.$inferSelect;
export type Setting = typeof settings.$inferSelect;
