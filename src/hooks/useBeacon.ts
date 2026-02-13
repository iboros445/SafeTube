"use client";

import { useEffect, useRef, useCallback, useState } from "react";

const HEARTBEAT_INTERVAL_MS = 5000; // 5 seconds

interface BeaconState {
    isLocked: boolean;
    usage: number;
    limit: number;
    remaining: number;
}

/**
 * useBeacon — The anti-cheat heartbeat hook.
 *
 * Fires a POST /api/heartbeat every 5 seconds ONLY while `isPlaying` is true.
 * If the server returns 403, it sets `isLocked` = true, signaling the
 * parent component to pause video and show "Time's Up".
 */
export function useBeacon(isPlaying: boolean) {
    const [state, setState] = useState<BeaconState>({
        isLocked: false,
        usage: 0,
        limit: 0,
        remaining: 0,
    });

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isPlayingRef = useRef(isPlaying);

    // Keep ref in sync so the interval callback always sees latest value
    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    const sendHeartbeat = useCallback(async () => {
        if (!isPlayingRef.current) return;

        try {
            const res = await fetch("/api/heartbeat", {
                method: "POST",
                credentials: "include",
            });

            if (res.status === 403) {
                // Time's up!
                const data = await res.json();
                setState({
                    isLocked: true,
                    usage: data.usage || 0,
                    limit: data.limit || 0,
                    remaining: 0,
                });
                return;
            }

            if (res.ok) {
                const data = await res.json();
                setState({
                    isLocked: false,
                    usage: data.usage || 0,
                    limit: data.limit || 0,
                    remaining: data.remaining || 0,
                });
            }
        } catch (error) {
            console.error("Heartbeat failed:", error);
        }
    }, []);

    useEffect(() => {
        if (isPlaying && !state.isLocked) {
            // Send an immediate heartbeat when play starts
            sendHeartbeat();

            // Then set up interval
            intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
        } else {
            // Clear interval when paused or locked
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isPlaying, state.isLocked, sendHeartbeat]);

    return state;
}
