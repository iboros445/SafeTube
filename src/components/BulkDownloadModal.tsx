"use client";

import { useState, useEffect, useCallback } from "react";
import {
    X,
    Loader2,
    Download,
    List,
    CheckSquare,
    Square,
    Clock,
    Check,
    AlertCircle,
    Trash2,
} from "lucide-react";

interface PlaylistEntry {
    url: string;
    title: string;
    duration?: number;
    selected?: boolean;
}

interface QueueJob {
    id: string;
    url: string;
    title: string;
    status: "pending" | "downloading" | "done" | "error";
    error?: string;
}

interface BulkDownloadModalProps {
    pin: string;
    isOpen: boolean;
    onClose: () => void;
    onListPlaylist: (url: string, limit?: number) => Promise<PlaylistEntry[]>;
    isLight: boolean;
    cardCls: string;
    textPrimary: string;
    textMuted: string;
    inputCls: string;
    btnSurface: string;
    surfaceCls: string;
}

function formatDuration(seconds?: number) {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function BulkDownloadModal({
    pin,
    isOpen,
    onClose,
    onListPlaylist,
    isLight,
    cardCls,
    textPrimary,
    textMuted,
    inputCls,
    btnSurface,
    surfaceCls,
}: BulkDownloadModalProps) {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [entries, setEntries] = useState<PlaylistEntry[]>([]);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [queueJobs, setQueueJobs] = useState<QueueJob[]>([]);
    const [showQueue, setShowQueue] = useState(false);

    // Poll queue status
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(async () => {
            try {
                const res = await fetch("/api/queue");
                const data = await res.json();
                setQueueJobs(data.jobs || []);
            } catch { /* ignore */ }
        }, 2000);
        return () => clearInterval(interval);
    }, [isOpen]);

    const fetchPlaylist = async (limit?: number) => {
        if (!url.trim()) return;
        setLoading(true);
        setError("");
        setEntries([]);

        try {
            const results = await onListPlaylist(url, limit);
            
            if (results.length === 0) {
                setError("No videos found. Make sure this is a valid playlist or channel URL.");
            } else {
                setEntries(results.map((e) => ({ ...e, selected: true })));
            }
        } catch (err) {
            setError(`Failed to load playlist: ${(err as Error).message}`);
        }
        setLoading(false);
    };

    const toggleEntry = (index: number) => {
        setEntries((prev) =>
            prev.map((e, i) => (i === index ? { ...e, selected: !e.selected } : e))
        );
    };

    const toggleAll = () => {
        const allSelected = entries.every((e) => e.selected);
        setEntries((prev) => prev.map((e) => ({ ...e, selected: !allSelected })));
    };

    const submitSelected = async () => {
        const selected = entries.filter((e) => e.selected);
        if (selected.length === 0) return;

        setSubmitting(true);
        try {
            const res = await fetch("/api/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pin,
                    action: "add",
                    urls: selected.map((e) => ({ url: e.url, title: e.title })),
                }),
            });
            const data = await res.json();
            if (data.success) {
                setShowQueue(true);
                setEntries([]);
                setUrl("");
            } else {
                setError(data.error || "Failed to add to queue");
            }
        } catch (err) {
            setError(`Failed: ${(err as Error).message}`);
        }
        setSubmitting(false);
    };

    const clearCompleted = async () => {
        await fetch("/api/queue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin, action: "clear" }),
        });
    };

    if (!isOpen) return null;

    const selectedCount = entries.filter((e) => e.selected).length;
    const activeJobs = queueJobs.filter((j) => j.status === "pending" || j.status === "downloading");
    const doneJobs = queueJobs.filter((j) => j.status === "done");
    const errorJobs = queueJobs.filter((j) => j.status === "error");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className={`${cardCls} w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col`}>
                {/* Header */}
                <div className="p-6 pb-3 flex items-center justify-between border-b border-white/10">
                    <div>
                        <h2 className={`text-lg font-bold ${textPrimary}`}>Bulk Download</h2>
                        <p className={`text-xs ${textMuted}`}>Add entire channels or playlists</p>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-lg ${btnSurface}`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    {/* Unverified content warning */}
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs leading-relaxed">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>
                            <strong>Heads up:</strong> Bulk downloads skip AI safety analysis. Only bulk download from <strong>trusted sources</strong> and channels you have already reviewed and confirmed are suitable for your children.
                        </span>
                    </div>

                    {/* URL Input */}
                    {!showQueue && (
                        <>
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="Paste playlist or channel URL..."
                                    className={`flex-1 px-4 py-2.5 rounded-xl ${inputCls} outline-none text-sm`}
                                />
                            </div>

                            {/* Quick Actions */}
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => fetchPlaylist(5)}
                                    disabled={loading || !url.trim()}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl ${btnSurface} text-xs font-medium transition-all disabled:opacity-50`}
                                >
                                    <Clock className="w-3.5 h-3.5" /> Latest 5
                                </button>
                                <button
                                    onClick={() => fetchPlaylist(10)}
                                    disabled={loading || !url.trim()}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl ${btnSurface} text-xs font-medium transition-all disabled:opacity-50`}
                                >
                                    <List className="w-3.5 h-3.5" /> Latest 10
                                </button>
                                <button
                                    onClick={() => fetchPlaylist()}
                                    disabled={loading || !url.trim()}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl ${btnSurface} text-xs font-medium transition-all disabled:opacity-50`}
                                >
                                    <Download className="w-3.5 h-3.5" /> Load All
                                </button>
                            </div>

                            {loading && (
                                <div className="flex items-center justify-center gap-2 py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                                    <span className={textMuted}>Loading playlist...</span>
                                </div>
                            )}

                            {error && (
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Video List */}
                            {entries.length > 0 && (
                                <>
                                    <div className="flex items-center justify-between">
                                        <button
                                            onClick={toggleAll}
                                            className={`flex items-center gap-1.5 text-xs ${textMuted} hover:${textPrimary} transition-colors`}
                                        >
                                            {entries.every((e) => e.selected) ? (
                                                <CheckSquare className="w-3.5 h-3.5" />
                                            ) : (
                                                <Square className="w-3.5 h-3.5" />
                                            )}
                                            {entries.every((e) => e.selected) ? "Deselect All" : "Select All"}
                                        </button>
                                        <span className={`text-xs ${textMuted}`}>
                                            {selectedCount} of {entries.length} selected
                                        </span>
                                    </div>

                                    <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                                        {entries.map((entry, i) => (
                                            <button
                                                key={entry.url}
                                                onClick={() => toggleEntry(i)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left ${
                                                    entry.selected
                                                        ? `${surfaceCls} ring-1 ring-violet-500/30`
                                                        : `hover:${surfaceCls} opacity-60`
                                                }`}
                                            >
                                                {entry.selected ? (
                                                    <CheckSquare className="w-4 h-4 text-violet-400 flex-shrink-0" />
                                                ) : (
                                                    <Square className={`w-4 h-4 ${textMuted} flex-shrink-0`} />
                                                )}
                                                <span className={`text-sm ${textPrimary} truncate flex-1`}>
                                                    {entry.title}
                                                </span>
                                                {entry.duration && (
                                                    <span className={`text-xs ${textMuted} flex-shrink-0`}>
                                                        {formatDuration(entry.duration)}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={submitSelected}
                                        disabled={submitting || selectedCount === 0}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white font-semibold text-sm transition-all hover:from-violet-600 hover:to-fuchsia-700 disabled:opacity-50"
                                    >
                                        {submitting ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Download className="w-4 h-4" />
                                        )}
                                        Download {selectedCount} Video{selectedCount !== 1 ? "s" : ""}
                                    </button>
                                </>
                            )}
                        </>
                    )}

                    {/* Queue View */}
                    {(showQueue || queueJobs.length > 0) && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className={`text-sm font-semibold ${textPrimary}`}>
                                    Download Queue
                                    {activeJobs.length > 0 && (
                                        <span className="ml-2 text-xs font-normal text-violet-400">
                                            ({activeJobs.length} active)
                                        </span>
                                    )}
                                </h3>
                                <div className="flex gap-2">
                                    {!showQueue && (
                                        <button
                                            onClick={() => setShowQueue(false)}
                                            className={`text-xs ${textMuted} hover:${textPrimary}`}
                                        >
                                            ← Back
                                        </button>
                                    )}
                                    {doneJobs.length > 0 && (
                                        <button
                                            onClick={clearCompleted}
                                            className={`flex items-center gap-1 text-xs ${textMuted} hover:text-red-400`}
                                        >
                                            <Trash2 className="w-3 h-3" /> Clear Done
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                {queueJobs.map((job) => (
                                    <div
                                        key={job.id}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-lg ${surfaceCls}`}
                                    >
                                        {job.status === "pending" && (
                                            <Clock className={`w-4 h-4 ${textMuted} flex-shrink-0`} />
                                        )}
                                        {job.status === "downloading" && (
                                            <Loader2 className="w-4 h-4 text-violet-400 animate-spin flex-shrink-0" />
                                        )}
                                        {job.status === "done" && (
                                            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                        )}
                                        {job.status === "error" && (
                                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                        )}
                                        <span className={`text-sm ${textPrimary} truncate flex-1`}>
                                            {job.title}
                                        </span>
                                        <span className={`text-xs ${textMuted} capitalize flex-shrink-0`}>
                                            {job.status}
                                        </span>
                                    </div>
                                ))}

                                {queueJobs.length === 0 && (
                                    <div className={`text-center py-8 ${textMuted} text-sm`}>
                                        No downloads in queue.
                                    </div>
                                )}
                            </div>

                            {showQueue && entries.length === 0 && (
                                <button
                                    onClick={() => setShowQueue(false)}
                                    className={`w-full py-2.5 rounded-xl ${btnSurface} text-sm font-medium`}
                                >
                                    ← Add More Videos
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
