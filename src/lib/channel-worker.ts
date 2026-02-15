import { downloadVideo } from "@/src/lib/video-downloader";
import { db, dbReady } from "@/src/db";
import { videos } from "@/src/db/schema";
import { revalidatePath } from "next/cache";

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

// ─── In-Memory Queue ─────────────────────────────────────────────────

const queue: QueueJob[] = [];
let isRunning = false;
const MAX_CONCURRENT = 2;
let activeCount = 0;

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
    isRunning = true;

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

    isRunning = false;
}

async function processJob(job: QueueJob) {
    try {
        await dbReady;
        const result = await downloadVideo(job.url);

        if (!result.success) {
            job.status = "error";
            job.error = result.error || "Download failed";
            return;
        }

        await db.insert(videos).values({
            title: result.title!,
            youtubeUrl: job.url,
            localPath: result.filename!,
            thumbnailPath: result.thumbnailFilename || null,
            durationSeconds: result.duration || null,
            createdAt: new Date(),
        });

        job.status = "done";
        job.title = result.title || job.title;

        // Trigger revalidation
        try { revalidatePath("/admin"); } catch { /* ignore in non-request context */ }
        try { revalidatePath("/child"); } catch { /* ignore */ }
    } catch (err) {
        job.status = "error";
        job.error = (err as Error).message;
    }
}
