"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Child, Video } from "@/src/db/schema";
import { useBeacon } from "@/src/hooks/useBeacon";
import { saveVideoProgress } from "@/src/lib/actions";
import { ArrowLeft, Volume2, VolumeX, Clock, Film, Play, Pause, Maximize, Minimize } from "lucide-react";
import Avatar from "@/src/components/Avatar";

interface ChildViewProps {
    child: Child;
    videos: Video[];
    progressMap: Record<number, number>;
    initialLocked?: boolean;
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ChildView({ child, videos, progressMap, initialLocked = false }: ChildViewProps) {
    const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [showPlayOverlay, setShowPlayOverlay] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const lastSaveTimeRef = useRef<number>(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const beacon = useBeacon(isPlaying);
    const isLocked = beacon.isLocked || initialLocked;
    const isLight = child.theme === "light";

    // ── Save progress (throttled to every 5s) ───────────────────────
    const saveProgress = useCallback(
        (currentTime: number) => {
            if (!selectedVideo) return;
            const now = Date.now();
            if (now - lastSaveTimeRef.current < 5000) return;
            lastSaveTimeRef.current = now;
            saveVideoProgress(child.id, selectedVideo.id, Math.floor(currentTime));
        },
        [child.id, selectedVideo]
    );

    // Save progress on unmount / tab close
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (videoRef.current && selectedVideo) {
                saveVideoProgress(
                    child.id,
                    selectedVideo.id,
                    Math.floor(videoRef.current.currentTime)
                );
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [child.id, selectedVideo]);

    // ── Video selection with resume ─────────────────────────────────
    const handleSelectVideo = useCallback(
        (video: Video) => {
            setSelectedVideo(video);
            setShowPlayOverlay(true);
            setIsPlaying(false);
            // Seek to saved progress after video loads
            setTimeout(() => {
                if (videoRef.current) {
                    const saved = progressMap[video.id];
                    if (saved && saved > 0) {
                        videoRef.current.currentTime = saved;
                    }
                }
            }, 100);
        },
        [progressMap]
    );

    const handlePlayPause = useCallback(() => {
        if (!videoRef.current || beacon.isLocked) return;
        if (isPlaying) {
            videoRef.current.pause();
            setIsPlaying(false);
            setShowPlayOverlay(true);
            // Save progress on pause
            if (selectedVideo) {
                saveVideoProgress(
                    child.id,
                    selectedVideo.id,
                    Math.floor(videoRef.current.currentTime)
                );
            }
        } else {
            videoRef.current.play();
            setIsPlaying(true);
            setShowPlayOverlay(false);
            // Hide overlay after a brief moment
            setTimeout(() => setShowPlayOverlay(false), 300);
        }
    }, [isPlaying, beacon.isLocked, selectedVideo, child.id]);

    const handleFullscreen = useCallback(async () => {
        if (!playerContainerRef.current) return;
        try {
            if (!document.fullscreenElement) {
                await playerContainerRef.current.requestFullscreen();
                setIsFullscreen(true);
            } else {
                await document.exitFullscreen();
                setIsFullscreen(false);
            }
        } catch (err) {
            console.error("Fullscreen error:", err);
        }
    }, []);

    // Listen for fullscreen changes (e.g. user presses Esc)
    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    const handleVideoEnd = useCallback(() => {
        setIsPlaying(false);
        setShowPlayOverlay(true);
        // Save at end (progress = 0 to restart next time)
        if (selectedVideo) {
            saveVideoProgress(child.id, selectedVideo.id, 0);
        }
    }, [child.id, selectedVideo]);

    const handleBack = useCallback(() => {
        if (videoRef.current && selectedVideo) {
            videoRef.current.pause();
            saveVideoProgress(
                child.id,
                selectedVideo.id,
                Math.floor(videoRef.current.currentTime)
            );
        }
        setIsPlaying(false);
        setSelectedVideo(null);
    }, [child.id, selectedVideo]);

    const handleTimeUpdate = useCallback(() => {
        if (videoRef.current) {
            saveProgress(videoRef.current.currentTime);
        }
    }, [saveProgress]);

    // If locked, force pause
    if (isLocked && isPlaying) {
        videoRef.current?.pause();
        setIsPlaying(false);
    }

    // ── Theme classes ───────────────────────────────────────────────
    const bg = isLight ? "bg-gray-50" : "bg-safetube-bg";
    const textPrimary = isLight ? "text-gray-900" : "text-white";
    const textMuted = isLight ? "text-gray-500" : "text-safetube-muted";
    const surface = isLight ? "bg-white border border-gray-200" : "bg-safetube-surface";
    const topBar = isLight
        ? "bg-white/90 backdrop-blur-md border-b border-gray-200"
        : "bg-safetube-bg/80 backdrop-blur-md";

    // ── Time's Up Overlay ──────────────────────────────────────────
    if (isLocked) {
        return (
            <div className="times-up-overlay">
                <div className="text-center animate-scale-in">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center mx-auto mb-8">
                        <Clock className="w-12 h-12 text-white" />
                    </div>
                    <h1 className="text-5xl font-extrabold mb-4 bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">
                        Time&apos;s Up!
                    </h1>
                    <p className="text-safetube-muted text-xl mb-2">
                        Great watching, {child.name}!
                    </p>
                    <p className="text-safetube-muted text-base">
                        Ask a parent if you&apos;d like more time.
                    </p>
                </div>
            </div>
        );
    }

    // ── Video Player (Minimal — no native controls) ─────────────────
    if (selectedVideo) {
        return (
            <div ref={playerContainerRef} className="min-h-screen bg-black flex flex-col">
                {/* Player Controls Bar */}
                {!isFullscreen && (
                    <div className={`flex items-center justify-between p-4 ${topBar} z-10`}>
                        <button
                            onClick={handleBack}
                            className={`flex items-center gap-2 ${textMuted} hover:${textPrimary} transition-colors`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-medium">Back</span>
                        </button>

                        <h2 className={`text-sm font-semibold ${textPrimary} truncate max-w-md`}>
                            {selectedVideo.title}
                        </h2>

                        <div className="flex items-center gap-4">
                            {/* Time remaining */}
                            <div className={`flex items-center gap-1.5 text-xs ${textMuted}`}>
                                <Clock className="w-3.5 h-3.5" />
                                <span>{formatTime(beacon.remaining)} left</span>
                            </div>

                            {/* Mute toggle */}
                            <button
                                onClick={() => {
                                    setIsMuted(!isMuted);
                                    if (videoRef.current) videoRef.current.muted = !isMuted;
                                }}
                                className={`${textMuted} hover:${textPrimary} transition-colors`}
                            >
                                {isMuted ? (
                                    <VolumeX className="w-5 h-5" />
                                ) : (
                                    <Volume2 className="w-5 h-5" />
                                )}
                            </button>

                            {/* Fullscreen toggle */}
                            <button
                                onClick={handleFullscreen}
                                className={`${textMuted} hover:${textPrimary} transition-colors`}
                            >
                                {isFullscreen ? (
                                    <Minimize className="w-5 h-5" />
                                ) : (
                                    <Maximize className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Video with click-to-play overlay (NO native controls) */}
                <div
                    className="flex-1 flex items-center justify-center bg-black relative cursor-pointer select-none"
                    onClick={handlePlayPause}
                    onDoubleClick={handleFullscreen}
                >
                    <video
                        ref={videoRef}
                        src={`/api/media/${selectedVideo.localPath}`}
                        className="w-full h-full max-h-[calc(100vh-72px)] object-contain pointer-events-none"
                        disablePictureInPicture
                        playsInline
                        onPlay={() => {
                            setIsPlaying(true);
                            setShowPlayOverlay(false);
                        }}
                        onPause={() => {
                            setIsPlaying(false);
                            setShowPlayOverlay(true);
                        }}
                        onEnded={handleVideoEnd}
                        onTimeUpdate={handleTimeUpdate}
                        muted={isMuted}
                        onContextMenu={(e) => e.preventDefault()}
                    />

                    {/* Play/Pause overlay */}
                    {showPlayOverlay && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center animate-scale-in">
                                {isPlaying ? (
                                    <Pause className="w-10 h-10 text-white fill-white" />
                                ) : (
                                    <Play className="w-10 h-10 text-white fill-white ml-1" />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── Video Library Grid ─────────────────────────────────────────
    return (
        <div className={`min-h-screen p-6 md:p-10 ${bg}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8 animate-fade-in">
                <div className="flex items-center gap-4">
                    <Avatar child={child} size="md" />
                    <div>
                        <h1 className={`text-2xl font-bold ${textPrimary}`}>{child.name}&apos;s Videos</h1>
                        <div className={`flex items-center gap-1.5 text-sm ${textMuted}`}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                                {formatTime(child.dailyLimitSeconds - child.currentUsageSeconds)}{" "}
                                remaining today
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid */}
            {videos.length === 0 ? (
                <div className={`${surface} rounded-2xl p-16 text-center animate-fade-in`}>
                    <Film className={`w-16 h-16 ${textMuted} mx-auto mb-4`} />
                    <p className={`${textMuted} text-lg`}>No videos yet</p>
                    <p className={`${textMuted} text-sm mt-1`}>
                        Ask a parent to add some videos!
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 animate-fade-in">
                    {videos.map((video) => (
                        <button
                            key={video.id}
                            onClick={() => handleSelectVideo(video)}
                            className="video-thumb group text-left"
                        >
                            <div className={`relative aspect-video ${surface} rounded-xl overflow-hidden`}>
                                {video.thumbnailPath ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={`/api/media/${video.thumbnailPath}`}
                                        alt={video.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Film className={`w-12 h-12 ${textMuted}`} />
                                    </div>
                                )}

                                {/* Play overlay */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                                        <Play className="w-7 h-7 text-white fill-white ml-1" />
                                    </div>
                                </div>

                                {/* Duration badge */}
                                {video.durationSeconds && (
                                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-xs text-white font-medium z-10">
                                        {formatTime(video.durationSeconds)}
                                    </div>
                                )}

                                {/* Resume indicator */}
                                {progressMap[video.id] > 0 && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30 z-10">
                                        <div
                                            className="h-full bg-indigo-500 rounded-r"
                                            style={{
                                                width: `${Math.min(
                                                    100,
                                                    (progressMap[video.id] / (video.durationSeconds || 1)) * 100
                                                )}%`,
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            <p className={`mt-3 text-sm font-semibold ${textPrimary} group-hover:text-indigo-400 transition-colors line-clamp-2 px-1`}>
                                {video.title}
                            </p>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
