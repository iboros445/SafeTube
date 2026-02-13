"use client";

import { useState } from "react";
import { loginChild } from "@/src/lib/actions";
import { useRouter } from "next/navigation";
import type { Child } from "@/src/db/schema";
import { Shield, User } from "lucide-react";
import Avatar from "@/src/components/Avatar";

interface HomeClientProps {
    profiles: Child[];
    adminTheme: string;
}

export default function HomeClient({ profiles: childrenList, adminTheme }: HomeClientProps) {
    const isLight = adminTheme === "light";
    const bg = isLight ? "bg-slate-50" : "bg-slate-950";
    const textPrimary = isLight ? "text-slate-900" : "text-white";
    const textMuted = isLight ? "text-slate-500" : "text-slate-400";
    const cardCls = isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800 shadow-sm";
    const ringOffsetCls = isLight ? "ring-offset-white" : "ring-offset-slate-900";
    const router = useRouter();
    const [loading, setLoading] = useState<number | null>(null);

    const handleSelectChild = async (childId: number) => {
        setLoading(childId);
        try {
            await loginChild(childId);
            router.push("/child");
        } catch (error) {
            console.error("Login failed:", error);
            setLoading(null);
        }
    };

    return (
        <div className={`min-h-screen flex flex-col items-center justify-center p-8 ${bg} transition-colors`}>
            {/* Header */}
            <div className="text-center mb-12 animate-fade-in">
                <div className="inline-flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Shield className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                        SafeTube
                    </h1>
                </div>
                <p className="text-gray-500 text-lg">Who&apos;s watching?</p>
            </div>

            {/* Child Avatars Grid */}
            {childrenList.length === 0 ? (
                <div className={`${cardCls} rounded-2xl border p-12 text-center max-w-md animate-fade-in`}>
                    <User className={`w-16 h-16 ${textMuted} mx-auto mb-4`} />
                    <p className={`${textMuted} text-lg mb-2`}>No profiles yet</p>
                    <p className={`${textMuted} text-sm`}>
                        Ask a parent to set up your profile in the{" "}
                        <button
                            onClick={() => router.push("/admin")}
                            className="text-safetube-accent hover:text-safetube-accent-hover underline"
                        >
                            Admin Dashboard
                        </button>
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 max-w-2xl animate-fade-in">
                    {childrenList.map((child, index) => (
                        <button
                            key={child.id}
                            onClick={() => handleSelectChild(child.id)}
                            disabled={loading !== null}
                            className={`group flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-300 hover:${isLight ? "bg-slate-100" : "bg-slate-800"} disabled:opacity-50`}
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            {/* Avatar */}
                            <div
                                className={`relative rounded-full p-[3px] group-hover:scale-105 transition-all ${loading === child.id ? "animate-pulse" : ""}`}
                                style={{ background: child.avatarColor || "linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)" }}
                            >
                                {loading === child.id ? (
                                    <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isLight ? "bg-white" : "bg-slate-900"}`}>
                                        <div className={`w-8 h-8 border-2 ${isLight ? "border-slate-300" : "border-slate-600"} border-t-transparent rounded-full animate-spin`} />
                                    </div>
                                ) : (
                                    <Avatar child={child} size="lg" className={`border-4 ${isLight ? "border-white" : "border-slate-900"}`} />
                                )}
                            </div>
                            {/* Name */}
                            <span className={`font-semibold text-sm transition-colors ${textPrimary}`}>
                                {child.name}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Admin Link */}
            <div className="mt-16 animate-fade-in">
                <button
                    onClick={() => router.push("/admin")}
                    className="text-gray-400 hover:text-indigo-500 text-sm font-medium transition-colors flex items-center gap-2"
                >
                    <Shield className="w-4 h-4" />
                    Parent Dashboard
                </button>
            </div>
        </div>
    );
}
