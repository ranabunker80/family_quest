"use client";

import { useState } from "react";
import { MissionCard } from "@/components/economy/MissionCard";
import { RewardCard } from "@/components/economy/RewardCard";

export default function KidDashboard({ profile, missions, rewards, history }: { profile: any, missions: any[], rewards: any[], history: any[] }) {
    const [activeTab, setActiveTab] = useState("missions");

    return (
        <div>
            {/* Tabs */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                <Tab label="📋 Misiones" id="missions" active={activeTab} set={setActiveTab} />
                <Tab label="🎁 Tienda" id="shop" active={activeTab} set={setActiveTab} />
                <Tab label="📜 Historial" id="history" active={activeTab} set={setActiveTab} />
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {activeTab === "missions" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {missions.map((m) => (
                            <MissionCard key={m.id} mission={m} />
                        ))}
                    </div>
                )}

                {activeTab === "shop" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {rewards.map((r) => (
                            <RewardCard key={r.id} reward={r} userCoins={profile.coins} />
                        ))}
                    </div>
                )}

                {activeTab === "history" && (
                    <div className="space-y-4">
                        {history.length === 0 && <p className="text-gray-500 text-center py-8">No hay actividad reciente.</p>}
                        {history.map((h) => (
                            <div key={h.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-white text-sm">{h.description}</p>
                                    <p className="text-xs text-gray-500">{new Date(h.created_at).toLocaleDateString()}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`font-bold ${h.amount > 0 ? 'text-teal-400' : 'text-red-400'}`}>
                                        {h.amount > 0 ? '+' : ''}{h.amount}
                                    </span>
                                    <div className="text-[10px] uppercase tracking-wider text-gray-500">
                                        {h.status === 'pending' ? '⏳ Pendiente' : h.status === 'approved' ? '✅ Aprobado' : '❌ Rechazado'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function Tab({ label, id, active, set }: any) {
    const isActive = active === id;
    return (
        <button
            onClick={() => set(id)}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap
        ${isActive
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
        >
            {label}
        </button>
    );
}
