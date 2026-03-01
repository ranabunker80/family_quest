"use client";

import { useState } from "react";
import { MissionCard } from "@/components/economy/MissionCard";
import { RewardCard } from "@/components/economy/RewardCard";
import Link from "next/link";

function EmptyState({ emoji, message, cta }: { emoji: string; message: string; cta?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <div className="text-7xl mb-4 animate-bounce-slow">{emoji}</div>
            <p className="text-lg font-bold text-gray-300 text-center mb-2">{message}</p>
            {cta && <p className="text-sm text-gray-500 text-center">{cta}</p>}
        </div>
    );
}

function StaggerItem({ children, index }: { children: React.ReactNode; index: number }) {
    return (
        <div
            className="animate-fade-in-up"
            style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
        >
            {children}
        </div>
    );
}

export default function KidDashboard({ profile, missions, rewards, history }: { profile: any, missions: any[], rewards: any[], history: any[] }) {
    const [activeTab, setActiveTab] = useState("missions");

    return (
        <div>
            {/* Inline keyframes for stagger animations */}
            <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.4s ease-out; }
                .animate-fade-in { animation: fade-in 0.5s ease-out; }
                .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
            `}</style>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
                <Tab label="📋 Misiones" id="missions" active={activeTab} set={setActiveTab} />
                <Tab label="🎮 Juegos" id="games" active={activeTab} set={setActiveTab} />
                <Tab label="🎁 Tienda" id="shop" active={activeTab} set={setActiveTab} />
                <Tab label="📜 Historial" id="history" active={activeTab} set={setActiveTab} />
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {activeTab === "missions" && (
                    <div className="space-y-6">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 mb-6 animate-fade-in">
                            <h3 className="text-xl font-bold text-blue-300 mb-2">Misiones Diarias</h3>
                            <p className="text-gray-400 text-sm">Completa estas tareas para ganar monedas y comprar premios.</p>
                        </div>
                        {missions.length === 0 ? (
                            <EmptyState
                                emoji="🎯"
                                message="¡No hay misiones aún!"
                                cta="Pide a tus papás que agreguen una"
                            />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {missions.map((m, i) => (
                                    <StaggerItem key={m.id} index={i}>
                                        <MissionCard mission={m} />
                                    </StaggerItem>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "games" && (
                    <div className="space-y-6">
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-6 mb-6 animate-fade-in">
                            <h3 className="text-xl font-bold text-purple-300 mb-2">Sala de Juegos</h3>
                            <p className="text-gray-400 text-sm">Diviértete y aprende para ganar puntos extra automáticamente.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            {/* Spelling Bee Card */}
                            <StaggerItem index={0}>
                                <Link href="/game" className="block bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:border-yellow-400/50 hover:bg-white/10 transition-all cursor-pointer group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-9xl">🐝</div>
                                    <div className="relative z-10">
                                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🐝</div>
                                        <h3 className="text-2xl font-bold text-white mb-2">Spelling Bee</h3>
                                        <p className="text-gray-400 text-sm mb-4">Deletrea palabras en inglés y gana monedas por cada acierto.</p>
                                        <span className="inline-block bg-yellow-500/20 text-yellow-300 text-xs font-bold px-3 py-1 rounded-full">
                                            +5 a +45 Pts
                                        </span>
                                    </div>
                                </Link>
                            </StaggerItem>

                            {/* Math Contest Card */}
                            <StaggerItem index={1}>
                                <Link href="/math-contest" className="block bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:border-teal-400/50 hover:bg-white/10 transition-all cursor-pointer group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-9xl">🏆</div>
                                    <div className="relative z-10">
                                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🏆</div>
                                        <h3 className="text-2xl font-bold text-white mb-2">Copa de Mates</h3>
                                        <p className="text-gray-400 text-sm mb-4">Practica para la Copa Nacional de Matemáticas con problemas de tu nivel.</p>
                                        <span className="inline-block bg-teal-500/20 text-teal-300 text-xs font-bold px-3 py-1 rounded-full">
                                            +5 a +60 Pts
                                        </span>
                                    </div>
                                </Link>
                            </StaggerItem>

                            {/* Exam Prep Card */}
                            <StaggerItem index={2}>
                                <Link href="/exam-prep" className="block bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:border-orange-400/50 hover:bg-white/10 transition-all cursor-pointer group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-9xl">📚</div>
                                    <div className="relative z-10">
                                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">📚</div>
                                        <h3 className="text-2xl font-bold text-white mb-2">Misión Examen</h3>
                                        <p className="text-gray-400 text-sm mb-4">Estudia para tu examen de forma divertida e interactiva.</p>
                                        <span className="inline-block bg-orange-500/20 text-orange-300 text-xs font-bold px-3 py-1 rounded-full">
                                            3 Mundos · 10 Niveles
                                        </span>
                                    </div>
                                </Link>
                            </StaggerItem>

                        </div>
                    </div>
                )}

                {activeTab === "shop" && (
                    <div className="space-y-6">
                        <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-6 mb-6 animate-fade-in">
                            <h3 className="text-xl font-bold text-teal-300 mb-2">Tienda de Premios</h3>
                            <p className="text-gray-400 text-sm">Usa tus monedas para canjear recompensas increíbles.</p>
                        </div>
                        {rewards.length === 0 ? (
                            <EmptyState
                                emoji="🎁"
                                message="¡Pronto habrá premios!"
                                cta="Sigue jugando y acumulando puntos"
                            />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {rewards.map((r, i) => (
                                    <StaggerItem key={r.id} index={i}>
                                        <RewardCard reward={r} userCoins={profile.coins} />
                                    </StaggerItem>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "history" && (
                    <div className="space-y-4">
                        {history.length === 0 ? (
                            <EmptyState
                                emoji="📜"
                                message="Aquí aparecerá tu historial de aventuras"
                                cta="Completa misiones y juega para empezar"
                            />
                        ) : (
                            history.map((h, i) => (
                                <StaggerItem key={h.id} index={i}>
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex justify-between items-center">
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
                                </StaggerItem>
                            ))
                        )}
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
            className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap
        ${isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40 transform scale-105'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
        >
            {label}
        </button>
    );
}
