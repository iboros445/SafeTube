"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Child } from "@/src/db/schema";
import {
    addChild,
    updateChild,
    deleteChild,
    resetChildTime,
    endChildSession,
    uploadAvatarPhoto,
    getChildWatchHistory,
    updateVideoProgressAdmin,
} from "@/src/lib/actions";
import {
    UserPlus,
    Trash2,
    LogOut,
    Film,
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
    Play,
    ChevronUp,
} from "lucide-react";
import Avatar from "@/src/components/Avatar";
import { getTheme } from "./theme";

// Constants
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

interface AdminChildrenTabProps {
    profiles: Child[];
    pin: string;
    isLight: boolean;
}

export default function AdminChildrenTab({ profiles: childrenList, pin, isLight }: AdminChildrenTabProps) {
    const router = useRouter();
    const theme = getTheme(isLight);
    const { 
        cardCls, textPrimary, textMuted, surfaceCls, inputCls, 
        btnSurface, ringOffsetCls 
    } = theme;

    // Local State
    const [showAddChild, setShowAddChild] = useState(false);
    const [newChildName, setNewChildName] = useState("");
    const [newChildLimit, setNewChildLimit] = useState(60);
    const [newChildColor, setNewChildColor] = useState(AVATAR_COLORS[0]);
    const [newChildAvatarType, setNewChildAvatarType] = useState<"color" | "emoji" | "photo">("color");
    const [newChildEmoji, setNewChildEmoji] = useState("🦁");
    const [newChildTheme, setNewChildTheme] = useState<"dark" | "light">("dark");
    const [newChildPhoto, setNewChildPhoto] = useState<File | null>(null);
    const createPhotoInputRef = useRef<HTMLInputElement>(null);

    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
    const [confirmingPunish, setConfirmingPunish] = useState<number | null>(null); // Kept for future use if needed, though previously unused in view
    const [editingColor, setEditingColor] = useState<number | null>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);

    // Watch History State
    const [expandedHistory, setExpandedHistory] = useState<number | null>(null);
    const [watchHistory, setWatchHistory] = useState<Awaited<ReturnType<typeof getChildWatchHistory>>>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    return (
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
    );
}
