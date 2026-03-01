"use client";

import { useState, useEffect, useTransition } from "react";
import { getKidProgress, type KidProgressData } from "@/lib/parent-actions";

const MATH_CAT_LABELS: Record<string, { name: string; emoji: string }> = {
    ADDITION_SUBTRACTION: { name: "Sumas y Restas", emoji: "➕" },
    MULTIPLICATION: { name: "Multiplicación", emoji: "✖️" },
    DIVISION: { name: "División", emoji: "➗" },
    SEQUENCES: { name: "Sucesiones", emoji: "🔢" },
    PLACE_VALUE: { name: "Valor Posicional", emoji: "🏗️" },
    DECOMPOSITION: { name: "Descomposición", emoji: "🧩" },
    FRACTIONS: { name: "Fracciones", emoji: "🍕" },
    DECIMALS: { name: "Decimales", emoji: "🔍" },
};

interface KidProfile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
}

interface Props {
    kids: KidProfile[];
}

export default function KidProgressView({ kids }: Props) {
    const [selectedKid, setSelectedKid] = useState<string>(kids[0]?.id || "");
    const [progress, setProgress] = useState<KidProgressData | null>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (!selectedKid) return;
        startTransition(async () => {
            const data = await getKidProgress(selectedKid);
            setProgress(data);
        });
    }, [selectedKid]);

    const selectedKidProfile = kids.find(k => k.id === selectedKid);

    if (kids.length === 0) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
                <div className="text-5xl mb-4">👶</div>
                <p className="text-xl font-bold text-white mb-2">Sin hijos registrados</p>
                <p className="text-gray-400">Aún no hay hijos en tu familia.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Kid Selector */}
            <div className="flex gap-3 overflow-x-auto pb-2">
                {kids.map((kid) => (
                    <button
                        key={kid.id}
                        onClick={() => setSelectedKid(kid.id)}
                        className={`flex items-center gap-3 px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${
                            selectedKid === kid.id
                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                                : "bg-white/5 text-gray-400 hover:bg-white/10"
                        }`}
                    >
                        <span className="text-xl">{kid.avatar_url || "👤"}</span>
                        {kid.full_name || "Sin nombre"}
                    </button>
                ))}
            </div>

            {/* Loading */}
            {isPending && (
                <div className="text-center py-12">
                    <div className="text-4xl animate-bounce mb-4">📊</div>
                    <p className="text-gray-400">Cargando progreso...</p>
                </div>
            )}

            {/* Progress Content */}
            {progress && !isPending && (
                <div className="space-y-8">

                    {/* Alerta de Areas de Dificultad */}
                    {progress.mathContest.weakCategories.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-2xl">⚠️</span>
                                <h3 className="text-lg font-bold text-red-300">Áreas de Dificultad</h3>
                            </div>
                            <p className="text-gray-300 text-sm">
                                {selectedKidProfile?.full_name} tiene dificultad con:{" "}
                                <span className="font-bold text-red-300">
                                    {progress.mathContest.weakCategories
                                        .map(c => MATH_CAT_LABELS[c]?.name || c)
                                        .join(" y ")}
                                </span>
                            </p>
                        </div>
                    )}

                    {/* Alerta de Fortalezas */}
                    {progress.mathContest.strongCategories.length > 0 && (
                        <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-2xl">💪</span>
                                <h3 className="text-lg font-bold text-teal-300">Fortalezas</h3>
                            </div>
                            <p className="text-gray-300 text-sm">
                                {selectedKidProfile?.full_name} domina:{" "}
                                <span className="font-bold text-teal-300">
                                    {progress.mathContest.strongCategories
                                        .map(c => MATH_CAT_LABELS[c]?.name || c)
                                        .join(", ")}
                                </span>
                            </p>
                        </div>
                    )}

                    {/* Resumen General */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard emoji="🐝" value={progress.spellingBee.totalGames} label="Partidas Spelling" />
                        <StatCard emoji="🏆" value={progress.mathContest.totalGames} label="Partidas Mates" />
                        <StatCard
                            emoji="🎯"
                            value={progress.spellingBee.totalGames > 0 ? `${progress.spellingBee.avgAccuracy}%` : "-"}
                            label="Precisión Spelling"
                            color={accuracyColor(progress.spellingBee.avgAccuracy)}
                        />
                        <StatCard
                            emoji="🎯"
                            value={progress.mathContest.totalGames > 0 ? `${progress.mathContest.avgAccuracy}%` : "-"}
                            label="Precisión Mates"
                            color={accuracyColor(progress.mathContest.avgAccuracy)}
                        />
                    </div>

                    {/* Spelling Bee */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            🐝 Spelling Bee
                        </h3>
                        {progress.spellingBee.totalGames === 0 ? (
                            <EmptyGameState message="Aún no hay partidas de Spelling Bee" />
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                                        Precisión por Dificultad
                                    </h4>
                                    <div className="space-y-3">
                                        {Object.entries(progress.spellingBee.byDifficulty).map(([diff, data]) => (
                                            <ProgressRow
                                                key={diff}
                                                label={diff}
                                                value={data.avgAccuracy}
                                                detail={`${data.games} partidas`}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <RecentGamesTable
                                    games={progress.spellingBee.recentGames.map(g => ({
                                        date: g.createdAt,
                                        difficulty: g.difficulty,
                                        accuracy: g.accuracy,
                                        score: g.score,
                                    }))}
                                />
                            </div>
                        )}
                    </section>

                    {/* Copa de Mates */}
                    <section>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            🏆 Copa de Mates
                        </h3>
                        {progress.mathContest.totalGames === 0 ? (
                            <EmptyGameState message="Aún no hay partidas de Copa de Mates" />
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                                        Desglose por Categoría
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {Object.entries(progress.mathContest.byCategory).map(([catId, stats]) => {
                                            const cat = MATH_CAT_LABELS[catId];
                                            return (
                                                <div key={catId} className="bg-white/5 border border-white/5 rounded-xl p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-lg">{cat?.emoji || "?"}</span>
                                                        <span className="text-sm font-bold text-gray-300">
                                                            {cat?.name || catId}
                                                        </span>
                                                    </div>
                                                    <ProgressRow
                                                        label=""
                                                        value={stats.accuracy}
                                                        detail={`${stats.correct}/${stats.total} correctas`}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <RecentGamesTable
                                    games={progress.mathContest.recentGames.map(g => ({
                                        date: g.createdAt,
                                        difficulty: g.difficulty,
                                        accuracy: g.accuracy,
                                        score: g.score,
                                    }))}
                                />
                            </div>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}

// --- Sub-components ---

function accuracyColor(accuracy: number): string {
    if (accuracy >= 80) return "text-teal-400";
    if (accuracy >= 50) return "text-yellow-400";
    return "text-red-400";
}

function barColor(value: number): string {
    if (value >= 80) return "#2dd4bf";
    if (value >= 50) return "#eab308";
    return "#ef4444";
}

function StatCard({ emoji, value, label, color }: { emoji: string; value: string | number; label: string; color?: string }) {
    return (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-center">
            <span className="text-lg">{emoji}</span>
            <p className={`text-2xl font-bold mt-1 ${color || "text-white"}`}>{value}</p>
            <p className="text-gray-500 text-xs mt-1">{label}</p>
        </div>
    );
}

function ProgressRow({ label, value, detail }: { label: string; value: number; detail: string }) {
    return (
        <div>
            {label && (
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-gray-300">{label}</span>
                    <span className="text-xs text-gray-500">{detail}</span>
                </div>
            )}
            <div className="flex items-center gap-3">
                <div className="flex-1 h-3 rounded-full bg-white/10 overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${value}%`, backgroundColor: barColor(value) }}
                    />
                </div>
                <span className={`text-sm font-bold min-w-[40px] text-right ${value >= 80 ? "text-teal-400" : value >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                    {value}%
                </span>
            </div>
            {!label && <div className="text-xs text-gray-500 mt-1">{detail}</div>}
        </div>
    );
}

function EmptyGameState({ message }: { message: string }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-400 text-sm">{message}</p>
        </div>
    );
}

function RecentGamesTable({ games }: { games: Array<{ date: string; difficulty: string; accuracy: number; score: number }> }) {
    if (games.length === 0) return null;
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                Últimas Partidas
            </h4>
            <div className="space-y-2">
                {games.slice(0, 5).map((g, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                        <span className="text-gray-500 text-xs">
                            {new Date(g.date).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                        </span>
                        <span className="text-gray-300 font-bold">{g.difficulty}</span>
                        <span className={`font-bold ${g.accuracy >= 80 ? "text-teal-400" : g.accuracy >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                            {g.accuracy}%
                        </span>
                        <span className="text-yellow-400 font-bold">+{g.score}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
