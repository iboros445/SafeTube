import crypto from "crypto";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
    LLMResponse,
    LLMService,
    AIProvider,
    AIConfig
} from "@/src/types";

// ─── AES-256-GCM Encryption for API Keys ────────────────────────────
// Uses a machine-derived key from hostname + __dirname for deterministic
// encryption without requiring the user to manage a separate secret.
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_PREFIX = "enc:";

function getDerivedKey(): Buffer {
    const machineSecret = `safetube-${process.cwd()}-${require("os").hostname()}`;
    return crypto.scryptSync(machineSecret, "safetube-salt", 32);
}

export function encryptApiKey(plaintext: string): string {
    if (!plaintext || plaintext.startsWith(ENCRYPTION_PREFIX)) return plaintext;
    const key = getDerivedKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return `${ENCRYPTION_PREFIX}${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptApiKey(ciphertext: string): string {
    if (!ciphertext || !ciphertext.startsWith(ENCRYPTION_PREFIX)) return ciphertext;
    const key = getDerivedKey();
    const parts = ciphertext.slice(ENCRYPTION_PREFIX.length).split(":");
    if (parts.length !== 3) return ciphertext; // malformed, return as-is
    const [ivHex, authTagHex, encrypted] = parts;
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

// ─── Provider Implementations ────────────────────────────────────────

function createOpenAIService(apiKey: string, model: string): LLMService {
    const client = new OpenAI({ apiKey });
    return {
        async chat(systemPrompt, userMessage) {
            const response = await client.chat.completions.create({
                model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage },
                ],
                temperature: 0.3,
                max_tokens: 1500,
            });
            return {
                content: response.choices[0]?.message?.content || "",
                usage: response.usage ? {
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens,
                } : undefined,
            };
        },
        async test() {
            try {
                await client.chat.completions.create({
                    model,
                    messages: [{ role: "user", content: "Say hello" }],
                    max_tokens: 10,
                });
                return { success: true };
            } catch (err) {
                return { success: false, error: (err as Error).message };
            }
        },
    };
}

function createGeminiService(apiKey: string, model: string): LLMService {
    const genAI = new GoogleGenerativeAI(apiKey);
    return {
        async chat(systemPrompt, userMessage) {
            const genModel = genAI.getGenerativeModel({
                model,
                systemInstruction: systemPrompt,
            });
            const result = await genModel.generateContent(userMessage);
            const text = result.response.text();
            return { content: text };
        },
        async test() {
            try {
                const genModel = genAI.getGenerativeModel({ model });
                await genModel.generateContent("Say hello");
                return { success: true };
            } catch (err) {
                return { success: false, error: (err as Error).message };
            }
        },
    };
}

function createAnthropicService(apiKey: string, model: string): LLMService {
    const client = new Anthropic({ apiKey });
    return {
        async chat(systemPrompt, userMessage) {
            const response = await client.messages.create({
                model,
                max_tokens: 1500,
                system: systemPrompt,
                messages: [{ role: "user", content: userMessage }],
            });
            const text = response.content
                .filter((b): b is Anthropic.TextBlock => b.type === "text")
                .map((b) => b.text)
                .join("");
            return {
                content: text,
                usage: {
                    promptTokens: response.usage.input_tokens,
                    completionTokens: response.usage.output_tokens,
                },
            };
        },
        async test() {
            try {
                await client.messages.create({
                    model,
                    max_tokens: 10,
                    messages: [{ role: "user", content: "Say hello" }],
                });
                return { success: true };
            } catch (err) {
                return { success: false, error: (err as Error).message };
            }
        },
    };
}

function createOllamaService(baseUrl: string, model: string): LLMService {
    const client = new OpenAI({
        apiKey: "ollama",
        baseURL: `${baseUrl}/v1`,
    });
    return {
        async chat(systemPrompt, userMessage) {
            const response = await client.chat.completions.create({
                model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage },
                ],
                temperature: 0.3,
            });
            return {
                content: response.choices[0]?.message?.content || "",
            };
        },
        async test() {
            try {
                await client.chat.completions.create({
                    model,
                    messages: [{ role: "user", content: "Say hello" }],
                    max_tokens: 10,
                });
                return { success: true };
            } catch (err) {
                return { success: false, error: (err as Error).message };
            }
        },
    };
}

// ─── Default Models ──────────────────────────────────────────────────

export const DEFAULT_MODELS: Record<AIProvider, string> = {
    openai: "gpt-4o-mini",
    gemini: "gemini-2.0-flash",
    anthropic: "claude-3-5-haiku-latest",
    ollama: "", // Dynamic
};

// Fallback list: Used when the API is unreachable, the key is missing, or the fetch fails.
// This ensures the user isn't left with an empty dropdown in those cases.
export const RECOMMENDED_MODELS: Record<AIProvider, string[]> = {
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    gemini: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    anthropic: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-20240229"],
    ollama: [], // Will be populated dynamically
};

// ─── Factory ─────────────────────────────────────────────────────────

export function createLLMService(config: AIConfig): LLMService {
    const model = config.model || DEFAULT_MODELS[config.provider];

    switch (config.provider) {
        case "openai":
            return createOpenAIService(config.apiKey, model);
        case "gemini":
            return createGeminiService(config.apiKey, model);
        case "anthropic":
            return createAnthropicService(config.apiKey, model);
        case "ollama":
            return createOllamaService(config.ollamaUrl || "http://localhost:11434", model);
        default:
            throw new Error(`Unknown AI provider: ${config.provider}`);
    }
}
