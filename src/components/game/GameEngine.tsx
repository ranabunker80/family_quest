"use client";

import { useState, useEffect, useRef } from "react";
import { CATEGORIES, HINTS, DIFFICULTY } from "@/lib/words";
import { submitGameResult } from "@/lib/actions";

type GameState = {
    diff: keyof typeof DIFFICULTY;
    words: { w: string; c: keyof typeof CATEGORIES }[];
    index: number;
    answers: any[];
    startTime: number;
    timeLeft: number | null;
    score: number;
    streak: number;
    status: "playing" | "results";
};

export default function GameEngine({ profile }: { profile: any }) {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [selectedDiff, setSelectedDiff] = useState<keyof typeof DIFFICULTY | null>(null);

    const startGame = (diffKey: keyof typeof DIFFICULTY) => {
        const diff = DIFFICULTY[diffKey];

        // Select random words
        const cats = Object.keys(CATEGORIES) as Array<keyof typeof CATEGORIES>;
        const shuffledCats = cats.sort(() => 0.5 - Math.random()).slice(0, 5);

        let pool: { w: string; c: keyof typeof CATEGORIES }[] = [];
        shuffledCats.forEach(c => {
            const words = CATEGORIES[c].words.sort(() => 0.5 - Math.random()).slice(0, 3);
            words.forEach(w => pool.push({ w, c }));
        });

        const gameWords = pool.sort(() => 0.5 - Math.random()).slice(0, diff.wordCount);

        setGameState({
            diff: diffKey,
            words: gameWords,
            index: 0,
            answers: [],
            startTime: Date.now(),
            timeLeft: diff.timeLimit || null,
            score: 0,
            streak: 0,
            status: "playing"
        });
    };

    if (!selectedDiff) {
        return <GameSelector onSelect={(d) => { setSelectedDiff(d); startGame(d); }} />;
    }

    if (gameState?.status === "results") {
        return <GameResults gameState={gameState} onRestart={() => setSelectedDiff(null)} profile={profile} />;
    }

    return <GamePlay gameState={gameState!} setGameState={setGameState} />;
}

// --- SUB COMPONENTS ---

export function GameSelector({ onSelect }: { onSelect: (d: keyof typeof DIFFICULTY) => void }) {
    return (
        <div className="max-w-md mx-auto p-4">
            <h2 className="text-3xl font-bold text-center mb-8 text-white">🐝 Spelling Bee</h2>
            <div className="space-y-4">
                {(Object.entries(DIFFICULTY) as [keyof typeof DIFFICULTY, any][]).map(([key, d]) => (
                    <button
                        key={key}
                        onClick={() => onSelect(key)}
                        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-6 transition-all text-left flex items-center gap-4 group"
                        style={{ borderColor: d.color + '40' }}
                    >
                        <div className="text-2xl min-w-[60px] text-center">{"⭐".repeat(d.stars)}</div>
                        <div className="flex-1">
                            <div className="text-xl font-bold" style={{ color: d.color }}>{d.label}</div>
                            <div className="text-xs text-gray-400">{d.desc}</div>
                        </div>
                        <div className="text-xl font-bold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: d.color }}>
                            PLAY
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

function GamePlay({ gameState, setGameState }: { gameState: GameState, setGameState: any }) {
    const [input, setInput] = useState("");
    const [feedback, setFeedback] = useState<"ok" | "no" | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const currentWord = gameState.words[gameState.index];
    const diff = DIFFICULTY[gameState.diff];
    const hint = HINTS[currentWord.w] || "❓";
    const cat = CATEGORIES[currentWord.c];

    useEffect(() => {
        inputRef.current?.focus();
        setInput("");
    }, [gameState.index]);

    useEffect(() => {
        if (!diff.timeLimit || gameState.timeLeft === null) return;
        if (gameState.timeLeft <= 0) {
            submitAnswer(""); // Time's up
            return;
        }
        const t = setInterval(() => {
            setGameState((prev: GameState) => ({ ...prev, timeLeft: (prev.timeLeft || 0) - 1 }));
        }, 1000);
        return () => clearInterval(t);
    }, [gameState.timeLeft]);

    const submitAnswer = (overrideInput?: string) => {
        const val = overrideInput !== undefined ? overrideInput : input;
        const isCorrect = val.trim().toLowerCase() === currentWord.w.toLowerCase();

        if (isCorrect) {
            setFeedback("ok");
        } else {
            setFeedback("no");
        }
        // No auto-advance
    };

    const nextWord = () => {
        setFeedback(null);
        const val = input;
        const isCorrect = val.trim().toLowerCase() === currentWord.w.toLowerCase();

        // Calculate Score
        const base = isCorrect ? (currentWord.w.length <= 3 ? 5 : currentWord.w.length <= 5 ? 10 : 15) : 0;
        const streakBonus = isCorrect && gameState.streak >= 2 ? 5 : 0;
        const points = (base + streakBonus) * diff.multiplier;

        const newStreak = isCorrect ? gameState.streak + 1 : 0;
        const newScore = gameState.score + points;

        const newAnswer = {
            w: currentWord.w,
            ok: isCorrect,
            input: val,
            pts: points
        };

        const nextIndex = gameState.index + 1;

        if (nextIndex >= gameState.words.length) {
            setGameState({
                ...gameState,
                index: nextIndex,
                answers: [...gameState.answers, newAnswer],
                score: newScore,
                streak: newStreak,
                status: "results"
            });
        } else {
            setGameState({
                ...gameState,
                index: nextIndex,
                answers: [...gameState.answers, newAnswer],
                score: newScore,
                streak: newStreak,
                timeLeft: diff.timeLimit || null
            });
        }
    };

    return (
        <div className="max-w-md mx-auto p-4 text-center h-full flex flex-col justify-center">
            <div className="flex justify-between items-center mb-8 text-sm font-bold text-gray-500 shrink-0">
                <span>{gameState.index + 1} / {gameState.words.length}</span>
                <span className={`${(gameState.timeLeft || 10) < 5 ? 'text-red-500 animate-pulse' : ''}`}>
                    {gameState.timeLeft !== null ? `⏱ ${gameState.timeLeft}s` : '∞'}
                </span>
            </div>

            <div className={`transition-all duration-300 transform flex-1 flex flex-col justify-center ${feedback === 'no' ? 'animate-shake' : ''}`}>
                <div className="text-6xl mb-4">{diff.showHint ? hint : "❓"}</div>
                <div className="text-xl font-bold mb-2" style={{ color: cat.color }}>{cat.emoji} {currentWord.c}</div>

                {diff.showFirst && (
                    <div className="text-4xl font-mono text-yellow-400 tracking-[0.5em] mb-8">
                        {currentWord.w[0].toUpperCase()}{"_".repeat(currentWord.w.length - 1)}
                    </div>
                )}

                <div className="flex gap-2 justify-center mb-8">
                    {Array.from({ length: currentWord.w.length }).map((_, i) => (
                        <div key={i} className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold uppercase
                    ${input[i] ? 'border-white bg-white/10' : 'border-white/10'}`}>
                            {input[i] || ""}
                        </div>
                    ))}
                </div>

                <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
                    className="w-full bg-transparent border-b-2 border-white/20 text-center text-2xl py-2 outline-none focus:border-yellow-400 text-transparent caret-white absolute opacity-0 pointer-events-none"
                    autoFocus
                />

                {/* Mobile Input trigger */}
                <button onClick={() => inputRef.current?.focus()} className="bg-white/10 px-6 py-3 rounded-xl font-bold mb-4 shrink-0">
                    ⌨ Escribir
                </button>
            </div>

            {feedback && (
                <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md transition-opacity p-6`}>
                    <div className="text-8xl mb-6 animate-bounce">
                        {feedback === "ok" ? "✅" : "❌"}
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-2">
                        {feedback === "ok" ? "¡Correcto!" : "¡Ups!"}
                    </h3>
                    {feedback === "no" && (
                        <p className="text-xl text-gray-300 mb-8">
                            Era: <span className="font-bold text-yellow-400">{currentWord.w.toUpperCase()}</span>
                        </p>
                    )}

                    <button
                        onClick={nextWord}
                        autoFocus
                        className="bg-white text-black font-bold text-xl px-12 py-4 rounded-2xl hover:scale-105 transition-transform shadow-2xl shadow-white/20"
                    >
                        Siguiente →
                    </button>
                </div>
            )}
        </div>
    );
}

function GameResults({ gameState, onRestart, profile }: { gameState: GameState, onRestart: any, profile: any }) {
    const diff = DIFFICULTY[gameState.diff];
    const correct = gameState.answers.filter(a => a.ok).length;
    const total = gameState.words.length;
    const accuracy = Math.round((correct / total) * 100);

    useEffect(() => {
        if (gameState.score > 0) {
            submitGameResult(gameState.score, gameState.diff, accuracy);
        }
    }, []);

    return (
        <div className="max-w-md mx-auto p-4 text-center">
            <div className="text-6xl mb-4">
                {accuracy >= 80 ? "🏆" : accuracy >= 50 ? "⭐" : "💪"}
            </div>
            <h2 className="text-3xl font-bold mb-2">
                {accuracy >= 80 ? "¡Increíble!" : "¡Buen intento!"}
            </h2>
            <p className="text-gray-400 mb-8">{diff.label} • {gameState.score} Puntos</p>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white/5 rounded-2xl p-4">
                    <div className="text-2xl font-bold text-teal-400">{accuracy}%</div>
                    <div className="text-xs text-gray-500">Precisión</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-4">
                    <div className="text-2xl font-bold text-yellow-400">+{gameState.score}</div>
                    <div className="text-xs text-gray-500">Monedas</div>
                </div>
            </div>

            <button onClick={onRestart} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-xl mb-4">
                🔄 Jugar otra vez
            </button>
            <a href="/" className="block text-gray-400 text-sm hover:text-white">
                Volver al inicio
            </a>
        </div>
    )
}
