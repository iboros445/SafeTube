"use client";

import { useRouter } from "next/navigation";
import { Shield, ArrowLeft, LogOut } from "lucide-react";
import { adminLogout } from "@/src/lib/actions";
import { getTheme } from "./theme";

interface AdminHeaderProps {
    isLight: boolean;
    onLogout: () => void;
}

export default function AdminHeader({ isLight, onLogout }: AdminHeaderProps) {
    const router = useRouter();
    const theme = getTheme(isLight);

    return (
        <div className="flex items-center justify-between mb-8 animate-fade-in">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className={`text-2xl font-bold ${theme.textPrimary}`}>Parent Dashboard</h1>
                    <p className={`${theme.textMuted} text-xs`}>SafeTube Admin</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => router.push("/")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl ${theme.homeBtn} text-sm transition-all`}
                >
                    <ArrowLeft className="w-4 h-4" /> Home
                </button>
                <button
                    onClick={async () => {
                        await adminLogout();
                        onLogout();
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-sm transition-all`}
                >
                    <LogOut className="w-4 h-4" /> Logout
                </button>
            </div>
        </div>
    );
}
