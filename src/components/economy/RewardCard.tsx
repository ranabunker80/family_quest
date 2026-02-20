"use client";

import { useTransition } from "react";
import { redeemReward } from "@/lib/actions";

export function RewardCard({ reward, userCoins }: { reward: any, userCoins: number }) {
    const [isPending, startTransition] = useTransition();
    const canAfford = userCoins >= reward.cost;

    const handleRedeem = () => {
        if (!canAfford) return;
        if (!confirm(`¿Seguro que quieres canjear "${reward.title}" por ${reward.cost} monedas?`)) return;

        startTransition(async () => {
            await redeemReward(reward, userCoins);
            alert(`¡Solictud de canje enviada!`);
        });
    };

    return (
        <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 transition-colors group ${canAfford ? 'hover:border-teal-400/30' : 'opacity-70 grayscale'}`}>
            <div className="flex justify-between items-start mb-4">
                <div className="text-4xl group-hover:scale-110 transition-transform">{reward.icon || "🎁"}</div>
                <div className={`text-xs font-bold px-3 py-1 rounded-full ${canAfford ? 'bg-teal-500/20 text-teal-300' : 'bg-red-500/20 text-red-300'}`}>
                    {reward.cost} PTS
                </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{reward.title}</h3>

            <button
                onClick={handleRedeem}
                disabled={isPending || !canAfford}
                className={`w-full text-sm font-bold py-3 rounded-xl transition-all active:scale-95 mt-6
            ${canAfford
                        ? 'bg-teal-500 hover:bg-teal-600 text-white shadow-lg shadow-teal-500/20'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
            >
                {isPending ? "Procesando..." : canAfford ? "Canjear" : "Faltan Puntos"}
            </button>
        </div>
    );
}
