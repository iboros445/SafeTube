"use client";

import { useState, useRef, useCallback } from "react";
import type { Child, Video } from "@/src/db/schema";
import { useBeacon } from "@/src/hooks/useBeacon";
import { Play, ArrowLeft, Volume2, VolumeX, Clock, Film } from "lucide-react";

interface ChildViewProps {
    child: Child;
    videos: Video[];
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ChildView({ child, videos }: ChildViewProps) {
    const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const beacon = useBeacon(isPlaying);

    const handlePause = useCallback(() => {
        videoRef.current?.pause();
        setIsPlaying(false);
    }, []);

    const handleVideoEnd = useCallback(() => {
        setIsPlaying(false);
    }, []);

    const handleBack = useCallback(() => {
        handlePause();
        setSelectedVideo(null);
    }, [handlePause]);

    // If locked, force pause
    if (beacon.isLocked && isPlaying) {
        videoRef.current?.pause();
        setIsPlaying(false);
    }

    // ── Time's Up Overlay ──────────────────────────────────────────
    if (beacon.isLocked) {
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

    // ── Video Player ───────────────────────────────────────────────
    if (selectedVideo) {
        return (
            <div className="min-h-screen bg-black flex flex-col">
                {/* Player Controls Bar */}
                <div className="flex items-center justify-between p-4 bg-safetube-bg/80 backdrop-blur-md z-10">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-safetube-muted hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-medium">Back</span>
                    </button>

                    <h2 className="text-sm font-semibold text-safetube-text truncate max-w-md">
                        {selectedVideo.title}
                    </h2>

                    <div className="flex items-center gap-4">
                        {/* Time remaining */}
                        <div className="flex items-center gap-1.5 text-xs text-safetube-muted">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatTime(beacon.remaining)} left</span>
                        </div>

                        {/* Mute toggle */}
                        <button
                            onClick={() => {
                                setIsMuted(!isMuted);
                                if (videoRef.current) videoRef.current.muted = !isMuted;
                            }}
                            className="text-safetube-muted hover:text-white transition-colors"
                        >
                            {isMuted ? (
                                <VolumeX className="w-5 h-5" />
                            ) : (
                                <Volume2 className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Video */}
                <div className="flex-1 flex items-center justify-center bg-black">
                    <video
                        ref={videoRef}
                        src={`/api/media/${selectedVideo.localPath}`}
                        className="w-full h-full max-h-[calc(100vh-72px)] object-contain"
                        controls
                        controlsList="nodownload noremoteplayback"
                        disablePictureInPicture
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={handleVideoEnd}
                        muted={isMuted}
                    />
                </div>
            </div>
        );
    }

    // ── Video Library Grid ─────────────────────────────────────────
    return (
        <div className="min-h-screen p-6 md:p-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 animate-fade-in">
                <div className="flex items-center gap-4">
                    <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white"
                        style={{ backgroundColor: child.avatarColor }}
                    >
                        {child.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{child.name}&apos;s Videos</h1>
                        <div className="flex items-center gap-1.5 text-sm text-safetube-muted">
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
                <div className="glass-card p-16 text-center animate-fade-in">
                    <Film className="w-16 h-16 text-safetube-muted mx-auto mb-4" />
                    <p className="text-safetube-muted text-lg">No videos yet</p>
                    <p className="text-safetube-muted text-sm mt-1">
                        Ask a parent to add some videos!
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 animate-fade-in">
                    {videos.map((video) => (
                        <button
                            key={video.id}
                            onClick={() => setSelectedVideo(video)}
                            className="video-thumb group text-left"
                        >
                            <div className="relative aspect-video bg-safetube-surface rounded-xl overflow-hidden">
                                {video.thumbnailPath ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={`/api/media/${video.thumbnailPath}`}
                                        alt={video.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Film className="w-12 h-12 text-safetube-muted" />
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
                            </div>

                            <p className="mt-3 text-sm font-semibold text-safetube-text group-hover:text-white transition-colors line-clamp-2 px-1">
                                {video.title}
                            </p>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
