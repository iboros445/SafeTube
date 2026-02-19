"use server";

import * as VideosDB from "@/src/lib/db/videos";
import * as SettingsDB from "@/src/lib/db/settings";
import { getAIConfig } from "@/src/lib/ai-actions";
import { createLLMService } from "@/src/lib/llm-service";
import type { Recommendation, CachedRecommendations } from "@/src/types";

// ─── DB Helpers ──────────────────────────────────────────────────────

const CACHE_KEY = "ai_cached_recommendations";

/** Load previously cached recommendations from DB (instant, no AI call) */
export async function getCachedRecommendations(): Promise<CachedRecommendations | null> {
    const value = await SettingsDB.getSetting(CACHE_KEY);
    if (!value) return null;
    try {
        return JSON.parse(value) as CachedRecommendations;
    } catch {
        return null;
    }
}

// ─── Generate Recommendations ────────────────────────────────────────

const SYSTEM_PROMPT = `You are a children's content curator for SafeTube, a parental control video app. Based on the parent's existing video library, suggest new age-appropriate videos their children might enjoy.

You MUST respond with valid JSON only, no markdown, no extra text. Use this exact format:
{
  "recommendations": [
    {
      "title": "<suggested video or channel name>",
      "search_query": "<YouTube search query to find this content>",
      "reason": "<1-sentence explanation why this fits their library>",
      "age_range": "<e.g. '3-6', '5-10', 'All ages'>",
      "category": "<e.g. 'Educational', 'Entertainment', 'Music', 'Science'>"
    }
  ]
}

Provide 5-8 unique, specific recommendations. Focus on safe, high-quality children's content. Don't recommend things already in their library. Be specific with video/channel names.`;

export async function getRecommendations(): Promise<{
    success: boolean;
    recommendations?: Recommendation[];
    error?: string;
}> {
    const config = await getAIConfig();
    if (!config) {
        return { success: false, error: "AI not configured" };
    }

    // Get current library
    const allVideos = await VideosDB.getAllVideos();
    
    if (allVideos.length === 0) {
        return { success: false, error: "No videos in library yet. Download some videos first!" };
    }

    // Build library summary for the prompt
    const libraryList = allVideos
        .slice(0, 30) // cap to avoid exceeding context
        .map((v) => {
            let line = `- ${v.title}`;
            if (v.educationalTags) {
                try {
                    const tags = JSON.parse(v.educationalTags);
                    if (Array.isArray(tags) && tags.length > 0) {
                        line += ` [${tags.join(", ")}]`;
                    }
                } catch { /* ignore */ }
            }
            return line;
        })
        .join("\n");

    const userMessage = `Here is the parent's current video library (${allVideos.length} videos):\n\n${libraryList}\n\nBased on these videos, suggest new content they might enjoy.`;

    try {
        const service = createLLMService(config);
        const response = await service.chat(SYSTEM_PROMPT, userMessage);
        
        // Parse response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { success: false, error: "Failed to parse AI response" };
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const recs: Recommendation[] = (parsed.recommendations || []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (r: any) => ({
                title: String(r.title || ""),
                searchQuery: String(r.search_query || r.title || ""),
                reason: String(r.reason || ""),
                ageRange: String(r.age_range || "All ages"),
                category: String(r.category || "General"),
            })
        );

        // Persist to DB so results survive page navigation and restarts
        const cached: CachedRecommendations = {
            recommendations: recs,
            updatedAt: new Date().toISOString(),
        };
        await SettingsDB.setSetting(CACHE_KEY, JSON.stringify(cached));

        return { success: true, recommendations: recs };
    } catch (err) {
        return { success: false, error: (err as Error).message };
    }
}
