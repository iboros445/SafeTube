import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { createLLMService, type AIConfig } from "@/src/lib/llm-service";

const MEDIA_DIR = path.join(process.cwd(), "media");
const TEMP_DIR = path.join(process.cwd(), "data", "temp");

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ─── Types ───────────────────────────────────────────────────────────

export interface VideoMetadata {
    title: string;
    channel?: string;
    duration?: number;
    description?: string;
    url: string;
}

export interface AnalysisResult {
    safetyScore: number;           // 1-10
    educationalValue: string;       // e.g. "High - Teaches Physics"
    pacing: string;                 // e.g. "Slow/Calm"
    tags: string[];                 // e.g. ["science", "physics", "education"]
    summary: string;                // Brief AI-generated summary
}

// ─── Fetch Video Metadata (no download) ──────────────────────────────

export async function fetchVideoMetadata(url: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
        const args = [
            "--dump-json",
            "--no-download",
            "--js-runtimes", "node",
            "--remote-components", "ejs:github",
        ];

        const cookiePath = path.join(process.cwd(), "cookies.txt");
        if (fs.existsSync(cookiePath)) {
            args.push("--cookies", cookiePath);
        }
        args.push(url);

        const proc = spawn("yt-dlp", args);

        let data = "";
        let error = "";

        proc.stdout.on("data", (chunk) => { data += chunk.toString(); });
        proc.stderr.on("data", (chunk) => { error += chunk.toString(); });

        proc.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(`Failed to fetch metadata: ${error}`));
                return;
            }
            try {
                const info = JSON.parse(data);
                resolve({
                    title: info.title || "Untitled",
                    channel: info.uploader || info.channel || undefined,
                    duration: info.duration || undefined,
                    description: info.description || undefined,
                    url,
                });
            } catch {
                reject(new Error("Failed to parse video metadata"));
            }
        });

        proc.on("error", (err) => reject(err));
    });
}

// ─── Fetch Auto-Subtitles ────────────────────────────────────────────

export async function fetchAutoSubtitles(url: string): Promise<string> {
    const tempId = `analysis_${Date.now()}`;
    const outputTemplate = path.join(TEMP_DIR, tempId);

    return new Promise((resolve) => {
        const args = [
            "--write-auto-sub",
            "--sub-lang", "en",
            "--sub-format", "vtt",
            "--skip-download",
            "--js-runtimes", "node",
            "--remote-components", "ejs:github",
            "-o", `${outputTemplate}.%(ext)s`,
        ];

        const cookiePath = path.join(process.cwd(), "cookies.txt");
        if (fs.existsSync(cookiePath)) {
            args.push("--cookies", cookiePath);
        }
        args.push(url);

        const proc = spawn("yt-dlp", args);

        let error = "";
        proc.stderr.on("data", (chunk) => { error += chunk.toString(); });

        proc.on("close", () => {
            // Look for the subtitle file (yt-dlp adds .en.vtt)
            const possibleFiles = [
                `${outputTemplate}.en.vtt`,
                `${outputTemplate}.en.srt`,
            ];

            for (const file of possibleFiles) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, "utf-8");
                    // Clean up temp file
                    try { fs.unlinkSync(file); } catch { /* ignore */ }
                    resolve(stripVttMarkup(content));
                    return;
                }
            }

            // No subtitles found — return empty
            resolve("");
        });

        proc.on("error", () => resolve(""));
    });
}

// ─── Strip VTT/SRT Markup ────────────────────────────────────────────

function stripVttMarkup(content: string): string {
    return content
        // Remove WEBVTT header and metadata
        .replace(/^WEBVTT\n[\s\S]*?\n\n/, "")
        // Remove SRT sequence numbers
        .replace(/^\d+\n/gm, "")
        // Remove timestamps
        .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}.*\n/g, "")
        // Remove HTML tags
        .replace(/<[^>]+>/g, "")
        // Remove position/alignment cues
        .replace(/^(align|position|size|line):.*$/gm, "")
        // Collapse multiple newlines
        .replace(/\n{3,}/g, "\n")
        // Remove duplicate lines (common in auto-subs)
        .split("\n")
        .filter((line, i, arr) => line.trim() && (i === 0 || line.trim() !== arr[i - 1]?.trim()))
        .join(" ")
        .trim();
}

// ─── Analyze Video with LLM ─────────────────────────────────────────

const SYSTEM_PROMPT = `You are a child safety content reviewer for a parental control app called SafeTube. Your job is to analyze video content and provide an honest, helpful assessment for parents.

You MUST respond with valid JSON only, no markdown, no extra text. Use this exact format:
{
  "safety_score": <number 1-10, where 10 is perfectly safe for young children>,
  "educational_value": "<short description, e.g. 'High - Teaches basic physics concepts'>",
  "pacing": "<one of: 'Very Slow/Calm', 'Slow/Calm', 'Moderate', 'Fast-Paced', 'Hyper-Stimulating'>",
  "tags": ["<tag1>", "<tag2>", "..."],
  "summary": "<2-3 sentence summary of the content and why you gave this score>"
}

Scoring guidelines:
- 9-10: Perfectly safe, educational, calm pacing (e.g. Bluey, Khan Academy Kids)
- 7-8: Safe with minor concerns, age-appropriate (e.g. Peppa Pig, Sesame Street)
- 5-6: Some content that may not be suitable for very young children
- 3-4: Contains concerning elements (violence themes, scary content, inappropriate language)
- 1-2: Not suitable for children at all`;

export async function analyzeVideo(
    metadata: VideoMetadata,
    subtitleText: string,
    config: AIConfig,
): Promise<AnalysisResult> {
    const service = createLLMService(config);

    // Truncate subtitles to fit within context window
    const maxSubLength = 4000;
    const truncatedSubs = subtitleText.length > maxSubLength
        ? subtitleText.slice(0, maxSubLength) + "\n...[truncated]"
        : subtitleText;

    const userMessage = buildAnalysisPrompt(metadata, truncatedSubs);

    try {
        const response = await service.chat(SYSTEM_PROMPT, userMessage);
        return parseAnalysisResponse(response.content);
    } catch (err) {
        console.error("LLM analysis error:", err);
        // Return a safe default
        return {
            safetyScore: 5,
            educationalValue: "Unable to analyze — AI error",
            pacing: "Unknown",
            tags: [],
            summary: `Analysis failed: ${(err as Error).message}. Please review the video manually.`,
        };
    }
}

function buildAnalysisPrompt(metadata: VideoMetadata, subtitleText: string): string {
    let prompt = `Analyze this video for child safety:\n\n`;
    prompt += `**Title:** ${metadata.title}\n`;
    if (metadata.channel) prompt += `**Channel:** ${metadata.channel}\n`;
    if (metadata.duration) prompt += `**Duration:** ${Math.round(metadata.duration / 60)} minutes\n`;
    if (metadata.description) {
        const desc = metadata.description.length > 500
            ? metadata.description.slice(0, 500) + "..."
            : metadata.description;
        prompt += `**Description:** ${desc}\n`;
    }
    prompt += `\n`;

    if (subtitleText) {
        prompt += `**Auto-generated subtitles (transcript):**\n${subtitleText}\n`;
    } else {
        prompt += `**Note:** No subtitles available. Please analyze based on the metadata only.\n`;
    }

    return prompt;
}

function parseAnalysisResponse(content: string): AnalysisResult {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("No JSON found in AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
        safetyScore: Math.max(1, Math.min(10, Number(parsed.safety_score) || 5)),
        educationalValue: String(parsed.educational_value || "Unknown"),
        pacing: String(parsed.pacing || "Unknown"),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
        summary: String(parsed.summary || "No summary provided"),
    };
}
