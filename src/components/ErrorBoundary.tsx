"use client";

import React from "react";

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

export default class ErrorBoundary extends React.Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("ErrorBoundary caught:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-safetube-bg">
                    <div className="text-center p-8">
                        <h1 className="text-2xl font-bold text-white mb-4">
                            Something went wrong
                        </h1>
                        <p className="text-safetube-muted mb-6">
                            An unexpected error occurred. Please try again.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 rounded-xl bg-safetube-accent hover:bg-safetube-accent-hover text-white font-semibold transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
