import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const MEDIA_DIR = path.join(process.cwd(), "media");

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filepath: string[] }> }
) {
    const { filepath } = await params;
    const filename = filepath.join("/");

    if (!filename || filename.includes("..")) {
        return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filePath = path.join(MEDIA_DIR, filename);

    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const stat = fs.statSync(filePath);
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

    // Support range requests for video seeking
    const range = request.headers.get("range");

    if (range && ext === ".mp4") {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        const stream = fs.createReadStream(filePath, { start, end });
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
            },
        });
    }

    // Full file response
    const buffer = fs.readFileSync(filePath);

    return new NextResponse(buffer, {
        status: 200,
        headers: {
            "Content-Type": contentType,
            "Content-Length": String(stat.size),
            "Accept-Ranges": "bytes",
        },
    });
}
