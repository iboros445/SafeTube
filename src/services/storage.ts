import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

const MEDIA_DIR = path.join(process.cwd(), "media");

export async function deleteMediaFile(filename: string | null): Promise<void> {
    if (!filename) return;
    const filePath = path.join(MEDIA_DIR, filename);
    try {
        await fsPromises.unlink(filePath);
    } catch (err) {
        // Ignore if file doesn't exist
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
            console.error(`Failed to delete media file ${filename}:`, err);
        }
    }
}

export function getMediaFilePath(filename: string): string {
    return path.join(MEDIA_DIR, filename);
}

export async function fileExists(filename: string): Promise<boolean> {
    const filePath = path.join(MEDIA_DIR, filename);
    try {
        await fsPromises.access(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function saveAvatar(childId: number, file: File): Promise<string> {
    const avatarsDir = path.join(MEDIA_DIR, "avatars");
    if (!fs.existsSync(avatarsDir)) {
        await fsPromises.mkdir(avatarsDir, { recursive: true });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `avatar_${childId}_${Date.now()}.${ext}`;
    const filePath = path.join(avatarsDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fsPromises.writeFile(filePath, buffer);

    return `avatars/${filename}`;
}

export async function saveSubtitle(videoId: number, file: File): Promise<{ filename: string; error?: string }> {
    const ext = path.extname(file.name).toLowerCase();
    if (ext !== ".srt" && ext !== ".vtt") {
        return { filename: "", error: "Invalid file type. Only .srt or .vtt allowed." };
    }

    const subtitlesDir = path.join(MEDIA_DIR, "subtitles");
    if (!fs.existsSync(subtitlesDir)) {
        await fsPromises.mkdir(subtitlesDir, { recursive: true });
    }

    const timestamp = Date.now();
    const basename = `sub_${videoId}_${timestamp}`;
    const originalFilename = `${basename}${ext}`;
    const originalPath = path.join(subtitlesDir, originalFilename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fsPromises.writeFile(originalPath, buffer);

    let finalFilename = originalFilename;

    // Convert SRT to VTT if needed
    if (ext === ".srt") {
        const vttFilename = `${basename}.vtt`;
        const vttPath = path.join(subtitlesDir, vttFilename);

        try {
            const { spawn } = await import("child_process");
            await new Promise<void>((resolve, reject) => {
                const ffmpeg = spawn("ffmpeg", ["-i", originalPath, vttPath]);
                ffmpeg.on("close", (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`FFmpeg exited with code ${code}`));
                });
                ffmpeg.on("error", (err) => reject(err));
            });
            finalFilename = vttFilename;
        } catch (error) {
            console.error("Subtitle conversion error:", error);
            // Fallback to original if conversion fails, though UI might prefer VTT
            return { filename: "", error: "Failed to convert SRT to VTT" };
        }
    }

    return { filename: `subtitles/${finalFilename}` };
}
