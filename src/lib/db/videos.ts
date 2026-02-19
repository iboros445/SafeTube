import { db, dbReady } from "@/src/db";
import { videos, videoProgress } from "@/src/db/schema";
import { eq, desc, and } from "drizzle-orm";
import type { Video, NewVideo } from "@/src/db/schema";

export async function getVideo(id: number): Promise<Video | undefined> {
    await dbReady;
    const [video] = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
    return video;
}

export async function getVideoByUrl(url: string): Promise<Video | undefined> {
    await dbReady;
    const [video] = await db.select().from(videos).where(eq(videos.youtubeUrl, url)).limit(1);
    return video;
}

export async function getAllVideos(): Promise<Video[]> {
    await dbReady;
    return db.select().from(videos).orderBy(desc(videos.createdAt));
}

export async function createVideo(data: NewVideo): Promise<number> {
    await dbReady;
    const [newVideo] = await db.insert(videos).values(data).returning({ id: videos.id });
    // Fallback for drivers that don't support returning if needed, but modern drizzle-sqlite usually does
    // If not using returning:
    if (!newVideo) {
         const [v] = await db.select().from(videos).orderBy(desc(videos.id)).limit(1);
         return v.id;
    }
    return newVideo.id;
}

export async function updateVideo(id: number, data: Partial<NewVideo>): Promise<void> {
    await dbReady;
    await db.update(videos).set(data).where(eq(videos.id, id));
}

export async function deleteVideo(id: number): Promise<void> {
    await dbReady;
    await db.delete(videos).where(eq(videos.id, id));
}

export async function deleteVideoProgress(videoId: number): Promise<void> {
    await dbReady;
    await db.delete(videoProgress).where(eq(videoProgress.videoId, videoId));
}

// Progress helpers
export async function saveVideoProgress(childId: number, videoId: number, progressSeconds: number): Promise<void> {
    await dbReady;
    const now = new Date();
    
    // Upsert progress
    const [existing] = await db.select()
        .from(videoProgress)
        .where(and(eq(videoProgress.childId, childId), eq(videoProgress.videoId, videoId)))
        .limit(1);

    if (existing) {
        await db.update(videoProgress)
            .set({ progressSeconds, updatedAt: now })
            .where(eq(videoProgress.id, existing.id));
    } else {
        await db.insert(videoProgress).values({
            childId,
            videoId,
            progressSeconds,
            updatedAt: now,
        });
    }
}

export async function getVideoProgressMap(childId: number): Promise<Record<number, number>> {
    await dbReady;
    const rows = await db.select().from(videoProgress).where(eq(videoProgress.childId, childId));
    const map: Record<number, number> = {};
    for (const row of rows) {
        map[row.videoId] = row.progressSeconds;
    }
    return map;
}

export async function getChildWatchHistory(childId: number) {
    await dbReady;
    return db
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
}
