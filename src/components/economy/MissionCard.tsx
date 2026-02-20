"use client";

import { useTransition } from "react";
import { submitMission } from "@/lib/actions";

export function MissionCard({ mission }: { mission: any }) {
    const [isPending, startTransition] = useTransition();

    const handleSubmit = () => {
        startTransition(async () => {
            await submitMission(mission);
            alert(`¡Misión "${mission.title}" enviada para aprobación!`);
        });
    };

    return (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:border-blue-400/30 transition-colors group">
            <div className="flex justify-between items-start mb-4">
                <div className="text-4xl group-hover:scale-110 transition-transform">{mission.icon || "📋"}</div>
                <div className="bg-blue-500/20 text-blue-300 text-xs font-bold px-3 py-1 rounded-full">
                    +{mission.reward_amount} PTS
                </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{mission.title}</h3>
            <p className="text-gray-400 text-xs mb-6 min-h-[40px]">{mission.description}</p>

            <button
                onClick={handleSubmit}
                disabled={isPending}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-bold py-3 rounded-xl transition-all active:scale-95"
            >
                {isPending ? "Enviando..." : "✅ Marcar como Hecha"}
            </button>
        </div>
    );
}
