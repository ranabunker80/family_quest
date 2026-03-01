"use client";

import Link from "next/link";
import { getAllWorlds } from "@/lib/exam-data/types";

export default function ExamPrepHub({ previewMode = false }: { previewMode?: boolean }) {
    const worlds = getAllWorlds();

    return (
        <div className="max-w-md mx-auto p-4 flex flex-col h-full justify-center">
            {previewMode && (
                <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3">
                    <span className="text-xl">👀</span>
                    <div>
                        <p className="text-amber-300 font-bold text-sm">Modo Preview</p>
                        <p className="text-amber-300/60 text-xs">Los resultados NO se guardan</p>
                    </div>
                </div>
            )}
            <h2 className="text-4xl font-bold text-center mb-2 text-white">📚 Misión Examen</h2>
            <p className="text-center text-gray-400 mb-10 text-sm">Estudia para tu examen jugando. Elige tu mundo:</p>
            <div className="space-y-5">
                {worlds.map((world) => {
                    const totalQuestions = world.levels.reduce((sum, l) => sum + l.questions.length, 0);
                    return (
                        <Link
                            key={world.id}
                            href={`/exam-prep/${world.id}${previewMode ? "?preview=true" : ""}`}
                            className="block bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all group active:scale-95 relative overflow-hidden"
                            style={{ borderColor: world.color + "40" }}
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-9xl">
                                {world.emoji}
                            </div>
                            <div className="relative z-10 flex items-center gap-5">
                                <div className="text-5xl group-hover:scale-110 transition-transform">{world.emoji}</div>
                                <div className="flex-1">
                                    <div className="text-2xl font-bold mb-1" style={{ color: world.color }}>{world.title}</div>
                                    <div className="text-sm text-gray-400 mb-2">{world.description}</div>
                                    <div className="text-xs text-gray-500">{world.levels.length} niveles · {totalQuestions} preguntas</div>
                                </div>
                                <div className="text-3xl font-bold opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: world.color }}>▶</div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
