"use server";

import { revalidatePath } from "next/cache";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

// Auth
import {
    createSession,
    endSession,
    validateAdminPin,
    clearSessionCookie,
    clearAdminSession,
} from "@/src/lib/auth";

// DB Access
import * as SettingsDB from "@/src/lib/db/settings";
import * as ChildrenDB from "@/src/lib/db/children";
import * as VideosDB from "@/src/lib/db/videos";

// Services
import { downloadVideo, listPlaylistVideos, searchYouTube } from "@/src/lib/video-downloader";
import { addToQueue } from "@/src/lib/channel-worker";
import {
    fetchVideoMetadata,
    fetchAutoSubtitles,
    analyzeVideo,
} from "@/src/lib/analysis-service";
import { getAIConfig, isAIEnabled } from "@/src/lib/ai-actions";
import { deleteMediaFile, saveAvatar, saveSubtitle } from "@/src/services/storage";

// Types
import type { PlaylistEntry, SearchResult, AnalysisResult } from "@/src/types";

// ─── Child Session Actions ─────────────────────────────────────────

export async function loginChild(childId: number) {
    const child = await ChildrenDB.getChild(childId);
    if (!child) throw new Error("Child not found");

    // Auto-reset if new day
    const today = new Date().toISOString().split("T")[0];
    if (child.lastResetDate !== today) {
        await ChildrenDB.updateChild(child.id, {
            currentUsageSeconds: 0,
            lastResetDate: today
        });
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

    const newChildId = await ChildrenDB.createChild({
        name,
        avatarColor,
        avatarType,
        avatarEmoji: avatarEmoji || null,
        theme,
        dailyLimitSeconds: dailyLimitMinutes * 60,
    });

    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true, childId: newChildId };
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

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.avatarColor) updateData.avatarColor = data.avatarColor;
    if (data.avatarType) updateData.avatarType = data.avatarType;
    if (data.avatarEmoji !== undefined) updateData.avatarEmoji = data.avatarEmoji || null;
    if (data.avatarPhoto !== undefined) updateData.avatarPhoto = data.avatarPhoto || null;
    if (data.theme) updateData.theme = data.theme;
    if (data.dailyLimitMinutes !== undefined)
        updateData.dailyLimitSeconds = data.dailyLimitMinutes * 60;

    await ChildrenDB.updateChild(childId, updateData);

    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true };
}

export async function deleteChild(pin: string, childId: number) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    await ChildrenDB.deleteChild(childId);
    revalidatePath("/admin");
    return { success: true };
}

export async function resetChildTime(pin: string, childId: number) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    await ChildrenDB.updateChild(childId, { currentUsageSeconds: 0 });

    revalidatePath("/admin");
    return { success: true };
}

export async function endChildSession(pin: string, childId: number) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    await ChildrenDB.endSessionForChild(childId);
    await endSession(childId); // Also clear server-side session cookies if applicable
    revalidatePath("/admin");
    return { success: true };
}

export async function punishChild(pin: string, childId: number) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    const child = await ChildrenDB.getChild(childId);
    if (!child) return { success: false, error: "Child not found" };

    await ChildrenDB.updateChild(childId, { currentUsageSeconds: child.dailyLimitSeconds });
    await endSession(childId);

    console.log(`[Punish] Child ${childId} punished. Usage set to ${child.dailyLimitSeconds}, session ended.`);
    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true };
}



export async function getAdminTheme() {
    return (await SettingsDB.getSetting("admin_theme")) || "dark";
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
    const autoAnalysis = (await SettingsDB.getSetting("ai_auto_analysis")) || "";

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

    // Standard download flow (no AI)
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

    await VideosDB.createVideo({
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
    const video = await VideosDB.getVideo(videoId);
    
    if (!video) {
        console.log(`[Delete] Video not found in DB`);
        return { success: false, error: "Video not found" };
    }
    console.log(`[Delete] Video found: ${video.title} (${video.localPath})`);

    // Delete files from disk async
    console.log(`[Delete] Starting file deletion...`);
    try {
        const tasks = [];
        if (video.localPath) tasks.push(deleteMediaFile(video.localPath));
        if (video.thumbnailPath) tasks.push(deleteMediaFile(video.thumbnailPath));
        if (video.subtitlePath) tasks.push(deleteMediaFile(video.subtitlePath));
        
        await Promise.allSettled(tasks);
        console.log(`[Delete] Files deleted (or attemped)`);
    } catch (e) {
        console.error("[Delete] Error deleting files:", e);
    }

    console.log(`[Delete] Deleting from DB...`);
    await VideosDB.deleteVideo(videoId);
    // Also delete progress
    await VideosDB.deleteVideoProgress(videoId);
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

// ─── Settings ──────────────────────────────────────────────────────

export async function updatePin(currentPin: string, newPin: string) {
    const valid = await validateAdminPin(currentPin);
    if (!valid) return { success: false, error: "Invalid current PIN" };

    await SettingsDB.setSetting("admin_pin", newPin);
    return { success: true };
}

export async function updateRetention(pin: string, days: number) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    await SettingsDB.setSetting("retention_days", String(days));

    revalidatePath("/admin");
    return { success: true };
}

export async function updateSetting(pin: string, key: string, value: string) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    // Side effect: Write cookies to file if key is youtube_cookies
    if (key === "youtube_cookies") {
        const cookiePath = path.join(process.cwd(), "cookies.txt");
        if (!value.trim()) {
            if (fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath);
        } else {
            fs.writeFileSync(cookiePath, value);
        }
    }

    await SettingsDB.setSetting(key, value);

    revalidatePath("/admin");
    return { success: true };
}

// ─── Video Progress ────────────────────────────────────────────────

export async function saveVideoProgress(
    childId: number,
    videoId: number,
    progressSeconds: number
) {
    await VideosDB.saveVideoProgress(childId, videoId, progressSeconds);
}

export async function getVideoProgressMap(childId: number) {
    return VideosDB.getVideoProgressMap(childId);
}

// ─── Child Watch History (Admin) ────────────────────────────────────

export async function getChildWatchHistory(childId: number) {
    return VideosDB.getChildWatchHistory(childId);
}

export async function updateVideoProgressAdmin(
    pin: string,
    childId: number,
    videoId: number,
    newProgressSeconds: number
) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    await VideosDB.saveVideoProgress(childId, videoId, Math.max(0, Math.round(newProgressSeconds)));
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

    const filename = await saveAvatar(childId, file);

    await ChildrenDB.updateChild(childId, {
        avatarType: "photo",
        avatarPhoto: filename,
    });

    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true, filename };
}

// ─── Data Fetchers ─────────────────────────────────────────────────

export async function getChildren() {
    return ChildrenDB.getAllChildren();
}

export async function getVideos() {
    return VideosDB.getAllVideos();
}

export async function getSettings() {
    const map = await SettingsDB.getSettingsMap();
    // Convert Map to Record
    return Object.fromEntries(map);
}

export async function getChildSessions(childId: number) {
    return ChildrenDB.getChildSessions(childId);
}

// ─── Subtitle Upload ────────────────────────────────────────────────

export async function uploadSubtitle(pin: string, videoId: number, formData: FormData) {
    const valid = await validateAdminPin(pin);
    if (!valid) return { success: false, error: "Invalid PIN" };

    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "No file uploaded" };

    const { filename, error } = await saveSubtitle(videoId, file);
    
    if (error || !filename) {
        return { success: false, error: error || "Failed to save subtitle" };
    }

    // Update DB
    await VideosDB.updateVideo(videoId, { subtitlePath: filename });

    revalidatePath("/admin");
    revalidatePath("/child");
    return { success: true };
}


