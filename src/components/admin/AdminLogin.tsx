"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft } from "lucide-react";
import { verifyPin } from "@/src/lib/actions";

interface AdminLoginProps {
    onLogin: (pin: string) => void;
    isLight: boolean;
}

export default function AdminLogin({ onLogin, isLight }: AdminLoginProps) {
    const router = useRouter();
    const [pin, setPin] = useState("");
    const [error, setError] = useState(false);

    // Theme helper classes
    const bg = isLight ? "bg-slate-50" : "bg-slate-950";
    const cardCls = isLight ? "bg-white rounded-2xl shadow-sm border border-slate-200" : "bg-slate-900 rounded-2xl shadow-sm border border-slate-800";
    const textPrimary = isLight ? "text-slate-900" : "text-white";
    const textMuted = isLight ? "text-slate-500" : "text-slate-400";
    const inputCls = isLight
        ? "bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500"
        : "bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500";

    const handlePinSubmit = useCallback(async () => {
        const result = await verifyPin(pin);
        if (result.success) {
            setError(false);
            onLogin(pin);
        } else {
            setError(true);
            setPin("");
        }
    }, [pin, onLogin]);

    return (
        <div className={`min-h-screen flex items-center justify-center p-6 ${bg} transition-colors`}>
            <div className={`${cardCls} p-8 w-full max-w-sm animate-scale-in`}>
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-9 h-9 text-white" />
                    </div>
                    <h1 className={`text-2xl font-bold ${textPrimary}`}>Parent Access</h1>
                    <p className={`${textMuted} text-sm mt-1`}>Enter your PIN to continue</p>
                </div>

                <div className="space-y-4">
                    <input
                        type="password"
                        value={pin}
                        onChange={(e) => {
                            setPin(e.target.value);
                            setError(false);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
                        placeholder="Enter PIN"
                        maxLength={8}
                        className={`w-full px-4 py-3 rounded-xl ${inputCls} text-center text-2xl tracking-[0.5em] font-mono placeholder:text-safetube-muted placeholder:tracking-normal placeholder:text-base outline-none transition-all ${error
                            ? "border-red-500 shake"
                            : isLight ? "border-slate-300 focus:border-indigo-500" : "border-slate-700 focus:border-indigo-500"
                            }`}
                        autoFocus
                    />

                    {error && (
                        <p className="text-red-400 text-sm text-center animate-fade-in">
                            Incorrect PIN. Try again.
                        </p>
                    )}

                    <button
                        onClick={handlePinSubmit}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all"
                    >
                        Unlock
                    </button>
                </div>

                <button
                    onClick={() => router.push("/")}
                    className={`w-full mt-4 py-2 ${textMuted} hover:${textPrimary} text-sm transition-colors flex items-center justify-center gap-2`}
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Home
                </button>
            </div>
        </div>
    );
}
