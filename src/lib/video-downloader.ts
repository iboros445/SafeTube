import { spawn, execSync } from "child_process";
import path from "path";
import fs from "fs";

const MEDIA_DIR = path.join(process.cwd(), "media");

// Ensure media directory exists
if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

export interface DownloadResult {
    success: boolean;
    title?: string;
    filename?: string;
    thumbnailFilename?: string;
    duration?: number;
    error?: string;
}

export interface DownloadProgress {
    status: "downloading" | "processing" | "complete" | "error";
    percent?: number;
    message?: string;
}

/**
 * Check if yt-dlp is available on the system PATH.
 */
function isYtDlpAvailable(): boolean {
    try {
        execSync("yt-dlp --version", { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

/**
 * Downloads a YouTube video using yt-dlp.
 * Returns metadata about the downloaded file.
 */
export async function downloadVideo(
    url: string,
    onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadResult> {
    // Pre-flight check
    if (!isYtDlpAvailable()) {
        return {
            success: false,
            error:
                "yt-dlp is not installed or not on PATH. Install it with: pip install yt-dlp (or use Docker).",
        };
    }

    return new Promise((resolve) => {
        // First, get video info
        const infoProc = spawn("yt-dlp", [
            "--dump-json",
            "--no-download",
            "--js-runtimes",
            "node",
            "--remote-components",
            "ejs:github",
            url,
        ]);

        let infoData = "";
        let infoError = "";

        infoProc.stdout.on("data", (data) => {
            infoData += data.toString();
        });

        infoProc.stderr.on("data", (data) => {
            infoError += data.toString();
        });

        infoProc.on("error", (err) => {
            resolve({
                success: false,
                error: `Failed to start yt-dlp: ${err.message}. Make sure yt-dlp is installed.`,
            });
        });

        infoProc.on("close", (infoCode) => {
            if (infoCode !== 0) {
                resolve({
                    success: false,
                    error: `Failed to get video info: ${infoError}`,
                });
                return;
            }

            let videoInfo;
            try {
                videoInfo = JSON.parse(infoData);
            } catch {
                resolve({ success: false, error: "Failed to parse video info" });
                return;
            }

            const title = videoInfo.title || "Untitled";
            const duration = videoInfo.duration || 0;
            const safeTitle = title
                .replace(/[^a-zA-Z0-9\s\-_]/g, "")
                .replace(/\s+/g, "_")
                .substring(0, 80);
            const timestamp = Date.now();
            const filename = `${safeTitle}_${timestamp}.mp4`;
            const thumbnailFilename = `${safeTitle}_${timestamp}.jpg`;
            const outputPath = path.join(MEDIA_DIR, filename);
            const thumbnailPath = path.join(MEDIA_DIR, thumbnailFilename);

            onProgress?.({
                status: "downloading",
                percent: 0,
                message: `Starting download: ${title}`,
            });

            // Download video
            const dlProc = spawn("yt-dlp", [
                "-f",
                "bestvideo[height<=720]+bestaudio/best[height<=720]",
                "--merge-output-format",
                "mp4",
                "--write-thumbnail",
                "--convert-thumbnails",
                "jpg",
                "--js-runtimes",
                "node",
                "--remote-components",
                "ejs:github",
                "-o",
                outputPath,
                url,
            ]);

            let dlError = "";

            dlProc.stdout.on("data", (data) => {
                const line = data.toString();
                const percentMatch = line.match(/(\d+\.?\d*)%/);
                if (percentMatch) {
                    onProgress?.({
                        status: "downloading",
                        percent: parseFloat(percentMatch[1]),
                        message: line.trim(),
                    });
                }
            });

            dlProc.stderr.on("data", (data) => {
                const line = data.toString();
                dlError += line;
                const percentMatch = line.match(/(\d+\.?\d*)%/);
                if (percentMatch) {
                    onProgress?.({
                        status: "downloading",
                        percent: parseFloat(percentMatch[1]),
                        message: line.trim(),
                    });
                }
            });

            dlProc.on("error", (err) => {
                resolve({
                    success: false,
                    error: `Failed to start yt-dlp download: ${err.message}`,
                });
            });

            dlProc.on("close", (dlCode) => {
                if (dlCode !== 0) {
                    resolve({
                        success: false,
                        error: `Download failed: ${dlError}`,
                    });
                    return;
                }

                // Check if thumbnail was downloaded (yt-dlp names it differently)
                const possibleThumbs = [
                    outputPath.replace(".mp4", ".jpg"),
                    outputPath.replace(".mp4", ".webp"),
                    outputPath.replace(".mp4", ".png"),
                ];

                let actualThumbPath: string | undefined;
                for (const tp of possibleThumbs) {
                    if (fs.existsSync(tp)) {
                        if (tp !== thumbnailPath) {
                            fs.renameSync(tp, thumbnailPath);
                        }
                        actualThumbPath = thumbnailFilename;
                        break;
                    }
                }

                onProgress?.({
                    status: "complete",
                    percent: 100,
                    message: "Download complete!",
                });

                resolve({
                    success: true,
                    title,
                    filename,
                    thumbnailFilename: actualThumbPath || undefined,
                    duration,
                });
            });
        });
    });
}
