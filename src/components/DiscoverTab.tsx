"use client";

import { useState, useEffect } from "react";
import {
    Sparkles,
    Loader2,
    Search,
    ExternalLink,
    RefreshCw,
    Download,
    Users,
    Clock,
} from "lucide-react";
import {
    getRecommendations,
    getCachedRecommendations,
    type Recommendation,
} from "@/src/lib/recommendation-service";

interface DiscoverTabProps {
    pin: string;
    isLight: boolean;
    cardCls: string;
    textPrimary: string;
    textMuted: string;
    btnSurface: string;
    surfaceCls: string;
}

const CATEGORY_COLORS: Record<string, string> = {
    Educational: "from-blue-500 to-cyan-500",
    Science: "from-emerald-500 to-teal-500",
    Music: "from-pink-500 to-rose-500",
    Entertainment: "from-amber-500 to-orange-500",
    Art: "from-violet-500 to-purple-500",
    History: "from-yellow-600 to-amber-600",
    Math: "from-indigo-500 to-blue-500",
    Reading: "from-green-500 to-emerald-500",
    General: "from-gray-500 to-slate-500",
};

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export default function DiscoverTab({
    pin,
    isLight,
    cardCls,
    textPrimary,
    textMuted,
    btnSurface,
    surfaceCls,
}: DiscoverTabProps) {
    const [loading, setLoading] = useState(false);
    const [recs, setRecs] = useState<Recommendation[]>([]);
    const [error, setError] = useState("");
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [initialLoad, setInitialLoad] = useState(true);
    const [queuedItems, setQueuedItems] = useState<Set<number>>(new Set());
    const [queuingIndex, setQueuingIndex] = useState<number | null>(null);

    // Load cached recommendations on mount
    useEffect(() => {
        getCachedRecommendations().then((cached) => {
            if (cached && cached.recommendations.length > 0) {
                setRecs(cached.recommendations);
                setUpdatedAt(cached.updatedAt);
            }
            setInitialLoad(false);
        });
    }, []);

    const fetchRecs = async () => {
        setLoading(true);
        setError("");
        const result = await getRecommendations();
        if (result.success && result.recommendations) {
            setRecs(result.recommendations);
            setUpdatedAt(new Date().toISOString());
        } else {
            setError(result.error || "Failed to get recommendations");
        }
        setLoading(false);
    };

    const addToQueue = async (rec: Recommendation, index: number) => {
        setQueuingIndex(index);
        try {
            const res = await fetch("/api/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pin,
                    action: "add",
                    urls: [{ url: `ytsearch1:${rec.searchQuery}`, title: rec.title }],
                }),
            });
            const data = await res.json();
            if (data.success) {
                setQueuedItems((prev) => new Set(prev).add(index));
            }
        } catch { /* ignore */ }
        setQueuingIndex(null);
    };

    const getCategoryGradient = (category: string) => {
        return CATEGORY_COLORS[category] || CATEGORY_COLORS.General;
    };

    const hasCached = recs.length > 0;

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className={`${cardCls} p-6`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className={`font-semibold ${textPrimary}`}>Curator Assistant</h3>
                            <p className={`${textMuted} text-xs`}>
                                AI-powered suggestions based on your library
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {updatedAt && (
                            <span className={`flex items-center gap-1 text-[11px] ${textMuted}`}>
                                <Clock className="w-3 h-3" />
                                {timeAgo(updatedAt)}
                            </span>
                        )}
                        <button
                            onClick={fetchRecs}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white font-semibold text-sm transition-all hover:from-violet-600 hover:to-fuchsia-700 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : hasCached ? (
                                <RefreshCw className="w-4 h-4" />
                            ) : (
                                <Sparkles className="w-4 h-4" />
                            )}
                            {loading ? "Thinking..." : hasCached ? "Update" : "Get Suggestions"}
                        </button>
                    </div>
                </div>

                {!hasCached && !loading && !initialLoad && (
                    <p className={`${textMuted} text-sm text-center py-4`}>
                        Click &quot;Get Suggestions&quot; to analyze your library and receive personalized recommendations.
                    </p>
                )}

                {initialLoad && (
                    <div className="flex items-center justify-center gap-2 py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                        <span className={`${textMuted} text-sm`}>Loading...</span>
                    </div>
                )}

                {error && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {error}
                    </div>
                )}
            </div>

            {/* Recommendations Grid */}
            {recs.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                    {recs.map((rec, i) => (
                        <div key={i} className={`${cardCls} p-4 space-y-3 hover:ring-1 ring-violet-500/20 transition-all`}>
                            <div className="flex items-start justify-between gap-2">
                                <h4 className={`font-semibold ${textPrimary} text-sm leading-tight`}>
                                    {rec.title}
                                </h4>
                                <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r ${getCategoryGradient(rec.category)} text-white font-medium`}>
                                    {rec.category}
                                </span>
                            </div>

                            <p className={`${textMuted} text-xs leading-relaxed`}>{rec.reason}</p>

                            <div className="flex items-center gap-3">
                                <span className={`flex items-center gap-1 text-xs ${textMuted}`}>
                                    <Users className="w-3 h-3" />
                                    Ages {rec.ageRange}
                                </span>
                            </div>

                            <div className="flex gap-2 pt-1">
                                <a
                                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(rec.searchQuery)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${btnSurface} text-xs font-medium transition-all`}
                                >
                                    <Search className="w-3 h-3" /> Search
                                    <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                                </a>
                                <button
                                    onClick={() => addToQueue(rec, i)}
                                    disabled={queuedItems.has(i) || queuingIndex === i}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${btnSurface} text-xs font-medium transition-all hover:ring-1 ring-violet-500/50 disabled:opacity-50`}
                                >
                                    {queuingIndex === i ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : queuedItems.has(i) ? (
                                        <>✅</>
                                    ) : (
                                        <Download className="w-3 h-3" />
                                    )}
                                    {queuedItems.has(i) ? "Queued" : "Add to Queue"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
