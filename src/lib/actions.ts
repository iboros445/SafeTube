"use server";

import { db, dbReady } from "@/src/db";
import { children, videos, sessions, settings, videoProgress } from "@/src/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import {
    createSession,
    endSession,
    validateAdminPin,
    clearSessionCookie,
    clearAdminSession,
} from "@/src/lib/auth";
import { downloadVideo, listPlaylistVideos, searchYouTube, type PlaylistEntry, type SearchResult } from "@/src/lib/video-downloader";
import { addToQueue } from "@/src/lib/channel-worker";
import {
    fetchVideoMetadata,
    fetchAutoSubtitles,
    analyzeVideo,
    type AnalysisResult,
} from "@/src/lib/analysis-service";
import { getAIConfig, isAIEnabled } from "@/src/lib/ai-actions";
import { revalidatePath } from "next/cache";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

// ─── Ensure DB is ready before any action ─────────────────────────

async function ensureDb() {
    await dbReady;
}

async function getSettingValue(key: string): Promise<string> {
    await ensureDb();
    const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return row?.value ?? "";
}

// ─── Child Session Actions ─────────────────────────────────────────

export async function loginChild(childId: number) {
    await ensureDb();
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

export async function adminLogout() {
    await clearAdminSession();
    revalidatePath("/admin");
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

    // Check if AI auto-analysis is enabled
    const aiEnabled = await isAIEnabled();
    const autoAnalysis = await getSettingValue("ai_auto_analysis");

    if (aiEnabled && autoAnalysis === "true") {
        // AI Analysis Flow: fetch metadata + subtitles, analyze, return for review
        try {
            const config = await getAIConfig();
            if (!config) {
                return { success: false, error: "AI is enabled but no valid config found" };
            }

            const metadata = await fetchVideoMetadata(url);
            const subtitleText = await fetchAutoSubtitles(url);
            const analysis = await analyzeVideo(metadata, subtitleText, config);

            return {
                success: true,
                pendingReview: true,
                title: metadata.title,
                url,
                analysis,
            };
        } catch (err) {
            return { success: false, error: `AI analysis failed: ${(err as Error).message}` };
        }
    }

    // Standard download flow (no AI) — delegate to queue worker so
    // the server action returns immediately and doesn't block other actions
    // (e.g. deleteVideo) due to Next.js per-client action serialization.
    addToQueue([{ url, title: url }]);
    return { success: true, queued: true };
}

// ─── AI Video Review Actions ───────────────────────────────────────

export async function approveAndDownload(
    pin: string,
    url: string,
    analysis: AnalysisResult
) {
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
        aiScore: analysis.safetyScore,
        educationalValue: analysis.educationalValue,
        pacing: analysis.pacing,
        educationalTags: JSON.stringify(analysis.tags),
        isApproved: true,
    });

    revalidatePath("/admin");
    revalidatePath("/child");
    return { success: true, title: result.title };
}

export async function dismissVideo(pin: string, url: string) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };
    // Simply don't download — no DB record needed
    return { success: true };
}

// ─── Playlist Listing (Server Action) ─────────────────────────────

export async function listPlaylistAction(
    url: string,
    limit?: number
): Promise<PlaylistEntry[]> {
    return listPlaylistVideos(url, limit);
}

// ─── YouTube Search (Server Action) ──────────────────────────────

export async function searchYouTubeAction(
    query: string,
    count?: number
): Promise<SearchResult[]> {
    return searchYouTube(query, count);
}

export async function deleteVideo(pin: string, videoId: number) {
    console.log(`[Delete] req videoId=${videoId}`);
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    console.log(`[Delete] PIN valid, fetching video from DB...`);
    const [video] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);
    
    if (!video) {
        console.log(`[Delete] Video not found in DB`);
        return { success: false, error: "Video not found" };
    }
    console.log(`[Delete] Video found: ${video.title} (${video.localPath})`);

    // Delete files from disk async
    const mediaDir = path.join(process.cwd(), "media");
    const videoPath = path.join(mediaDir, video.localPath);
    const thumbPath = video.thumbnailPath
        ? path.join(mediaDir, video.thumbnailPath)
        : null;
    const subtitlePath = video.subtitlePath
        ? path.join(mediaDir, video.subtitlePath)
        : null;

    console.log(`[Delete] Starting file deletion...`);
    try {
        const tasks = [];
        if (fs.existsSync(videoPath)) tasks.push(fsPromises.unlink(videoPath));
        if (thumbPath && fs.existsSync(thumbPath)) tasks.push(fsPromises.unlink(thumbPath));
        if (subtitlePath && fs.existsSync(subtitlePath)) tasks.push(fsPromises.unlink(subtitlePath));
        
        await Promise.allSettled(tasks);
        console.log(`[Delete] Files deleted (or attemped)`);
    } catch (e) {
        console.error("[Delete] Error deleting files:", e);
    }

    console.log(`[Delete] Deleting from DB...`);
    await db.delete(videos).where(eq(videos.id, videoId));
    console.log(`[Delete] DB deleted. Revalidating paths...`);
    
    revalidatePath("/admin");
    revalidatePath("/child");
    
    console.log(`[Delete] Done success`);
    return { success: true };
}

export async function bulkDeleteVideos(pin: string, videoIds: number[]) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    const results = await Promise.allSettled(videoIds.map(id => deleteVideo(pin, id)));
    const failures = results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success));
    
    if (failures.length > 0) {
        return { success: false, error: `Failed to delete ${failures.length} videos` };
    }

    revalidatePath("/admin");
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

// ─── Child Watch History (Admin) ────────────────────────────────────

export async function getChildWatchHistory(childId: number) {
    const rows = await db
        .select({
            progressId: videoProgress.id,
            videoId: videoProgress.videoId,
            progressSeconds: videoProgress.progressSeconds,
            updatedAt: videoProgress.updatedAt,
            title: videos.title,
            thumbnailPath: videos.thumbnailPath,
            durationSeconds: videos.durationSeconds,
        })
        .from(videoProgress)
        .innerJoin(videos, eq(videoProgress.videoId, videos.id))
        .where(eq(videoProgress.childId, childId))
        .orderBy(desc(videoProgress.updatedAt));

    return rows;
}

export async function updateVideoProgressAdmin(
    pin: string,
    childId: number,
    videoId: number,
    newProgressSeconds: number
) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    await saveVideoProgress(childId, videoId, Math.max(0, Math.round(newProgressSeconds)));
    revalidatePath("/admin");
    return { success: true };
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


