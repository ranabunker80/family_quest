"use client";

export default function ProgressBar({ current, total }: { current: number; total: number }) {
    const progress = ((current) / total) * 100;

    return (
        <div className="w-full px-4 py-2 shrink-0">
            <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Palabra {current} de {total}
                </span>
                <span className="text-xs font-bold text-teal-400">
                    {Math.round(progress)}%
                </span>
            </div>
            <div className="w-full h-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                        width: `${progress}%`,
                        background: "linear-gradient(90deg, #2dd4bf, #3b82f6)",
                        boxShadow: "0 0 12px rgba(45, 212, 191, 0.4)",
                    }}
                />
            </div>
        </div>
    );
}
