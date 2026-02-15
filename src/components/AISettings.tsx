"use client";

import { useState, useEffect } from "react";
import {
    getAISettings,
    updateAISettings,
    testAIConnection,
    type AISettings as AISettingsType,
} from "@/src/lib/ai-actions";
import { DEFAULT_MODELS, type AIProvider } from "@/src/lib/llm-service";
import {
    Brain,
    Key,
    Eye,
    EyeOff,
    Loader2,
    Check,
    X,
    Sparkles,
    Zap,
    Server,
    Save,
    TestTube,
} from "lucide-react";

interface AISettingsProps {
    pin: string;
    isLight: boolean;
    cardCls: string;
    textPrimary: string;
    textMuted: string;
    inputCls: string;
    btnSurface: string;
    surfaceCls: string;
    borderCls: string;
    onSettingsChange?: (aiEnabled: boolean) => void;
}

const PROVIDERS: { value: AIProvider | ""; label: string; icon: React.ReactNode }[] = [
    { value: "", label: "None (Disabled)", icon: <X className="w-4 h-4" /> },
    { value: "openai", label: "OpenAI", icon: <Sparkles className="w-4 h-4" /> },
    { value: "gemini", label: "Google Gemini", icon: <Zap className="w-4 h-4" /> },
    { value: "anthropic", label: "Anthropic", icon: <Brain className="w-4 h-4" /> },
    { value: "ollama", label: "Ollama (Local)", icon: <Server className="w-4 h-4" /> },
];

export default function AISettings({
    pin,
    isLight,
    cardCls,
    textPrimary,
    textMuted,
    inputCls,
    btnSurface,
    surfaceCls,
    borderCls,
    onSettingsChange,
}: AISettingsProps) {
    const [settings, setSettings] = useState<AISettingsType | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; error?: string; model?: string } | null>(null);
    const [showKey, setShowKey] = useState(false);
    const [newApiKey, setNewApiKey] = useState("");
    const [dirty, setDirty] = useState(false);

    // Local form state
    const [provider, setProvider] = useState<AIProvider | "">("");
    const [model, setModel] = useState("");
    const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
    const [autoAnalysis, setAutoAnalysis] = useState(false);
    const [recommendations, setRecommendations] = useState(false);

    useEffect(() => {
        getAISettings().then((s) => {
            setSettings(s);
            setProvider(s.provider);
            setModel(s.model);
            setOllamaUrl(s.ollamaUrl);
            setAutoAnalysis(s.autoAnalysis);
            setRecommendations(s.recommendations);
            setLoading(false);
        });
    }, []);

    const handleProviderChange = (newProvider: AIProvider | "") => {
        setProvider(newProvider);
        if (newProvider && newProvider in DEFAULT_MODELS) {
            setModel(DEFAULT_MODELS[newProvider as AIProvider]);
        } else {
            setModel("");
        }
        setDirty(true);
        setTestResult(null);
    };

    const handleSave = async () => {
        setSaving(true);
        setTestResult(null);
        const result = await updateAISettings(pin, {
            provider: provider || "",
            apiKey: newApiKey || undefined,
            model,
            ollamaUrl,
            autoAnalysis,
            recommendations,
        });
        if (result.success) {
            const updated = await getAISettings();
            setSettings(updated);
            setNewApiKey("");
            setDirty(false);
            onSettingsChange?.(updated.apiKeySet || updated.provider === "ollama");
        }
        setSaving(false);
    };

    const handleClearKey = async () => {
        setSaving(true);
        await updateAISettings(pin, { apiKey: "__CLEAR__" });
        const updated = await getAISettings();
        setSettings(updated);
        setNewApiKey("");
        setDirty(false);
        onSettingsChange?.(false);
        setSaving(false);
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        const result = await testAIConnection(pin, {
            provider: provider || undefined,
            apiKey: newApiKey || undefined,  // pass the raw key from the input field
            model: model || undefined,
            ollamaUrl: ollamaUrl || undefined,
        });
        setTestResult(result);
        setTesting(false);
    };

    if (loading) {
        return (
            <div className={`${cardCls} p-8`}>
                <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                    <span className={textMuted}>Loading AI settings...</span>
                </div>
            </div>
        );
    }

    const isOllama = provider === "ollama";
    const needsKey = provider !== "" && provider !== "ollama";

    return (
        <div className={`${cardCls} p-6 animate-fade-in`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className={`font-semibold ${textPrimary}`}>Intelligence & AI</h3>
                    <p className={`${textMuted} text-xs`}>Configure AI-powered video analysis and recommendations</p>
                </div>
            </div>

            <div className="space-y-5">
                {/* Provider Selection */}
                <div>
                    <label className={`text-sm ${textMuted} block mb-2`}>AI Provider</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {PROVIDERS.map((p) => (
                            <button
                                key={p.value}
                                onClick={() => handleProviderChange(p.value as AIProvider | "")}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                    provider === p.value
                                        ? "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-md"
                                        : `${btnSurface}`
                                }`}
                            >
                                {p.icon}
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* API Key */}
                {needsKey && (
                    <div>
                        <label className={`text-sm ${textMuted} block mb-2`}>API Key</label>
                        {settings?.apiKeySet && !newApiKey ? (
                            <div className="flex items-center gap-2">
                                <div className={`flex-1 px-4 py-2.5 rounded-xl ${surfaceCls} ${textMuted} text-sm font-mono flex items-center gap-2`}>
                                    <Key className="w-4 h-4 text-green-400 flex-shrink-0" />
                                    <span>{showKey ? settings.apiKey : "••••••••••••••••"}</span>
                                    <button
                                        onClick={() => setShowKey(!showKey)}
                                        className={`ml-auto p-1 rounded-lg hover:bg-white/10 transition-all`}
                                    >
                                        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                                <button
                                    onClick={handleClearKey}
                                    disabled={saving}
                                    className="px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-sm transition-all"
                                >
                                    Clear
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type={showKey ? "text" : "password"}
                                    value={newApiKey}
                                    onChange={(e) => { setNewApiKey(e.target.value); setDirty(true); }}
                                    placeholder={`Enter your ${provider === "openai" ? "OpenAI" : provider === "gemini" ? "Google" : "Anthropic"} API key...`}
                                    className={`w-full px-4 py-2.5 pr-10 rounded-xl ${inputCls} font-mono text-sm outline-none transition-colors`}
                                />
                                <button
                                    onClick={() => setShowKey(!showKey)}
                                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/10 ${textMuted}`}
                                >
                                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Ollama URL */}
                {isOllama && (
                    <div>
                        <label className={`text-sm ${textMuted} block mb-2`}>Ollama Server URL</label>
                        <input
                            type="text"
                            value={ollamaUrl}
                            onChange={(e) => { setOllamaUrl(e.target.value); setDirty(true); }}
                            placeholder="http://localhost:11434"
                            className={`w-full px-4 py-2.5 rounded-xl ${inputCls} font-mono text-sm outline-none transition-colors`}
                        />
                    </div>
                )}

                {/* Model Name */}
                {provider !== "" && (
                    <div>
                        <label className={`text-sm ${textMuted} block mb-2`}>Model</label>
                        <input
                            type="text"
                            value={model}
                            onChange={(e) => { setModel(e.target.value); setDirty(true); }}
                            placeholder={provider ? DEFAULT_MODELS[provider as AIProvider] || "Model name" : ""}
                            className={`w-full px-4 py-2.5 rounded-xl ${inputCls} text-sm outline-none transition-colors`}
                        />
                        <p className={`${textMuted} text-xs mt-1`}>
                            Default: {provider && DEFAULT_MODELS[provider as AIProvider]}
                        </p>
                    </div>
                )}

                {/* Toggles */}
                {provider !== "" && (
                    <div className={`space-y-3 pt-2 border-t ${borderCls}`}>
                        <label className={`text-sm ${textMuted} block mb-1 font-medium`}>Features</label>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-400" />
                                <span className={`text-sm ${textPrimary}`}>Auto-analyze downloads</span>
                            </div>
                            <button
                                onClick={() => { setAutoAnalysis(!autoAnalysis); setDirty(true); }}
                                className={`w-11 h-6 rounded-full transition-all relative ${
                                    autoAnalysis
                                        ? "bg-gradient-to-r from-violet-500 to-fuchsia-600"
                                        : isLight ? "bg-slate-300" : "bg-slate-700"
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-all ${
                                    autoAnalysis ? "left-[22px]" : "left-0.5"
                                }`} />
                            </button>
                        </div>
                        <p className={`${textMuted} text-xs ml-6 -mt-1`}>
                            Analyze video content before downloading. Requires captions.
                        </p>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-emerald-400" />
                                <span className={`text-sm ${textPrimary}`}>Enable recommendations</span>
                            </div>
                            <button
                                onClick={() => { setRecommendations(!recommendations); setDirty(true); }}
                                className={`w-11 h-6 rounded-full transition-all relative ${
                                    recommendations
                                        ? "bg-gradient-to-r from-violet-500 to-fuchsia-600"
                                        : isLight ? "bg-slate-300" : "bg-slate-700"
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-all ${
                                    recommendations ? "left-[22px]" : "left-0.5"
                                }`} />
                            </button>
                        </div>
                        <p className={`${textMuted} text-xs ml-6 -mt-1`}>
                            Get AI-curated video suggestions in the Discover tab.
                        </p>
                    </div>
                )}

                {/* Test & Save Buttons */}
                <div className="flex gap-2 pt-2">
                    {provider !== "" && (
                        <button
                            onClick={handleTest}
                            disabled={testing}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${btnSurface} text-sm font-medium transition-all`}
                        >
                            {testing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <TestTube className="w-4 h-4" />
                            )}
                            Test Connection
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving || (!dirty && !newApiKey && provider !== "")}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white font-semibold text-sm transition-all hover:from-violet-600 hover:to-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Save Settings
                    </button>
                </div>

                {/* Test Result */}
                {testResult && (
                    <div className={`p-3 rounded-xl text-sm animate-fade-in ${
                        testResult.success
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                            : "bg-red-500/10 border border-red-500/30 text-red-400"
                    }`}>
                        <div className="flex items-center gap-2">
                            {testResult.success ? (
                                <Check className="w-4 h-4" />
                            ) : (
                                <X className="w-4 h-4" />
                            )}
                            <span className="font-medium">
                                {testResult.success
                                    ? `Connected successfully${testResult.model ? ` (${testResult.model})` : ""}`
                                    : `Connection failed: ${testResult.error}`}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
