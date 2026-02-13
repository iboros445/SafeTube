import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { children, sessions } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";

const HEARTBEAT_INTERVAL = 5; // seconds

export async function POST(request: NextRequest) {
    try {
        const sessionId = request.cookies.get("safetube_session")?.value;

        if (!sessionId) {
            return NextResponse.json({ error: "No session" }, { status: 401 });
        }

        // Validate session
        const [session] = await db
            .select()
            .from(sessions)
            .where(and(eq(sessions.id, sessionId), eq(sessions.active, true)))
            .limit(1);

        if (!session) {
            return NextResponse.json({ error: "Invalid session" }, { status: 401 });
        }

        // Get child
        const [child] = await db
            .select()
            .from(children)
            .where(eq(children.id, session.childId))
            .limit(1);

        if (!child) {
            return NextResponse.json({ error: "Child not found" }, { status: 404 });
        }

        // Auto-reset usage if it's a new day
        const today = new Date().toISOString().split("T")[0];
        let currentUsage = child.currentUsageSeconds;

        if (child.lastResetDate !== today) {
            currentUsage = 0;
            await db
                .update(children)
                .set({ currentUsageSeconds: 0, lastResetDate: today })
                .where(eq(children.id, child.id));
        }

        // Check if limit exceeded
        if (currentUsage >= child.dailyLimitSeconds) {
            return NextResponse.json(
                {
                    error: "Time limit reached",
                    usage: currentUsage,
                    limit: child.dailyLimitSeconds,
                },
                { status: 403 }
            );
        }

        // Increment usage by heartbeat interval
        const newUsage = currentUsage + HEARTBEAT_INTERVAL;
        await db
            .update(children)
            .set({
                currentUsageSeconds: newUsage,
                lastHeartbeatAt: new Date(),
            })
            .where(eq(children.id, child.id));

        return NextResponse.json({
            ok: true,
            usage: newUsage,
            limit: child.dailyLimitSeconds,
            remaining: Math.max(0, child.dailyLimitSeconds - newUsage),
        });
    } catch (error) {
        console.error("Heartbeat error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
