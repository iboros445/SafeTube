import { db } from "@/src/db";
import { sessions, children } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE = "safetube_session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function createSession(childId: number): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

    // Invalidate any existing active sessions for this child
    await db
        .update(sessions)
        .set({ active: false })
        .where(and(eq(sessions.childId, childId), eq(sessions.active, true)));

    // Create new session
    await db.insert(sessions).values({
        id,
        childId,
        createdAt: now,
        expiresAt,
        active: true,
    });

    // Set HttpOnly cookie — the child cannot access or delete this via JS
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, id, {
        httpOnly: true,
        secure: false, // local-only, no HTTPS needed
        sameSite: "strict",
        path: "/",
        maxAge: SESSION_DURATION_MS / 1000,
    });

    return id;
}

export async function getActiveSession() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sessionId) return null;

    const [session] = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.id, sessionId), eq(sessions.active, true)))
        .limit(1);

    if (!session) return null;

    // Check expiry
    if (new Date() > session.expiresAt) {
        await db
            .update(sessions)
            .set({ active: false })
            .where(eq(sessions.id, sessionId));
        return null;
    }

    // Get child data
    const [child] = await db
        .select()
        .from(children)
        .where(eq(children.id, session.childId))
        .limit(1);

    if (!child) return null;

    return { session, child };
}

export async function endSession(childId: number) {
    await db
        .update(sessions)
        .set({ active: false })
        .where(and(eq(sessions.childId, childId), eq(sessions.active, true)));
}

export async function clearSessionCookie() {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
}

export async function validateAdminPin(pin: string): Promise<boolean> {
    const { settings } = await import("@/src/db/schema");
    const [setting] = await db
        .select()
        .from(settings)
        .where(eq(settings.key, "admin_pin"))
        .limit(1);
    return setting?.value === pin;
}
