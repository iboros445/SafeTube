"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
    Palette,
    Moon,
    Sun,
    Film,
    Shield,
    Loader2,
    Settings,
    X,
    Check,
} from "lucide-react";

import { getTheme } from "@/src/components/admin/theme";
import AISettings from "@/src/components/AISettings";
import { updateSetting, updatePin, updateRetention } from "@/src/lib/actions";

interface AdminSettingsTabProps {
    pin: string;
    settings: Record<string, string>;
    isLight: boolean;
    onThemeChange: (theme: "dark" | "light") => void;
    onAiEnabledChange: (enabled: boolean) => void;
}

export default function AdminSettingsTab({
    pin,
    settings,
    isLight,
    onThemeChange,
    onAiEnabledChange,
}: AdminSettingsTabProps) {
    const {
        cardCls,
        textPrimary,
        textMuted,
        surfaceCls,
        inputCls,
        btnSurface,
        borderCls,
    } = getTheme(isLight);

    const [adminTheme, setAdminTheme] = useState<"dark" | "light">(
        isLight ? "light" : "dark"
    );
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    
    // Cookie Config State
    const [showCookieModal, setShowCookieModal] = useState(false);
    const [cookieSaved, setCookieSaved] = useState(false);

    // PIN State
    const [newPin, setNewPin] = useState("");

    // Retention State
    const [retentionDays, setRetentionDays] = useState(settings.retention_days || "7");

    return (
        <>
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
                                    onThemeChange(t);
                                    await updateSetting(pin, "admin_theme", t);
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isLight === (t === "light")
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
                                toast.success("Retention settings saved");
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
                    onSettingsChange={onAiEnabledChange}
                />
            </div>

            {/* Cookie Modal */}
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
        </>
    );
}
