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

/** Allowed image extensions for avatar uploads */
const AVATAR_ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

/**
 * Asserts that `filePath` resolves to a location inside `directory`.
 * Throws if a path-traversal attempt is detected.
 */
function assertWithinDirectory(directory: string, filePath: string): void {
    const resolvedDir = path.resolve(directory) + path.sep;
    const resolvedFile = path.resolve(filePath);
    if (!resolvedFile.startsWith(resolvedDir)) {
        throw new Error("Path traversal detected: file path escapes target directory");
    }
}

export async function saveAvatar(childId: number, file: File): Promise<string> {
    const avatarsDir = path.join(MEDIA_DIR, "avatars");
    if (!fs.existsSync(avatarsDir)) {
        await fsPromises.mkdir(avatarsDir, { recursive: true });
    }

    // Strip any directory components from the uploaded filename
    const safeBasename = path.basename(file.name);
    const ext = path.extname(safeBasename).toLowerCase();

    // Validate extension against an explicit allowlist
    if (!AVATAR_ALLOWED_EXTS.has(ext)) {
        throw new Error(`Avatar upload rejected: extension '${ext}' is not allowed`);
    }

    const filename = `avatar_${childId}_${Date.now()}${ext}`;
    const filePath = path.join(avatarsDir, filename);

    // Guard: ensure the resolved path stays inside avatarsDir
    assertWithinDirectory(avatarsDir, filePath);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fsPromises.writeFile(filePath, buffer);

    return `avatars/${filename}`;
}

/** Allowed subtitle extensions */
const SUBTITLE_ALLOWED_EXTS = new Set([".srt", ".vtt"]);

export async function saveSubtitle(videoId: number, file: File): Promise<{ filename: string; error?: string }> {
    // Strip directory components from the client-supplied name before inspecting extension
    const safeBasename = path.basename(file.name);
    const ext = path.extname(safeBasename).toLowerCase();

    if (!SUBTITLE_ALLOWED_EXTS.has(ext)) {
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

    // Guard: ensure the resolved path stays inside subtitlesDir
    assertWithinDirectory(subtitlesDir, originalPath);

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
