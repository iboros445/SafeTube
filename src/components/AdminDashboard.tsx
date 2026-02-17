"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Child, Video } from "@/src/db/schema";
import {
    verifyPin,
    addChild,
    addChild as createChildProfile,
    updateChild,
    updateChild as updateChildProfile,
    deleteChild,
    deleteChild as deleteChildProfile,
    resetChildTime,
    endChildSession,
    downloadVideoAction,
    deleteVideo,
    bulkDeleteVideos,
    updatePin,
    updateRetention,
    updateSetting,
    uploadAvatarPhoto,
    punishChild,
    uploadSubtitle,
    adminLogout,
    getChildWatchHistory,
    updateVideoProgressAdmin,
    searchYouTubeAction,
    listPlaylistAction,
    dismissVideo as dismissVideoAction,
    approveAndDownload,
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
    Sun,
    Moon,
    Camera,
    Smile,
    Palette,
    Clock,
    Upload,
    Languages,
    ChevronDown,
    ChevronUp,
    Play,
    CheckSquare,
    Square,
    Sparkles, // Added
} from "lucide-react";
import { toast } from "sonner";
import Avatar from "@/src/components/Avatar";
import AISettings from "@/src/components/AISettings";
import ReviewCard from "@/src/components/ReviewCard";
import DownloadManager from "@/src/components/DownloadManager";
import DiscoverTab from "@/src/components/DiscoverTab";
// Force rebuild for HMR
import { isAIEnabled } from "@/src/lib/ai-actions";

import type { SearchResult } from "@/src/lib/video-downloader";
import type { AnalysisResult } from "@/src/lib/analysis-service";
import type { QueueJob } from "@/src/lib/channel-worker";

interface AdminDashboardProps {
    profiles: Child[];
    videos: Video[];
    settings: Record<string, string>;
    initialIsAdmin?: boolean;
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

const POPULAR_EMOJIS = [
    "🦁", "🐻", "🐼", "🐨", "🦊", "🐰", "🐸", "🦄",
    "🐶", "🐱", "🐵", "🦋", "🌟", "🚀", "🎮", "⚽",
    "🎨", "🎵", "🌈", "🍕", "🧸", "👑", "💎", "🔥",
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
    initialIsAdmin = false,
}: AdminDashboardProps) {
    const router = useRouter();

    // PIN State
    const [pin, setPin] = useState("");
    const [authenticated, setAuthenticated] = useState(initialIsAdmin);
    const [pinError, setPinError] = useState(false);

    // Form States
    const [activeTab, setActiveTab] = useState<"children" | "videos" | "settings" | "discover">("children");
    const [aiEnabled, setAiEnabled] = useState(false);

    // Check AI status on mount
    useEffect(() => {
        isAIEnabled().then(setAiEnabled);
    }, []);

    const [showAddChild, setShowAddChild] = useState(false);
    const [newChildName, setNewChildName] = useState("");
    const [newChildLimit, setNewChildLimit] = useState(60);
    const [newChildColor, setNewChildColor] = useState(AVATAR_COLORS[0]);
    const [newChildAvatarType, setNewChildAvatarType] = useState<"color" | "emoji" | "photo">("color");
    const [newChildEmoji, setNewChildEmoji] = useState("🦁");
    const [newChildTheme, setNewChildTheme] = useState<"dark" | "light">("dark");
    const [newChildPhoto, setNewChildPhoto] = useState<File | null>(null);
    const createPhotoInputRef = useRef<HTMLInputElement>(null);
    const [videoUrl, setVideoUrl] = useState("");
    const [downloading, setDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState("");
    const [subtitlingVideoId, setSubtitlingVideoId] = useState<number | null>(null);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

    const [searching, setSearching] = useState(false);
    const [selectedVideos, setSelectedVideos] = useState<Set<number>>(new Set());

    // Global Queue State
    const [queueJobs, setQueueJobs] = useState<QueueJob[]>([]);

    // Poll queue status globally
    // We also use this to refresh the page when a job finishes
    const prevJobsRef = useRef<QueueJob[]>([]);
    useEffect(() => {
        if (!authenticated) return;
        
        const fetchQueue = async () => {
            try {
                const res = await fetch("/api/queue");
                if (res.ok) {
                    const data = await res.json();
                    const newJobs = data.jobs || [];
                    
                    // If any job transitioned from not-done to done, refresh the page
                    const hadFinishedJob = newJobs.some((job: QueueJob) => {
                        const prev = prevJobsRef.current.find(p => p.id === job.id);
                        return job.status === "done" && (!prev || prev.status !== "done");
                    });

                    if (hadFinishedJob) {
                        router.refresh();
                    }

                    prevJobsRef.current = newJobs;
                    setQueueJobs(newJobs);
                }
            } catch { /* ignore */ }
        };

        fetchQueue();
        const interval = setInterval(fetchQueue, 3000);
        return () => clearInterval(interval);
    }, [authenticated, router]);

    // AI Pending Reviews
    const [pendingReviews, setPendingReviews] = useState<Array<{
        url: string;
        title: string;
        analysis: AnalysisResult;
    }>>([]);
    const subtitleInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
    const [confirmingPunish, setConfirmingPunish] = useState<number | null>(null);
    const [editingColor, setEditingColor] = useState<number | null>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);

    // Watch History State
    const [expandedHistory, setExpandedHistory] = useState<number | null>(null);
    const [watchHistory, setWatchHistory] = useState<Awaited<ReturnType<typeof getChildWatchHistory>>>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Settings State
    const [newPin, setNewPin] = useState("");
    const [retentionDays, setRetentionDays] = useState(settings.retention_days || "7");
    const [adminTheme, setAdminTheme] = useState<"dark" | "light">(
        (settings.admin_theme as "dark" | "light") || "dark"
    );
    const isLight = adminTheme === "light";
    const [cookieSaved, setCookieSaved] = useState(false);
    const [showCookieModal, setShowCookieModal] = useState(false);

    // Theme helper classes (Slate refinement)
    // Theme helper classes (Slate refinement - Explicit Dark Mode)
    const bg = isLight ? "bg-slate-50" : "bg-slate-950";
    const cardCls = isLight ? "bg-white rounded-2xl shadow-sm border border-slate-200" : "bg-slate-900 rounded-2xl shadow-sm border border-slate-800";
    const textPrimary = isLight ? "text-slate-900" : "text-white";
    const textMuted = isLight ? "text-slate-500" : "text-slate-400";
    const surfaceCls = isLight ? "bg-slate-100" : "bg-slate-800/50";
    const borderCls = isLight ? "border-slate-300" : "border-slate-700";
    const inputCls = isLight
        ? "bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500"
        : "bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500";
    const tabBg = isLight ? "bg-slate-200" : "bg-slate-900 border border-slate-800";
    const tabActive = isLight ? "bg-white text-slate-900 shadow-sm" : "bg-slate-800 text-white shadow-sm border border-slate-700";
    const tabInactive = isLight ? "text-slate-500 hover:text-slate-700" : "text-slate-400 hover:text-slate-200";
    const btnSurface = isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900" : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/50";
    const homeBtn = isLight ? "bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 border border-slate-200 shadow-sm" : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700";
    const ringOffsetCls = isLight ? "ring-offset-white" : "ring-offset-slate-900";

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
            <div className={`min-h-screen flex items-center justify-center p-6 ${bg} transition-colors`}>
                <div className={`${cardCls} p-8 w-full max-w-sm animate-scale-in`}>
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                            <Shield className="w-9 h-9 text-white" />
                        </div>
                        <h1 className={`text-2xl font-bold ${textPrimary}`}>Parent Access</h1>
                        <p className={`${textMuted} text-sm mt-1`}>Enter your PIN to continue</p>
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
                            className={`w-full px-4 py-3 rounded-xl ${inputCls} text-center text-2xl tracking-[0.5em] font-mono placeholder:text-safetube-muted placeholder:tracking-normal placeholder:text-base outline-none transition-all ${pinError
                                ? "border-red-500 shake"
                                : isLight ? "border-slate-300 focus:border-indigo-500" : "border-slate-700 focus:border-indigo-500"
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
                        className={`w-full mt-4 py-2 ${textMuted} hover:${textPrimary} text-sm transition-colors flex items-center justify-center gap-2`}
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Home
                    </button>
                </div>
            </div>
        );
    }

    // ── Authenticated Dashboard ────────────────────────────────────
    return (
        <div className={`min-h-screen ${bg} transition-colors`}>
            <div className="p-6 md:p-10 max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-bold ${textPrimary}`}>Parent Dashboard</h1>
                            <p className={`${textMuted} text-xs`}>SafeTube Admin</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.push("/")}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl ${homeBtn} text-sm transition-all`}
                        >
                            <ArrowLeft className="w-4 h-4" /> Home
                        </button>
                        <button
                            onClick={async () => {
                                await adminLogout();
                                setAuthenticated(false);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-sm transition-all`}
                        >
                            <LogOut className="w-4 h-4" /> Logout
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className={`flex gap-1 p-1 ${tabBg} rounded-xl mb-8 ${aiEnabled ? 'max-w-lg' : 'max-w-md'} animate-fade-in`}>
                    {(["children", "videos", "settings", ...(aiEnabled ? ["discover" as const] : [])] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === tab
                                ? tabActive
                                : tabInactive
                                } ${tab === "discover" ? "flex items-center justify-center gap-1.5" : ""}`}
                        >
                            {tab === "discover" && <span className="text-xs">✨</span>}
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
                                className={`${cardCls} p-4 w-full flex items-center justify-center gap-2 text-safetube-accent hover:text-safetube-accent-hover transition-colors group`}
                            >
                                <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                <span className="font-semibold">Add Child</span>
                            </button>
                        ) : (
                            <div className={`${cardCls} p-6 animate-scale-in`}>
                                <h3 className="font-semibold text-white mb-4">New Profile</h3>
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        value={newChildName}
                                        onChange={(e) => setNewChildName(e.target.value)}
                                        placeholder="Child's name"
                                        className={`w-full px-4 py-2.5 rounded-xl ${inputCls} outline-none transition-colors`}
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

                                    {/* Avatar Type Selector */}
                                    <div>
                                        <label className="text-sm text-safetube-muted block mb-2">Avatar style</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setNewChildAvatarType("color")}
                                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${newChildAvatarType === "color"
                                                    ? "bg-safetube-accent text-white"
                                                    : `${btnSurface}`
                                                    }`}
                                            >
                                                <Palette className="w-3.5 h-3.5" /> Color
                                            </button>
                                            <button
                                                onClick={() => setNewChildAvatarType("emoji")}
                                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${newChildAvatarType === "emoji"
                                                    ? "bg-safetube-accent text-white"
                                                    : `${btnSurface}`
                                                    }`}
                                            >
                                                <Smile className="w-3.5 h-3.5" /> Emoji
                                            </button>
                                            <button
                                                onClick={() => setNewChildAvatarType("photo")}
                                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${newChildAvatarType === "photo"
                                                    ? "bg-safetube-accent text-white"
                                                    : `${btnSurface}`
                                                    }`}
                                            >
                                                <Camera className="w-3.5 h-3.5" /> Photo
                                            </button>
                                        </div>
                                    </div>

                                    {/* Avatar Color */}
                                    <div>
                                        <label className="text-sm text-safetube-muted block mb-2">
                                            {newChildAvatarType === "photo" ? "Fallback color" : "Avatar color"}
                                        </label>
                                        <div className="flex gap-2 flex-wrap">
                                            {AVATAR_COLORS.map((color) => (
                                                <button
                                                    key={color}
                                                    onClick={() => setNewChildColor(color)}
                                                    className={`w-8 h-8 rounded-full transition-all ${newChildColor === color
                                                        ? `ring-2 ring-white ring-offset-2 ${ringOffsetCls} scale-110`
                                                        : "hover:scale-110"
                                                        }`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Emoji Picker */}
                                    {newChildAvatarType === "emoji" && (
                                        <div>
                                            <label className="text-sm text-safetube-muted block mb-2">Choose emoji</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {POPULAR_EMOJIS.map((emoji) => (
                                                    <button
                                                        key={emoji}
                                                        onClick={() => setNewChildEmoji(emoji)}
                                                        className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${newChildEmoji === emoji
                                                            ? "bg-safetube-accent ring-2 ring-white scale-110"
                                                            : `${btnSurface} hover:scale-110`
                                                            }`}
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Photo picker */}
                                    {newChildAvatarType === "photo" && (
                                        <div>
                                            <label className="text-sm text-safetube-muted block mb-2">Upload photo</label>
                                            <input
                                                ref={createPhotoInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) setNewChildPhoto(file);
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => createPhotoInputRef.current?.click()}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl ${btnSurface} transition-all text-sm`}
                                            >
                                                <Camera className="w-4 h-4" />
                                                {newChildPhoto ? newChildPhoto.name : "Choose photo..."}
                                            </button>
                                        </div>
                                    )}

                                    {/* Theme Selector */}
                                    <div>
                                        <label className="text-sm text-safetube-muted block mb-2">Theme</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setNewChildTheme("dark")}
                                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${newChildTheme === "dark"
                                                    ? "bg-safetube-accent text-white"
                                                    : `${btnSurface}`
                                                    }`}
                                            >
                                                <Moon className="w-3.5 h-3.5" /> Dark
                                            </button>
                                            <button
                                                onClick={() => setNewChildTheme("light")}
                                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${newChildTheme === "light"
                                                    ? "bg-safetube-accent text-white"
                                                    : `${btnSurface}`
                                                    }`}
                                            >
                                                <Sun className="w-3.5 h-3.5" /> Light
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                if (!newChildName.trim()) return;
                                                setActionLoading("add-child");
                                                const result = await addChild(
                                                    pin,
                                                    newChildName,
                                                    newChildLimit,
                                                    newChildColor,
                                                    newChildAvatarType,
                                                    newChildAvatarType === "emoji" ? newChildEmoji : undefined,
                                                    newChildTheme
                                                );
                                                // Upload photo if selected
                                                if (newChildPhoto && result.success && result.childId) {
                                                    const formData = new FormData();
                                                    formData.append("photo", newChildPhoto);
                                                    await uploadAvatarPhoto(pin, result.childId, formData);
                                                }
                                                setShowAddChild(false);
                                                setNewChildName("");
                                                setNewChildLimit(60);
                                                setNewChildAvatarType("color");
                                                setNewChildEmoji("🦁");
                                                setNewChildTheme("dark");
                                                setNewChildPhoto(null);
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
                                            className={`px-4 py-2.5 rounded-xl ${btnSurface} transition-colors`}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Children List */}
                        {childrenList.map((child) => (
                            <div key={child.id} className={`${cardCls} p-5 relative`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Avatar child={child} size="sm" />
                                        <h3 className={`font-semibold ${textPrimary} flex items-center gap-2`}>
                                            {child.name}
                                            {child.theme === "light" ? (
                                                <Sun className="w-3.5 h-3.5 text-yellow-500" />
                                            ) : (
                                                <Moon className="w-3.5 h-3.5 text-blue-500" />
                                            )}
                                            <button
                                                onClick={() => setEditingColor(editingColor === child.id ? null : child.id)}
                                                className={`w-4 h-4 rounded-full border border-white/20 hover:scale-110 transition-transform ml-1`}
                                                style={{ backgroundColor: child.avatarColor }}
                                                title="Change color"
                                            />
                                        </h3>
                                        <p className="text-safetube-muted text-xs">
                                            {formatTime(child.currentUsageSeconds)} /{" "}
                                            {formatTime(child.dailyLimitSeconds)} today
                                        </p>
                                        {/* Progress bar */}
                                        <div className={`w-32 h-1.5 ${isLight ? "bg-slate-200" : "bg-slate-800"} rounded-full mt-1.5 overflow-hidden`}>
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

                                {/* Color Picker Overlay */
                                    editingColor === child.id && (
                                        <div className="absolute left-20 top-16 z-10 p-2 rounded-xl bg-safetube-surface border border-safetube-border shadow-xl animate-scale-in flex gap-1 flex-wrap w-48">
                                            {AVATAR_COLORS.map((c) => (
                                                <button
                                                    key={c}
                                                    onClick={async () => {
                                                        await updateChild(pin, child.id, { avatarColor: c });
                                                        setEditingColor(null);
                                                        router.refresh();
                                                    }}
                                                    className="w-8 h-8 rounded-full border-2 border-transparent hover:scale-110 transition-transform"
                                                    style={{ backgroundColor: c, borderColor: child.avatarColor === c ? "white" : "transparent" }}
                                                />
                                            ))}
                                        </div>
                                    )}

                                <div className="mt-4 pt-4 border-t border-gray-200/10 flex items-center justify-between gap-4">
                                    {/* Edit Limit */}
                                    <div className="flex items-center gap-2">
                                        <Clock className={`w-4 h-4 ${textMuted}`} />
                                        <input
                                            type="number"
                                            defaultValue={Math.round(child.dailyLimitSeconds / 60)}
                                            onBlur={async (e) => {
                                                const val = parseInt(e.target.value);
                                                if (!isNaN(val) && val > 0 && val !== Math.round(child.dailyLimitSeconds / 60)) {
                                                    setActionLoading(`limit-${child.id}`);
                                                    await updateChild(pin, child.id, { dailyLimitMinutes: val });
                                                    setActionLoading(null);
                                                    router.refresh();
                                                }
                                            }}
                                            className={`w-14 px-2 py-1 rounded-lg ${inputCls} text-xs text-center`}
                                            title="Daily limit (minutes)"
                                        />
                                        <span className={`text-xs ${textMuted}`}>min</span>
                                        {actionLoading === `limit-${child.id}` && <Loader2 className="w-3 h-3 animate-spin text-safetube-accent" />}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        {/* Punishment / Time's Up */}
                                        {/* Punishment / Time's Up */}
                                        {confirmingPunish === child.id ? (
                                            <div className="flex items-center gap-1 animate-scale-in">
                                                <button
                                                    onClick={async () => {
                                                        setActionLoading(`punish-${child.id}`);
                                                        await punishChild(pin, child.id);
                                                        setActionLoading(null);
                                                        setConfirmingPunish(null);
                                                        router.refresh();
                                                    }}
                                                    disabled={actionLoading === `punish-${child.id}`}
                                                    className="p-1 rounded bg-red-100 hover:bg-red-200 text-red-600 transition-all"
                                                >
                                                    {actionLoading === `punish-${child.id}` ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Check className="w-4 h-4" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => setConfirmingPunish(null)}
                                                    className={`p-1 rounded ${btnSurface} transition-all`}
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmingPunish(child.id)}
                                                className={`p-2 rounded-lg ${btnSurface} hover:text-red-500 transition-all`}
                                                title="Enough screens for the day"
                                            >
                                                <div className="relative">
                                                    <Clock className="w-4 h-4" />
                                                    <X className="w-3 h-3 absolute -bottom-1.5 -right-1.5 text-red-500 bg-white rounded-full ring-1 ring-white" />
                                                </div>
                                            </button>
                                        )}

                                        {/* Theme toggle */}
                                        <button
                                            onClick={async () => {
                                                const newTheme = child.theme === "dark" ? "light" : "dark";
                                                setActionLoading(`theme-${child.id}`);
                                                await updateChild(pin, child.id, { theme: newTheme });
                                                setActionLoading(null);
                                                router.refresh();
                                            }}
                                            disabled={actionLoading === `theme-${child.id}`}
                                            className={`p-2 rounded-lg ${btnSurface} hover:text-blue-400 transition-all`}
                                            title={`Switch to ${child.theme === "dark" ? "light" : "dark"} theme`}
                                        >
                                            {actionLoading === `theme-${child.id}` ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : child.theme === "dark" ? (
                                                <Sun className="w-4 h-4" />
                                            ) : (
                                                <Moon className="w-4 h-4" />
                                            )}
                                        </button>
                                        {/* Upload photo */}
                                        <button
                                            onClick={() => {
                                                photoInputRef.current?.setAttribute("data-child-id", String(child.id));
                                                photoInputRef.current?.click();
                                            }}
                                            className={`p-2 rounded-lg ${btnSurface} hover:text-purple-400 transition-all`}
                                            title="Upload avatar photo"
                                        >
                                            <Camera className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={async () => {
                                                setActionLoading(`reset-${child.id}`);
                                                await resetChildTime(pin, child.id);
                                                setActionLoading(null);
                                                router.refresh();
                                            }}
                                            disabled={actionLoading === `reset-${child.id}`}
                                            className={`p-2 rounded-lg ${btnSurface} hover:text-yellow-400 transition-all`}
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
                                            className={`p-2 rounded-lg ${btnSurface} hover:text-orange-400 transition-all`}
                                            title="End session"
                                        >
                                            {actionLoading === `end-${child.id}` ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <LogOut className="w-4 h-4" />
                                            )}
                                        </button>
                                        {confirmingDelete === `child-${child.id}` ? (
                                            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 animate-fade-in">
                                                <span className="text-xs text-red-400 font-medium whitespace-nowrap">Delete?</span>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            setActionLoading(`del-${child.id}`);
                                                            await deleteChild(pin, child.id);
                                                            router.refresh();
                                                        } catch (err) {
                                                            console.error("Failed to delete child:", err);
                                                        } finally {
                                                            setActionLoading(null);
                                                            setConfirmingDelete(null);
                                                        }
                                                    }}
                                                    disabled={actionLoading === `del-${child.id}`}
                                                    className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-all"
                                                >
                                                    {actionLoading === `del-${child.id}` ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Check className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => setConfirmingDelete(null)}
                                                    className={`p-1 rounded ${btnSurface} transition-all`}
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmingDelete(`child-${child.id}`)}
                                                className={`p-2 rounded-lg ${btnSurface} hover:text-red-400 transition-all`}
                                                title="Delete child"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}

                                        {/* Watch History toggle */}
                                        <button
                                            onClick={async () => {
                                                if (expandedHistory === child.id) {
                                                    setExpandedHistory(null);
                                                    return;
                                                }
                                                setHistoryLoading(true);
                                                setExpandedHistory(child.id);
                                                const data = await getChildWatchHistory(child.id);
                                                setWatchHistory(data);
                                                setHistoryLoading(false);
                                            }}
                                            className={`p-2 rounded-lg ${expandedHistory === child.id ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : btnSurface} hover:text-indigo-400 transition-all`}
                                            title="Watch history"
                                        >
                                            <Film className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* ── Watch History Panel ── */}
                                {expandedHistory === child.id && (
                                    <div className={`mt-4 pt-4 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'} animate-fade-in`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className={`text-sm font-semibold ${textPrimary} flex items-center gap-2`}>
                                                <Play className="w-3.5 h-3.5 text-indigo-400" />
                                                Watch History
                                            </h4>
                                            <button
                                                onClick={() => setExpandedHistory(null)}
                                                className={`p-1 rounded-lg ${btnSurface} transition-all`}
                                            >
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {historyLoading ? (
                                            <div className="flex items-center justify-center py-6">
                                                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                                            </div>
                                        ) : watchHistory.length === 0 ? (
                                            <div className={`text-center py-6 ${textMuted} text-sm`}>
                                                <Film className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                <p>No videos watched yet</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {watchHistory.map((entry) => {
                                                    const duration = entry.durationSeconds || 1;
                                                    const pct = Math.min(100, (entry.progressSeconds / duration) * 100);
                                                    return (
                                                        <div
                                                            key={entry.progressId}
                                                            className={`flex gap-3 p-3 rounded-xl ${surfaceCls} transition-all`}
                                                        >
                                                            {/* Thumbnail */}
                                                            <div className="w-20 h-14 rounded-lg overflow-hidden bg-black/30 flex-shrink-0 relative">
                                                                {entry.thumbnailPath ? (
                                                                    <img
                                                                        src={`/api/media/${entry.thumbnailPath}`}
                                                                        alt={entry.title}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                        <Film className={`w-5 h-5 ${textMuted}`} />
                                                                    </div>
                                                                )}
                                                                {/* Progress overlay bar */}
                                                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                                                                    <div
                                                                        className="h-full bg-indigo-500 transition-all"
                                                                        style={{ width: `${pct}%` }}
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Info + Slider */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-xs font-medium ${textPrimary} truncate`}>
                                                                    {entry.title}
                                                                </p>
                                                                <p className={`text-[10px] ${textMuted} mt-0.5`}>
                                                                    {formatTime(entry.progressSeconds)} / {formatTime(duration)}
                                                                </p>
                                                                {/* Seek bar */}
                                                                <input
                                                                    type="range"
                                                                    min={0}
                                                                    max={duration}
                                                                    step={1}
                                                                    defaultValue={entry.progressSeconds}
                                                                    onMouseUp={async (e) => {
                                                                        const val = Number((e.target as HTMLInputElement).value);
                                                                        setActionLoading(`progress-${entry.progressId}`);
                                                                        await updateVideoProgressAdmin(pin, child.id, entry.videoId, val);
                                                                        setActionLoading(null);
                                                                        // Refresh the history panel
                                                                        const data = await getChildWatchHistory(child.id);
                                                                        setWatchHistory(data);
                                                                    }}
                                                                    onTouchEnd={async (e) => {
                                                                        const val = Number((e.target as HTMLInputElement).value);
                                                                        setActionLoading(`progress-${entry.progressId}`);
                                                                        await updateVideoProgressAdmin(pin, child.id, entry.videoId, val);
                                                                        setActionLoading(null);
                                                                        const data = await getChildWatchHistory(child.id);
                                                                        setWatchHistory(data);
                                                                    }}
                                                                    className="w-full h-1.5 mt-2 accent-indigo-500 cursor-pointer"
                                                                    title="Drag to adjust resume position"
                                                                />
                                                                {actionLoading === `progress-${entry.progressId}` && (
                                                                    <div className="flex items-center gap-1 mt-1">
                                                                        <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                                                                        <span className="text-[10px] text-indigo-400">Saving...</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}

                        {childrenList.length === 0 && (
                            <div className="text-center py-12 text-safetube-muted">
                                <p>No children profiles yet. Create one above!</p>
                            </div>
                        )}

                        {/* Hidden file input for photo upload */}
                        <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                const childIdStr = photoInputRef.current?.getAttribute("data-child-id");
                                if (!file || !childIdStr) return;
                                const childId = Number(childIdStr);
                                setActionLoading(`photo-${childId}`);
                                const formData = new FormData();
                                formData.append("photo", file);
                                await uploadAvatarPhoto(pin, childId, formData);
                                setActionLoading(null);
                                e.target.value = "";
                                router.refresh();
                            }}
                        />
                    </div>
                )}

                {/* ── Videos Tab ────────────────────────────────────────────── */}
                {
                    activeTab === "videos" && (
                        <div className="space-y-4 animate-fade-in">
                            {/* Download Form */}
                            <div className={`${cardCls} p-6`}>
                                <h3 className={`font-semibold ${textPrimary} mb-4 flex items-center gap-2`}>
                                    <Download className="w-5 h-5 text-safetube-accent" />
                                    Download Video
                                </h3>
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        value={videoUrl}
                                        onChange={(e) => { setVideoUrl(e.target.value); setSearchResults([]); }}
                                        placeholder="Paste YouTube URL or search..."
                                        disabled={downloading || searching}
                                        className={`flex-1 px-4 py-2.5 rounded-xl ${inputCls} outline-none transition-colors disabled:opacity-50`}
                                    />
                                    <button
                                        onClick={() => setShowBulkModal(true)}
                                        className={`px-4 py-2.5 rounded-xl ${btnSurface} text-sm font-medium transition-all flex items-center gap-1.5 hover:ring-1 ring-violet-500/50`}
                                        title="Bulk download from playlist/channel"
                                    >
                                        📋 Bulk
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!videoUrl.trim()) return;
                                            const looksLikeUrl = /^https?:\/\//.test(videoUrl.trim()) || /youtube\.com|youtu\.be/.test(videoUrl.trim());
                                            if (!looksLikeUrl) {
                                                // Search mode
                                                setSearching(true);
                                                setDownloadStatus("🔍 Searching YouTube...");
                                                setSearchResults([]);
                                                const results = await searchYouTubeAction(videoUrl.trim(), 6);
                                                setSearchResults(results);
                                                setDownloadStatus(results.length > 0 ? `Found ${results.length} results — pick one to download` : "No results found");
                                                setSearching(false);
                                                return;
                                            }
                                            setDownloading(true);
                                            setSearchResults([]);
                                            setDownloadStatus("Analyzing video...");
                                            const result = await downloadVideoAction(pin, videoUrl);
                                            if (result.success) {
                                                if ((result as { pendingReview?: boolean }).pendingReview) {
                                                    setPendingReviews((prev) => [...prev, {
                                                        url: (result as { url: string }).url,
                                                        title: result.title || "Untitled",
                                                        analysis: (result as { analysis: AnalysisResult }).analysis,
                                                    }]);
                                                    setDownloadStatus(`🔍 AI analysis complete — review below`);
                                                    setVideoUrl("");
                                                } else if ((result as { queued?: boolean }).queued) {
                                                    setDownloadStatus(`📥 Queued for download — check progress in Bulk panel`);
                                                    setVideoUrl("");
                                                } else {
                                                    setDownloadStatus(`✅ Downloaded: ${result.title}`);
                                                    setVideoUrl("");
                                                    router.refresh();
                                                }
                                            } else {
                                                setDownloadStatus(`❌ Error: ${result.error}`);
                                            }
                                            setDownloading(false);
                                        }}
                                        disabled={(downloading || searching) || !videoUrl.trim()}
                                        className="px-6 py-2.5 rounded-xl bg-safetube-accent hover:bg-safetube-accent-hover text-white font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {(downloading || searching) ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Download className="w-4 h-4" />
                                        )}
                                        {downloading ? "Downloading..." : searching ? "Searching..." : (/^https?:\/\//.test(videoUrl.trim()) || /youtube\.com|youtu\.be/.test(videoUrl.trim()) ? "Download" : videoUrl.trim() ? "Search" : "Download")}
                                    </button>
                                </div>
                                {downloadStatus && (
                                    <p className={`mt-3 text-sm ${textMuted} animate-fade-in`}>
                                        {downloadStatus}
                                    </p>
                                )}

                                {/* Search Results */}
                                {searchResults.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        {searchResults.map((sr, i) => (
                                            <button
                                                key={sr.url + i}
                                                onClick={async () => {
                                                    setVideoUrl(sr.url);
                                                    setSearchResults([]);
                                                    setDownloading(true);
                                                    setDownloadStatus(`Downloading: ${sr.title}...`);
                                                    const result = await downloadVideoAction(pin, sr.url);
                                                    if (result.success) {
                                                        if ((result as { pendingReview?: boolean }).pendingReview) {
                                                            setPendingReviews((prev) => [...prev, {
                                                                url: (result as { url: string }).url,
                                                                title: result.title || "Untitled",
                                                                analysis: (result as { analysis: AnalysisResult }).analysis,
                                                            }]);
                                                            setDownloadStatus(`🔍 AI analysis complete — review below`);
                                                        } else if ((result as { queued?: boolean }).queued) {
                                                            setDownloadStatus(`📥 Queued: ${sr.title}`);
                                                        } else {
                                                            setDownloadStatus(`✅ Downloaded: ${result.title}`);
                                                            router.refresh();
                                                        }
                                                        setVideoUrl("");
                                                    } else {
                                                        setDownloadStatus(`❌ Error: ${result.error}`);
                                                    }
                                                    setDownloading(false);
                                                }}
                                                disabled={downloading}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${surfaceCls} hover:ring-1 ring-violet-500/30 transition-all text-left disabled:opacity-50`}
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                                                    {i + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium ${textPrimary} truncate`}>{sr.title}</p>
                                                    <p className={`text-xs ${textMuted} truncate`}>
                                                        {sr.channel || "Unknown channel"}
                                                        {sr.duration ? ` • ${Math.floor(sr.duration / 60)}:${(sr.duration % 60).toString().padStart(2, "0")}` : ""}
                                                    </p>
                                                </div>
                                                <Download className={`w-4 h-4 ${textMuted} flex-shrink-0`} />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Pending AI Review Cards */}
                            {pendingReviews.map((review) => (
                                <ReviewCard
                                    key={review.url}
                                    videoTitle={review.title}
                                    videoUrl={review.url}
                                    analysis={review.analysis}
                                    isLight={isLight}
                                    cardCls={cardCls}
                                    textPrimary={textPrimary}
                                    textMuted={textMuted}
                                    surfaceCls={surfaceCls}
                                    btnSurface={btnSurface}
                                    onApprove={async () => {
                                        const result = await approveAndDownload(pin, review.url, review.analysis);
                                        if (result.success) {
                                            setPendingReviews((prev) => prev.filter((r) => r.url !== review.url));
                                            setDownloadStatus(`✅ Approved & downloaded: ${review.title}`);
                                            router.refresh();
                                        }
                                    }}
                                    onDismiss={async () => {
                                        await dismissVideoAction(pin, review.url);
                                        setPendingReviews((prev) => prev.filter((r) => r.url !== review.url));
                                        setDownloadStatus(`Dismissed: ${review.title}`);
                                    }}
                                />
                            ))}

                            {/* Upload Local Video */}
                            <div className={`${cardCls} p-6`}>
                                <h3 className={`font-semibold ${textPrimary} mb-4 flex items-center gap-2`}>
                                    <Film className="w-5 h-5 text-safetube-accent" />
                                    Upload Local Video (MP4, MKV)
                                </h3>
                                <div className="flex gap-3 items-center">
                                    <input
                                        type="file"
                                        accept=".mp4,.mkv,.webm"
                                        ref={fileInputRef}
                                        disabled={uploading}
                                        className={`flex-1 px-4 py-2 rounded-xl ${inputCls} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-safetube-accent file:text-white hover:file:bg-safetube-accent-hover text-sm`}
                                    />
                                    <button
                                        onClick={async () => {
                                            const file = fileInputRef.current?.files?.[0];
                                            if (!file) return;

                                            setUploading(true);
                                            setUploadProgress(0);
                                            setUploadStatus("Uploading...");

                                            const formData = new FormData();
                                            formData.append("file", file);
                                            formData.append("pin", pin);

                                            try {
                                                const xhr = new XMLHttpRequest();
                                                xhr.open("POST", "/api/upload");

                                                xhr.upload.onprogress = (event) => {
                                                    if (event.lengthComputable) {
                                                        const percent = Math.round((event.loaded / event.total) * 100);
                                                        setUploadProgress(percent);
                                                    }
                                                };

                                                xhr.onload = () => {
                                                    if (xhr.status === 200) {
                                                        setUploadStatus(`✅ Uploaded: ${file.name}`);
                                                        if (fileInputRef.current) fileInputRef.current.value = "";
                                                        router.refresh();
                                                    } else {
                                                        const resp = JSON.parse(xhr.responseText || "{}");
                                                        setUploadStatus(`❌ Error: ${resp.error || "Upload failed"}`);
                                                    }
                                                    setUploading(false);
                                                };

                                                xhr.onerror = () => {
                                                    setUploadStatus("❌ Network Error");
                                                    setUploading(false);
                                                };

                                                xhr.send(formData);
                                            } catch (err) {
                                                console.error(err);
                                                setUploadStatus("❌ Upload failed");
                                                setUploading(false);
                                            }
                                        }}
                                        disabled={uploading}
                                        className="px-6 py-2.5 rounded-xl bg-safetube-accent hover:bg-safetube-accent-hover text-white font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 h-[46px]" // fixed height to match input
                                    >
                                        {uploading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Upload className="w-4 h-4" />
                                        )}
                                        {uploading ? `${uploadProgress}%` : "Upload"}
                                    </button>
                                </div>
                                {uploading && (
                                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-3 overflow-hidden">
                                        <div
                                            className="bg-safetube-accent h-1.5 rounded-full transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                )}
                                {uploadStatus && (
                                    <p className={`mt-3 text-sm ${textMuted} animate-fade-in`}>
                                        {uploadStatus}
                                    </p>
                                )}
                            </div>

                            {/* Bulk Actions Header */}
                            {selectedVideos.size > 0 && (
                                <div className="sticky top-0 z-10 mb-4 p-3 rounded-xl bg-violet-600/90 backdrop-blur-md shadow-xl flex items-center justify-between animate-fade-in border border-violet-400/30">
                                    <div className="flex items-center gap-3">
                                        <span className="font-semibold text-white px-2">
                                            {selectedVideos.size} selected
                                        </span>
                                        <div className="h-4 w-px bg-white/20"></div>
                                        <button 
                                            onClick={() => setSelectedVideos(new Set())}
                                            className="text-xs text-violet-100 hover:text-white"
                                        >
                                            Deselect All
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                const currentSelection = new Set(selectedVideos);
                                                const count = currentSelection.size;
                                                
                                                toast("Are you sure?", {
                                                    description: `Delete ${count} videos? This cannot be undone.`,
                                                    action: {
                                                        label: "Delete",
                                                        onClick: async () => {
                                                            setActionLoading("bulk-delete");
                                                            const ids = Array.from(currentSelection);
                                                            const res = await bulkDeleteVideos(pin, ids);
                                                            
                                                            if (res.success) {
                                                                setSelectedVideos(new Set());
                                                                toast.success(`Deleted ${ids.length} videos`);
                                                            } else {
                                                                toast.error(`Error: ${res.error}`);
                                                            }
                                                            setActionLoading(null);
                                                        },
                                                    },
                                                    cancel: {
                                                        label: "Cancel",
                                                        onClick: () => {},
                                                    },
                                                });
                                            }}
                                            disabled={actionLoading === "bulk-delete"}
                                            className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {actionLoading === "bulk-delete" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            )}

                             {/* Videos List Header (Select All) */}
                             {videos.length > 0 && (
                                <div className="flex items-center gap-3 px-4 py-2 mb-2">
                                    <button
                                        onClick={() => {
                                            if (selectedVideos.size === videos.length) {
                                                setSelectedVideos(new Set());
                                            } else {
                                                setSelectedVideos(new Set(videos.map(v => v.id)));
                                            }
                                        }}
                                        className={`flex items-center gap-2 text-xs font-medium ${textMuted} hover:${textPrimary} transition-colors`}
                                    >
                                        {selectedVideos.size === videos.length ? (
                                            <>
                                                <CheckSquare className="w-4 h-4 text-violet-400" />
                                                Deselect All
                                            </>
                                        ) : (
                                            <>
                                                <Square className="w-4 h-4" />
                                                Select All
                                            </>
                                        )}
                                    </button>
                                </div>
                             )}

                            {videos.map((video) => (
                                <div key={video.id} className={`${cardCls} p-4 relative group`}>
                                    <div className="flex items-center gap-4">
                                        {/* Selection Checkbox */}
                                        <div className="flex-shrink-0">
                                            <button
                                                onClick={() => {
                                                    const newSet = new Set(selectedVideos);
                                                    if (newSet.has(video.id)) {
                                                        newSet.delete(video.id);
                                                    } else {
                                                        newSet.add(video.id);
                                                    }
                                                    setSelectedVideos(newSet);
                                                }}
                                                className="p-1 rounded-md hover:bg-white/5 transition-colors"
                                            >
                                                {selectedVideos.has(video.id) ? (
                                                    <CheckSquare className="w-5 h-5 text-violet-400" />
                                                ) : (
                                                    <Square className={`w-5 h-5 ${textMuted} group-hover:text-violet-300 transition-colors`} />
                                                )}
                                            </button>
                                        </div>

                                        <div className={`w-24 h-14 rounded-lg ${surfaceCls} flex-shrink-0 overflow-hidden`}>
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
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {video.subtitlePath && (
                                                <span className="text-[10px] bg-safetube-accent/20 text-safetube-accent px-1.5 py-0.5 rounded uppercase font-bold">CC</span>
                                            )}
                                            
                                            {/* AI Analysis Button */}
                                            {video.aiScore !== null && (
                                                <button
                                                    onClick={() => setExpandedHistory(expandedHistory === video.id ? null : video.id)}
                                                    className={`p-2 rounded-lg ${expandedHistory === video.id ? 'bg-amber-500/20 text-amber-500' : btnSurface} hover:text-amber-500 transition-all`}
                                                    title="View AI Analysis"
                                                >
                                                    <Sparkles className="w-4 h-4" />
                                                </button>
                                            )}

                                            <button
                                                onClick={() => {
                                                    setSubtitlingVideoId(video.id);
                                                    subtitleInputRef.current?.click();
                                                }}
                                                disabled={actionLoading === `sub-${video.id}`}
                                                className={`p-2 rounded-lg ${btnSurface} hover:text-safetube-accent transition-all`}
                                                title="Upload Subtitles (.srt, .vtt)"
                                            >
                                                {actionLoading === `sub-${video.id}` ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Languages className="w-4 h-4" />
                                                )}
                                            </button>

                                            {confirmingDelete === `video-${video.id}` ? (
                                                <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 animate-fade-in">
                                                    <span className="text-xs text-red-400 font-medium whitespace-nowrap">Delete?</span>
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                setActionLoading(`del-v-${video.id}`);
                                                                await deleteVideo(pin, video.id);
                                                                router.refresh();
                                                            } catch (err) {
                                                                console.error("Failed to delete video:", err);
                                                            } finally {
                                                                setActionLoading(null);
                                                                setConfirmingDelete(null);
                                                            }
                                                        }}
                                                        disabled={actionLoading === `del-v-${video.id}`}
                                                        className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-all"
                                                    >
                                                        {actionLoading === `del-v-${video.id}` ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <Check className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmingDelete(null)}
                                                        className={`p-1 rounded ${btnSurface} transition-all`}
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setConfirmingDelete(`video-${video.id}`)}
                                                    className={`p-2 rounded-lg ${btnSurface} hover:text-red-400 transition-all`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                    </div>
                                    
                                    {/* Expanded Analysis View */}
                                    {expandedHistory === video.id && video.aiScore !== null && (
                                        <div className={`mt-4 p-4 rounded-xl ${surfaceCls} border ${borderCls} animate-scale-in`}>
                                            <div className="flex items-center justify-between mb-3 border-b border-gray-500/10 pb-2">
                                                <h4 className={`font-semibold ${textPrimary} flex items-center gap-2`}>
                                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                                    AI Assessment
                                                </h4>
                                                <div className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                                    (video.aiScore || 0) >= 7 ? "bg-green-500/20 text-green-500" : 
                                                    (video.aiScore || 0) >= 4 ? "bg-amber-500/20 text-amber-500" : 
                                                    "bg-red-500/20 text-red-500"
                                                }`}>
                                                    Safety Score: {video.aiScore}/10
                                                </div>
                                            </div>
                                            
                                            <div className="grid md:grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className={`block text-xs font-medium ${textMuted} mb-1 uppercase tracking-wider`}>Educational Value</span>
                                                    <p className={`${textPrimary}`}>{video.educationalValue || "N/A"}</p>
                                                </div>
                                                <div>
                                                    <span className={`block text-xs font-medium ${textMuted} mb-1 uppercase tracking-wider`}>Pacing</span>
                                                    <p className={`${textPrimary}`}>{video.pacing || "N/A"}</p>
                                                </div>
                                                {video.educationalTags && (
                                                    <div className="md:col-span-2">
                                                        <span className={`block text-xs font-medium ${textMuted} mb-1 uppercase tracking-wider`}>Tags</span>
                                                        <div className="flex flex-wrap gap-2">
                                                            {JSON.parse(video.educationalTags).map((tag: string, i: number) => (
                                                                <span key={i} className={`px-2 py-0.5 rounded-full text-xs ${isLight ? "bg-slate-200 text-slate-700" : "bg-slate-700 text-slate-300"}`}>
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
 
                            {videos.length === 0 && (
                                <div className="text-center py-12 text-safetube-muted">
                                    <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No videos downloaded yet.</p>
                                    <p className="text-xs mt-1">Paste a YouTube URL above to get started.</p>
                                </div>
                            )}

                            <input
                                type="file"
                                ref={subtitleInputRef}
                                className="hidden"
                                accept=".srt,.vtt"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file || !subtitlingVideoId) return;

                                    setActionLoading(`sub-${subtitlingVideoId}`);
                                    const formData = new FormData();
                                    formData.append("file", file);

                                    try {
                                        const result = await uploadSubtitle(pin, subtitlingVideoId, formData);
                                        if (result.success) {
                                            router.refresh();
                                        } else {
                                            toast.error(result.error || "Upload failed");
                                        }
                                    } catch (err) {
                                        console.error(err);
                                        toast.error("An error occurred during upload");
                                    } finally {
                                        setActionLoading(null);
                                        setSubtitlingVideoId(null);
                                        if (e.target) e.target.value = "";
                                    }
                                }}
                            />
                        </div>

                    )
                }

                {/* ── Settings Tab ──────────────────────────────────────────── */}
                {
                    activeTab === "settings" && (
                        <div className="space-y-4 animate-fade-in">
                            {/* Dashboard Theme */}
                            <div className={`${cardCls} p-6`}>
                                <h3 className={`font-semibold ${textPrimary} mb-4 flex items-center gap-2`}>
                                    <Palette className="w-5 h-5 text-safetube-accent" />
                                    Dashboard Theme
                                </h3>
                                <div className="flex gap-2">
                                    {(["dark", "light"] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={async () => {
                                                setAdminTheme(t);
                                                await updateSetting(pin, "admin_theme", t);
                                            }}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${adminTheme === t
                                                ? "bg-safetube-accent text-white"
                                                : `${surfaceCls} ${textMuted} hover:${textPrimary}`
                                                }`}
                                        >
                                            {t === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                                            {t === "dark" ? "Dark" : "Light"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* YouTube Configuration */}
                            <div className={`${cardCls} p-6`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className={`font-semibold ${textPrimary} mb-1 flex items-center gap-2`}>
                                            <Film className="w-5 h-5 text-safetube-accent" />
                                            YouTube Options
                                        </h3>
                                        <p className={`text-sm ${textMuted}`}>
                                            Configure authentication to bypass restrictions.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowCookieModal(true)}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                            settings.youtube_cookies
                                                ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                                                : "bg-safetube-accent/10 text-safetube-accent hover:bg-safetube-accent/20"
                                        }`}
                                    >
                                        {settings.youtube_cookies ? "Cookies Configured" : "Configure Cookies"}
                                    </button>
                                </div>
                            </div>

                            {/* Cookie Modal */}



                            {/* Change PIN */}
                            <div className={`${cardCls} p-6`}>
                                <h3 className={`font-semibold ${textPrimary} mb-4 flex items-center gap-2`}>
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
                                        className={`flex-1 px-4 py-2.5 rounded-xl ${inputCls} outline-none transition-colors`}
                                    />
                                    <button
                                        onClick={async () => {
                                            if (!newPin.trim()) return;
                                            setActionLoading("pin");
                                            const result = await updatePin(pin, newPin);
                                            if (result.success) {
                                                setPin(newPin);
                                                setNewPin("");
                                                setNewPin("");
                                                toast.success("PIN updated successfully!");
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
                            <div className={`${cardCls} p-6`}>
                                <h3 className={`font-semibold ${textPrimary} mb-4 flex items-center gap-2`}>
                                    <Settings className="w-5 h-5 text-safetube-accent" />
                                    Auto-Delete Videos
                                </h3>
                                <div className="flex gap-3 items-center">
                                    <label className={`${textMuted} text-sm`}>Delete videos older than</label>
                                    <input
                                        type="number"
                                        value={retentionDays}
                                        onChange={(e) => setRetentionDays(e.target.value)}
                                        min={1}
                                        max={365}
                                        className={`w-20 px-3 py-2 rounded-xl ${inputCls} text-center outline-none transition-colors`}
                                    />
                                    <span className={`${textMuted} text-sm`}>days</span>
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

                            {/* Intelligence & AI */}
                            <AISettings
                                pin={pin}
                                isLight={isLight}
                                cardCls={cardCls}
                                textPrimary={textPrimary}
                                textMuted={textMuted}
                                inputCls={inputCls}
                                btnSurface={btnSurface}
                                surfaceCls={surfaceCls}
                                borderCls={borderCls}
                                onSettingsChange={(enabled) => setAiEnabled(enabled)}
                            />
                        </div>
                    )
                }

                {/* ── Discover Tab ──────────────────────────────────────────── */}
                {
                    activeTab === "discover" && aiEnabled && (
                        <DiscoverTab
                            pin={pin}
                            isLight={isLight}
                            cardCls={cardCls}
                            textPrimary={textPrimary}
                            textMuted={textMuted}
                            btnSurface={btnSurface}
                            surfaceCls={surfaceCls}
                        />
                    )
                }
            </div>

            {/* Download Manager Modal */}
            <DownloadManager
                pin={pin}
                isOpen={showBulkModal}
                onClose={() => setShowBulkModal(false)}
                onListPlaylist={listPlaylistAction}
                isLight={isLight}
                cardCls={cardCls}
                textPrimary={textPrimary}
                textMuted={textMuted}
                inputCls={inputCls}
                btnSurface={btnSurface}
                surfaceCls={surfaceCls}
                queueJobs={queueJobs}
            />

            {/* Floating Download Indicator */}
            {queueJobs.some(j => j.status === "pending" || j.status === "downloading") && !showBulkModal && (
                <button
                    onClick={() => setShowBulkModal(true)}
                    className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-3 animate-bounce-in hover:scale-105 transition-transform"
                >
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-semibold text-sm">
                        {(() => {
                            const active = queueJobs.filter(j => j.status === "pending" || j.status === "downloading");
                            const downloading = active.find(j => j.status === "downloading");
                            if (downloading && downloading.progress) {
                                return `Downloading ${downloading.progress.toFixed(0)}%...`;
                            }
                            return `Downloading ${active.length} video(s)...`;
                        })()}
                    </span>
                </button>
            )}

            {/* Cookie Modal - Moved to root to avoid stacking context issues */}
            {showCookieModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <div className={`${cardCls} w-full max-w-lg p-6 shadow-2xl animate-scale-in`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`text-lg font-bold ${textPrimary}`}>YouTube Cookies</h3>
                            <button
                                onClick={() => setShowCookieModal(false)}
                                className={`p-2 rounded-lg ${btnSurface}`}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-4 space-y-3">
                            <p className={`text-sm ${textMuted}`}>
                                Paste your <code>cookies.txt</code> content (Netscape format) below.
                                This allows SafeTube to access age-restricted videos as you.
                            </p>

                            <div className="relative">
                                <textarea
                                    className={`w-full ${inputCls} p-3 text-xs font-mono h-48 focus:outline-none rounded-xl resize-none`}
                                    placeholder="# Netscape HTTP Cookie File..."
                                    defaultValue={settings.youtube_cookies || ""}
                                    id="cookie-textarea"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowCookieModal(false)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium ${textMuted} hover:${textPrimary}`}
                            >
                                Cancel
                            </button>
                            <button
                                className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${cookieSaved
                                    ? "bg-green-500/10 text-green-500"
                                    : "bg-safetube-accent text-white hover:bg-safetube-accent/90"
                                    }`}
                                onClick={async () => {
                                    const textarea = document.getElementById("cookie-textarea") as HTMLTextAreaElement;
                                    if (textarea) {
                                        setActionLoading("cookies");
                                        await updateSetting(pin, "youtube_cookies", textarea.value);
                                        setActionLoading(null);
                                        setCookieSaved(true);
                                        setTimeout(() => {
                                            setCookieSaved(false);
                                            setShowCookieModal(false);
                                        }, 1000);
                                    }
                                }}
                                disabled={actionLoading === "cookies"}
                            >
                                {actionLoading === "cookies" ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : cookieSaved ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Saved
                                    </>
                                ) : (
                                    "Save Configuration"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
