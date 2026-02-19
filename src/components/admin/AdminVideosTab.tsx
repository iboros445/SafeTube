"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    Download,
    Loader2,
    Film,
    Sparkles,
    Trash2,
    Square,
    CheckSquare,
    Languages,
    Check,
    X,
    Upload,
} from "lucide-react";

import { getTheme } from "@/src/components/admin/theme";
import ReviewCard from "@/src/components/ReviewCard";
import { formatTime } from "@/src/components/admin/utils";
import type { SearchResult, AnalysisResult } from "@/src/types";
import type { Video } from "@/src/db/schema";
import {
    searchYouTubeAction,
    downloadVideoAction,
    approveAndDownload,
    dismissVideo as dismissVideoAction,
    deleteVideo,
    bulkDeleteVideos,
    uploadSubtitle,
} from "@/src/lib/actions";

interface AdminVideosTabProps {
    videos: Video[];
    pin: string;
    isLight: boolean;
    onShowBulkModal: () => void;
}

export default function AdminVideosTab({
    videos,
    pin,
    isLight,
    onShowBulkModal,
}: AdminVideosTabProps) {
    const router = useRouter();
    const {
        cardCls,
        textPrimary,
        textMuted,
        surfaceCls,
        btnSurface,
        inputCls,
        borderCls,
    } = getTheme(isLight);

    // State
    const [videoUrl, setVideoUrl] = useState("");
    const [downloading, setDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    
    const [selectedVideos, setSelectedVideos] = useState<Set<number>>(new Set());
    const [pendingReviews, setPendingReviews] = useState<Array<{
        url: string;
        title: string;
        analysis: AnalysisResult;
    }>>([]);
    
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState("");
    
    // Action States
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
    const [expandedHistory, setExpandedHistory] = useState<number | null>(null); // Reused for AI analysis view
    const [subtitlingVideoId, setSubtitlingVideoId] = useState<number | null>(null);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const subtitleInputRef = useRef<HTMLInputElement>(null);

    return (
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
                        onClick={onShowBulkModal}
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

                            // Download mode
                            setDownloading(true);
                            setDownloadStatus("⏳ Processing...");
                            const result = await downloadVideoAction(pin, videoUrl.trim());
                            
                            if (result.success) {
                                if ((result as { pendingReview?: boolean }).pendingReview) {
                                    setPendingReviews((prev) => [...prev, {
                                        url: (result as { url: string }).url,
                                        title: result.title || "Untitled",
                                        analysis: (result as { analysis: AnalysisResult }).analysis,
                                    }]);
                                    setDownloadStatus(`🔍 AI analysis complete — review below`);
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
                <div className={`sticky top-4 z-10 ${cardCls} p-3 mb-4 flex items-center justify-between shadow-xl animate-scale-in border border-violet-500/30`}>
                    <div className="flex items-center gap-3">
                        <span className={`text-sm font-semibold ${textPrimary} bg-violet-500/20 px-3 py-1 rounded-lg`}>
                            {selectedVideos.size} Selected
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
                                                router.refresh();
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
    );
}
