"use client";

import { useEffect, useState } from "react";

type ToastVariant = "success" | "error" | "info";

interface ToastProps {
    message: string;
    emoji?: string;
    variant?: ToastVariant;
    duration?: number;
    onClose: () => void;
}

const variantStyles: Record<ToastVariant, { border: string; emoji: string }> = {
    success: { border: "border-teal-400/30", emoji: "🎉" },
    error: { border: "border-red-400/30", emoji: "😟" },
    info: { border: "border-blue-400/30", emoji: "💡" },
};

export function Toast({ message, emoji, variant = "success", duration = 3000, onClose }: ToastProps) {
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setVisible(true));

        const timer = setTimeout(() => {
            setExiting(true);
            setTimeout(onClose, 300);
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const { border, emoji: defaultEmoji } = variantStyles[variant];

    return (
        <div
            className={`fixed bottom-4 left-4 right-4 z-50 flex items-center gap-4
                bg-white/10 backdrop-blur-xl border ${border} rounded-2xl px-5 py-4
                shadow-2xl shadow-black/40 transition-all duration-300 ease-out
                ${visible && !exiting ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
        >
            <span className="text-4xl shrink-0">{emoji || defaultEmoji}</span>
            <p className="text-white font-semibold text-sm leading-snug">{message}</p>
        </div>
    );
}

// Hook for easy toast management
export function useToast() {
    const [toast, setToast] = useState<{ message: string; emoji?: string; variant?: ToastVariant } | null>(null);

    const showToast = (message: string, variant: ToastVariant = "success", emoji?: string) => {
        setToast({ message, variant, emoji });
    };

    const ToastContainer = toast ? (
        <Toast
            message={toast.message}
            emoji={toast.emoji}
            variant={toast.variant}
            onClose={() => setToast(null)}
        />
    ) : null;

    return { showToast, ToastContainer };
}
