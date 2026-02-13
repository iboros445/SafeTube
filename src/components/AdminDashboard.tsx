"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Child, Video } from "@/src/db/schema";
import {
    verifyPin,
    addChild,
    deleteChild,
    resetChildTime,
    endChildSession,
    downloadVideoAction,
    deleteVideo,
    updatePin,
    updateRetention,
} from "@/src/lib/actions";
import {
    Shield,
    UserPlus,
    Trash2,
    LogOut,
    Download,
    Film,
    Settings,
    ArrowLeft,
    Loader2,
    Check,
    X,
    RefreshCw,
} from "lucide-react";

interface AdminDashboardProps {
    profiles: Child[];
    videos: Video[];
    settings: Record<string, string>;
}

const AVATAR_COLORS = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f43f5e",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#14b8a6",
    "#06b6d4",
    "#3b82f6",
];

function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
}

export default function AdminDashboard({
    profiles: childrenList,
    videos,
    settings,
}: AdminDashboardProps) {
    const router = useRouter();

    // PIN State
    const [pin, setPin] = useState("");
    const [authenticated, setAuthenticated] = useState(false);
    const [pinError, setPinError] = useState(false);

    // Form States
    const [activeTab, setActiveTab] = useState<"children" | "videos" | "settings">("children");
    const [showAddChild, setShowAddChild] = useState(false);
    const [newChildName, setNewChildName] = useState("");
    const [newChildLimit, setNewChildLimit] = useState(60);
    const [newChildColor, setNewChildColor] = useState(AVATAR_COLORS[0]);
    const [videoUrl, setVideoUrl] = useState("");
    const [downloading, setDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState("");
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Settings State
    const [newPin, setNewPin] = useState("");
    const [retentionDays, setRetentionDays] = useState(settings.retention_days || "7");

    // ── PIN Authentication ─────────────────────────────────────────
    const handlePinSubmit = useCallback(async () => {
        const result = await verifyPin(pin);
        if (result.success) {
            setAuthenticated(true);
            setPinError(false);
        } else {
            setPinError(true);
            setPin("");
        }
    }, [pin]);

    if (!authenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="glass-card p-8 w-full max-w-sm animate-scale-in">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                            <Shield className="w-9 h-9 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Parent Access</h1>
                        <p className="text-safetube-muted text-sm mt-1">Enter your PIN to continue</p>
                    </div>

                    <div className="space-y-4">
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => {
                                setPin(e.target.value);
                                setPinError(false);
                            }}
                            onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
                            placeholder="Enter PIN"
                            maxLength={8}
                            className={`w-full px-4 py-3 rounded-xl bg-safetube-surface border text-center text-2xl tracking-[0.5em] font-mono text-white placeholder:text-safetube-muted placeholder:tracking-normal placeholder:text-base outline-none transition-all ${pinError
                                ? "border-red-500 shake"
                                : "border-safetube-border focus:border-safetube-accent"
                                }`}
                            autoFocus
                        />

                        {pinError && (
                            <p className="text-red-400 text-sm text-center animate-fade-in">
                                Incorrect PIN. Try again.
                            </p>
                        )}

                        <button
                            onClick={handlePinSubmit}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all"
                        >
                            Unlock
                        </button>
                    </div>

                    <button
                        onClick={() => router.push("/")}
                        className="w-full mt-4 py-2 text-safetube-muted hover:text-white text-sm transition-colors flex items-center justify-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Home
                    </button>
                </div>
            </div>
        );
    }

    // ── Authenticated Dashboard ────────────────────────────────────
    return (
        <div className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 animate-fade-in">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Parent Dashboard</h1>
                        <p className="text-safetube-muted text-xs">SafeTube Admin</p>
                    </div>
                </div>
                <button
                    onClick={() => router.push("/")}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-safetube-surface hover:bg-safetube-border text-safetube-muted hover:text-white text-sm transition-all"
                >
                    <ArrowLeft className="w-4 h-4" /> Home
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-safetube-surface rounded-xl mb-8 max-w-md animate-fade-in">
                {(["children", "videos", "settings"] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === tab
                            ? "bg-safetube-accent text-white shadow-lg"
                            : "text-safetube-muted hover:text-white"
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* ── Children Tab ──────────────────────────────────────────── */}
            {activeTab === "children" && (
                <div className="space-y-4 animate-fade-in">
                    {/* Add Child Button */}
                    {!showAddChild ? (
                        <button
                            onClick={() => setShowAddChild(true)}
                            className="glass-card p-4 w-full flex items-center justify-center gap-2 text-safetube-accent hover:text-safetube-accent-hover transition-colors group"
                        >
                            <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span className="font-semibold">Add Child</span>
                        </button>
                    ) : (
                        <div className="glass-card p-6 animate-scale-in">
                            <h3 className="font-semibold text-white mb-4">New Profile</h3>
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={newChildName}
                                    onChange={(e) => setNewChildName(e.target.value)}
                                    placeholder="Child's name"
                                    className="w-full px-4 py-2.5 rounded-xl bg-safetube-surface border border-safetube-border text-white placeholder:text-safetube-muted outline-none focus:border-safetube-accent transition-colors"
                                    autoFocus
                                />
                                <div>
                                    <label className="text-sm text-safetube-muted block mb-2">
                                        Daily limit: {newChildLimit} minutes
                                    </label>
                                    <input
                                        type="range"
                                        min={5}
                                        max={180}
                                        step={5}
                                        value={newChildLimit}
                                        onChange={(e) => setNewChildLimit(Number(e.target.value))}
                                        className="w-full accent-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-safetube-muted block mb-2">Avatar color</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {AVATAR_COLORS.map((color) => (
                                            <button
                                                key={color}
                                                onClick={() => setNewChildColor(color)}
                                                className={`w-8 h-8 rounded-full transition-all ${newChildColor === color
                                                    ? "ring-2 ring-white ring-offset-2 ring-offset-safetube-card scale-110"
                                                    : "hover:scale-110"
                                                    }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={async () => {
                                            if (!newChildName.trim()) return;
                                            setActionLoading("add-child");
                                            await addChild(pin, newChildName, newChildLimit, newChildColor);
                                            setShowAddChild(false);
                                            setNewChildName("");
                                            setNewChildLimit(60);
                                            setActionLoading(null);
                                            router.refresh();
                                        }}
                                        disabled={actionLoading === "add-child"}
                                        className="flex-1 py-2.5 rounded-xl bg-safetube-accent hover:bg-safetube-accent-hover text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {actionLoading === "add-child" ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Check className="w-4 h-4" />
                                        )}
                                        Create
                                    </button>
                                    <button
                                        onClick={() => setShowAddChild(false)}
                                        className="px-4 py-2.5 rounded-xl bg-safetube-surface hover:bg-safetube-border text-safetube-muted hover:text-white transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Children List */}
                    {childrenList.map((child) => (
                        <div key={child.id} className="glass-card p-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div
                                        className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white"
                                        style={{ backgroundColor: child.avatarColor }}
                                    >
                                        {child.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">{child.name}</h3>
                                        <p className="text-safetube-muted text-xs">
                                            {formatTime(child.currentUsageSeconds)} /{" "}
                                            {formatTime(child.dailyLimitSeconds)} today
                                        </p>
                                        {/* Progress bar */}
                                        <div className="w-32 h-1.5 bg-safetube-surface rounded-full mt-1.5 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${Math.min(100, (child.currentUsageSeconds / child.dailyLimitSeconds) * 100)}%`,
                                                    backgroundColor:
                                                        child.currentUsageSeconds >= child.dailyLimitSeconds
                                                            ? "#f87171"
                                                            : child.currentUsageSeconds >= child.dailyLimitSeconds * 0.75
                                                                ? "#fbbf24"
                                                                : "#34d399",
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={async () => {
                                            setActionLoading(`reset-${child.id}`);
                                            await resetChildTime(pin, child.id);
                                            setActionLoading(null);
                                            router.refresh();
                                        }}
                                        disabled={actionLoading === `reset-${child.id}`}
                                        className="p-2 rounded-lg bg-safetube-surface hover:bg-safetube-border text-safetube-muted hover:text-yellow-400 transition-all"
                                        title="Reset time"
                                    >
                                        {actionLoading === `reset-${child.id}` ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="w-4 h-4" />
                                        )}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setActionLoading(`end-${child.id}`);
                                            await endChildSession(pin, child.id);
                                            setActionLoading(null);
                                            router.refresh();
                                        }}
                                        disabled={actionLoading === `end-${child.id}`}
                                        className="p-2 rounded-lg bg-safetube-surface hover:bg-safetube-border text-safetube-muted hover:text-orange-400 transition-all"
                                        title="End session"
                                    >
                                        {actionLoading === `end-${child.id}` ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <LogOut className="w-4 h-4" />
                                        )}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!confirm(`Delete ${child.name}?`)) return;
                                            setActionLoading(`del-${child.id}`);
                                            await deleteChild(pin, child.id);
                                            setActionLoading(null);
                                            router.refresh();
                                        }}
                                        disabled={actionLoading === `del-${child.id}`}
                                        className="p-2 rounded-lg bg-safetube-surface hover:bg-safetube-border text-safetube-muted hover:text-red-400 transition-all"
                                        title="Delete child"
                                    >
                                        {actionLoading === `del-${child.id}` ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {childrenList.length === 0 && (
                        <div className="text-center py-12 text-safetube-muted">
                            <p>No children profiles yet. Create one above!</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Videos Tab ────────────────────────────────────────────── */}
            {activeTab === "videos" && (
                <div className="space-y-4 animate-fade-in">
                    {/* Download Form */}
                    <div className="glass-card p-6">
                        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                            <Download className="w-5 h-5 text-safetube-accent" />
                            Download Video
                        </h3>
                        <div className="flex gap-3">
                            <input
                                type="url"
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                placeholder="Paste YouTube URL..."
                                disabled={downloading}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-safetube-surface border border-safetube-border text-white placeholder:text-safetube-muted outline-none focus:border-safetube-accent transition-colors disabled:opacity-50"
                            />
                            <button
                                onClick={async () => {
                                    if (!videoUrl.trim()) return;
                                    setDownloading(true);
                                    setDownloadStatus("Starting download...");
                                    const result = await downloadVideoAction(pin, videoUrl);
                                    if (result.success) {
                                        setDownloadStatus(`✅ Downloaded: ${result.title}`);
                                        setVideoUrl("");
                                        router.refresh();
                                    } else {
                                        setDownloadStatus(`❌ Error: ${result.error}`);
                                    }
                                    setDownloading(false);
                                }}
                                disabled={downloading || !videoUrl.trim()}
                                className="px-6 py-2.5 rounded-xl bg-safetube-accent hover:bg-safetube-accent-hover text-white font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {downloading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4" />
                                )}
                                {downloading ? "Downloading..." : "Download"}
                            </button>
                        </div>
                        {downloadStatus && (
                            <p className="mt-3 text-sm text-safetube-muted animate-fade-in">
                                {downloadStatus}
                            </p>
                        )}
                    </div>

                    {/* Videos List */}
                    {videos.map((video) => (
                        <div key={video.id} className="glass-card p-4">
                            <div className="flex items-center gap-4">
                                <div className="w-24 h-14 rounded-lg bg-safetube-surface flex-shrink-0 overflow-hidden">
                                    {video.thumbnailPath ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={`/api/media/${video.thumbnailPath}`}
                                            alt={video.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Film className="w-6 h-6 text-safetube-muted" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-white text-sm truncate">
                                        {video.title}
                                    </h4>
                                    <p className="text-safetube-muted text-xs">
                                        {video.durationSeconds
                                            ? formatTime(video.durationSeconds)
                                            : "Unknown duration"}
                                        {video.createdAt &&
                                            ` • Added ${new Date(video.createdAt).toLocaleDateString()}`}
                                    </p>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (!confirm(`Delete "${video.title}"?`)) return;
                                        setActionLoading(`del-v-${video.id}`);
                                        await deleteVideo(pin, video.id);
                                        setActionLoading(null);
                                        router.refresh();
                                    }}
                                    disabled={actionLoading === `del-v-${video.id}`}
                                    className="p-2 rounded-lg bg-safetube-surface hover:bg-safetube-border text-safetube-muted hover:text-red-400 transition-all flex-shrink-0"
                                >
                                    {actionLoading === `del-v-${video.id}` ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}

                    {videos.length === 0 && (
                        <div className="text-center py-12 text-safetube-muted">
                            <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No videos downloaded yet.</p>
                            <p className="text-xs mt-1">Paste a YouTube URL above to get started.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Settings Tab ──────────────────────────────────────────── */}
            {activeTab === "settings" && (
                <div className="space-y-4 animate-fade-in">
                    {/* Change PIN */}
                    <div className="glass-card p-6">
                        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-safetube-accent" />
                            Change Admin PIN
                        </h3>
                        <div className="flex gap-3">
                            <input
                                type="password"
                                value={newPin}
                                onChange={(e) => setNewPin(e.target.value)}
                                placeholder="New PIN"
                                maxLength={8}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-safetube-surface border border-safetube-border text-white placeholder:text-safetube-muted outline-none focus:border-safetube-accent transition-colors"
                            />
                            <button
                                onClick={async () => {
                                    if (!newPin.trim()) return;
                                    setActionLoading("pin");
                                    const result = await updatePin(pin, newPin);
                                    if (result.success) {
                                        setPin(newPin);
                                        setNewPin("");
                                        alert("PIN updated successfully!");
                                    }
                                    setActionLoading(null);
                                }}
                                disabled={actionLoading === "pin"}
                                className="px-6 py-2.5 rounded-xl bg-safetube-accent hover:bg-safetube-accent-hover text-white font-semibold transition-colors disabled:opacity-50"
                            >
                                {actionLoading === "pin" ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    "Update"
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Auto-Delete */}
                    <div className="glass-card p-6">
                        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-safetube-accent" />
                            Auto-Delete Videos
                        </h3>
                        <div className="flex gap-3 items-center">
                            <label className="text-safetube-muted text-sm">Delete videos older than</label>
                            <input
                                type="number"
                                value={retentionDays}
                                onChange={(e) => setRetentionDays(e.target.value)}
                                min={1}
                                max={365}
                                className="w-20 px-3 py-2 rounded-xl bg-safetube-surface border border-safetube-border text-white text-center outline-none focus:border-safetube-accent transition-colors"
                            />
                            <span className="text-safetube-muted text-sm">days</span>
                            <button
                                onClick={async () => {
                                    setActionLoading("retention");
                                    await updateRetention(pin, Number(retentionDays));
                                    setActionLoading(null);
                                    router.refresh();
                                }}
                                disabled={actionLoading === "retention"}
                                className="px-4 py-2 rounded-xl bg-safetube-accent hover:bg-safetube-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-50"
                            >
                                {actionLoading === "retention" ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    "Save"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
