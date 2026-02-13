"use client";

import { useState } from "react";
import { loginChild } from "@/src/lib/actions";
import { useRouter } from "next/navigation";
import type { Child } from "@/src/db/schema";
import { Shield, User } from "lucide-react";

interface HomeClientProps {
    profiles: Child[];
}

export default function HomeClient({ profiles: childrenList }: HomeClientProps) {
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
        <div className="min-h-screen flex flex-col items-center justify-center p-8">
            {/* Header */}
            <div className="text-center mb-12 animate-fade-in">
                <div className="inline-flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Shield className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        SafeTube
                    </h1>
                </div>
                <p className="text-safetube-muted text-lg">Who&apos;s watching?</p>
            </div>

            {/* Child Avatars Grid */}
            {childrenList.length === 0 ? (
                <div className="glass-card p-12 text-center max-w-md animate-fade-in">
                    <User className="w-16 h-16 text-safetube-muted mx-auto mb-4" />
                    <p className="text-safetube-muted text-lg mb-2">No profiles yet</p>
                    <p className="text-safetube-muted text-sm">
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
                            className="group flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-300 hover:bg-safetube-surface/50 disabled:opacity-50"
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            {/* Avatar */}
                            <div className="avatar-ring group-hover:animate-pulse-glow">
                                <div
                                    className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white transition-transform duration-300 group-hover:scale-110"
                                    style={{ backgroundColor: child.avatarColor }}
                                >
                                    {loading === child.id ? (
                                        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        child.name.charAt(0).toUpperCase()
                                    )}
                                </div>
                            </div>
                            {/* Name */}
                            <span className="text-safetube-text font-semibold text-sm group-hover:text-white transition-colors">
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
                    className="text-safetube-muted hover:text-safetube-accent text-sm font-medium transition-colors flex items-center gap-2"
                >
                    <Shield className="w-4 h-4" />
                    Parent Dashboard
                </button>
            </div>
        </div>
    );
}
