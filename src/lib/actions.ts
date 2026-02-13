"use server";

import { db } from "@/src/db";
import { children, videos, sessions, settings } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";
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
    avatarColor: string
) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    await db.insert(children).values({
        name,
        avatarColor,
        dailyLimitSeconds: dailyLimitMinutes * 60,
    });

    revalidatePath("/admin");
    return { success: true };
}

export async function updateChild(
    pin: string,
    childId: number,
    data: { name?: string; dailyLimitMinutes?: number; avatarColor?: string }
) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.avatarColor) updateData.avatarColor = data.avatarColor;
    if (data.dailyLimitMinutes !== undefined)
        updateData.dailyLimitSeconds = data.dailyLimitMinutes * 60;

    await db
        .update(children)
        .set(updateData)
        .where(eq(children.id, childId));

    revalidatePath("/admin");
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

    try {
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        if (thumbPath && fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
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
