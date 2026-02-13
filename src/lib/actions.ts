"use server";

import { db } from "@/src/db";
import { children, videos, sessions, settings, videoProgress } from "@/src/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
    createSession,
    endSession,
    validateAdminPin,
    clearSessionCookie,
} from "@/src/lib/auth";
import { downloadVideo } from "@/src/lib/video-downloader";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";

// ─── Child Session Actions ─────────────────────────────────────────

export async function loginChild(childId: number) {
    const [child] = await db
        .select()
        .from(children)
        .where(eq(children.id, childId))
        .limit(1);
    if (!child) throw new Error("Child not found");

    // Auto-reset if new day
    const today = new Date().toISOString().split("T")[0];
    if (child.lastResetDate !== today) {
        await db
            .update(children)
            .set({ currentUsageSeconds: 0, lastResetDate: today })
            .where(eq(children.id, child.id));
    }

    await createSession(childId);
    return { success: true, childId };
}

// ─── Admin Actions ─────────────────────────────────────────────────

export async function verifyPin(pin: string) {
    const valid = await validateAdminPin(pin);
    return { success: valid };
}

export async function addChild(
    pin: string,
    name: string,
    dailyLimitMinutes: number,
    avatarColor: string,
    avatarType: string = "color",
    avatarEmoji?: string,
    theme: string = "dark"
) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    await db.insert(children).values({
        name,
        avatarColor,
        avatarType,
        avatarEmoji: avatarEmoji || null,
        theme,
        dailyLimitSeconds: dailyLimitMinutes * 60,
    });

    // Get the ID of the newly created child
    const [newChild] = await db
        .select({ id: children.id })
        .from(children)
        .orderBy(desc(children.id))
        .limit(1);

    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true, childId: newChild?.id };
}

export async function updateChild(
    pin: string,
    childId: number,
    data: {
        name?: string;
        dailyLimitMinutes?: number;
        avatarColor?: string;
        avatarType?: string;
        avatarEmoji?: string;
        avatarPhoto?: string;
        theme?: string;
    }
) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.avatarColor) updateData.avatarColor = data.avatarColor;
    if (data.avatarType) updateData.avatarType = data.avatarType;
    if (data.avatarEmoji !== undefined) updateData.avatarEmoji = data.avatarEmoji || null;
    if (data.avatarPhoto !== undefined) updateData.avatarPhoto = data.avatarPhoto || null;
    if (data.theme) updateData.theme = data.theme;
    if (data.dailyLimitMinutes !== undefined)
        updateData.dailyLimitSeconds = data.dailyLimitMinutes * 60;

    await db
        .update(children)
        .set(updateData)
        .where(eq(children.id, childId));

    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true };
}

export async function deleteChild(pin: string, childId: number) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    await db.delete(children).where(eq(children.id, childId));
    revalidatePath("/admin");
    return { success: true };
}

export async function resetChildTime(pin: string, childId: number) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    await db
        .update(children)
        .set({ currentUsageSeconds: 0 })
        .where(eq(children.id, childId));

    revalidatePath("/admin");
    return { success: true };
}

export async function endChildSession(pin: string, childId: number) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    await endSession(childId);
    revalidatePath("/admin");
    return { success: true };
}

export async function punishChild(pin: string, childId: number) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    const [child] = await db.select().from(children).where(eq(children.id, childId)).limit(1);
    if (!child) return { success: false, error: "Child not found" };

    await db.update(children)
        .set({ currentUsageSeconds: child.dailyLimitSeconds })
        .where(eq(children.id, childId));

    // Force end session too so they get kicked out immediately
    await endSession(childId);

    console.log(`[Punish] Child ${childId} punished. Usage set to ${child.dailyLimitSeconds}, session ended.`);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true };
}



export async function getAdminTheme() {
    // We don't have a getSetting helper helper here so we query directly
    const result = await db.select().from(settings).where(eq(settings.key, "admin_theme")).limit(1);
    return result[0]?.value || "dark";
}

export async function adminEndCurrentSession() {
    await clearSessionCookie();
}

// ─── Video Management ──────────────────────────────────────────────

export async function downloadVideoAction(pin: string, url: string) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    const result = await downloadVideo(url);

    if (!result.success) {
        return { success: false, error: result.error };
    }

    await db.insert(videos).values({
        title: result.title!,
        youtubeUrl: url,
        localPath: result.filename!,
        thumbnailPath: result.thumbnailFilename || null,
        durationSeconds: result.duration || null,
        createdAt: new Date(),
    });

    revalidatePath("/admin");
    revalidatePath("/child");
    return { success: true, title: result.title };
}

export async function deleteVideo(pin: string, videoId: number) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    const [video] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);
    if (!video) return { success: false, error: "Video not found" };

    // Delete files from disk
    const mediaDir = path.join(process.cwd(), "media");
    const videoPath = path.join(mediaDir, video.localPath);
    const thumbPath = video.thumbnailPath
        ? path.join(mediaDir, video.thumbnailPath)
        : null;
    const subtitlePath = video.subtitlePath
        ? path.join(mediaDir, video.subtitlePath)
        : null;

    try {
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        if (thumbPath && fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
        if (subtitlePath && fs.existsSync(subtitlePath)) fs.unlinkSync(subtitlePath);
    } catch (e) {
        console.error("Error deleting files:", e);
    }

    await db.delete(videos).where(eq(videos.id, videoId));
    revalidatePath("/admin");
    revalidatePath("/child");
    return { success: true };
}

// ─── Settings ──────────────────────────────────────────────────────

export async function updatePin(currentPin: string, newPin: string) {
    const valid = await validateAdminPin(currentPin);
    if (!valid) return { success: false, error: "Invalid current PIN" };

    await db
        .update(settings)
        .set({ value: newPin })
        .where(eq(settings.key, "admin_pin"));

    return { success: true };
}

export async function updateRetention(pin: string, days: number) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    await db
        .update(settings)
        .set({ value: String(days) })
        .where(eq(settings.key, "retention_days"));

    revalidatePath("/admin");
    return { success: true };
}

export async function updateSetting(pin: string, key: string, value: string) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    // Upsert: try update first, insert if no rows affected
    const existing = await db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);

    if (existing.length > 0) {
        await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
        await db.insert(settings).values({ key, value });
    }

    revalidatePath("/admin");
    return { success: true };
}

// ─── Video Progress ────────────────────────────────────────────────

export async function saveVideoProgress(
    childId: number,
    videoId: number,
    progressSeconds: number
) {
    // Upsert: check if row exists
    const [existing] = await db
        .select()
        .from(videoProgress)
        .where(
            and(
                eq(videoProgress.childId, childId),
                eq(videoProgress.videoId, videoId)
            )
        )
        .limit(1);

    if (existing) {
        await db
            .update(videoProgress)
            .set({ progressSeconds, updatedAt: new Date() })
            .where(eq(videoProgress.id, existing.id));
    } else {
        await db.insert(videoProgress).values({
            childId,
            videoId,
            progressSeconds,
            updatedAt: new Date(),
        });
    }
}

export async function getVideoProgressMap(childId: number) {
    const rows = await db
        .select()
        .from(videoProgress)
        .where(eq(videoProgress.childId, childId));
    const map: Record<number, number> = {};
    for (const row of rows) {
        map[row.videoId] = row.progressSeconds;
    }
    return map;
}

// ─── Avatar Photo Upload ───────────────────────────────────────────

export async function uploadAvatarPhoto(
    pin: string,
    childId: number,
    formData: FormData
) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    const file = formData.get("photo") as File;
    if (!file) return { success: false, error: "No file uploaded" };

    const avatarsDir = path.join(process.cwd(), "media", "avatars");
    if (!fs.existsSync(avatarsDir)) {
        fs.mkdirSync(avatarsDir, { recursive: true });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `avatar_${childId}_${Date.now()}.${ext}`;
    const filePath = path.join(avatarsDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    await db
        .update(children)
        .set({
            avatarType: "photo",
            avatarPhoto: `avatars/${filename}`,
        })
        .where(eq(children.id, childId));

    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true, filename: `avatars/${filename}` };
}

// ─── Data Fetchers ─────────────────────────────────────────────────

export async function getChildren() {
    return db.select().from(children);
}

export async function getVideos() {
    return db.select().from(videos);
}

export async function getSettings() {
    const rows = await db.select().from(settings);
    const map: Record<string, string> = {};
    for (const row of rows) {
        map[row.key] = row.value;
    }
    return map;
}

export async function getChildSessions(childId: number) {
    return db
        .select()
        .from(sessions)
        .where(and(eq(sessions.childId, childId), eq(sessions.active, true)));
}

// ─── Subtitle Upload ────────────────────────────────────────────────

export async function uploadSubtitle(pin: string, videoId: number, formData: FormData) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "No file uploaded" };

    const ext = path.extname(file.name).toLowerCase();
    if (ext !== ".srt" && ext !== ".vtt") {
        return { success: false, error: "Invalid file type. Only .srt or .vtt allowed." };
    }

    const subtitlesDir = path.join(process.cwd(), "media", "subtitles");
    if (!fs.existsSync(subtitlesDir)) {
        fs.mkdirSync(subtitlesDir, { recursive: true });
    }

    const timestamp = Date.now();
    const basename = `sub_${videoId}_${timestamp}`;
    const originalFilename = `${basename}${ext}`;
    const originalPath = path.join(subtitlesDir, originalFilename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(originalPath, buffer);

    let finalFilename = originalFilename;

    // Convert SRT to VTT if needed
    if (ext === ".srt") {
        const vttFilename = `${basename}.vtt`;
        const vttPath = path.join(subtitlesDir, vttFilename);

        try {
            const { spawn } = await import("child_process");
            await new Promise<void>((resolve, reject) => {
                const ffmpeg = spawn("ffmpeg", ["-i", originalPath, vttPath]);
                ffmpeg.on("close", (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`FFmpeg exited with code ${code}`));
                });
                ffmpeg.on("error", (err) => reject(err));
            });
            finalFilename = vttFilename;
        } catch (error) {
            console.error("Subtitle conversion error:", error);
            return { success: false, error: "Failed to convert SRT to VTT" };
        }
    }

    // Update DB
    await db
        .update(videos)
        .set({ subtitlePath: `subtitles/${finalFilename}` })
        .where(eq(videos.id, videoId));

    revalidatePath("/admin");
    revalidatePath("/child");
    return { success: true };
}


