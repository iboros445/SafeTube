"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Child, Video } from "@/src/db/schema";
import { listPlaylistAction } from "@/src/lib/actions";
import {
    Download,
    ArrowLeft,
    Loader2,
    RefreshCw,
    Camera,
    Smile,
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

import DownloadManager from "@/src/components/DownloadManager";
import DiscoverTab from "@/src/components/DiscoverTab";
// Force rebuild for HMR
import AdminLogin from "@/src/components/admin/AdminLogin";
import AdminHeader from "@/src/components/admin/AdminHeader";
import AdminNav from "@/src/components/admin/AdminNav";
import AdminChildrenTab from "@/src/components/admin/AdminChildrenTab";
import AdminVideosTab from "@/src/components/admin/AdminVideosTab";
import AdminSettingsTab from "@/src/components/admin/AdminSettingsTab";
import { getTheme } from "@/src/components/admin/theme";
import { isAIEnabled } from "@/src/lib/ai-actions";

import type { QueueJob } from "@/src/types";

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
    // const [pinError, setPinError] = useState(false);

    // Form States
    const [activeTab, setActiveTab] = useState<"children" | "videos" | "settings" | "discover">("children");
    const [aiEnabled, setAiEnabled] = useState(false);

    // Check AI status on mount
    useEffect(() => {
        isAIEnabled().then(setAiEnabled);
    }, []);

    const [showBulkModal, setShowBulkModal] = useState(false);


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



    // General Action State (shared for Videos/etc)
    // Settings State
    const [adminTheme, setAdminTheme] = useState<"dark" | "light">(
        (settings.admin_theme as "dark" | "light") || "dark"
    );
    const isLight = adminTheme === "light";

    // Theme helper classes
    const { 
        bg, cardCls, textPrimary, textMuted, surfaceCls, borderCls, inputCls, 
        tabBg, tabActive, tabInactive, btnSurface, homeBtn, ringOffsetCls 
    } = getTheme(isLight);

    // ─── PIN Authentication ─────────────────────────────────────────
    
    // Moved to AdminLogin component
    
    if (!authenticated) {
        return <AdminLogin onLogin={(validPin) => {
            setPin(validPin);
            setAuthenticated(true);
        }} isLight={isLight} />;
    }

    // ── Authenticated Dashboard ────────────────────────────────────
    return (
        <div className={`min-h-screen ${bg} transition-colors`}>
            <div className="p-6 md:p-10 max-w-6xl mx-auto">
                {/* Header */}
                <AdminHeader isLight={isLight} onLogout={() => setAuthenticated(false)} />

                {/* Tabs */}
                <AdminNav 
                    activeTab={activeTab} 
                    setActiveTab={setActiveTab} 
                    aiEnabled={aiEnabled} 
                    isLight={isLight} 
                />

                {/* ── Children Tab ──────────────────────────────────────────── */}
                {activeTab === "children" && (
                    <AdminChildrenTab 
                        profiles={childrenList} 
                        pin={pin} 
                        isLight={isLight} 
                    />
                )}

                {/* ── Videos Tab ────────────────────────────────────────────── */}
                {activeTab === "videos" && (
                    <AdminVideosTab
                        videos={videos}
                        pin={pin}
                        isLight={isLight}
                        onShowBulkModal={() => setShowBulkModal(true)}
                    />
                )}

                {/* ── Settings Tab ──────────────────────────────────────────── */}
                {
                    activeTab === "settings" && (
                        <AdminSettingsTab
                            pin={pin}
                            settings={settings}
                            isLight={isLight}
                            onThemeChange={setAdminTheme}
                            onAiEnabledChange={setAiEnabled}
                        />
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


        </div >
    );
}
