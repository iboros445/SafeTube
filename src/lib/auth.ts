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

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 5;
const ATTEMPTS_MAP = new Map<string, { count: number; firstAttempt: number }>();

function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const record = ATTEMPTS_MAP.get(key);

    if (!record) {
        ATTEMPTS_MAP.set(key, { count: 1, firstAttempt: now });
        return true;
    }

    if (now - record.firstAttempt > RATE_LIMIT_WINDOW) {
        ATTEMPTS_MAP.set(key, { count: 1, firstAttempt: now });
        return true;
    }

    if (record.count >= MAX_ATTEMPTS) return false;

    record.count++;
    return true;
}

// Scrypt helper
function hashPin(pin: string, salt: string): string {
    return crypto.scryptSync(pin, salt, 64).toString("hex");
}

export async function validateAdminPin(pin: string): Promise<boolean> {
    // Simple global rate limit for simplicity (or per-IP if we had request object here)
    // Since this is a server action called from client components, we don't always have IP easily without headers.
    // For a local app, global limit is safer/easier.
    if (!checkRateLimit("global_admin_pin")) {
        console.warn("Admin PIN rate limit exceeded");
        return false;
    }

    const { settings } = await import("@/src/db/schema");
    const [setting] = await db
        .select()
        .from(settings)
        .where(eq(settings.key, "admin_pin"))
        .limit(1);

    if (!setting?.value) return false;

    // Check if stored value is a hash (simple heuristic: contains :)
    if (setting.value.includes(":")) {
        const [salt, storedHash] = setting.value.split(":");
        const hash = hashPin(pin, salt);
        return hash === storedHash;
    } else {
        // Legacy plaintext check
        if (setting.value === pin) {
            // Upgrade to hash
            const salt = crypto.randomBytes(16).toString("hex");
            const hash = hashPin(pin, salt);
            await db
                .update(settings)
                .set({ value: `${salt}:${hash}` })
                .where(eq(settings.key, "admin_pin"));
            return true;
        }
        return false;
    }
}
