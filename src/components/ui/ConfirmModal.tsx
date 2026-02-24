"use client";

import { useEffect, useState } from "react";

interface ConfirmModalProps {
    emoji?: string;
    title: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmModal({
    emoji = "🤔",
    title,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
    }, []);

    const handleClose = (confirmed: boolean) => {
        setVisible(false);
        setTimeout(() => (confirmed ? onConfirm() : onCancel()), 200);
    };

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-6
                bg-black/60 backdrop-blur-sm transition-opacity duration-200
                ${visible ? "opacity-100" : "opacity-0"}`}
            onClick={() => handleClose(false)}
        >
            <div
                className={`bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl p-8
                    w-full max-w-sm text-center shadow-2xl shadow-black/60
                    transition-all duration-200 ease-out
                    ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="text-8xl mb-5">{emoji}</div>
                <p className="text-xl font-bold text-white mb-8 leading-snug">{title}</p>

                <div className="flex gap-3">
                    <button
                        onClick={() => handleClose(false)}
                        className="flex-1 bg-white/10 hover:bg-white/20 text-gray-300 font-bold
                            rounded-2xl transition-all active:scale-95"
                        style={{ minHeight: 56 }}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={() => handleClose(true)}
                        className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-bold
                            rounded-2xl shadow-lg shadow-teal-500/30 transition-all active:scale-95"
                        style={{ minHeight: 56 }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
