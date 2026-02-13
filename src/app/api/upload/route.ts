import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { videos } from "@/src/db/schema";
import { validateAdminPin } from "@/src/lib/auth";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const pin = formData.get("pin") as string;
        const file = formData.get("file") as File;
        const title = formData.get("title") as string;

        if (!pin || !await validateAdminPin(pin)) {
            return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
        }

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file type
        const validTypes = ["video/mp4", "video/x-matroska", "video/webm"];
        const ext = path.extname(file.name).toLowerCase();
        const validExts = [".mp4", ".mkv", ".webm"];

        if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
            return NextResponse.json({ error: "Invalid file type. Only MP4, MKV, WEBM allowed." }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const safeTitle = (title || file.name)
            .replace(/[^a-zA-Z0-9\s\-_]/g, "")
            .replace(/\s+/g, "_")
            .substring(0, 80);

        const filename = `${safeTitle}_${timestamp}${ext}`;
        const mediaDir = path.join(process.cwd(), "media");

        if (!fs.existsSync(mediaDir)) {
            fs.mkdirSync(mediaDir, { recursive: true });
        }

        const filePath = path.join(mediaDir, filename);
        fs.writeFileSync(filePath, buffer);

        // Generate thumbnail
        const thumbnailFilename = `${safeTitle}_${timestamp}.jpg`;
        const thumbnailPath = path.join(mediaDir, thumbnailFilename);

        const ffmpegPromise = new Promise<void>((resolve) => {
            const ffmpeg = spawn("ffmpeg", [
                "-i", filePath,
                "-ss", "00:00:05",
                "-vframes", "1",
                "-q:v", "2",
                thumbnailPath
            ]);

            ffmpeg.on("close", (code) => {
                if (code === 0) resolve();
                else {
                    // Try again at 0s if 5s failed
                    const retry = spawn("ffmpeg", [
                        "-i", filePath,
                        "-ss", "00:00:00",
                        "-vframes", "1",
                        "-q:v", "2",
                        thumbnailPath
                    ]);
                    retry.on("close", () => resolve());
                }
            });

            ffmpeg.on("error", (err) => {
                console.error("FFmpeg error:", err);
                resolve();
            });
        });

        await ffmpegPromise;

        // Insert into DB
        await db.insert(videos).values({
            title: title || file.name,
            localPath: filename,
            thumbnailPath: fs.existsSync(thumbnailPath) ? thumbnailFilename : null,
            durationSeconds: 0,
            createdAt: new Date(),
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
