"use client";

import { getTheme } from "./theme";

interface AdminNavProps {
    activeTab: "children" | "videos" | "settings" | "discover";
    setActiveTab: (tab: "children" | "videos" | "settings" | "discover") => void;
    aiEnabled: boolean;
    isLight: boolean;
}

export default function AdminNav({ activeTab, setActiveTab, aiEnabled, isLight }: AdminNavProps) {
    const theme = getTheme(isLight);

    return (
        <div className={`flex gap-1 p-1 ${theme.tabBg} rounded-xl mb-8 ${aiEnabled ? 'max-w-lg' : 'max-w-md'} animate-fade-in`}>
            {(["children", "videos", "settings", ...(aiEnabled ? ["discover" as const] : [])] as const).map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === tab
                        ? theme.tabActive
                        : theme.tabInactive
                        } ${tab === "discover" ? "flex items-center justify-center gap-1.5" : ""}`}
                >
                    {tab === "discover" && <span className="text-xs">✨</span>}
                    {tab}
                </button>
            ))}
        </div>
    );
}
