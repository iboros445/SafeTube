export interface QueueJob {
    id: string;
    url: string;
    title: string;
    status: "pending" | "downloading" | "done" | "error";
    error?: string;
    progress?: number;
}

export interface QueueState {
    jobs: QueueJob[];
    isRunning: boolean;
    concurrency: number;
}

export interface DownloadResult {
    success: boolean;
    title?: string;
    resolvedUrl?: string;
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

export type UrlType = "video" | "playlist" | "channel" | "unknown";

export interface PlaylistEntry {
    url: string;
    title: string;
    duration?: number;
    selected?: boolean; // Added from DownloadManager usage
}

export interface SearchResult {
    url: string;
    title: string;
    duration?: number;
    channel?: string;
    thumbnail?: string;
}

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

export interface AISettings {
    provider: AIProvider | "";
    apiKey: string;        // Will be masked for client: "sk-****" 
    apiKeySet: boolean;    // Whether a key is actually stored
    autoAnalysis: boolean;
    recommendations: boolean;
    ollamaUrl: string;
    model: string;
}

export type AIProvider = "openai" | "gemini" | "anthropic" | "ollama";

export interface AIConfig {
    provider: AIProvider;
    apiKey: string;
    model?: string;
    ollamaUrl?: string;
}

export interface LLMResponse {
    content: string;
    usage?: { promptTokens: number; completionTokens: number };
}

export interface LLMService {
    chat(systemPrompt: string, userMessage: string): Promise<LLMResponse>;
    test(): Promise<{ success: boolean; error?: string }>;
}

export interface Recommendation {
    title: string;
    searchQuery: string;
    reason: string;
    ageRange: string;
    category: string;
}

export interface CachedRecommendations {
    recommendations: Recommendation[];
    updatedAt: string; // ISO timestamp
}
