"use server";

import { db, dbReady } from "@/src/db";
import { settings } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { validateAdminPin } from "@/src/lib/auth";
import {
    encryptApiKey,
    decryptApiKey,
    createLLMService,
    DEFAULT_MODELS,
    type AIProvider,
    type AIConfig,
    RECOMMENDED_MODELS,
} from "@/src/lib/llm-service";

export async function getOllamaModels(url: string): Promise<string[]> {
    try {
        // Ensure URL has protocol
        const baseUrl = url.startsWith("http") ? url : `http://${url}`;
        const res = await fetch(`${baseUrl}/api/tags`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.models?.map((m: any) => m.name) || [];
    } catch {
        return [];
    }
}

export async function getAvailableModels(provider: AIProvider, apiKey: string, ollamaUrl?: string): Promise<string[]> {
    if (provider === "ollama") {
        return getOllamaModels(ollamaUrl || "http://localhost:11434");
    }

    // If no API Key is provided (e.g. user didn't type one), try to get the stored one
    let keyToUse = apiKey;
    if (!keyToUse) {
        await ensureDb();
        const storedKey = await getSettingValue("ai_api_key"); // This is encrypted
        if (storedKey) {
            keyToUse = decryptApiKey(storedKey);
        }
    }

    if (!keyToUse) {
         // Fallback to recommended lists on error or missing key
        return RECOMMENDED_MODELS[provider] || [];
    }

    try {
        if (provider === "openai") {
            const res = await fetch("https://api.openai.com/v1/models", {
                headers: { Authorization: `Bearer ${keyToUse}` },
            });
            if (!res.ok) {
                 return RECOMMENDED_MODELS.openai;
            }
            const data = await res.json();
            return data.data
                .map((m: any) => m.id)
                .filter((id: string) => id.includes("gpt"))
                .sort()
                .reverse();
        }

        if (provider === "anthropic") {
            const res = await fetch("https://api.anthropic.com/v1/models", {
                headers: { 
                    "x-api-key": keyToUse,
                    "anthropic-version": "2023-06-01"
                },
            });
            if (!res.ok) {
                 return RECOMMENDED_MODELS.anthropic; 
            }
            const data = await res.json();
            return data.data.map((m: any) => m.id).sort();
        }

        if (provider === "gemini") {
             const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyToUse}`);
             if (!res.ok) {
                 return RECOMMENDED_MODELS.gemini;
             }
             const data = await res.json();
             return data.models
                .map((m: any) => m.name.replace("models/", ""))
                .filter((name: string) => name.includes("gemini"))
                .sort()
                .reverse();
        }

        return RECOMMENDED_MODELS[provider] || [];
    } catch (e) {
        console.error("Failed to fetch models:", e);
        return RECOMMENDED_MODELS[provider] || [];
    }
}

// ─── Helpers ────────────────────────────────────────────────────────

async function ensureDb() { await dbReady; }

async function getSettingValue(key: string): Promise<string> {
    await ensureDb();
    const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return row?.value ?? "";
}

// ─── Public API ─────────────────────────────────────────────────────

export interface AISettings {
    provider: AIProvider | "";
    apiKey: string;        // Will be masked for client: "sk-****" 
    apiKeySet: boolean;    // Whether a key is actually stored
    autoAnalysis: boolean;
    recommendations: boolean;
    ollamaUrl: string;
    model: string;
}

export async function getAISettings(): Promise<AISettings> {
    await ensureDb();
    const rows = await db.select().from(settings);
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const rawKey = map.get("ai_api_key") || "";
    const hasKey = rawKey.length > 0;

    // Mask the key for the client
    let maskedKey = "";
    if (hasKey) {
        const decrypted = decryptApiKey(rawKey);
        if (decrypted.length > 8) {
            maskedKey = decrypted.slice(0, 4) + "••••" + decrypted.slice(-4);
        } else if (decrypted.length > 0) {
            maskedKey = "••••••••";
        }
    }

    return {
        provider: (map.get("ai_provider") || "") as AIProvider | "",
        apiKey: maskedKey,
        apiKeySet: hasKey,
        autoAnalysis: map.get("ai_auto_analysis") === "true",
        recommendations: map.get("ai_recommendations") === "true",
        ollamaUrl: map.get("ai_ollama_url") || "http://localhost:11434",
        model: map.get("ai_model") || "",
    };
}

export async function isAIEnabled(): Promise<boolean> {
    const key = await getSettingValue("ai_api_key");
    const provider = await getSettingValue("ai_provider");
    // Ollama doesn't need an API key
    if (provider === "ollama") return true;
    return key.length > 0 && provider.length > 0;
}

export async function updateAISettings(
    pin: string,
    data: {
        provider?: string;
        apiKey?: string;    // Empty string = don't change, special "__CLEAR__" = remove
        autoAnalysis?: boolean;
        recommendations?: boolean;
        ollamaUrl?: string;
        model?: string;
    }
): Promise<{ success: boolean; error?: string }> {
    if (!await validateAdminPin(pin)) {
        return { success: false, error: "Invalid PIN" };
    }
    await ensureDb();

    const updates: Array<{ key: string; value: string }> = [];

    if (data.provider !== undefined) {
        updates.push({ key: "ai_provider", value: data.provider });
        // Set default model if model is empty and provider changed
        if (!data.model && data.provider && data.provider in DEFAULT_MODELS) {
            updates.push({
                key: "ai_model",
                value: DEFAULT_MODELS[data.provider as AIProvider],
            });
        }
    }
    if (data.apiKey !== undefined) {
        if (data.apiKey === "__CLEAR__") {
            updates.push({ key: "ai_api_key", value: "" });
        } else if (data.apiKey.length > 0) {
            updates.push({ key: "ai_api_key", value: encryptApiKey(data.apiKey) });
        }
        // Empty string means "don't change"
    }
    if (data.autoAnalysis !== undefined) {
        updates.push({ key: "ai_auto_analysis", value: data.autoAnalysis ? "true" : "false" });
    }
    if (data.recommendations !== undefined) {
        updates.push({ key: "ai_recommendations", value: data.recommendations ? "true" : "false" });
    }
    if (data.ollamaUrl !== undefined) {
        updates.push({ key: "ai_ollama_url", value: data.ollamaUrl });
    }
    if (data.model !== undefined && data.model.length > 0) {
        updates.push({ key: "ai_model", value: data.model });
    }

    for (const { key, value } of updates) {
        const [existing] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
        if (existing) {
            await db.update(settings).set({ value }).where(eq(settings.key, key));
        } else {
            await db.insert(settings).values({ key, value });
        }
    }

    return { success: true };
}

export async function testAIConnection(
    pin: string,
    overrides?: {
        provider?: string;
        apiKey?: string;       // raw, unencrypted key from the form
        model?: string;
        ollamaUrl?: string;
    }
): Promise<{ success: boolean; error?: string; model?: string }> {
    if (!await validateAdminPin(pin)) {
        return { success: false, error: "Invalid PIN" };
    }
    await ensureDb();

    const rows = await db.select().from(settings);
    const map = new Map(rows.map((r) => [r.key, r.value]));

    // Use overrides when provided, fall back to saved DB values
    const provider = (overrides?.provider || map.get("ai_provider") || "") as AIProvider;
    const model = overrides?.model || map.get("ai_model") || "";
    const ollamaUrl = overrides?.ollamaUrl || map.get("ai_ollama_url") || "http://localhost:11434";

    // For the API key: prefer the override (raw key from form), fall back to decrypting saved key
    let apiKey = "";
    if (overrides?.apiKey) {
        apiKey = overrides.apiKey;
    } else {
        const encryptedKey = map.get("ai_api_key") || "";
        if (encryptedKey) {
            apiKey = decryptApiKey(encryptedKey);
        }
    }

    if (!provider) {
        return { success: false, error: "No AI provider selected" };
    }
    if (provider !== "ollama" && !apiKey) {
        return { success: false, error: "No API key provided" };
    }

    const config: AIConfig = {
        provider,
        apiKey,
        model: model || undefined,
        ollamaUrl,
    };

    try {
        const service = createLLMService(config);
        const result = await service.test();
        return {
            ...result,
            model: model || DEFAULT_MODELS[provider],
        };
    } catch (err) {
        return { success: false, error: (err as Error).message };
    }
}

/** Get the raw (decrypted) AI config for internal service use */
export async function getAIConfig(): Promise<AIConfig | null> {
    await ensureDb();
    const rows = await db.select().from(settings);
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const provider = map.get("ai_provider") as AIProvider;
    const encryptedKey = map.get("ai_api_key") || "";

    if (!provider) return null;
    if (provider !== "ollama" && !encryptedKey) return null;

    return {
        provider,
        apiKey: decryptApiKey(encryptedKey),
        model: map.get("ai_model") || undefined,
        ollamaUrl: map.get("ai_ollama_url") || "http://localhost:11434",
    };
}
