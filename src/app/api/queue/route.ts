import { NextResponse } from "next/server";
import {
    getQueueState,
    addToQueue,
    clearCompletedJobs,
} from "@/src/lib/channel-worker";
import { validateAdminPin, getAdminSession } from "@/src/lib/auth";

export async function GET() {
    // Auth check — only admins should see queue state
    const isAdmin = await getAdminSession();
    if (!isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const state = getQueueState();
    return NextResponse.json(state);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { pin, action, urls } = body;

        const valid = await validateAdminPin(pin);
        if (!valid) {
            return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
        }

        if (action === "add" && Array.isArray(urls)) {
            const ids = addToQueue(urls);
            return NextResponse.json({ success: true, ids });
        }

        if (action === "clear") {
            clearCompletedJobs();
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } catch {
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
