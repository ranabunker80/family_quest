"use client";

import { useState, useEffect } from "react";

const MILESTONE_MESSAGES: Record<number, string> = {
    25: "Vas muy bien, ya llevas un cuarto!",
    50: "A la mitad! Sigue asi, campeon!",
    75: "Casi llegas! Eres imparable!",
    100: "LO LOGRASTE! Mision cumplida!",
};

const STREAK_MESSAGES = [
    "Racha de 3! Estas en fuego!",
    "4 seguidas! Increible!",
    "5 seguidas! Eres una maquina!",
    "Racha LEGENDARIA!",
];

const ENCOURAGEMENT_MESSAGES = [
    "No te preocupes, tu puedes!",
    "Sigue adelante, vas a lograrlo!",
    "Un error no te detiene!",
    "Animo! La proxima sera!",
];

export default function ProgressTracker({
    current,
    total,
    streak,
    lastAnswerCorrect,
    label = "Pregunta",
}: {
    current: number;
    total: number;
    streak: number;
    lastAnswerCorrect: boolean | null;
    label?: string;
}) {
    const [message, setMessage] = useState<string | null>(null);
    const [messageVisible, setMessageVisible] = useState(false);

    const progress = Math.round(((current - 1) / total) * 100);

    useEffect(() => {
        let msg: string | null = null;

        // Check milestones
        const prevProgress = Math.round(((current - 2) / total) * 100);
        for (const threshold of [25, 50, 75, 100]) {
            if (prevProgress < threshold && progress >= threshold) {
                msg = MILESTONE_MESSAGES[threshold];
                break;
            }
        }

        // Streak overrides milestone
        if (streak >= 3 && lastAnswerCorrect) {
            const streakIdx = Math.min(streak - 3, STREAK_MESSAGES.length - 1);
            msg = STREAK_MESSAGES[streakIdx];
        }

        // Encouragement after error
        if (lastAnswerCorrect === false && !msg) {
            msg = ENCOURAGEMENT_MESSAGES[Math.floor(Math.random() * ENCOURAGEMENT_MESSAGES.length)];
        }

        if (msg) {
            setMessage(msg);
            setMessageVisible(true);
            const timer = setTimeout(() => setMessageVisible(false), 2500);
            return () => clearTimeout(timer);
        }
    }, [current, streak, lastAnswerCorrect, progress, total]);

    const barGradient = streak >= 3
        ? "linear-gradient(90deg, #f59e0b, #ef4444)"
        : "linear-gradient(90deg, #2dd4bf, #3b82f6)";

    const barGlow = streak >= 3
        ? "0 0 16px rgba(245, 158, 11, 0.6)"
        : "0 0 12px rgba(45, 212, 191, 0.4)";

    return (
        <div className="w-full px-4 py-3 shrink-0">
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                    {label} {current} de {total}
                </span>
                <span className="text-sm font-bold text-teal-400">
                    {progress}%
                </span>
            </div>

            <div className="w-full h-5 rounded-full bg-white/5 border border-white/10 overflow-hidden relative">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${streak >= 3 ? "animate-pulse" : ""}`}
                    style={{
                        width: `${progress}%`,
                        background: barGradient,
                        boxShadow: barGlow,
                    }}
                />
                {progress > 30 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-white drop-shadow-md">{progress}%</span>
                    </div>
                )}
            </div>

            <div
                className={`mt-2 text-center transition-all duration-300 overflow-hidden ${messageVisible ? "max-h-12 opacity-100" : "max-h-0 opacity-0"}`}
            >
                <span
                    className={`text-sm font-bold inline-block px-4 py-1 rounded-full ${
                        streak >= 3
                            ? "bg-orange-500/20 text-orange-300"
                            : lastAnswerCorrect === false
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-teal-500/20 text-teal-300"
                    }`}
                >
                    {message}
                </span>
            </div>
        </div>
    );
}
