"use client";

import type { Child } from "@/src/db/schema";

interface AvatarProps {
    child: Child;
    size?: "sm" | "md" | "lg";
    className?: string;
}

const sizeMap = {
    sm: { container: "w-10 h-10", text: "text-lg", emoji: "text-xl" },
    md: { container: "w-16 h-16", text: "text-2xl", emoji: "text-3xl" },
    lg: { container: "w-20 h-20", text: "text-3xl", emoji: "text-4xl" },
};

export default function Avatar({ child, size = "md", className = "" }: AvatarProps) {
    const s = sizeMap[size];

    const baseClasses = `${s.container} rounded-full flex items-center justify-center font-bold text-white overflow-hidden ${className}`;

    if (child.avatarType === "photo" && child.avatarPhoto) {
        return (
            <div className={baseClasses} style={{ backgroundColor: child.avatarColor }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={`/api/media/${child.avatarPhoto}`}
                    alt={child.name}
                    className="w-full h-full object-cover"
                />
            </div>
        );
    }

    if (child.avatarType === "emoji" && child.avatarEmoji) {
        return (
            <div className={baseClasses} style={{ backgroundColor: child.avatarColor }}>
                <span className={s.emoji}>{child.avatarEmoji}</span>
            </div>
        );
    }

    // Default: color with initial
    return (
        <div className={baseClasses} style={{ backgroundColor: child.avatarColor }}>
            <span className={s.text}>{child.name.charAt(0).toUpperCase()}</span>
        </div>
    );
}
