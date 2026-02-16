import { downloadVideo } from "@/src/lib/video-downloader";
import { db, dbReady } from "@/src/db";
import { videos, settings } from "@/src/db/schema";
import { revalidatePath } from "next/cache";
import { fetchVideoMetadata } from "@/src/lib/analysis-service";
import { eq } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────

export interface QueueJob {
    id: string;
    url: string;
    title: string;
    status: "pending" | "downloading" | "done" | "error";
    error?: string;
    progress?: number;
}

export interface QueueState {
    jobs: QueueJob[];
    isRunning: boolean;
    concurrency: number;
}

// ─── In-Memory Queue (Singleton) ──────────────────────────────────────

const globalForQueue = globalThis as unknown as {
    safeTubeQueue: QueueJob[];
    safeTubeIsRunning: boolean;
};

const queue = globalForQueue.safeTubeQueue || [];
if (process.env.NODE_ENV !== "production") globalForQueue.safeTubeQueue = queue;

let isRunning = globalForQueue.safeTubeIsRunning || false;
const MAX_CONCURRENT = 2;
let activeCount = 0; // functional active count, reset on module load but queue persists

// Update global state when isRunning changes
function setRunning(value: boolean) {
    isRunning = value;
    if (process.env.NODE_ENV !== "production") globalForQueue.safeTubeIsRunning = value;
}

export function getQueueState(): QueueState {
    return {
        jobs: [...queue],
        isRunning,
        concurrency: MAX_CONCURRENT,
    };
}

export function addToQueue(urls: Array<{ url: string; title: string }>): string[] {
    const ids: string[] = [];
    for (const { url, title } of urls) {
        // Skip duplicates
        if (queue.some((j) => j.url === url && j.status !== "error")) continue;
        const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        queue.push({ id, url, title, status: "pending" });
        ids.push(id);
    }

    // Start processing if not already running
    if (!isRunning) {
        processQueue();
    }

    return ids;
}

export function clearCompletedJobs() {
    const remaining = queue.filter(
        (j) => j.status === "pending" || j.status === "downloading"
    );
    queue.length = 0;
    queue.push(...remaining);
}

// ─── Queue Processor ─────────────────────────────────────────────────

async function processQueue() {
    setRunning(true);

    while (true) {
        // Find next pending job
        const nextJob = queue.find(
            (j) => j.status === "pending" && activeCount < MAX_CONCURRENT
        );

        if (!nextJob) {
            // No more pending jobs or at max concurrency
            if (activeCount === 0) break;
            // Wait for active downloads
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
        }

        activeCount++;
        nextJob.status = "downloading";

        // Process asynchronously
        processJob(nextJob).finally(() => {
            activeCount--;
        });

        // Brief delay between launches to avoid hammering YouTube
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setRunning(false);
}

async function processJob(job: QueueJob) {
    try {
        console.log(`[Worker] Starting job: ${job.url}`);
        await dbReady;
        console.log(`[Worker] DB Ready, checking for duplicates...`);
        
        // check for existing video with same URL
        const existing = await db.query.videos.findFirst({
            where: (videos, { eq }) => eq(videos.youtubeUrl, job.url),
        });

        if (existing) {
             console.log(`[Worker] Video already exists: ${existing.title} (ID: ${existing.id})`);
             job.status = "error";
             job.error = "Video already exists in library";
             return;
        }

        console.log(`[Worker] No duplicate URL found, fetching metadata for strict check...`);
        
        try {
            // Get metadata without downloading
            const metadata = await fetchVideoMetadata(job.url);
            
            // Check if title + duration match any existing video
            if (metadata.title && metadata.duration) {
                const existingMeta = await db.query.videos.findFirst({
                    where: (videos, { and, eq, like }) => and(
                        eq(videos.durationSeconds, metadata.duration!),
                        // Use strict equality for title to avoid false positives on similar series
                        eq(videos.title, metadata.title)
                    ),
                });

                if (existingMeta) {
                    console.log(`[Worker] Duplicate content found (matched title+duration): ${existingMeta.title}`);
                    job.status = "error";
                    job.error = "Video already exists (matched title & duration)";
                    return;
                }
            }

            // Update title from metadata for better UI
            job.title = metadata.title;
            
        } catch (err) {
            console.warn(`[Worker] Failed to fetch metadata for dup check, proceeding anyway: ${(err as Error).message}`);
        }

        console.log(`[Worker] Deduplication passed, starting download...`);
        const result = await downloadVideo(job.url, (p) => {
            if (p.percent) job.progress = p.percent;
        });

        if (!result.success) {
            job.status = "error";
            job.error = result.error || "Download failed";
            return;
        }

        // Save to DB
        const finalUrl = result.resolvedUrl || job.url;
        await db.insert(videos).values({
            title: result.title!,
            youtubeUrl: finalUrl,
            localPath: result.filename!,
            thumbnailPath: result.thumbnailFilename || null,
            durationSeconds: result.duration || null,
            createdAt: new Date(),
        });

        // Post-download: AI Analysis (if enabled)
        try {
            // Check if auto-analysis is enabled
            const settingsRows = await db.select().from(settings);
            const settingMap = new Map(settingsRows.map(s => [s.key, s.value]));
            const autoAnalysis = settingMap.get("ai_auto_analysis") === "true";

            if (autoAnalysis) {
                console.log(`[Worker] 🤖 Starting auto-analysis for: ${result.title}`);
                const { getAIConfig } = await import("@/src/lib/ai-actions");
                const { analyzeVideo, fetchVideoMetadata, fetchAutoSubtitles } = await import("@/src/lib/analysis-service");
                
                const config = await getAIConfig();
                if (config) {
                    // Use finalUrl to ensure we get the right video info
                    const metadata = await fetchVideoMetadata(finalUrl);
                    const subtitleText = await fetchAutoSubtitles(finalUrl);
                    
                    console.log(`[Worker] 🤖 Sending to AI (${config.provider})...`);
                    const analysis = await analyzeVideo(metadata, subtitleText, config);
                    
                    const videoRecord = await db.query.videos.findFirst({
                         where: (videos, { eq }) => eq(videos.youtubeUrl, finalUrl)
                    });

                    if (videoRecord) {
                         await db.update(videos).set({
                             aiScore: analysis.safetyScore,
                             educationalValue: analysis.educationalValue,
                             pacing: analysis.pacing,
                             educationalTags: JSON.stringify(analysis.tags),
                         }).where(eq(videos.id, videoRecord.id));
                         console.log(`[Worker] ✨ AI Analysis saved for ${videoRecord.title}`);
                    }
                }
            }
        } catch (err) {
            console.error(`[Worker] ❌ Auto-analysis failed: ${(err as Error).message}`);
        }

        job.status = "done";
        job.title = result.title || job.title;
        console.log(`[Worker] Job done: ${job.url} (Resolved: ${finalUrl})`);

        // Trigger revalidation
        try { revalidatePath("/admin"); } catch { /* ignore in non-request context */ }
        try { revalidatePath("/child"); } catch { /* ignore */ }
    } catch (err) {
        job.status = "error";
        job.error = (err as Error).message;
    }
}
