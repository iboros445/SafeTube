"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/src/lib/analysis-service";
import {
    Shield,
    BookOpen,
    Gauge,
    Tag,
    Check,
    X,
    Loader2,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

interface ReviewCardProps {
    videoTitle: string;
    videoUrl: string;
    thumbnailUrl?: string;
    analysis: AnalysisResult;
    isLight: boolean;
    cardCls: string;
    textPrimary: string;
    textMuted: string;
    surfaceCls: string;
    btnSurface: string;
    onApprove: () => Promise<void>;
    onDismiss: () => Promise<void>;
}

function getScoreColor(score: number): string {
    if (score >= 8) return "text-emerald-400";
    if (score >= 6) return "text-yellow-400";
    if (score >= 4) return "text-orange-400";
    return "text-red-400";
}

function getScoreBg(score: number): string {
    if (score >= 8) return "from-emerald-500 to-emerald-600";
    if (score >= 6) return "from-yellow-500 to-amber-600";
    if (score >= 4) return "from-orange-500 to-orange-600";
    return "from-red-500 to-red-600";
}

function getPacingIcon(pacing: string): string {
    if (pacing.toLowerCase().includes("calm") || pacing.toLowerCase().includes("slow")) return "🐢";
    if (pacing.toLowerCase().includes("moderate")) return "🚶";
    if (pacing.toLowerCase().includes("fast")) return "🏃";
    if (pacing.toLowerCase().includes("hyper")) return "⚡";
    return "❓";
}

/** Lightweight inline markdown → HTML (bold, italic, code) */
function renderMarkdown(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:4px;font-size:0.85em">$1</code>');
}

export default function ReviewCard({
    videoTitle,
    videoUrl,
    thumbnailUrl,
    analysis,
    isLight,
    cardCls,
    textPrimary,
    textMuted,
    surfaceCls,
    btnSurface,
    onApprove,
    onDismiss,
}: ReviewCardProps) {
    const [approving, setApproving] = useState(false);
    const [dismissing, setDismissing] = useState(false);
    const [expanded, setExpanded] = useState(true);

    return (
        <div className={`${cardCls} overflow-hidden animate-scale-in border-l-4 ${
            analysis.safetyScore >= 8 ? "border-l-emerald-500" :
            analysis.safetyScore >= 6 ? "border-l-yellow-500" :
            analysis.safetyScore >= 4 ? "border-l-orange-500" :
            "border-l-red-500"
        }`}>
            {/* Header */}
            <div className="p-4 flex items-center gap-3">
                {/* Score Badge */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getScoreBg(analysis.safetyScore)} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                    <span className="text-white font-bold text-lg">{analysis.safetyScore}</span>
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className={`font-semibold ${textPrimary} text-sm truncate`}>{videoTitle}</h4>
                    <p className={`${textMuted} text-xs truncate`}>
                        {videoUrl}
                    </p>
                </div>

                <button
                    onClick={() => setExpanded(!expanded)}
                    className={`p-2 rounded-lg ${btnSurface} transition-all flex-shrink-0`}
                >
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
            </div>

            {/* Details (collapsible) */}
            {expanded && (
                <div className="px-4 pb-4 space-y-3 animate-fade-in">
                    {/* Metrics Row */}
                    <div className="grid grid-cols-3 gap-2">
                        {/* Safety Score */}
                        <div className={`${surfaceCls} rounded-xl p-3`}>
                            <div className="flex items-center gap-1.5 mb-1">
                                <Shield className={`w-3.5 h-3.5 ${getScoreColor(analysis.safetyScore)}`} />
                                <span className={`text-xs font-medium ${textMuted}`}>Safety</span>
                            </div>
                            <span className={`text-lg font-bold ${getScoreColor(analysis.safetyScore)}`}>
                                {analysis.safetyScore}/10
                            </span>
                        </div>

                        {/* Educational Value */}
                        <div className={`${surfaceCls} rounded-xl p-3`}>
                            <div className="flex items-center gap-1.5 mb-1">
                                <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                                <span className={`text-xs font-medium ${textMuted}`}>Education</span>
                            </div>
                            <span className={`text-sm font-medium ${textPrimary} line-clamp-2`}>
                                {analysis.educationalValue}
                            </span>
                        </div>

                        {/* Pacing */}
                        <div className={`${surfaceCls} rounded-xl p-3`}>
                            <div className="flex items-center gap-1.5 mb-1">
                                <Gauge className="w-3.5 h-3.5 text-purple-400" />
                                <span className={`text-xs font-medium ${textMuted}`}>Pacing</span>
                            </div>
                            <span className={`text-sm font-medium ${textPrimary} flex items-center gap-1`}>
                                <span>{getPacingIcon(analysis.pacing)}</span>
                                {analysis.pacing}
                            </span>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className={`${surfaceCls} rounded-xl p-3`}>
                        <p
                            className={`text-sm ${textPrimary} leading-relaxed`}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(analysis.summary) }}
                        />
                    </div>

                    {/* Tags */}
                    {analysis.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            <Tag className={`w-3.5 h-3.5 ${textMuted} mt-0.5`} />
                            {analysis.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                        isLight
                                            ? "bg-slate-200 text-slate-600"
                                            : "bg-slate-800 text-slate-300 border border-slate-700"
                                    }`}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={async () => {
                                setApproving(true);
                                await onApprove();
                                setApproving(false);
                            }}
                            disabled={approving || dismissing}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold text-sm transition-all hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50"
                        >
                            {approving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Check className="w-4 h-4" />
                            )}
                            Approve & Download
                        </button>
                        <button
                            onClick={async () => {
                                setDismissing(true);
                                await onDismiss();
                                setDismissing(false);
                            }}
                            disabled={approving || dismissing}
                            className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-medium text-sm transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {dismissing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <X className="w-4 h-4" />
                            )}
                            Dismiss
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
