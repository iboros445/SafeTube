import { db, dbReady } from "@/src/db";
import { settings } from "@/src/db/schema";
import { eq } from "drizzle-orm";

export async function getSetting(key: string): Promise<string | null> {
    await dbReady;
    const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return row?.value ?? null;
}

export async function getSettingsMap(): Promise<Map<string, string>> {
    await dbReady;
    const rows = await db.select().from(settings);
    return new Map(rows.map((r) => [r.key, r.value]));
}

export async function setSetting(key: string, value: string): Promise<void> {
    await dbReady;
    const [existing] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    if (existing) {
        await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
        await db.insert(settings).values({ key, value });
    }
}

export async function deleteSetting(key: string): Promise<void> {
    await dbReady;
    await db.delete(settings).where(eq(settings.key, key));
}
