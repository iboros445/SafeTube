import { db, dbReady } from "@/src/db";
import { sessions, children } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";
import crypto from "crypto";
import * as SettingsDB from "@/src/lib/db/settings";

const SESSION_COOKIE = "safetube_session";
const ADMIN_SESSION_COOKIE = "safetube_admin_session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const ADMIN_SESSION_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

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
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: SESSION_DURATION_MS / 1000,
    });

    return id;
}

export async function createAdminSession() {
    await dbReady;
    const id = crypto.randomUUID();
    const expiresAt = Date.now() + ADMIN_SESSION_DURATION_MS;
    const cookieStore = await cookies();

    // Store session ID and expiration in the settings DB for server-side validation
    await SettingsDB.setSetting("admin_session_id", id);
    await SettingsDB.setSetting("admin_session_expires", String(expiresAt));

    cookieStore.set(ADMIN_SESSION_COOKIE, id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: ADMIN_SESSION_DURATION_MS / 1000,
    });
}

export async function getAdminSession(): Promise<boolean> {
    await dbReady;
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    if (!cookieValue) return false;

    // Validate cookie value against stored session ID
    const storedId = await SettingsDB.getSetting("admin_session_id");
    if (!storedId || storedId !== cookieValue) return false;

    // Check expiration
    const expiresStr = await SettingsDB.getSetting("admin_session_expires");
    if (!expiresStr || Date.now() > Number(expiresStr)) {
        // Session expired — clean up
        await clearAdminSession();
        return false;
    }

    return true;
}

export async function clearAdminSession() {
    await dbReady;
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_SESSION_COOKIE);
    // Clear from settings DB
    await SettingsDB.deleteSetting("admin_session_id");
    await SettingsDB.deleteSetting("admin_session_expires");
}

export async function getActiveSession() {
    await dbReady;
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

// NOTE: This in-memory rate limiter resets on server restart and is not shared
// across multiple server instances. This is acceptable for a single-instance
// local app, but would need a persistent store (e.g. Redis) for production.
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 5;
const ATTEMPTS_MAP = new Map<string, { count: number; firstAttempt: number }>();

/**
 * Returns true if the action is allowed, false if rate limited.
 * Only increments the counter if increment is true.
 */
function checkRateLimit(key: string, increment: boolean = true): boolean {
    const now = Date.now();
    const record = ATTEMPTS_MAP.get(key);

    if (!record) {
        if (increment) {
            ATTEMPTS_MAP.set(key, { count: 1, firstAttempt: now });
        }
        return true;
    }

    if (now - record.firstAttempt > RATE_LIMIT_WINDOW) {
        if (increment) {
            ATTEMPTS_MAP.set(key, { count: 1, firstAttempt: now });
        } else {
            ATTEMPTS_MAP.delete(key);
        }
        return true;
    }

    if (record.count >= MAX_ATTEMPTS) return false;

    if (increment) {
        record.count++;
    }
    return true;
}

// Scrypt helper
function hashPin(pin: string, salt: string): string {
    return crypto.scryptSync(pin, salt, 64).toString("hex");
}

export async function validateAdminPin(pin: string): Promise<boolean> {
    // 1. Check for valid session first
    if (await getAdminSession()) {
        return true;
    }

    // 2. If no PIN provided and no session, return false without incrementing rate limit
    if (!pin) return false;

    // 3. Check rate limit WITHOUT incrementing yet
    if (!checkRateLimit("global_admin_pin", false)) {
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

    let isValid = false;

    // Check if stored value is a hash (simple heuristic: contains :)
    if (setting.value.includes(":")) {
        const [salt, storedHash] = setting.value.split(":");
        const hash = hashPin(pin, salt);
        isValid = (hash === storedHash);
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
            isValid = true;
        }
    }

    if (isValid) {
        // Create session on success
        await createAdminSession();
        return true;
    } else {
        // INCREMENT rate limit ONLY on failure
        checkRateLimit("global_admin_pin", true);
        return false;
    }
}
