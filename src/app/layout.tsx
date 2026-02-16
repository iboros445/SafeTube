import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Leave this import alone? No, just ensuring import is there.
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
    title: "SafeTube Local",
    description:
        "Secure, offline video player for kids — no algorithms, no distractions.",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body
                className={`${inter.className} min-h-screen bg-safetube-bg text-safetube-text antialiased`}
            >
                {children}
                <Toaster position="top-right" theme="system" richColors closeButton />
            </body>
        </html>
    );
}
