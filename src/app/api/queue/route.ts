import { NextResponse } from "next/server";
import {
    getQueueState,
    addToQueue,
    clearCompletedJobs,
} from "@/src/lib/channel-worker";
import { validateAdminPin } from "@/src/lib/auth";

export async function GET() {
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
    } catch (err) {
        return NextResponse.json(
            { error: (err as Error).message },
            { status: 500 }
        );
    }
}
