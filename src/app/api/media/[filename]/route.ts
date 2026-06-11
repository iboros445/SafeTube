import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getActiveSession, getAdminSession } from "@/src/lib/auth";

const MEDIA_DIR = path.resolve(process.cwd(), "media");

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    // Auth check — require either a child session or admin session
    const [childSession, adminSession] = await Promise.all([
        getActiveSession(),
        getAdminSession(),
    ]);
    if (!childSession && !adminSession) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { filename } = await params;

    if (!filename || filename.includes("..")) {
        return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filePath = path.join(MEDIA_DIR, filename);

    // Path traversal protection — ensure resolved path is within MEDIA_DIR
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(MEDIA_DIR + path.sep) && resolved !== MEDIA_DIR) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    if (!fs.existsSync(resolved)) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const stat = fs.statSync(resolved);
    const ext = path.extname(filename).toLowerCase();

    const mimeTypes: Record<string, string> = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";
    const isVideo = ext === ".mp4" || ext === ".webm";
    const disposition = isVideo ? "inline" : "attachment";

    // Support range requests for video seeking
    const range = request.headers.get("range");

    if (range && isVideo) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        const stream = fs.createReadStream(resolved, { start, end });
        const chunks: Buffer[] = [];

        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
        }

        const buffer = Buffer.concat(chunks);

        return new NextResponse(buffer, {
            status: 206,
            headers: {
                "Content-Range": `bytes ${start}-${end}/${stat.size}`,
                "Accept-Ranges": "bytes",
                "Content-Length": String(chunkSize),
                "Content-Type": contentType,
                "Content-Disposition": `${disposition}; filename="${path.basename(resolved)}"`,
            },
        });
    }

    // Full file response
    const buffer = fs.readFileSync(resolved);

    return new NextResponse(buffer, {
        status: 200,
        headers: {
            "Content-Type": contentType,
            "Content-Length": String(stat.size),
            "Accept-Ranges": "bytes",
            "Content-Disposition": `${disposition}; filename="${path.basename(resolved)}"`,
        },
    });
}
